-- Launch assignment integrity hardening:
-- - enforce one active row per assignment edge pair
-- - enforce one active role edge per person + role and one active primary role per person
-- - remove direct table writes from browser roles so assignment changes flow through guarded RPCs

-- Resolve duplicate active navigator assignment edges before unique constraints are applied.
with ranked_navigator_edges as (
  select
    na.id,
    row_number() over (
      partition by na.enrollment_id, na.navigator_person_id
      order by na.starts_on desc, na.id desc
    ) as row_num
  from atlas.navigator_assignments na
  where na.ends_on is null
)
update atlas.navigator_assignments na
set ends_on = current_date
from ranked_navigator_edges ranked
where na.id = ranked.id
  and ranked.row_num > 1;

-- Resolve duplicate active supervisor assignment edges.
with ranked_supervisor_edges as (
  select
    sna.id,
    row_number() over (
      partition by sna.supervisor_person_id, sna.navigator_person_id
      order by sna.starts_on desc, sna.id desc
    ) as row_num
  from atlas.supervisor_navigator_assignments sna
  where sna.ends_on is null
)
update atlas.supervisor_navigator_assignments sna
set ends_on = current_date
from ranked_supervisor_edges ranked
where sna.id = ranked.id
  and ranked.row_num > 1;

-- Resolve duplicate active role edges before role uniqueness constraints are added.
with ranked_role_edges as (
  select
    pra.id,
    row_number() over (
      partition by pra.person_id, pra.role_id
      order by pra.starts_on desc, pra.created_at desc, pra.id desc
    ) as row_num
  from atlas.people_role_assignments pra
  where pra.ends_on is null
)
update atlas.people_role_assignments pra
set ends_on = current_date, is_primary = false
from ranked_role_edges ranked
where pra.id = ranked.id
  and ranked.row_num > 1;

-- Keep exactly one active primary role per person.
with ranked_active_primary as (
  select
    pra.id,
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
set is_primary = ranked.row_num = 1
from ranked_active_primary ranked
where pra.id = ranked.id;

create unique index if not exists ux_navigator_assignments_active_pair
  on atlas.navigator_assignments (enrollment_id, navigator_person_id)
  where ends_on is null;

create unique index if not exists ux_supervisor_navigator_assignments_active_pair
  on atlas.supervisor_navigator_assignments (supervisor_person_id, navigator_person_id)
  where ends_on is null;

create unique index if not exists ux_people_role_assignments_person_role_active
  on atlas.people_role_assignments (person_id, role_id)
  where ends_on is null;

create unique index if not exists ux_people_role_assignments_active_primary_per_person
  on atlas.people_role_assignments (person_id)
  where is_primary = true and ends_on is null;

-- Assignment mutations must go through constrained Remote Procedure Calls (RPCs).
revoke insert, update, delete on atlas.navigator_assignments from anon, authenticated;
revoke insert, update, delete on atlas.supervisor_navigator_assignments from anon, authenticated;
revoke insert, update, delete on atlas.partner_contact_assignments from anon, authenticated;
revoke insert, update, delete on atlas.people_role_assignments from anon, authenticated;

grant select on atlas.navigator_assignments to authenticated;
grant select on atlas.supervisor_navigator_assignments to authenticated;
grant select on atlas.partner_contact_assignments to authenticated;
grant select on atlas.people_role_assignments to authenticated;

notify pgrst, 'reload schema';
