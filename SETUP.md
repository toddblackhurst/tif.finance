# TIF Finance — Setup Guide

## Before You Start

You'll need:
- A dedicated church Google account (e.g. `tif.finance@gmail.com`)
- Node.js 18+ installed on your Mac
- A free Supabase account
- A free Vercel account

---

## Step 1: Create the Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in with the church Google account
2. Click **New Project** — name it `tif-finance`
3. Choose a strong database password and save it somewhere safe
4. Wait ~2 minutes for the project to provision

### Apply the Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Open `supabase/migrations/001_initial_schema.sql` from this project folder
3. Paste the entire contents into the SQL Editor and click **Run**
4. You should see "Success" — the tables, views, and RLS policies are now created

### Enable Google Authentication

1. In Supabase, go to **Authentication → Providers → Google**
2. Enable it, then follow the instructions to create a Google OAuth Client in Google Cloud Console
3. Set the **Authorized redirect URI** to:
   `https://your-project-ref.supabase.co/auth/v1/callback`
4. Copy the Client ID and Secret back into Supabase

### Get Your API Keys

1. Go to **Project Settings → API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

---

## Step 2: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local` in the project folder:
   ```
   cp .env.local.example .env.local
   ```
2. Fill in your three Supabase values from Step 1

---

## Step 3: Run Locally

```bash
cd tif-finance
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the TIF Finance login page.

**First login:**
- Sign in with your church Google account
- Your user profile is created automatically
- Go to Supabase → Table Editor → `user_profiles` and set your `role` to `admin`
- Refresh the app — you now have full access

---

## Step 4: Add Team Members

For each finance volunteer:
1. They sign in with their Google account (this creates their `user_profiles` row)
2. You (admin) go to Admin → Users and set their role:
   - **admin** — full access to all campuses
   - **campus-finance** — can only see/enter data for their assigned campus
   - **viewer** — read-only access
3. Set their **Assigned Campus** if they are `campus-finance`

---

## Step 5: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with the church Google account
2. Click **New Project → Import Git Repository**
3. Either:
   - Push this project to a GitHub repo first, then import it, OR
   - Use the Vercel CLI: `npx vercel --prod`
4. Add your three environment variables in Vercel's **Settings → Environment Variables**
5. After deploy, update your Supabase Google OAuth redirect URI to include your Vercel URL:
   `https://your-tif-finance.vercel.app/auth/callback`

---

## Step 6: Plan PCO Sync (Phase 4)

When you're ready to sync donors from Planning Center Online:

1. Log into PCO → **Integrations → Developer → Personal Access Tokens**
2. Create a token and save it
3. We'll build the sync script in Phase 4 — no code changes needed now

---

## Folder Structure

```
tif-finance/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    ← Run this in Supabase SQL Editor
├── messages/
│   ├── en.json                       ← English UI strings
│   └── zh-TW.json                    ← Traditional Chinese UI strings
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── (app)/                ← Protected pages (require login)
│   │   │   │   ├── page.tsx          ← Dashboard
│   │   │   │   ├── donations/
│   │   │   │   ├── expenses/
│   │   │   │   ├── donors/
│   │   │   │   ├── reports/
│   │   │   │   └── admin/
│   │   │   └── login/
│   │   └── auth/callback/            ← Google OAuth callback
│   ├── components/
│   │   ├── nav.tsx                   ← Sidebar navigation
│   │   └── ui/                       ← shadcn/ui components
│   └── lib/
│       └── supabase/
│           ├── client.ts             ← Browser Supabase client
│           ├── server.ts             ← Server Supabase client
│           └── types.ts              ← TypeScript database types
└── .env.local                        ← Your private keys (never commit this)
```
