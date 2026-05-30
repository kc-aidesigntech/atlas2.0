-- Security hardening Phase 3: navigator competency assessments.
--
-- The previous client flow created atlas.people rows and people_role_assignments
-- by display name (with role-conflict detection) directly from the browser,
-- then inserted the assessment + answers. After Phase 1, people writes are
-- administrator-only, so that flow only worked with elevated privileges. We move
-- the whole operation behind a validated SECURITY DEFINER command RPC, which:
--   * gates the caller to administrator or an active supervisor,
--   * resolves/creates the supervisor + navigator staff identities server-side
--     (preserving the "one active role per person" invariant), and
--   * inserts the assessment + answers atomically.
-- Direct writes to the competency tables are then revoked (RPC-only writes) and
-- scoped-read RLS is enabled.

-- Resolve a staff person by display name for a given role, creating the person
-- and role assignment when needed. Raises on a conflicting active role so a
-- single identity cannot represent two roles (mirrors the prior client guard).
create or replace function atlas.fn_ensure_staff_person(p_display_name text, p_role_key text)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_name text := nullif(btrim(p_display_name), '');
  v_role_id uuid;
  v_person_id uuid;
  v_existing_role text;
  v_first text;
  v_last text;
begin
  if v_name is null then
    raise exception '% name is required', p_role_key using errcode = '22023';
  end if;

  select id into v_role_id from atlas.roles where role_key = p_role_key limit 1;
  if v_role_id is null then
    raise exception 'role % is not configured in atlas.roles', p_role_key using errcode = '22023';
  end if;

  -- Already holds the requested active role?
  select p.id into v_person_id
  from atlas.people p
  join atlas.people_role_assignments pra on pra.person_id = p.id and pra.ends_on is null
  join atlas.roles r on r.id = pra.role_id and r.role_key = p_role_key
  where p.display_name = v_name
  limit 1;
  if v_person_id is not null then
    return v_person_id;
  end if;

  -- Holds a different active role -> conflict.
  select r.role_key into v_existing_role
  from atlas.people p
  join atlas.people_role_assignments pra on pra.person_id = p.id and pra.ends_on is null
  join atlas.roles r on r.id = pra.role_id and r.role_key <> p_role_key
  where p.display_name = v_name
  limit 1;
  if v_existing_role is not null then
    raise exception '% is already assigned as %. Each person can only hold one role.', v_name, v_existing_role
      using errcode = '23505';
  end if;

  -- Find or create the person record.
  select id into v_person_id from atlas.people where display_name = v_name limit 1;
  if v_person_id is null then
    v_first := case when position(' ' in v_name) > 0
      then btrim(substr(v_name, 1, length(v_name) - position(' ' in reverse(v_name))))
      else v_name end;
    v_last := case when position(' ' in v_name) > 0
      then btrim(substr(v_name, length(v_name) - position(' ' in reverse(v_name)) + 2))
      else 'operator' end;
    insert into atlas.people (first_name, last_name, display_name, person_type, status)
    values (coalesce(nullif(v_first, ''), v_name), coalesce(nullif(v_last, ''), 'operator'), v_name, 'staff', 'active')
    returning id into v_person_id;
  end if;

  -- Attach the role when the person has no active assignment yet.
  if not exists (
    select 1 from atlas.people_role_assignments where person_id = v_person_id and ends_on is null
  ) then
    insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on, ends_on)
    values (v_person_id, v_role_id, true, current_date, null);
  end if;

  return v_person_id;
end;
$$;

create or replace function atlas.fn_save_navigator_competency_assessment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  v_person uuid := atlas.fn_current_person_id();
  v_supervisor_id uuid;
  v_navigator_id uuid;
  v_assessment_id uuid;
begin
  -- Only administrators or active supervisors may record competency assessments.
  if not (
    v_is_admin
    or exists (
      select 1
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
      where pra.person_id = v_person
        and pra.ends_on is null
        and r.role_key in ('supervisor', 'administrator')
    )
  ) then
    raise exception 'only supervisors or administrators may record competency assessments'
      using errcode = '42501';
  end if;

  v_supervisor_id := atlas.fn_ensure_staff_person(payload ->> 'supervisorName', 'supervisor');
  v_navigator_id := atlas.fn_ensure_staff_person(payload ->> 'navigatorName', 'navigator');

  insert into atlas.navigator_competency_assessments (
    supervisor_person_id, navigator_person_id, form_version, assessed_at
  ) values (
    v_supervisor_id, v_navigator_id, coalesce(nullif(payload ->> 'formVersion', ''), 'v1'), now()
  )
  returning id into v_assessment_id;

  insert into atlas.navigator_competency_assessment_answers (
    assessment_id, parent_code, z_code, normalized_z_code, title, description, competency_score
  )
  select
    v_assessment_id,
    a ->> 'parentCode',
    a ->> 'parentCode',
    a ->> 'parentCode',
    a ->> 'theme',
    a ->> 'theme',
    (a ->> 'score')::integer
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb)) as a;

  return v_assessment_id;
end;
$$;

-- Scoped-read RLS: administrators, the assessing supervisor, or the assessed
-- navigator may read.
alter table atlas.navigator_competency_assessments enable row level security;
drop policy if exists navigator_competency_assessments_select_scoped on atlas.navigator_competency_assessments;
create policy navigator_competency_assessments_select_scoped on atlas.navigator_competency_assessments
  for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or supervisor_person_id = atlas.fn_current_person_id()
    or navigator_person_id = atlas.fn_current_person_id()
  );

alter table atlas.navigator_competency_assessment_answers enable row level security;
drop policy if exists navigator_competency_assessment_answers_select_scoped on atlas.navigator_competency_assessment_answers;
create policy navigator_competency_assessment_answers_select_scoped on atlas.navigator_competency_assessment_answers
  for select to authenticated
  using (
    exists (
      select 1
      from atlas.navigator_competency_assessments a
      where a.id = navigator_competency_assessment_answers.assessment_id
        and (
          coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
          or a.supervisor_person_id = atlas.fn_current_person_id()
          or a.navigator_person_id = atlas.fn_current_person_id()
        )
    )
  );

-- RPC-only writes.
revoke insert, update, delete on atlas.navigator_competency_assessments from authenticated;
revoke insert, update, delete on atlas.navigator_competency_assessment_answers from authenticated;

-- The helper creates people/role rows, so it must NOT be directly callable.
-- Postgres grants EXECUTE to PUBLIC by default; revoke it so the helper is only
-- reachable indirectly via the gated SECURITY DEFINER command RPC (which runs as
-- the function owner).
revoke execute on function atlas.fn_ensure_staff_person(text, text) from public;
revoke execute on function atlas.fn_save_navigator_competency_assessment(jsonb) from public;
grant execute on function atlas.fn_save_navigator_competency_assessment(jsonb) to authenticated;
