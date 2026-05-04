-- Atlas launch database integrity verification queries.
-- Run after migrations are applied in each environment.

-- 1) Identity bridge coverage: every auth user has an atlas.people row and external_ref.
select
  count(*) as auth_user_count,
  count(*) filter (where p.id is not null) as mapped_people_count,
  count(*) filter (where p.external_ref = u.id::text) as exact_external_ref_count
from auth.users u
left join atlas.people p on p.id = u.id;

-- 2) People rows missing auth linkage values.
select
  p.id as person_id,
  p.email,
  p.external_ref
from atlas.people p
where p.external_ref is null
order by p.created_at desc
limit 50;

-- 3) Active role assignment integrity snapshot.
select
  pra.person_id,
  count(*) as active_role_count,
  count(*) filter (where pra.is_primary) as active_primary_count
from atlas.people_role_assignments pra
where pra.ends_on is null
group by pra.person_id
having count(*) = 0
   or count(*) filter (where pra.is_primary) <> 1
order by pra.person_id;

-- 4) Active assignment-edge coverage.
select navigator_person_id, count(*) as active_enrollment_count
from atlas.v_active_navigator_assignment_edges
group by navigator_person_id
order by active_enrollment_count desc;

select supervisor_person_id, count(*) as active_navigator_count
from atlas.v_active_supervisor_assignment_edges
group by supervisor_person_id
order by active_navigator_count desc;

select partner_id, count(*) as active_contact_count
from atlas.v_active_partner_contact_edges
group by partner_id
order by active_contact_count desc;

-- 5) Remote Procedure Call (RPC) reachability (function exists and signature matches).
select
  function_name,
  to_regprocedure(signature) is not null as exists_with_signature
from (
  values
    ('fn_current_person_id', 'atlas.fn_current_person_id()'),
    ('fn_access_matrix_save_person_roles', 'atlas.fn_access_matrix_save_person_roles(uuid,text[])'),
    ('fn_access_matrix_save_enrollment_navigators', 'atlas.fn_access_matrix_save_enrollment_navigators(uuid,uuid[])'),
    ('fn_access_matrix_save_navigator_supervisors', 'atlas.fn_access_matrix_save_navigator_supervisors(uuid,uuid[])'),
    ('fn_access_matrix_save_partner_contacts', 'atlas.fn_access_matrix_save_partner_contacts(uuid,uuid[])'),
    ('fn_navigator_assign_enrollment_to_self', 'atlas.fn_navigator_assign_enrollment_to_self(uuid)'),
    ('fn_navigator_unassign_enrollment_from_self', 'atlas.fn_navigator_unassign_enrollment_from_self(uuid)')
) as required(function_name, signature);
