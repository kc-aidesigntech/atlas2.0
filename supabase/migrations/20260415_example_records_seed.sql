create extension if not exists pgcrypto;

-- Example dataset design:
-- Partner-side identities:
-- 1. Maya Johnson = North Harbor contact
-- 2. Luis Ortega = WorkSpring partner user/contact
-- 3. Amina Rahman = BridgeLine contact
-- Staff identities:
-- 4. Noah Bennett = navigator
-- 5. Priya Shah = supervisor
-- Enrollee identities:
-- 6. Sandra Morrison = housing arc
-- 7. Marcus Thompson = work arc
-- 8. Elena Rodriguez = social arc

insert into atlas.roles (role_key, role_name)
values
  ('navigator', 'Navigator'),
  ('partner', 'Partner'),
  ('supervisor', 'Supervisor')
on conflict (role_key) do update
set role_name = excluded.role_name;

insert into atlas.people (
  external_ref,
  first_name,
  last_name,
  display_name,
  email,
  phone,
  person_type,
  status
)
values
  ('example-maya-johnson', 'Maya', 'Johnson', 'Maya Johnson', 'maya.johnson@example.atlas', '206-555-0101', 'staff', 'active'),
  ('example-luis-ortega', 'Luis', 'Ortega', 'Luis Ortega', 'luis.ortega@example.atlas', '213-555-0102', 'staff', 'active'),
  ('example-amina-rahman', 'Amina', 'Rahman', 'Amina Rahman', 'amina.rahman@example.atlas', '503-555-0103', 'staff', 'active'),
  ('example-noah-bennett', 'Noah', 'Bennett', 'Noah Bennett', 'noah.bennett@example.atlas', '312-555-0104', 'staff', 'active'),
  ('example-priya-shah', 'Priya', 'Shah', 'Priya Shah', 'priya.shah@example.atlas', '415-555-0105', 'staff', 'active'),
  ('example-sandra-morrison', 'Sandra', 'Morrison', 'Sandra Morrison', 'sandra.morrison@example.atlas', '206-555-0201', 'client', 'active'),
  ('example-marcus-thompson', 'Marcus', 'Thompson', 'Marcus Thompson', 'marcus.thompson@example.atlas', '213-555-0202', 'client', 'active'),
  ('example-elena-rodriguez', 'Elena', 'Rodriguez', 'Elena Rodriguez', 'elena.rodriguez@example.atlas', '503-555-0203', 'client', 'active')
on conflict (external_ref) do update
set first_name = excluded.first_name,
    last_name = excluded.last_name,
    display_name = excluded.display_name,
    email = excluded.email,
    phone = excluded.phone,
    person_type = excluded.person_type,
    status = excluded.status;

insert into atlas.people_role_assignments (id, person_id, role_id, is_primary, starts_on)
values
  (
    '00000000-0000-0000-0000-000000000101',
    (select id from atlas.people where external_ref = 'example-noah-bennett'),
    (select id from atlas.roles where role_key = 'navigator'),
    true,
    date '2026-01-01'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    (select id from atlas.people where external_ref = 'example-luis-ortega'),
    (select id from atlas.roles where role_key = 'partner'),
    true,
    date '2026-01-01'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    (select id from atlas.people where external_ref = 'example-priya-shah'),
    (select id from atlas.roles where role_key = 'supervisor'),
    true,
    date '2026-01-01'
  )
on conflict (id) do update
set person_id = excluded.person_id,
    role_id = excluded.role_id,
    is_primary = excluded.is_primary,
    starts_on = excluded.starts_on;

insert into atlas.countries (iso2, iso3, country_name)
values
  ('US', 'USA', 'United States'),
  ('CA', 'CAN', 'Canada'),
  ('MX', 'MEX', 'Mexico')
on conflict (iso2) do update
set iso3 = excluded.iso3,
    country_name = excluded.country_name;

insert into atlas.states (country_id, state_code, state_name)
values
  ((select id from atlas.countries where iso2 = 'US'), 'WA', 'Washington'),
  ((select id from atlas.countries where iso2 = 'CA'), 'BC', 'British Columbia'),
  ((select id from atlas.countries where iso2 = 'MX'), 'JA', 'Jalisco')
on conflict (country_id, state_code) do update
set state_name = excluded.state_name;

insert into atlas.counties (state_id, county_name, fips_code)
values
  ((select s.id from atlas.states s join atlas.countries c on c.id = s.country_id where c.iso2 = 'US' and s.state_code = 'WA'), 'King County', '53033'),
  ((select s.id from atlas.states s join atlas.countries c on c.id = s.country_id where c.iso2 = 'CA' and s.state_code = 'BC'), 'Metro Vancouver', 'BC-MV'),
  ((select s.id from atlas.states s join atlas.countries c on c.id = s.country_id where c.iso2 = 'MX' and s.state_code = 'JA'), 'Guadalajara', 'MX-JAL-GDL')
on conflict (state_id, county_name) do update
set fips_code = excluded.fips_code;

insert into atlas.addresses (
  id,
  line1,
  line2,
  city,
  county_id,
  state_id,
  country_id,
  postal_code,
  latitude,
  longitude
)
values
  (
    '00000000-0000-0000-0000-000000000201',
    '120 Harbor Way',
    'Suite 200',
    'Seattle',
    (select c.id from atlas.counties c join atlas.states s on s.id = c.state_id where s.state_code = 'WA' and c.county_name = 'King County'),
    (select s.id from atlas.states s where s.state_code = 'WA'),
    (select id from atlas.countries where iso2 = 'US'),
    '98104',
    47.6038,
    -122.3301
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '88 Renewal Avenue',
    null,
    'Vancouver',
    (select c.id from atlas.counties c join atlas.states s on s.id = c.state_id where s.state_code = 'BC' and c.county_name = 'Metro Vancouver'),
    (select s.id from atlas.states s where s.state_code = 'BC'),
    (select id from atlas.countries where iso2 = 'CA'),
    'V6B1A1',
    49.2827,
    -123.1207
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    '45 Camino Comunitario',
    null,
    'Guadalajara',
    (select c.id from atlas.counties c join atlas.states s on s.id = c.state_id where s.state_code = 'JA' and c.county_name = 'Guadalajara'),
    (select s.id from atlas.states s where s.state_code = 'JA'),
    (select id from atlas.countries where iso2 = 'MX'),
    '44100',
    20.6736,
    -103.3440
  )
on conflict (id) do update
set line1 = excluded.line1,
    line2 = excluded.line2,
    city = excluded.city,
    county_id = excluded.county_id,
    state_id = excluded.state_id,
    country_id = excluded.country_id,
    postal_code = excluded.postal_code,
    latitude = excluded.latitude,
    longitude = excluded.longitude;

insert into atlas.partners (
  organization_name,
  organization_name_normalized,
  is_active,
  primary_contact_first_name,
  primary_contact_last_name,
  primary_contact_email
)
values
  ('North Harbor Housing Collaborative', 'north-harbor-housing-collaborative', true, 'Maya', 'Johnson', 'maya.johnson@example.atlas'),
  ('WorkSpring Alliance', 'workspring-alliance', true, 'Luis', 'Ortega', 'luis.ortega@example.atlas'),
  ('BridgeLine Social Support Network', 'bridgeline-social-support-network', true, 'Amina', 'Rahman', 'amina.rahman@example.atlas')
