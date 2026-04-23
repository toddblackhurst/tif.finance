# TIF Finance — Data Migration Scripts

These Python scripts migrate historical data from Google Sheets into Supabase.

## Prerequisites

```bash
pip install supabase python-dotenv
```

The `.env.local` file in the project root must contain the Supabase credentials
(it's already there from the main app setup).

## Workflow

### 1. Export your Google Sheets tabs as CSV

Export each of these tabs from your spreadsheet as `.csv` and place them in this folder:

| Sheet tab | Save as |
|-----------|---------|
| Donor Directory | `csv/donors.csv` |
| Transaction Records (or Donations) | `csv/donations.csv` |
| Expense Requests | `csv/expenses.csv` |
| Budget | `csv/budgets.csv` |

**To export:** In Google Sheets → File → Download → Comma-separated values (.csv)

### 2. Run the scripts in order

```bash
cd scripts/migrate

# Step 0: Verify DB connection + print campus/fund IDs
python 00_fetch_lookups.py

# Step 1: Dry-run donors first
python 01_import_donors.py --dry-run

# If dry-run looks good, run for real
python 01_import_donors.py

# Step 2: Dry-run donations
python 02_import_donations.py --dry-run
python 02_import_donations.py

# Step 3: Dry-run expenses
python 03_import_expenses.py --dry-run
python 03_import_expenses.py

# Step 4: Budgets — use --wide if your sheet has Jan..Dec as columns
python 04_import_budgets.py --dry-run
python 04_import_budgets.py
# OR for wide format (one row per fund, columns = Jan Feb ... Dec):
python 04_import_budgets.py --wide

# Step 5: Verify totals match your Sheets
python 05_verify.py
```

## Column Matching

The scripts are flexible — they match common column name variations automatically.
See the `*_COLS` lists at the top of each script for the full alias list.

If your column names don't match, either:
- Rename the columns in your CSV export, or
- Add your column name to the relevant alias list in the script

## Campus / Fund Names Must Match

Campus and fund names in your CSVs must match what's in the database.
Run `python 00_fetch_lookups.py` to see the exact names.

Common issues:
- "TIF North" vs "TIF North Campus" — must match exactly
- Extra spaces or trailing whitespace
- Traditional Chinese vs English names

## Wide Budget Format

If your budget sheet looks like this:

| Campus | Fund | Year | Jan | Feb | Mar | ... |
|--------|------|------|-----|-----|-----|-----|
| TIF North | General | 2024 | 50000 | 50000 | ... |

Use `python 04_import_budgets.py --wide`

## After Migration

1. Run `python 05_verify.py` and compare totals to your Sheets
2. Do a spot-check of 20 random records in Supabase Studio
3. Log into the app and verify the dashboard numbers look right
