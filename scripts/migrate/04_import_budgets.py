"""
Step 4 — Import budget records from a Google Sheets CSV export.

Expected CSV columns (case-insensitive, extra columns ignored):
  Year / fiscal_year      — e.g. 2024 (required)
  Month / fiscal_month    — 1–12 (required)
  Campus                  — campus name (required)
  Fund                    — fund name (required)
  Amount / budgeted_amount — numeric amount in TWD (required)
  Notes                   — optional

If your Sheets has one row per fund with 12 monthly columns (Jan–Dec),
see the alternate "wide format" parsing below.

  python 04_import_budgets.py [--dry-run] [--wide]
"""

import csv
import sys
import os
import re
from config import get_client, CSV_DIR

CSV_PATH = os.path.join(CSV_DIR, "budgets.csv")
DRY_RUN  = "--dry-run" in sys.argv
WIDE     = "--wide" in sys.argv   # each row = campus+fund+year, cols = Jan..Dec

YEAR_COLS   = ["year", "fiscal year", "fiscal_year"]
MONTH_COLS  = ["month", "fiscal month", "fiscal_month"]
CAMPUS_COLS = ["campus", "堂區"]
FUND_COLS   = ["fund", "用途"]
AMOUNT_COLS = ["amount", "budgeted amount", "budgeted_amount", "budget", "nt$"]
NOTES_COLS  = ["notes"]

MONTH_NAMES = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

def col(row: dict, aliases: list[str]) -> str:
    for a in aliases:
        for k in row:
            if k.strip().lower() == a:
                return row[k].strip()
    return ""

def parse_amount(raw: str) -> float | None:
    cleaned = re.sub(r"[^\d.]", "", raw.strip())
    try:
        v = float(cleaned)
        return v if v >= 0 else None
    except ValueError:
        return None

def main():
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: {CSV_PATH} not found.")
        sys.exit(1)

    sb = get_client()

    camps = sb.from_("campuses").select("id, name").execute().data
    campus_map = {c["name"].lower(): c["id"] for c in camps}

    funds = sb.from_("funds").select("id, name").execute().data
    fund_map = {f["name"].lower(): f["id"] for f in funds}

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)

    print(f"Found {len(rows)} rows in CSV")
    inserted = skipped = errors = 0

    # ── Wide format: campus | fund | year | Jan | Feb | ... | Dec ─────────────
    if WIDE:
        month_cols = {
            h.strip().lower(): MONTH_NAMES[h.strip().lower()]
            for h in fieldnames
            if h.strip().lower() in MONTH_NAMES
        }

        for i, row in enumerate(rows, 1):
            campus_raw = col(row, CAMPUS_COLS)
            fund_raw   = col(row, FUND_COLS)
            year_raw   = col(row, YEAR_COLS)

            campus_id = campus_map.get(campus_raw.lower()) if campus_raw else None
            fund_id   = fund_map.get(fund_raw.lower()) if fund_raw else None

            if not campus_id or not fund_id:
                print(f"  Row {i}: skipping — campus={campus_raw!r} fund={fund_raw!r}")
                skipped += 1
                continue

            try:
                year = int(year_raw)
            except (ValueError, TypeError):
                print(f"  Row {i}: skipping — invalid year {year_raw!r}")
                skipped += 1
                continue

            for h, month in month_cols.items():
                raw_val = row.get(h, "") or ""
                amount = parse_amount(raw_val)
                if not amount:
                    continue

                record = {
                    "campus_id": campus_id,
                    "fund_id": fund_id,
                    "fiscal_year": year,
                    "fiscal_month": month,
                    "budgeted_amount": amount,
                }

                if DRY_RUN:
                    print(f"  [DRY RUN] {year}-{month:02d}  {campus_raw}/{fund_raw}  NT${amount:,.0f}")
                    inserted += 1
                    continue

                try:
                    sb.from_("budgets").insert(record).execute()
                    inserted += 1
                except Exception as e:
                    print(f"  Row {i} month {month} ERROR: {e}")
                    errors += 1

    # ── Long format: one row per campus+fund+year+month ───────────────────────
    else:
        for i, row in enumerate(rows, 1):
            year_raw   = col(row, YEAR_COLS)
            month_raw  = col(row, MONTH_COLS)
            campus_raw = col(row, CAMPUS_COLS)
            fund_raw   = col(row, FUND_COLS)
            amount_raw = col(row, AMOUNT_COLS)
            notes      = col(row, NOTES_COLS) or None

            campus_id = campus_map.get(campus_raw.lower()) if campus_raw else None
            fund_id   = fund_map.get(fund_raw.lower()) if fund_raw else None

            if not campus_id:
                print(f"  Row {i}: skipping — campus {campus_raw!r} not found")
                skipped += 1
                continue
            if not fund_id:
                print(f"  Row {i}: skipping — fund {fund_raw!r} not found")
                skipped += 1
                continue

            try:
                year = int(year_raw)
                month_v = month_raw.strip().lower()
                month = MONTH_NAMES.get(month_v) or int(month_v)
                assert 1 <= month <= 12
            except Exception:
                print(f"  Row {i}: skipping — invalid year/month {year_raw!r}/{month_raw!r}")
                skipped += 1
                continue

            amount = parse_amount(amount_raw)
            if not amount:
                skipped += 1
                continue

            record = {
                "campus_id": campus_id,
                "fund_id": fund_id,
                "fiscal_year": year,
                "fiscal_month": month,
                "budgeted_amount": amount,
                "notes": notes,
            }

            if DRY_RUN:
                print(f"  [DRY RUN] {year}-{month:02d}  {campus_raw}/{fund_raw}  NT${amount:,.0f}")
                inserted += 1
                continue

            try:
                sb.from_("budgets").insert(record).execute()
                inserted += 1
            except Exception as e:
                print(f"  Row {i} ERROR: {e}")
                errors += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")

if __name__ == "__main__":
    main()
