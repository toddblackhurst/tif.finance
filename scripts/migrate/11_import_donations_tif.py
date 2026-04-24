"""
Import donations from Receipts.csv (TIF actual format).

Columns used: gift_date, donor_name, donor_email, donor_type, amount,
              campus, fund, payment_method, deposit_reference, note
"""
import csv, re, sys, os
from config import get_client, CSV_DIR

CSV_FILE = os.path.join(CSV_DIR, "TIF.2026 TIF System Master Budget Spreadsheet - Receipts.csv")
DRY_RUN = "--dry-run" in sys.argv

PAYMENT_MAP = {
    "cash": "cash",
    "card": "card",
    "bank transfer": "bank_transfer",
    "check": "check",
    "cheque": "check",
    "other": "other",
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

    # Donor lookup by email first, then name
    donors = sb.from_("donors").select("id, display_name, email").execute().data
    donor_by_email = {d["email"].lower(): d["id"] for d in donors if d["email"]}
    donor_by_name  = {d["display_name"].lower(): d["id"] for d in donors}

    with open(CSV_FILE, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    # Skip non-gift rows (system entries etc.)
    rows = [r for r in rows if r.get("record_type", "").strip() != ""]
    print(f"Found {len(rows)} donation rows")

    inserted = skipped = errors = 0
    unmatched_campuses: set[str] = set()
    unmatched_funds: set[str] = set()

    for i, row in enumerate(rows, 1):
        gift_date   = row.get("gift_date", "").strip()
        donor_name  = row.get("donor_name", "").strip()
        donor_email = row.get("donor_email", "").strip().lower()
        donor_type  = row.get("donor_type", "Named").strip()
        amount_raw  = row.get("amount", "").strip()
        campus_raw  = row.get("campus", "").strip()
        fund_raw    = row.get("fund", "").strip()
        method_raw  = row.get("payment_method", "").strip().lower()
        dep_ref     = row.get("deposit_reference", "").strip() or None
        note        = row.get("note", "").strip() or None

        if not gift_date:
            skipped += 1; continue

        amount = parse_amount(amount_raw)
        if not amount:
            print(f"  Row {i}: skip — bad amount {amount_raw!r}")
            skipped += 1; continue

        campus_id = campus_map.get(campus_raw.lower())
        if not campus_id:
            unmatched_campuses.add(campus_raw)
            skipped += 1; continue

        fund_id = fund_map.get(fund_raw.lower())
        if not fund_id:
            unmatched_funds.add(fund_raw)
            skipped += 1; continue

        # Resolve donor_id — skip for Anonymous
        donor_id = None
        if donor_type != "Anonymous":
            donor_id = donor_by_email.get(donor_email) or donor_by_name.get(donor_name.lower())
            if not donor_id:
                print(f"  Row {i}: ⚠ donor '{donor_name}' not found — recording anonymous")

        payment_method = PAYMENT_MAP.get(method_raw, "other")

        record = {
            "gift_date": gift_date,
            "amount": amount,
            "donor_id": donor_id,
            "campus_id": campus_id,
            "fund_id": fund_id,
            "payment_method": payment_method,
            "deposit_reference": dep_ref,
            "notes": note,
        }

        if DRY_RUN:
            print(f"  [DRY] {gift_date}  {donor_name or 'anon':30s}  NT${amount:>10,.0f}  {campus_raw}/{fund_raw}")
            inserted += 1; continue

        try:
            sb.from_("donations").insert(record).execute()
            inserted += 1
        except Exception as e:
            print(f"  Row {i} ERROR: {e}")
            errors += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")
    if unmatched_campuses:
        print(f"⚠ Skipped (campus not found): {sorted(unmatched_campuses)}")
    if unmatched_funds:
        print(f"⚠ Skipped (fund not found): {sorted(unmatched_funds)}")

if __name__ == "__main__":
    main()
