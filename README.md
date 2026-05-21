# TIF Finance

Internal finance app for Taichung International Fellowship. The app covers donation entry, donor management, reimbursement workflows, bank-transaction review, reporting, and a public reimbursement submission flow.

## Current Scope

- Authenticated app with locale routes under `src/app/[locale]/(app)`
- Public routes for the dashboard and reimbursement submit flow
- Supabase-backed data model for donations, donors, expenses, budgets, bank imports, and audit log
- Email notifications for expense submission, approval, rejection, payment-needed, payment-complete, and daily summaries

## Main Areas

- `src/app/[locale]/(app)/donations` — donation entry and editing
- `src/app/[locale]/(app)/donors` — donor list and donor detail pages
- `src/app/[locale]/(app)/expenses` — draft, submitted, approved, rejected, and paid expense flow
- `src/app/[locale]/(app)/expense-review` — review queue for categorizing `other` expenses
- `src/app/[locale]/(app)/bank` — bank transaction batches and matching
- `src/app/[locale]/(app)/bank/cash-flow` — read-only bank cash-flow view
- `src/app/[locale]/(app)/reports` — reporting screens
- `src/app/[locale]/submit` — public reimbursement form
- `src/app/[locale]/public` — public-facing dashboard view

## Local Setup

1. Use the repo Node version:
   ```bash
   nvm use
   ```
2. Install dependencies from the lockfile:
   ```bash
   npm ci
   ```
3. Copy `.env.local.example` to `.env.local` and fill in the required values.
4. Start the app:
   ```bash
   npm run dev
   ```

## Environment Variables

Required for normal local work:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Required for email features:

- `RESEND_API_KEY`
- `RESEND_FROM`
- `TREASURER_EMAIL`
- `PAYMENT_NOTIFICATION_EMAILS`
- `DAILY_SUMMARY_EMAIL`

## Health Checks

Use these before shipping changes:

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run check` runs lint plus typecheck.

## Supabase Migrations

Schema changes live in `supabase/migrations/` and should be applied in order:

- `001_initial_schema.sql`
- `002_multi_campus_roles.sql`
- `002b_fix_trigger_column.sql`
- `003_expense_payment_reference.sql`
- `004_nullable_expense_fund.sql`
- `005_expense_payment_info.sql`
- `006_donation_contact_email.sql`
- `007_explicit_data_api_grants.sql`

The latest migration adds explicit Data API grants needed for current Supabase public-schema behavior.

## Notes

- The repo is pinned to Node `20.20.0` in `.nvmrc`.
- The app now uses a bundled local font, so production builds do not depend on fetching Google Fonts.
- Historical import helpers live in `scripts/migrate/`.
