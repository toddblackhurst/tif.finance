"""
Import budgets from Budget_2026.csv (TIF actual format).

The budget CSV has 7 lines: 4 are campus envelopes (mapped to campuses + General fund),
3 are category totals (Operations, Church Care, Bills) which don't map to a campus —
those are accumulated and imported as a SINGLE combined record per month under
the TIF System campus + General fund to avoid the unique constraint on
(campus_id, fund_id, fiscal_year, fiscal_month).

Annual budgets are divided evenly across 12 months.

Pass --delete-tif-system to wipe existing TIF System/General rows before re-importing.
"""
import csv, re, sys, os
from collections import defaultdict
from config import get_client, CSV_DIR

CSV_FILE = os.path.join(CSV_DIR, "TIF.2026 TIF System Master Budget Spreadsheet - Budget_2026.csv")
DRY_RUN        = "--dry-run" in sys.argv
DELETE_EXISTING = "--delete-tif-system" in sys.argv

# Map budget_line → campus name (for campus envelopes)
CAMPUS_BUDGET_LINES = {
    "tif north":                    "TIF North",
    "tif south":                    "TIF South",
    "all praise":                   "All Praise",
    "hope fellowship 盼望教會":       "Hope Fellowship 盼望教會",
}

# Category lines that all roll up into TIF System / General
CATEGORY_LINES = {
    "operations and facilities",
    "church care",
    "bills & fixed costs",
}

def parse_amount(raw: str) -> float | None:
    cleaned = re.sub(r"[^\d.]", "", raw.strip())
    try:
        v = float(cleaned)
        return v if v > 0 else None
    except ValueError:
        return None

def main():
    sb = get_client()

    campus_map = {c["name"].lower(): c["id"]
                  for c in sb.from_("campuses").select("id, name").execute().data}
    fund_map   = {f["name"].lower(): f["id"]
                  for f in sb.from_("funds").select("id, name").execute().data}

    general_id    = fund_map.get("general")
    tif_system_id = campus_map.get("tif system")

    if not tif_system_id:
        print("ERROR: 'TIF System' campus not found — check campus names")
        return
    if not general_id:
        print("ERROR: 'General' fund not found — check fund names")
        return

    with open(CSV_FILE, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    print(f"Found {len(rows)} budget lines")

    # Accumulate category amounts per (year, month)
    # key: (year, month) → {"total": float, "lines": [str]}
    category_totals: dict[tuple[int,int], dict] = defaultdict(lambda: {"total": 0.0, "lines": []})

    inserted = skipped = errors = 0

    for row in rows:
        year_raw    = row.get("year", "").strip()
        line        = row.get("budget_line", "").strip()
        annual_raw  = row.get("annual_budget", "").strip()
        monthly_raw = row.get("monthly_budget", "").strip()
        note        = row.get("note", "").strip() or None

        try:
            year = int(year_raw)
        except ValueError:
            print(f"  Skip — invalid year {year_raw!r}")
            skipped += 1; continue

        annual  = parse_amount(annual_raw)
        monthly = parse_amount(monthly_raw)
        if not annual:
            skipped += 1; continue

        line_lower = line.lower()
        month_amount = monthly if monthly else round(annual / 12, 2)

        if line_lower in CAMPUS_BUDGET_LINES:
            # Campus envelope — insert 12 rows directly
            campus_name = CAMPUS_BUDGET_LINES[line_lower]
            campus_id   = campus_map.get(campus_name.lower())
            if not campus_id:
                print(f"  Skip — campus not found for '{line}'")
                skipped += 1; continue

            for month in range(1, 13):
                record = {
                    "campus_id":        campus_id,
                    "fund_id":          general_id,
                    "fiscal_year":      year,
                    "fiscal_month":     month,
                    "budgeted_amount":  month_amount,
                    "notes":            f"{line} — {note}" if note else line,
                }
                if DRY_RUN:
                    print(f"  [DRY] {year}-{month:02d}  {line:45s}  NT${month_amount:>12,.2f}")
                    inserted += 1; continue
                try:
                    sb.from_("budgets").insert(record).execute()
                    inserted += 1
                except Exception as e:
                    print(f"  ERROR {line} month {month}: {e}")
                    errors += 1

        elif line_lower in CATEGORY_LINES:
            # Accumulate into combined TIF System total
            label = f"{line} — {note}" if note else line
            for month in range(1, 13):
                category_totals[(year, month)]["total"] += month_amount
                category_totals[(year, month)]["lines"].append(label)

        else:
            print(f"  Skip — unknown budget line {line!r}")
            skipped += 1

    # --- Insert combined category totals ---
    if category_totals:
        if DELETE_EXISTING and not DRY_RUN:
            print(f"\nDeleting existing TIF System / General budget rows…")
            result = (sb.from_("budgets")
                        .delete()
                        .eq("campus_id", tif_system_id)
                        .eq("fund_id", general_id)
                        .execute())
            deleted = len(result.data) if result.data else "?"
            print(f"  Deleted {deleted} rows")

        print(f"\nInserting {len(category_totals)} combined TIF System category rows…")
        for (year, month), data in sorted(category_totals.items()):
            total   = round(data["total"], 2)
            note_str = " + ".join(data["lines"])
            record  = {
                "campus_id":       tif_system_id,
                "fund_id":         general_id,
                "fiscal_year":     year,
                "fiscal_month":    month,
                "budgeted_amount": total,
                "notes":           note_str,
            }
            if DRY_RUN:
                print(f"  [DRY] {year}-{month:02d}  TIF System (combined)  NT${total:>12,.2f}")
                inserted += 1; continue
            try:
                sb.from_("budgets").insert(record).execute()
                inserted += 1
            except Exception as e:
                print(f"  ERROR TIF System month {month}: {e}")
                errors += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")

if __name__ == "__main__":
    main()
