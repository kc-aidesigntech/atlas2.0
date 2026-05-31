-- Security hardening Phase 4: lock the data-warehouse (DW) export contract and
-- internal pipeline state to the service_role.
--
-- The v_dw_* views aggregate unscoped, person-level operational data (enrollment
-- snapshots, assignment edges, assessment facts, journey events, principal scope).
-- They are security_invoker views consumed exclusively by the warehouse Extract
-- Transform Load (ETL) / Power Business Intelligence (BI) pipeline, which connects
-- as service_role (rolbypassrls = true, so invoker views return full rows). No
-- application code path (web/mobile, authenticated role) reads these contracts, so
-- the prior `grant select ... to authenticated` was an unscoped Protected Health
-- Information (PHI) exposure. We revoke anon/authenticated and confine the contract
-- to service_role.
--
-- dw_export_watermarks holds internal pipeline cursor state. Writes flow through
-- the SECURITY DEFINER atlas.fn_dw_mark_pipeline_success RPC (runs as owner), and
-- the ETL reads the watermark directly as service_role, so app roles need nothing.

do $$
declare
  v_view text;
begin
  foreach v_view in array array[
    'v_dw_dim_county',
    'v_dw_dim_partner_station',
    'v_dw_dim_person_role_active',
    'v_dw_fact_assessment_answers',
    'v_dw_fact_assessment_submissions',
    'v_dw_fact_assignment_edges_daily',
    'v_dw_fact_enrollment_snapshot',
    'v_dw_fact_journey_events',
    'v_dw_kpi_daily',
    'v_dw_rls_principal_scope'
  ]
  loop
    execute format('revoke all on atlas.%I from anon, authenticated;', v_view);
    execute format('grant select on atlas.%I to service_role;', v_view);
  end loop;
end;
$$;

-- Internal pipeline watermark state: service_role only.
revoke all on atlas.dw_export_watermarks from anon, authenticated;
grant select, insert, update, delete on atlas.dw_export_watermarks to service_role;

-- Pipeline control RPC is an operator/service action, not an app action.
revoke execute on function atlas.fn_dw_mark_pipeline_success(text, text, jsonb) from public;
grant execute on function atlas.fn_dw_mark_pipeline_success(text, text, jsonb) to service_role;

notify pgrst, 'reload schema';
