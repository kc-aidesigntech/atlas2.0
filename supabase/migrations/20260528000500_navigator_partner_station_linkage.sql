-- Navigator partner-station linkage foundation:
-- - add a durable mapping between navigator identities and partner organizations
-- - seed the Lucid Industries partner baseline and map current navigators
-- - expose a secure self-service read helper for station context resolution
-- - extend partner-scope access checks so linked navigators can read their station context

create table if not exists atlas.navigator_partner_assignments (
  id uuid primary key default gen_random_uuid(),
  navigator_person_id uuid not null references atlas.people(id) on delete cascade,
  partner_id uuid not null references atlas.partners(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (navigator_person_id, partner_id, starts_on)
);

create index if not exists idx_navigator_partner_assignments_partner
  on atlas.navigator_partner_assignments (partner_id, starts_on desc);
create index if not exists idx_navigator_partner_assignments_navigator
  on atlas.navigator_partner_assignments (navigator_person_id, starts_on desc);
create unique index if not exists ux_navigator_partner_assignments_active_navigator
  on atlas.navigator_partner_assignments (navigator_person_id)
  where ends_on is null;

with lucid_partner as (
  insert into atlas.partners (
    organization_name,
    organization_name_normalized,
    is_active
  )
  values (
    'lucid industries',
    'lucid industries',
    true
  )
  on conflict (organization_name_normalized) do update
  set
    organization_name = excluded.organization_name,
    is_active = true,
    updated_at = now()
  returning id
),
resolved_lucid_partner as (
  select id from lucid_partner
  union all
  select p.id
  from atlas.partners p
  where p.organization_name_normalized = 'lucid industries'
  limit 1
)
insert into atlas.partner_stations (
  partner_id,
  station_name,
  capacity_total,
  capacity_available,
  is_active
)
select
  rlp.id,
  'Lucid Industries Main Station',
  0,
  0,
  true
from resolved_lucid_partner rlp
where not exists (
  select 1
  from atlas.partner_stations ps
  where ps.partner_id = rlp.id
    and lower(ps.station_name) = lower('Lucid Industries Main Station')
);

update atlas.navigator_partner_assignments npa
set ends_on = current_date
from atlas.people_role_assignments pra
join atlas.roles r on r.id = pra.role_id
join atlas.partners lucid on lucid.organization_name_normalized = 'lucid industries'
where r.role_key = 'navigator'
  and pra.ends_on is null
  and npa.navigator_person_id = pra.person_id
  and npa.ends_on is null
  and npa.partner_id <> lucid.id;

insert into atlas.navigator_partner_assignments (
  navigator_person_id,
  partner_id,
  starts_on,
  ends_on
)
select
  pra.person_id,
  p.id,
  current_date,
  null
from atlas.people_role_assignments pra
join atlas.roles r
  on r.id = pra.role_id
join atlas.partners p
  on p.organization_name_normalized = 'lucid industries'
where r.role_key = 'navigator'
  and pra.ends_on is null
  and not exists (
    select 1
    from atlas.navigator_partner_assignments existing
    where existing.navigator_person_id = pra.person_id
      and existing.ends_on is null
  );

create or replace function atlas.fn_get_my_navigator_station_context()
returns table (
  partner_id uuid,
  organization_name text,
  station_id uuid,
  station_name text,
  county_name text
)
language sql
stable
security definer
set search_path = atlas, public
as $$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  ),
  active_assignment as (
    select
      npa.partner_id
    from atlas.navigator_partner_assignments npa
    join current_person cp
      on cp.person_id = npa.navigator_person_id
    where npa.ends_on is null
    order by npa.starts_on desc, npa.created_at desc
    limit 1
  )
  select
    p.id as partner_id,
    p.organization_name,
    station.station_id,
    station.station_name,
    station.county_name
  from active_assignment assignment
  join atlas.partners p on p.id = assignment.partner_id
  left join lateral (
    select
      ps.id as station_id,
      ps.station_name,
      c.county_name
    from atlas.partner_stations ps
    left join atlas.counties c on c.id = ps.county_id
    where ps.partner_id = p.id
      and ps.is_active = true
    order by ps.created_at asc
    limit 1
  ) station on true;
$$;

revoke all on function atlas.fn_get_my_navigator_station_context() from public;
grant execute on function atlas.fn_get_my_navigator_station_context() to authenticated;

create or replace function atlas.fn_can_access_partner_scope(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  )
  select
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or (
      target_partner_id is not null
      and exists (
        select 1
        from current_person cp
        where cp.person_id is not null
          and (
            exists (
              select 1
              from atlas.v_active_partner_contact_edges pca
              where pca.partner_id = target_partner_id
                and pca.contact_person_id = cp.person_id
            )
            or exists (
              select 1
              from atlas.partners part
              join atlas.people person on person.id = cp.person_id
              where part.id = target_partner_id
                and part.primary_contact_email is not null
                and person.email is not null
                and lower(part.primary_contact_email) = lower(person.email)
            )
            or exists (
              select 1
              from atlas.navigator_partner_assignments npa
              where npa.partner_id = target_partner_id
                and npa.navigator_person_id = cp.person_id
                and npa.ends_on is null
            )
          )
      )
    );
$$;

revoke all on function atlas.fn_can_access_partner_scope(uuid) from public;
grant execute on function atlas.fn_can_access_partner_scope(uuid) to authenticated;

create or replace function atlas.fn_access_matrix_save_navigator_partner_assignment(
  target_navigator_person_id uuid,
  target_partner_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_require_admin_claim();

  if target_partner_id is null then
    update atlas.navigator_partner_assignments
    set ends_on = current_date
    where navigator_person_id = target_navigator_person_id
      and ends_on is null;
    return;
  end if;

  update atlas.navigator_partner_assignments
  set ends_on = current_date
  where navigator_person_id = target_navigator_person_id
    and ends_on is null
    and partner_id <> target_partner_id;

  if not exists (
    select 1
    from atlas.navigator_partner_assignments existing
    where existing.navigator_person_id = target_navigator_person_id
      and existing.partner_id = target_partner_id
      and existing.ends_on is null
  ) then
    insert into atlas.navigator_partner_assignments (
      navigator_person_id,
      partner_id,
      starts_on,
      ends_on
    )
    values (
      target_navigator_person_id,
      target_partner_id,
      current_date,
      null
    );
  end if;
end;
$$;

revoke all on function atlas.fn_access_matrix_save_navigator_partner_assignment(uuid, uuid) from public;
grant execute on function atlas.fn_access_matrix_save_navigator_partner_assignment(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
