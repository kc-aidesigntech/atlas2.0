-- Security hardening Phase 6: close two gaps surfaced by the Supabase security
-- advisor after the Row-Level Security (RLS) rollout.
--
-- (A) SECURITY DEFINER enrollee Protected Health Information (PHI) views bypassed
--     the base-table RLS, so any authenticated user read EVERY enrollee through
--     them (verified: a navigator saw all enrollee profiles / the full people
--     directory). Converting these person-level views to security_invoker makes
--     them honor the base-table policies. Verified post-conversion: the navigator
--     is scoped to only their accessible enrollees while administrators still see
--     all rows. Only views whose underlying relations are already readable by the
--     authenticated role are converted here; reporting/ranking definer views that
--     require additional base grants or whose scoping semantics affect app
--     behavior are intentionally left for a dedicated follow-up pass.
--
-- (B) Several base tables had RLS disabled while granting SELECT to authenticated
--     (or anon), exposing unified assessment PHI and internal/reference rows. We
--     enable RLS with policies that match each table's sensitivity.

-- (A) Convert enrollee-PHI definer views to invoker so base-table RLS scopes them.
alter view atlas.v_singlepane_enrollee_profiles set (security_invoker = true);
alter view atlas.v_singlepane_enrollee_domain_loads set (security_invoker = true);
alter view atlas.v_singlepane_enrollee_domain_load_breakdown set (security_invoker = true);
alter view atlas.v_people_directory set (security_invoker = true);

-- (B1) Unified assessment store: PHI scoped to administrators or staff who can
-- access the linked enrollment (covers historical rows with only an enrollee_id).
-- The app does not read these directly; they are written by SECURITY DEFINER sync
-- triggers and read by the warehouse as service_role (bypasses RLS).
alter table atlas.assessment_submissions enable row level security;
drop policy if exists assessment_submissions_select_scoped on atlas.assessment_submissions;
create policy assessment_submissions_select_scoped on atlas.assessment_submissions
  for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or (enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(enrollment_id))
    or (
      enrollment_id is null and enrollee_id is not null and exists (
        select 1 from atlas.enrollments en
        where en.enrollee_id = assessment_submissions.enrollee_id
          and atlas.fn_can_access_enrollment_as_staff(en.id)
      )
    )
  );

alter table atlas.assessment_answers enable row level security;
drop policy if exists assessment_answers_select_scoped on atlas.assessment_answers;
create policy assessment_answers_select_scoped on atlas.assessment_answers
  for select to authenticated
  using (
    exists (
      select 1 from atlas.assessment_submissions s
      where s.id = assessment_answers.assessment_submission_id
        and (
          coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
          or (s.enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(s.enrollment_id))
          or (s.enrollment_id is null and s.enrollee_id is not null and exists (
            select 1 from atlas.enrollments en
            where en.enrollee_id = s.enrollee_id and atlas.fn_can_access_enrollment_as_staff(en.id)
          ))
        )
    )
  );

alter table atlas.assessment_participants enable row level security;
drop policy if exists assessment_participants_select_scoped on atlas.assessment_participants;
create policy assessment_participants_select_scoped on atlas.assessment_participants
  for select to authenticated
  using (
    exists (
      select 1 from atlas.assessment_submissions s
      where s.id = assessment_participants.assessment_submission_id
        and (
          coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
          or (s.enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(s.enrollment_id))
          or (s.enrollment_id is null and s.enrollee_id is not null and exists (
            select 1 from atlas.enrollments en
            where en.enrollee_id = s.enrollee_id and atlas.fn_can_access_enrollment_as_staff(en.id)
          ))
        )
    )
  );

-- (B2) Role assignments are directory-level (who holds which staff role) and are
-- read by the access-matrix UI. Broad authenticated read; writes are already
-- RPC-only (no direct write grant).
alter table atlas.people_role_assignments enable row level security;
drop policy if exists people_role_assignments_authenticated_select on atlas.people_role_assignments;
create policy people_role_assignments_authenticated_select on atlas.people_role_assignments
  for select to authenticated
  using (true);

-- (B3) Reference data: intentionally readable. counties is authenticated-readable;
-- z_codes is public reference shown on logged-out pages, so anon retains read.
alter table atlas.counties enable row level security;
drop policy if exists counties_authenticated_select on atlas.counties;
create policy counties_authenticated_select on atlas.counties
  for select to authenticated
  using (true);

alter table atlas.z_codes enable row level security;
drop policy if exists z_codes_public_select on atlas.z_codes;
create policy z_codes_public_select on atlas.z_codes
  for select to anon, authenticated
  using (true);

-- (B4) Internal registry: not read by the app. Lock to service_role only.
alter table atlas.legacy_decommission_registry enable row level security;
revoke all on atlas.legacy_decommission_registry from anon, authenticated;

-- (B5) Demo tagging metadata is read-only to the app (loadDemoTaggedEnrollmentIds);
-- there is no runtime insert path, so revoke writes and keep scoped read.
alter table atlas.demo_record_tags enable row level security;
revoke insert, update, delete on atlas.demo_record_tags from anon, authenticated;
drop policy if exists demo_record_tags_authenticated_select on atlas.demo_record_tags;
create policy demo_record_tags_authenticated_select on atlas.demo_record_tags
  for select to authenticated
  using (true);

notify pgrst, 'reload schema';
