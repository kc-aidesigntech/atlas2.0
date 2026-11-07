-- Residency tiers replace the staff role keys.
--
-- Seven tier keys become atlas.roles rows: t1 Candidate, t2 Apprentice,
-- t2b Peer Resident, t3 Travel Peer, t3a Peer Navigator, t4 Supervisor,
-- t4plus Coordinator. partner and enrollee stay. Existing navigator /
-- supervisor / administrator assignments move to t3a / t4 / t4plus and the
-- three old role rows are deleted.
--
-- The JSON Web Token (JWT) claim app_metadata.atlas_role is written outside
-- this repository and may still carry the legacy literal, so the helpers below
-- normalize legacy literals to tier keys and every rewritten check accepts both.
--
-- One active tier per person lives in atlas.people_tiers (tier_status active |
-- alum, is_lucid_employee). Designations live in atlas.tier_designations.
-- Remote Procedure Calls (RPCs): fn_set_person_tier, fn_mark_tier_alum,
-- fn_grant_designation, fn_revoke_designation, fn_my_tier.

-- ---------------------------------------------------------------------------
-- Role-key helpers shared by every later tier migration.
-- ---------------------------------------------------------------------------

-- Maps a legacy staff literal to its tier key; any other value passes through.
create or replace function atlas.fn_normalize_role_key(raw_role_key text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(raw_role_key, ''))
    when 'administrator' then 't4plus'
    when 'supervisor' then 't4'
    when 'navigator' then 't3a'
    else lower(coalesce(raw_role_key, ''))
  end
$$;

-- Ladder position of a tier key: t1 = 1 through t4plus = 7; other keys return 0.
create or replace function atlas.fn_tier_rank(target_role_key text)
returns integer
language sql
immutable
as $$
  select case atlas.fn_normalize_role_key(target_role_key)
    when 't1' then 1
    when 't2' then 2
    when 't2b' then 3
    when 't3' then 4
    when 't3a' then 5
    when 't4' then 6
    when 't4plus' then 7
    else 0
  end
$$;

-- Returns the caller's normalized role keys: active people_role_assignments
-- rows plus the atlas_role and atlas_roles JWT claims. Empty array when the
-- caller has neither a person row nor a claim.
create or replace function atlas.fn_caller_role_keys()
returns text[]
language sql
stable
security definer
set search_path = atlas, public
as $$
  with claims as (
    select coalesce(auth.jwt(), '{}'::jsonb) as jwt
  ),
  keys as (
    select atlas.fn_normalize_role_key(r.role_key) as role_key
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = atlas.fn_current_person_id()
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on > current_date)

    union

    select atlas.fn_normalize_role_key(c.jwt -> 'app_metadata' ->> 'atlas_role')
    from claims c
    where nullif(c.jwt -> 'app_metadata' ->> 'atlas_role', '') is not null

    union

    select atlas.fn_normalize_role_key(role_value.role_key)
    from claims c
    cross join jsonb_array_elements_text(
      case
        when jsonb_typeof(c.jwt -> 'app_metadata' -> 'atlas_roles') = 'array'
          then c.jwt -> 'app_metadata' -> 'atlas_roles'
        else '[]'::jsonb
      end
    ) as role_value(role_key)
  )
  select coalesce(array_agg(distinct k.role_key), '{}'::text[])
  from keys k
  where k.role_key <> ''
$$;

-- True when the atlas_role claim is administrator or t4plus, or the caller
-- holds an active t4plus assignment. This is the one system-administrator
-- fast path; every rewritten policy and function calls it.
create or replace function atlas.fn_is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  select
    atlas.fn_normalize_role_key(coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '')) = 't4plus'
    or exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = atlas.fn_current_person_id()
        and r.role_key = 't4plus'
        and pra.starts_on <= current_date
        and (pra.ends_on is null or pra.ends_on > current_date)
    )
$$;

-- True when the caller may manage tiers and designations: system admin or an
-- active t4 / t4plus (claim or assignment).
create or replace function atlas.fn_can_manage_tiers()
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  select atlas.fn_is_system_admin()
    or atlas.fn_caller_role_keys() && array['t4', 't4plus']::text[]
$$;

revoke all on function atlas.fn_normalize_role_key(text) from public;
revoke all on function atlas.fn_tier_rank(text) from public;
revoke all on function atlas.fn_caller_role_keys() from public;
revoke all on function atlas.fn_is_system_admin() from public;
revoke all on function atlas.fn_can_manage_tiers() from public;
grant execute on function atlas.fn_normalize_role_key(text) to authenticated, service_role;
grant execute on function atlas.fn_tier_rank(text) to authenticated, service_role;
grant execute on function atlas.fn_caller_role_keys() to authenticated, service_role;
grant execute on function atlas.fn_is_system_admin() to authenticated, service_role;
grant execute on function atlas.fn_can_manage_tiers() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Role rows: constraint, tier rows, remap, delete old rows.
-- ---------------------------------------------------------------------------

