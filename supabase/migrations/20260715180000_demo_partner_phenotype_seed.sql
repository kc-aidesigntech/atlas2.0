-- Demo partner phenotype seed.
--
-- Plan-of-record: demo.md at the repository root. Every row below is the
-- verbatim data-model mapping documented there for the demo partner
-- "Harborview Family Advocacy Center" and its five phenotype participants:
--   PHX-001 SV     Stress-Vulnerable / Domestic Violence (DV) Survivor  -> renewal (full arc)
--   PHX-002 SP     Subthreshold Psychosis (pre-conversion)              -> readiness, late
--   PHX-003 SA     Spiritually Active (spiritual emergency)             -> regulation, stabilizing
--   PHX-004 YP-FEP Young Person, First-Episode Psychosis                -> readiness, early
--   PHX-005 RR     Restorative Risk (DV offender / gang-involved)       -> regulation, entry
--
-- Design notes:
-- - Idempotent by fixed identifiers: all rows use deterministic Universally
--   Unique Identifiers (UUIDs) in the de300000-... range, and the migration
--   deletes/rebuilds only records scoped to those identifiers, so re-running
--   in any environment converges to the same state.
-- - No auth writes here. The demo partner login (demo.partner@atlas.test) is
--   provisioned by verification/demo_partner_setup.sql, which reuses the
--   contact person id seeded below via the identity-bridge trigger.
-- - Row-Level Security (RLS) visibility: the partner contact supervises the
--   demo navigator (supervisor_navigator_assignments edge), which is what
--   grants read access to these enrollments through
--   atlas.fn_can_access_enrollment_as_staff for the invoker views.
-- - Instruments without schema homes (Danger Assessment, Inventory of
--   Psychosocial Functioning (IPF), Level of Service / Case Management
--   Inventory (LS/CMI), allostatic load, Pocket Guide) are modeled as dated
--   timeline entries (journey_logs + the runtime route_logs config document),
--   exactly as documented in demo.md.

-- ---------------------------------------------------------------------------
-- 0) Fixed identifier reference (mirrors demo.md):
--    partner                de300000-0000-0000-0000-0000000000a1
--    station                de300000-0000-0000-0000-0000000000a2
--    station icon           de300000-0000-0000-0000-0000000000a3
--    station metric snap    de300000-0000-0000-0000-0000000000a4
--    navigator Devon Marsh  de300000-0000-0000-0000-0000000000b1
--    partner contact Harper de300000-0000-0000-0000-0000000000c1
--    SV  person/enrollee/enrollment  ...0011 / ...0012 / ...0013
--    SP                              ...0021 / ...0022 / ...0023
--    SA                              ...0031 / ...0032 / ...0033
--    YP                              ...0041 / ...0042 / ...0043
--    RR                              ...0051 / ...0052 / ...0053
--    route plans: SV ...0014, SP ...0024, YP ...0044
--    stops: SV ...0015-0017, SP ...0025-0027, YP ...0045-0047
--    regulation submissions: {SV 0018/0019, SP 0028/0029, SA 0038/0039,
--                             YP 0048/0049, RR 0058/0059} (mh_sca/svs)
--    journey logs: SV 0111-0119, SP 0121-0126, SA 0131-0133,
--                  YP 0141-0145, RR 0151-0153
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1) Clean re-seed preamble: remove prior demo phenotype rows (children first)
--    scoped strictly to the fixed identifiers so re-runs converge.
--    Deleting the enrollments cascades enrollee_z_codes, referrals,
--    route_plans/stops, journey_logs, timeline_settings, and
--    navigator_assignments via existing foreign keys.
-- ---------------------------------------------------------------------------
delete from atlas.navigator_regulation_test_answers
 where submission_id in (
   'de300000-0000-0000-0000-000000000018','de300000-0000-0000-0000-000000000019',
   'de300000-0000-0000-0000-000000000028','de300000-0000-0000-0000-000000000029',
   'de300000-0000-0000-0000-000000000038','de300000-0000-0000-0000-000000000039',
   'de300000-0000-0000-0000-000000000048','de300000-0000-0000-0000-000000000049',
   'de300000-0000-0000-0000-000000000058','de300000-0000-0000-0000-000000000059'
 );
delete from atlas.navigator_regulation_test_submissions
 where id in (
   'de300000-0000-0000-0000-000000000018','de300000-0000-0000-0000-000000000019',
   'de300000-0000-0000-0000-000000000028','de300000-0000-0000-0000-000000000029',
   'de300000-0000-0000-0000-000000000038','de300000-0000-0000-0000-000000000039',
   'de300000-0000-0000-0000-000000000048','de300000-0000-0000-0000-000000000049',
   'de300000-0000-0000-0000-000000000058','de300000-0000-0000-0000-000000000059'
 );
delete from atlas.enrollments
 where id in (
   'de300000-0000-0000-0000-000000000013','de300000-0000-0000-0000-000000000023',
   'de300000-0000-0000-0000-000000000033','de300000-0000-0000-0000-000000000043',
   'de300000-0000-0000-0000-000000000053'
 );
delete from atlas.station_metric_snapshots
 where id = 'de300000-0000-0000-0000-0000000000a4';

-- ---------------------------------------------------------------------------
-- 2) Demo partner, station, icon, capability profile.
--    Partner id is fixed, but the normalized-name unique constraint is the
--    conflict target so an existing Harborview row (any id) is updated
--    in place instead of erroring; downstream references resolve the id by
--    normalized name for the same reason.
-- ---------------------------------------------------------------------------
insert into atlas.partners (
  id, organization_name, organization_name_normalized, is_active,
  primary_contact_first_name, primary_contact_last_name, primary_contact_email
)
values (
  'de300000-0000-0000-0000-0000000000a1',
  'Harborview Family Advocacy Center',
  'harborview family advocacy center',
  true,
  'Harper', 'Voss', 'demo.partner@atlas.test'
)
on conflict (organization_name_normalized) do update
set organization_name = excluded.organization_name,
    is_active = true,
    primary_contact_first_name = excluded.primary_contact_first_name,
    primary_contact_last_name = excluded.primary_contact_last_name,
    primary_contact_email = excluded.primary_contact_email,
    updated_at = now();

insert into atlas.partner_stations (
  id, partner_id, station_name, capacity_total, capacity_available, is_active
)
select
  'de300000-0000-0000-0000-0000000000a2',
  p.id,
  'Harborview Main Station',
  12,
  7,
  true
from atlas.partners p
where p.organization_name_normalized = 'harborview family advocacy center'
on conflict (id) do update
set station_name = excluded.station_name,
    capacity_total = excluded.capacity_total,
    capacity_available = excluded.capacity_available,
    is_active = true;

insert into atlas.partner_station_icons (id, station_id, icon_slug, is_primary)
values ('de300000-0000-0000-0000-0000000000a3', 'de300000-0000-0000-0000-0000000000a2', 'social', true)
on conflict (id) do update
set icon_slug = excluded.icon_slug,
    is_primary = excluded.is_primary;

-- DV-focused capability profile (demo.md "Station capability profile"):
-- burden scores 1-9 with strength = score / 9.0, mirrored to the
-- capability edges the radial load and route ranking read.
with harborview as (
  select id from atlas.partners
  where organization_name_normalized = 'harborview family advocacy center'
),
capability_scores(z_code, burden_score) as (
  values
    ('Z65.4', 9), ('Z59.0', 8), ('Z59.1', 8), ('Z63.0', 8),
    ('Z60.4', 7), ('Z59.6', 7), ('Z59.7', 7), ('Z56.0', 7),
    ('Z56.6', 6), ('Z55.2', 6), ('Z60.2', 6), ('Z60.0', 6)
)
insert into atlas.partner_z_code_burden_scores (
  partner_id, z_code_id, z_code, burden_score, derived_relation_type, strength
)
select h.id, z.id, z.z_code, cs.burden_score, 'specialize', round(cs.burden_score / 9.0, 4)
from harborview h
join capability_scores cs on true
join atlas.z_codes z on upper(z.z_code) = cs.z_code
on conflict (partner_id, z_code_id) do update
set burden_score = excluded.burden_score,
    derived_relation_type = excluded.derived_relation_type,
    strength = excluded.strength,
    updated_at = now();

