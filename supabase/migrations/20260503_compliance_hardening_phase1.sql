-- Compliance hardening phase 1:
-- - disable legacy public-write/read rollout toggles by default
-- - remove public profile image mutation policies
-- - move admin access-matrix writes behind guarded RPC functions

insert into atlas.authorization_settings (setting_key, enabled, description)
values
  ('allow_legacy_public_partner_capacity_read', false, 'Legacy public/select access disabled by compliance hardening.'),
  ('allow_legacy_public_partner_capacity_write', false, 'Legacy public/insert-update access disabled by compliance hardening.'),
  ('allow_legacy_public_partner_capacity_delete', false, 'Legacy public/delete access disabled by compliance hardening.')
on conflict (setting_key) do update
set
  enabled = excluded.enabled,
  description = excluded.description,
  updated_at = now();

create or replace function atlas.fn_authz_setting_enabled(
  target_setting_key text,
  fallback_enabled boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = atlas, public
as $$
  -- Compliance posture: missing settings are treated as disabled.
  -- The fallback argument is retained for compatibility but intentionally ignored.
  select coalesce(
    (
      select s.enabled
      from atlas.authorization_settings s
      where s.setting_key = target_setting_key
      limit 1
    ),
    false
  )
$$;

drop policy if exists profile_images_public_insert on atlas.profile_images;
drop policy if exists profile_images_public_update on atlas.profile_images;
drop policy if exists profile_images_public_delete on atlas.profile_images;

drop policy if exists storage_profile_images_public_insert on storage.objects;
drop policy if exists storage_profile_images_public_update on storage.objects;
drop policy if exists storage_profile_images_public_delete on storage.objects;

create or replace function atlas.fn_require_admin_claim()
returns void
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') <> 'administrator' then
    raise exception 'administrator role required'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function atlas.fn_access_matrix_save_person_roles(
  target_person_id uuid,
  target_role_keys text[]
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  normalized_keys text[] := coalesce(target_role_keys, '{}'::text[]);
  next_role_ids uuid[] := '{}'::uuid[];
  primary_role_id uuid;
  enrollee_role_id uuid;
  enrollee_record_id uuid;
begin
  perform atlas.fn_require_admin_claim();

  select coalesce(array_agg(r.id), '{}'::uuid[])
  into next_role_ids
  from atlas.roles r
  where r.role_key = any(normalized_keys);

  update atlas.people_role_assignments pra
  set ends_on = current_date, is_primary = false
  where pra.person_id = target_person_id
    and pra.ends_on is null
    and (
      array_length(next_role_ids, 1) is null
      or not (pra.role_id = any(next_role_ids))
    );

  insert into atlas.people_role_assignments (id, person_id, role_id, is_primary, starts_on, ends_on)
  select gen_random_uuid(), target_person_id, role_id, false, current_date, null
  from unnest(next_role_ids) as role_id
  where not exists (
    select 1
    from atlas.people_role_assignments pra
    where pra.person_id = target_person_id
      and pra.role_id = role_id
      and pra.ends_on is null
  );

  update atlas.people_role_assignments
  set is_primary = false
  where person_id = target_person_id
    and ends_on is null;

  if array_position(normalized_keys, 'administrator') is not null then
    select r.id
    into primary_role_id
    from atlas.roles r
    where r.role_key = 'administrator'
    limit 1;
  else
    select r.id
    into primary_role_id
    from atlas.roles r
    where r.role_key = any(normalized_keys)
    order by r.role_key asc
    limit 1;
  end if;

  if primary_role_id is not null then
    update atlas.people_role_assignments
    set is_primary = true
    where person_id = target_person_id
      and role_id = primary_role_id
      and ends_on is null;
  end if;

  select r.id
  into enrollee_role_id
  from atlas.roles r
  where r.role_key = 'enrollee'
  limit 1;

  if enrollee_role_id is not null and enrollee_role_id = any(next_role_ids) then
    -- Keep role-to-domain joins cohesive: once a person is assigned enrollee role,
    -- ensure they have concrete enrollee/enrollment rows consumed by app selectors.
    insert into atlas.enrollees (person_id, case_id, current_phase)
    values (
      target_person_id,
      'atlas-case-' || substr(md5(target_person_id::text), 1, 12),
      'regulation'
    )
    on conflict (person_id) do nothing;

    select e.id
    into enrollee_record_id
    from atlas.enrollees e
    where e.person_id = target_person_id
    limit 1;

    if enrollee_record_id is not null and not exists (
      select 1
      from atlas.enrollments en
      where en.enrollee_id = enrollee_record_id
        and en.status = 'active'
    ) then
      insert into atlas.enrollments (enrollee_id, start_date, target_duration_months, status)
      values (enrollee_record_id, current_date, 9, 'active');
    end if;
  end if;
end;
$$;

create or replace function atlas.fn_access_matrix_save_enrollment_navigator(
  target_enrollment_id uuid,
  target_navigator_person_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_require_admin_claim();

  if target_navigator_person_id is null then
    update atlas.navigator_assignments
    set ends_on = current_date
    where enrollment_id = target_enrollment_id
      and ends_on is null;
    return;
  end if;

  update atlas.navigator_assignments
  set ends_on = current_date
  where enrollment_id = target_enrollment_id
    and ends_on is null
    and navigator_person_id <> target_navigator_person_id;

  if not exists (
    select 1
    from atlas.navigator_assignments
    where enrollment_id = target_enrollment_id
      and navigator_person_id = target_navigator_person_id
      and ends_on is null
  ) then
    insert into atlas.navigator_assignments (id, enrollment_id, navigator_person_id, starts_on, ends_on, station_id)
    values (gen_random_uuid(), target_enrollment_id, target_navigator_person_id, current_date, null, null);
  end if;
end;
$$;

create or replace function atlas.fn_access_matrix_save_supervisor_assignment(
  target_navigator_person_id uuid,
  target_supervisor_person_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_require_admin_claim();

  if target_supervisor_person_id is null then
    update atlas.supervisor_navigator_assignments
    set ends_on = current_date
    where navigator_person_id = target_navigator_person_id
      and ends_on is null;
    return;
  end if;

  update atlas.supervisor_navigator_assignments
  set ends_on = current_date
  where navigator_person_id = target_navigator_person_id
    and ends_on is null
    and supervisor_person_id <> target_supervisor_person_id;

  if not exists (
    select 1
    from atlas.supervisor_navigator_assignments
    where navigator_person_id = target_navigator_person_id
      and supervisor_person_id = target_supervisor_person_id
      and ends_on is null
  ) then
    insert into atlas.supervisor_navigator_assignments (id, navigator_person_id, supervisor_person_id, starts_on, ends_on)
    values (gen_random_uuid(), target_navigator_person_id, target_supervisor_person_id, current_date, null);
  end if;
end;
$$;

create or replace function atlas.fn_access_matrix_save_partner_primary_contact(
  target_partner_id uuid,
  target_primary_contact_person_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  selected_person record;
begin
  perform atlas.fn_require_admin_claim();

  if target_primary_contact_person_id is null then
    update atlas.partners
    set
      primary_contact_first_name = null,
      primary_contact_last_name = null,
      primary_contact_email = null,
      updated_at = now()
    where id = target_partner_id;
    return;
  end if;

  select p.first_name, p.last_name, p.email
  into selected_person
  from atlas.people p
  where p.id = target_primary_contact_person_id
  limit 1;

  if selected_person is null then
    raise exception 'primary contact person not found'
      using errcode = 'P0002';
  end if;

  update atlas.partners
  set
    primary_contact_first_name = selected_person.first_name,
    primary_contact_last_name = selected_person.last_name,
    primary_contact_email = selected_person.email,
    updated_at = now()
  where id = target_partner_id;
end;
$$;

revoke all on function atlas.fn_require_admin_claim() from public;
revoke all on function atlas.fn_access_matrix_save_person_roles(uuid, text[]) from public;
revoke all on function atlas.fn_access_matrix_save_enrollment_navigator(uuid, uuid) from public;
revoke all on function atlas.fn_access_matrix_save_supervisor_assignment(uuid, uuid) from public;
revoke all on function atlas.fn_access_matrix_save_partner_primary_contact(uuid, uuid) from public;

grant execute on function atlas.fn_require_admin_claim() to authenticated;
grant execute on function atlas.fn_access_matrix_save_person_roles(uuid, text[]) to authenticated;
grant execute on function atlas.fn_access_matrix_save_enrollment_navigator(uuid, uuid) to authenticated;
grant execute on function atlas.fn_access_matrix_save_supervisor_assignment(uuid, uuid) to authenticated;
grant execute on function atlas.fn_access_matrix_save_partner_primary_contact(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
