-- Harden navigator self-assignment for sessions where role edges lag metadata:
-- - keep strict identity mapping to atlas.people
-- - allow navigator eligibility via either active role assignment OR auth app_metadata role claims

create or replace function atlas.fn_navigator_assign_enrollment_to_self(
  target_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  auth_user_id text := nullif(auth.uid()::text, '');
  auth_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  auth_email text := nullif(coalesce(auth_claims ->> 'email', ''), '');
  auth_atlas_role text := lower(coalesce(auth_claims -> 'app_metadata' ->> 'atlas_role', ''));
  auth_atlas_roles jsonb := coalesce(auth_claims -> 'app_metadata' -> 'atlas_roles', '[]'::jsonb);
  current_person_id uuid;
  has_navigator_db_role boolean := false;
  has_navigator_claim_role boolean := false;
begin
  select p.id
  into current_person_id
  from atlas.people p
  where (auth_user_id is not null and p.external_ref = auth_user_id)
     or (auth_email is not null and lower(p.email) = lower(auth_email))
  order by case when auth_user_id is not null and p.external_ref = auth_user_id then 0 else 1 end
  limit 1;

  if current_person_id is null then
    raise exception 'navigator identity is not mapped to atlas.people'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = current_person_id
      and pra.ends_on is null
      and r.role_key = 'navigator'
  )
  into has_navigator_db_role;

  has_navigator_claim_role :=
    auth_atlas_role in ('navigator', 'administrator')
    or exists (
      select 1
      from jsonb_array_elements_text(auth_atlas_roles) as role_value(role_key)
      where lower(role_value.role_key) in ('navigator', 'administrator')
    );

  if not has_navigator_db_role and not has_navigator_claim_role then
    raise exception 'navigator role required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from atlas.enrollments en
    where en.id = target_enrollment_id
      and en.status = 'active'
  ) then
    raise exception 'target enrollment is not active'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from atlas.navigator_assignments na
    where na.enrollment_id = target_enrollment_id
      and na.navigator_person_id = current_person_id
      and na.ends_on is null
  ) then
    return;
  end if;

  insert into atlas.navigator_assignments (
    id,
    enrollment_id,
    navigator_person_id,
    starts_on,
    ends_on,
    station_id
  )
  values (
    gen_random_uuid(),
    target_enrollment_id,
    current_person_id,
    current_date,
    null,
    null
  );
end;
$$;

create or replace function atlas.fn_navigator_unassign_enrollment_from_self(
  target_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  auth_user_id text := nullif(auth.uid()::text, '');
  auth_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  auth_email text := nullif(coalesce(auth_claims ->> 'email', ''), '');
  auth_atlas_role text := lower(coalesce(auth_claims -> 'app_metadata' ->> 'atlas_role', ''));
  auth_atlas_roles jsonb := coalesce(auth_claims -> 'app_metadata' -> 'atlas_roles', '[]'::jsonb);
  current_person_id uuid;
  has_navigator_db_role boolean := false;
  has_navigator_claim_role boolean := false;
begin
  select p.id
  into current_person_id
  from atlas.people p
  where (auth_user_id is not null and p.external_ref = auth_user_id)
     or (auth_email is not null and lower(p.email) = lower(auth_email))
  order by case when auth_user_id is not null and p.external_ref = auth_user_id then 0 else 1 end
  limit 1;

  if current_person_id is null then
    raise exception 'navigator identity is not mapped to atlas.people'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = current_person_id
      and pra.ends_on is null
      and r.role_key = 'navigator'
  )
  into has_navigator_db_role;

  has_navigator_claim_role :=
    auth_atlas_role in ('navigator', 'administrator')
    or exists (
      select 1
      from jsonb_array_elements_text(auth_atlas_roles) as role_value(role_key)
      where lower(role_value.role_key) in ('navigator', 'administrator')
    );

  if not has_navigator_db_role and not has_navigator_claim_role then
    raise exception 'navigator role required'
      using errcode = '42501';
  end if;

  update atlas.navigator_assignments
  set ends_on = current_date
  where enrollment_id = target_enrollment_id
    and navigator_person_id = current_person_id
    and ends_on is null;
end;
$$;

revoke all on function atlas.fn_navigator_assign_enrollment_to_self(uuid) from public;
grant execute on function atlas.fn_navigator_assign_enrollment_to_self(uuid) to authenticated;

revoke all on function atlas.fn_navigator_unassign_enrollment_from_self(uuid) from public;
grant execute on function atlas.fn_navigator_unassign_enrollment_from_self(uuid) to authenticated;

notify pgrst, 'reload schema';
