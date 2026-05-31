-- Performance: administrator fast-path for fn_can_access_enrollment_as_staff.
--
-- Context: Phase 6 enabled Row-Level Security (RLS) on atlas.people and added the
-- people_directory_select policy whose USING clause runs
--   EXISTS (... atlas.fn_can_access_enrollment_as_staff(en.id))
-- per candidate person row. RLS-heavy bootstrap views (v_active_enrollment_roster,
-- v_enrollment_assignment_board) therefore invoked this STABLE helper O(people x
-- enrollments) times. Each call ran two correlated assignment/supervisor lookups,
-- pushing the warm runtime to ~2.2s and the cold runtime past the authenticated
-- role's 8s statement_timeout -- so PostgREST returned HTTP 500 (Postgres 57014,
-- "canceling statement due to statement timeout") and the workspace bootstrap
-- failed loudly for every signed-in user.
--
-- Fix: administrators already have full staff access (people_admin_all + the
-- explicit administrator branch wherever this helper is OR'd). Short-circuit that
-- case with a CASE expression (guaranteed lazy ELSE evaluation) so the expensive
-- assignment/supervisor EXISTS subqueries are skipped entirely for admins. This is
-- semantics-preserving: a true result for an administrator matches the existing
-- administrator carve-outs, and non-administrator evaluation is byte-for-byte the
-- prior logic. Measured admin roster runtime dropped from ~2223ms to ~33ms.
create or replace function atlas.fn_can_access_enrollment_as_staff(target_enrollment_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'atlas', 'public'
as $function$
  select case
    -- Administrator fast-path: full staff access, skip per-row assignment lookups.
    when coalesce(((auth.jwt() -> 'app_metadata') ->> 'atlas_role'), '') = 'administrator' then true
    else exists (
      with current_person as (
        select atlas.fn_current_person_id() as person_id
      )
      select 1
      from current_person cp
      where cp.person_id is not null
        and (
          -- Navigator assignment scope.
          exists (
            select 1
            from atlas.navigator_assignments na
            where na.enrollment_id = target_enrollment_id
              and na.navigator_person_id = cp.person_id
              and na.ends_on is null
          )
          or
          -- Supervisor scope through active navigator edges.
          exists (
            select 1
            from atlas.navigator_assignments na
            join atlas.supervisor_navigator_assignments sna
              on sna.navigator_person_id = na.navigator_person_id
             and sna.ends_on is null
            where na.enrollment_id = target_enrollment_id
              and na.ends_on is null
              and sna.supervisor_person_id = cp.person_id
          )
        )
    )
  end;
$function$;
