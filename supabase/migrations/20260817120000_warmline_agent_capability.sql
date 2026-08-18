-- Pray Phone warm-line capability: not a sixth role.
-- Administrators and supervisors have warmline_agent.access by role.
-- Navigators need a non-expiring allow exception. Admins may deny a supervisor.

insert into atlas.permissions (permission_key, description)
values (
  'warmline_agent.access',
  'Sit the Pray Phone warm-line agent console and pick up inbound kiosk calls.'
)
on conflict (permission_key) do nothing;

insert into atlas.role_permissions (role_id, permission_id)
select r.id, p.id
from atlas.roles r
join atlas.permissions p on p.permission_key = 'warmline_agent.access'
where r.role_key in ('administrator', 'supervisor')
on conflict (role_id, permission_id) do nothing;

create or replace function atlas.fn_warmline_permission_id()
returns uuid
language sql
stable
security definer
set search_path = atlas, public
as $$
  select p.id
  from atlas.permissions p
  where p.permission_key = 'warmline_agent.access'
  limit 1
$$;

create or replace function atlas.fn_person_has_warmline_access(target_person_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  perm uuid;
begin
  if target_person_id is null then
    return false;
  end if;

  perm := atlas.fn_warmline_permission_id();
  if perm is null then
    return false;
  end if;

  if exists (
    select 1
    from atlas.user_permission_exceptions upe
    where upe.person_id = target_person_id
      and upe.permission_id = perm
      and upe.effect = 'deny'
      and upe.starts_at <= now()
      and (upe.ends_at is null or upe.ends_at >= now())
  ) then
    return false;
  end if;

  if exists (
    select 1
    from atlas.user_permission_exceptions upe
    where upe.person_id = target_person_id
      and upe.permission_id = perm
      and upe.effect = 'allow'
      and upe.starts_at <= now()
      and (upe.ends_at is null or upe.ends_at >= now())
  ) then
    return true;
  end if;

  return exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.role_permissions rp on rp.role_id = pra.role_id
    where pra.person_id = target_person_id
      and rp.permission_id = perm
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on >= current_date)
  );
end;
$$;

create or replace function atlas.fn_person_warmline_exception_effect(target_person_id uuid)
returns text
language sql
stable
security definer
set search_path = atlas, public
as $$
  select upe.effect
  from atlas.user_permission_exceptions upe
  where upe.person_id = target_person_id
    and upe.permission_id = atlas.fn_warmline_permission_id()
    and upe.starts_at <= now()
    and (upe.ends_at is null or upe.ends_at >= now())
  order by upe.created_at desc
  limit 1
$$;

create or replace function atlas.fn_can_access_warmline_agent()
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  return atlas.fn_has_permission('warmline_agent.access');
end;
$$;

comment on function atlas.fn_can_access_warmline_agent() is
  'True when the signed-in Atlas identity may open the Pray Phone warm-line agent console. Navigators need an allow exception; supervisors/admins have the permission by role unless denied.';

create or replace function atlas.fn_clear_warmline_exceptions(target_person_id uuid)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  delete from atlas.user_permission_exceptions
  where person_id = target_person_id
    and permission_id = atlas.fn_warmline_permission_id();
end;
$$;

