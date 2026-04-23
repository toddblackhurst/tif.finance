-- TIF Finance System — Initial Schema
-- Fiscal year: January–December (calendar year)
-- Currency: TWD (no decimal cents, stored as NUMERIC(12,0))

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- LOOKUP TABLES
-- ─────────────────────────────────────────────

CREATE TABLE campuses (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL UNIQUE,
  name_zh    VARCHAR(100),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO campuses (name, name_zh) VALUES
  ('TIF North',         'TIF 北區'),
  ('TIF South',         'TIF 南區'),
  ('Hope Fellowship',   '盼望教會'),
  ('All Praise',        '全讚教會'),
  ('TIF System',        'TIF 系統');

CREATE TABLE funds (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(100) NOT NULL UNIQUE,
  name_zh          VARCHAR(100),
  description      TEXT,
  is_restricted    BOOLEAN NOT NULL DEFAULT false,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  accounting_code  VARCHAR(50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO funds (name, is_restricted) VALUES
  ('General',      false),
  ('VBS',          true),
  ('Missions',     true),
  ('Building',     true);

-- ─────────────────────────────────────────────
-- USERS (mirrors Supabase auth.users)
-- ─────────────────────────────────────────────

CREATE TABLE user_profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           VARCHAR(200),
  email               VARCHAR(255),
  phone               VARCHAR(50),
  role                VARCHAR(50) NOT NULL DEFAULT 'viewer'
                        CHECK (role IN ('admin', 'campus-finance', 'viewer')),
  assigned_campus_id  UUID REFERENCES campuses(id),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- DONORS
-- ─────────────────────────────────────────────

CREATE TABLE donors (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pco_contact_id       VARCHAR(100) UNIQUE,
  display_name         VARCHAR(200) NOT NULL,
  first_name           VARCHAR(100),
  last_name            VARCHAR(100),
  email                VARCHAR(255),
  phone                VARCHAR(50),
  donor_type           VARCHAR(50) NOT NULL DEFAULT 'individual'
                         CHECK (donor_type IN ('individual', 'household', 'business', 'anonymous')),
  preferred_campus_id  UUID REFERENCES campuses(id),
  notes                TEXT,
  merged_into_id       UUID REFERENCES donors(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ
);

CREATE INDEX idx_donors_display_name ON donors (display_name);
CREATE INDEX idx_donors_email ON donors (email);
CREATE INDEX idx_donors_pco ON donors (pco_contact_id);

-- ─────────────────────────────────────────────
-- DONATIONS
-- ─────────────────────────────────────────────

CREATE TABLE donations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donor_id            UUID REFERENCES donors(id),
  gift_date           DATE NOT NULL,
  amount              NUMERIC(12, 0) NOT NULL CHECK (amount >= 0),
  campus_id           UUID NOT NULL REFERENCES campuses(id),
  fund_id             UUID NOT NULL REFERENCES funds(id),
  payment_method      VARCHAR(50) NOT NULL
                        CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'check', 'other')),
  deposit_reference   VARCHAR(200),
  pco_gift_id         VARCHAR(100),
  receipt_url         TEXT,
  notes               TEXT,
  thank_you_sent_at   TIMESTAMPTZ,
  entered_by_id       UUID REFERENCES user_profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_donations_gift_date ON donations (gift_date DESC);
CREATE INDEX idx_donations_campus ON donations (campus_id);
CREATE INDEX idx_donations_fund ON donations (fund_id);
CREATE INDEX idx_donations_donor ON donations (donor_id);

-- ─────────────────────────────────────────────
-- EXPENSES
-- ─────────────────────────────────────────────

CREATE TABLE expenses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_id        UUID NOT NULL REFERENCES user_profiles(id),
  description         TEXT NOT NULL,
  category            VARCHAR(100) NOT NULL,
  expense_date        DATE NOT NULL,
  amount              NUMERIC(12, 0) NOT NULL CHECK (amount >= 0),
  campus_id           UUID NOT NULL REFERENCES campuses(id),
  fund_id             UUID NOT NULL REFERENCES funds(id),
  payment_method      VARCHAR(50)
                        CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'card', 'other')),
  status              VARCHAR(50) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
  approver_id         UUID REFERENCES user_profiles(id),
  approved_at         TIMESTAMPTZ,
  approval_notes      TEXT,
  paid_at             TIMESTAMPTZ,
  paid_by_id          UUID REFERENCES user_profiles(id),
  check_number        VARCHAR(50),
  reconciliation_ref  VARCHAR(200),
  receipt_url         TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_expenses_campus ON expenses (campus_id);
