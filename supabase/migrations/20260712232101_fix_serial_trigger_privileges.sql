-- Trigger functions must be able to call the private serial generator even
-- when the inserting role cannot execute that helper directly.

CREATE OR REPLACE FUNCTION public.tif_set_donation_serial_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.serial_number IS NULL OR NEW.serial_number = '' THEN
    NEW.serial_number := public.tif_generate_monthly_serial(
      'donations', NEW.gift_date, 'dn'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tif_set_expense_serial_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.serial_number IS NULL OR NEW.serial_number = '' THEN
    NEW.serial_number := public.tif_generate_monthly_serial(
      'expenses', NEW.expense_date, 'ex'
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tif_set_donation_serial_number()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tif_set_expense_serial_number()
  FROM PUBLIC, anon, authenticated;
