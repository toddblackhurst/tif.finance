-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Multi-campus assignments, email-based role provisioning,
--                public expense submissions
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- 1. MULTI-CAMPUS JUNCTION TABLE
-- Replaces the single assigned_campus_id column for users who cover
-- multiple campuses (e.g. Javery covers TIF North + TIF South + TIF System).
-- ─────────────────────────────────────────────
CREATE TABLE user_campus_assignments (
  user_id   UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  campus_id UUID NOT NULL REFERENCES campuses(id)       ON DELETE CASCADE,
  PRIMARY KEY (user_id, campus_id)
);

ALTER TABLE user_campus_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campus_assignments_self_read" ON user_campus_assignments
  FOR SELECT USING (user_id = auth.uid() OR current_user_role() = 'admin');

CREATE POLICY "campus_assignments_admin_write" ON user_campus_assignments
  FOR ALL USING (current_user_role() = 'admin');

-- Migrate any existing single-campus assignments into the junction table
INSERT INTO user_campus_assignments (user_id, campus_id)
SELECT id, assigned_campus_id
FROM   user_profiles
WHERE  assigned_campus_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- 2. REPLACE SINGLE-CAMPUS HELPER WITH MULTI-CAMPUS CHECK
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION user_has_campus_access(p_campus_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_campus_assignments
    WHERE user_id = auth.uid() AND campus_id = p_campus_id
  )
$$;

-- ─────────────────────────────────────────────
-- 3. UPDATE RLS POLICIES FOR DONATIONS AND EXPENSES
-- Swap single-campus check for multi-campus check.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "donations_select" ON donations;
DROP POLICY IF EXISTS "donations_insert" ON donations;
DROP POLICY IF EXISTS "donations_update" ON donations;
DROP POLICY IF EXISTS "donations_delete" ON donations;

CREATE POLICY "donations_select" ON donations FOR SELECT
  USING (current_user_role() = 'admin' OR user_has_campus_access(campus_id));
CREATE POLICY "donations_insert" ON donations FOR INSERT
  WITH CHECK (current_user_role() = 'admin' OR user_has_campus_access(campus_id));
CREATE POLICY "donations_update" ON donations FOR UPDATE
  USING (current_user_role() = 'admin' OR user_has_campus_access(campus_id));
CREATE POLICY "donations_delete" ON donations FOR DELETE
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (current_user_role() = 'admin' OR user_has_campus_access(campus_id));
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (current_user_role() = 'admin' OR user_has_campus_access(campus_id));
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  USING (current_user_role() = 'admin' OR user_has_campus_access(campus_id));
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  USING (current_user_role() = 'admin');

-- ─────────────────────────────────────────────
-- 4. PUBLIC EXPENSE SUBMISSIONS
-- Allow unauthenticated church members to submit reimbursement requests.
-- submitter_id becomes nullable; name/email captured as plain text instead.
-- ─────────────────────────────────────────────
ALTER TABLE expenses ALTER COLUMN submitter_id DROP NOT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submitter_name  TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS submitter_email TEXT;

-- Public insert: no auth required, but status must be 'submitted' and
-- submitter_id must be null (proves it came through the public form).
CREATE POLICY "expenses_public_insert" ON expenses FOR INSERT
  WITH CHECK (submitter_id IS NULL AND status = 'submitted');

-- ─────────────────────────────────────────────
-- 5. EMAIL-BASED ROLE PROVISIONING TRIGGER
-- Fires on every new auth.users row (i.e. first Google sign-in).
-- Maps known emails → role + campus assignments automatically.
-- Unknown emails get the 'viewer' role with no campus access.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role         VARCHAR(50);
  v_campus_names TEXT[];
  v_campus_name  TEXT;
  v_campus_id    UUID;
BEGIN
  CASE NEW.email
    WHEN 'todd.blackhurst@gmail.com' THEN
      v_role := 'admin';
      v_campus_names := ARRAY[]::TEXT[];
    WHEN 'yumi5207914@gmail.com' THEN
      v_role := 'admin';
      v_campus_names := ARRAY[]::TEXT[];
    WHEN 'javerysavage@gmail.com' THEN
      v_role := 'campus-finance';
      v_campus_names := ARRAY['TIF North', 'TIF South', 'TIF System'];
    WHEN 'kya220@gmail.com' THEN
      v_role := 'campus-finance';
      v_campus_names := ARRAY['All Praise'];
    WHEN 'wenlan0807@gmail.com' THEN
      v_role := 'campus-finance';
      v_campus_names := ARRAY['Hope Fellowship'];
    ELSE
      v_role := 'viewer';
      v_campus_names := ARRAY[]::TEXT[];
  END CASE;

  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
    role         = EXCLUDED.role;

  FOREACH v_campus_name IN ARRAY v_campus_names LOOP
    SELECT id INTO v_campus_id
    FROM   public.campuses
    WHERE  name = v_campus_name
    LIMIT  1;

    IF v_campus_id IS NOT NULL THEN
      INSERT INTO public.user_campus_assignments (user_id, campus_id)
      VALUES (NEW.id, v_campus_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─────────────────────────────────────────────
-- 6. BACKFILL: apply roles to users who have already signed in
-- Safe to run multiple times due to ON CONFLICT DO UPDATE / DO NOTHING.
-- ─────────────────────────────────────────────
DO $$
DECLARE
  v_user_id     UUID;
  v_campus_id   UUID;
  v_email       TEXT;
  v_role        VARCHAR(50);
  v_campus_names TEXT[];
  v_campus_name TEXT;
BEGIN
  FOR v_user_id, v_email IN
    SELECT au.id, au.email FROM auth.users au
  LOOP
    CASE v_email
      WHEN 'todd.blackhurst@gmail.com' THEN
        v_role := 'admin';         v_campus_names := ARRAY[]::TEXT[];
      WHEN 'yumi5207914@gmail.com' THEN
        v_role := 'admin';         v_campus_names := ARRAY[]::TEXT[];
      WHEN 'javerysavage@gmail.com' THEN
        v_role := 'campus-finance'; v_campus_names := ARRAY['TIF North','TIF South','TIF System'];
      WHEN 'kya220@gmail.com' THEN
        v_role := 'campus-finance'; v_campus_names := ARRAY['All Praise'];
      WHEN 'wenlan0807@gmail.com' THEN
        v_role := 'campus-finance'; v_campus_names := ARRAY['Hope Fellowship'];
      ELSE
        v_role := 'viewer';        v_campus_names := ARRAY[]::TEXT[];
    END CASE;

    UPDATE public.user_profiles SET role = v_role WHERE id = v_user_id;

    FOREACH v_campus_name IN ARRAY v_campus_names LOOP
      SELECT id INTO v_campus_id
      FROM   public.campuses
      WHERE  name = v_campus_name
      LIMIT  1;

      IF v_campus_id IS NOT NULL THEN
        INSERT INTO public.user_campus_assignments (user_id, campus_id)
        VALUES (v_user_id, v_campus_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
