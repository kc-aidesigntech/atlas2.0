-- Phase 1 SQL simplification:
-- - add a canonical access layer made of small, explicit "active_*" views
-- - add warehouse-facing dimensional/fact views for clean downstream ETL
-- - keep all existing tables and legacy views intact (non-breaking rollout)

create index if not exists idx_navigator_assignments_active_enrollment
  on atlas.navigator_assignments (enrollment_id, navigator_person_id)
  where ends_on is null;
create index if not exists idx_supervisor_assignments_active_navigator
  on atlas.supervisor_navigator_assignments (navigator_person_id, supervisor_person_id)
  where ends_on is null;
do $$
begin
  if to_regclass('atlas.partner_contact_assignments') is not null then
    execute $sql$
      create index if not exists idx_partner_contact_assignments_active_partner
        on atlas.partner_contact_assignments (partner_id, person_id)
        where ends_on is null
    $sql$;
  end if;
end
$$;
create index if not exists idx_enrollee_z_codes_active_enrollment
  on atlas.enrollee_z_codes (enrollment_id, z_code_id)
  where ended_at is null;
create or replace function atlas.fn_current_person_id()
returns uuid
language sql
stable
security definer
set search_path = atlas, public
as $$
  with identity_input as (
    select
      nullif(auth.uid()::text, '') as auth_user_id,
      nullif(coalesce(auth.jwt() ->> 'email', ''), '') as auth_email
  )
  select p.id
  from identity_input i
  join atlas.people p
    on (i.auth_user_id is not null and p.external_ref = i.auth_user_id)
    or (i.auth_email is not null and lower(p.email) = lower(i.auth_email))
  order by case when i.auth_user_id is not null and p.external_ref = i.auth_user_id then 0 else 1 end
  limit 1
$$;
revoke all on function atlas.fn_current_person_id() from public;
grant execute on function atlas.fn_current_person_id() to authenticated;
create or replace view atlas.v_active_navigator_assignment_edges
with (security_invoker = true)
as
select
  na.enrollment_id,
  en.enrollee_id,
  na.navigator_person_id,
  nav.display_name as navigator_name,
  na.station_id,
  ps.station_name,
  ps.partner_id,
  part.organization_name as partner_name,
  e.county_id,
  c.county_name,
  na.starts_on
from atlas.navigator_assignments na
join atlas.enrollments en on en.id = na.enrollment_id
join atlas.enrollees e on e.id = en.enrollee_id
left join atlas.people nav on nav.id = na.navigator_person_id
left join atlas.partner_stations ps on ps.id = na.station_id
left join atlas.partners part on part.id = ps.partner_id
left join atlas.counties c on c.id = e.county_id
where na.ends_on is null
  and en.status = 'active';
create or replace view atlas.v_active_supervisor_assignment_edges
with (security_invoker = true)
as
select
  sna.navigator_person_id,
  nav.display_name as navigator_name,
  sna.supervisor_person_id,
  sup.display_name as supervisor_name,
  sna.starts_on
from atlas.supervisor_navigator_assignments sna
left join atlas.people nav on nav.id = sna.navigator_person_id
left join atlas.people sup on sup.id = sna.supervisor_person_id
where sna.ends_on is null;
do $$
begin
  if to_regclass('atlas.partner_contact_assignments') is not null then
    execute $sql$
      create or replace view atlas.v_active_partner_contact_edges
      with (security_invoker = true)
      as
      select
        pca.partner_id,
        part.organization_name as partner_name,
        pca.person_id as contact_person_id,
        contact.display_name as contact_name,
        contact.email as contact_email,
        pca.is_primary,
        pca.starts_on
      from atlas.partner_contact_assignments pca
      join atlas.partners part on part.id = pca.partner_id
      join atlas.people contact on contact.id = pca.person_id
      where pca.ends_on is null
    $sql$;
  else
    execute $sql$
      create or replace view atlas.v_active_partner_contact_edges
      with (security_invoker = true)
      as
      select
        part.id as partner_id,
        part.organization_name as partner_name,
        contact.id as contact_person_id,
        contact.display_name as contact_name,
        contact.email as contact_email,
        true as is_primary,
        current_date as starts_on
      from atlas.partners part
      left join atlas.people contact
        on part.primary_contact_email is not null
       and contact.email is not null
       and lower(contact.email) = lower(part.primary_contact_email)
      where part.is_active = true
    $sql$;
  end if;
end
$$;
create or replace view atlas.v_active_enrollment_roster
with (security_invoker = true)
as
select
  en.id as enrollment_id,
  en.status as enrollment_status,
  en.start_date,
  en.target_duration_months,
  e.id as enrollee_id,
  p.id as enrollee_person_id,
  p.display_name as enrollee_name,
  p.email as enrollee_email,
  e.case_id,
  e.current_phase,
  e.county_id,
  c.county_name
