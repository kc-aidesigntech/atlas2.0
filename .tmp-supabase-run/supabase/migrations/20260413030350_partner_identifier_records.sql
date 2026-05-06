alter table atlas.partners
  add column if not exists primary_contact_first_name text,
  add column if not exists primary_contact_last_name text,
  add column if not exists primary_contact_email text;

alter table atlas.partner_service_capacity_submissions
  add column if not exists respondent_email text;

create or replace view atlas.v_partner_identifier_records as
select
  p.id as partner_id,
  p.primary_contact_first_name as first_name,
  p.primary_contact_last_name as last_name,
  p.organization_name,
  p.primary_contact_email as email
from atlas.partners p
where p.primary_contact_first_name is not null
   or p.primary_contact_last_name is not null
   or p.primary_contact_email is not null;

grant select on atlas.v_partner_identifier_records to anon, authenticated;;
