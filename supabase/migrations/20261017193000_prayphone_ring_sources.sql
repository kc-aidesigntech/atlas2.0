-- Which inbound caller classes ring the Atlas header.
-- The conferencer still stores every class. Set enabled to false on a row
-- to silence that class. Row-Level Security (RLS) lets warm-line staff read
-- the rows. A change is made in Supabase, which bypasses this policy.

create table if not exists atlas.prayphone_ring_sources (
  source text primary key,
  enabled boolean not null default true,
  constraint prayphone_ring_sources_source_check
    check (source in ('kiosk', 'anonymous', 'enrollee', 'prospective'))
);

comment on table atlas.prayphone_ring_sources is
  'Inbound caller classes that turn the Atlas header red and play the chime. Set enabled false to silence one class.';

insert into atlas.prayphone_ring_sources (source, enabled)
values
  ('kiosk', true),
  ('anonymous', true),
  ('enrollee', true),
  ('prospective', true)
on conflict (source) do nothing;

alter table atlas.prayphone_ring_sources enable row level security;

drop policy if exists prayphone_ring_sources_warmline_select on atlas.prayphone_ring_sources;
create policy prayphone_ring_sources_warmline_select
  on atlas.prayphone_ring_sources
  for select
  to authenticated
  using (atlas.fn_can_access_warmline_agent());

revoke all on table atlas.prayphone_ring_sources from public, anon, authenticated;
grant select on table atlas.prayphone_ring_sources to authenticated;
grant select, insert, update, delete on table atlas.prayphone_ring_sources to service_role;