with harborview as (
  select id from atlas.partners
  where organization_name_normalized = 'harborview family advocacy center'
),
capability_scores(z_code, burden_score) as (
  values
    ('Z65.4', 9), ('Z59.0', 8), ('Z59.1', 8), ('Z63.0', 8),
    ('Z60.4', 7), ('Z59.6', 7), ('Z59.7', 7), ('Z56.0', 7),
    ('Z56.6', 6), ('Z55.2', 6), ('Z60.2', 6), ('Z60.0', 6)
)
insert into atlas.partner_z_code_capabilities (
  partner_id, z_code_id, relation_type, strength, source, is_active
)
select h.id, z.id, 'specialize', round(cs.burden_score / 9.0, 4), 'survey', true
from harborview h
join capability_scores cs on true
join atlas.z_codes z on upper(z.z_code) = cs.z_code
on conflict (partner_id, z_code_id, relation_type, source) do update
set strength = excluded.strength,
    is_active = true;

-- ---------------------------------------------------------------------------
-- 3) Staff identities: demo navigator (Devon Marsh) and the partner contact
--    (Harper Voss). Harper's person id equals the auth user id created later
--    by verification/demo_partner_setup.sql, so the identity-bridge trigger
--    merges into this row instead of duplicating it.
-- ---------------------------------------------------------------------------
insert into atlas.people (id, external_ref, first_name, last_name, display_name, email, person_type, status)
values
  ('de300000-0000-0000-0000-0000000000b1', 'demo-phenotype-navigator', 'Devon', 'Marsh', 'Devon Marsh', 'demo.navigator@atlas.test', 'staff', 'active'),
  ('de300000-0000-0000-0000-0000000000c1', 'demo-phenotype-partner-contact', 'Harper', 'Voss', 'Harper Voss', 'demo.partner@atlas.test', 'staff', 'active')
on conflict (id) do update
set first_name = excluded.first_name,
    last_name = excluded.last_name,
    display_name = excluded.display_name,
    email = excluded.email,
    person_type = excluded.person_type,
    status = 'active',
    updated_at = now();

-- Role edges honor the active-uniqueness partial indexes: inserted only when
-- no active edge exists for that person+role, and marked primary only when the
-- person has no other active primary role (a pre-existing primary would trip
-- ux_people_role_assignments_active_primary_per_person).
insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on)
select
  v.person_id,
  r.id,
  not exists (
    select 1 from atlas.people_role_assignments existing
    where existing.person_id = v.person_id
      and existing.is_primary = true
      and existing.ends_on is null
  ),
  current_date
from (values
  ('de300000-0000-0000-0000-0000000000b1'::uuid, 'navigator'),
  ('de300000-0000-0000-0000-0000000000c1'::uuid, 'partner')
) as v(person_id, role_key)
join atlas.roles r on r.role_key = v.role_key
where not exists (
  select 1 from atlas.people_role_assignments pra
  where pra.person_id = v.person_id
    and pra.role_id = r.id
    and pra.ends_on is null
);

-- Harper oversees Devon: this supervisor edge is the documented RLS bridge
-- that lets the partner login read the five demo enrollments (see demo.md
-- "Login wiring"); fn_can_access_enrollment_as_staff admits supervisors of
-- the assigned navigator.
insert into atlas.supervisor_navigator_assignments (supervisor_person_id, navigator_person_id, starts_on)
select 'de300000-0000-0000-0000-0000000000c1', 'de300000-0000-0000-0000-0000000000b1', current_date
where not exists (
  select 1 from atlas.supervisor_navigator_assignments sna
  where sna.supervisor_person_id = 'de300000-0000-0000-0000-0000000000c1'
    and sna.navigator_person_id = 'de300000-0000-0000-0000-0000000000b1'
    and sna.ends_on is null
);

-- Devon's station context resolves to Harborview (one active partner link per
-- navigator is enforced by a partial unique index, hence the guard).
insert into atlas.navigator_partner_assignments (navigator_person_id, partner_id, starts_on)
select 'de300000-0000-0000-0000-0000000000b1', p.id, current_date
from atlas.partners p
where p.organization_name_normalized = 'harborview family advocacy center'
  and not exists (
    select 1 from atlas.navigator_partner_assignments npa
    where npa.navigator_person_id = 'de300000-0000-0000-0000-0000000000b1'
      and npa.ends_on is null
  );

-- ---------------------------------------------------------------------------
-- 4) Five phenotype people -> enrollees (journey phase) -> enrollments
--    (staggered start dates so every timeline reads differently).
-- ---------------------------------------------------------------------------
insert into atlas.people (id, external_ref, first_name, last_name, display_name, email, person_type, status)
values
  ('de300000-0000-0000-0000-000000000011', 'demo-phenotype-sv', 'Selena', 'Vargas', 'Selena Vargas', 'selena.vargas@demo.atlas.test', 'enrollee', 'active'),
  ('de300000-0000-0000-0000-000000000021', 'demo-phenotype-sp', 'Samuel', 'Park',   'Samuel Park',   'samuel.park@demo.atlas.test',   'enrollee', 'active'),
  ('de300000-0000-0000-0000-000000000031', 'demo-phenotype-sa', 'Sofia',  'Amari',  'Sofia Amari',   'sofia.amari@demo.atlas.test',   'enrollee', 'active'),
  ('de300000-0000-0000-0000-000000000041', 'demo-phenotype-yp', 'Yusuf',  'Peters', 'Yusuf Peters',  'yusuf.peters@demo.atlas.test',  'enrollee', 'active'),
  ('de300000-0000-0000-0000-000000000051', 'demo-phenotype-rr', 'Ray',    'Rivera', 'Ray Rivera',    'ray.rivera@demo.atlas.test',    'enrollee', 'active')
on conflict (id) do update
set first_name = excluded.first_name,
    last_name = excluded.last_name,
    display_name = excluded.display_name,
    email = excluded.email,
    person_type = excluded.person_type,
    status = 'active',
    updated_at = now();

-- current_phase carries the deliberate stage spread from demo.md:
-- SV renewal, SP readiness (late), SA regulation, YP readiness (early), RR regulation.
insert into atlas.enrollees (id, person_id, case_id, dob, current_phase)
values
  ('de300000-0000-0000-0000-000000000012', 'de300000-0000-0000-0000-000000000011', 'PHX-001', '1989-03-14', 'renewal'),
  ('de300000-0000-0000-0000-000000000022', 'de300000-0000-0000-0000-000000000021', 'PHX-002', '2004-09-02', 'readiness'),
  ('de300000-0000-0000-0000-000000000032', 'de300000-0000-0000-0000-000000000031', 'PHX-003', '1996-11-27', 'regulation'),
  ('de300000-0000-0000-0000-000000000042', 'de300000-0000-0000-0000-000000000041', 'PHX-004', '2002-05-19', 'readiness'),
  ('de300000-0000-0000-0000-000000000052', 'de300000-0000-0000-0000-000000000051', 'PHX-005', '1993-07-08', 'regulation')
on conflict (id) do update
set case_id = excluded.case_id,
    dob = excluded.dob,
    current_phase = excluded.current_phase,
    updated_at = now();

insert into atlas.enrollments (id, enrollee_id, start_date, target_duration_months, status)
values
  ('de300000-0000-0000-0000-000000000013', 'de300000-0000-0000-0000-000000000012', '2026-01-12', 9, 'active'),
  ('de300000-0000-0000-0000-000000000023', 'de300000-0000-0000-0000-000000000022', '2026-03-02', 9, 'active'),
  ('de300000-0000-0000-0000-000000000033', 'de300000-0000-0000-0000-000000000032', '2026-06-08', 9, 'active'),
  ('de300000-0000-0000-0000-000000000043', 'de300000-0000-0000-0000-000000000042', '2026-05-04', 9, 'active'),
  ('de300000-0000-0000-0000-000000000053', 'de300000-0000-0000-0000-000000000052', '2026-06-29', 9, 'active');

