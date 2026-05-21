-- Explicit Data API grants for Supabase's 2026 public-schema default change.
-- RLS policies below still decide which rows each role can access.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public reimbursement submissions use the Data API path. RLS still restricts
-- anonymous inserts to submitted rows with no authenticated submitter.
GRANT INSERT ON TABLE public.expenses TO anon;

-- Authenticated app users need Data API access; RLS policies constrain scope.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campuses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.funds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_campus_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.donors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.donations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.budgets TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bank_import_lines TO authenticated;

-- Report views used by the dashboard.
GRANT SELECT ON TABLE public.donor_statistics TO authenticated;
GRANT SELECT ON TABLE public.monthly_campus_rollup TO authenticated;
GRANT SELECT ON TABLE public.budget_variance TO authenticated;

-- Server-side jobs and maintenance scripts use the service role over REST.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
