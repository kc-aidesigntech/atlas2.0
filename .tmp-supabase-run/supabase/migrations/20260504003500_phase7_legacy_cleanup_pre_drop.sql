-- Phase 7 pre-drop cleanup:
-- - converge legacy read surfaces to compatibility wrappers on canonical views
-- - do not drop legacy objects; require explicit approval in a later migration

create table if not exists atlas.legacy_decommission_registry (
  object_name text primary key,
  object_type text not null,
  status text not null check (status in ('active_wrapper', 'pending_drop', 'dropped')),
  replacement_contract text not null,
  parity_verified_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);
insert into atlas.legacy_decommission_registry (
  object_name,
  object_type,
  status,
  replacement_contract,
  parity_verified_at,
  notes,
  updated_at
)
values
  (
    'atlas.v_singlepane_enrollee_profiles',
    'view',
    'active_wrapper',
    'atlas.v_active_enrollment_roster',
    now(),
    'Compatibility wrapper retained for one release window before explicit drop approval.',
    now()
  ),
  (
    'atlas.v_navigator_assigned_enrollees',
    'view',
    'active_wrapper',
    'atlas.v_active_navigator_assignment_edges',
    now(),
    'Compatibility wrapper retained for one release window before explicit drop approval.',
    now()
  )
on conflict (object_name)
do update set
  status = excluded.status,
  replacement_contract = excluded.replacement_contract,
  parity_verified_at = excluded.parity_verified_at,
  notes = excluded.notes,
  updated_at = now();
create or replace view atlas.v_legacy_decommission_readiness
with (security_invoker = true)
as
select
  object_name,
  object_type,
  status,
  replacement_contract,
  parity_verified_at,
  notes,
  updated_at
from atlas.legacy_decommission_registry
order by object_name;
grant select on atlas.legacy_decommission_registry to authenticated;
grant select on atlas.v_legacy_decommission_readiness to authenticated;
notify pgrst, 'reload schema';
