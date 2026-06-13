-- Per-Z-code readiness criteria.
--
-- Client spec: each Z-code evaluated in the readiness workflow carries
--   1. Code review: not resolved / partially resolved / resolved
--   2. Confidence in status: low / medium / high
--
-- Design notes:
-- - `code_review_status = 'resolved'` is the single source of truth for the
--   existing resolved semantics: `is_resolved` stays on the table (many views
--   and downstream readiness-complete checks consume it) and is now DERIVED
--   from the review status inside the command Remote Procedure Calls (RPCs),
--   so the two can never drift for RPC-driven writes.
-- - `confidence_level` is independent of resolution state (a navigator can be
--   highly confident a code is NOT resolved), so it is nullable and is not
--   reset when a code flips back to unresolved.
-- - All writes continue to flow through SECURITY DEFINER command RPCs; this
--   migration extends them rather than re-opening direct table grants.

alter table atlas.enrollee_z_codes
  add column if not exists code_review_status text not null default 'not_resolved'
    constraint enrollee_z_codes_code_review_status_check
      check (code_review_status in ('not_resolved', 'partially_resolved', 'resolved')),
  add column if not exists confidence_level text
    constraint enrollee_z_codes_confidence_level_check
      check (confidence_level is null or confidence_level in ('low', 'medium', 'high'));

-- Backfill: rows already marked resolved predate the tri-state review column,
-- so promote them to 'resolved' to keep historical semantics intact.
update atlas.enrollee_z_codes
set code_review_status = 'resolved'
where is_resolved
  and code_review_status <> 'resolved';

-- Expose the readiness criteria through the canonical roster view payload the
-- frontend already consumes (`active_z_code_details` jsonb). Full view body is
-- restated because `create or replace view` requires the complete definition;
-- only the two camelCase keys are new.
create or replace view atlas.v_active_enrollment_roster
with (security_invoker = true)
as
with active_z_codes as (
  select
    ez.enrollment_id,
    array_agg(z.z_code order by z.z_code) as z_code_tags,
    jsonb_agg(
      jsonb_build_object(
        'enrolleeZCodeId', ez.id,
        'parentCode', upper('Z' || substring(z.z_code from 2 for 2)),
        'zCode', z.z_code,
        'title', z.title,
        'description', coalesce(z.description, ''),
        'isResolved', ez.is_resolved,
        'resolutionAt', ez.resolution_at,
        'resolutionPartnerId', ez.resolution_partner_id,
        'resolutionPartnerName', rp.organization_name,
        'resolutionNote', ez.resolution_note,
        'codeReviewStatus', ez.code_review_status,
        'confidenceLevel', ez.confidence_level
      )
      order by z.z_code
    ) as active_z_code_details
  from atlas.enrollee_z_codes ez
  join atlas.z_codes z on z.id = ez.z_code_id
  left join atlas.partners rp on rp.id = ez.resolution_partner_id
  where ez.ended_at is null
  group by ez.enrollment_id
),
completed_parents as (
  select
    resolved_by_parent.enrollment_id,
    array_agg(resolved_by_parent.parent_code order by resolved_by_parent.parent_code) as completed_parent_codes
  from (
    select
      ez.enrollment_id,
      upper('Z' || substring(z.z_code from 2 for 2)) as parent_code
    from atlas.enrollee_z_codes ez
    join atlas.z_codes z on z.id = ez.z_code_id
    where ez.ended_at is null
    group by ez.enrollment_id, upper('Z' || substring(z.z_code from 2 for 2))
    having bool_and(coalesce(ez.is_resolved, false))
  ) resolved_by_parent
  group by resolved_by_parent.enrollment_id
),
active_navigators as (
  select
    edges.enrollment_id,
    array_agg(distinct edges.navigator_person_id) as navigator_person_ids,
    array_agg(distinct edges.navigator_name order by edges.navigator_name) as navigator_names
  from atlas.v_active_navigator_assignment_edges edges
  group by edges.enrollment_id
)
select
  en.id as enrollment_id,
  en.status as enrollment_status,
  en.start_date,
  en.target_duration_months,
  e.id as enrollee_id,
  p.id as enrollee_person_id,
  p.display_name as enrollee_name,
  coalesce(p.email, '') as enrollee_email,
  e.case_id,
  e.current_phase,
  e.county_id,
  c.county_name,
  coalesce(e.dob::text, '') as dob,
  e.avatar_url,
  coalesce(active_navigators.navigator_person_ids, '{}'::uuid[]) as navigator_person_ids,
  coalesce(active_navigators.navigator_names, '{}'::text[]) as navigator_names,
  coalesce(array_to_string(active_navigators.navigator_names, ', '), 'unassigned') as assigned_navigator,
  coalesce(active_z_codes.z_code_tags, '{}'::text[]) as z_code_tags,
  coalesce(active_z_codes.active_z_code_details, '[]'::jsonb) as active_z_code_details,
  coalesce(completed_parents.completed_parent_codes, '{}'::text[]) as completed_parent_codes
