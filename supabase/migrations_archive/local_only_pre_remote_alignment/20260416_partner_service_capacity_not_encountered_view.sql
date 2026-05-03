create or replace view atlas.v_partner_service_capacity_not_encountered as
with ranked_answers as (
  select
    submissions.partner_id,
    submissions.id as submission_id,
    submissions.draft_key,
    submissions.organization_name,
    submissions.organization_name_normalized,
    submissions.completed_at,
    submissions.updated_at,
    submissions.submitted_at,
    answers.prompt_id,
    answers.parent_code,
    answers.z_code,
    answers.normalized_z_code,
    answers.title,
    answers.description,
    row_number() over (
      partition by submissions.partner_id, answers.normalized_z_code
      order by coalesce(submissions.completed_at, submissions.updated_at, submissions.submitted_at) desc, submissions.id desc
    ) as row_num
  from atlas.partner_service_capacity_submissions submissions
  join atlas.partner_service_capacity_answers answers
    on answers.submission_id = submissions.id
  where submissions.partner_id is not null
    and submissions.status = 'completed'
    and answers.not_encountered = true
    and answers.burden_score is null
)
select
  partner_id,
  submission_id,
  draft_key,
  organization_name,
  organization_name_normalized,
  completed_at,
  updated_at,
  submitted_at,
  prompt_id,
  parent_code,
  z_code,
  normalized_z_code,
  title,
  description
from ranked_answers
where row_num = 1;

comment on view atlas.v_partner_service_capacity_not_encountered is
  'Latest completed survey rows where a partner marked a Z-code as not encountered in their work.';

create or replace function atlas.fn_partner_service_capacity_not_encountered(p_partner_id uuid default null)
returns setof atlas.v_partner_service_capacity_not_encountered
language sql
stable
as $$
  select *
  from atlas.v_partner_service_capacity_not_encountered
  where p_partner_id is null or partner_id = p_partner_id
  order by organization_name_normalized nulls last, normalized_z_code;
$$;

grant select on atlas.v_partner_service_capacity_not_encountered to anon, authenticated;
grant execute on function atlas.fn_partner_service_capacity_not_encountered(uuid) to anon, authenticated;
