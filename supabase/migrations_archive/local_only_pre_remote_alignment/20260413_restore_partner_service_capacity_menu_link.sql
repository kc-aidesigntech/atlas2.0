DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'atlas'
      AND table_name = 'app_role_navigation'
  ) THEN
    UPDATE atlas.app_role_navigation
    SET top_menus = '["referral portal","my station","service capacity","county commons"]'::jsonb,
        action_menus = '[]'::jsonb
    WHERE surface = 'singlepane'
      AND role_key = 'partner';
  END IF;
END $$;