-- Devon carries all five enrollments at the Harborview station; assignment
-- start matches each enrollment start so tenure reads correctly.
insert into atlas.navigator_assignments (enrollment_id, navigator_person_id, station_id, starts_on)
values
  ('de300000-0000-0000-0000-000000000013', 'de300000-0000-0000-0000-0000000000b1', 'de300000-0000-0000-0000-0000000000a2', '2026-01-12'),
  ('de300000-0000-0000-0000-000000000023', 'de300000-0000-0000-0000-0000000000b1', 'de300000-0000-0000-0000-0000000000a2', '2026-03-02'),
  ('de300000-0000-0000-0000-000000000033', 'de300000-0000-0000-0000-0000000000b1', 'de300000-0000-0000-0000-0000000000a2', '2026-06-08'),
  ('de300000-0000-0000-0000-000000000043', 'de300000-0000-0000-0000-0000000000b1', 'de300000-0000-0000-0000-0000000000a2', '2026-05-04'),
  ('de300000-0000-0000-0000-000000000053', 'de300000-0000-0000-0000-0000000000b1', 'de300000-0000-0000-0000-0000000000a2', '2026-06-29');

-- ---------------------------------------------------------------------------
-- 4b) Defensive Z-code catalog upserts. All 24 phenotype codes were verified
--     present in the live catalog; this block only matters for fresh
--     environments so the burden joins below never silently drop rows.
--     Titles mirror the live catalog verbatim.
-- ---------------------------------------------------------------------------
insert into atlas.z_codes (z_code, z_group, title, is_active)
values
  ('Z55.1', 55, 'Schooling unavailable and unattainable', true),
  ('Z55.2', 55, 'Failed school examinations', true),
  ('Z55.8', 55, 'Other specified problems related to education and literacy (i.e. - difficulty due to inadequate teaching)', true),
  ('Z55.9', 55, 'Problems related to education and literacy, unspecified', true),
  ('Z56.0', 56, 'Unemployment, unspecified', true),
  ('Z56.2', 56, 'Threat of job loss', true),
  ('Z56.6', 56, 'Other physical and mental strain related to work', true),
  ('Z59.0', 59, 'Homelessness (i.e.,indicates person is homeless, but does not provide specific details on whether they are in a shelter or on the street.)', true),
  ('Z59.1', 59, 'Inadequate housing', true),
  ('Z59.6', 59, 'Low income', true),
  ('Z59.7', 59, 'Insufficient social insurance or welfare support', true),
  ('Z60.0', 60, 'Phase of life problem', true),
  ('Z60.2', 60, 'Problems related to living alone', true),
  ('Z60.3', 60, 'Acculturation difficulty', true),
  ('Z60.4', 60, 'Social exclusion or rejection', true),
  ('Z62.810', 62, 'Personal history of physical and sexual abuse in childhood', true),
  ('Z62.811', 62, 'Personal history of psychological abuse in childhood', true),
  ('Z62.812', 62, 'Personal history of neglect in childhood', true),
  ('Z63.0', 63, 'Problems in relationship with spouse or partner', true),
  ('Z63.7', 63, 'Other stressful life events affecting family and household', true),
  ('Z65.0', 65, 'Conviction in civil or criminal proceedings without imprisonment', true),
  ('Z65.1', 65, 'Imprisonment or other incarceration', true),
  ('Z65.4', 65, 'Victim of crime and terrorism or torture', true),
  ('Z65.8', 65, 'Other specified problems related to psychosocial circumstances (codependency, risk for feeling loneliness or spiritual or religious problems)', true)
on conflict (z_code) do nothing;

