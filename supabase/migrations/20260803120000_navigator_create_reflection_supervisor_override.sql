-- Allow supervisors to override the auto-generated C.R.E.A.T.E. reflection text
-- while preserving the last model output for audit / optional restore.

alter table atlas.navigator_create_reflections
  add column if not exists generated_reflection_text text not null default '',
  add column if not exists supervisor_overridden_at timestamptz null,
  add column if not exists supervisor_overridden_by text not null default '';

-- Backfill generated copy from current display text when empty so overrides
-- can still restore a prior narrative on older rows.
update atlas.navigator_create_reflections
set generated_reflection_text = reflection_text
where coalesce(trim(generated_reflection_text), '') = ''
  and coalesce(trim(reflection_text), '') <> '';
