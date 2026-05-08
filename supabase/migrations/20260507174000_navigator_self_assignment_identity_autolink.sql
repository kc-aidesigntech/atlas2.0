-- Ensure navigator self-assignment can always materialize to an assignment edge:
-- - auto-link auth identity to atlas.people when missing
-- - preserve strict role eligibility via DB roles OR auth claims
-- - keep assignment write idempotent

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
  auth_email text := nullif(lower(coalesce(auth_claims ->> 'email', '')), '');
  auth_atlas_role text := lower(coalesce(auth_claims -> 'app_metadata' ->> 'atlas_role', ''));
  auth_atlas_roles jsonb := coalesce(auth_claims -> 'app_metadata' -> 'atlas_roles', '[]'::jsonb);
  fallback_display_name text := nullif(trim(coalesce(auth_claims -> 'user_metadata' ->> 'full_name', '')), '');
  fallback_first_name text;
  fallback_last_name text;
  current_person_id uuid;
  has_navigator_db_role boolean := false;
  has_navigator_claim_role boolean := false;
begin
  select p.id
  into current_person_id
  from atlas.people p
  where (auth_user_id is not null and p.external_ref = auth_user_id)
     or (auth_email is not null and lower(p.email) = auth_email)
  order by case when auth_user_id is not null and p.external_ref = auth_user_id then 0 else 1 end
  limit 1;

  if current_person_id is null then
    if fallback_display_name is null then
      fallback_display_name := coalesce(nullif(split_part(coalesce(auth_email, ''), '@', 1), ''), 'atlas navigator');
    end if;
    fallback_first_name := coalesce(nullif(split_part(fallback_display_name, ' ', 1), ''), 'atlas');
    fallback_last_name := coalesce(nullif(trim(substring(fallback_display_name from length(fallback_first_name) + 1)), ''), 'navigator');

    insert into atlas.people (
      id,
      external_ref,
      first_name,
      last_name,
      display_name,
      email,
      person_type,
      status
    )
    values (
      gen_random_uuid(),
      auth_user_id,
      fallback_first_name,
      fallback_last_name,
      fallback_display_name,
      auth_email,
      'staff',
      'active'
    )
    on conflict (external_ref) do update
    set
      email = coalesce(atlas.people.email, excluded.email),
      display_name = coalesce(nullif(atlas.people.display_name, ''), excluded.display_name),
      updated_at = now()
    returning id into current_person_id;

    if current_person_id is null and auth_email is not null then
      select p.id
      into current_person_id
      from atlas.people p
      where lower(p.email) = auth_email
      order by p.created_at asc
      limit 1;

      if current_person_id is not null and auth_user_id is not null then
        update atlas.people
        set external_ref = coalesce(external_ref, auth_user_id),
            updated_at = now()
        where id = current_person_id;
      end if;
    end if;
  end if;

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

revoke all on function atlas.fn_navigator_assign_enrollment_to_self(uuid) from public;
grant execute on function atlas.fn_navigator_assign_enrollment_to_self(uuid) to authenticated;

notify pgrst, 'reload schema';
