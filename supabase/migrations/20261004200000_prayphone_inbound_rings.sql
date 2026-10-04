-- Relay for the Atlas header listen control.
-- prayphone-server inserts one ringing row when a kiosk opens a call (key 0).
-- Listening navigator, supervisor, and administrator sessions read it.
-- Row-Level Security (RLS) reuses atlas.fn_can_access_warmline_agent().

create table if not exists atlas.prayphone_inbound_rings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references atlas.prayphone_call_sessions(id) on delete cascade,
  state text not null default 'ringing',
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  constraint prayphone_inbound_rings_state_check
    check (state in ('ringing', 'answered', 'cleared'))
);

create index if not exists idx_prayphone_inbound_rings_ringing
  on atlas.prayphone_inbound_rings (created_at desc)
  where state = 'ringing';

alter table atlas.prayphone_inbound_rings enable row level security;

drop policy if exists prayphone_inbound_rings_warmline_select on atlas.prayphone_inbound_rings;
create policy prayphone_inbound_rings_warmline_select
  on atlas.prayphone_inbound_rings
  for select
  to authenticated
  using (atlas.fn_can_access_warmline_agent());

revoke all on table atlas.prayphone_inbound_rings from public, anon, authenticated;
grant select on table atlas.prayphone_inbound_rings to authenticated;
grant select, insert, update on table atlas.prayphone_inbound_rings to service_role;

-- Realtime delivers the insert/update to browsers that are listening.
-- Replica identity full so an update to answered/cleared includes the old key.
alter table atlas.prayphone_inbound_rings replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'atlas'
         and tablename = 'prayphone_inbound_rings'
     ) then
    alter publication supabase_realtime add table atlas.prayphone_inbound_rings;
  end if;
end $$;

comment on table atlas.prayphone_inbound_rings is
  'Kiosk inbound relay for the Atlas Pray Phone listen button. Service role writes. Warm-line staff may select.';
