-- =============================================================================
-- Phase 1 continuity verification harness.
--
-- Purpose:
-- - verify write-policy continuity contracts introduced by phase-1 hardening
-- - confirm command Remote Procedure Call (RPC) validation and canonical queue
--   update pathways are visible to authenticated staff identities
--
-- Run with psql or Supabase MCP execute_sql one block at a time.
-- =============================================================================

-- 1) app_config_documents scoped-write policies exist.
select
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'atlas'
  and tablename = 'app_config_documents'
order by policyname;

-- 2) referral intake update policy exists for staff.
select
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'atlas'
  and tablename = 'public_referral_intake_events'
order by policyname;

-- 3) regulation command RPC is present (used by all regulation test writes).
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'atlas'
  and p.proname = 'fn_save_regulation_test_submission';

-- 4) Staff-role smoke check: referral update should be allowed under navigator JWT context.
-- NOTE: this block is read-only if no matching record exists; it validates permission
-- shape by attempting a no-op update guarded by an impossible id and reporting SQLSTATE.
begin;
select set_config('request.jwt.claims','{"sub":"a11ce000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"provider":"email","providers":["email"],"atlas_role":"navigator"}}', true);
set local role authenticated;
do $$
begin
  begin
    update atlas.public_referral_intake_events
    set payload = payload
    where external_record_id = '__continuity_probe_missing__';
    raise notice 'navigator_update_probe_ok';
  exception when others then
    raise notice 'navigator_update_probe_failed: % %', SQLSTATE, SQLERRM;
  end;
end $$;
rollback;