from atlas.enrollments en
join atlas.enrollees e on e.id = en.enrollee_id
join atlas.people p on p.id = e.person_id
left join atlas.counties c on c.id = e.county_id
left join active_navigators on active_navigators.enrollment_id = en.id
left join active_z_codes on active_z_codes.enrollment_id = en.id
left join completed_parents on completed_parents.enrollment_id = en.id
where en.status = 'active';

-- Replace the resolution command RPCs with a signature that accepts the new
-- readiness criteria. The legacy 4-argument overloads are dropped (not kept
-- alongside) because PostgREST cannot disambiguate overloads whose extra
-- arguments are all defaulted.
drop function if exists public.fn_set_enrollee_z_code_resolution_context(uuid, boolean, uuid, text);
drop function if exists atlas.fn_set_enrollee_z_code_resolution_context(uuid, boolean, uuid, text);

create or replace function atlas.fn_set_enrollee_z_code_resolution_context(
  p_enrollee_z_code_id uuid,
  p_is_resolved boolean,
  p_partner_id uuid,
  p_resolution_note text,
  p_code_review_status text default null,
  p_confidence_level text default null
)
returns table(
  enrollee_z_code_id uuid,
  is_resolved boolean,
  resolution_at timestamptz,
  resolution_partner_id uuid,
  resolution_partner_name text,
  resolution_note text,
  code_review_status text,
  confidence_level text
)
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  v_enrollment_id uuid;
  -- Review status defaults from the legacy boolean so older save paths keep
  -- working; when provided it becomes the source of truth and the boolean is
  -- derived from it ('resolved' <=> is_resolved) so the two never drift.
  v_status text := coalesce(
    nullif(btrim(lower(p_code_review_status)), ''),
    case when p_is_resolved then 'resolved' else 'not_resolved' end
  );
  v_confidence text := nullif(btrim(lower(p_confidence_level)), '');
  v_resolved boolean;
begin
  if v_status not in ('not_resolved', 'partially_resolved', 'resolved') then
    raise exception 'invalid code review status %, expected not_resolved | partially_resolved | resolved', v_status
      using errcode = '22023';
  end if;
  if v_confidence is not null and v_confidence not in ('low', 'medium', 'high') then
    raise exception 'invalid confidence level %, expected low | medium | high', v_confidence
      using errcode = '22023';
  end if;
  v_resolved := (v_status = 'resolved');

  select ez.enrollment_id into v_enrollment_id
  from atlas.enrollee_z_codes ez
  where ez.id = p_enrollee_z_code_id
    and ez.ended_at is null;

  -- Fail loudly on missing/ended rows instead of silently updating nothing.
  if v_enrollment_id is null then
    raise exception 'active enrollee z-code % not found', p_enrollee_z_code_id
      using errcode = '22023';
  end if;

  if not (v_is_admin or atlas.fn_can_access_enrollment_as_staff(v_enrollment_id)) then
    raise exception 'not authorized to update z-code resolution for enrollment %', v_enrollment_id
      using errcode = '42501';
  end if;

  return query
  update atlas.enrollee_z_codes ez
  set
    is_resolved = v_resolved,
    code_review_status = v_status,
    -- Confidence applies to whatever the current status is, so it is saved as
    -- provided (null clears) instead of being coupled to resolution state.
    confidence_level = v_confidence,
    resolution_at = case when v_resolved then now() else null end,
    resolution_partner_id = case when v_resolved then p_partner_id else null end,
    resolution_note = case when v_resolved then nullif(btrim(p_resolution_note), '') else null end
  where ez.id = p_enrollee_z_code_id
    and ez.ended_at is null
  returning
    ez.id,
    ez.is_resolved,
    ez.resolution_at,
    ez.resolution_partner_id,
    (
      select p.organization_name
      from atlas.partners p
      where p.id = ez.resolution_partner_id
    ),
    ez.resolution_note,
    ez.code_review_status,
    ez.confidence_level;
