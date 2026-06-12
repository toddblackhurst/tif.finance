-- Add income funds requested for non-donation receipts.

INSERT INTO funds (name, is_restricted, is_active, description)
VALUES
  ('Other Income', false, true, 'General non-donation income such as meal fees.'),
  ('Petty Cash Return', false, true, 'Returned petty cash or similar internal cash returns.')
ON CONFLICT (name) DO UPDATE SET
  is_restricted = EXCLUDED.is_restricted,
  is_active = true,
  description = COALESCE(funds.description, EXCLUDED.description),
  updated_at = now();
