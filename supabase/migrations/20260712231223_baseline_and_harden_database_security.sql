-- Baseline the existing schema through migration 009 and harden it without
-- changing finance records.

ALTER VIEW public.donor_statistics SET (security_invoker = true);
ALTER VIEW public.monthly_campus_rollup SET (security_invoker = true);
ALTER VIEW public.budget_variance SET (security_invoker = true);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.user_has_campus_access(p_campus_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_campus_assignments
    WHERE user_id = (SELECT auth.uid())
      AND campus_id = p_campus_id
  )
$$;

REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_has_campus_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_has_campus_access(UUID) TO authenticated, service_role;

ALTER POLICY "campuses_read" ON public.campuses
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "campuses_write" ON public.campuses
  TO authenticated USING (private.current_user_role() = 'admin');

ALTER POLICY "funds_read" ON public.funds
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "funds_write" ON public.funds
  TO authenticated USING (private.current_user_role() = 'admin');

ALTER POLICY "profiles_read" ON public.user_profiles
  TO authenticated
  USING (id = (SELECT auth.uid()) OR private.current_user_role() = 'admin');
ALTER POLICY "profiles_update_own" ON public.user_profiles
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
ALTER POLICY "profiles_admin" ON public.user_profiles
  TO authenticated USING (private.current_user_role() = 'admin');

ALTER POLICY "donors_read" ON public.donors
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "donors_insert" ON public.donors
  TO authenticated
  WITH CHECK (private.current_user_role() IN ('admin', 'campus-finance'));
ALTER POLICY "donors_update" ON public.donors
  TO authenticated
  USING (private.current_user_role() IN ('admin', 'campus-finance'))
  WITH CHECK (private.current_user_role() IN ('admin', 'campus-finance'));
ALTER POLICY "donors_delete" ON public.donors
  TO authenticated USING (private.current_user_role() = 'admin');

ALTER POLICY "donations_select" ON public.donations
  TO authenticated
  USING (
    private.current_user_role() = 'admin'
    OR private.user_has_campus_access(campus_id)
  );
ALTER POLICY "donations_insert" ON public.donations
  TO authenticated
  WITH CHECK (
    private.current_user_role() = 'admin'
    OR private.user_has_campus_access(campus_id)
  );
ALTER POLICY "donations_update" ON public.donations
  TO authenticated
  USING (
    private.current_user_role() = 'admin'
    OR private.user_has_campus_access(campus_id)
  )
  WITH CHECK (
    private.current_user_role() = 'admin'
    OR private.user_has_campus_access(campus_id)
  );
ALTER POLICY "donations_delete" ON public.donations
  TO authenticated USING (private.current_user_role() = 'admin');

ALTER POLICY "expenses_select" ON public.expenses
  TO authenticated
  USING (
    private.current_user_role() = 'admin'
    OR private.user_has_campus_access(campus_id)
  );
ALTER POLICY "expenses_insert" ON public.expenses
  TO authenticated
  WITH CHECK (
    private.current_user_role() = 'admin'
    OR private.user_has_campus_access(campus_id)
  );
ALTER POLICY "expenses_update" ON public.expenses
  TO authenticated
  USING (
    private.current_user_role() = 'admin'
    OR private.user_has_campus_access(campus_id)
  )
  WITH CHECK (
    private.current_user_role() = 'admin'
    OR private.user_has_campus_access(campus_id)
  );
ALTER POLICY "expenses_delete" ON public.expenses
  TO authenticated USING (private.current_user_role() = 'admin');
ALTER POLICY "expenses_public_insert" ON public.expenses
  TO anon
  WITH CHECK (submitter_id IS NULL AND status = 'submitted');

ALTER POLICY "budgets_read" ON public.budgets
  TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
ALTER POLICY "budgets_write" ON public.budgets
  TO authenticated USING (private.current_user_role() = 'admin');

ALTER POLICY "audit_log_read" ON public.audit_log
  TO authenticated USING (private.current_user_role() = 'admin');
ALTER POLICY "audit_log_insert" ON public.audit_log
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND actor_id = (SELECT auth.uid())
  );

ALTER POLICY "bank_imports_all" ON public.bank_import_lines
  TO authenticated USING (private.current_user_role() = 'admin');

ALTER POLICY "campus_assignments_self_read" ON public.user_campus_assignments
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.current_user_role() = 'admin'
  );
ALTER POLICY "campus_assignments_admin_write" ON public.user_campus_assignments
  TO authenticated USING (private.current_user_role() = 'admin');

DROP FUNCTION public.current_user_campus_id();
DROP FUNCTION public.current_user_role();
DROP FUNCTION public.user_has_campus_access(UUID);

ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.tif_generate_monthly_serial(TEXT, DATE, TEXT)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.tif_set_donation_serial_number()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.tif_set_expense_serial_number()
  SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tif_generate_monthly_serial(TEXT, DATE, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tif_set_donation_serial_number()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tif_set_expense_serial_number()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
