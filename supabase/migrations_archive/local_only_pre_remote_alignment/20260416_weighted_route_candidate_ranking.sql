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
