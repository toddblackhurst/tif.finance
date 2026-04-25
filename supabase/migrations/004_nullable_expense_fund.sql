-- Expenses don't belong to a fund (funds are for donation receipts only).
-- Make fund_id optional so public and staff submissions don't need to specify one.
ALTER TABLE expenses ALTER COLUMN fund_id DROP NOT NULL;
