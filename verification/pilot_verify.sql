-- =============================================================================
-- Atlas pilot verification harness.
--
-- Replays each screen's underlying read under each pilot identity's Row-Level
-- Security (RLS) context (authenticated role + simulated JSON Web Token (JWT)
-- claims) and prints a per-screen ok/row-count/error table. This is how you
-- confirm "every screen aligns with the database for every credential" without
-- clicking through the app.
--
-- Each block is an independent transaction that ROLLS BACK (read-only probe).
-- Run a block at a time via the Supabase MCP execute_sql, or run the whole file
-- with psql. Expected outcomes are noted per block.
--
-- Pilot identities:
--   admin      a11ce000-0000-0000-0000-000000000001  (sees everything but warehouse)
--   navigator  a11ce000-0000-0000-0000-000000000002  (scoped to 2 assigned enrollees)
--   supervisor a11ce000-0000-0000-0000-000000000003  (supervises all navigators)
--   partner    a11ce000-0000-0000-0000-000000000004  (no enrollee PHI; partner surface)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Reusable probe. Replace <SUB> and <ROLEJSON> per identity. The DO block
-- captures per-relation errors so one permission denial does not hide the rest.
-- Relations suffixed _BLOCKED are expected to deny for non-service roles.
-- ---------------------------------------------------------------------------

-- ============================ ADMIN ========================================
begin;
select set_config('request.jwt.claims','{"sub":"a11ce000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"provider":"email","providers":["email"],"atlas_role":"administrator"}}', true);
set local role authenticated;
create temp table _probe(screen text, ok boolean, n bigint, err text) on commit drop;
do $$
declare rel text; lbl text; cnt bigint; i int;
  rels text[][] := array[
    ['atlas.v_singlepane_enrollee_profiles','enrollee_profiles'],
    ['atlas.v_singlepane_enrollee_domain_loads','enrollee_loads'],
    ['atlas.v_navigator_assigned_enrollees','navigator_assigned_enrollees'],
    ['atlas.v_navigator_enrollment_requests','enrollment_requests'],
    ['atlas.v_active_enrollment_roster','active_enrollment_roster'],
    ['atlas.v_people_directory','people_directory'],
    ['atlas.navigator_assignments','navigator_assignments_base'],
    ['atlas.supervisor_navigator_assignments','supervisor_assignments_base'],
    ['atlas.assessment_submissions','assessment_submissions'],
    ['atlas.navigator_regulation_test_submissions','regulation_submissions'],
    ['atlas.navigator_competency_assessments','competency_assessments'],
    ['atlas.v_partner_station_directory','partner_station_directory'],
    ['atlas.partner_z_code_capabilities','partner_capabilities'],
    ['atlas.partner_service_capacity_submissions','partner_capacity_submissions'],
    ['atlas.v_county_z_code_heatmap','county_heatmap'],
    ['atlas.v_admin_data_quality','admin_data_quality'],
    ['atlas.v_supervisor_navigator_competency_rollup','competency_rollup'],
    ['atlas.z_codes','z_codes'],
    ['atlas.app_config_documents','config_documents'],
    ['atlas.v_dw_kpi_daily','dw_kpi_daily_BLOCKED'],
    ['atlas.legacy_decommission_registry','legacy_decommission_BLOCKED']
  ];
begin
  for i in 1 .. array_length(rels,1) loop
    rel := rels[i][1]; lbl := rels[i][2];
    begin execute format('select count(*) from %s', rel) into cnt; insert into _probe values(lbl, true, cnt, null);
    exception when others then insert into _probe values(lbl, false, null, sqlerrm); end;
  end loop;
end $$;
select 'admin' as identity, screen, ok, n, err from _probe order by screen;
rollback;

-- ============================ NAVIGATOR ====================================
-- Expect: enrollee_profiles=2 (assigned), warehouse/legacy denied.
begin;
select set_config('request.jwt.claims','{"sub":"a11ce000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"provider":"email","providers":["email"],"atlas_role":"navigator"}}', true);
set local role authenticated;
create temp table _probe(screen text, ok boolean, n bigint, err text) on commit drop;
do $$
declare rel text; lbl text; cnt bigint; i int;
  rels text[][] := array[
    ['atlas.v_singlepane_enrollee_profiles','enrollee_profiles'],
    ['atlas.v_singlepane_enrollee_domain_loads','enrollee_loads'],
    ['atlas.v_active_enrollment_roster','active_enrollment_roster'],
    ['atlas.assessment_submissions','assessment_submissions'],
    ['atlas.navigator_assignments','navigator_assignments_base'],
    ['atlas.navigator_regulation_test_submissions','regulation_submissions'],
    ['atlas.v_dw_kpi_daily','dw_kpi_daily_BLOCKED'],
    ['atlas.legacy_decommission_registry','legacy_decommission_BLOCKED']
  ];