-- ---------------------------------------------------------------------------
-- 5) Z-code burden per phenotype (verbatim from demo.md mapping tables).
--    code_review_status is the source of truth; is_resolved stays in lockstep
--    with 'resolved' exactly like the command RPCs enforce. Resolved rows are
--    attributed to Harborview with dated resolution notes.
-- ---------------------------------------------------------------------------
with harborview as (
  select id, organization_name from atlas.partners
  where organization_name_normalized = 'harborview family advocacy center'
),
burden(enrollment_id, z_code, review_status, confidence, resolved_at, note) as (
  values
  -- SV Selena Vargas: full arc, everything resolved with attribution.
  ('de300000-0000-0000-0000-000000000013'::uuid, 'Z65.4', 'resolved', 'high', '2026-06-08 17:00:00+00'::timestamptz, 'Sustained absence of revictimization; safety plan holding'),
  ('de300000-0000-0000-0000-000000000013', 'Z59.0', 'resolved', 'high', '2026-03-30 17:00:00+00', 'Displacement ended at respite entry; no return to homelessness'),
  ('de300000-0000-0000-0000-000000000013', 'Z59.1', 'resolved', 'high', '2026-04-06 17:00:00+00', 'Relocated to DV-informed housing with CPTED-aligned modifications'),
  ('de300000-0000-0000-0000-000000000013', 'Z59.6', 'resolved', 'high', '2026-05-25 17:00:00+00', 'Income stabilized through sustained work participation'),
  ('de300000-0000-0000-0000-000000000013', 'Z59.7', 'resolved', 'high', '2026-05-25 17:00:00+00', 'Benefits and social insurance supports secured'),
  ('de300000-0000-0000-0000-000000000013', 'Z60.4', 'resolved', 'high', '2026-05-04 17:00:00+00', 'Voluntary, non-threatening supports re-established'),
  ('de300000-0000-0000-0000-000000000013', 'Z63.0', 'resolved', 'high', '2026-04-20 17:00:00+00', 'Coercive relational ties severed with legal supports'),
  ('de300000-0000-0000-0000-000000000013', 'Z63.7', 'resolved', 'high', '2026-05-04 17:00:00+00', 'Household stressors resolved with relocation'),
  ('de300000-0000-0000-0000-000000000013', 'Z56.0', 'resolved', 'high', '2026-06-01 17:00:00+00', 'Graduated return to productivity completed'),
  ('de300000-0000-0000-0000-000000000013', 'Z56.2', 'resolved', 'high', '2026-06-01 17:00:00+00', 'Work schedule stabilized; job threat removed'),
  -- SP Samuel Park: readiness late, majority resolved/partially resolved.
  ('de300000-0000-0000-0000-000000000023', 'Z55.2', 'resolved', 'high', '2026-05-18 17:00:00+00', 'Examinations retaken after academic load recalibration'),
  ('de300000-0000-0000-0000-000000000023', 'Z60.2', 'resolved', 'medium', '2026-06-08 17:00:00+00', 'Predictable low-volatility living conditions established'),
  ('de300000-0000-0000-0000-000000000023', 'Z65.4', 'partially_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000023', 'Z60.0', 'partially_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000023', 'Z55.8', 'partially_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000023', 'Z60.4', 'partially_resolved', 'low', null, null),
  ('de300000-0000-0000-0000-000000000023', 'Z55.9', 'not_resolved', 'high', null, null),
  ('de300000-0000-0000-0000-000000000023', 'Z56.6', 'not_resolved', 'medium', null, null),
  -- SA Sofia Amari: regulation stabilizing, all active.
  ('de300000-0000-0000-0000-000000000033', 'Z65.8', 'not_resolved', 'high', null, null),
  ('de300000-0000-0000-0000-000000000033', 'Z60.0', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000033', 'Z60.3', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000033', 'Z60.4', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000033', 'Z63.7', 'not_resolved', 'low', null, null),
  ('de300000-0000-0000-0000-000000000033', 'Z56.6', 'not_resolved', 'low', null, null),
  -- YP-FEP Yusuf Peters: readiness early, unburdening just begun.
  ('de300000-0000-0000-0000-000000000043', 'Z59.1', 'partially_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000043', 'Z60.2', 'partially_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000043', 'Z60.0', 'not_resolved', 'high', null, null),
  ('de300000-0000-0000-0000-000000000043', 'Z55.1', 'not_resolved', 'high', null, null),
  ('de300000-0000-0000-0000-000000000043', 'Z55.2', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000043', 'Z55.9', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000043', 'Z60.4', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000043', 'Z56.0', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000043', 'Z56.6', 'not_resolved', 'low', null, null),
  -- RR Ray Rivera: regulation entry, full criminogenic load active.
  ('de300000-0000-0000-0000-000000000053', 'Z65.0', 'not_resolved', 'high', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z65.1', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z60.4', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z63.0', 'not_resolved', 'high', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z62.810', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z62.811', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z62.812', 'not_resolved', 'low', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z56.0', 'not_resolved', 'high', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z56.6', 'not_resolved', 'medium', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z59.1', 'not_resolved', 'high', null, null),
  ('de300000-0000-0000-0000-000000000053', 'Z59.7', 'not_resolved', 'medium', null, null)
)
insert into atlas.enrollee_z_codes (
  enrollment_id, z_code_id, source, effective_at,
  code_review_status, confidence_level,
  is_resolved, resolution_at, resolution_partner_id, resolution_partner_name, resolution_note
)
select
  b.enrollment_id,
  z.id,
  'manual',
  -- Burden is effective from enrollment start so radial history spans the journey.
  en.start_date::timestamptz,
  b.review_status,
  b.confidence,
  b.review_status = 'resolved',
  b.resolved_at,
  case when b.review_status = 'resolved' then h.id end,
  case when b.review_status = 'resolved' then h.organization_name end,
  b.note
from burden b
join atlas.z_codes z on upper(z.z_code) = b.z_code
join atlas.enrollments en on en.id = b.enrollment_id
cross join harborview h;

-- ---------------------------------------------------------------------------
-- 6) Regulation gates: Mental Health Self-Care Agency (MH-SCA, threshold 126,
--    summed) and Stress Vulnerability Scale (SVS, threshold 60, averaged)
--    submissions with the three placeholder catalog answers each. Gate states
--    per phenotype (demo.md): SV/SP/YP both passed; SA SVS passed + MH-SCA
--    not passed; RR neither passed.
-- ---------------------------------------------------------------------------
insert into atlas.navigator_regulation_test_submissions (
  id, draft_key, enrollee_id, enrollment_id, test_type, status,
  enrollee_name, enrollee_case_id, enrollee_email,
  total_score, pass_threshold, passed, submitted_at, updated_at
)
values
  ('de300000-0000-0000-0000-000000000018', 'demo-phenotype-sv-mhsca', 'de300000-0000-0000-0000-000000000012', 'de300000-0000-0000-0000-000000000013', 'mh_sca', 'completed', 'Selena Vargas', 'PHX-001', 'selena.vargas@demo.atlas.test', 132, 126, true,  '2026-02-09 18:00:00+00', '2026-02-09 18:00:00+00'),
  ('de300000-0000-0000-0000-000000000019', 'demo-phenotype-sv-svs',   'de300000-0000-0000-0000-000000000012', 'de300000-0000-0000-0000-000000000013', 'svs',    'completed', 'Selena Vargas', 'PHX-001', 'selena.vargas@demo.atlas.test', 70,  60,  true,  '2026-02-16 18:00:00+00', '2026-02-16 18:00:00+00'),
  ('de300000-0000-0000-0000-000000000028', 'demo-phenotype-sp-mhsca', 'de300000-0000-0000-0000-000000000022', 'de300000-0000-0000-0000-000000000023', 'mh_sca', 'completed', 'Samuel Park',   'PHX-002', 'samuel.park@demo.atlas.test',   129, 126, true,  '2026-04-06 18:00:00+00', '2026-04-06 18:00:00+00'),
  ('de300000-0000-0000-0000-000000000029', 'demo-phenotype-sp-svs',   'de300000-0000-0000-0000-000000000022', 'de300000-0000-0000-0000-000000000023', 'svs',    'completed', 'Samuel Park',   'PHX-002', 'samuel.park@demo.atlas.test',   68,  60,  true,  '2026-04-13 18:00:00+00', '2026-04-13 18:00:00+00'),
  ('de300000-0000-0000-0000-000000000038', 'demo-phenotype-sa-mhsca', 'de300000-0000-0000-0000-000000000032', 'de300000-0000-0000-0000-000000000033', 'mh_sca', 'completed', 'Sofia Amari',   'PHX-003', 'sofia.amari@demo.atlas.test',   112, 126, false, '2026-06-29 18:00:00+00', '2026-06-29 18:00:00+00'),
  ('de300000-0000-0000-0000-000000000039', 'demo-phenotype-sa-svs',   'de300000-0000-0000-0000-000000000032', 'de300000-0000-0000-0000-000000000033', 'svs',    'completed', 'Sofia Amari',   'PHX-003', 'sofia.amari@demo.atlas.test',   66,  60,  true,  '2026-06-29 18:30:00+00', '2026-06-29 18:30:00+00'),
  ('de300000-0000-0000-0000-000000000048', 'demo-phenotype-yp-mhsca', 'de300000-0000-0000-0000-000000000042', 'de300000-0000-0000-0000-000000000043', 'mh_sca', 'completed', 'Yusuf Peters',  'PHX-004', 'yusuf.peters@demo.atlas.test',  127, 126, true,  '2026-06-08 18:00:00+00', '2026-06-08 18:00:00+00'),
  ('de300000-0000-0000-0000-000000000049', 'demo-phenotype-yp-svs',   'de300000-0000-0000-0000-000000000042', 'de300000-0000-0000-0000-000000000043', 'svs',    'completed', 'Yusuf Peters',  'PHX-004', 'yusuf.peters@demo.atlas.test',  63,  60,  true,  '2026-06-15 18:00:00+00', '2026-06-15 18:00:00+00'),
  ('de300000-0000-0000-0000-000000000058', 'demo-phenotype-rr-mhsca', 'de300000-0000-0000-0000-000000000052', 'de300000-0000-0000-0000-000000000053', 'mh_sca', 'completed', 'Ray Rivera',    'PHX-005', 'ray.rivera@demo.atlas.test',    96,  126, false, '2026-07-06 18:00:00+00', '2026-07-06 18:00:00+00'),
  ('de300000-0000-0000-0000-000000000059', 'demo-phenotype-rr-svs',   'de300000-0000-0000-0000-000000000052', 'de300000-0000-0000-0000-000000000053', 'svs',    'completed', 'Ray Rivera',    'PHX-005', 'ray.rivera@demo.atlas.test',    42,  60,  false, '2026-07-06 18:30:00+00', '2026-07-06 18:30:00+00');

-- Answers reproduce each total under the catalog scoring rules
-- (MH-SCA sums its three items; SVS averages them).
with answer_values(submission_id, prompt_suffix, v1, v2, v3) as (
  values
    ('de300000-0000-0000-0000-000000000018'::uuid, 'mhsca', 45, 44, 43),
    ('de300000-0000-0000-0000-000000000019', 'svs',   72, 70, 68),
    ('de300000-0000-0000-0000-000000000028', 'mhsca', 44, 43, 42),
    ('de300000-0000-0000-0000-000000000029', 'svs',   70, 68, 66),
    ('de300000-0000-0000-0000-000000000038', 'mhsca', 38, 37, 37),
    ('de300000-0000-0000-0000-000000000039', 'svs',   66, 66, 66),
    ('de300000-0000-0000-0000-000000000048', 'mhsca', 43, 42, 42),
    ('de300000-0000-0000-0000-000000000049', 'svs',   63, 63, 63),
    ('de300000-0000-0000-0000-000000000058', 'mhsca', 32, 32, 32),
    ('de300000-0000-0000-0000-000000000059', 'svs',   42, 42, 42)
),
prompt_catalog(prompt_suffix, prompt_index, prompt_id, prompt_label) as (
  values
    ('mhsca', 1, 'mhsca-1', 'Emotional regulation baseline'),
    ('mhsca', 2, 'mhsca-2', 'Behavioral stability baseline'),
    ('mhsca', 3, 'mhsca-3', 'Social coping baseline'),
    ('svs',   1, 'svs-1',   'Current stress load'),
    ('svs',   2, 'svs-2',   'Protective supports'),
    ('svs',   3, 'svs-3',   'Recent vulnerability events')
)
insert into atlas.navigator_regulation_test_answers (submission_id, prompt_id, prompt_label, response_value)
select
  av.submission_id,
  pc.prompt_id,
  pc.prompt_label,
  case pc.prompt_index when 1 then av.v1 when 2 then av.v2 else av.v3 end
from answer_values av
join prompt_catalog pc on pc.prompt_suffix = av.prompt_suffix;

-- ---------------------------------------------------------------------------
-- 7) Timeline settings, route plans/stops, journey logs, referral provenance.
-- ---------------------------------------------------------------------------
-- 9-month plans; cutoffs match the demo gate set (readiness month 3, renewal month 6).
insert into atlas.timeline_settings (enrollment_id, plan_start_date, duration_months, regulation_cutoff_month, readiness_cutoff_month)
values
  ('de300000-0000-0000-0000-000000000013', '2026-01-12', 9, 3, 6),
  ('de300000-0000-0000-0000-000000000023', '2026-03-02', 9, 3, 6),
  ('de300000-0000-0000-0000-000000000033', '2026-06-08', 9, 3, 6),
  ('de300000-0000-0000-0000-000000000043', '2026-05-04', 9, 3, 6),
  ('de300000-0000-0000-0000-000000000053', '2026-06-29', 9, 3, 6)
