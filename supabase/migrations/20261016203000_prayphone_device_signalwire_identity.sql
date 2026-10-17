-- Caller address for each Pray Phone. The live call is a SignalWire video room.
-- signalwire_identity is that room's caller address. It is not a Session
-- Initiation Protocol (SIP) password. calls_as_device_id lets one phone
-- place calls as another enabled phone until the link is cleared.

alter table atlas.prayphone_devices
  add column if not exists signalwire_identity text,
  add column if not exists calls_as_device_id text;

comment on column atlas.prayphone_devices.signalwire_identity is
  'Caller address the agent console shows for this phone. The live call is a SignalWire video room. This is not a Session Initiation Protocol (SIP) password. Unique when set.';

comment on column atlas.prayphone_devices.calls_as_device_id is
  'When set, this phone places calls as that other enabled device. The mobile proxy points at prayphone-device-001 until this is cleared, which makes it use its own signalwire_identity.';

alter table atlas.prayphone_devices
  drop constraint if exists prayphone_devices_calls_as_device_id_fkey;

alter table atlas.prayphone_devices
  add constraint prayphone_devices_calls_as_device_id_fkey
  foreign key (calls_as_device_id)
  references atlas.prayphone_devices (device_id);

create unique index if not exists prayphone_devices_signalwire_identity_key
  on atlas.prayphone_devices (signalwire_identity)
  where signalwire_identity is not null;

update atlas.prayphone_devices
set signalwire_identity = device_id,
    updated_at = now()
where device_id = 'prayphone-device-001'
  and signalwire_identity is null;

insert into atlas.prayphone_devices (
  device_id,
  name,
  model,
  status,
  enabled,
  signalwire_identity,
  calls_as_device_id
)
select
  'prayphone-mobile-001',
  'Pray Phone mobile',
  'mobile',
  'offline',
  true,
  'prayphone-mobile-001',
  'prayphone-device-001'
where exists (
  select 1 from atlas.prayphone_devices where device_id = 'prayphone-device-001'
)
on conflict (device_id) do nothing;
