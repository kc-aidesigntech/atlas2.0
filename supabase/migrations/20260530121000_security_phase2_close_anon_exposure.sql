-- Security hardening Phase 2 of 4: close anonymous (anon / logged-out) exposure.
--
-- Two classes of holes are closed here:
--   1. SECURITY DEFINER reporting views that were granted to anon. Because
--      definer views execute as their owner, anon callers received UNSCOPED
--      Protected Health Information (PHI) -- enrollee profiles, the people
--      directory, navigator assignments, etc. We revoke anon from every view
--      that exposes person-level or operational data.
--   2. Base tables that had anon grants (several with full CRUD and no
--      Row-Level Security), e.g. app config, navigator competency/regulation
--      assessments, partner onboarding tables. The public z-code surveys now
--      sit behind the login/signup wall, so partner survey writes are
--      authenticated-only.
--
-- Intentionally still public (anon): z_codes / z_code_headers (reference data
-- shown on public pages) and INSERT into public_referral_intake_events (the
-- public referral form), which keep their existing grants/policies.

-- 1. Revoke anon from PHI / internal definer views.
revoke all on atlas.v_singlepane_enrollee_profiles from anon;
revoke all on atlas.v_singlepane_enrollee_domain_loads from anon;
revoke all on atlas.v_singlepane_enrollee_domain_load_breakdown from anon;
revoke all on atlas.v_people_directory from anon;
revoke all on atlas.v_navigator_assigned_enrollees from anon;
revoke all on atlas.v_navigator_enrollment_requests from anon;
revoke all on atlas.v_navigator_route_candidates from anon;
revoke all on atlas.v_partner_identifier_records from anon;
revoke all on atlas.v_admin_data_quality from anon;
revoke all on atlas.v_county_z_code_heatmap from anon;
revoke all on atlas.v_supervisor_navigator_competency_rollup from anon;
revoke all on atlas.v_partner_station_directory from anon;
revoke all on atlas.v_partner_z_code_burden from anon;
revoke all on atlas.v_partners_page_records from anon;
revoke all on atlas.v_partner_service_capacity_not_encountered from anon;

-- 2. Revoke anon from base tables that should never be reachable logged-out.
revoke all on atlas.navigator_competency_assessments from anon;
revoke all on atlas.navigator_competency_assessment_answers from anon;
revoke all on atlas.navigator_regulation_test_submissions from anon;
revoke all on atlas.navigator_regulation_test_answers from anon;
revoke all on atlas.partner_z_code_capabilities from anon;
revoke all on atlas.partners from anon;
revoke all on atlas.supervisor_navigator_assignments from anon;
revoke all on atlas.partner_service_capacity_submissions from anon;
revoke all on atlas.partner_service_capacity_answers from anon;
revoke all on atlas.partner_z_code_burden_scores from anon;
revoke all on atlas.app_config_documents from anon;
revoke all on atlas.app_role_navigation from anon;

-- 3. Enable RLS on the two config tables so anon is denied even if a future
--    grant is reintroduced.
--    app_config_documents is used as a broad key-value store by authenticated
--    flows (including per-navigator route logs), so authenticated retains full
--    access for now; finer per-document-type scoping is tracked as follow-up.
alter table atlas.app_config_documents enable row level security;
drop policy if exists app_config_documents_authenticated_all on atlas.app_config_documents;
create policy app_config_documents_authenticated_all on atlas.app_config_documents
  for all to authenticated
  using (true)
  with check (true);

--    Navigation config is readable by any authenticated user but only
--    administrators may modify it.
alter table atlas.app_role_navigation enable row level security;
drop policy if exists app_role_navigation_authenticated_select on atlas.app_role_navigation;
create policy app_role_navigation_authenticated_select on atlas.app_role_navigation
  for select to authenticated
  using (true);
drop policy if exists app_role_navigation_admin_write on atlas.app_role_navigation;
create policy app_role_navigation_admin_write on atlas.app_role_navigation
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');