-- The old check only allowed navigator / partner / supervisor / administrator /
-- enrollee, so it is dropped before the tier rows are inserted.
alter table atlas.roles drop constraint if exists roles_role_key_check;

insert into atlas.roles (role_key, role_name)
values
  ('t1', 'Candidate'),
  ('t2', 'Apprentice'),
  ('t2b', 'Peer Resident'),
  ('t3', 'Travel Peer'),
  ('t3a', 'Peer Navigator'),
  ('t4', 'Supervisor'),
  ('t4plus', 'Coordinator')
on conflict (role_key) do update
set role_name = excluded.role_name;

do $$
declare
  remap record;
  old_role_id uuid;
  new_role_id uuid;
begin
  for remap in
    select * from (values
      ('navigator', 't3a'),
      ('supervisor', 't4'),
      ('administrator', 't4plus')
    ) as m(old_key, new_key)
  loop
    select id into old_role_id from atlas.roles where role_key = remap.old_key limit 1;
    select id into new_role_id from atlas.roles where role_key = remap.new_key limit 1;

    if old_role_id is null or new_role_id is null then
      continue;
    end if;

    -- Every assignment on the old role now points at the tier role. No two old
    -- keys map to the same tier, so the active (person_id, role_id) unique index
    -- is not violated by the move.
    update atlas.people_role_assignments
    set role_id = new_role_id
    where role_id = old_role_id;

    -- Permission grants on the old role are copied to the tier role before the
    -- old row (and its role_permissions rows, on delete cascade) disappears.
    insert into atlas.role_permissions (role_id, permission_id)
    select new_role_id, rp.permission_id
    from atlas.role_permissions rp
    where rp.role_id = old_role_id
    on conflict (role_id, permission_id) do nothing;

    delete from atlas.roles where id = old_role_id;
  end loop;
end
$$;

