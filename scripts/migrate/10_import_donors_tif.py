"""
Import donors from Donor_Local_Cache.csv (TIF actual format).

Columns used: donor_name, donor_email, donor_phone, campuses_csv, pco_person_id
"""
import csv, sys, os
from config import get_client, CSV_DIR

CSV_FILE = os.path.join(CSV_DIR, "TIF.2026 TIF System Master Budget Spreadsheet - Donor_Local_Cache.csv")
DRY_RUN = "--dry-run" in sys.argv

def main():
    sb = get_client()

    camps = sb.from_("campuses").select("id, name").execute().data
    campus_map = {c["name"].lower(): c["id"] for c in camps}

    existing = sb.from_("donors").select("email, display_name").execute().data
    existing_emails = {d["email"].lower() for d in existing if d["email"]}
    existing_names  = {d["display_name"].lower() for d in existing}

    with open(CSV_FILE, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    print(f"Found {len(rows)} rows")
    inserted = skipped = errors = 0

    for i, row in enumerate(rows, 1):
        name  = row.get("donor_name", "").strip()
        email = row.get("donor_email", "").strip() or None
        phone = row.get("donor_phone", "").strip() or None
        pco   = row.get("pco_person_id", "").strip() or None
        # campuses_csv may list multiple; use the first
        campus_raw = row.get("campuses_csv", "").split(",")[0].strip()

        if not name:
            skipped += 1
            continue

        # Skip raw bank-transfer strings (contain [BR] tags)
        if "[BR]" in name:
            print(f"  Row {i}: skip '{name[:50]}…' — raw bank data")
            skipped += 1
            continue

        # Skip pure numbers (bank reference IDs)
        if name.replace(" ", "").isdigit():
            print(f"  Row {i}: skip '{name}' — looks like a reference number")
            skipped += 1
            continue

        # Skip obvious internal/system entries
        SYSTEM_ENTRIES = {"1月信用卡餘額補存", "中華民國諾亞職場關懷0061"}
        if name in SYSTEM_ENTRIES:
            print(f"  Row {i}: skip '{name}' — system entry")
            skipped += 1
            continue

        # Dedup
        if email and email.lower() in existing_emails:
            print(f"  Row {i}: skip '{name}' — email exists")
            skipped += 1
            continue
        if name.lower() in existing_names:
            print(f"  Row {i}: skip '{name}' — name exists")
            skipped += 1
            continue

        campus_id = campus_map.get(campus_raw.lower())
        if campus_raw and not campus_id:
            print(f"  Row {i}: ⚠ campus '{campus_raw}' not found, leaving blank")

        record = {
            "display_name": name,
            "email": email,
            "phone": phone,
            "preferred_campus_id": campus_id,
            "pco_contact_id": pco,
            "donor_type": "individual",
        }

        if DRY_RUN:
            print(f"  [DRY] {name!r:35s}  {email or '':35s}  {campus_raw}")
            inserted += 1
            continue

        try:
            sb.from_("donors").insert(record).execute()
            inserted += 1
            if email: existing_emails.add(email.lower())
            existing_names.add(name.lower())
        except Exception as e:
            print(f"  Row {i} ERROR ({name!r}): {e}")
            errors += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")

if __name__ == "__main__":
    main()