on conflict (enrollment_id) do update
set plan_start_date = excluded.plan_start_date,
    duration_months = excluded.duration_months,
    regulation_cutoff_month = excluded.regulation_cutoff_month,
    readiness_cutoff_month = excluded.readiness_cutoff_month,
    updated_at = now();

-- Route plans: SV completed the full route, SP and YP are mid-route,
-- SA and RR deliberately have none yet (still in regulation).
insert into atlas.route_plans (id, enrollment_id, created_by_person_id, status)
values
  ('de300000-0000-0000-0000-000000000014', 'de300000-0000-0000-0000-000000000013', 'de300000-0000-0000-0000-0000000000b1', 'completed'),
  ('de300000-0000-0000-0000-000000000024', 'de300000-0000-0000-0000-000000000023', 'de300000-0000-0000-0000-0000000000b1', 'active'),
  ('de300000-0000-0000-0000-000000000044', 'de300000-0000-0000-0000-000000000043', 'de300000-0000-0000-0000-0000000000b1', 'active');

-- Completed stops surface as station markers in v_enrollment_station_markers.
insert into atlas.route_plan_stops (id, route_plan_id, station_id, z_code_id, stop_order, assigned_date, target_date, status)
select
  s.id, s.route_plan_id, 'de300000-0000-0000-0000-0000000000a2', z.id, s.stop_order, s.assigned_date, s.target_date, s.status
from (
  values
    -- SV: full arc, all completed.
    ('de300000-0000-0000-0000-000000000015'::uuid, 'de300000-0000-0000-0000-000000000014'::uuid, 'Z59.1', 1, '2026-03-09'::date, '2026-04-06'::date, 'completed'),
    ('de300000-0000-0000-0000-000000000016', 'de300000-0000-0000-0000-000000000014', 'Z60.4', 2, '2026-04-13', '2026-05-11', 'completed'),
    ('de300000-0000-0000-0000-000000000017', 'de300000-0000-0000-0000-000000000014', 'Z56.0', 3, '2026-05-11', '2026-06-08', 'completed'),
    -- SP: readiness late, two down, one active.
    ('de300000-0000-0000-0000-000000000025', 'de300000-0000-0000-0000-000000000024', 'Z55.2', 1, '2026-04-20', '2026-05-18', 'completed'),
    ('de300000-0000-0000-0000-000000000026', 'de300000-0000-0000-0000-000000000024', 'Z60.2', 2, '2026-05-04', '2026-06-08', 'completed'),
    ('de300000-0000-0000-0000-000000000027', 'de300000-0000-0000-0000-000000000024', 'Z56.6', 3, '2026-06-01', '2026-07-13', 'active'),
    -- YP: readiness early, first stop just completed.
    ('de300000-0000-0000-0000-000000000045', 'de300000-0000-0000-0000-000000000044', 'Z59.1', 1, '2026-06-22', '2026-07-06', 'completed'),
    ('de300000-0000-0000-0000-000000000046', 'de300000-0000-0000-0000-000000000044', 'Z55.1', 2, '2026-06-29', '2026-07-27', 'active'),
    ('de300000-0000-0000-0000-000000000047', 'de300000-0000-0000-0000-000000000044', 'Z56.0', 3, '2026-07-06', '2026-08-10', 'planned')
) as s(id, route_plan_id, z_code, stop_order, assigned_date, target_date, status)
join atlas.z_codes z on upper(z.z_code) = s.z_code;

-- Canonical journey evidence, including the instruments without schema homes
-- (Danger Assessment, Pocket Guide, IPF, LS/CMI, allostatic load) recorded as
-- dated log labels per demo.md "Modeling Conventions".
insert into atlas.journey_logs (id, enrollment_id, milestone_type, phase, label, happened_at, station_icon_slug, domains_relieved, created_by_person_id)
values
  -- SV Selena Vargas (renewal, full arc).
  ('de300000-0000-0000-0000-000000000111', 'de300000-0000-0000-0000-000000000013', 'intervention',      'regulation', 'respite stay — immediate removal from threat environment; Danger Assessment: concerning', '2026-01-13 18:00:00+00', 'check',   '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000112', 'de300000-0000-0000-0000-000000000013', 'verifiedMilestone', 'regulation', 'sleep, meals, and daily rhythm restored under DV-informed peer containment',              '2026-01-27 18:00:00+00', 'health',  '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000113', 'de300000-0000-0000-0000-000000000013', 'verifiedMilestone', 'regulation', 'Pocket Guide completed — SVS and MH-SCA stabilized under protected conditions',           '2026-02-16 18:00:00+00', 'check',   '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000114', 'de300000-0000-0000-0000-000000000013', 'intervention',      'readiness',  'relocation to DV-informed housing with CPTED-aligned safety modifications',               '2026-03-09 18:00:00+00', 'housing', '{housing}', 'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000115', 'de300000-0000-0000-0000-000000000013', 'intervention',      'readiness',  'coercive ties severed; voluntary social supports re-established',                         '2026-04-20 18:00:00+00', 'social',  '{social}',  'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000116', 'de300000-0000-0000-0000-000000000013', 'intervention',      'readiness',  'work schedule stabilized — graduated return to productivity',                             '2026-05-11 18:00:00+00', 'work',    '{work}',    'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000117', 'de300000-0000-0000-0000-000000000013', 'verifiedMilestone', 'renewal',    'IPF marked improvement — independent living, work participation, safe relational engagement', '2026-06-15 18:00:00+00', 'flag',    '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000118', 'de300000-0000-0000-0000-000000000013', 'sustainedChange',   'renewal',    'survivor peer mentoring and community safety contribution begun',                         '2026-06-29 18:00:00+00', 'social',  '{social}',  'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000119', 'de300000-0000-0000-0000-000000000013', 'sustainedChange',   'renewal',    'allostatic load declining — protected regulation biologically holding',                   '2026-07-06 18:00:00+00', 'health',  '{}',        'de300000-0000-0000-0000-0000000000b1'),
  -- SP Samuel Park (readiness, late).
  ('de300000-0000-0000-0000-000000000121', 'de300000-0000-0000-0000-000000000023', 'intervention',      'regulation', 'short respite stay with monitoring — sleep and circadian restoration',                    '2026-03-03 18:00:00+00', 'health',  '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000122', 'de300000-0000-0000-0000-000000000023', 'intervention',      'regulation', 'sensory regulation and reduced cognitive load — no pathologizing of experience',          '2026-03-16 18:00:00+00', 'check',   '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000123', 'de300000-0000-0000-0000-000000000023', 'verifiedMilestone', 'regulation', 'Pocket Guide completed — arousal and vigilance downshifted',                              '2026-04-13 18:00:00+00', 'check',   '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000124', 'de300000-0000-0000-0000-000000000023', 'intervention',      'readiness',  'academic load recalibrated; routine and expectations restored',                           '2026-04-20 18:00:00+00', 'education', '{education}', 'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000125', 'de300000-0000-0000-0000-000000000023', 'intervention',      'readiness',  'anchored peer connections — isolation reduced without over-stimulation',                  '2026-05-04 18:00:00+00', 'social',  '{social}',  'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000126', 'de300000-0000-0000-0000-000000000023', 'verifiedMilestone', 'readiness',  'predictable living conditions confirmed — perceptual experiences no longer environmentally amplified', '2026-06-08 18:00:00+00', 'housing', '{housing}', 'de300000-0000-0000-0000-0000000000b1'),
  -- SA Sofia Amari (regulation, stabilizing).
  ('de300000-0000-0000-0000-000000000131', 'de300000-0000-0000-0000-000000000033', 'intervention',      'regulation', 'respite-based grounding — sleep, nutrition, and circadian rhythm restoration',            '2026-06-10 18:00:00+00', 'health',  '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000132', 'de300000-0000-0000-0000-000000000033', 'intervention',      'regulation', 'relational containment without theological interpretation or suppression',               '2026-06-17 18:00:00+00', 'social',  '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000133', 'de300000-0000-0000-0000-000000000033', 'intervention',      'regulation', 'Pocket Guide in progress — grounding and continuity emphasis; MH-SCA re-check scheduled', '2026-07-08 18:00:00+00', 'check',   '{}',        'de300000-0000-0000-0000-0000000000b1'),
  -- YP-FEP Yusuf Peters (readiness, early).
  ('de300000-0000-0000-0000-000000000141', 'de300000-0000-0000-0000-000000000043', 'intervention',      'regulation', 'stabilization stay with medication optimization',                                         '2026-05-05 18:00:00+00', 'health',  '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000142', 'de300000-0000-0000-0000-000000000043', 'verifiedMilestone', 'regulation', 'daily rhythm and sleep–wake cycle restored; predictable interpersonal contact',           '2026-05-25 18:00:00+00', 'check',   '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000143', 'de300000-0000-0000-0000-000000000043', 'verifiedMilestone', 'regulation', 'Pocket Guide completed after stabilization held (not during acute crisis)',               '2026-06-15 18:00:00+00', 'check',   '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000144', 'de300000-0000-0000-0000-000000000043', 'intervention',      'readiness',  'supported living placement with predictable structure',                                   '2026-06-22 18:00:00+00', 'housing', '{housing}', 'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000145', 'de300000-0000-0000-0000-000000000043', 'intervention',      'readiness',  'supported education re-entry aligned with cognitive and motivational capacity',           '2026-07-06 18:00:00+00', 'education', '{education}', 'de300000-0000-0000-0000-0000000000b1'),
  -- RR Ray Rivera (regulation, entry).
  ('de300000-0000-0000-0000-000000000151', 'de300000-0000-0000-0000-000000000053', 'intervention',      'regulation', 'court-mandated stabilization — enforced housing separation from victim and criminogenic peers', '2026-06-30 18:00:00+00', 'legal',   '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000152', 'de300000-0000-0000-0000-000000000053', 'intervention',      'regulation', 'medication initiation and adherence monitoring',                                          '2026-07-07 18:00:00+00', 'health',  '{}',        'de300000-0000-0000-0000-0000000000b1'),
  ('de300000-0000-0000-0000-000000000153', 'de300000-0000-0000-0000-000000000053', 'intervention',      'regulation', 'accountability and safety planning opened alongside Pocket Guide; LS/CMI dynamic risk factors baselined', '2026-07-10 18:00:00+00', 'legal',   '{}',        'de300000-0000-0000-0000-0000000000b1');

