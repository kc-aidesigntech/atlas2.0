do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'atlas'
      and table_name = 'app_role_navigation'
  ) then
    update atlas.app_role_navigation
    set top_menus = '["enrollees","my profile","refer","my station","county commons"]'::jsonb,
        action_menus = coalesce(action_menus, '[]'::jsonb)
    where surface = 'singlepane'
      and role_key = 'navigator';
  end if;
end
$$;

notify pgrst, 'reload schema';
