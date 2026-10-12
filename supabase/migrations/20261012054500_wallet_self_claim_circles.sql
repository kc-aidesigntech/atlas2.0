-- Supervisors claim navigators onto themselves from My Wallet.
-- A supervisor can only add or end their own edge. They cannot rewrite someone else's supervisors.

create or replace function atlas.fn_wallet_caller_is_supervisor()
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
  auth_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  auth_atlas_role text := lower(coalesce(auth_claims -> 'app_metadata' ->> 'atlas_role', ''));
  auth_atlas_roles jsonb := coalesce(auth_claims -> 'app_metadata' -> 'atlas_roles', '[]'::jsonb);
begin
  if current_person_id is not null and exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = current_person_id
      and pra.ends_on is null
      and r.role_key in ('supervisor', 'administrator')
  ) then
    return true;
  end if;

  return auth_atlas_role in ('supervisor', 'administrator')
    or exists (
      select 1
      from jsonb_array_elements_text(auth_atlas_roles) as role_value(role_key)
      where lower(role_value.role_key) in ('supervisor', 'administrator')
    );
end;
$$;

create or replace function atlas.fn_wallet_navigator_claim_cards()
returns table (
  person_id uuid,
  display_name text,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
begin
  if not atlas.fn_wallet_caller_is_supervisor() then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'navigator') as display_name,
    exists (
      select 1
      from atlas.supervisor_navigator_assignments sna
      where sna.navigator_person_id = p.id
        and sna.supervisor_person_id = current_person_id
        and sna.ends_on is null
    ) as is_mine
  from atlas.people p
  join atlas.people_role_assignments pra on pra.person_id = p.id and pra.ends_on is null
  join atlas.roles r on r.id = pra.role_id and r.role_key = 'navigator'
  where coalesce(p.status, 'active') = 'active'
  order by 2;
end;
$$;

create or replace function atlas.fn_supervisor_claim_navigator(target_navigator_person_id uuid)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
begin
  if current_person_id is null then
    raise exception 'supervisor identity is not mapped' using errcode = '42501';
  end if;
  if not atlas.fn_wallet_caller_is_supervisor() then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;
  if target_navigator_person_id is null then
    raise exception 'navigator person id is required' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = target_navigator_person_id
      and pra.ends_on is null
      and r.role_key = 'navigator'
  ) then
    raise exception 'target person is not a navigator' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from atlas.supervisor_navigator_assignments sna
    where sna.navigator_person_id = target_navigator_person_id
      and sna.supervisor_person_id = current_person_id
      and sna.ends_on is null
  ) then
    return;
  end if;

  -- Reopen today's edge when someone assigns, removes, and assigns again.
  -- A second insert would collide with the unique start date.
  update atlas.supervisor_navigator_assignments
  set ends_on = null
  where id = (
    select sna.id
    from atlas.supervisor_navigator_assignments sna
    where sna.navigator_person_id = target_navigator_person_id
      and sna.supervisor_person_id = current_person_id
    order by sna.starts_on desc
    limit 1
  );

  if found then
    return;
  end if;

  insert into atlas.supervisor_navigator_assignments (
    id,
    navigator_person_id,
    supervisor_person_id,
    starts_on,
    ends_on
  )
  values (
    gen_random_uuid(),
    target_navigator_person_id,
    current_person_id,
    current_date,
    null
  );
end;
$$;

create or replace function atlas.fn_supervisor_release_navigator(target_navigator_person_id uuid)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
begin
  if current_person_id is null then
    raise exception 'supervisor identity is not mapped' using errcode = '42501';
  end if;
  if not atlas.fn_wallet_caller_is_supervisor() then
    raise exception 'supervisor role required' using errcode = '42501';
  end if;

  update atlas.supervisor_navigator_assignments
  set ends_on = current_date
  where navigator_person_id = target_navigator_person_id
    and supervisor_person_id = current_person_id
    and ends_on is null;
end;
$$;

revoke all on function atlas.fn_wallet_caller_is_supervisor() from public;
revoke all on function atlas.fn_wallet_navigator_claim_cards() from public;
revoke all on function atlas.fn_supervisor_claim_navigator(uuid) from public;
revoke all on function atlas.fn_supervisor_release_navigator(uuid) from public;

grant execute on function atlas.fn_wallet_caller_is_supervisor() to authenticated;
grant execute on function atlas.fn_wallet_navigator_claim_cards() to authenticated;
grant execute on function atlas.fn_supervisor_claim_navigator(uuid) to authenticated;
grant execute on function atlas.fn_supervisor_release_navigator(uuid) to authenticated;

notify pgrst, 'reload schema';