-- Canonical referral rows attributing each participant to the Harborview
-- station, referred by the partner contact (Harper Voss).
insert into atlas.referrals (enrollment_id, referred_by_person_id, station_id, z_code_id, status, priority, referred_at)
select r.enrollment_id, 'de300000-0000-0000-0000-0000000000c1', 'de300000-0000-0000-0000-0000000000a2', z.id, r.status, r.priority, r.referred_at
from (
  values
    ('de300000-0000-0000-0000-000000000013'::uuid, 'Z65.4', 'completed',   'high',   '2026-01-05 18:00:00+00'::timestamptz),
    ('de300000-0000-0000-0000-000000000023', 'Z65.4', 'in_progress', 'medium', '2026-02-23 18:00:00+00'),
    ('de300000-0000-0000-0000-000000000033', 'Z65.8', 'accepted',    'medium', '2026-06-01 18:00:00+00'),
    ('de300000-0000-0000-0000-000000000043', 'Z60.0', 'in_progress', 'medium', '2026-04-27 18:00:00+00'),
    ('de300000-0000-0000-0000-000000000053', 'Z65.0', 'accepted',    'high',   '2026-06-22 18:00:00+00')
) as r(enrollment_id, z_code, status, priority, referred_at)
join atlas.z_codes z on upper(z.z_code) = r.z_code;

-- Intake-rail provenance: the same five referrals as claimed public queue
-- records so the partner strip and pickup queue trace back to Harborview.
-- Payload shape matches UnassignedEnrolleePickupRecord in the frontend
-- contracts; background notes carry each triggering Stressful Life Event (SLE) verbatim.
insert into atlas.public_referral_intake_events (external_record_id, event_type, source, payload, submitted_by_email, submitted_at)
select
  q.external_record_id,
  'referral',
  'public_landing',
  jsonb_build_object(
    'id', q.external_record_id,
    'fullName', q.full_name,
    'dob', q.dob,
    'caseId', q.case_id,
    'email', q.email,
    'phone', '',
    'demographicsSummary', q.demographics,
    'referredAtIso', q.referred_at,
    'referrerName', 'Harper Voss',
    'referrerOrganization', 'Harborview Family Advocacy Center',
    'backgroundNotes', q.background_notes,
    'referrerMessage', '',
    'zCodeTags', q.z_code_tags,
    'status', 'claimed',
    'claimedByNavigatorName', 'Devon Marsh',
    'claimedAtIso', q.claimed_at
  ),
  'demo.partner@atlas.test',
  q.referred_at::timestamptz
from (
  values
    ('demo-phenotype-sv-referral', 'Selena Vargas', '1989-03-14', 'PHX-001', 'selena.vargas@demo.atlas.test',
     'Adult survivor of intimate partner violence; housing instability and financial strain',
     'Escalation of intimate partner violence following financial stress and housing instability.',
     '2026-01-05T18:00:00Z', '2026-01-12T18:00:00Z',
     jsonb_build_array('Z65.4','Z59.0','Z59.1','Z59.6','Z59.7','Z60.4','Z63.0','Z63.7','Z56.0','Z56.2')),
    ('demo-phenotype-sp-referral', 'Samuel Park', '2004-09-02', 'PHX-002', 'samuel.park@demo.atlas.test',
     'College student; heightened stress sensitivity with attenuated perceptual disturbances, insight intact',
     'Violent assault followed by academic disruption during college.',
     '2026-02-23T18:00:00Z', '2026-03-02T18:00:00Z',
     jsonb_build_array('Z65.4','Z60.0','Z55.2','Z55.8','Z55.9','Z60.2','Z60.4','Z56.6')),
    ('demo-phenotype-sa-referral', 'Sofia Amari', '1996-11-27', 'PHX-003', 'sofia.amari@demo.atlas.test',
     'Destabilization driven by uncontained meaning rather than psychopathology; needs grounding, not interpretation',
     'Moral rupture followed by intensive contemplative practice without adequate integration or communal grounding.',
     '2026-06-01T18:00:00Z', '2026-06-08T18:00:00Z',
     jsonb_build_array('Z65.8','Z60.0','Z60.3','Z60.4','Z63.7','Z56.6')),
    ('demo-phenotype-yp-referral', 'Yusuf Peters', '2002-05-19', 'PHX-004', 'yusuf.peters@demo.atlas.test',
     'Young adult post first-episode psychosis; identity formation and role continuity disrupted',
     'Academic failure combined with social isolation preceding a first psychotic episode during a critical developmental window.',
     '2026-04-27T18:00:00Z', '2026-05-04T18:00:00Z',
     jsonb_build_array('Z60.0','Z55.1','Z55.2','Z55.9','Z60.2','Z60.4','Z56.0','Z56.6','Z59.1')),
    ('demo-phenotype-rr-referral', 'Ray Rivera', '1993-07-08', 'PHX-005', 'ray.rivera@demo.atlas.test',
     'Court-mandated stabilization after violent incident; untreated manic episode with criminogenic exposure',
     'Untreated manic episode combined with structural stress and criminogenic exposure, resulting in a violent incident.',
     '2026-06-22T18:00:00Z', '2026-06-29T18:00:00Z',
     jsonb_build_array('Z65.0','Z65.1','Z60.4','Z63.0','Z62.810','Z62.811','Z62.812','Z56.0','Z56.6','Z59.1','Z59.7'))
) as q(external_record_id, full_name, dob, case_id, email, demographics, background_notes, referred_at, claimed_at, z_code_tags)
on conflict (external_record_id) do update
set payload = excluded.payload,
    submitted_by_email = excluded.submitted_by_email,
    submitted_at = excluded.submitted_at;

-- Station metrics snapshot backing v_navigator_my_station_metrics
-- (5 active enrollments; 12 resolved codes = SV's 10 + SP's 2).
insert into atlas.station_metric_snapshots (
  id, station_id, snapshot_at, active_enrollments, z_codes_resolved_count, habitat_load, work_load, social_network_load
)
values ('de300000-0000-0000-0000-0000000000a4', 'de300000-0000-0000-0000-0000000000a2', now(), 5, 12, 7.5, 6.0, 8.0);

