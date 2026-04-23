"""
Step 2 — Import donation records from a Google Sheets CSV export.

Expected CSV columns (case-insensitive, extra columns ignored):
  Date / gift_date        — YYYY-MM-DD or MM/DD/YYYY (required)
  Donor / donor_name      — donor display name (matched to imported donors)
  Amount                  — numeric amount in TWD (required)
  Campus                  — campus name
  Fund                    — fund name
  Payment Method          — cash / card / bank_transfer / check / other
  Deposit Reference       — slip/cheque number
  Notes                   — free-text

Export the "Transaction Records" (or equivalent) sheet as CSV and save to:
  scripts/migrate/csv/donations.csv

  python 02_import_donations.py [--dry-run]
"""

import csv
import sys
import os
import re
from datetime import datetime
from config import get_client, CSV_DIR, normalize_payment_method

CSV_PATH = os.path.join(CSV_DIR, "donations.csv")
DRY_RUN = "--dry-run" in sys.argv

# ── Column aliases ────────────────────────────────────────────────────────────
DATE_COLS    = ["date", "gift date", "gift_date", "donation date"]
DONOR_COLS   = ["donor", "donor name", "name", "display_name"]
AMOUNT_COLS  = ["amount", "nt$", "ntd", "twd", "金額"]
CAMPUS_COLS  = ["campus", "堂區"]
FUND_COLS    = ["fund", "用途", "fund name"]
METHOD_COLS  = ["payment method", "payment_method", "method", "付款方式"]
REF_COLS     = ["deposit reference", "deposit_reference", "reference", "ref", "cheque", "check #"]
NOTES_COLS   = ["notes", "note", "備註"]

def col(row: dict, aliases: list[str]) -> str:
    for a in aliases:
        for k in row:
            if k.strip().lower() == a:
                return row[k].strip()
    return ""

DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%m-%d-%Y"]

def parse_date(raw: str) -> str | None:
    raw = raw.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None

def parse_amount(raw: str) -> float | None:
    cleaned = re.sub(r"[^\d.]", "", raw.strip())
    try:
        return float(cleaned)
    except ValueError:
        return None

def main():
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: {CSV_PATH} not found.")
        sys.exit(1)

    sb = get_client()

    # Build lookup maps
    camps = sb.from_("campuses").select("id, name").execute().data
    campus_map = {c["name"].lower(): c["id"] for c in camps}

    funds = sb.from_("funds").select("id, name").execute().data
    fund_map = {f["name"].lower(): f["id"] for f in funds}

    donors = sb.from_("donors").select("id, display_name").execute().data
    donor_map = {d["display_name"].lower(): d["id"] for d in donors}

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    print(f"Found {len(rows)} rows in CSV")
    inserted = skipped = errors = 0
    unmatched_donors: set[str] = set()
    unmatched_campuses: set[str] = set()
    unmatched_funds: set[str] = set()

    for i, row in enumerate(rows, 1):
        date_raw  = col(row, DATE_COLS)
        amount_raw = col(row, AMOUNT_COLS)
        donor_raw  = col(row, DONOR_COLS)
        campus_raw = col(row, CAMPUS_COLS)
        fund_raw   = col(row, FUND_COLS)
        method_raw = col(row, METHOD_COLS)
        ref        = col(row, REF_COLS) or None
        notes      = col(row, NOTES_COLS) or None

        gift_date = parse_date(date_raw)
        if not gift_date:
            print(f"  Row {i}: skipping — invalid date {date_raw!r}")
            skipped += 1
            continue

        amount = parse_amount(amount_raw)
        if not amount or amount <= 0:
            print(f"  Row {i}: skipping — invalid amount {amount_raw!r}")
            skipped += 1
            continue

        donor_id = donor_map.get(donor_raw.lower()) if donor_raw else None
        if donor_raw and not donor_id:
            unmatched_donors.add(donor_raw)

        campus_id = campus_map.get(campus_raw.lower()) if campus_raw else None
        if campus_raw and not campus_id:
            unmatched_campuses.add(campus_raw)

        fund_id = fund_map.get(fund_raw.lower()) if fund_raw else None
        if fund_raw and not fund_id:
            unmatched_funds.add(fund_raw)

        if not campus_id:
            print(f"  Row {i}: skipping — campus {campus_raw!r} not found")
            skipped += 1
            continue
        if not fund_id:
            print(f"  Row {i}: skipping — fund {fund_raw!r} not found")
            skipped += 1
            continue

        record = {
            "gift_date": gift_date,
            "amount": amount,
            "donor_id": donor_id,
            "campus_id": campus_id,
            "fund_id": fund_id,
            "payment_method": normalize_payment_method(method_raw) if method_raw else "other",
            "deposit_reference": ref,
            "notes": notes,
        }

        if DRY_RUN:
            print(f"  [DRY RUN] {gift_date}  {donor_raw or 'anon':30s}  NT${amount:>10,.0f}  {campus_raw}/{fund_raw}")
            inserted += 1
            continue

        try:
            sb.from_("donations").insert(record).execute()
            inserted += 1
        except Exception as e:
            print(f"  Row {i} ERROR: {e}")
            errors += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")

    if unmatched_donors:
        print(f"\n⚠  Unmatched donors ({len(unmatched_donors)}) — these were recorded as anonymous:")
        for d in sorted(unmatched_donors):
            print(f"   {d!r}")

    if unmatched_campuses:
        print(f"\n⚠  Unmatched campuses — rows were SKIPPED:")
        for c in sorted(unmatched_campuses):
            print(f"   {c!r}")

    if unmatched_funds:
        print(f"\n⚠  Unmatched funds — rows were SKIPPED:")
        for f in sorted(unmatched_funds):
            print(f"   {f!r}")

if __name__ == "__main__":
    main()
