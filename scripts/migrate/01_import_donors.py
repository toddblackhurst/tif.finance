"""
Step 1 — Import donors from a Google Sheets CSV export.

Expected CSV columns (case-insensitive, extra columns ignored):
  Name / display_name     — full name (required)
  Email                   — email address
  Phone                   — phone number
  Campus / preferred_campus — campus name (matched to DB)
  Notes                   — free-text notes
  PCO ID / pco_contact_id — Planning Center contact ID

Export the "Donor Directory" sheet as CSV and place it at:
  scripts/migrate/csv/donors.csv

  python 01_import_donors.py [--dry-run]
"""

import csv
import sys
import os
import re
from datetime import datetime, timezone
from config import get_client, CSV_DIR

CSV_PATH = os.path.join(CSV_DIR, "donors.csv")
DRY_RUN = "--dry-run" in sys.argv

# ── Column name aliases ───────────────────────────────────────────────────────
NAME_COLS      = ["name", "display_name", "full name", "donor name"]
EMAIL_COLS     = ["email", "email address"]
PHONE_COLS     = ["phone", "phone number", "mobile"]
CAMPUS_COLS    = ["campus", "preferred_campus", "preferred campus"]
NOTES_COLS     = ["notes", "note"]
PCO_COLS       = ["pco id", "pco_contact_id", "planning center id"]

def col(row: dict, aliases: list[str]) -> str:
    for a in aliases:
        for k in row:
            if k.strip().lower() == a:
                return row[k].strip()
    return ""

def main():
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: {CSV_PATH} not found.")
        print("Export the Donor Directory sheet as CSV and save it there.")
        sys.exit(1)

    sb = get_client()

    # Fetch campus lookup
    camps = sb.from_("campuses").select("id, name").execute().data
    campus_map = {c["name"].lower(): c["id"] for c in camps}

    # Fetch existing donors (by display_name) to avoid duplicates
    existing = sb.from_("donors").select("id, display_name, email").execute().data
    existing_names = {d["display_name"].lower() for d in existing}
    existing_emails = {d["email"].lower() for d in existing if d["email"]}

    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Found {len(rows)} rows in CSV")
    inserted = skipped = errors = 0

    for i, row in enumerate(rows, 1):
        name = col(row, NAME_COLS)
        if not name:
            print(f"  Row {i}: skipping — no name")
            skipped += 1
            continue

        email = col(row, EMAIL_COLS) or None
        phone = col(row, PHONE_COLS) or None
        campus_raw = col(row, CAMPUS_COLS)
        notes = col(row, NOTES_COLS) or None
        pco_id = col(row, PCO_COLS) or None

        # Dedup by name (case-insensitive)
        if name.lower() in existing_names:
            print(f"  Row {i}: skipping '{name}' — already exists")
            skipped += 1
            continue

        # Dedup by email
        if email and email.lower() in existing_emails:
            print(f"  Row {i}: skipping '{name}' — email {email} already exists")
            skipped += 1
            continue

        campus_id = campus_map.get(campus_raw.lower()) if campus_raw else None

        record = {
            "display_name": name,
            "email": email,
            "phone": phone,
            "preferred_campus_id": campus_id,
            "notes": notes,
            "pco_contact_id": pco_id,
            "donor_type": "individual",
        }

        if DRY_RUN:
            print(f"  [DRY RUN] Would insert: {name!r} ({email})")
            inserted += 1
            existing_names.add(name.lower())
            continue

        try:
            result = sb.from_("donors").insert(record).execute()
            inserted += 1
            existing_names.add(name.lower())
            if email:
                existing_emails.add(email.lower())
        except Exception as e:
            print(f"  Row {i} ERROR ({name!r}): {e}")
            errors += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped, {errors} errors")

if __name__ == "__main__":
    main()