create or replace function atlas.fn_admin_set_warmline_access(
  target_person_id uuid,
  next_effect text
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  normalized text := lower(coalesce(next_effect, ''));
  perm uuid;
begin
  perform atlas.fn_require_admin_claim();
  if target_person_id is null then
    raise exception 'target_person_id is required' using errcode = '22023';
  end if;
  if normalized not in ('allow', 'deny', 'clear') then
    raise exception 'next_effect must be allow, deny, or clear' using errcode = '22023';
  end if;

  perm := atlas.fn_warmline_permission_id();
  if perm is null then
    raise exception 'warmline_agent.access permission is missing' using errcode = 'P0001';
  end if;

  perform atlas.fn_clear_warmline_exceptions(target_person_id);
  if normalized = 'clear' then
    return;
  end if;

  insert into atlas.user_permission_exceptions (
    person_id,
    permission_id,
    effect,
    reason,
    starts_at,
    ends_at,
    created_by_person_id
  ) values (
    target_person_id,
    perm,
    normalized,
    'admin warm-line capability',
    now(),
    null,
    atlas.fn_current_person_id()
  );
end;
$$;

create or replace function atlas.fn_supervisor_set_navigator_warmline_access(
  target_navigator_person_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  supervisor_id uuid;
  perm uuid;
begin
  supervisor_id := atlas.fn_current_person_id();
  if supervisor_id is null then
    raise exception 'signed-in person required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = supervisor_id
      and r.role_key = 'supervisor'
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on >= current_date)
  ) and coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') <> 'administrator' then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') <> 'administrator' then
    if not exists (
      select 1
      from atlas.supervisor_navigator_assignments sna
      where sna.supervisor_person_id = supervisor_id
        and sna.navigator_person_id = target_navigator_person_id
        and sna.ends_on is null
    ) then
      raise exception 'navigator is not on this supervisor roster' using errcode = '42501';
    end if;
  end if;

  perm := atlas.fn_warmline_permission_id();
  if perm is null then
    raise exception 'warmline_agent.access permission is missing' using errcode = 'P0001';
  end if;

  perform atlas.fn_clear_warmline_exceptions(target_navigator_person_id);
  if not coalesce(enabled, false) then
    return;
  end if;

  insert into atlas.user_permission_exceptions (
    person_id,
    permission_id,
    effect,
    reason,
    starts_at,
    ends_at,
    created_by_person_id
  ) values (
    target_navigator_person_id,
    perm,
    'allow',
    'supervisor warm-line grant',
    now(),
    null,
    supervisor_id
  );
end;
$$;

create or replace function atlas.fn_list_warmline_access(target_person_ids uuid[])
returns table(person_id uuid, has_access boolean, exception_effect text)
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  viewer uuid;
  is_admin boolean;
  is_supervisor boolean;
begin
  viewer := atlas.fn_current_person_id();
  is_admin := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  is_supervisor := exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = viewer
      and r.role_key = 'supervisor'
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on >= current_date)
  );

  return query
  select
    candidate.person_id,
    atlas.fn_person_has_warmline_access(candidate.person_id),
    atlas.fn_person_warmline_exception_effect(candidate.person_id)
  from unnest(coalesce(target_person_ids, '{}'::uuid[])) as candidate(person_id)
  where is_admin
    or candidate.person_id = viewer
    or (
      is_supervisor
      and exists (
        select 1
        from atlas.supervisor_navigator_assignments sna
        where sna.supervisor_person_id = viewer
          and sna.navigator_person_id = candidate.person_id
          and sna.ends_on is null
      )
    );
end;
$$;

revoke all on function atlas.fn_warmline_permission_id() from public;
revoke all on function atlas.fn_person_has_warmline_access(uuid) from public;
revoke all on function atlas.fn_person_warmline_exception_effect(uuid) from public;
revoke all on function atlas.fn_can_access_warmline_agent() from public;
revoke all on function atlas.fn_clear_warmline_exceptions(uuid) from public;
revoke all on function atlas.fn_admin_set_warmline_access(uuid, text) from public;
revoke all on function atlas.fn_supervisor_set_navigator_warmline_access(uuid, boolean) from public;
revoke all on function atlas.fn_list_warmline_access(uuid[]) from public;

grant execute on function atlas.fn_can_access_warmline_agent() to authenticated;
grant execute on function atlas.fn_admin_set_warmline_access(uuid, text) to authenticated;
grant execute on function atlas.fn_supervisor_set_navigator_warmline_access(uuid, boolean) to authenticated;
grant execute on function atlas.fn_list_warmline_access(uuid[]) to authenticated;
