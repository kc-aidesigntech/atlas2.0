-- C.R.E.A.T.E. supervisor-to-navigator AI reflection (current narrative per navigator).
-- Regenerated after each create-session save from the latest session plus prior history.

create table if not exists atlas.navigator_create_reflections (
  id uuid primary key default gen_random_uuid(),
  navigator_name text not null,
  reflection_text text not null default '',
  source_session_ids jsonb not null default '[]'::jsonb,
  source_latest_session_id text not null default '',
  model text not null default '',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint navigator_create_reflections_navigator_name_unique unique (navigator_name)
);

create index if not exists navigator_create_reflections_navigator_name_idx
  on atlas.navigator_create_reflections (lower(navigator_name));

alter table atlas.navigator_create_reflections enable row level security;

drop policy if exists "navigator create reflections authenticated read" on atlas.navigator_create_reflections;
drop policy if exists "navigator create reflections authenticated write" on atlas.navigator_create_reflections;

-- Match create-session pilot baseline: authenticated staff can read/write while
-- role-specific hardening remains a follow-up.
create policy "navigator create reflections authenticated read"
  on atlas.navigator_create_reflections
  for select
  to authenticated
  using (true);

create policy "navigator create reflections authenticated write"
  on atlas.navigator_create_reflections
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table atlas.navigator_create_reflections to authenticated;
