-- Add payment type and bank reimbursement fields to expenses
-- payment_type: 'reimbursement' (needs bank transfer) or 'petty_cash' (already paid)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS payment_type TEXT
    CHECK (payment_type IN ('reimbursement', 'petty_cash')),
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

COMMENT ON COLUMN expenses.payment_type IS
  'reimbursement = needs bank transfer to submitter; petty_cash = already paid from petty cash';
COMMENT ON COLUMN expenses.bank_code IS
  'Taiwan bank code (3 digits), required when payment_type = reimbursement';
COMMENT ON COLUMN expenses.bank_account_number IS
  'Bank account number for reimbursement transfer';
