-- Phase 3 write-contract consolidation:
-- - add explicit assign/unassign RPC wrappers for each assignment edge
-- - preserve existing many-to-many save RPCs used by matrix batch updates

create or replace function atlas.fn_assignment_assign_enrollment_navigator(
  target_enrollment_id uuid,
  target_navigator_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  current_ids uuid[] := '{}'::uuid[];
begin
  perform atlas.fn_require_admin_claim();

  if target_navigator_person_id is null then
    raise exception 'navigator person id is required' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct na.navigator_person_id), '{}'::uuid[])
  into current_ids
  from atlas.navigator_assignments na
  where na.enrollment_id = target_enrollment_id
    and na.ends_on is null;

  perform atlas.fn_access_matrix_save_enrollment_navigators(
    target_enrollment_id,
    array(
      select distinct id_value
      from unnest(coalesce(current_ids, '{}'::uuid[]) || array[target_navigator_person_id]) as id_value
    )
  );
end;
$$;
create or replace function atlas.fn_assignment_unassign_enrollment_navigator(
  target_enrollment_id uuid,
  target_navigator_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_require_admin_claim();

  update atlas.navigator_assignments
  set ends_on = current_date
  where enrollment_id = target_enrollment_id
    and navigator_person_id = target_navigator_person_id
    and ends_on is null;
end;
$$;
create or replace function atlas.fn_assignment_assign_supervisor_navigator(
  target_navigator_person_id uuid,
  target_supervisor_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  current_ids uuid[] := '{}'::uuid[];
begin
  perform atlas.fn_require_admin_claim();

  if target_supervisor_person_id is null then
    raise exception 'supervisor person id is required' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct sna.supervisor_person_id), '{}'::uuid[])
  into current_ids
  from atlas.supervisor_navigator_assignments sna
  where sna.navigator_person_id = target_navigator_person_id
    and sna.ends_on is null;

  perform atlas.fn_access_matrix_save_navigator_supervisors(
    target_navigator_person_id,
    array(
      select distinct id_value
      from unnest(coalesce(current_ids, '{}'::uuid[]) || array[target_supervisor_person_id]) as id_value
    )
  );
end;
$$;
create or replace function atlas.fn_assignment_unassign_supervisor_navigator(
  target_navigator_person_id uuid,
  target_supervisor_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  perform atlas.fn_require_admin_claim();

  update atlas.supervisor_navigator_assignments
  set ends_on = current_date
  where navigator_person_id = target_navigator_person_id
    and supervisor_person_id = target_supervisor_person_id
    and ends_on is null;
end;
$$;
create or replace function atlas.fn_assignment_assign_partner_contact(
  target_partner_id uuid,
  target_contact_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  current_ids uuid[] := '{}'::uuid[];
begin
  perform atlas.fn_require_admin_claim();

  if target_contact_person_id is null then
    raise exception 'partner contact person id is required' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct pca.person_id), '{}'::uuid[])
  into current_ids
  from atlas.partner_contact_assignments pca
  where pca.partner_id = target_partner_id
    and pca.ends_on is null;

  perform atlas.fn_access_matrix_save_partner_contacts(
    target_partner_id,
    array(
      select distinct id_value
      from unnest(coalesce(current_ids, '{}'::uuid[]) || array[target_contact_person_id]) as id_value
    )
  );
end;
$$;
create or replace function atlas.fn_assignment_unassign_partner_contact(
  target_partner_id uuid,
  target_contact_person_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  remaining_ids uuid[] := '{}'::uuid[];
begin
  perform atlas.fn_require_admin_claim();

  select coalesce(array_agg(distinct pca.person_id), '{}'::uuid[])
  into remaining_ids
  from atlas.partner_contact_assignments pca
  where pca.partner_id = target_partner_id
    and pca.ends_on is null
    and pca.person_id <> target_contact_person_id;

  perform atlas.fn_access_matrix_save_partner_contacts(target_partner_id, remaining_ids);
end;
$$;
revoke all on function atlas.fn_assignment_assign_enrollment_navigator(uuid, uuid) from public;
revoke all on function atlas.fn_assignment_unassign_enrollment_navigator(uuid, uuid) from public;
revoke all on function atlas.fn_assignment_assign_supervisor_navigator(uuid, uuid) from public;
revoke all on function atlas.fn_assignment_unassign_supervisor_navigator(uuid, uuid) from public;
revoke all on function atlas.fn_assignment_assign_partner_contact(uuid, uuid) from public;
revoke all on function atlas.fn_assignment_unassign_partner_contact(uuid, uuid) from public;
grant execute on function atlas.fn_assignment_assign_enrollment_navigator(uuid, uuid) to authenticated;
grant execute on function atlas.fn_assignment_unassign_enrollment_navigator(uuid, uuid) to authenticated;
grant execute on function atlas.fn_assignment_assign_supervisor_navigator(uuid, uuid) to authenticated;
grant execute on function atlas.fn_assignment_unassign_supervisor_navigator(uuid, uuid) to authenticated;
grant execute on function atlas.fn_assignment_assign_partner_contact(uuid, uuid) to authenticated;
grant execute on function atlas.fn_assignment_unassign_partner_contact(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
