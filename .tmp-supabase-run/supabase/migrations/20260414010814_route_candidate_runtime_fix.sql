grant usage on schema atlas to anon, authenticated;

drop view if exists atlas.v_navigator_route_candidates;
drop function if exists atlas.fn_rank_route_candidates(uuid);

create or replace function atlas.fn_rank_route_candidates(p_enrollment_id uuid)
returns table(
  station_id uuid,
  partner_id uuid,
  station_name text,
  score numeric,
  matched_z_code_count int,
  need_units_matched int,
  partner_burden_total numeric,
  matched_z_codes text[],
  matched_parent_summaries jsonb
)
language sql
stable
security definer
set search_path = atlas, public
as $$
with active_code_need as (
  select
    ez.z_code_id,
    upper(z.z_code) as matched_z_code,
    count(*)::int as enrollee_need_count,
    upper('z' || substring(z.z_code from 2 for 2)) as matched_z_group
  from atlas.enrollee_z_codes ez
  join atlas.z_codes z on z.id = ez.z_code_id
  where ez.enrollment_id = p_enrollment_id
    and ez.ended_at is null
  group by ez.z_code_id, upper(z.z_code), upper('z' || substring(z.z_code from 2 for 2))
),
station_pairs as (
  select
    ps.id as station_id,
    ps.partner_id,
    ps.station_name,
    ac.z_code_id,
    ac.matched_z_code,
    ac.matched_z_group,
    ac.enrollee_need_count,
    coalesce(pzbs.burden_score, 0) as partner_burden_score,
    coalesce((ac.enrollee_need_count * pzbs.burden_score)::numeric, 0) as weighted_factor
  from atlas.partner_stations ps
  cross join active_code_need ac
  left join atlas.partner_z_code_burden_scores pzbs
    on pzbs.partner_id = ps.partner_id
   and pzbs.z_code_id = ac.z_code_id
  where ps.is_active = true
),
agg as (
  select
    station_id,
    partner_id,
    station_name,
    coalesce(sum(weighted_factor), 0)::numeric as score,
    count(*) filter (where partner_burden_score > 0)::int as matched_z_code_count,
    coalesce(sum(enrollee_need_count) filter (where partner_burden_score > 0), 0)::int as need_units_matched,
    coalesce(sum(partner_burden_score) filter (where partner_burden_score > 0), 0)::numeric as partner_burden_total,
    array_agg(distinct matched_z_group order by matched_z_group)
      filter (where partner_burden_score > 0) as matched_z_codes
  from station_pairs
  group by station_id, partner_id, station_name
),
parent_summary as (
  select
    station_id,
    partner_id,
    station_name,
    matched_z_group,
    count(*) filter (where partner_burden_score > 0)::int as matched_child_count,
    round(avg(partner_burden_score) filter (where partner_burden_score > 0)::numeric, 1) as avg_burden_score,
    array_agg(distinct matched_z_code order by matched_z_code)
      filter (where partner_burden_score > 0) as matched_child_z_codes
  from station_pairs
  group by station_id, partner_id, station_name, matched_z_group
),
parent_summary_agg as (
  select
    station_id,
    partner_id,
    station_name,
    jsonb_agg(
      jsonb_build_object(
        'parentCode', matched_z_group,
        'matchedChildCount', matched_child_count,
        'avgBurdenScore', avg_burden_score,
        'matchedChildZCodes', coalesce(matched_child_z_codes, '{}')
      )
      order by matched_z_group
    ) as matched_parent_summaries
  from parent_summary
  where matched_child_count > 0
  group by station_id, partner_id, station_name
)
select
  agg.station_id,
  agg.partner_id,
  agg.station_name,
  agg.score,
  agg.matched_z_code_count,
  agg.need_units_matched,
  agg.partner_burden_total,
  coalesce(agg.matched_z_codes, '{}'),
  coalesce(parent_summary_agg.matched_parent_summaries, '[]'::jsonb)
from agg
left join parent_summary_agg
  on parent_summary_agg.station_id = agg.station_id
 and parent_summary_agg.partner_id = agg.partner_id
 and parent_summary_agg.station_name = agg.station_name
order by score desc, matched_z_code_count desc, need_units_matched desc, partner_burden_total desc, station_name asc;
$$;

create or replace view atlas.v_navigator_route_candidates as
select
  en.id as enrollment_id,
  ranked.station_id,
  ranked.partner_id,
  ranked.station_name,
  ranked.score,
  ranked.matched_z_code_count,
  ranked.need_units_matched,
  ranked.partner_burden_total,
  ranked.matched_z_codes,
  ranked.matched_parent_summaries
from atlas.enrollments en
cross join lateral atlas.fn_rank_route_candidates(en.id) ranked
where en.status = 'active';

grant execute on function atlas.fn_rank_route_candidates(uuid) to anon, authenticated;
grant select on atlas.v_navigator_route_candidates to anon, authenticated;