-- ---------------------------------------------------------------------------
-- 8) Runtime config documents (surface 'singlepane', version 'runtime-v1')
--    that the workspace actually renders: shared route_logs array, per-enrollee
--    route assignments, and per-enrollment timeline configs. Demo route-log
--    entries carry deterministic 'demo-phenotype-' ids so a re-run replaces
--    them instead of duplicating.
-- ---------------------------------------------------------------------------
insert into atlas.app_config_documents (surface, config_key, version, payload)
values ('singlepane', 'route_logs', 'runtime-v1', '[]'::jsonb)
on conflict (surface, config_key, version) do nothing;

update atlas.app_config_documents doc
set payload = (
  -- Keep every non-demo entry, then append the fresh demo entries.
  select coalesce(jsonb_agg(entry), '[]'::jsonb)
  from (
    select entry
    -- Guard against a malformed (non-array) stored payload so the merge
    -- degrades to "demo entries only" instead of failing the migration.
    from jsonb_array_elements(
      case when jsonb_typeof(doc.payload) = 'array' then doc.payload else '[]'::jsonb end
    ) as entry
    where coalesce(entry->>'id', '') not like 'demo-phenotype-%'
    union all
    select entry
    from jsonb_array_elements(
      jsonb_build_array(
        -- SV Selena Vargas (enrolleeId ...0012).
        jsonb_build_object('id','demo-phenotype-sv-log-1','enrolleeId','de300000-0000-0000-0000-000000000012','label','respite stay — immediate removal from threat environment; Danger Assessment: concerning','timestampIso','2026-01-13T18:00:00.000Z','status','completed','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('social'),'stationIcon','check','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sv-log-2','enrolleeId','de300000-0000-0000-0000-000000000012','label','sleep, meals, and daily rhythm restored under DV-informed peer containment','timestampIso','2026-01-27T18:00:00.000Z','status','completed','phase','regulation','milestoneType','verifiedMilestone','domainsRelieved',jsonb_build_array('health'),'stationIcon','health','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sv-log-3','enrolleeId','de300000-0000-0000-0000-000000000012','label','Pocket Guide completed — SVS and MH-SCA stabilized under protected conditions','timestampIso','2026-02-16T18:00:00.000Z','status','completed','phase','regulation','milestoneType','verifiedMilestone','domainsRelieved',jsonb_build_array('health'),'stationIcon','check','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sv-log-4','enrolleeId','de300000-0000-0000-0000-000000000012','label','relocation to DV-informed housing with CPTED-aligned safety modifications','timestampIso','2026-03-09T18:00:00.000Z','status','completed','phase','readiness','milestoneType','intervention','domainsRelieved',jsonb_build_array('housing'),'stationIcon','housing','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sv-log-5','enrolleeId','de300000-0000-0000-0000-000000000012','label','coercive ties severed; voluntary social supports re-established','timestampIso','2026-04-20T18:00:00.000Z','status','completed','phase','readiness','milestoneType','intervention','domainsRelieved',jsonb_build_array('social'),'stationIcon','social','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sv-log-6','enrolleeId','de300000-0000-0000-0000-000000000012','label','work schedule stabilized — graduated return to productivity','timestampIso','2026-05-11T18:00:00.000Z','status','completed','phase','readiness','milestoneType','intervention','domainsRelieved',jsonb_build_array('work'),'stationIcon','work','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sv-log-7','enrolleeId','de300000-0000-0000-0000-000000000012','label','IPF marked improvement — independent living, work participation, safe relational engagement','timestampIso','2026-06-15T18:00:00.000Z','status','completed','phase','renewal','milestoneType','verifiedMilestone','domainsRelieved',jsonb_build_array('social','work'),'stationIcon','flag','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sv-log-8','enrolleeId','de300000-0000-0000-0000-000000000012','label','survivor peer mentoring and community safety contribution begun','timestampIso','2026-06-29T18:00:00.000Z','status','completed','phase','renewal','milestoneType','sustainedChange','domainsRelieved',jsonb_build_array('social'),'stationIcon','social','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sv-log-9','enrolleeId','de300000-0000-0000-0000-000000000012','label','allostatic load declining — protected regulation biologically holding','timestampIso','2026-07-06T18:00:00.000Z','status','completed','phase','renewal','milestoneType','sustainedChange','domainsRelieved',jsonb_build_array('health'),'stationIcon','health','timelinePositionRatio',null),
        -- SP Samuel Park (enrolleeId ...0022).
        jsonb_build_object('id','demo-phenotype-sp-log-1','enrolleeId','de300000-0000-0000-0000-000000000022','label','short respite stay with monitoring — sleep and circadian restoration','timestampIso','2026-03-03T18:00:00.000Z','status','completed','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('health'),'stationIcon','health','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sp-log-2','enrolleeId','de300000-0000-0000-0000-000000000022','label','sensory regulation and reduced cognitive load — no pathologizing of experience','timestampIso','2026-03-16T18:00:00.000Z','status','completed','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('health'),'stationIcon','check','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sp-log-3','enrolleeId','de300000-0000-0000-0000-000000000022','label','Pocket Guide completed — arousal and vigilance downshifted','timestampIso','2026-04-13T18:00:00.000Z','status','completed','phase','regulation','milestoneType','verifiedMilestone','domainsRelieved',jsonb_build_array('health'),'stationIcon','check','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sp-log-4','enrolleeId','de300000-0000-0000-0000-000000000022','label','academic load recalibrated; routine and expectations restored','timestampIso','2026-04-20T18:00:00.000Z','status','completed','phase','readiness','milestoneType','intervention','domainsRelieved',jsonb_build_array('education'),'stationIcon','education','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sp-log-5','enrolleeId','de300000-0000-0000-0000-000000000022','label','anchored peer connections — isolation reduced without over-stimulation','timestampIso','2026-05-04T18:00:00.000Z','status','completed','phase','readiness','milestoneType','intervention','domainsRelieved',jsonb_build_array('social'),'stationIcon','social','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sp-log-6','enrolleeId','de300000-0000-0000-0000-000000000022','label','predictable living conditions confirmed — perceptual experiences no longer environmentally amplified','timestampIso','2026-06-08T18:00:00.000Z','status','completed','phase','readiness','milestoneType','verifiedMilestone','domainsRelieved',jsonb_build_array('housing'),'stationIcon','housing','timelinePositionRatio',null),
        -- SA Sofia Amari (enrolleeId ...0032).
        jsonb_build_object('id','demo-phenotype-sa-log-1','enrolleeId','de300000-0000-0000-0000-000000000032','label','respite-based grounding — sleep, nutrition, and circadian rhythm restoration','timestampIso','2026-06-10T18:00:00.000Z','status','completed','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('health'),'stationIcon','health','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sa-log-2','enrolleeId','de300000-0000-0000-0000-000000000032','label','relational containment without theological interpretation or suppression','timestampIso','2026-06-17T18:00:00.000Z','status','completed','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('social'),'stationIcon','social','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-sa-log-3','enrolleeId','de300000-0000-0000-0000-000000000032','label','Pocket Guide in progress — grounding and continuity emphasis; MH-SCA re-check scheduled','timestampIso','2026-07-08T18:00:00.000Z','status','active','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('health'),'stationIcon','check','timelinePositionRatio',null),
        -- YP-FEP Yusuf Peters (enrolleeId ...0042).
        jsonb_build_object('id','demo-phenotype-yp-log-1','enrolleeId','de300000-0000-0000-0000-000000000042','label','stabilization stay with medication optimization','timestampIso','2026-05-05T18:00:00.000Z','status','completed','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('health'),'stationIcon','health','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-yp-log-2','enrolleeId','de300000-0000-0000-0000-000000000042','label','daily rhythm and sleep–wake cycle restored; predictable interpersonal contact','timestampIso','2026-05-25T18:00:00.000Z','status','completed','phase','regulation','milestoneType','verifiedMilestone','domainsRelieved',jsonb_build_array('health'),'stationIcon','check','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-yp-log-3','enrolleeId','de300000-0000-0000-0000-000000000042','label','Pocket Guide completed after stabilization held (not during acute crisis)','timestampIso','2026-06-15T18:00:00.000Z','status','completed','phase','regulation','milestoneType','verifiedMilestone','domainsRelieved',jsonb_build_array('health'),'stationIcon','check','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-yp-log-4','enrolleeId','de300000-0000-0000-0000-000000000042','label','supported living placement with predictable structure','timestampIso','2026-06-22T18:00:00.000Z','status','completed','phase','readiness','milestoneType','intervention','domainsRelieved',jsonb_build_array('housing'),'stationIcon','housing','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-yp-log-5','enrolleeId','de300000-0000-0000-0000-000000000042','label','supported education re-entry aligned with cognitive and motivational capacity','timestampIso','2026-07-06T18:00:00.000Z','status','active','phase','readiness','milestoneType','intervention','domainsRelieved',jsonb_build_array('education'),'stationIcon','education','timelinePositionRatio',null),
        -- RR Ray Rivera (enrolleeId ...0052).
        jsonb_build_object('id','demo-phenotype-rr-log-1','enrolleeId','de300000-0000-0000-0000-000000000052','label','court-mandated stabilization — enforced housing separation from victim and criminogenic peers','timestampIso','2026-06-30T18:00:00.000Z','status','completed','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('legal'),'stationIcon','legal','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-rr-log-2','enrolleeId','de300000-0000-0000-0000-000000000052','label','medication initiation and adherence monitoring','timestampIso','2026-07-07T18:00:00.000Z','status','active','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('health'),'stationIcon','health','timelinePositionRatio',null),
        jsonb_build_object('id','demo-phenotype-rr-log-3','enrolleeId','de300000-0000-0000-0000-000000000052','label','accountability and safety planning opened alongside Pocket Guide; LS/CMI dynamic risk factors baselined','timestampIso','2026-07-10T18:00:00.000Z','status','active','phase','regulation','milestoneType','intervention','domainsRelieved',jsonb_build_array('legal'),'stationIcon','legal','timelinePositionRatio',null)
      )
    ) as entry
  ) merged
)
where doc.surface = 'singlepane'
  and doc.config_key = 'route_logs'
  and doc.version = 'runtime-v1';

-- Route assignments: the "active" dots on the partner strip for SV/SP/YP.
-- SA and RR intentionally have none (still in regulation).
insert into atlas.app_config_documents (surface, config_key, version, payload)
values
  ('singlepane', 'route_assignment:de300000-0000-0000-0000-000000000012', 'runtime-v1',
   jsonb_build_object('enrolleeId','de300000-0000-0000-0000-000000000012','stationId','de300000-0000-0000-0000-0000000000a2','stationName','Harborview Main Station','assignedAtIso','2026-05-11T18:00:00.000Z','phase','renewal','matchedZCodes',jsonb_build_array('Z59.1','Z60.4','Z56.0'))),
  ('singlepane', 'route_assignment:de300000-0000-0000-0000-000000000022', 'runtime-v1',
   jsonb_build_object('enrolleeId','de300000-0000-0000-0000-000000000022','stationId','de300000-0000-0000-0000-0000000000a2','stationName','Harborview Main Station','assignedAtIso','2026-06-01T18:00:00.000Z','phase','readiness','matchedZCodes',jsonb_build_array('Z55.2','Z60.2','Z56.6'))),
  ('singlepane', 'route_assignment:de300000-0000-0000-0000-000000000042', 'runtime-v1',
   jsonb_build_object('enrolleeId','de300000-0000-0000-0000-000000000042','stationId','de300000-0000-0000-0000-0000000000a2','stationName','Harborview Main Station','assignedAtIso','2026-06-22T18:00:00.000Z','phase','readiness','matchedZCodes',jsonb_build_array('Z59.1','Z55.1','Z56.0')))
on conflict (surface, config_key, version) do update
set payload = excluded.payload,
    updated_at = now();

-- Timeline configs mirrored to both key shapes the loader checks
-- (enrollment-first, enrollee fallback), standard gate set.
insert into atlas.app_config_documents (surface, config_key, version, payload)
select
  'singlepane',
  key_prefix || key_id,
  'runtime-v1',
  jsonb_build_object(
    'planStartIso', plan_start,
    'durationMonths', 9,
    'maxDurationMonths', 12,
    'gates', jsonb_build_array(
      jsonb_build_object('id','gate-regulation','label','regulation','phase','regulation','monthOffset',0),
      jsonb_build_object('id','gate-readiness','label','readiness','phase','readiness','monthOffset',3),
      jsonb_build_object('id','gate-renewal','label','renewal','phase','renewal','monthOffset',6)
    )
  )
from (
  values
    ('de300000-0000-0000-0000-000000000013', 'de300000-0000-0000-0000-000000000012', '2026-01-12T00:00:00.000Z'),
    ('de300000-0000-0000-0000-000000000023', 'de300000-0000-0000-0000-000000000022', '2026-03-02T00:00:00.000Z'),
    ('de300000-0000-0000-0000-000000000033', 'de300000-0000-0000-0000-000000000032', '2026-06-08T00:00:00.000Z'),
    ('de300000-0000-0000-0000-000000000043', 'de300000-0000-0000-0000-000000000042', '2026-05-04T00:00:00.000Z'),
    ('de300000-0000-0000-0000-000000000053', 'de300000-0000-0000-0000-000000000052', '2026-06-29T00:00:00.000Z')
) as t(enrollment_id, enrollee_id, plan_start)
cross join lateral (
  values ('timeline_config:enrollment:', t.enrollment_id), ('timeline_config:enrollee:', t.enrollee_id)
) as keys(key_prefix, key_id)
on conflict (surface, config_key, version) do update
set payload = excluded.payload,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 9) Demo tags for scoping and teardown. record_type 'enrollments' is what the
--    partner role scoping reads (loadDemoTaggedEnrollmentIds, tag 'atlas_demo');
--    the rest exist so teardown can enumerate the full fixture.
-- ---------------------------------------------------------------------------
with tag_rows(record_type, record_id, label) as (
  values
    ('partners',        'de300000-0000-0000-0000-0000000000a1'::uuid, 'Harborview Family Advocacy Center'),
    ('partner_stations','de300000-0000-0000-0000-0000000000a2', 'Harborview Main Station'),
    ('people',          'de300000-0000-0000-0000-0000000000b1', 'Devon Marsh (demo navigator)'),
    ('people',          'de300000-0000-0000-0000-0000000000c1', 'Harper Voss (demo partner contact)'),
    ('people',          'de300000-0000-0000-0000-000000000011', 'Selena Vargas (SV)'),
    ('people',          'de300000-0000-0000-0000-000000000021', 'Samuel Park (SP)'),
    ('people',          'de300000-0000-0000-0000-000000000031', 'Sofia Amari (SA)'),
    ('people',          'de300000-0000-0000-0000-000000000041', 'Yusuf Peters (YP-FEP)'),
    ('people',          'de300000-0000-0000-0000-000000000051', 'Ray Rivera (RR)'),
    ('enrollees',       'de300000-0000-0000-0000-000000000012', 'PHX-001 SV'),
    ('enrollees',       'de300000-0000-0000-0000-000000000022', 'PHX-002 SP'),
    ('enrollees',       'de300000-0000-0000-0000-000000000032', 'PHX-003 SA'),
    ('enrollees',       'de300000-0000-0000-0000-000000000042', 'PHX-004 YP-FEP'),
    ('enrollees',       'de300000-0000-0000-0000-000000000052', 'PHX-005 RR'),
    ('enrollments',     'de300000-0000-0000-0000-000000000013', 'PHX-001 SV renewal'),
    ('enrollments',     'de300000-0000-0000-0000-000000000023', 'PHX-002 SP readiness late'),
    ('enrollments',     'de300000-0000-0000-0000-000000000033', 'PHX-003 SA regulation stabilizing'),
    ('enrollments',     'de300000-0000-0000-0000-000000000043', 'PHX-004 YP-FEP readiness early'),
    ('enrollments',     'de300000-0000-0000-0000-000000000053', 'PHX-005 RR regulation entry')
)
insert into atlas.demo_record_tags (tag, record_type, record_id, metadata)
select 'atlas_demo', record_type, record_id, jsonb_build_object('fixture', 'demo_partner_phenotype_seed', 'label', label)
from tag_rows
on conflict (tag, record_type, record_id) do update
set metadata = excluded.metadata;

notify pgrst, 'reload schema';
