-- Enable multi-role identity assignments per person while preserving one active
-- primary role. This lets operators test role-specific app experiences against
-- one authenticated identity without duplicating person records.

drop index if exists atlas.ux_people_role_assignments_person_id;
drop index if exists atlas.ux_people_role_assignments_person_role_active;
drop index if exists atlas.ux_people_role_assignments_active_primary_per_person;

create unique index if not exists ux_people_role_assignments_person_role_active
  on atlas.people_role_assignments (person_id, role_id)
  where ends_on is null;

create unique index if not exists ux_people_role_assignments_active_primary_per_person
  on atlas.people_role_assignments (person_id)
  where is_primary = true and ends_on is null;

-- Normalize existing active assignments so every person keeps a single primary
-- row if historical edits ever left conflicting state.
with ranked_active as (
  select
    pra.id,
    pra.person_id,
    row_number() over (
      partition by pra.person_id
      order by
        case when pra.is_primary then 0 else 1 end,
        pra.starts_on desc,
        pra.created_at desc,
        pra.id desc
    ) as row_num
  from atlas.people_role_assignments pra
  where pra.ends_on is null
)
update atlas.people_role_assignments pra
set is_primary = ranked_active.row_num = 1
from ranked_active
where pra.id = ranked_active.id;
