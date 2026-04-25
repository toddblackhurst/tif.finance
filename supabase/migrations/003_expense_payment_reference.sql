-- Add payment_reference column to expenses for check/bank transfer reference numbers
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_reference TEXT;
