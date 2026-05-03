-- Enforce one-role-per-person identity model and partner-only partner directory views.

with ranked_assignments as (
  select
    pra.id,
    pra.person_id,
    row_number() over (
      partition by pra.person_id
      order by
        case when pra.ends_on is null then 0 else 1 end,
        case when pra.is_primary then 0 else 1 end,
        pra.starts_on desc,
        pra.created_at desc,
        pra.id desc
    ) as row_num
  from atlas.people_role_assignments pra
)
delete from atlas.people_role_assignments pra
using ranked_assignments ranked
where pra.id = ranked.id
  and ranked.row_num > 1;

update atlas.people_role_assignments
set is_primary = true
where is_primary = false;

create unique index if not exists ux_people_role_assignments_person_id
  on atlas.people_role_assignments(person_id);

create or replace view atlas.v_partner_identifier_records as
select
  p.id as partner_id,
  p.primary_contact_first_name as first_name,
  p.primary_contact_last_name as last_name,
  p.organization_name,
  p.primary_contact_email as email
from atlas.partners p
where p.is_active = true
  and (
    nullif(trim(coalesce(p.primary_contact_first_name, '')), '') is not null
    or nullif(trim(coalesce(p.primary_contact_last_name, '')), '') is not null
    or nullif(trim(coalesce(p.primary_contact_email, '')), '') is not null
  );

create or replace view atlas.v_partners_page_records as
select
  p.id as partner_id,
  p.organization_name,
  p.organization_name_normalized,
  p.primary_contact_first_name,
  p.primary_contact_last_name,
  p.primary_contact_email,
  p.updated_at
from atlas.partners p
where p.is_active = true
order by p.organization_name asc;

grant select on atlas.v_partner_identifier_records to anon, authenticated;
grant select on atlas.v_partners_page_records to anon, authenticated;
