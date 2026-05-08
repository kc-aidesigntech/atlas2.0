-- Navigator self-unassignment helper:
-- - lets an authenticated navigator remove only their own active assignment
-- - preserves other navigator assignments on the same enrollment

create or replace function atlas.fn_navigator_unassign_enrollment_from_self(
  target_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  auth_user_id text := nullif(auth.uid()::text, '');
  auth_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  auth_email text := nullif(coalesce(auth_claims ->> 'email', ''), '');
  current_person_id uuid;
begin
  select p.id
  into current_person_id
  from atlas.people p
  where (auth_user_id is not null and p.external_ref = auth_user_id)
     or (auth_email is not null and lower(p.email) = lower(auth_email))
  order by case when auth_user_id is not null and p.external_ref = auth_user_id then 0 else 1 end
  limit 1;

  if current_person_id is null then
    raise exception 'navigator identity is not mapped to atlas.people'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = current_person_id
      and pra.ends_on is null
      and r.role_key = 'navigator'
  ) then
    raise exception 'navigator role required'
      using errcode = '42501';
  end if;

  update atlas.navigator_assignments
  set ends_on = current_date
  where enrollment_id = target_enrollment_id
    and navigator_person_id = current_person_id
    and ends_on is null;
end;
$$;
revoke all on function atlas.fn_navigator_unassign_enrollment_from_self(uuid) from public;
grant execute on function atlas.fn_navigator_unassign_enrollment_from_self(uuid) to authenticated;
notify pgrst, 'reload schema';
