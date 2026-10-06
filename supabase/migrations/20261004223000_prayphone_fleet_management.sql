-- Pray Phone fleet management: site address on the device row, and Wi-Fi
-- credentials in a separate table so warm-line staff who can read call
-- history cannot select the passphrase.
-- The device pulls credentials with its ingest token through prayphone-server
-- (service role). Atlas staff write them only through the functions below.

alter table atlas.prayphone_devices
  add column if not exists location_address text;

comment on column atlas.prayphone_devices.location_address is
  'Street address where this Pray Phone kiosk is installed. Set from the fleet subapp.';

create table if not exists atlas.prayphone_device_network (
  device_id text primary key references atlas.prayphone_devices (device_id) on delete cascade,
  wifi_username text not null default '',
  wifi_password text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table atlas.prayphone_device_network is
  'Desired Wi-Fi login for a Pray Phone. wifi_username is the network name (Service Set Identifier). The passphrase is not granted to the authenticated role.';

alter table atlas.prayphone_device_network enable row level security;

-- No policies: authenticated and anonymous roles are denied. service_role
-- bypasses Row-Level Security (RLS) and is the only reader of the passphrase.
revoke all on table atlas.prayphone_device_network from public, anon, authenticated;
grant select, insert, update, delete on table atlas.prayphone_device_network to service_role;

create or replace function atlas.fn_can_manage_prayphone_fleet()
returns boolean
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
declare
  current_person uuid;
  role_claim text;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Same JSON Web Token (JWT) fast path other staff helpers use.
  role_claim := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '');
  if role_claim in ('administrator', 'supervisor') then
    return true;
  end if;

  current_person := atlas.fn_current_person_id();
  if current_person is null then
    return false;
  end if;

  return exists (
    select 1
    from atlas.people_role_assignments pra
    join atlas.roles r on r.id = pra.role_id
    where pra.person_id = current_person
      and r.role_key in ('administrator', 'supervisor')
      and pra.starts_on <= current_date
      and (pra.ends_on is null or pra.ends_on >= current_date)
  );
end;
$$;

comment on function atlas.fn_can_manage_prayphone_fleet() is
  'True for an administrator or supervisor. Navigators who can sit the warm line still cannot open fleet settings.';

revoke all on function atlas.fn_can_manage_prayphone_fleet() from public;
grant execute on function atlas.fn_can_manage_prayphone_fleet() to authenticated;

create or replace function atlas.fn_list_prayphone_device_network()
returns table (
  device_id text,
  wifi_username text,
  has_wifi_password boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
begin
  if not atlas.fn_can_manage_prayphone_fleet() then
    return;
  end if;

  return query
  select
    n.device_id,
    n.wifi_username,
    (n.wifi_password <> ''),
    n.updated_at
  from atlas.prayphone_device_network n;
end;
$$;

comment on function atlas.fn_list_prayphone_device_network() is
  'Fleet managers see the Wi-Fi network name and whether a passphrase is stored. The passphrase itself is omitted.';

revoke all on function atlas.fn_list_prayphone_device_network() from public;
grant execute on function atlas.fn_list_prayphone_device_network() to authenticated;

create or replace function atlas.fn_save_prayphone_device_config(
  target_device_id text,
  next_address text,
  next_wifi_username text,
  next_wifi_password text,
  replace_password boolean
)
returns void
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  if not atlas.fn_can_manage_prayphone_fleet() then
    raise exception 'fleet access required' using errcode = '42501';
  end if;

  if target_device_id is null or btrim(target_device_id) = '' then
    raise exception 'device_id is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from atlas.prayphone_devices d where d.device_id = target_device_id
  ) then
    raise exception 'unknown device' using errcode = 'P0002';
  end if;

  update atlas.prayphone_devices
  set
    location_address = nullif(btrim(coalesce(next_address, '')), ''),
    updated_at = now()
  where device_id = target_device_id;

  insert into atlas.prayphone_device_network as n (
    device_id,
    wifi_username,
    wifi_password,
    updated_at,
    updated_by
  )
  values (
    target_device_id,
    coalesce(btrim(next_wifi_username), ''),
    case when coalesce(replace_password, false) then coalesce(next_wifi_password, '') else '' end,
    now(),
    auth.uid()
  )
  on conflict (device_id) do update
  set
    wifi_username = excluded.wifi_username,
    wifi_password = case
      when coalesce(replace_password, false) then excluded.wifi_password
      else n.wifi_password
    end,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

comment on function atlas.fn_save_prayphone_device_config(text, text, text, text, boolean) is
  'Saves a kiosk street address and Wi-Fi network name. The passphrase is replaced only when replace_password is true, so a blank form field does not wipe a stored secret.';

revoke all on function atlas.fn_save_prayphone_device_config(text, text, text, text, boolean) from public;
grant execute on function atlas.fn_save_prayphone_device_config(text, text, text, text, boolean) to authenticated;

-- Fleet is its own workspace menu for the people who run the phones.
-- The entry navigates to the fleet subapp (subdomain or /fleet), same pattern as scribe.
update atlas.app_role_navigation
set top_menus = top_menus || '["fleet"]'::jsonb
where surface = 'singlepane'
  and role_key in ('administrator', 'supervisor')
  and not top_menus ? 'fleet';