begin
  for i in 1 .. array_length(rels,1) loop
    rel := rels[i][1]; lbl := rels[i][2];
    begin execute format('select count(*) from %s', rel) into cnt; insert into _probe values(lbl, true, cnt, null);
    exception when others then insert into _probe values(lbl, false, null, sqlerrm); end;
  end loop;
end $$;
select 'navigator' as identity, screen, ok, n, err from _probe order by screen;
rollback;

-- ============================ SUPERVISOR ===================================
begin;
select set_config('request.jwt.claims','{"sub":"a11ce000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"provider":"email","providers":["email"],"atlas_role":"supervisor"}}', true);
set local role authenticated;
create temp table _probe(screen text, ok boolean, n bigint, err text) on commit drop;
do $$
declare rel text; lbl text; cnt bigint; i int;
  rels text[][] := array[
    ['atlas.v_supervisor_navigator_competency_rollup','competency_rollup'],
    ['atlas.navigator_competency_assessments','competency_assessments'],
    ['atlas.supervisor_navigator_assignments','supervisor_assignments_base'],
    ['atlas.v_people_directory','people_directory'],
    ['atlas.v_dw_kpi_daily','dw_kpi_daily_BLOCKED']
  ];
begin
  for i in 1 .. array_length(rels,1) loop
    rel := rels[i][1]; lbl := rels[i][2];
    begin execute format('select count(*) from %s', rel) into cnt; insert into _probe values(lbl, true, cnt, null);
    exception when others then insert into _probe values(lbl, false, null, sqlerrm); end;
  end loop;
end $$;
select 'supervisor' as identity, screen, ok, n, err from _probe order by screen;
rollback;

-- ============================ PARTNER ======================================
-- Expect: all enrollee PHI = 0; partner surface readable.
begin;
select set_config('request.jwt.claims','{"sub":"a11ce000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"provider":"email","providers":["email"],"atlas_role":"partner"}}', true);
set local role authenticated;
create temp table _probe(screen text, ok boolean, n bigint, err text) on commit drop;
do $$
declare rel text; lbl text; cnt bigint; i int;
  rels text[][] := array[
    ['atlas.v_singlepane_enrollee_profiles','enrollee_profiles_PHI_should_be_0'],
    ['atlas.assessment_submissions','assessment_submissions_PHI_should_be_0'],
    ['atlas.navigator_assignments','navigator_assignments_should_be_0'],
    ['atlas.v_partner_station_directory','partner_station_directory'],
    ['atlas.partner_z_code_capabilities','partner_capabilities'],
    ['atlas.partner_service_capacity_submissions','partner_capacity_submissions'],
    ['atlas.z_codes','z_codes'],
    ['atlas.v_dw_kpi_daily','dw_kpi_daily_BLOCKED']
  ];
begin
  for i in 1 .. array_length(rels,1) loop
    rel := rels[i][1]; lbl := rels[i][2];
    begin execute format('select count(*) from %s', rel) into cnt; insert into _probe values(lbl, true, cnt, null);
    exception when others then insert into _probe values(lbl, false, null, sqlerrm); end;
  end loop;
end $$;
select 'partner' as identity, screen, ok, n, err from _probe order by screen;
rollback;

-- ============================ ANON =========================================
-- Expect: only z_codes / z_code_headers readable; everything else denied.
begin;
select set_config('request.jwt.claims','{"role":"anon"}', true);
set local role anon;
create temp table _probe(screen text, ok boolean, n bigint, err text) on commit drop;
do $$
declare rel text; lbl text; cnt bigint; i int;
  rels text[][] := array[
    ['atlas.z_codes','z_codes_PUBLIC_OK'],
    ['atlas.z_code_headers','z_code_headers_PUBLIC_OK'],
    ['atlas.v_singlepane_enrollee_profiles','enrollee_profiles_BLOCKED'],
    ['atlas.navigator_assignments','navigator_assignments_BLOCKED'],
    ['atlas.partner_service_capacity_submissions','partner_capacity_BLOCKED'],
    ['atlas.v_county_z_code_heatmap','county_heatmap_BLOCKED'],
    ['atlas.v_dw_kpi_daily','dw_kpi_daily_BLOCKED']
  ];
begin
  for i in 1 .. array_length(rels,1) loop
    rel := rels[i][1]; lbl := rels[i][2];
    begin execute format('select count(*) from %s', rel) into cnt; insert into _probe values(lbl, true, cnt, null);
    exception when others then insert into _probe values(lbl, false, null, sqlerrm); end;
  end loop;
end $$;
select 'anon' as identity, screen, ok, n, err from _probe order by screen;
rollback;
