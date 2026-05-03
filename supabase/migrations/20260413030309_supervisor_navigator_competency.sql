-- Supervisor role and navigator competency assessment foundation.

do $$
begin
  alter table atlas.roles drop constraint if exists roles_role_key_check;
  alter table atlas.roles
    add constraint roles_role_key_check
    check (role_key in ('navigator', 'partner', 'supervisor', 'administrator', 'enrollee'));
exception
  when undefined_table then
    raise notice 'atlas.roles not found; skipping role check migration step';
end $$;

create table if not exists atlas.supervisor_navigator_assignments (
  id uuid primary key default gen_random_uuid(),
  supervisor_person_id uuid not null references atlas.people(id) on delete cascade,
  navigator_person_id uuid not null references atlas.people(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (supervisor_person_id, navigator_person_id, starts_on)
);

create index if not exists idx_supervisor_assignments_supervisor
  on atlas.supervisor_navigator_assignments(supervisor_person_id, starts_on desc);
create index if not exists idx_supervisor_assignments_navigator
  on atlas.supervisor_navigator_assignments(navigator_person_id, starts_on desc);

create table if not exists atlas.navigator_competency_assessments (
  id uuid primary key default gen_random_uuid(),
  supervisor_person_id uuid not null references atlas.people(id) on delete restrict,
  navigator_person_id uuid not null references atlas.people(id) on delete restrict,
  form_version text not null default 'v1',
  assessed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_nav_competency_assessments_supervisor
  on atlas.navigator_competency_assessments(supervisor_person_id, assessed_at desc);
create index if not exists idx_nav_competency_assessments_navigator
  on atlas.navigator_competency_assessments(navigator_person_id, assessed_at desc);

create table if not exists atlas.navigator_competency_assessment_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references atlas.navigator_competency_assessments(id) on delete cascade,
  parent_code text not null,
  z_code text not null,
  normalized_z_code text not null,
  title text not null,
  description text,
  competency_score int not null check (competency_score between 1 and 10),
  created_at timestamptz not null default now(),
  unique (assessment_id, normalized_z_code)
);

create index if not exists idx_nav_competency_answers_assessment
  on atlas.navigator_competency_assessment_answers(assessment_id);
create index if not exists idx_nav_competency_answers_z_code
  on atlas.navigator_competency_assessment_answers(normalized_z_code);

create or replace view atlas.v_supervisor_navigator_competency_rollup as
with assessment_scores as (
  select
    a.id as assessment_id,
    a.supervisor_person_id,
    a.navigator_person_id,
    a.assessed_at,
    avg(aa.competency_score)::numeric(10,4) as assessment_avg_score
  from atlas.navigator_competency_assessments a
  join atlas.navigator_competency_assessment_answers aa on aa.assessment_id = a.id
  group by a.id, a.supervisor_person_id, a.navigator_person_id, a.assessed_at
),
ranked as (
  select
    assessment_id,
    supervisor_person_id,
    navigator_person_id,
    assessed_at,
    assessment_avg_score,
    row_number() over (
      partition by supervisor_person_id, navigator_person_id
      order by assessed_at desc
    ) as recency_rank
  from assessment_scores
),
weighted as (
  select
    supervisor_person_id,
    navigator_person_id,
    count(*)::int as assessment_count,
    max(assessed_at) as last_assessed_at,
    sum(
      assessment_avg_score * case recency_rank
        when 1 then 3
        when 2 then 2
        when 3 then 1
        else 0
      end
    ) as weighted_score_sum,
    sum(
      case recency_rank
        when 1 then 3
        when 2 then 2
        when 3 then 1
        else 0
      end
    ) as weight_sum
  from ranked
  where recency_rank <= 3
  group by supervisor_person_id, navigator_person_id
)
select
  w.supervisor_person_id,
  sp.display_name as supervisor_name,
  w.navigator_person_id,
  np.display_name as navigator_name,
  w.assessment_count,
  w.last_assessed_at,
  case when w.weight_sum > 0 then (w.weighted_score_sum / w.weight_sum)::numeric(10,4) else null end as weighted_rolling_average
from weighted w
join atlas.people sp on sp.id = w.supervisor_person_id
join atlas.people np on np.id = w.navigator_person_id;

grant select, insert, update, delete on atlas.supervisor_navigator_assignments to anon, authenticated;
grant select, insert, update, delete on atlas.navigator_competency_assessments to anon, authenticated;
grant select, insert, update, delete on atlas.navigator_competency_assessment_answers to anon, authenticated;
grant select on atlas.v_supervisor_navigator_competency_rollup to anon, authenticated;;
