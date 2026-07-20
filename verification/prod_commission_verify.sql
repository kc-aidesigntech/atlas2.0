-- =============================================================================
-- Atlas production commissioning pre-flight (read-only).
--
-- Purpose:
-- - Fail loud if pilot/demo Auth users are present (must not ship to production)
-- - Confirm Row-Level Security (RLS) is enabled on core domain tables
-- - Confirm legacy public partner-capacity authorization toggles are off
-- - Inventory remaining SECURITY DEFINER views for the security residual packet
-- - Spot-check identity bridge and required command Remote Procedure Calls (RPCs)
--
-- Safe to run against production: SELECT / inventory only. Does NOT delete Auth
-- users, apply migrations, or mutate authorization_settings.
--
-- Companion docs:
--   docs/production-go-live-hard-gates.md
--   docs/partner-go-live-checklist.md
--   docs/security-model.md
--   PILOT.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Pilot / demo Auth users must be ABSENT in production.
--    Any row here fails gate 1. Expected result: 0 rows.
-- ---------------------------------------------------------------------------
select
  u.id as auth_user_id,
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  u.raw_app_meta_data ->> 'atlas_role' as atlas_role,
  'FAIL: pilot/demo login must not exist in production' as gate_result
from auth.users u
where
  u.email in (
    'pilot.admin@atlas.test',
    'pilot.navigator@atlas.test',
    'pilot.supervisor@atlas.test',
    'pilot.partner@atlas.test',
    'demo.partner@atlas.test'
  )
  or u.email like 'pilot.%@atlas.test'
  or u.email like 'demo.%@atlas.test'
  or u.id in (
    'a11ce000-0000-0000-0000-000000000001',
    'a11ce000-0000-0000-0000-000000000002',
    'a11ce000-0000-0000-0000-000000000003',
    'a11ce000-0000-0000-0000-000000000004',
    'de300000-0000-0000-0000-0000000000c1'
  )
order by u.email;

-- Pass banner when clean (1 row with ok=true).
select
  not exists (
    select 1
    from auth.users u
    where
      u.email in (
        'pilot.admin@atlas.test',
        'pilot.navigator@atlas.test',
        'pilot.supervisor@atlas.test',
        'pilot.partner@atlas.test',
        'demo.partner@atlas.test'
      )
      or u.email like 'pilot.%@atlas.test'
      or u.email like 'demo.%@atlas.test'
  ) as gate_1_no_pilot_auth_users_ok;

-- ---------------------------------------------------------------------------
-- B) Identity bridge snapshot (every Auth user should map to atlas.people).
--    Investigate any auth_user_count > mapped_people_count before go-live.
-- ---------------------------------------------------------------------------
select
  count(*) as auth_user_count,
  count(*) filter (where p.id is not null) as mapped_people_count,
  count(*) filter (
    where p.external_ref = u.id::text
       or p.id = u.id
  ) as bridge_aligned_count
from auth.users u
left join atlas.people p on p.id = u.id or p.external_ref = u.id::text;

-- Auth users missing people bridge (expected: 0 for production operators).
select
  u.id as auth_user_id,
  u.email,
  'WARN: auth user missing atlas.people bridge' as note
from auth.users u
left join atlas.people p on p.id = u.id or p.external_ref = u.id::text
where p.id is null
order by u.created_at desc
limit 50;

-- ---------------------------------------------------------------------------
-- C) Legacy public partner-capacity toggles — expect enabled = false in prod.
-- ---------------------------------------------------------------------------
select
  setting_key,
  enabled,
  case
    when enabled is distinct from true then 'ok'
    else 'FAIL: disable before production traffic'
  end as gate_result
from atlas.authorization_settings
where setting_key in (
  'allow_legacy_public_partner_capacity_read',
  'allow_legacy_public_partner_capacity_write',
  'allow_legacy_public_partner_capacity_delete'
)
order by setting_key;

-- If the settings rows are missing entirely, surface that — missing is safer than
-- an implicit public write path, but ops should confirm the foundation migration ran.
select
  count(*) as legacy_capacity_setting_rows
from atlas.authorization_settings
where setting_key in (
  'allow_legacy_public_partner_capacity_read',
  'allow_legacy_public_partner_capacity_write',
  'allow_legacy_public_partner_capacity_delete'
);

-- ---------------------------------------------------------------------------
-- D) RLS enabled on core domain tables (expected: relrowsecurity = true).
-- ---------------------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  case when c.relrowsecurity then 'ok' else 'FAIL: enable RLS' end as gate_result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'atlas'
  and c.relkind = 'r'
  and c.relname in (
    'enrollments',
    'enrollees',
    'people',
    'partner_stations',
    'enrollee_z_codes',
    'navigator_assignments',
    'supervisor_navigator_assignments',
    'assessment_submissions',
    'partner_service_capacity_submissions',
    'public_referral_intake_events',
    'people_role_assignments',
    'app_config_documents'
  )
order by c.relname;

