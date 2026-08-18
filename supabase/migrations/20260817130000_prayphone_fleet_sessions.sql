-- Pray Phone fleet, durable call sessions, and post-call kiosk collections
-- live in the Atlas schema. prayphone-server is the ingest/query proxy.

create table if not exists atlas.prayphone_devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  name text,
  status text,
  model text,
  app_version text,
  ota_channel text,
  last_seen timestamptz,
  enabled boolean not null default true,
  ingest_token_suffix text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas.prayphone_device_logs (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  api_subject text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_prayphone_device_logs_device
  on atlas.prayphone_device_logs (device_id, created_at desc);

create table if not exists atlas.prayphone_call_sessions (
  id uuid primary key,
  room_name text not null,
  state text not null,
  from_aor text,
  to_aor text,
  trigger_source text,
  invite_targets jsonb not null default '[]'::jsonb,
  participants jsonb not null default '[]'::jsonb,
  provider text not null default 'signalwire',
  provider_call_id text,
  provider_leg_id text,
  trace_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  error text
);
create index if not exists idx_prayphone_call_sessions_state_updated
  on atlas.prayphone_call_sessions (state, updated_at desc);

create table if not exists atlas.prayphone_call_events (
  id uuid primary key,
  call_id uuid not null references atlas.prayphone_call_sessions(id) on delete cascade,
  at timestamptz not null,
  stage text not null,
  source text not null,
  payload jsonb
);
create index if not exists idx_prayphone_call_events_call
  on atlas.prayphone_call_events (call_id, at);

create table if not exists atlas.prayphone_kiosk_collections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references atlas.prayphone_call_sessions(id) on delete set null,
  device_id text,
  collected_at timestamptz not null default now(),
  payload jsonb not null
);
create index if not exists idx_prayphone_kiosk_collections_session
  on atlas.prayphone_kiosk_collections (session_id);

alter table atlas.prayphone_devices enable row level security;
alter table atlas.prayphone_device_logs enable row level security;
alter table atlas.prayphone_call_sessions enable row level security;
alter table atlas.prayphone_call_events enable row level security;
alter table atlas.prayphone_kiosk_collections enable row level security;

-- Service-role (prayphone-server) bypasses RLS. Authenticated Atlas staff
-- may read fleet and collections when they can sit the warm line.
create policy prayphone_devices_warmline_select
  on atlas.prayphone_devices
  for select
  to authenticated
  using (atlas.fn_can_access_warmline_agent());

create policy prayphone_device_logs_warmline_select
  on atlas.prayphone_device_logs
  for select
  to authenticated
  using (atlas.fn_can_access_warmline_agent());

create policy prayphone_call_sessions_warmline_select
  on atlas.prayphone_call_sessions
  for select
  to authenticated
  using (atlas.fn_can_access_warmline_agent());

create policy prayphone_call_events_warmline_select
  on atlas.prayphone_call_events
  for select
  to authenticated
  using (atlas.fn_can_access_warmline_agent());

create policy prayphone_kiosk_collections_warmline_select
  on atlas.prayphone_kiosk_collections
  for select
  to authenticated
  using (atlas.fn_can_access_warmline_agent());

grant select on atlas.prayphone_devices to authenticated;
grant select on atlas.prayphone_device_logs to authenticated;
grant select on atlas.prayphone_call_sessions to authenticated;
grant select on atlas.prayphone_call_events to authenticated;
grant select on atlas.prayphone_kiosk_collections to authenticated;