CREATE INDEX idx_expenses_status ON expenses (status);
CREATE INDEX idx_expenses_submitter ON expenses (submitter_id);

-- ─────────────────────────────────────────────
-- BUDGETS
-- ─────────────────────────────────────────────

CREATE TABLE budgets (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campus_id        UUID NOT NULL REFERENCES campuses(id),
  fund_id          UUID NOT NULL REFERENCES funds(id),
  fiscal_year      INT NOT NULL,
  fiscal_month     INT NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  budgeted_amount  NUMERIC(12, 0) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campus_id, fund_id, fiscal_year, fiscal_month)
);

-- ─────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────

CREATE TABLE audit_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type      VARCHAR(50) NOT NULL,
  entity_id        UUID NOT NULL,
  action           VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  actor_id         UUID REFERENCES user_profiles(id),
  before_snapshot  JSONB,
  after_snapshot   JSONB,
  change_summary   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC);

-- ─────────────────────────────────────────────
-- BANK IMPORT LINES (CSV reconciliation staging)
-- ─────────────────────────────────────────────

CREATE TABLE bank_import_lines (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_batch_id      UUID NOT NULL,
  imported_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by_id       UUID REFERENCES user_profiles(id),
  transaction_date     DATE NOT NULL,
  amount               NUMERIC(12, 0) NOT NULL,
  description          TEXT,
  account_identifier   VARCHAR(100),
  matched_donation_id  UUID REFERENCES donations(id),
  match_status         VARCHAR(50) NOT NULL DEFAULT 'unmatched'
                         CHECK (match_status IN ('unmatched', 'matched', 'ignored')),
  raw_data             JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_import_batch ON bank_import_lines (import_batch_id);
CREATE INDEX idx_bank_import_status ON bank_import_lines (match_status);

-- ─────────────────────────────────────────────
-- VIEWS
-- ─────────────────────────────────────────────

-- Replaces the Donor Directory sheet
CREATE VIEW donor_statistics AS
SELECT
  d.id,
  d.display_name,
  d.email,
  d.phone,
  d.preferred_campus_id,
  c.name AS preferred_campus,
  COUNT(don.id)                                                              AS gift_count,
  COALESCE(SUM(CASE WHEN EXTRACT(YEAR FROM don.gift_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                    THEN don.amount END), 0)                                AS ytd_amount,
  COALESCE(SUM(don.amount), 0)                                              AS lifetime_amount,
  MAX(don.gift_date)                                                         AS last_gift_date,
  ROUND(AVG(don.amount))                                                    AS avg_gift_amount
FROM donors d
LEFT JOIN campuses c ON c.id = d.preferred_campus_id
LEFT JOIN donations don ON don.donor_id = d.id AND don.deleted_at IS NULL
WHERE d.deleted_at IS NULL AND d.merged_into_id IS NULL
GROUP BY d.id, c.name;

-- Replaces the 11 dashboard rollup sheets
CREATE VIEW monthly_campus_rollup AS
SELECT
  c.name                                 AS campus,
  f.name                                 AS fund,
  EXTRACT(YEAR FROM don.gift_date)::INT  AS year,
  EXTRACT(MONTH FROM don.gift_date)::INT AS month,
  SUM(don.amount)                        AS total_donations,
  COUNT(don.id)                          AS donation_count
FROM donations don
JOIN campuses c ON c.id = don.campus_id
JOIN funds f ON f.id = don.fund_id
WHERE don.deleted_at IS NULL
GROUP BY c.name, f.name, year, month;

-- Budget vs actual
CREATE VIEW budget_variance AS
SELECT
  c.name          AS campus,
  f.name          AS fund,
  b.fiscal_year,
  b.fiscal_month,
  b.budgeted_amount,
  COALESCE(SUM(don.amount), 0)                        AS actual_donations,
  COALESCE(SUM(don.amount), 0) - b.budgeted_amount    AS variance
FROM budgets b
JOIN campuses c ON c.id = b.campus_id
JOIN funds f ON f.id = b.fund_id
LEFT JOIN donations don
  ON  don.campus_id = b.campus_id
  AND don.fund_id   = b.fund_id
  AND EXTRACT(YEAR  FROM don.gift_date) = b.fiscal_year
  AND EXTRACT(MONTH FROM don.gift_date) = b.fiscal_month
  AND don.deleted_at IS NULL
GROUP BY c.name, f.name, b.fiscal_year, b.fiscal_month, b.budgeted_amount;

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

ALTER TABLE campuses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE donors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_import_lines ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER so they run as owner, not caller)
CREATE OR REPLACE FUNCTION current_user_role()
  RETURNS VARCHAR LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION current_user_campus_id()
  RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT assigned_campus_id FROM user_profiles WHERE id = auth.uid()
$$;

-- Campuses & funds: any authenticated user can read; only admin writes
CREATE POLICY "campuses_read"  ON campuses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "campuses_write" ON campuses FOR ALL    USING (current_user_role() = 'admin');
CREATE POLICY "funds_read"     ON funds    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "funds_write"    ON funds    FOR ALL    USING (current_user_role() = 'admin');

-- User profiles
CREATE POLICY "profiles_read"  ON user_profiles FOR SELECT
  USING (id = auth.uid() OR current_user_role() = 'admin');
CREATE POLICY "profiles_update_own" ON user_profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "profiles_admin" ON user_profiles FOR ALL
  USING (current_user_role() = 'admin');

-- Donors: all authenticated users read; campus-finance and admin write
CREATE POLICY "donors_read"   ON donors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "donors_insert" ON donors FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'campus-finance'));
CREATE POLICY "donors_update" ON donors FOR UPDATE
  USING (current_user_role() IN ('admin', 'campus-finance'));