-- ---------------------------------------------------------------------------
-- E) Required command RPCs present (existence check only).
-- ---------------------------------------------------------------------------
select
  function_name,
  to_regprocedure(signature) is not null as exists_with_signature,
  case
    when to_regprocedure(signature) is not null then 'ok'
    else 'FAIL: missing RPC — apply migrations'
  end as gate_result
from (
  values
    ('fn_current_person_id', 'atlas.fn_current_person_id()'),
    ('fn_can_access_enrollment_as_staff', 'atlas.fn_can_access_enrollment_as_staff(uuid)'),
    ('fn_save_partner_service_capacity', 'atlas.fn_save_partner_service_capacity(jsonb)'),
    ('fn_save_regulation_test_submission', 'atlas.fn_save_regulation_test_submission(jsonb)'),
    ('fn_navigator_assign_enrollment_to_self', 'atlas.fn_navigator_assign_enrollment_to_self(uuid)'),
    ('fn_access_matrix_save_partner_contacts', 'atlas.fn_access_matrix_save_partner_contacts(uuid,uuid[])')
) as required(function_name, signature);

-- ---------------------------------------------------------------------------
-- F) Security residual inventory (informational — does not auto-fail).
--    Cross-check against docs/security-model.md "Known remaining hardening".
--    Postgres 15+ stores security_invoker on view reloptions; absent option
--    means classic SECURITY DEFINER view semantics (owner privileges).
-- ---------------------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as view_name,
  pg_get_userbyid(c.relowner) as owner,
  case
    when coalesce(
      (
        select option_value
        from pg_options_to_table(c.reloptions)
        where option_name = 'security_invoker'
        limit 1
      ),
      'false'
    ) = 'true' then 'security_invoker'
    else 'security_definer_or_default'
  end as security_mode
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'atlas'
  and c.relkind = 'v'
  and c.relname in (
    'v_navigator_route_candidates',
    'v_county_z_code_heatmap',
    'v_admin_data_quality',
    'v_partner_station_directory',
    'v_partners_page_records',
    'v_supervisor_navigator_competency_rollup',
    'v_partner_z_code_burden',
    'v_navigator_enrollment_requests',
    'v_enrollment_station_markers',
    'v_singlepane_enrollee_profiles',
    'v_singlepane_enrollee_domain_loads',
    'v_people_directory'
  )
order by c.relname;

-- Broad count of atlas views still on definer/default (residual signal only).
select
  count(*) filter (
    where coalesce(
      (
        select option_value
        from pg_options_to_table(c.reloptions)
        where option_name = 'security_invoker'
        limit 1
      ),
      'false'
    ) <> 'true'
  ) as atlas_views_not_marked_security_invoker,
  count(*) as atlas_view_total
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'atlas'
  and c.relkind = 'v';

-- ---------------------------------------------------------------------------
-- G) Partner capacity commissioning readiness (optional per-org filter).
--    Replace the organization name before relying on the completed_count.
-- ---------------------------------------------------------------------------
-- Example (uncomment and set org name):
-- select
--   p.organization_name,
--   count(*) filter (where s.status = 'completed') as completed_capacity_surveys,
--   count(*) filter (where s.status = 'draft') as draft_capacity_surveys
-- from atlas.partners p
-- left join atlas.partner_service_capacity_submissions s on s.partner_id = p.id
-- where p.organization_name ilike '%Harborview%'  -- replace for real site
-- group by p.organization_name;

select
  'Replace org filter in section G comments for site-specific capacity counts' as note;

-- ---------------------------------------------------------------------------
-- H) Roll-up: print boolean gates for the sign-off packet.
-- ---------------------------------------------------------------------------
with pilot_absent as (
  select not exists (
    select 1
    from auth.users u
    where
      u.email in (
        'pilot.admin@atlas.test',
        'pilot.navigator@atlas.test',
        'pilot.supervisor@atlas.test',
        'pilot.partner@atlas.test',
        'demo.partner@atlas.test'
      )
      or u.email like 'pilot.%@atlas.test'
      or u.email like 'demo.%@atlas.test'
  ) as ok
),
legacy_off as (
  -- No rows: treat as not explicitly enabled (ok). Any enabled=true fails.
  select coalesce(bool_and(enabled is distinct from true), true) as ok
  from atlas.authorization_settings
  where setting_key in (
    'allow_legacy_public_partner_capacity_read',
    'allow_legacy_public_partner_capacity_write',
    'allow_legacy_public_partner_capacity_delete'
  )
),
rls_core as (
  select bool_and(c.relrowsecurity) as ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'atlas'
    and c.relkind = 'r'
    and c.relname in (
      'enrollments',
      'enrollees',
      'people',
      'partner_stations',
      'navigator_assignments',
      'partner_service_capacity_submissions',
      'public_referral_intake_events'
    )
)
select
  (select ok from pilot_absent) as gate_1_no_pilot_users,
  (select ok from legacy_off) as gate_2_legacy_capacity_toggles_off,
  (select ok from rls_core) as gate_2_core_rls_enabled,
  'Manual: security-model.md residuals + instrument waiver' as gate_3_and_4_manual;
