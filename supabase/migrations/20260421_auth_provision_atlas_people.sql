-- Auth → Atlas identity bridge
--
-- When a row is created in auth.users, provision a matching atlas.people row using the same
-- primary key as auth.users.id and external_ref = auth user id text. This aligns with
-- atlas.fn_current_person_id(), which resolves the operator via people.external_ref = auth.uid().
--
-- Identity linking (email/password then Google/Apple as the same Supabase user):
-- Configure in Supabase Dashboard → Authentication:
--   - Enable "Automatic identity linking" so verified-email SSO matches the existing email user.
--   - Enable "Manual identity linking" if operators should connect additional providers while
--     signed in (client uses auth.linkIdentity).
--
-- HIPAA-oriented platform controls (organizational + Supabase project settings, not expressible
-- in SQL alone): execute a Business Associate Agreement with Supabase, enable MFA for staff,
-- require email confirmations, enforce strong password / leaked-password protection, shorten JWT
-- lifetime for clinical contexts, disable anonymous sign-ins, and use TLS-only clients.
-- Atlas stores no passwords in application tables; credentials remain in Supabase Auth.

create or replace function atlas.handle_auth_user_people_sync()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  nav_role_id uuid;
  meta jsonb;
  fn text;
  ln text;
  disp text;
  local_part text;
  full_raw text;
begin
  select r.id
  into nav_role_id
  from atlas.roles r
  where r.role_key = 'navigator'
  limit 1;

  if tg_op = 'INSERT' then
    meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    fn := nullif(trim(meta ->> 'first_name'), '');
    ln := nullif(trim(meta ->> 'last_name'), '');

    if fn is null and ln is null and nullif(trim(meta ->> 'full_name'), '') is not null then
      full_raw := trim(meta ->> 'full_name');
      if position(' ' in full_raw) > 0 then
        fn := split_part(full_raw, ' ', 1);
        ln := nullif(trim(substring(full_raw from position(' ' in full_raw) + 1)), '');
      else
        fn := full_raw;
        ln := 'User';
      end if;
    end if;

    if fn is null and ln is null then
      local_part := nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), '');
      fn := coalesce(local_part, 'atlas');
      ln := 'User';
    end if;

    fn := coalesce(fn, 'atlas');
    ln := coalesce(ln, 'User');
    disp := trim(fn || ' ' || ln);

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
      fn,
      ln,
      disp,
      new.email,
      'staff',
      'active'
    )
    on conflict (id) do update set
      email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      display_name = excluded.display_name,
      updated_at = now();

    if nav_role_id is not null then
      insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on)
      select new.id, nav_role_id, true, current_date
      where not exists (
        select 1 from atlas.people_role_assignments pra where pra.person_id = new.id
      );
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.email is distinct from old.email
      or new.raw_user_meta_data is distinct from old.raw_user_meta_data
    then
      meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
      update atlas.people p
      set
        email = new.email,
        first_name = coalesce(nullif(trim(meta ->> 'first_name'), ''), p.first_name),
        last_name = coalesce(nullif(trim(meta ->> 'last_name'), ''), p.last_name),
        display_name = case
          when nullif(trim(concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name')), '') is not null
            then trim(concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name'))
          when nullif(trim(meta ->> 'full_name'), '') is not null
            then trim(meta ->> 'full_name')
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
