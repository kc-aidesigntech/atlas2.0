-- Live online count for the Atlas Pray Phone header.
-- The kiosk already posts last_seen about once a minute through prayphone-server.
-- Supabase Realtime lets a signed-in warm-line browser refresh that count
-- without waiting for the next poll. A phone that stops posting ages out of
-- the three-minute window on the client; this publication does not invent an
-- offline row.

alter table atlas.prayphone_devices replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'atlas'
         and tablename = 'prayphone_devices'
     ) then
    alter publication supabase_realtime add table atlas.prayphone_devices;
  end if;
end $$;
