DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'atlas'
      AND table_name = 'app_role_navigation'
  ) THEN
    UPDATE atlas.app_role_navigation
    SET top_menus = '["assigned enrollees","requests to enroll","referral portal","route planning","my station","county commons"]'::jsonb
    WHERE surface = 'singlepane'
      AND role_key = 'navigator';
  END IF;
END $$;