insert into atlas.enrollee_z_codes (id, enrollment_id, z_code_id, is_resolved, resolution_at, source, effective_at, ended_at)
values
  ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000603', (select id from atlas.z_codes where z_code = 'Z59.1'), false, null, 'manual', timestamptz '2026-01-15T12:05:00Z', null),
  ('00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000603', (select id from atlas.z_codes where z_code = 'Z56.2'), false, null, 'manual', timestamptz '2026-01-15T12:10:00Z', null)
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
  ((select id from atlas.partners where organization_name_normalized = 'north-harbor-housing-collaborative'), (select id from atlas.z_codes where z_code = 'Z56.2'), 'specialize', 0.44, 'survey', timestamptz '2026-02-01T09:00:00Z', true),
  ((select id from atlas.partners where organization_name_normalized = 'north-harbor-housing-collaborative'), (select id from atlas.z_codes where z_code = 'Z60.4'), 'specialize', 0.56, 'survey', timestamptz '2026-02-01T09:00:00Z', true),
  ((select id from atlas.partners where organization_name_normalized = 'workspring-alliance'), (select id from atlas.z_codes where z_code = 'Z59.1'), 'specialize', 0.56, 'survey', timestamptz '2026-02-02T09:00:00Z', true),
  ((select id from atlas.partners where organization_name_normalized = 'workspring-alliance'), (select id from atlas.z_codes where z_code = 'Z60.4'), 'specialize', 0.44, 'survey', timestamptz '2026-02-02T09:00:00Z', true),
  ((select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'), (select id from atlas.z_codes where z_code = 'Z59.1'), 'specialize', 0.78, 'survey', timestamptz '2026-02-03T09:00:00Z', true),
  ((select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'), (select id from atlas.z_codes where z_code = 'Z56.2'), 'specialize', 0.67, 'survey', timestamptz '2026-02-03T09:00:00Z', true)
on conflict (partner_id, z_code_id, relation_type, source) do update
set strength = excluded.strength,
    source_submitted_at = excluded.source_submitted_at,
    is_active = excluded.is_active;

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
    '{"scenario":"social_arc","note":"Completed example multi-parent survey used for Elena route ranking."}'::jsonb,
    timestamptz '2026-02-03T09:30:00Z',
    'example-submission-amina',
    'completed',
    timestamptz '2026-02-03T09:30:00Z'
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
  ((select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-maya'), 'z56-2', 'Z56', 'Z56.2', 'Z56.2', 'Z56.2', 'Threat of Job Loss', 4),
  ((select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-maya'), 'z60-4', 'Z60', 'Z60.4', 'Z60.4', 'Z60.4', 'Social Exclusion or Rejection', 5),
  ((select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-luis'), 'z59-1', 'Z59', 'Z59.1', 'Z59.1', 'Z59.1', 'Inadequate Housing', 5),
  ((select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-luis'), 'z60-4', 'Z60', 'Z60.4', 'Z60.4', 'Z60.4', 'Social Exclusion or Rejection', 4),
  ((select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-amina'), 'z59-1', 'Z59', 'Z59.1', 'Z59.1', 'Z59.1', 'Inadequate Housing', 7),
  ((select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-amina'), 'z56-2', 'Z56', 'Z56.2', 'Z56.2', 'Z56.2', 'Threat of Job Loss', 6),
  ((select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-amina'), 'z60-4', 'Z60', 'Z60.4', 'Z60.4', 'Z60.4', 'Social Exclusion or Rejection', 9)
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
  ((select id from atlas.partners where organization_name_normalized = 'north-harbor-housing-collaborative'), (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-maya'), (select id from atlas.z_codes where z_code = 'Z56.2'), 'Z56.2', 4, 'specialize', 0.4444),
  ((select id from atlas.partners where organization_name_normalized = 'north-harbor-housing-collaborative'), (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-maya'), (select id from atlas.z_codes where z_code = 'Z60.4'), 'Z60.4', 5, 'specialize', 0.5556),
  ((select id from atlas.partners where organization_name_normalized = 'workspring-alliance'), (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-luis'), (select id from atlas.z_codes where z_code = 'Z59.1'), 'Z59.1', 5, 'specialize', 0.5556),
  ((select id from atlas.partners where organization_name_normalized = 'workspring-alliance'), (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-luis'), (select id from atlas.z_codes where z_code = 'Z56.2'), 'Z56.2', 8, 'specialize', 0.8889),
  ((select id from atlas.partners where organization_name_normalized = 'workspring-alliance'), (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-luis'), (select id from atlas.z_codes where z_code = 'Z60.4'), 'Z60.4', 4, 'specialize', 0.4444),
  ((select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'), (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-amina'), (select id from atlas.z_codes where z_code = 'Z59.1'), 'Z59.1', 7, 'specialize', 0.7778),
  ((select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'), (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-amina'), (select id from atlas.z_codes where z_code = 'Z56.2'), 'Z56.2', 6, 'specialize', 0.6667),
  ((select id from atlas.partners where organization_name_normalized = 'bridgeline-social-support-network'), (select id from atlas.partner_service_capacity_submissions where draft_key = 'example-submission-amina'), (select id from atlas.z_codes where z_code = 'Z60.4'), 'Z60.4', 9, 'specialize', 1.0)
on conflict (partner_id, z_code_id) do update
set submission_id = excluded.submission_id,
    z_code = excluded.z_code,
    burden_score = excluded.burden_score,
    derived_relation_type = excluded.derived_relation_type,
    strength = excluded.strength;;
