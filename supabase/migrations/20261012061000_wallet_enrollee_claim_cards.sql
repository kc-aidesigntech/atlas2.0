-- Navigators claim any active enrollee from My Wallet, assigned or not.
-- The list is a security-definer read so Row-Level Security (RLS) on the roster
-- does not hide people who are not already assigned to the caller.

create or replace function atlas.fn_wallet_caller_is_navigator()
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
  auth_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  auth_atlas_role text := lower(coalesce(auth_claims -> 'app_metadata' ->> 'atlas_role', ''));
  auth_atlas_roles jsonb := coalesce(auth_claims -> 'app_metadata' -> 'atlas_roles', '[]'::jsonb);
begin
  if current_person_id is not null and exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = current_person_id
      and pra.ends_on is null
      and r.role_key in ('navigator', 'administrator')
  ) then
    return true;
  end if;

  return auth_atlas_role in ('navigator', 'administrator')
    or exists (
      select 1
      from jsonb_array_elements_text(auth_atlas_roles) as role_value(role_key)
      where lower(role_value.role_key) in ('navigator', 'administrator')
    );
end;
$$;

create or replace function atlas.fn_wallet_enrollee_claim_cards()
returns table (
  enrollment_id uuid,
  display_name text,
  is_mine boolean
)
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person_id uuid := atlas.fn_current_person_id();
begin
  if not atlas.fn_wallet_caller_is_navigator() then
    raise exception 'navigator role required' using errcode = '42501';
  end if;

  return query
  select
    en.id,
    coalesce(nullif(trim(person.display_name), ''), nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''), 'enrollee') as display_name,
    exists (
      select 1
      from atlas.navigator_assignments na
      where na.enrollment_id = en.id
        and na.navigator_person_id = current_person_id
        and na.ends_on is null
    ) as is_mine
  from atlas.enrollments en
  join atlas.enrollees enrollee on enrollee.id = en.enrollee_id
  join atlas.people person on person.id = enrollee.person_id
  where en.status = 'active'
  order by 2;
end;
$$;

revoke all on function atlas.fn_wallet_caller_is_navigator() from public;
revoke all on function atlas.fn_wallet_enrollee_claim_cards() from public;
grant execute on function atlas.fn_wallet_caller_is_navigator() to authenticated;
grant execute on function atlas.fn_wallet_enrollee_claim_cards() to authenticated;

notify pgrst, 'reload schema';