on conflict (organization_name_normalized) do update
set organization_name = excluded.organization_name,
    is_active = excluded.is_active,
    primary_contact_first_name = excluded.primary_contact_first_name,
    primary_contact_last_name = excluded.primary_contact_last_name,
    primary_contact_email = excluded.primary_contact_email;

insert into atlas.partner_stations (
  id,
  partner_id,
  station_name,
  county_id,
  address_id,
  capacity_total,
  capacity_available,
  is_active
)
values
  (
    '00000000-0000-0000-0000-000000000301',
    (select id from atlas.partners where organization_name_normalized = 'north-harbor-housing-collaborative'),
    'North Harbor Housing Hub',
    (select c.id from atlas.counties c where c.county_name = 'King County'),
    '00000000-0000-0000-0000-000000000201',
    42,
    11,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    (select id from atlas.partners where organization_name_normalized = 'workspring-alliance'),
    'WorkSpring Employment Desk',
    (select c.id from atlas.counties c where c.county_name = 'Metro Vancouver'),
    '00000000-0000-0000-0000-000000000202',
    36,
    9,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    (select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'),
    'BridgeLine Community Commons',
    (select c.id from atlas.counties c where c.county_name = 'Guadalajara'),
    '00000000-0000-0000-0000-000000000203',
    51,
    18,
    true
  )
on conflict (id) do update
set partner_id = excluded.partner_id,
    station_name = excluded.station_name,
    county_id = excluded.county_id,
    address_id = excluded.address_id,
    capacity_total = excluded.capacity_total,
    capacity_available = excluded.capacity_available,
    is_active = excluded.is_active;

insert into atlas.partner_station_icons (id, station_id, icon_url, icon_slug, is_primary)
values
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301', 'https://example.atlas/icons/housing-hub.png', 'housing', true),
  ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000302', 'https://example.atlas/icons/work-desk.png', 'work', true),
  ('00000000-0000-0000-0000-000000000313', '00000000-0000-0000-0000-000000000303', 'https://example.atlas/icons/community-commons.png', 'social', true)
on conflict (id) do update
set station_id = excluded.station_id,
    icon_url = excluded.icon_url,
    icon_slug = excluded.icon_slug,
    is_primary = excluded.is_primary;

insert into atlas.enrollees (
  id,
  person_id,
  case_id,
  dob,
  avatar_url,
  current_phase,
  county_id
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    (select id from atlas.people where external_ref = 'example-sandra-morrison'),
    'ATLAS-EX-001',
    date '1989-03-15',
    'https://example.atlas/avatars/sandra-morrison.png',
    'regulation',
    (select id from atlas.counties where county_name = 'King County')
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    (select id from atlas.people where external_ref = 'example-marcus-thompson'),
    'ATLAS-EX-002',
    date '1995-07-22',
    'https://example.atlas/avatars/marcus-thompson.png',
    'readiness',
    (select id from atlas.counties where county_name = 'Metro Vancouver')
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    (select id from atlas.people where external_ref = 'example-elena-rodriguez'),
    'ATLAS-EX-003',
    date '2001-11-08',
    'https://example.atlas/avatars/elena-rodriguez.png',
    'renewal',
    (select id from atlas.counties where county_name = 'Guadalajara')
  )
on conflict (id) do update
set person_id = excluded.person_id,
    case_id = excluded.case_id,
    dob = excluded.dob,
    avatar_url = excluded.avatar_url,
    current_phase = excluded.current_phase,
    county_id = excluded.county_id;

insert into atlas.enrollment_requests (id, person_id, submitted_at, status, source, notes)
values
  (
    '00000000-0000-0000-0000-000000000501',
    (select id from atlas.people where external_ref = 'example-sandra-morrison'),
    timestamptz '2026-01-03T09:00:00Z',
    'pending',
    'referral_portal',
    'Housing stabilization intake still awaiting formal triage.'
  ),
  (
    '00000000-0000-0000-0000-000000000502',
    (select id from atlas.people where external_ref = 'example-marcus-thompson'),
    timestamptz '2026-01-04T11:30:00Z',
    'accepted',
    'community_referral',
    'Employment restoration request accepted from workforce partner.'
  ),
  (
    '00000000-0000-0000-0000-000000000503',
    (select id from atlas.people where external_ref = 'example-elena-rodriguez'),
    timestamptz '2026-01-05T15:45:00Z',
    'accepted',
    'court_diversion',
    'Social reintegration intake accepted for active supervision.'
  )
on conflict (id) do update
set person_id = excluded.person_id,
    submitted_at = excluded.submitted_at,
    status = excluded.status,
    source = excluded.source,
    notes = excluded.notes;

insert into atlas.enrollments (
  id,
  enrollee_id,
  start_date,
  target_duration_months,
  expected_end_date,
  status,
  created_at
)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000401', date '2026-01-10', 9, date '2026-10-10', 'active', timestamptz '2026-01-10T09:00:00Z'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000402', date '2026-01-12', 9, date '2026-10-12', 'active', timestamptz '2026-01-12T09:00:00Z'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000403', date '2026-01-15', 9, date '2026-10-15', 'active', timestamptz '2026-01-15T09:00:00Z')
on conflict (id) do update
set enrollee_id = excluded.enrollee_id,
    start_date = excluded.start_date,
    target_duration_months = excluded.target_duration_months,
    expected_end_date = excluded.expected_end_date,
    status = excluded.status,
    created_at = excluded.created_at;

insert into atlas.navigator_assignments (id, enrollment_id, navigator_person_id, station_id, starts_on, ends_on)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000601', (select id from atlas.people where external_ref = 'example-noah-bennett'), '00000000-0000-0000-0000-000000000301', date '2026-01-10', null),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000602', (select id from atlas.people where external_ref = 'example-noah-bennett'), '00000000-0000-0000-0000-000000000302', date '2026-01-12', null),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000603', (select id from atlas.people where external_ref = 'example-noah-bennett'), '00000000-0000-0000-0000-000000000303', date '2026-01-15', null)
on conflict (id) do update
set enrollment_id = excluded.enrollment_id,
    navigator_person_id = excluded.navigator_person_id,
    station_id = excluded.station_id,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;

insert into atlas.z_codes (z_code, z_group, title, description, is_active)
values
  ('Z59.1', 59, 'Inadequate Housing', 'Housing quality or stability is insufficient for healthy living.', true),
  ('Z56.2', 56, 'Threat of Job Loss', 'Employment is unstable and a loss of work is imminent.', true),
  ('Z60.4', 60, 'Social Exclusion or Rejection', 'The person is isolated, excluded, or actively rejected in their environment.', true)
on conflict (z_code) do update
set z_group = excluded.z_group,
    title = excluded.title,
    description = excluded.description,
    is_active = excluded.is_active;

insert into atlas.z_code_categories (category_key, category_name)
values
  ('habitat', 'Habitat'),
  ('work', 'Work'),
  ('social_network', 'Social Network')
on conflict (category_key) do update
set category_name = excluded.category_name;