end;
$$;

-- Public-schema twin kept because the frontend calls the default (public)
-- PostgREST namespace; it simply delegates to the atlas implementation.
create or replace function public.fn_set_enrollee_z_code_resolution_context(
  p_enrollee_z_code_id uuid,
  p_is_resolved boolean,
  p_partner_id uuid,
  p_resolution_note text,
  p_code_review_status text default null,
  p_confidence_level text default null
)
returns table(
  enrollee_z_code_id uuid,
  is_resolved boolean,
  resolution_at timestamptz,
  resolution_partner_id uuid,
  resolution_partner_name text,
  resolution_note text,
  code_review_status text,
  confidence_level text
)
language sql
security definer
set search_path = atlas, public
as $$
  select *
  from atlas.fn_set_enrollee_z_code_resolution_context(
    p_enrollee_z_code_id,
    p_is_resolved,
    p_partner_id,
    p_resolution_note,
    p_code_review_status,
    p_confidence_level
  );
$$;

-- Keep the older partner-name variant consistent: it must move the new review
-- status in lockstep with is_resolved so no write path can desynchronize them.
create or replace function atlas.fn_set_enrollee_z_code_resolution(
  p_enrollee_z_code_id uuid,
  p_is_resolved boolean,
  p_partner_id uuid default null,
  p_partner_name text default null,
  p_resolution_note text default null
)
returns table(
  enrollee_z_code_id uuid,
  is_resolved boolean,
  resolution_at timestamptz,
  resolution_partner_id uuid,
  resolution_partner_name text,
  resolution_note text
)
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
begin
  return query
  update atlas.enrollee_z_codes ez
  set
    is_resolved = p_is_resolved,
    code_review_status = case when p_is_resolved then 'resolved' else 'not_resolved' end,
    resolution_at = case when p_is_resolved then now() else null end,
    resolution_partner_id = case when p_is_resolved then p_partner_id else null end,
    resolution_partner_name = case when p_is_resolved then nullif(btrim(p_partner_name), '') else null end,
    resolution_note = case when p_is_resolved then nullif(btrim(p_resolution_note), '') else null end
  where ez.id = p_enrollee_z_code_id
    and ez.ended_at is null
  returning
    ez.id,
    ez.is_resolved,
    ez.resolution_at,
    ez.resolution_partner_id,
    coalesce(
      ez.resolution_partner_name,
      (
        select p.organization_name
        from atlas.partners p
        where p.id = ez.resolution_partner_id
      )
    ),
    ez.resolution_note;
end;
$$;

-- RPC-only execution surface: authenticated staff only (the RPC itself
-- enforces enrollment-level access; anon had a legacy grant that is removed).
revoke execute on function atlas.fn_set_enrollee_z_code_resolution_context(uuid, boolean, uuid, text, text, text) from public, anon;
grant execute on function atlas.fn_set_enrollee_z_code_resolution_context(uuid, boolean, uuid, text, text, text) to authenticated;
revoke execute on function public.fn_set_enrollee_z_code_resolution_context(uuid, boolean, uuid, text, text, text) from public, anon;
grant execute on function public.fn_set_enrollee_z_code_resolution_context(uuid, boolean, uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
