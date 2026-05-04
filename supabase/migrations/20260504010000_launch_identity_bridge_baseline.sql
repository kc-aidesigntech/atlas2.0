-- Launch identity bridge baseline:
-- - keeps auth.users and atlas.people synchronized in all environments
-- - provisions atlas.people rows for legacy auth users created before bridge triggers existed
-- - assigns a default navigator role only when a person has no active role assignment
--
-- This migration intentionally replaces missing historical migration filenames referenced in
-- docs/runbooks so new environments can be commissioned from the active migration chain alone.

create or replace function atlas.handle_auth_user_people_sync()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  navigator_role_id uuid;
  metadata jsonb;
  first_name_value text;
  last_name_value text;
  display_name_value text;
  email_local_part text;
  full_name_value text;
begin
  select r.id
  into navigator_role_id
  from atlas.roles r
  where r.role_key = 'navigator'
  limit 1;

  if tg_op = 'INSERT' then
    metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    first_name_value := nullif(trim(metadata ->> 'first_name'), '');
    last_name_value := nullif(trim(metadata ->> 'last_name'), '');

    if first_name_value is null
      and last_name_value is null
      and nullif(trim(metadata ->> 'full_name'), '') is not null
    then
      full_name_value := trim(metadata ->> 'full_name');
      if position(' ' in full_name_value) > 0 then
        first_name_value := split_part(full_name_value, ' ', 1);
        last_name_value := nullif(trim(substring(full_name_value from position(' ' in full_name_value) + 1)), '');
      else
        first_name_value := full_name_value;
        last_name_value := 'User';
      end if;
    end if;

    if first_name_value is null and last_name_value is null then
      email_local_part := nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), '');
      first_name_value := coalesce(email_local_part, 'atlas');
      last_name_value := 'User';
    end if;

    first_name_value := coalesce(first_name_value, 'atlas');
    last_name_value := coalesce(last_name_value, 'User');
    display_name_value := trim(first_name_value || ' ' || last_name_value);

    insert into atlas.people (
      id,
      external_ref,
      first_name,
      last_name,
      display_name,
      email,
      person_type,
      status
    )
    values (
      new.id,
      new.id::text,
      first_name_value,
      last_name_value,
      display_name_value,
      new.email,
      'staff',
      'active'
    )
    on conflict (id) do update
    set
      external_ref = excluded.external_ref,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      display_name = excluded.display_name,
      email = excluded.email,
      updated_at = now();

    if navigator_role_id is not null then
      insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on)
      select new.id, navigator_role_id, true, current_date
      where not exists (
        select 1
        from atlas.people_role_assignments pra
        where pra.person_id = new.id
          and pra.ends_on is null
      );
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.email is distinct from old.email
      or new.raw_user_meta_data is distinct from old.raw_user_meta_data
    then
      metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
      update atlas.people p
      set
        external_ref = coalesce(p.external_ref, new.id::text),
        email = new.email,
        first_name = coalesce(nullif(trim(metadata ->> 'first_name'), ''), p.first_name),
        last_name = coalesce(nullif(trim(metadata ->> 'last_name'), ''), p.last_name),
        display_name = case
          when nullif(trim(concat_ws(' ', metadata ->> 'first_name', metadata ->> 'last_name')), '') is not null
            then trim(concat_ws(' ', metadata ->> 'first_name', metadata ->> 'last_name'))
          when nullif(trim(metadata ->> 'full_name'), '') is not null
            then trim(metadata ->> 'full_name')
          else p.display_name
        end,
        updated_at = now()
      where p.id = new.id;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_on_auth_user_created on auth.users;
create trigger atlas_on_auth_user_created
after insert on auth.users
for each row
execute procedure atlas.handle_auth_user_people_sync();

drop trigger if exists atlas_on_auth_user_updated on auth.users;
create trigger atlas_on_auth_user_updated
after update on auth.users
for each row
execute procedure atlas.handle_auth_user_people_sync();

do $$
declare
  navigator_role_id uuid;
begin
  -- Backfill users that predate the trigger so identity mapping is complete.
  select r.id
  into navigator_role_id
  from atlas.roles r
  where r.role_key = 'navigator'
  limit 1;

  insert into atlas.people (
    id,
    external_ref,
    first_name,
    last_name,
    display_name,
    email,
    person_type,
    status
  )
  select
    u.id,
    u.id::text,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'first_name'), ''), nullif(trim(split_part(coalesce(u.email, ''), '@', 1)), ''), 'atlas'),
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'last_name'), ''), 'User'),
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(concat_ws(' ', u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'last_name')), ''),
      trim(
        coalesce(nullif(trim(u.raw_user_meta_data ->> 'first_name'), ''), nullif(trim(split_part(coalesce(u.email, ''), '@', 1)), ''), 'atlas')
        || ' '
        || coalesce(nullif(trim(u.raw_user_meta_data ->> 'last_name'), ''), 'User')
      )
    ),
    u.email,
    'staff',
    'active'
  from auth.users u
  where not exists (
    select 1
    from atlas.people p
    where p.id = u.id
  );

  if navigator_role_id is not null then
    insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on)
    select u.id, navigator_role_id, true, current_date
    from auth.users u
    where not exists (
      select 1
      from atlas.people_role_assignments pra
      where pra.person_id = u.id
        and pra.ends_on is null
    );
  end if;
end
$$;

notify pgrst, 'reload schema';
