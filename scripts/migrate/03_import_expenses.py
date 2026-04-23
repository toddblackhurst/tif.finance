"""
Step 3 — Import expense records from a Google Sheets CSV export.

Expected CSV columns (case-insensitive, extra columns ignored):
  Date / expense_date     — YYYY-MM-DD or MM/DD/YYYY (required)
  Description             — what the expense was for (required)
  Category                — ministry/facilities/staffing/missions/vbs/worship/admin/other
  Amount                  — numeric amount in TWD (required)
  Campus                  — campus name
  Fund                    — fund name
  Status                  — draft/submitted/approved/rejected/paid (default: paid for historical)
  Payment Method          — cash / card / bank_transfer / check / other
  Submitted By / submitter — user email (matched to user_profiles)
  Notes                   — free-text
  Approval Notes          — notes from approver

Export the "Expense Requests" sheet as CSV and save to:
  scripts/migrate/csv/expenses.csv

  python 03_import_expenses.py [--dry-run]
"""

import csv
import sys
import os
import re
from datetime import datetime
from config import get_client, CSV_DIR, normalize_payment_method

CSV_PATH = os.path.join(CSV_DIR, "expenses.csv")
DRY_RUN = "--dry-run" in sys.argv

# ── Column aliases ────────────────────────────────────────────────────────────
DATE_COLS        = ["date", "expense date", "expense_date"]
DESC_COLS        = ["description", "desc", "what", "item"]
CATEGORY_COLS    = ["category", "cat", "type"]
AMOUNT_COLS      = ["amount", "nt$", "ntd", "twd", "金額"]
CAMPUS_COLS      = ["campus", "堂區"]
FUND_COLS        = ["fund", "用途"]
STATUS_COLS      = ["status", "狀態"]
METHOD_COLS      = ["payment method", "payment_method", "method"]
SUBMITTER_COLS   = ["submitted by", "submitter", "submitter email", "submitted_by"]
NOTES_COLS       = ["notes", "note"]
APPROVAL_COLS    = ["approval notes", "approval_notes", "approver notes"]

VALID_STATUSES   = {"draft", "submitted", "approved", "rejected", "paid"}
CATEGORY_ALIASES = {
    "ministry": "ministry", "event": "ministry", "program": "ministry",
    "facilities": "facilities", "building": "facilities", "maintenance": "facilities",
    "staffing": "staffing", "staff": "staffing", "salary": "staffing",
    "missions": "missions", "mission": "missions", "outreach": "missions",
    "vbs": "vbs", "vacation bible school": "vbs",
    "worship": "worship", "music": "worship",
    "admin": "admin", "administration": "admin", "office": "admin",
    "other": "other",
}

def col(row: dict, aliases: list[str]) -> str:
    for a in aliases:
        for k in row:
            if k.strip().lower() == a:
                return row[k].strip()
    return ""

DATE_FORMATS = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]

def parse_date(raw: str) -> str | None:
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None

def parse_amount(raw: str) -> float | None:
    cleaned = re.sub(r"[^\d.]", "", raw.strip())
    try:
        return float(cleaned)
    except ValueError:
        return None

def normalize_category(raw: str) -> str:
    return CATEGORY_ALIASES.get(raw.strip().lower(), "other")

def normalize_status(raw: str) -> str:
    s = raw.strip().lower()
    return s if s in VALID_STATUSES else "paid"  # historical data defaults to paid

def main():
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: {CSV_PATH} not found.")
        sys.exit(1)

    sb = get_client()

    camps = sb.from_("campuses").select("id, name").execute().data
    campus_map = {c["name"].lower(): c["id"] for c in camps}

    funds = sb.from_("funds").select("id, name").execute().data
    fund_map = {f["name"].lower(): f["id"] for f in funds}

    users = sb.from_("user_profiles").select("id, email").execute().data
    user_map = {u["email"].lower(): u["id"] for u in users if u["email"]}

    # Use first admin as fallback submitter
    admin = next((u for u in users if u.get("role") == "admin"), None)
    fallback_submitter_id = admin["id"] if admin else None

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    print(f"Found {len(rows)} rows in CSV")
    inserted = skipped = errors = 0

    for i, row in enumerate(rows, 1):
        date_raw    = col(row, DATE_COLS)
        desc        = col(row, DESC_COLS)
        cat_raw     = col(row, CATEGORY_COLS)
        amount_raw  = col(row, AMOUNT_COLS)
        campus_raw  = col(row, CAMPUS_COLS)
        fund_raw    = col(row, FUND_COLS)
        status_raw  = col(row, STATUS_COLS)
        method_raw  = col(row, METHOD_COLS)
        sub_raw     = col(row, SUBMITTER_COLS)
        notes       = col(row, NOTES_COLS) or None
        appr_notes  = col(row, APPROVAL_COLS) or None

        if not desc:
            print(f"  Row {i}: skipping — no description")
            skipped += 1
            continue

        expense_date = parse_date(date_raw)
        if not expense_date:
            print(f"  Row {i}: skipping — invalid date {date_raw!r}")
            skipped += 1
            continue

        amount = parse_amount(amount_raw)
        if not amount or amount <= 0:
            print(f"  Row {i}: skipping — invalid amount {amount_raw!r}")
            skipped += 1
            continue

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

        submitter_id = user_map.get(sub_raw.lower()) if sub_raw else fallback_submitter_id
        if not submitter_id:
            print(f"  Row {i}: skipping — no submitter and no fallback admin")
            skipped += 1
            continue

        status = normalize_status(status_raw)

        record = {
            "description": desc,
            "category": normalize_category(cat_raw),
            "expense_date": expense_date,
            "amount": amount,
            "campus_id": campus_id,
            "fund_id": fund_id,
            "payment_method": normalize_payment_method(method_raw) if method_raw else None,
            "status": status,
            "submitter_id": submitter_id,
            "notes": notes,
            "approval_notes": appr_notes,
        }

        # For paid/approved historical records, set timestamps
        if status in ("approved", "paid"):
            record["approved_at"] = f"{expense_date}T00:00:00+00:00"
            record["approver_id"] = submitter_id  # best-guess for historical data
        if status == "paid":
            record["paid_at"] = f"{expense_date}T00:00:00+00:00"
            record["paid_by_id"] = submitter_id

        if DRY_RUN:
            print(f"  [DRY RUN] {expense_date}  {desc[:40]:40s}  NT${amount:>10,.0f}  {status}")
            inserted += 1
            continue

        try:
            sb.from_("expenses").insert(record).execute()
            inserted += 1
        except Exception as e:
            print(f"  Row {i} ERROR: {e}")
            errors += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")

if __name__ == "__main__":
    main()
