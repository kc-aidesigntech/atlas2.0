-- Replace the prior capability-strength pivot with a legible 1-9 survey rating pivot.
-- This view keeps z-code columns while exposing when the latest survey was conducted.
do $$
declare
  rating_columns text;
  create_view_sql text;
begin
  -- Column layout changed from prior capability-strength pivot, so recreate view.
  execute 'drop view if exists atlas.v_partner_service_capacity_profile_pivot';

  select
    string_agg(
      format(
        '  max(case when z.id = %L then b.burden_score end)::numeric(4,2) as %I',
        z.id,
        'z_' ||
          regexp_replace(lower(z.z_code), '[^a-z0-9]+', '_', 'g') ||
          '__' ||
          left(regexp_replace(lower(coalesce(z.title, 'untitled')), '[^a-z0-9]+', '_', 'g'), 24) ||
          '__rating_1_9'
      ),
      E',\n'
      order by z.z_code
    )
  into rating_columns
  from atlas.z_codes z
  where z.is_active = true;

  if rating_columns is null then
    rating_columns := '  null::numeric(4,2) as no_active_z_codes_rating_1_9';
  end if;

  create_view_sql := format(
$view$
create or replace view atlas.v_partner_service_capacity_profile_pivot as
select
  p.id as partner_id,
  p.organization_name,
  max(coalesce(s.completed_at, b.updated_at)) as latest_survey_conducted_at,
%s
from atlas.partners p
left join atlas.partner_z_code_burden_scores b
  on b.partner_id = p.id
left join atlas.z_codes z
  on z.id = b.z_code_id
left join atlas.partner_service_capacity_submissions s
  on s.id = b.submission_id
group by p.id, p.organization_name
order by p.organization_name;
$view$,
    rating_columns
  );

  execute create_view_sql;
end $$;

comment on view atlas.v_partner_service_capacity_profile_pivot is
  'Partner service capacity pivot using raw burden ratings (1-9) per z-code, plus latest survey conducted timestamp.';

grant select on atlas.v_partner_service_capacity_profile_pivot to authenticated;
