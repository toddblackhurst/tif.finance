"""
One-way PCO → Supabase donor sync.

Pulls all people from Planning Center Online People API and:
  - Updates existing donors matched by pco_contact_id
  - Upserts donors matched by email (links their PCO ID)
  - Inserts new donors not yet in the system

Run:
    python3 20_sync_pco_donors.py            # live sync
    python3 20_sync_pco_donors.py --dry-run  # preview only

Requires .env.local:
    PCO_CLIENT_ID=...
    PCO_CLIENT_SECRET=...
"""
import sys, os, time
from config import get_client  # also loads .env.local via dotenv

PCO_CLIENT_ID     = os.environ.get("PCO_CLIENT_ID", "")
PCO_CLIENT_SECRET = os.environ.get("PCO_CLIENT_SECRET", "")
DRY_RUN           = "--dry-run" in sys.argv

PCO_BASE = "https://api.planningcenteronline.com/people/v2"

def pco_get(path: str, params: dict | None = None) -> dict:
    """Make an authenticated GET request to the PCO API."""
    import urllib.request, urllib.parse, urllib.error, base64, json, ssl, certifi

    url = f"{PCO_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)

    credentials = base64.b64encode(
        f"{PCO_CLIENT_ID}:{PCO_CLIENT_SECRET}".encode()
    ).decode()

    req = urllib.request.Request(url, headers={
        "Authorization": f"Basic {credentials}",
        "Accept": "application/json",
    })

    ctx = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(req, context=ctx) as resp:
        return json.loads(resp.read())

def fetch_all_people() -> list[dict]:
    """Paginate through all PCO people, returning normalized dicts."""
    people = []
    offset = 0
    per_page = 100

    while True:
        data = pco_get("/people", {
            "per_page": per_page,
            "offset": offset,
            "include": "emails,phone_numbers",
            "fields[Person]": "first_name,last_name,nickname,go_by_name,status",
        })

        # Build a quick email lookup from included resources
        included = data.get("included", [])
        emails_by_person: dict[str, list[str]] = {}
        phones_by_person: dict[str, list[str]] = {}

        for inc in included:
            if inc["type"] == "Email":
                pid = inc["relationships"]["person"]["data"]["id"]
                addr = inc["attributes"].get("address", "")
                if addr:
                    emails_by_person.setdefault(pid, []).append(addr)
            elif inc["type"] == "PhoneNumber":
                pid = inc["relationships"]["person"]["data"]["id"]
                num = inc["attributes"].get("number", "")
                if num:
                    phones_by_person.setdefault(pid, []).append(num)

        for person in data.get("data", []):
            pid  = person["id"]
            attr = person["attributes"]
            first = attr.get("first_name") or ""
            last  = attr.get("last_name")  or ""
            go_by = attr.get("go_by_name") or attr.get("nickname") or ""
            name  = f"{first} {last}".strip() or go_by or f"PCO:{pid}"
            email_list = emails_by_person.get(pid, [])
            phone_list = phones_by_person.get(pid, [])
            people.append({
                "pco_id":    pid,
                "name":      name,
                "email":     email_list[0].lower() if email_list else None,
                "phone":     phone_list[0] if phone_list else None,
                "status":    attr.get("status", ""),
            })

        total   = data.get("meta", {}).get("total_count", 0)
        offset += per_page
        print(f"  Fetched {min(offset, total)}/{total} people…")
        if offset >= total:
            break
        time.sleep(0.2)  # be polite to PCO rate limits

    return people

def main():
    if not PCO_CLIENT_ID or not PCO_CLIENT_SECRET:
        print("ERROR: PCO_CLIENT_ID or PCO_CLIENT_SECRET not set in .env.local")
        sys.exit(1)

    print("Fetching people from PCO…")
    try:
        people = fetch_all_people()
    except Exception as e:
        print(f"PCO API error: {e}")
        sys.exit(1)

    print(f"Got {len(people)} people from PCO\n")

    sb = get_client()

    # Load existing donors
    existing = sb.from_("donors").select("id, display_name, email, pco_contact_id").execute().data
    by_pco   = {d["pco_contact_id"]: d for d in existing if d["pco_contact_id"]}
    by_email = {d["email"].lower(): d for d in existing if d["email"]}

    inserted = updated = skipped = errors = 0

    for person in people:
        pco_id = person["pco_id"]
        name   = person["name"]
        email  = person["email"]
        phone  = person["phone"]

        # Skip inactive/archived unless they have an existing record
        if person["status"] in ("inactive", "archived"):
            existing_record = by_pco.get(pco_id) or (email and by_email.get(email))
            if not existing_record:
                skipped += 1
                continue

        # --- Match to existing donor ---
        match = by_pco.get(pco_id)
        if not match and email:
            match = by_email.get(email)

        if match:
            # Update: fill in PCO ID if missing, update name/email/phone if blank
            updates: dict = {}
            if not match["pco_contact_id"]:
                updates["pco_contact_id"] = pco_id
            if email and not match["email"]:
                updates["email"] = email
            if not updates and name == match["display_name"]:
                skipped += 1
                continue  # nothing to update

            if DRY_RUN:
                print(f"  [DRY] UPDATE  {match['display_name']!r} → pco_id={pco_id}")
                updated += 1
                continue
            try:
                sb.from_("donors").update(updates).eq("id", match["id"]).execute()
                # Keep local caches fresh
                by_pco[pco_id] = {**match, **updates}
                updated += 1
            except Exception as e:
                print(f"  ERROR updating {name!r}: {e}")
                errors += 1
        else:
            # Insert new donor
            record = {
                "display_name":   name,
                "email":          email,
                "phone":          phone,
                "pco_contact_id": pco_id,
                "donor_type":     "individual",
            }
            if DRY_RUN:
                print(f"  [DRY] INSERT  {name!r}  {email or '':30s}  pco:{pco_id}")
                inserted += 1
                continue
            try:
                result = sb.from_("donors").insert(record).execute()
                if email:
                    by_email[email] = {"id": result.data[0]["id"], **record}
                by_pco[pco_id] = {"id": result.data[0]["id"], **record}
                inserted += 1
            except Exception as e:
                print(f"  ERROR inserting {name!r}: {e}")
                errors += 1

    print(f"\nDone: {inserted} inserted, {updated} updated, {skipped} skipped, {errors} errors")

if __name__ == "__main__":
    main()
