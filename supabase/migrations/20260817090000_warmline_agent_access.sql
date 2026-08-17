-- Warm line (Pray Phone agent console) access for Atlas staff.
-- The kiosk device stays unauthenticated; only the agent webpage is gated.
-- Navigators, supervisors, and administrators with an active role assignment
-- may join. Partners cannot.

create or replace function atlas.fn_can_access_warmline_agent()
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Administrator JWT claim is the same fast-path used by other staff helpers.
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator' then
    return true;
  end if;

  current_person := atlas.fn_current_person_id();
  if current_person is null then
    return false;
  end if;

  return exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = current_person
      and r.role_key in ('navigator', 'supervisor', 'administrator')
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on >= current_date)
  );
end;
$$;

comment on function atlas.fn_can_access_warmline_agent() is
  'True when the signed-in Atlas identity may open the Pray Phone warm-line agent console.';

revoke all on function atlas.fn_can_access_warmline_agent() from public;
grant execute on function atlas.fn_can_access_warmline_agent() to authenticated;

-- Surface the warm line in staff navigation. The menu entry navigates to the
-- Pray Phone agent origin (subdomain or configured URL) rather than rendering
-- an in-shell pane, matching Scribe and service-capacity.
update atlas.app_role_navigation
set top_menus = top_menus || '["warm line"]'::jsonb
where surface = 'singlepane'
  and role_key in ('navigator', 'supervisor', 'administrator')
  and not top_menus ? 'warm line';
