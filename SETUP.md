# TIF Finance — Setup Guide

This guide is for getting a clean local copy ready for real work without relying on stale defaults.

## Before You Start

You will need:

- Node `20.20.0` available locally
- A Supabase project for `tif-finance`
- A Vercel project for the frontend
- A Resend account for email notifications

The repo already includes `.nvmrc`, so the safest local start is:

```bash
nvm use
npm ci
```

## 1. Environment File

Copy the example file:

```bash
cp .env.local.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `TREASURER_EMAIL`
- `PAYMENT_NOTIFICATION_EMAILS`
- `DAILY_SUMMARY_EMAIL`

## 2. Supabase Schema

Apply the SQL files in `supabase/migrations/` in filename order:

1. `001_initial_schema.sql`
2. `002_multi_campus_roles.sql`
3. `002b_fix_trigger_column.sql`
4. `003_expense_payment_reference.sql`
5. `004_nullable_expense_fund.sql`
6. `005_expense_payment_info.sql`
7. `006_donation_contact_email.sql`
8. `007_explicit_data_api_grants.sql`

Important:

- `006_donation_contact_email.sql` adds the optional donation contact email field used by the current donation flow and export.
- `007_explicit_data_api_grants.sql` hardens Data API access for current Supabase behavior and should be applied for authenticated app access plus public reimbursement submissions.

## 3. Auth Setup

In Supabase:

1. Enable Google auth if your team will log in with Google.
2. Add the auth callback URL for your local or deployed app.
3. Confirm the app URL in `.env.local` matches the environment you are testing.

## 4. Local Run

Start the dev server:

```bash
npm run dev
```

Useful local routes:

- `http://localhost:3000/en/login`
- `http://localhost:3000/en/public`
- `http://localhost:3000/en/submit`

## 5. Verification Pass

Before handing the repo off to someone else or shipping changes, run:

```bash
npm run lint
npm run typecheck
npm run build
```

If these pass, the local checkout is in a healthy state.

## 6. Deployment Notes

- Vercel should receive the same environment variables as local, with production values.
- `NEXT_PUBLIC_APP_URL` should point at the live app URL so email links resolve correctly.
- Expense approval and payment emails depend on the Resend settings plus `TREASURER_EMAIL` and `PAYMENT_NOTIFICATION_EMAILS`.

## 7. Historical Data Imports

Historical CSV import helpers live in `scripts/migrate/`. Use that folder's README for donor, donation, expense, and budget backfills.
