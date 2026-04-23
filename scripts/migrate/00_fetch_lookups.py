"""
Step 0 — Fetch campuses and funds from Supabase and print their IDs.

Run this first to verify the database connection and get the ID mappings
you'll need to paste into config.py if automatic name matching fails.

  python 00_fetch_lookups.py
"""

import json
from config import get_client

def main():
    sb = get_client()

    print("\n=== CAMPUSES ===")
    camps = sb.from_("campuses").select("id, name").execute().data
    for c in camps:
        print(f"  {c['name']!r:35s} → {c['id']}")

    print("\n=== FUNDS ===")
    funds = sb.from_("funds").select("id, name").order("name").execute().data
    for f in funds:
        print(f"  {f['name']!r:35s} → {f['id']}")

    print("\nCopy/paste these into CAMPUS_NAME_MAP and FUND_NAME_MAP in config.py")
    print("if the automatic name-matching in subsequent scripts doesn't work.\n")

    # Emit as JSON so you can redirect to a file
    print(json.dumps({
        "campuses": {c["name"]: c["id"] for c in camps},
        "funds": {f["name"]: f["id"] for f in funds},
    }, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