insert into atlas.z_code_category_map (z_code_id, category_id, weight)
values
  (
    (select id from atlas.z_codes where z_code = 'Z59.1'),
    (select id from atlas.z_code_categories where category_key = 'habitat'),
    1.0
  ),
  (
    (select id from atlas.z_codes where z_code = 'Z56.2'),
    (select id from atlas.z_code_categories where category_key = 'work'),
    1.0
  ),
  (
    (select id from atlas.z_codes where z_code = 'Z60.4'),
    (select id from atlas.z_code_categories where category_key = 'social_network'),
    1.0
  )
on conflict (z_code_id, category_id) do update
set weight = excluded.weight;

insert into atlas.enrollee_z_codes (id, enrollment_id, z_code_id, is_resolved, resolution_at, source, effective_at, ended_at)
values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000601', (select id from atlas.z_codes where z_code = 'Z59.1'), false, null, 'manual', timestamptz '2026-01-10T12:00:00Z', null),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000602', (select id from atlas.z_codes where z_code = 'Z56.2'), false, null, 'manual', timestamptz '2026-01-12T12:00:00Z', null),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000603', (select id from atlas.z_codes where z_code = 'Z60.4'), false, null, 'manual', timestamptz '2026-01-15T12:00:00Z', null)
on conflict (id) do update
set enrollment_id = excluded.enrollment_id,
    z_code_id = excluded.z_code_id,
    is_resolved = excluded.is_resolved,
    resolution_at = excluded.resolution_at,
    source = excluded.source,
    effective_at = excluded.effective_at,
    ended_at = excluded.ended_at;