from atlas.enrollments en
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
left join atlas.counties c on c.id = e.county_id
where en.status = 'active';
create or replace view atlas.v_enrollment_assignment_board
with (security_invoker = true)
as
with navigator_rollup as (
  select
    edges.enrollment_id,
    array_agg(distinct edges.navigator_person_id) as navigator_person_ids,
    array_agg(distinct edges.navigator_name) as navigator_names
  from atlas.v_active_navigator_assignment_edges edges
  group by edges.enrollment_id
)
select
  roster.enrollment_id,
  roster.enrollee_id,
  roster.enrollee_name,
  roster.case_id,
  roster.current_phase,
  roster.county_id,
  roster.county_name,
  coalesce(nav.navigator_person_ids, '{}'::uuid[]) as navigator_person_ids,
  coalesce(nav.navigator_names, '{}'::text[]) as navigator_names
from atlas.v_active_enrollment_roster roster
left join navigator_rollup nav on nav.enrollment_id = roster.enrollment_id;
create or replace view atlas.v_county_commons_daily_metrics
with (security_invoker = true)
as
with active_enrollment_counts as (
  select
    roster.county_id,
    count(distinct roster.enrollment_id)::int as active_enrollments
  from atlas.v_active_enrollment_roster roster
  group by roster.county_id
),
active_navigator_counts as (
  select
    edges.county_id,
    count(distinct edges.navigator_person_id)::int as active_navigators
  from atlas.v_active_navigator_assignment_edges edges
  group by edges.county_id
),
resolved_parent_counts as (
  select
    roster.county_id,
    count(distinct upper('Z' || substring(z.z_code from 2 for 2)))::int as resolved_parent_codes
  from atlas.v_active_enrollment_roster roster
  join atlas.enrollee_z_codes ez on ez.enrollment_id = roster.enrollment_id
  join atlas.z_codes z on z.id = ez.z_code_id
  where ez.ended_at is null
    and coalesce(ez.is_resolved, false)
  group by roster.county_id
),
journey_completion_counts as (
  select
    roster.county_id,
    count(*)::int as completed_journey_events
  from atlas.v_active_enrollment_roster roster
  join atlas.journey_logs jl on jl.enrollment_id = roster.enrollment_id
  where jl.happened_at::date <= current_date
  group by roster.county_id
)
select
  current_date as metric_date,
  c.id as county_id,
  c.county_name,
  coalesce(aec.active_enrollments, 0) as active_enrollments,
  coalesce(anc.active_navigators, 0) as active_navigators,
  coalesce(rpc.resolved_parent_codes, 0) as resolved_parent_codes,
  coalesce(jcc.completed_journey_events, 0) as completed_journey_events
from atlas.counties c
left join active_enrollment_counts aec on aec.county_id = c.id
left join active_navigator_counts anc on anc.county_id = c.id
left join resolved_parent_counts rpc on rpc.county_id = c.id
left join journey_completion_counts jcc on jcc.county_id = c.id;
create table if not exists atlas.dw_export_watermarks (
  pipeline_name text primary key,
  last_success_at timestamptz,
  last_cursor text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create or replace view atlas.v_dw_dim_county
with (security_invoker = true)
as
select
  c.id as county_id,
  c.county_name,
  s.id as state_id,
  s.state_code,
  s.state_name
from atlas.counties c
join atlas.states s on s.id = c.state_id;
create or replace view atlas.v_dw_dim_partner_station
with (security_invoker = true)
as
select
  ps.id as station_id,
  ps.station_name,
  ps.partner_id,
  p.organization_name as partner_name,
  ps.county_id,
  c.county_name,
  ps.is_active
from atlas.partner_stations ps
join atlas.partners p on p.id = ps.partner_id
left join atlas.counties c on c.id = ps.county_id;
create or replace view atlas.v_dw_dim_person_role_active
with (security_invoker = true)
as
select
  pra.person_id,
  pe.display_name,
  pe.email,
  r.role_key,
  pra.is_primary,
  pra.starts_on
from atlas.people_role_assignments pra
join atlas.roles r on r.id = pra.role_id
join atlas.people pe on pe.id = pra.person_id
where pra.ends_on is null;
create or replace view atlas.v_dw_fact_enrollment_snapshot
with (security_invoker = true)
as
select
  current_date as snapshot_date,
  roster.enrollment_id,
  roster.enrollee_id,
  roster.enrollee_person_id,
  roster.case_id,
  roster.current_phase,
  roster.county_id,
  roster.county_name,
  roster.start_date,
  roster.target_duration_months,
  coalesce(array_length(board.navigator_person_ids, 1), 0)::int as active_navigator_count
from atlas.v_active_enrollment_roster roster
left join atlas.v_enrollment_assignment_board board on board.enrollment_id = roster.enrollment_id;
grant select on atlas.v_active_navigator_assignment_edges to authenticated;
grant select on atlas.v_active_supervisor_assignment_edges to authenticated;
grant select on atlas.v_active_partner_contact_edges to authenticated;
grant select on atlas.v_active_enrollment_roster to authenticated;
grant select on atlas.v_enrollment_assignment_board to authenticated;
grant select on atlas.v_county_commons_daily_metrics to authenticated;
grant select on atlas.v_dw_dim_county to authenticated;
grant select on atlas.v_dw_dim_partner_station to authenticated;
grant select on atlas.v_dw_dim_person_role_active to authenticated;
grant select on atlas.v_dw_fact_enrollment_snapshot to authenticated;
grant select, insert, update on atlas.dw_export_watermarks to authenticated;
notify pgrst, 'reload schema';
