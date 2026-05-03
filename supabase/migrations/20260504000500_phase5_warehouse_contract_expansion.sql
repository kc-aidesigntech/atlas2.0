-- Phase 5 warehouse contract expansion:
-- - add missing fact-style warehouse export views
-- - add helper RPC to maintain ETL watermark checkpoints

create or replace view atlas.v_dw_fact_assignment_edges_daily
with (security_invoker = true)
as
select
  current_date as snapshot_date,
  edges.enrollment_id,
  edges.enrollee_id,
  edges.navigator_person_id,
  edges.station_id,
  edges.partner_id,
  edges.county_id,
  edges.starts_on
from atlas.v_active_navigator_assignment_edges edges;

create or replace view atlas.v_dw_fact_journey_events
with (security_invoker = true)
as
select
  jl.id as journey_event_id,
  jl.enrollment_id,
  roster.enrollee_id,
  roster.county_id,
  jl.route_plan_stop_id,
  jl.milestone_type,
  jl.phase,
  jl.label,
  jl.happened_at,
  jl.station_icon_slug,
  jl.created_by_person_id,
  jl.domains_relieved
from atlas.journey_logs jl
left join atlas.v_active_enrollment_roster roster on roster.enrollment_id = jl.enrollment_id;

create or replace view atlas.v_dw_fact_assessment_submissions
with (security_invoker = true)
as
select
  s.id as assessment_submission_id,
  s.assessment_type,
  s.source_submission_id,
  s.status,
  s.form_version,
  s.enrollment_id,
  s.enrollee_id,
  s.partner_id,
  s.navigator_person_id,
  s.supervisor_person_id,
  s.submitted_at,
  s.updated_at,
  s.metadata
from atlas.assessment_submissions s;

create or replace view atlas.v_dw_fact_assessment_answers
with (security_invoker = true)
as
select
  a.id as assessment_answer_id,
  a.assessment_submission_id,
  s.assessment_type,
  s.enrollment_id,
  s.enrollee_id,
  s.partner_id,
  s.navigator_person_id,
  s.supervisor_person_id,
  a.prompt_id,
  a.parent_code,
  a.z_code,
  a.normalized_z_code,
  a.numeric_score,
  a.not_encountered,
  a.created_at
from atlas.assessment_answers a
join atlas.assessment_submissions s on s.id = a.assessment_submission_id;

create or replace function atlas.fn_dw_mark_pipeline_success(
  p_pipeline_name text,
  p_last_cursor text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  if p_pipeline_name is null or btrim(p_pipeline_name) = '' then
    raise exception 'pipeline name is required' using errcode = '22023';
  end if;

  insert into atlas.dw_export_watermarks (pipeline_name, last_success_at, last_cursor, metadata, updated_at)
  values (p_pipeline_name, now(), p_last_cursor, coalesce(p_metadata, '{}'::jsonb), now())
  on conflict (pipeline_name)
  do update set
    last_success_at = now(),
    last_cursor = excluded.last_cursor,
    metadata = excluded.metadata,
    updated_at = now();
end;
$$;

revoke all on function atlas.fn_dw_mark_pipeline_success(text, text, jsonb) from public;
grant execute on function atlas.fn_dw_mark_pipeline_success(text, text, jsonb) to authenticated;

grant select on atlas.v_dw_fact_assignment_edges_daily to authenticated;
grant select on atlas.v_dw_fact_journey_events to authenticated;
grant select on atlas.v_dw_fact_assessment_submissions to authenticated;
grant select on atlas.v_dw_fact_assessment_answers to authenticated;

notify pgrst, 'reload schema';
