-- Fix: column is full_name not display_name; also patch existing profile to admin.

-- 1. Correct the trigger function column name
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

  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email     = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
    role      = EXCLUDED.role;

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

-- 2. Manually set the existing Todd profile to admin
--    (this profile was created before the trigger existed)
UPDATE public.user_profiles
SET role = 'admin'
WHERE email = 'tif.finance@taichungif.org';

-- 3. Re-run backfill using correct column name
DO $$
DECLARE
  v_user_id      UUID;
  v_campus_id    UUID;
  v_email        TEXT;
  v_role         VARCHAR(50);
  v_campus_names TEXT[];
  v_campus_name  TEXT;
BEGIN
  FOR v_user_id, v_email IN
    SELECT au.id, au.email FROM auth.users au
  LOOP
    CASE v_email
      WHEN 'todd.blackhurst@gmail.com' THEN
        v_role := 'admin';          v_campus_names := ARRAY[]::TEXT[];
      WHEN 'yumi5207914@gmail.com' THEN
        v_role := 'admin';          v_campus_names := ARRAY[]::TEXT[];
      WHEN 'javerysavage@gmail.com' THEN
        v_role := 'campus-finance'; v_campus_names := ARRAY['TIF North','TIF South','TIF System'];
      WHEN 'kya220@gmail.com' THEN
        v_role := 'campus-finance'; v_campus_names := ARRAY['All Praise'];
      WHEN 'wenlan0807@gmail.com' THEN
        v_role := 'campus-finance'; v_campus_names := ARRAY['Hope Fellowship'];
      ELSE
        v_role := 'viewer';         v_campus_names := ARRAY[]::TEXT[];
    END CASE;

    UPDATE public.user_profiles SET role = v_role WHERE id = v_user_id;

    FOREACH v_campus_name IN ARRAY v_campus_names LOOP
      SELECT id INTO v_campus_id
      FROM   public.campuses WHERE name = v_campus_name LIMIT 1;

      IF v_campus_id IS NOT NULL THEN
        INSERT INTO public.user_campus_assignments (user_id, campus_id)
        VALUES (v_user_id, v_campus_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
