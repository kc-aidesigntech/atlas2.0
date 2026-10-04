-- Workspace freshness index.
--
-- The single-pane shell was reloading every collection on each open. This
-- function returns one small revision per visible enrollment, plus two clocks
-- for navigation and config documents, so the client can keep the last load
-- and download a record only when its revision changed.
--
-- Scope matches atlas.fn_list_active_enrollment_roster(): SECURITY DEFINER,
-- set-based staff access (administrator, assigned navigator, supervising
-- supervisor). It does not return enrollee names or notes — only ids and a
-- hash — and it does not widen who can see an enrollment.

create or replace function atlas.fn_workspace_record_revisions()
returns table (
  dataset text,
  record_id text,
  revision text
)
language sql
stable
security definer
set search_path to 'atlas', 'public'
as $function$
  with current_person as (
    select atlas.fn_current_person_id() as person_id
  ),
  is_admin as (
    select coalesce(((auth.jwt() -> 'app_metadata') ->> 'atlas_role'), '') = 'administrator' as value
  ),
  accessible_enrollments as (
    select en.id as enrollment_id
    from atlas.enrollments en
    cross join is_admin ia
    where en.status = 'active'
      and ia.value

    union

    select na.enrollment_id
    from atlas.navigator_assignments na
    cross join current_person cp
    cross join is_admin ia
    where not ia.value
      and cp.person_id is not null
      and na.navigator_person_id = cp.person_id
      and na.ends_on is null

    union

    select na.enrollment_id
    from atlas.navigator_assignments na
    join atlas.supervisor_navigator_assignments sna
      on sna.navigator_person_id = na.navigator_person_id
     and sna.ends_on is null
    cross join current_person cp
    cross join is_admin ia
    where not ia.value
      and cp.person_id is not null
      and sna.supervisor_person_id = cp.person_id
      and na.ends_on is null
  ),
  z_code_fingerprints as (
    select
      ez.enrollment_id,
      md5(string_agg(
        concat_ws(
          ':',
          ez.id::text,
          ez.z_code_id::text,
          coalesce(ez.is_resolved, false)::text,
          coalesce(ez.resolution_at::text, ''),
          coalesce(ez.ended_at::text, ''),
          coalesce(ez.effective_at::text, ''),
          coalesce(ez.resolution_note, ''),
          coalesce(ez.code_review_status, ''),
          coalesce(ez.confidence_level::text, '')
        ),
        ',' order by ez.id
      )) as fingerprint
    from atlas.enrollee_z_codes ez
    join accessible_enrollments ae on ae.enrollment_id = ez.enrollment_id
    group by ez.enrollment_id
  ),
  navigator_fingerprints as (
    select
      na.enrollment_id,
      md5(string_agg(
        concat_ws(
          ':',
          na.navigator_person_id::text,
          coalesce(na.starts_on::text, ''),
          coalesce(na.ends_on::text, '')
        ),
        ',' order by na.navigator_person_id
      )) as fingerprint
    from atlas.navigator_assignments na
    join accessible_enrollments ae on ae.enrollment_id = na.enrollment_id
    group by na.enrollment_id
  )
  select
    'enrollment'::text as dataset,
    en.id::text as record_id,
    md5(concat_ws(
      '|',
      coalesce(en.status, ''),
      coalesce(en.start_date::text, ''),
      coalesce(en.target_duration_months::text, ''),
      coalesce(e.current_phase, ''),
      coalesce(e.case_id, ''),
      coalesce(e.dob::text, ''),
      coalesce(e.avatar_url, ''),
      coalesce(e.updated_at::text, ''),
      coalesce(p.display_name, ''),
      coalesce(p.email, ''),
      coalesce(p.updated_at::text, ''),
      coalesce(z_code_fingerprints.fingerprint, ''),
      coalesce(navigator_fingerprints.fingerprint, '')
    )) as revision
  from atlas.enrollments en
  join accessible_enrollments ae on ae.enrollment_id = en.id
  join atlas.enrollees e on e.id = en.enrollee_id
  join atlas.people p on p.id = e.person_id
  left join z_code_fingerprints on z_code_fingerprints.enrollment_id = en.id
  left join navigator_fingerprints on navigator_fingerprints.enrollment_id = en.id
  where en.status = 'active'

  union all

  select
    'role_navigation'::text,
    'singlepane'::text,
    coalesce(max(updated_at)::text, '')
  from atlas.app_role_navigation
  where surface = 'singlepane'

  union all

  select
    'app_config'::text,
    'singlepane'::text,
    coalesce(max(updated_at)::text, '')
  from atlas.app_config_documents
  where surface = 'singlepane';
$function$;

revoke all on function atlas.fn_workspace_record_revisions() from public;
grant execute on function atlas.fn_workspace_record_revisions() to authenticated;

-- Same roster contract as the zero-argument function, limited to the ids the
-- client already knows changed. The zero-argument function stays the source
-- of the full list so this filter cannot drift from the workspace columns.
create or replace function atlas.fn_list_active_enrollment_roster(p_enrollment_ids uuid[])
returns table (
  enrollment_id uuid,
  enrollment_status text,
  start_date date,
  target_duration_months integer,
  enrollee_id uuid,
  enrollee_person_id uuid,
  enrollee_name text,
  enrollee_email text,
  case_id text,
  current_phase text,
  county_id uuid,
  county_name text,
  dob text,
  avatar_url text,
  navigator_person_ids uuid[],
  navigator_names text[],
  assigned_navigator text,
  z_code_tags text[],
  active_z_code_details jsonb,
  completed_parent_codes text[]
)
language sql
stable
security definer
set search_path to 'atlas', 'public'
as $function$
  select roster.*
  from atlas.fn_list_active_enrollment_roster() roster
  where roster.enrollment_id = any(p_enrollment_ids);
$function$;

revoke all on function atlas.fn_list_active_enrollment_roster(uuid[]) from public;
grant execute on function atlas.fn_list_active_enrollment_roster(uuid[]) to authenticated;
