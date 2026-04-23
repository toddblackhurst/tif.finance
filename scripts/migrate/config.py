"""
Shared config for TIF Finance ETL migration scripts.

Usage:
  1. Export each relevant Google Sheet tab as CSV into scripts/migrate/csv/
  2. pip install supabase python-dotenv
  3. Run each script in order: 01, 02, 03, 04
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env.local"))

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def get_client() -> Client:
    """Return a Supabase client using the service role key (bypasses RLS)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Campus name → ID mapping ──────────────────────────────────────────────────
# Populated by 00_fetch_lookups.py; edit if your campuses differ.
CAMPUS_NAME_MAP: dict[str, str] = {}   # filled at runtime
FUND_NAME_MAP: dict[str, str] = {}     # filled at runtime

# ── Payment method normalisation ─────────────────────────────────────────────
PAYMENT_METHOD_ALIASES = {
    "cash": "cash",
    "現金": "cash",
    "card": "card",
    "credit card": "card",
    "刷卡": "card",
    "bank transfer": "bank_transfer",
    "wire": "bank_transfer",
    "transfer": "bank_transfer",
    "銀行轉帳": "bank_transfer",
    "check": "check",
    "cheque": "check",
    "支票": "check",
    "other": "other",
    "其他": "other",
}

def normalize_payment_method(raw: str) -> str:
    key = raw.strip().lower()
    return PAYMENT_METHOD_ALIASES.get(key, "other")

# ── CSV folder ────────────────────────────────────────────────────────────────
CSV_DIR = os.path.join(os.path.dirname(__file__), "csv")
