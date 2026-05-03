do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'atlas'
      and table_name = 'app_role_navigation'
  ) then
    update atlas.app_role_navigation
    set top_menus = '["requests to enroll","referral portal","route planning","my station","county commons"]'::jsonb
    where surface = 'singlepane'
      and role_key = 'navigator';
  end if;
end $$;
