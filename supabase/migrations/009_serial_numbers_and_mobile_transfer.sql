-- Add receipt-style serial numbers for donations and expenses, and support
-- expenses that were already paid by mobile transfer from the TIF account.

ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_payment_type_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_payment_type_check
    CHECK (payment_type IN ('reimbursement', 'petty_cash', 'mobile_transfer'));

UPDATE donations
SET serial_number = NULL;

UPDATE expenses
SET serial_number = NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donations_serial_number_key
  ON donations (serial_number)
  WHERE serial_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS expenses_serial_number_key
  ON expenses (serial_number)
  WHERE serial_number IS NOT NULL;

CREATE OR REPLACE FUNCTION tif_generate_monthly_serial(
  p_table_name TEXT,
  p_date DATE,
  p_prefix TEXT
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  month_key TEXT;
  next_number INTEGER;
  existing_number INTEGER;
BEGIN
  month_key := to_char(p_date, 'MM');
  PERFORM pg_advisory_xact_lock(hashtext(p_table_name || ':' || p_prefix || ':' || month_key));

  IF p_table_name = 'donations' THEN
    SELECT COALESCE(MAX((substring(serial_number from 5))::integer), 0)
      INTO existing_number
    FROM donations
    WHERE to_char(gift_date, 'MM') = month_key
      AND serial_number ~ ('^' || p_prefix || month_key || '[0-9]+$');
  ELSIF p_table_name = 'expenses' THEN
    SELECT COALESCE(MAX((substring(serial_number from 5))::integer), 0)
      INTO existing_number
    FROM expenses
    WHERE to_char(expense_date, 'MM') = month_key
      AND serial_number ~ ('^' || p_prefix || month_key || '[0-9]+$');
  ELSE
    RAISE EXCEPTION 'Unsupported serial table: %', p_table_name;
  END IF;

  next_number := existing_number + 1;
  RETURN p_prefix || month_key ||
    CASE
      WHEN next_number < 100 THEN lpad(next_number::text, 2, '0')
      ELSE next_number::text
    END;
END;
$$;

CREATE OR REPLACE FUNCTION tif_set_donation_serial_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.serial_number IS NULL OR NEW.serial_number = '' THEN
    NEW.serial_number := tif_generate_monthly_serial('donations', NEW.gift_date, 'dn');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION tif_set_expense_serial_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.serial_number IS NULL OR NEW.serial_number = '' THEN
    NEW.serial_number := tif_generate_monthly_serial('expenses', NEW.expense_date, 'ex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_donation_serial_number ON donations;
CREATE TRIGGER set_donation_serial_number
  BEFORE INSERT ON donations
  FOR EACH ROW
  EXECUTE FUNCTION tif_set_donation_serial_number();

DROP TRIGGER IF EXISTS set_expense_serial_number ON expenses;
CREATE TRIGGER set_expense_serial_number
  BEFORE INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION tif_set_expense_serial_number();

WITH ordered AS (
  SELECT
    id,
    'dn' || month_key ||
      CASE
        WHEN monthly_sequence < 100 THEN lpad(monthly_sequence::text, 2, '0')
        ELSE monthly_sequence::text
      END AS generated_serial
  FROM (
    SELECT
      d.id,
      to_char(gift_date, 'MM') AS month_key,
      row_number() OVER (
        PARTITION BY to_char(gift_date, 'MM')
        ORDER BY gift_date, created_at, id
      ) AS monthly_sequence
    FROM donations d
    WHERE d.serial_number IS NULL
  ) sequenced
)
UPDATE donations
SET serial_number = ordered.generated_serial
FROM ordered
WHERE donations.id = ordered.id;

WITH ordered AS (
  SELECT
    id,
    'ex' || month_key ||
      CASE
        WHEN monthly_sequence < 100 THEN lpad(monthly_sequence::text, 2, '0')
        ELSE monthly_sequence::text
      END AS generated_serial
  FROM (
    SELECT
      e.id,
      to_char(expense_date, 'MM') AS month_key,
      row_number() OVER (
        PARTITION BY to_char(expense_date, 'MM')
        ORDER BY expense_date, created_at, id
      ) AS monthly_sequence
    FROM expenses e
    WHERE e.serial_number IS NULL
  ) sequenced
)
UPDATE expenses
SET serial_number = ordered.generated_serial
FROM ordered
WHERE expenses.id = ordered.id;

COMMENT ON COLUMN donations.serial_number IS
  'Auto-generated monthly donation serial number, e.g. dn0701.';

COMMENT ON COLUMN expenses.serial_number IS
  'Auto-generated monthly expense serial number, e.g. ex0701.';

COMMENT ON COLUMN expenses.payment_type IS
  'reimbursement = needs bank transfer to submitter; petty_cash = paid from petty cash; mobile_transfer = already transferred from TIF account via mobile';

NOTIFY pgrst, 'reload schema';