CREATE POLICY "donors_delete" ON donors FOR DELETE
  USING (current_user_role() = 'admin');

-- Donations: campus-finance sees their campus only; admin sees all
CREATE POLICY "donations_select" ON donations FOR SELECT
  USING (current_user_role() = 'admin' OR campus_id = current_user_campus_id());
CREATE POLICY "donations_insert" ON donations FOR INSERT
  WITH CHECK (current_user_role() = 'admin' OR campus_id = current_user_campus_id());
CREATE POLICY "donations_update" ON donations FOR UPDATE
  USING (current_user_role() = 'admin' OR campus_id = current_user_campus_id());
CREATE POLICY "donations_delete" ON donations FOR DELETE
  USING (current_user_role() = 'admin');

-- Expenses: campus-finance sees their campus only; admin sees all
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (current_user_role() = 'admin' OR campus_id = current_user_campus_id());
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (current_user_role() = 'admin' OR campus_id = current_user_campus_id());
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  USING (current_user_role() = 'admin' OR campus_id = current_user_campus_id());
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  USING (current_user_role() = 'admin');

-- Budgets: all authenticated read; admin writes
CREATE POLICY "budgets_read"  ON budgets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "budgets_write" ON budgets FOR ALL    USING (current_user_role() = 'admin');

-- Audit log: admin reads; service role inserts (via server-side code)
CREATE POLICY "audit_log_read"   ON audit_log FOR SELECT USING (current_user_role() = 'admin');
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (true);

-- Bank imports: admin only
CREATE POLICY "bank_imports_all" ON bank_import_lines FOR ALL
  USING (current_user_role() = 'admin');

-- ─────────────────────────────────────────────
-- TRIGGER: auto-update updated_at
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_funds_updated_at
  BEFORE UPDATE ON funds FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_donors_updated_at
  BEFORE UPDATE ON donors FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_donations_updated_at
  BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
