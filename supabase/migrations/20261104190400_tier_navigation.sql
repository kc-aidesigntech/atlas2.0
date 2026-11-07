-- Tier navigation rows.
--
-- atlas.app_role_navigation (surface, role_key, top_menus, action_menus,
-- metadata; unique on surface + role_key) gets one row per Residency tier on
-- the 'singlepane' surface, the surface the navigator / supervisor /
-- administrator rows used. top_menus and action_menus are JavaScript Object
-- Notation (JSON) arrays of strings, the same shape as every earlier row.
--
-- t3a, t4, and t4plus take action_menus and metadata from the legacy row they
-- replace (navigator, supervisor, administrator) when that row still exists,
-- falling back to the values seeded in 20260413031148. t1, t2, t2b, and t3 get
-- empty action_menus and empty metadata. The three legacy rows are deleted at
-- the end.

-- Inserts the seven tier rows; an existing tier row is overwritten with these menus.
with legacy as (
  select n.role_key, n.action_menus, n.metadata
  from atlas.app_role_navigation n
  where n.surface = 'singlepane'
    and n.role_key in ('navigator', 'supervisor', 'administrator')
),
tier_rows(role_key, legacy_role_key, top_menus, fallback_action_menus) as (
  values
    (
      't1',
      null::text,
      '["refer"]'::jsonb,
      '[]'::jsonb
    ),
    (
      't2',
      null::text,
      '["refer","my wallet"]'::jsonb,
      '[]'::jsonb
    ),
    (
      't2b',
      null::text,
      '["refer","my wallet","assigned enrollees","leads","warm line","respite shifts","sponsorships"]'::jsonb,
      '[]'::jsonb
    ),
    (
      't3',
      null::text,
      '["refer","my wallet","secondment schedule","sponsorships"]'::jsonb,
      '[]'::jsonb
    ),
    (
      't3a',
      'navigator',
      '["refer","my wallet","assigned enrollees","requests to enroll","leads","warm line","respite shifts","route planning","my station","county commons","scribe","sponsorships"]'::jsonb,
      '["route planning","log contact","append route step","escalate risk"]'::jsonb
    ),
    (
      't4',
      'supervisor',
      '["refer","my wallet","assigned enrollees","requests to enroll","leads","warm line","respite shifts","route planning","my station","county commons","scribe","sponsorships","assigned navigators","navigator assessments","team burden","cohorts","competency cards","fleet"]'::jsonb,
      '["record navigator assessment","append route step","confirm milestone"]'::jsonb
    ),
    (
      't4plus',
      'administrator',
      '["refer","my wallet","assigned enrollees","requests to enroll","leads","warm line","respite shifts","route planning","my station","county commons","scribe","sponsorships","assigned navigators","navigator assessments","team burden","cohorts","competency cards","fleet","partners","system operations","governance"]'::jsonb,
      '["route planning","set policy threshold","approve route template","audit event logs"]'::jsonb
    )
)
insert into atlas.app_role_navigation (surface, role_key, top_menus, action_menus, metadata)
select
  'singlepane',
  t.role_key,
  t.top_menus,
  coalesce(l.action_menus, t.fallback_action_menus),
  coalesce(l.metadata, '{}'::jsonb)
from tier_rows t
left join legacy l on l.role_key = t.legacy_role_key
on conflict (surface, role_key) do update
set top_menus = excluded.top_menus,
    action_menus = excluded.action_menus,
    metadata = excluded.metadata;

-- Deletes the navigator / supervisor / administrator rows; their role keys no longer exist in atlas.roles.
delete from atlas.app_role_navigation
where surface = 'singlepane'
  and role_key in ('navigator', 'supervisor', 'administrator');
