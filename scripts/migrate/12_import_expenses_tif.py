"""
Import expenses from Expenses.csv (TIF actual format).

Status mapping:
  payment_status=PAID                          → paid
  approval_status=APPROVED + READY_FOR_PAYMENT → approved
  NOT_REQUIRED + READY_FOR_PAYMENT             → paid (no approval needed)
  NOT_REQUIRED + NOT_APPLICABLE                → paid (historical)
"""
import csv, re, sys, os
from config import get_client, CSV_DIR

CSV_FILE = os.path.join(CSV_DIR, "TIF.2026 TIF System Master Budget Spreadsheet - Expenses.csv")
DRY_RUN = "--dry-run" in sys.argv

PAYMENT_MAP = {
    "cash": "cash", "card": "card",
    "bank transfer": "bank_transfer", "other": "other",
    "cheque": "check", "check": "check",
}

CATEGORY_MAP = {
    "administration":       "admin",
    "children ministry":    "ministry",
    "equipment":            "facilities",
    "events & outreach":    "ministry",
    "facilities":           "facilities",
    "hospitality":          "ministry",
    "media & technology":   "facilities",
    "member care":          "ministry",
    "missions":             "missions",
    "other":                "other",
    "salaries & benefits":  "staffing",
    "staff & honorarium":   "staffing",
    "training & education": "admin",
    "transportation":       "other",
    "worship ministry":     "worship",
    "youth ministry":       "ministry",
}

def parse_amount(raw: str) -> float | None:
    cleaned = re.sub(r"[^\d.]", "", raw.strip())
    try:
        v = float(cleaned)
        return v if v > 0 else None
    except ValueError:
        return None

def resolve_status(approval: str, payment: str) -> str:
    if payment == "PAID":
        return "paid"
    if approval == "APPROVED" and payment == "READY_FOR_PAYMENT":
        return "approved"
    # NOT_REQUIRED means no approval needed — treat as paid historically
    return "paid"

def main():
    sb = get_client()

    campus_map = {c["name"].lower(): c["id"]
                  for c in sb.from_("campuses").select("id, name").execute().data}
    fund_map   = {f["name"].lower(): f["id"]
                  for f in sb.from_("funds").select("id, name").execute().data}

    users = sb.from_("user_profiles").select("id, email").execute().data
    user_by_email = {u["email"].lower(): u["id"] for u in users if u["email"]}
    admin = next((u for u in users), None)
    fallback_id = admin["id"] if admin else None

    # Default fund: General
    general_fund_id = fund_map.get("general")

    with open(CSV_FILE, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    print(f"Found {len(rows)} expense rows")
    inserted = skipped = errors = 0

    for i, row in enumerate(rows, 1):
        expense_date   = row.get("expense_date", "").strip()
        campus_raw     = row.get("campus", "").strip()
        cat_raw        = row.get("expense_category", "").strip()
        vendor         = row.get("vendor", "").strip()
        amount_raw     = row.get("amount", "").strip()
        method_raw     = row.get("payment_method", "").strip().lower()
        req_name       = row.get("requester_name", "").strip()
        req_email      = row.get("requester_email", "").strip().lower()
        approval_status = row.get("approval_status", "").strip()
        payment_status  = row.get("payment_status", "").strip()
        appr_note      = row.get("approval_note", "").strip() or None
        note           = row.get("note", "").strip() or None
        paid_at        = row.get("paid_at_iso", "").strip() or None
        approved_at    = row.get("approval_decision_at_iso", "").strip() or None
        approver_email = row.get("approval_decision_by", "").strip().lower()

        if not expense_date:
            skipped += 1; continue

        amount = parse_amount(amount_raw)
        if not amount:
            print(f"  Row {i}: skip — bad amount {amount_raw!r}")
            skipped += 1; continue

        campus_id = campus_map.get(campus_raw.lower())
        if not campus_id:
            print(f"  Row {i}: skip — campus '{campus_raw}' not found")
            skipped += 1; continue

        # Expenses don't have a fund in the CSV — default to General
        fund_id = general_fund_id

        # Use vendor as description if nothing else
        description = vendor or cat_raw or "Expense"

        submitter_id = user_by_email.get(req_email) or fallback_id
        if not submitter_id:
            print(f"  Row {i}: skip — no submitter")
            skipped += 1; continue

        approver_id = user_by_email.get(approver_email) if approver_email else submitter_id

        status = resolve_status(approval_status, payment_status)
        category = CATEGORY_MAP.get(cat_raw.lower(), "other")

        record = {
            "description": description,
            "category": category,
            "expense_date": expense_date,
            "amount": amount,
            "campus_id": campus_id,
            "fund_id": fund_id,
            "payment_method": PAYMENT_MAP.get(method_raw, "other"),
            "status": status,
            "submitter_id": submitter_id,
            "notes": note,
            "approval_notes": appr_note,
        }

        if status in ("approved", "paid"):
            record["approver_id"] = approver_id
            record["approved_at"] = approved_at or f"{expense_date}T00:00:00+00:00"
        if status == "paid":
            record["paid_at"] = paid_at or f"{expense_date}T00:00:00+00:00"
            record["paid_by_id"] = approver_id or submitter_id

        if DRY_RUN:
            print(f"  [DRY] {expense_date}  {description[:35]:35s}  NT${amount:>10,.0f}  {status:8s}  {campus_raw}")
            inserted += 1; continue

        try:
            sb.from_("expenses").insert(record).execute()
            inserted += 1
        except Exception as e:
            print(f"  Row {i} ERROR: {e}")
            errors += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")

if __name__ == "__main__":
    main()
