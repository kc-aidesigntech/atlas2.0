-- =============================================================================
-- Demo phenotype seed verification.
--
-- Asserts the state documented in demo.md after applying
-- supabase/migrations/20260715180000_demo_partner_phenotype_seed.sql and
-- running verification/demo_partner_setup.sql. Every row must report 'pass'.
--
-- Read-only. Run via the Supabase Model Context Protocol (MCP) execute_sql
-- or psql. Acronyms: Domestic Violence (DV), Stress Vulnerability Scale (SVS),
-- Mental Health Self-Care Agency (MH-SCA), Row-Level Security (RLS).
-- =============================================================================

with checks(check_name, ok) as (
  values
  -- ---------------------------------------------------------------------
  -- Partner identity + directory row (what "My Station" resolves against).
  -- ---------------------------------------------------------------------
  ('partner org exists with contact', exists (
    select 1 from atlas.partners
    where organization_name_normalized = 'harborview family advocacy center'
      and primary_contact_email = 'demo.partner@atlas.test'
      and is_active
  )),
  ('station directory row resolves (no fallback data)', exists (
    select 1 from atlas.v_partner_station_directory
    where organization_name_normalized = 'harborview family advocacy center'
      and station_name = 'Harborview Main Station'
      and primary_contact_first_name = 'Harper'
  )),
  ('partner auth login bridged to contact person', exists (
    select 1
    from auth.users u
    join atlas.people p on p.id = u.id
    where u.id = 'de300000-0000-0000-0000-0000000000c1'
      and u.email = 'demo.partner@atlas.test'
      and u.raw_app_meta_data->>'atlas_role' = 'partner'
      and p.display_name = 'Harper Voss'
  )),
  ('RLS bridge: contact supervises demo navigator', exists (
    select 1 from atlas.supervisor_navigator_assignments
    where supervisor_person_id = 'de300000-0000-0000-0000-0000000000c1'
      and navigator_person_id = 'de300000-0000-0000-0000-0000000000b1'
      and ends_on is null
  )),
  ('demo navigator assigned to all 5 enrollments at Harborview station', (
    select count(*) from atlas.navigator_assignments
    where navigator_person_id = 'de300000-0000-0000-0000-0000000000b1'
      and station_id = 'de300000-0000-0000-0000-0000000000a2'
      and ends_on is null
  ) = 5),
  ('partner capability profile seeded (12 specialize edges)', (
    select count(*) from atlas.partner_z_code_capabilities pzc
    join atlas.partners p on p.id = pzc.partner_id
    where p.organization_name_normalized = 'harborview family advocacy center'
      and pzc.relation_type = 'specialize' and pzc.is_active
  ) = 12),

  -- ---------------------------------------------------------------------
  -- Stage spread: one enrollee per deliberate journey status.
  -- ---------------------------------------------------------------------
  ('SV PHX-001 phase = renewal', exists (
    select 1 from atlas.enrollees where case_id = 'PHX-001' and current_phase = 'renewal'
  )),
  ('SP PHX-002 phase = readiness', exists (
    select 1 from atlas.enrollees where case_id = 'PHX-002' and current_phase = 'readiness'
  )),
  ('SA PHX-003 phase = regulation', exists (
    select 1 from atlas.enrollees where case_id = 'PHX-003' and current_phase = 'regulation'
  )),
  ('YP PHX-004 phase = readiness', exists (
    select 1 from atlas.enrollees where case_id = 'PHX-004' and current_phase = 'readiness'
  )),
  ('RR PHX-005 phase = regulation', exists (
    select 1 from atlas.enrollees where case_id = 'PHX-005' and current_phase = 'regulation'
  )),
  ('all 5 enrollments active with staggered starts', (
    select count(distinct start_date) from atlas.enrollments
    where id in (
      'de300000-0000-0000-0000-000000000013','de300000-0000-0000-0000-000000000023',
      'de300000-0000-0000-0000-000000000033','de300000-0000-0000-0000-000000000043',
      'de300000-0000-0000-0000-000000000053')
      and status = 'active'
  ) = 5),

  -- ---------------------------------------------------------------------
  -- Regulation gates (SVS / MH-SCA) per demo.md.
  -- ---------------------------------------------------------------------
  ('SV both gates passed', (
    select count(*) from atlas.navigator_regulation_test_submissions
    where enrollment_id = 'de300000-0000-0000-0000-000000000013'
      and status = 'completed' and passed = true
  ) = 2),
  ('SP both gates passed', (
    select count(*) from atlas.navigator_regulation_test_submissions
    where enrollment_id = 'de300000-0000-0000-0000-000000000023'
      and status = 'completed' and passed = true
  ) = 2),
  ('SA gates split: SVS passed, MH-SCA not passed', exists (
    select 1 from atlas.navigator_regulation_test_submissions svs
    join atlas.navigator_regulation_test_submissions mh
      on mh.enrollment_id = svs.enrollment_id
    where svs.enrollment_id = 'de300000-0000-0000-0000-000000000033'
      and svs.test_type = 'svs' and svs.passed = true
      and mh.test_type = 'mh_sca' and mh.passed = false
  )),
  ('YP both gates passed', (
    select count(*) from atlas.navigator_regulation_test_submissions
    where enrollment_id = 'de300000-0000-0000-0000-000000000043'
      and status = 'completed' and passed = true
  ) = 2),
  ('RR neither gate passed', (
    select count(*) from atlas.navigator_regulation_test_submissions
    where enrollment_id = 'de300000-0000-0000-0000-000000000053'
      and status = 'completed' and passed = false
  ) = 2),
  ('every submission has its 3 catalog answers', (
    select count(*) from atlas.navigator_regulation_test_answers
    where submission_id::text like 'de300000-%'
  ) = 30),

  -- ---------------------------------------------------------------------
  -- Z-code burden status counts per demo.md mapping tables.
  -- ---------------------------------------------------------------------
  ('SV: 10 codes, all resolved with Harborview attribution', (
    select count(*) from atlas.enrollee_z_codes ez
    join atlas.partners p on p.id = ez.resolution_partner_id
    where ez.enrollment_id = 'de300000-0000-0000-0000-000000000013'
      and ez.code_review_status = 'resolved' and ez.is_resolved
      and ez.resolution_at is not null and ez.resolution_note is not null
      and p.organization_name_normalized = 'harborview family advocacy center'
  ) = 10),
  ('SP: 2 resolved / 4 partially / 2 not resolved', (
    select count(*) filter (where code_review_status = 'resolved') = 2
       and count(*) filter (where code_review_status = 'partially_resolved') = 4
       and count(*) filter (where code_review_status = 'not_resolved') = 2
    from atlas.enrollee_z_codes
    where enrollment_id = 'de300000-0000-0000-0000-000000000023' and ended_at is null
  )),
  ('SA: 6 codes, none resolved', (
    select count(*) = 6 and bool_and(code_review_status = 'not_resolved')
    from atlas.enrollee_z_codes
    where enrollment_id = 'de300000-0000-0000-0000-000000000033' and ended_at is null
  )),
  ('YP: 2 partially resolved / 7 not resolved', (
    select count(*) filter (where code_review_status = 'partially_resolved') = 2
       and count(*) filter (where code_review_status = 'not_resolved') = 7
       and count(*) filter (where code_review_status = 'resolved') = 0
    from atlas.enrollee_z_codes
    where enrollment_id = 'de300000-0000-0000-0000-000000000043' and ended_at is null
  )),
  ('RR: 11 codes, none resolved', (
    select count(*) = 11 and bool_and(code_review_status = 'not_resolved')
    from atlas.enrollee_z_codes
    where enrollment_id = 'de300000-0000-0000-0000-000000000053' and ended_at is null
  )),

  -- ---------------------------------------------------------------------
  -- Route plans, stops, and station markers.
  -- ---------------------------------------------------------------------
  ('SV: completed plan, 3 completed station markers', (
    select count(*) from atlas.v_enrollment_station_markers
    where enrollment_id = 'de300000-0000-0000-0000-000000000013'
      and status = 'completed'
      and station_name = 'Harborview Main Station'
  ) = 3),
  ('SP: active plan, 2 completed + 1 active stop', (
    select count(*) filter (where status = 'completed') = 2
       and count(*) filter (where status = 'active') = 1
    from atlas.route_plan_stops
    where route_plan_id = 'de300000-0000-0000-0000-000000000024'
  )),
  ('YP: active plan, 1 completed + 1 active + 1 planned stop', (
    select count(*) filter (where status = 'completed') = 1
       and count(*) filter (where status = 'active') = 1
       and count(*) filter (where status = 'planned') = 1
    from atlas.route_plan_stops
    where route_plan_id = 'de300000-0000-0000-0000-000000000044'
  )),
  ('SA and RR: deliberately no route plans yet', not exists (
    select 1 from atlas.route_plans
    where enrollment_id in ('de300000-0000-0000-0000-000000000033','de300000-0000-0000-0000-000000000053')
  )),

  -- ---------------------------------------------------------------------
  -- Timeline evidence: journey logs and runtime route-log document.
  -- ---------------------------------------------------------------------
  ('journey logs: 9 SV / 6 SP / 3 SA / 5 YP / 3 RR', (
    select count(*) filter (where enrollment_id = 'de300000-0000-0000-0000-000000000013') = 9
       and count(*) filter (where enrollment_id = 'de300000-0000-0000-0000-000000000023') = 6
       and count(*) filter (where enrollment_id = 'de300000-0000-0000-0000-000000000033') = 3
       and count(*) filter (where enrollment_id = 'de300000-0000-0000-0000-000000000043') = 5
       and count(*) filter (where enrollment_id = 'de300000-0000-0000-0000-000000000053') = 3
    from atlas.journey_logs
    where enrollment_id::text like 'de300000-%'
  )),
  ('runtime route_logs document carries all 26 demo entries', (
    select count(*)
    from atlas.app_config_documents doc,
         jsonb_array_elements(doc.payload) entry
    where doc.surface = 'singlepane' and doc.config_key = 'route_logs' and doc.version = 'runtime-v1'
      and entry->>'id' like 'demo-phenotype-%'
  ) = 26),
  ('route assignments exist for SV, SP, YP only', (
    select count(*) from atlas.app_config_documents
    where surface = 'singlepane' and version = 'runtime-v1'
      and config_key in (
        'route_assignment:de300000-0000-0000-0000-000000000012',
        'route_assignment:de300000-0000-0000-0000-000000000022',
        'route_assignment:de300000-0000-0000-0000-000000000042')
  ) = 3 and not exists (
    select 1 from atlas.app_config_documents
    where surface = 'singlepane' and version = 'runtime-v1'
      and config_key in (
        'route_assignment:de300000-0000-0000-0000-000000000032',
        'route_assignment:de300000-0000-0000-0000-000000000052')
  )),
  ('timeline settings + config docs for all 5', (
    (select count(*) from atlas.timeline_settings
      where enrollment_id::text like 'de300000-%') = 5
    and
    (select count(*) from atlas.app_config_documents
      where surface = 'singlepane' and version = 'runtime-v1'
        and config_key like 'timeline_config:%de300000-%') = 10
  )),

  -- ---------------------------------------------------------------------
  -- Referral provenance: intake events + canonical referrals -> Harborview.
  -- ---------------------------------------------------------------------
  ('5 claimed intake events attributed to Harborview', (
    select count(*) from atlas.public_referral_intake_events
    where external_record_id like 'demo-phenotype-%-referral'
      and payload->>'status' = 'claimed'
      and payload->>'referrerOrganization' = 'Harborview Family Advocacy Center'
      and payload->>'claimedByNavigatorName' = 'Devon Marsh'
  ) = 5),
  ('5 canonical referrals at the Harborview station', (
    select count(*) from atlas.referrals
    where enrollment_id::text like 'de300000-%'
      and station_id = 'de300000-0000-0000-0000-0000000000a2'
      and referred_by_person_id = 'de300000-0000-0000-0000-0000000000c1'
  ) = 5),

  -- ---------------------------------------------------------------------
  -- Demo tags: partner-role scoping + teardown enumeration.
  -- ---------------------------------------------------------------------
  ('atlas_demo enrollment tags scope the partner strip to all 5', (
    select count(*) from atlas.demo_record_tags
    where tag = 'atlas_demo' and record_type = 'enrollments'
      and record_id::text like 'de300000-%'
  ) = 5),
  ('full fixture tagged for teardown (19 tag rows)', (
    select count(*) from atlas.demo_record_tags
    where tag = 'atlas_demo'
      and metadata->>'fixture' = 'demo_partner_phenotype_seed'
  ) = 19)
)
select check_name, case when ok then 'pass' else 'FAIL' end as result
from checks
order by (case when ok then 1 else 0 end), check_name;
