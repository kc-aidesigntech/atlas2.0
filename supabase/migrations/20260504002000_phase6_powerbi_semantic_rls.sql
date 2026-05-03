-- Phase 6 semantic/RLS support:
-- - expose principal-to-scope mapping for BI row-level security
-- - publish KPI-ready daily aggregates for Power BI semantic model

create or replace view atlas.v_dw_rls_principal_scope
with (security_invoker = true)
as
with principal_roles as (
  select
    p.id as person_id,
    lower(coalesce(p.email, '')) as principal_email,
    pra.role_key
  from atlas.people p
  join atlas.v_dw_dim_person_role_active pra on pra.person_id = p.id
),
county_scope as (
  select
    pr.person_id,
    pr.principal_email,
    pr.role_key,
    roster.county_id,
    null::uuid as partner_id
  from principal_roles pr
  left join atlas.v_active_navigator_assignment_edges edges on edges.navigator_person_id = pr.person_id
  left join atlas.v_active_enrollment_roster roster on roster.enrollment_id = edges.enrollment_id
  where pr.role_key in ('administrator', 'supervisor', 'navigator')
),
partner_scope as (
  select
    pr.person_id,
    pr.principal_email,
    pr.role_key,
    null::uuid as county_id,
    pce.partner_id
  from principal_roles pr
  join atlas.v_active_partner_contact_edges pce on pce.contact_person_id = pr.person_id
  where pr.role_key in ('administrator', 'partner')
)
select distinct
  scoped.person_id,
  scoped.principal_email,
  scoped.role_key,
  scoped.county_id,
  scoped.partner_id
from (
  select * from county_scope
  union all
  select * from partner_scope
) scoped;

create or replace view atlas.v_dw_kpi_daily
with (security_invoker = true)
as
select
  snapshot.snapshot_date,
  snapshot.county_id,
  snapshot.county_name,
  count(distinct snapshot.enrollment_id) as active_enrollees,
  count(distinct assign.navigator_person_id) as active_navigators,
  count(distinct assign.partner_id) filter (where assign.partner_id is not null) as active_partners,
  case
    when count(distinct assign.navigator_person_id) = 0 then null
    else round(
      count(distinct snapshot.enrollment_id)::numeric
      / nullif(count(distinct assign.navigator_person_id)::numeric, 0),
      2
    )
  end as enrollee_to_navigator_ratio
from atlas.v_dw_fact_enrollment_snapshot snapshot
left join atlas.v_dw_fact_assignment_edges_daily assign
  on assign.snapshot_date = snapshot.snapshot_date
 and assign.enrollment_id = snapshot.enrollment_id
group by snapshot.snapshot_date, snapshot.county_id, snapshot.county_name;

grant select on atlas.v_dw_rls_principal_scope to authenticated;
grant select on atlas.v_dw_kpi_daily to authenticated;

notify pgrst, 'reload schema';