alter table atlas.roles
  add constraint roles_role_key_check
  check (role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus', 'partner', 'enrollee'));

-- ---------------------------------------------------------------------------
-- people_tiers: one row per person; tier_designations: one row per grant.
-- ---------------------------------------------------------------------------

create table if not exists atlas.people_tiers (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references atlas.people(id) on delete cascade,
  tier_key text not null check (tier_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus')),
  tier_status text not null default 'active' check (tier_status in ('active', 'alum')),
  entered_at timestamptz not null default now(),
  left_at timestamptz,
  is_lucid_employee boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table atlas.people_tiers is
  'Current Residency tier per person. tier_status alum keeps the last tier_key so the wallet can print "T2 Alum".';

create index if not exists idx_people_tiers_tier_key on atlas.people_tiers(tier_key, tier_status);

drop trigger if exists trg_people_tiers_touch_updated_at on atlas.people_tiers;
create trigger trg_people_tiers_touch_updated_at
before update on atlas.people_tiers
for each row execute function atlas.fn_touch_updated_at();

create table if not exists atlas.tier_designations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references atlas.people(id) on delete cascade,
  designation text not null check (designation in ('warmline_operator', 'mentor', 'group_facilitator')),
  granted_by uuid references atlas.people(id) on delete set null,
  granted_at timestamptz not null default now(),
  constraint tier_designations_person_id_designation_key unique (person_id, designation)
);

comment on table atlas.tier_designations is
  'Designations held by t2b and higher: warmline_operator, mentor, group_facilitator.';

create index if not exists idx_tier_designations_person on atlas.tier_designations(person_id);

-- Backfill: each person with an active tier assignment gets one people_tiers
-- row at their highest active tier.
insert into atlas.people_tiers (person_id, tier_key, tier_status, entered_at, left_at, is_lucid_employee)
select distinct on (pra.person_id)
  pra.person_id,
  r.role_key,
  'active',
  coalesce(pra.starts_on::timestamptz, now()),
  null,
  false
from atlas.people_role_assignments pra
join atlas.roles r on r.id = pra.role_id
where r.role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus')
  and pra.starts_on <= current_date
  and (pra.ends_on is null or pra.ends_on > current_date)
order by pra.person_id, atlas.fn_tier_rank(r.role_key) desc, pra.starts_on desc
on conflict (person_id) do nothing;

-- Row-Level Security (RLS): tier standing is directory-level like
-- people_role_assignments, so any signed-in user reads it. Tier managers may
-- update is_lucid_employee directly; every other write goes through the RPCs.
alter table atlas.people_tiers enable row level security;
alter table atlas.tier_designations enable row level security;

drop policy if exists people_tiers_authenticated_select on atlas.people_tiers;
create policy people_tiers_authenticated_select on atlas.people_tiers
  for select to authenticated
  using (true);

drop policy if exists people_tiers_manager_update on atlas.people_tiers;
create policy people_tiers_manager_update on atlas.people_tiers
  for update to authenticated
  using (atlas.fn_can_manage_tiers())
  with check (atlas.fn_can_manage_tiers());

drop policy if exists tier_designations_authenticated_select on atlas.tier_designations;
create policy tier_designations_authenticated_select on atlas.tier_designations
  for select to authenticated
  using (true);

revoke all on atlas.people_tiers from anon, authenticated;
revoke all on atlas.tier_designations from anon, authenticated;
grant select, update (is_lucid_employee) on atlas.people_tiers to authenticated;
grant select on atlas.tier_designations to authenticated;

-- ---------------------------------------------------------------------------
-- Internal tier routine shared by the admin RPC and the cohort trigger.
-- ---------------------------------------------------------------------------

-- Writes the role assignment and the people_tiers row together. Other active
-- tier assignments end today; partner and enrollee assignments are untouched.
-- Not callable by app roles; the gated RPCs and the cohort trigger call it.
create or replace function atlas.fn_tier_apply(target_person_id uuid, next_tier_key text)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_tier text := atlas.fn_normalize_role_key(next_tier_key);
  v_role_id uuid;
begin
  if target_person_id is null then
    raise exception 'target_person_id is required' using errcode = '22023';
  end if;
  if atlas.fn_tier_rank(v_tier) = 0 then
    raise exception 'unknown tier key %', next_tier_key using errcode = '22023';
  end if;
  if not exists (select 1 from atlas.people p where p.id = target_person_id) then
    raise exception 'person not found' using errcode = 'P0002';
  end if;

  select r.id into v_role_id from atlas.roles r where r.role_key = v_tier limit 1;
  if v_role_id is null then
    raise exception 'tier role % is not configured in atlas.roles', v_tier using errcode = '22023';
  end if;

  -- Other active tier assignments end today.
  update atlas.people_role_assignments pra
  set ends_on = current_date, is_primary = false
  from atlas.roles r
  where r.id = pra.role_id
    and pra.person_id = target_person_id
    and pra.ends_on is null
    and r.role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus')
    and r.id <> v_role_id;

  -- The tier assignment becomes the only primary assignment.
  update atlas.people_role_assignments
  set is_primary = false
  where person_id = target_person_id
    and ends_on is null
    and is_primary = true
    and role_id <> v_role_id;

  if exists (
    select 1
    from atlas.people_role_assignments pra
    where pra.person_id = target_person_id
      and pra.role_id = v_role_id
      and pra.ends_on is null
  ) then
    update atlas.people_role_assignments
    set is_primary = true
    where person_id = target_person_id
      and role_id = v_role_id
      and ends_on is null;
  else
    insert into atlas.people_role_assignments (id, person_id, role_id, is_primary, starts_on, ends_on)
    values (gen_random_uuid(), target_person_id, v_role_id, true, current_date, null);
  end if;

  -- The tier row is created or moved; entered_at is kept when the person is
  -- re-activated on the same tier they already hold.
  insert into atlas.people_tiers (person_id, tier_key, tier_status, entered_at, left_at)
  values (target_person_id, v_tier, 'active', now(), null)
  on conflict (person_id) do update
  set
    tier_key = excluded.tier_key,
    tier_status = 'active',
    entered_at = case
      when atlas.people_tiers.tier_key = excluded.tier_key and atlas.people_tiers.tier_status = 'active'
        then atlas.people_tiers.entered_at
      else now()
    end,
    left_at = null;
end;
$$;

revoke all on function atlas.fn_tier_apply(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Admin RPCs. Callable by fn_is_system_admin() or an active t4 / t4plus.
-- ---------------------------------------------------------------------------

create or replace function atlas.fn_set_person_tier(target_person_id uuid, tier_key text)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  if not atlas.fn_can_manage_tiers() then
    raise exception 'tier management requires t4 or higher' using errcode = '42501';
  end if;
  perform atlas.fn_tier_apply(target_person_id, tier_key);
end;
$$;

-- The active tier row becomes alum and keeps its tier_key; the tier role
-- assignment ends today so permissions seeded on the tier stop applying.
create or replace function atlas.fn_mark_tier_alum(target_person_id uuid)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  if not atlas.fn_can_manage_tiers() then
    raise exception 'tier management requires t4 or higher' using errcode = '42501';
  end if;
  if target_person_id is null then
    raise exception 'target_person_id is required' using errcode = '22023';
  end if;
  if not exists (select 1 from atlas.people_tiers pt where pt.person_id = target_person_id) then
    raise exception 'person holds no tier' using errcode = 'P0002';
  end if;

  update atlas.people_role_assignments pra
  set ends_on = current_date, is_primary = false
  from atlas.roles r
  where r.id = pra.role_id
    and pra.person_id = target_person_id
    and pra.ends_on is null
    and r.role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus');

  update atlas.people_tiers
  set tier_status = 'alum',
      left_at = coalesce(left_at, now())
  where person_id = target_person_id;
end;
$$;

-- Designations require an active tier at t2b or higher.
create or replace function atlas.fn_grant_designation(target_person_id uuid, designation text)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_designation text := lower(btrim(coalesce(designation, '')));
begin
  if not atlas.fn_can_manage_tiers() then
    raise exception 'tier management requires t4 or higher' using errcode = '42501';
  end if;
  if v_designation not in ('warmline_operator', 'mentor', 'group_facilitator') then
    raise exception 'unknown designation %', designation using errcode = '22023';
  end if;
  if not exists (
    select 1
    from atlas.people_tiers pt
    where pt.person_id = target_person_id
      and pt.tier_status = 'active'
      and atlas.fn_tier_rank(pt.tier_key) >= atlas.fn_tier_rank('t2b')
  ) then
    raise exception 'designations require an active tier of t2b or higher' using errcode = '42501';
  end if;

  insert into atlas.tier_designations (person_id, designation, granted_by, granted_at)
  values (target_person_id, v_designation, atlas.fn_current_person_id(), now())
  on conflict on constraint tier_designations_person_id_designation_key do nothing;
end;
$$;

create or replace function atlas.fn_revoke_designation(target_person_id uuid, designation text)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  if not atlas.fn_can_manage_tiers() then
    raise exception 'tier management requires t4 or higher' using errcode = '42501';
  end if;
  delete from atlas.tier_designations
  where person_id = target_person_id
    and tier_designations.designation = lower(btrim(coalesce(fn_revoke_designation.designation, '')));
end;
$$;

-- Caller's own standing. Falls back to the highest active tier assignment when
-- no people_tiers row exists yet. Returns zero rows when the caller holds no tier.
create or replace function atlas.fn_my_tier()
returns table (
  tier_key text,
  tier_status text,
  is_lucid_employee boolean,
  designations text[]
)
language sql
stable
security definer
set search_path = atlas, public
as $$
  with me as (
    select atlas.fn_current_person_id() as person_id
  ),
  from_row as (
    select pt.tier_key, pt.tier_status, pt.is_lucid_employee
    from atlas.people_tiers pt
    join me on me.person_id = pt.person_id
  ),
  from_assignment as (
    select r.role_key as tier_key, 'active'::text as tier_status, false as is_lucid_employee
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    join me on me.person_id = pra.person_id
    where r.role_key in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus')
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on > current_date)
    order by atlas.fn_tier_rank(r.role_key) desc
    limit 1
  ),
  standing as (
    select * from from_row
    union all
    select * from from_assignment where not exists (select 1 from from_row)
  )
  select
    s.tier_key,
    s.tier_status,
    s.is_lucid_employee,
    coalesce(
      (
        select array_agg(td.designation order by td.designation)
        from atlas.tier_designations td
        join me on me.person_id = td.person_id
      ),
      '{}'::text[]
    ) as designations
  from standing s
  limit 1
$$;

revoke all on function atlas.fn_set_person_tier(uuid, text) from public;
revoke all on function atlas.fn_mark_tier_alum(uuid) from public;
revoke all on function atlas.fn_grant_designation(uuid, text) from public;
revoke all on function atlas.fn_revoke_designation(uuid, text) from public;
revoke all on function atlas.fn_my_tier() from public;

grant execute on function atlas.fn_set_person_tier(uuid, text) to authenticated;
grant execute on function atlas.fn_mark_tier_alum(uuid) to authenticated;
grant execute on function atlas.fn_grant_designation(uuid, text) to authenticated;
grant execute on function atlas.fn_revoke_designation(uuid, text) to authenticated;
grant execute on function atlas.fn_my_tier() to authenticated;

notify pgrst, 'reload schema';
