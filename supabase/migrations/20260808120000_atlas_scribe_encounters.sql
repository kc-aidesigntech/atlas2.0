-- Atlas Scribe: point-of-care listening encounters.
-- Stores the conversation transcript and the generated draft note in a
-- Subjective, Objective, Assessment, Plan (SOAP) structure. Audio is never
-- persisted anywhere; only text reaches this table.

create table if not exists atlas.scribe_encounters (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  encounter_label text not null default '',
  transcript_text text not null default '',
  -- Framework is a column (not implied) so alternative note frameworks (e.g.
  -- DAP, BIRP) can be added later without a schema change.
  note_framework text not null default 'soap',
  -- SOAP sections as {"subjective": "...", "objective": "...", "assessment": "...", "plan": "..."}.
  note_sections jsonb not null default '{}'::jsonb,
  -- draft = transcript captured, note generated/being edited; final = clinician marked complete.
  status text not null default 'draft',
  model text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scribe_encounters_status_check check (status in ('draft', 'final'))
);

create index if not exists scribe_encounters_created_by_idx
  on atlas.scribe_encounters (created_by, created_at desc);

alter table atlas.scribe_encounters enable row level security;

drop policy if exists "scribe encounters owner select" on atlas.scribe_encounters;
drop policy if exists "scribe encounters owner insert" on atlas.scribe_encounters;
drop policy if exists "scribe encounters owner update" on atlas.scribe_encounters;
drop policy if exists "scribe encounters owner delete" on atlas.scribe_encounters;

-- Owner-only Row-Level Security (RLS): encounter transcripts/notes are sensitive
-- point-of-care records, so no cross-user read path exists in v1.
create policy "scribe encounters owner select"
  on atlas.scribe_encounters
  for select
  to authenticated
  using (created_by = auth.uid());

create policy "scribe encounters owner insert"
  on atlas.scribe_encounters
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "scribe encounters owner update"
  on atlas.scribe_encounters
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "scribe encounters owner delete"
  on atlas.scribe_encounters
  for delete
  to authenticated
  using (created_by = auth.uid());

grant select, insert, update, delete on table atlas.scribe_encounters to authenticated;

-- Surface the Scribe subapp in workspace navigation. The menu entry navigates
-- to the standalone subapp (subdomain or /scribe path) rather than rendering
-- an in-shell pane, mirroring the partner "service capacity" pattern.
update atlas.app_role_navigation
set top_menus = top_menus || '["scribe"]'::jsonb
where surface = 'singlepane'
  and role_key in ('navigator', 'supervisor', 'administrator')
  and not top_menus ? 'scribe';
