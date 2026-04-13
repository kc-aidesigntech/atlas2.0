do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'atlas'
      and table_name = 'app_role_navigation'
  ) then
    update atlas.app_role_navigation
    set top_menus = '["referral portal","my station","service capacity","county commons"]'::jsonb,
        action_menus = '[]'::jsonb
    where surface = 'singlepane'
      and role_key = 'partner';
  end if;
end $$;