insert into atlas.partner_z_code_capabilities (
  partner_id,
  z_code_id,
  relation_type,
  strength,
  source,
  source_submitted_at,
  is_active
)
values
  ((select id from atlas.partners where organization_name_normalized = 'north-harbor-housing-collaborative'), (select id from atlas.z_codes where z_code = 'Z59.1'), 'specialize', 0.93, 'survey', timestamptz '2026-02-01T09:00:00Z', true),
  ((select id from atlas.partners where organization_name_normalized = 'workspring-alliance'), (select id from atlas.z_codes where z_code = 'Z56.2'), 'specialize', 0.88, 'survey', timestamptz '2026-02-02T09:00:00Z', true),
  ((select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'), (select id from atlas.z_codes where z_code = 'Z60.4'), 'specialize', 0.84, 'survey', timestamptz '2026-02-03T09:00:00Z', true)
on conflict (partner_id, z_code_id, relation_type, source) do update
set strength = excluded.strength,
    source_submitted_at = excluded.source_submitted_at,
    is_active = excluded.is_active;

insert into atlas.referrals (
  id,
  enrollment_id,
  referred_by_person_id,
  station_id,
  z_code_id,
  status,
  priority,
  referred_at
)
values
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000601', (select id from atlas.people where external_ref = 'example-priya-shah'), '00000000-0000-0000-0000-000000000301', (select id from atlas.z_codes where z_code = 'Z59.1'), 'in_progress', 'high', timestamptz '2026-01-11T14:00:00Z'),
  ('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000602', (select id from atlas.people where external_ref = 'example-priya-shah'), '00000000-0000-0000-0000-000000000302', (select id from atlas.z_codes where z_code = 'Z56.2'), 'accepted', 'medium', timestamptz '2026-01-13T10:30:00Z'),
  ('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000603', (select id from atlas.people where external_ref = 'example-priya-shah'), '00000000-0000-0000-0000-000000000303', (select id from atlas.z_codes where z_code = 'Z60.4'), 'completed', 'medium', timestamptz '2026-01-16T16:15:00Z')
on conflict (id) do update
set enrollment_id = excluded.enrollment_id,
    referred_by_person_id = excluded.referred_by_person_id,
    station_id = excluded.station_id,
    z_code_id = excluded.z_code_id,
    status = excluded.status,
    priority = excluded.priority,
    referred_at = excluded.referred_at;

insert into atlas.route_plans (id, enrollment_id, created_by_person_id, status, created_at)
values
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000601', (select id from atlas.people where external_ref = 'example-noah-bennett'), 'draft', timestamptz '2026-01-11T09:30:00Z'),
  ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000602', (select id from atlas.people where external_ref = 'example-noah-bennett'), 'active', timestamptz '2026-01-13T09:30:00Z'),
  ('00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000603', (select id from atlas.people where external_ref = 'example-noah-bennett'), 'completed', timestamptz '2026-01-16T09:30:00Z')
on conflict (id) do update
set enrollment_id = excluded.enrollment_id,
    created_by_person_id = excluded.created_by_person_id,
    status = excluded.status,
    created_at = excluded.created_at;

insert into atlas.route_plan_stops (id, route_plan_id, station_id, z_code_id, stop_order, assigned_date, target_date, status)
values
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000301', (select id from atlas.z_codes where z_code = 'Z59.1'), 1, date '2026-01-12', date '2026-01-19', 'planned'),
  ('00000000-0000-0000-0000-000000001102', '00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000302', (select id from atlas.z_codes where z_code = 'Z56.2'), 1, date '2026-01-14', date '2026-01-21', 'active'),
  ('00000000-0000-0000-0000-000000001103', '00000000-0000-0000-0000-000000001003', '00000000-0000-0000-0000-000000000303', (select id from atlas.z_codes where z_code = 'Z60.4'), 1, date '2026-01-17', date '2026-01-24', 'completed')
on conflict (id) do update
set route_plan_id = excluded.route_plan_id,
    station_id = excluded.station_id,
    z_code_id = excluded.z_code_id,
    stop_order = excluded.stop_order,
    assigned_date = excluded.assigned_date,
    target_date = excluded.target_date,
    status = excluded.status;

insert into atlas.journey_logs (
  id,
  enrollment_id,
  route_plan_stop_id,
  milestone_type,
  phase,
  label,
  happened_at,
  station_icon_slug,
  domains_relieved,
  created_by_person_id
)
values
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000001101', 'intervention', 'regulation', 'Emergency housing packet opened and first landlord mediation scheduled.', timestamptz '2026-01-12T17:00:00Z', 'housing', '{habitat,socialNetworks}', (select id from atlas.people where external_ref = 'example-noah-bennett')),
  ('00000000-0000-0000-0000-000000001202', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000001102', 'verifiedMilestone', 'readiness', 'Employer retention plan confirmed and shift stability restored.', timestamptz '2026-01-15T17:00:00Z', 'work', '{work}', (select id from atlas.people where external_ref = 'example-noah-bennett')),
  ('00000000-0000-0000-0000-000000001203', '00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000001103', 'sustainedChange', 'renewal', 'Peer support circle joined with documented weekly attendance.', timestamptz '2026-01-20T17:00:00Z', 'social', '{socialNetworks}', (select id from atlas.people where external_ref = 'example-priya-shah'))
on conflict (id) do update
set enrollment_id = excluded.enrollment_id,
    route_plan_stop_id = excluded.route_plan_stop_id,
    milestone_type = excluded.milestone_type,
    phase = excluded.phase,
    label = excluded.label,
    happened_at = excluded.happened_at,
    station_icon_slug = excluded.station_icon_slug,
    domains_relieved = excluded.domains_relieved,
    created_by_person_id = excluded.created_by_person_id;

insert into atlas.timeline_settings (id, enrollment_id, plan_start_date, duration_months, regulation_cutoff_month, readiness_cutoff_month, updated_at)
values
  ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000000601', date '2026-01-10', 9, 2, 4, timestamptz '2026-01-10T08:00:00Z'),
  ('00000000-0000-0000-0000-000000001302', '00000000-0000-0000-0000-000000000602', date '2026-01-12', 9, 2, 4, timestamptz '2026-01-12T08:00:00Z'),
  ('00000000-0000-0000-0000-000000001303', '00000000-0000-0000-0000-000000000603', date '2026-01-15', 9, 2, 4, timestamptz '2026-01-15T08:00:00Z')
on conflict (enrollment_id) do update
set plan_start_date = excluded.plan_start_date,
    duration_months = excluded.duration_months,
    regulation_cutoff_month = excluded.regulation_cutoff_month,
    readiness_cutoff_month = excluded.readiness_cutoff_month,
    updated_at = excluded.updated_at;

insert into atlas.station_metric_snapshots (
  id,
  station_id,
  snapshot_at,
  active_enrollments,
  z_codes_resolved_count,
  habitat_load,
  work_load,
  social_network_load
)
values
  ('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000000301', timestamptz '2026-02-01T00:00:00Z', 7, 3, 82, 24, 31),
  ('00000000-0000-0000-0000-000000001402', '00000000-0000-0000-0000-000000000302', timestamptz '2026-02-01T00:00:00Z', 6, 4, 22, 79, 28),
  ('00000000-0000-0000-0000-000000001403', '00000000-0000-0000-0000-000000000303', timestamptz '2026-02-01T00:00:00Z', 9, 5, 30, 27, 86)
on conflict (id) do update
set station_id = excluded.station_id,
    snapshot_at = excluded.snapshot_at,
    active_enrollments = excluded.active_enrollments,
    z_codes_resolved_count = excluded.z_codes_resolved_count,
    habitat_load = excluded.habitat_load,
    work_load = excluded.work_load,
    social_network_load = excluded.social_network_load;

insert into atlas.audit_events (id, actor_person_id, event_type, entity_name, entity_id, payload, created_at)
values
  ('00000000-0000-0000-0000-000000001501', (select id from atlas.people where external_ref = 'example-priya-shah'), 'INSERT', 'referrals', '00000000-0000-0000-0000-000000000901', '{"scenario":"housing_arc","note":"Initial high-priority housing referral created."}'::jsonb, timestamptz '2026-01-11T14:05:00Z'),
  ('00000000-0000-0000-0000-000000001502', (select id from atlas.people where external_ref = 'example-noah-bennett'), 'UPDATE', 'route_plan_stops', '00000000-0000-0000-0000-000000001102', '{"scenario":"work_arc","note":"Route stop advanced from planned to active."}'::jsonb, timestamptz '2026-01-14T10:00:00Z'),
  ('00000000-0000-0000-0000-000000001503', (select id from atlas.people where external_ref = 'example-luis-ortega'), 'INSERT', 'partner_service_capacity_submissions', 'example-submission-luis', '{"scenario":"partner_survey","note":"WorkSpring service-capacity survey captured."}'::jsonb, timestamptz '2026-02-02T10:15:00Z')
on conflict (id) do update
set actor_person_id = excluded.actor_person_id,
    event_type = excluded.event_type,
    entity_name = excluded.entity_name,
    entity_id = excluded.entity_id,
    payload = excluded.payload,
    created_at = excluded.created_at;

insert into atlas.profile_images (
  id,
  enrollee_id,
  uploaded_by_person_id,
  storage_bucket,
  storage_path,
  public_url,
  original_filename,
  mime_type,
  file_size_bytes,
  width_px,
  height_px,
  checksum_sha256,
  intake_source,
  intake_status,
  is_primary,
  alt_text,
  metadata,
  ready_at
)
values
  (
    '00000000-0000-0000-0000-000000001601',
    '00000000-0000-0000-0000-000000000401',
    (select id from atlas.people where external_ref = 'example-priya-shah'),
    'profile-images',
    'examples/sandra-morrison-primary.png',
    'https://example.atlas/avatars/sandra-morrison.png',
    'sandra-morrison.png',
    'image/png',
    182044,
    512,
    512,
    'sha256-sandra-example',
    'seed',
    'ready',
    true,
    'Portrait of Sandra Morrison.',
    '{"scenario":"housing_arc"}'::jsonb,
    timestamptz '2026-01-10T10:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000001602',
    '00000000-0000-0000-0000-000000000402',
    (select id from atlas.people where external_ref = 'example-priya-shah'),
    'profile-images',
    'examples/marcus-thompson-primary.png',
    'https://example.atlas/avatars/marcus-thompson.png',
    'marcus-thompson.png',
    'image/png',
    190812,
    512,
    512,
    'sha256-marcus-example',
    'seed',
    'ready',
    true,
    'Portrait of Marcus Thompson.',
    '{"scenario":"work_arc"}'::jsonb,
    timestamptz '2026-01-12T10:00:00Z'
  ),
  (
    '00000000-0000-0000-0000-000000001603',
    '00000000-0000-0000-0000-000000000403',
    (select id from atlas.people where external_ref = 'example-priya-shah'),
    'profile-images',
    'examples/elena-rodriguez-primary.png',
    'https://example.atlas/avatars/elena-rodriguez.png',
    'elena-rodriguez.png',
    'image/png',
    176550,
    512,
    512,
    'sha256-elena-example',
    'seed',
    'ready',
    true,
    'Portrait of Elena Rodriguez.',
    '{"scenario":"social_arc"}'::jsonb,
    timestamptz '2026-01-15T10:00:00Z'
  )
on conflict (id) do update
set enrollee_id = excluded.enrollee_id,
    uploaded_by_person_id = excluded.uploaded_by_person_id,
    storage_bucket = excluded.storage_bucket,
    storage_path = excluded.storage_path,
    public_url = excluded.public_url,
    original_filename = excluded.original_filename,
    mime_type = excluded.mime_type,
    file_size_bytes = excluded.file_size_bytes,
    width_px = excluded.width_px,
    height_px = excluded.height_px,
    checksum_sha256 = excluded.checksum_sha256,
    intake_source = excluded.intake_source,
    intake_status = excluded.intake_status,
    is_primary = excluded.is_primary,
    alt_text = excluded.alt_text,
    metadata = excluded.metadata,
    ready_at = excluded.ready_at;

insert into atlas.permissions (permission_key, description)
values
  ('partner_capacity_submissions.read', 'Read partner capacity submissions and derived records.'),
  ('partner_capacity_submissions.write', 'Create and update partner capacity submissions and derived records.'),
  ('partner_capacity_submissions.delete', 'Delete partner capacity submissions and derived records.')
on conflict (permission_key) do update
set description = excluded.description;

insert into atlas.role_permissions (role_id, permission_id)
select r.id, p.id
from (
  values
    ('navigator', 'partner_capacity_submissions.read'),
    ('partner', 'partner_capacity_submissions.read'),
    ('partner', 'partner_capacity_submissions.write')
) as pairs(role_key, permission_key)
join atlas.roles r on r.role_key = pairs.role_key
join atlas.permissions p on p.permission_key = pairs.permission_key
on conflict (role_id, permission_id) do nothing;

insert into atlas.user_permission_exceptions (
  id,
  person_id,
  permission_id,
  effect,
  reason,
  starts_at,
  ends_at,
  created_by_person_id
)
values
  (
    '00000000-0000-0000-0000-000000001701',
    (select id from atlas.people where external_ref = 'example-noah-bennett'),
    (select id from atlas.permissions where permission_key = 'partner_capacity_submissions.write'),
    'allow',
    'Navigator override to enter joint partner survey drafts during commissioning.',
    timestamptz '2026-02-01T00:00:00Z',
    null,
    (select id from atlas.people where external_ref = 'example-priya-shah')
  ),
  (
    '00000000-0000-0000-0000-000000001702',
    (select id from atlas.people where external_ref = 'example-luis-ortega'),
    (select id from atlas.permissions where permission_key = 'partner_capacity_submissions.delete'),
    'deny',
    'Example partner account is prevented from deleting submissions during demonstration.',
    timestamptz '2026-02-01T00:00:00Z',
    null,
    (select id from atlas.people where external_ref = 'example-priya-shah')
  ),
  (
    '00000000-0000-0000-0000-000000001703',
    (select id from atlas.people where external_ref = 'example-priya-shah'),
    (select id from atlas.permissions where permission_key = 'partner_capacity_submissions.delete'),
    'allow',
    'Supervisor receives elevated cleanup rights for commissioning exercises.',
    timestamptz '2026-02-01T00:00:00Z',
    null,
    (select id from atlas.people where external_ref = 'example-priya-shah')
  )
on conflict (id) do update
set person_id = excluded.person_id,
    permission_id = excluded.permission_id,
    effect = excluded.effect,
    reason = excluded.reason,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    created_by_person_id = excluded.created_by_person_id;

insert into atlas.authorization_settings (setting_key, enabled, description)
values
  ('allow_legacy_public_partner_capacity_read', true, 'Example dataset keeps partner-capacity reads public during commissioning.'),
  ('allow_legacy_public_partner_capacity_write', true, 'Example dataset keeps partner-capacity writes public during commissioning.'),
  ('allow_legacy_public_partner_capacity_delete', true, 'Example dataset keeps partner-capacity deletes public during commissioning.')
on conflict (setting_key) do update
set enabled = excluded.enabled,
    description = excluded.description,
    updated_at = now();

insert into atlas.partner_service_capacity_submissions (
  partner_id,
  organization_name,
  organization_name_normalized,
  respondent_first_name,
  respondent_last_name,
  respondent_email,
  job_title,
  respondent_roles,
  other_role_text,
  form_version,
  raw_payload,
  submitted_at,
  draft_key,
  status,
  completed_at
)
values
  (
    (select id from atlas.partners where organization_name_normalized = 'north-harbor-housing-collaborative'),
    'North Harbor Housing Collaborative',
    'north-harbor-housing-collaborative',
    'Maya',
    'Johnson',
    'maya.johnson@example.atlas',
    'Housing Systems Liaison',
    '{direct_service_provider}',
    null,
    '2026-z-burden-v1',
    '{"scenario":"housing_arc","note":"Completed example housing survey."}'::jsonb,
    timestamptz '2026-02-01T09:30:00Z',
    'example-submission-maya',
    'completed',
    timestamptz '2026-02-01T09:30:00Z'
  ),
  (
    (select id from atlas.partners where organization_name_normalized = 'workspring-alliance'),
    'WorkSpring Alliance',
    'workspring-alliance',
    'Luis',
    'Ortega',
    'luis.ortega@example.atlas',
    'Employment Access Lead',
    '{direct_service_provider}',
    null,
    '2026-z-burden-v1',
    '{"scenario":"work_arc","note":"Completed example employment survey."}'::jsonb,
    timestamptz '2026-02-02T09:30:00Z',
    'example-submission-luis',
    'completed',
    timestamptz '2026-02-02T09:30:00Z'
  ),
  (
    (select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'),
    'BridgeLine Social Support Network',
    'bridgeline-social-support-network',
    'Amina',
    'Rahman',
    'amina.rahman@example.atlas',
    'Community Reintegration Supervisor',
    '{administrator,other}',
    'cross-system coordinator',
    '2026-z-burden-v1',
    '{"scenario":"social_arc","note":"Draft example social-support survey."}'::jsonb,
    timestamptz '2026-02-03T09:30:00Z',
    'example-submission-amina',
    'draft',
    null
  )
on conflict (draft_key) do update
set partner_id = excluded.partner_id,
    organization_name = excluded.organization_name,
    organization_name_normalized = excluded.organization_name_normalized,
    respondent_first_name = excluded.respondent_first_name,
    respondent_last_name = excluded.respondent_last_name,
    respondent_email = excluded.respondent_email,
    job_title = excluded.job_title,
    respondent_roles = excluded.respondent_roles,
    other_role_text = excluded.other_role_text,
    form_version = excluded.form_version,
    raw_payload = excluded.raw_payload,
    submitted_at = excluded.submitted_at,
    status = excluded.status,
    completed_at = excluded.completed_at;

insert into atlas.partner_service_capacity_answers (
  submission_id,
  prompt_id,
  parent_code,
  z_code,
  normalized_z_code,
  title,
  description,
  burden_score
)
values
  (
    (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-maya'),
    'z59-1',
    'Z59',
    'Z59.1',
    'Z59.1',
    'Z59.1',
    'Inadequate Housing',
    9
  ),
  (
    (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-luis'),
    'z56-2',
    'Z56',
    'Z56.2',
    'Z56.2',
    'Z56.2',
    'Threat of Job Loss',
    8
  ),
  (
    (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-amina'),
    'z60-4',
    'Z60',
    'Z60.4',
    'Z60.4',
    'Z60.4',
    'Social Exclusion or Rejection',
    7
  )
on conflict (submission_id, prompt_id) do update
set parent_code = excluded.parent_code,
    z_code = excluded.z_code,
    normalized_z_code = excluded.normalized_z_code,
    title = excluded.title,
    description = excluded.description,
    burden_score = excluded.burden_score;

insert into atlas.partner_z_code_burden_scores (
  partner_id,
  submission_id,
  z_code_id,
  z_code,
  burden_score,
  derived_relation_type,
  strength
)
values
  (
    (select id from atlas.partners where organization_name_normalized = 'north-harbor-housing-collaborative'),
    (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-maya'),
    (select id from atlas.z_codes where z_code = 'Z59.1'),
    'Z59.1',
    9,
    'specialize',
    1.0
  ),
  (
    (select id from atlas.partners where organization_name_normalized = 'workspring-alliance'),
    (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-luis'),
    (select id from atlas.z_codes where z_code = 'Z56.2'),
    'Z56.2',
    8,
    'specialize',
    0.6667
  ),
  (
    (select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'),
    (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-amina'),
    (select id from atlas.z_codes where z_code = 'Z60.4'),
    'Z60.4',
    7,
    'specialize',
    0.3333
  )
on conflict (partner_id, z_code_id) do update
set submission_id = excluded.submission_id,
    z_code = excluded.z_code,
    burden_score = excluded.burden_score,
    derived_relation_type = excluded.derived_relation_type,
    strength = excluded.strength;

insert into atlas.supervisor_navigator_assignments (
  id,
  supervisor_person_id,
  navigator_person_id,
  starts_on,
  ends_on
)
values
  ('00000000-0000-0000-0000-000000001801', (select id from atlas.people where external_ref = 'example-priya-shah'), (select id from atlas.people where external_ref = 'example-noah-bennett'), date '2026-01-01', null),
  ('00000000-0000-0000-0000-000000001802', (select id from atlas.people where external_ref = 'example-priya-shah'), (select id from atlas.people where external_ref = 'example-noah-bennett'), date '2026-02-01', null),
  ('00000000-0000-0000-0000-000000001803', (select id from atlas.people where external_ref = 'example-priya-shah'), (select id from atlas.people where external_ref = 'example-noah-bennett'), date '2026-03-01', null)
on conflict (id) do update
set supervisor_person_id = excluded.supervisor_person_id,
    navigator_person_id = excluded.navigator_person_id,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;

insert into atlas.navigator_competency_assessments (
  id,
  supervisor_person_id,
  navigator_person_id,
  form_version,
  assessed_at,
  notes,
  created_at
)
values
  ('00000000-0000-0000-0000-000000001901', (select id from atlas.people where external_ref = 'example-priya-shah'), (select id from atlas.people where external_ref = 'example-noah-bennett'), 'v1', timestamptz '2026-02-10T10:00:00Z', 'Initial housing-focused competency check.', timestamptz '2026-02-10T10:00:00Z'),
  ('00000000-0000-0000-0000-000000001902', (select id from atlas.people where external_ref = 'example-priya-shah'), (select id from atlas.people where external_ref = 'example-noah-bennett'), 'v1', timestamptz '2026-03-10T10:00:00Z', 'Mid-cycle employment stabilization review.', timestamptz '2026-03-10T10:00:00Z'),
  ('00000000-0000-0000-0000-000000001903', (select id from atlas.people where external_ref = 'example-priya-shah'), (select id from atlas.people where external_ref = 'example-noah-bennett'), 'v1', timestamptz '2026-04-10T10:00:00Z', 'Social reintegration and follow-through review.', timestamptz '2026-04-10T10:00:00Z')
on conflict (id) do update
set supervisor_person_id = excluded.supervisor_person_id,
    navigator_person_id = excluded.navigator_person_id,
    form_version = excluded.form_version,
    assessed_at = excluded.assessed_at,
    notes = excluded.notes,
    created_at = excluded.created_at;

insert into atlas.navigator_competency_assessment_answers (
  id,
  assessment_id,
  parent_code,
  z_code,
  normalized_z_code,
  title,
  description,
  competency_score
)
values
  ('00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000001901', 'Z59', 'Z59.1', 'Z59.1', 'Housing stabilization triage', 'Assesses ability to stabilize acute housing pressure.', 6),
  ('00000000-0000-0000-0000-000000002002', '00000000-0000-0000-0000-000000001902', 'Z56', 'Z56.2', 'Z56.2', 'Employment retention planning', 'Assesses ability to reduce risk of job loss.', 7),
  ('00000000-0000-0000-0000-000000002003', '00000000-0000-0000-0000-000000001903', 'Z60', 'Z60.4', 'Z60.4', 'Social reintegration coaching', 'Assesses ability to respond to exclusion and isolation.', 8)
on conflict (id) do update
set assessment_id = excluded.assessment_id,
    parent_code = excluded.parent_code,
    z_code = excluded.z_code,
    normalized_z_code = excluded.normalized_z_code,
    title = excluded.title,
    description = excluded.description,
    competency_score = excluded.competency_score;

insert into atlas.app_role_navigation (surface, role_key, top_menus, action_menus, metadata)
values
  ('example_shell', 'navigator', '["example housing","example work","example social"]'::jsonb, '["log contact","escalate risk"]'::jsonb, '{"purpose":"documentation example"}'::jsonb),
  ('example_shell', 'partner', '["capacity overview","partner queue","county commons"]'::jsonb, '["submit service update","request support"]'::jsonb, '{"purpose":"documentation example"}'::jsonb),
  ('example_shell', 'supervisor', '["navigator coaching","team burden","governance review"]'::jsonb, '["record assessment","review exceptions"]'::jsonb, '{"purpose":"documentation example"}'::jsonb)
on conflict (surface, role_key) do update
set top_menus = excluded.top_menus,
    action_menus = excluded.action_menus,
    metadata = excluded.metadata;

insert into atlas.app_config_documents (surface, config_key, version, payload)
values
  ('example_shell', 'case_pack_housing', '2026-demo-v1', '{"record":"maya","focus":"housing stabilization","domain":"habitat"}'::jsonb),
  ('example_shell', 'case_pack_work', '2026-demo-v1', '{"record":"luis","focus":"employment protection","domain":"work"}'::jsonb),
  ('example_shell', 'case_pack_social', '2026-demo-v1', '{"record":"amina","focus":"social reintegration","domain":"socialNetworks"}'::jsonb)
on conflict (surface, config_key, version) do update
set payload = excluded.payload;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'atlas'
      and table_name = 'route_builder_bom_items'
  ) then
    insert into atlas.route_builder_bom_items (id, title, domain, description, required, default_duration_days, is_active)
    values
      ('example-bom-housing', 'housing lock-in', 'habitat', 'Demonstrates a housing-first stabilization BOM item.', true, 5, true),
      ('example-bom-work', 'employment retention', 'work', 'Demonstrates a work-readiness BOM item.', true, 7, true),
      ('example-bom-social', 'community reconnection', 'socialNetworks', 'Demonstrates a social-support BOM item.', false, 10, true)
    on conflict (id) do update
    set title = excluded.title,
        domain = excluded.domain,
        description = excluded.description,
        required = excluded.required,
        default_duration_days = excluded.default_duration_days,
        is_active = excluded.is_active;

    insert into atlas.route_builder_steps (id, bom_item_id, label, phase, instruction, owner_role, exit_criteria, sequence, is_active)
    values
      ('example-step-housing', 'example-bom-housing', 'secure temporary shelter', 'regulation', 'Coordinate same-day housing placement and confirm first safe night.', 'navigator', 'Stable shelter documented.', 1, true),
      ('example-step-work', 'example-bom-work', 'prevent employment loss', 'readiness', 'Contact employer, align attendance plan, and stabilize schedule.', 'navigator', 'Job retained for two weeks.', 2, true),
      ('example-step-social', 'example-bom-social', 'join support circle', 'renewal', 'Connect participant to recurring peer support and verify attendance.', 'supervisor', 'Three attended sessions recorded.', 3, true)
    on conflict (id) do update
    set bom_item_id = excluded.bom_item_id,
        label = excluded.label,
        phase = excluded.phase,
        instruction = excluded.instruction,
        owner_role = excluded.owner_role,
        exit_criteria = excluded.exit_criteria,
        sequence = excluded.sequence,
        is_active = excluded.is_active;

    insert into atlas.route_builder_templates (id, name, description, target_phase, bom_item_ids, step_ids, is_core, is_active)
    values
      ('example-template-housing', 'housing-first template', 'Example template for regulation-stage housing pressure.', 'regulation', '{example-bom-housing}', '{example-step-housing}', true, true),
      ('example-template-work', 'employment retention template', 'Example template for readiness-stage work pressure.', 'readiness', '{example-bom-work}', '{example-step-work}', true, true),
      ('example-template-social', 'social reconnection template', 'Example template for renewal-stage social pressure.', 'renewal', '{example-bom-social}', '{example-step-social}', false, true)
    on conflict (id) do update
    set name = excluded.name,
        description = excluded.description,
        target_phase = excluded.target_phase,
        bom_item_ids = excluded.bom_item_ids,
        step_ids = excluded.step_ids,
        is_core = excluded.is_core,
        is_active = excluded.is_active;

    insert into atlas.route_builder_journey_assignments (
      id,
      enrollment_id,
      template_id,
      step_ids,
      status,
      current_step_index,
      started_at,
      created_at,
      updated_at
    )
    values
      ('example-journey-housing', '00000000-0000-0000-0000-000000000601', 'example-template-housing', '{example-step-housing}', 'draft', 0, timestamptz '2026-01-11T08:00:00Z', timestamptz '2026-01-11T08:00:00Z', timestamptz '2026-01-11T08:00:00Z'),
      ('example-journey-work', '00000000-0000-0000-0000-000000000602', 'example-template-work', '{example-step-work}', 'active', 0, timestamptz '2026-01-13T08:00:00Z', timestamptz '2026-01-13T08:00:00Z', timestamptz '2026-01-13T08:00:00Z'),
      ('example-journey-social', '00000000-0000-0000-0000-000000000603', 'example-template-social', '{example-step-social}', 'completed', 1, timestamptz '2026-01-16T08:00:00Z', timestamptz '2026-01-16T08:00:00Z', timestamptz '2026-01-20T08:00:00Z')
    on conflict (id) do update
    set enrollment_id = excluded.enrollment_id,
        template_id = excluded.template_id,
        step_ids = excluded.step_ids,
        status = excluded.status,
        current_step_index = excluded.current_step_index,
        started_at = excluded.started_at,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'atlas'
      and table_name = 'legacy_atlas_participants'
  ) then
    insert into atlas.legacy_atlas_participants (
      participant_id,
      county_id,
      display_name,
      current_phase,
      phase_readiness,
      pressure_vectors,
      constraint_flags,
      active_route_id
    )
    values
      ('legacy-example-sandra', 'king-county', 'Legacy Sandra Morrison', 'Regulation', 0.34, '[{"domain":"habitat","severity":0.86}]'::jsonb, '{housing_pressure}', 'legacy-route-sandra'),
      ('legacy-example-marcus', 'metro-vancouver', 'Legacy Marcus Thompson', 'Readiness', 0.58, '[{"domain":"work","severity":0.77}]'::jsonb, '{work_pressure}', 'legacy-route-marcus'),
      ('legacy-example-elena', 'guadalajara', 'Legacy Elena Rodriguez', 'Renewal', 0.82, '[{"domain":"socialNetworks","severity":0.63}]'::jsonb, '{social_pressure}', 'legacy-route-elena')
    on conflict (participant_id) do update
    set county_id = excluded.county_id,
        display_name = excluded.display_name,
        current_phase = excluded.current_phase,
        phase_readiness = excluded.phase_readiness,
        pressure_vectors = excluded.pressure_vectors,
        constraint_flags = excluded.constraint_flags,
        active_route_id = excluded.active_route_id;

    insert into atlas.legacy_atlas_capacity_nodes (
      partner_id,
      label,
      route_class,
      coverage_score,
      phase_alignment,
      specialization_score,
      reversibility_support,
      transfer_cost,
      interference_risk,
      phase_index,
      domain,
      primary_domain,
      domain_coverage,
      blockers
    )
    values
      ('legacy-node-housing', 'Legacy Housing Node', 'stabilization', 0.84, 0.90, 0.88, 0.76, 0.21, 0.12, 0, 'habitat', 'habitat', '{habitat}', '{landlord_conflict}'),
      ('legacy-node-work', 'Legacy Work Node', 'readiness', 0.79, 0.82, 0.87, 0.72, 0.24, 0.19, 1, 'work', 'work', '{work}', '{schedule_fragility}'),
      ('legacy-node-social', 'Legacy Social Node', 'renewal', 0.76, 0.84, 0.81, 0.69, 0.18, 0.15, 2, 'socialNetworks', 'socialNetworks', '{socialNetworks}', '{trust_repair}')
    on conflict (partner_id) do update
    set label = excluded.label,
        route_class = excluded.route_class,
        coverage_score = excluded.coverage_score,
        phase_alignment = excluded.phase_alignment,
        specialization_score = excluded.specialization_score,
        reversibility_support = excluded.reversibility_support,
        transfer_cost = excluded.transfer_cost,
        interference_risk = excluded.interference_risk,
        phase_index = excluded.phase_index,
        domain = excluded.domain,
        primary_domain = excluded.primary_domain,
        domain_coverage = excluded.domain_coverage,
        blockers = excluded.blockers;

    insert into atlas.legacy_atlas_routes (
      id,
      route_id,
      participant_id,
      partner_id,
      route_class,
      status,
      score,
      interference_risk,
      transfer_cost,
      activated_by_role,
      activated_by_user_id,
      created_at,
      updated_at
    )
    values
      ('00000000-0000-0000-0000-000000002101', 'legacy-route-sandra', 'legacy-example-sandra', 'legacy-node-housing', 'stabilization', 'active', 88.20, 0.12, 0.21, 'peerNavigator', 'example-noah-bennett', timestamptz '2026-01-11T09:00:00Z', timestamptz '2026-01-11T09:00:00Z'),
      ('00000000-0000-0000-0000-000000002102', 'legacy-route-marcus', 'legacy-example-marcus', 'legacy-node-work', 'readiness', 'active', 82.45, 0.19, 0.24, 'stationOperator', 'example-luis-ortega', timestamptz '2026-01-13T09:00:00Z', timestamptz '2026-01-13T09:00:00Z'),
      ('00000000-0000-0000-0000-000000002103', 'legacy-route-elena', 'legacy-example-elena', 'legacy-node-social', 'renewal', 'completed', 85.10, 0.15, 0.18, 'regionalDirector', 'example-priya-shah', timestamptz '2026-01-16T09:00:00Z', timestamptz '2026-01-20T09:00:00Z')
    on conflict (id) do update
    set route_id = excluded.route_id,
        participant_id = excluded.participant_id,
        partner_id = excluded.partner_id,
        route_class = excluded.route_class,
        status = excluded.status,
        score = excluded.score,
        interference_risk = excluded.interference_risk,
        transfer_cost = excluded.transfer_cost,
        activated_by_role = excluded.activated_by_role,
        activated_by_user_id = excluded.activated_by_user_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at;

    insert into atlas.legacy_atlas_route_steps (
      id,
      route_record_id,
      route_id,
      participant_id,
      partner_id,
      step_id,
      label,
      status,
      dependencies,
      domain,
      sequence,
      created_at,
      updated_at
    )
    values
      ('00000000-0000-0000-0000-000000002201', '00000000-0000-0000-0000-000000002101', 'legacy-route-sandra', 'legacy-example-sandra', 'legacy-node-housing', 'legacy-step-housing', 'Emergency housing lock-in', 'active', '{}', 'habitat', 1, timestamptz '2026-01-11T09:05:00Z', timestamptz '2026-01-11T09:05:00Z'),
      ('00000000-0000-0000-0000-000000002202', '00000000-0000-0000-0000-000000002102', 'legacy-route-marcus', 'legacy-example-marcus', 'legacy-node-work', 'legacy-step-work', 'Job retention bridge', 'active', '{legacy-step-housing}', 'work', 2, timestamptz '2026-01-13T09:05:00Z', timestamptz '2026-01-13T09:05:00Z'),
      ('00000000-0000-0000-0000-000000002203', '00000000-0000-0000-0000-000000002103', 'legacy-route-elena', 'legacy-example-elena', 'legacy-node-social', 'legacy-step-social', 'Community reciprocity activation', 'completed', '{legacy-step-work}', 'socialNetworks', 3, timestamptz '2026-01-16T09:05:00Z', timestamptz '2026-01-20T09:05:00Z')
    on conflict (id) do update
    set route_record_id = excluded.route_record_id,
        route_id = excluded.route_id,
        participant_id = excluded.participant_id,
        partner_id = excluded.partner_id,
        step_id = excluded.step_id,
        label = excluded.label,
        status = excluded.status,
        dependencies = excluded.dependencies,
        domain = excluded.domain,
        sequence = excluded.sequence,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at;

    insert into atlas.legacy_atlas_memory_events (
      id,
      participant_id,
      event_type,
      phase,
      label,
      verified,
      created_by_role,
      created_by_user_id,
      created_at
    )
    values
      ('00000000-0000-0000-0000-000000002301', 'legacy-example-sandra', 'milestone', 'Regulation', 'Temporary housing safety milestone logged.', true, 'peerNavigator', 'example-noah-bennett', timestamptz '2026-01-12T18:00:00Z'),
      ('00000000-0000-0000-0000-000000002302', 'legacy-example-marcus', 'milestone', 'Readiness', 'Employment rhythm milestone logged.', true, 'stationOperator', 'example-luis-ortega', timestamptz '2026-01-15T18:00:00Z'),
      ('00000000-0000-0000-0000-000000002303', 'legacy-example-elena', 'milestone', 'Renewal', 'Community reciprocity milestone logged.', true, 'regionalDirector', 'example-priya-shah', timestamptz '2026-01-20T18:00:00Z')
    on conflict (id) do update
    set participant_id = excluded.participant_id,
        event_type = excluded.event_type,
        phase = excluded.phase,
        label = excluded.label,
        verified = excluded.verified,
        created_by_role = excluded.created_by_role,
        created_by_user_id = excluded.created_by_user_id,
        created_at = excluded.created_at;

    insert into atlas.legacy_atlas_ontology_weights (
      config_key,
      coverage_weight,
      phase_alignment_weight,
      specialization_weight,
      reversibility_weight,
      transfer_cost_penalty,
      interference_penalty,
      civic_diplomacy_boost,
      sla_threshold_hours,
      interference_medium_threshold,
      interference_high_threshold,
      phase_readiness_alert_threshold,
      pcf_refinement_weight,
      reciprocity_activation_threshold,
      updated_at
    )
    values
      ('example-housing-weights', 0.32, 0.18, 0.22, 0.15, 0.08, 0.05, 0.10, 48, 0.35, 0.60, 0.45, 0.60, 0.62, timestamptz '2026-01-11T08:00:00Z'),
      ('example-work-weights', 0.28, 0.24, 0.23, 0.13, 0.07, 0.05, 0.09, 36, 0.30, 0.55, 0.42, 0.57, 0.58, timestamptz '2026-01-13T08:00:00Z'),
      ('example-social-weights', 0.26, 0.20, 0.19, 0.17, 0.09, 0.04, 0.12, 72, 0.38, 0.62, 0.48, 0.63, 0.66, timestamptz '2026-01-16T08:00:00Z')
    on conflict (config_key) do update
    set coverage_weight = excluded.coverage_weight,
        phase_alignment_weight = excluded.phase_alignment_weight,
        specialization_weight = excluded.specialization_weight,
        reversibility_weight = excluded.reversibility_weight,
        transfer_cost_penalty = excluded.transfer_cost_penalty,
        interference_penalty = excluded.interference_penalty,
        civic_diplomacy_boost = excluded.civic_diplomacy_boost,
        sla_threshold_hours = excluded.sla_threshold_hours,
        interference_medium_threshold = excluded.interference_medium_threshold,
        interference_high_threshold = excluded.interference_high_threshold,
        phase_readiness_alert_threshold = excluded.phase_readiness_alert_threshold,
        pcf_refinement_weight = excluded.pcf_refinement_weight,
        reciprocity_activation_threshold = excluded.reciprocity_activation_threshold,
        updated_at = excluded.updated_at;

    insert into atlas.legacy_atlas_ontology_audit (
      id,
      event_type,
      actor_role,
      actor_user_id,
      label,
      payload,
      updated_at
    )
    values
      ('00000000-0000-0000-0000-000000002401', 'weights_update', 'governanceAdmin', 'example-priya-shah', 'Housing example weights published.', '{"config_key":"example-housing-weights"}'::jsonb, timestamptz '2026-01-11T08:05:00Z'),
      ('00000000-0000-0000-0000-000000002402', 'weights_update', 'governanceAdmin', 'example-priya-shah', 'Work example weights published.', '{"config_key":"example-work-weights"}'::jsonb, timestamptz '2026-01-13T08:05:00Z'),
      ('00000000-0000-0000-0000-000000002403', 'weights_update', 'governanceAdmin', 'example-priya-shah', 'Social example weights published.', '{"config_key":"example-social-weights"}'::jsonb, timestamptz '2026-01-16T08:05:00Z')
    on conflict (id) do update
    set event_type = excluded.event_type,
        actor_role = excluded.actor_role,
        actor_user_id = excluded.actor_user_id,
        label = excluded.label,
        payload = excluded.payload,
        updated_at = excluded.updated_at;

    insert into atlas.legacy_atlas_renewal_roles (
      participant_id,
      role_label,
      assigned_by_role,
      assigned_by_user_id,
      payload,
      updated_at
    )
    values
      ('legacy-example-sandra', 'housing peer liaison', 'regionalDirector', 'example-priya-shah', '{"focus":"housing_reciprocity"}'::jsonb, timestamptz '2026-01-20T12:00:00Z'),
      ('legacy-example-marcus', 'employment mentor', 'regionalDirector', 'example-priya-shah', '{"focus":"work_reciprocity"}'::jsonb, timestamptz '2026-01-21T12:00:00Z'),
      ('legacy-example-elena', 'community convenor', 'governanceAdmin', 'example-priya-shah', '{"focus":"social_reciprocity"}'::jsonb, timestamptz '2026-01-22T12:00:00Z')
    on conflict (participant_id) do update
    set role_label = excluded.role_label,
        assigned_by_role = excluded.assigned_by_role,
        assigned_by_user_id = excluded.assigned_by_user_id,
        payload = excluded.payload,
        updated_at = excluded.updated_at;
  end if;
end $$;
