"""
Step 5 — Verification: compare row counts and totals against your Sheets.

Run after all imports to confirm data integrity.

  python 05_verify.py
"""

from config import get_client

def main():
    sb = get_client()

    print("=" * 55)
    print("TIF Finance — Migration Verification Report")
    print("=" * 55)

    # Donors
    r = sb.from_("donors").select("id", count="exact").is_("deleted_at", None).is_("merged_into_id", None).execute()
    print(f"\n  Donors:       {r.count:>6} records")

    # Donations
    r = sb.from_("donations").select("amount").is_("deleted_at", None).execute()
    total = sum(row["amount"] for row in r.data)
    print(f"  Donations:    {len(r.data):>6} records   Total: NT${total:>14,.0f}")

    # Expenses by status
    for status in ["draft", "submitted", "approved", "rejected", "paid"]:
        r = sb.from_("expenses").select("amount").eq("status", status).is_("deleted_at", None).execute()
        if r.data:
            t = sum(row["amount"] for row in r.data)
            print(f"  Expenses ({status:10s}): {len(r.data):>5} records   NT${t:>14,.0f}")

    # Budgets
    r = sb.from_("budgets").select("budgeted_amount", count="exact").execute()
    total = sum(row["budgeted_amount"] for row in r.data)
    print(f"  Budgets:      {r.count:>6} records   Total: NT${total:>14,.0f}")

    # YTD from view
    import datetime
    year = datetime.date.today().year
    r = sb.from_("donations").select("amount").gte("gift_date", f"{year}-01-01").is_("deleted_at", None).execute()
    ytd = sum(row["amount"] for row in r.data)
    print(f"\n  YTD {year} Donations: NT${ytd:,.0f}")

    print("\n" + "=" * 55)
    print("Compare these numbers against your Google Sheets totals.")
    print("A row-count match + total match means the import is clean.")
    print("=" * 55 + "\n")

if __name__ == "__main__":
    main()
