-- Streamlined enrollee Z-code override (Feature: binary Z-code status update).
--
-- The navigator-facing override User Experience (UX) presents every catalog
-- Z-code as a checkbox; the checked set IS the enrollee's active Z-code set.
-- This migration adds:
--   1. atlas.enrollee_z_code_uncheck_log - durable audit log of every uncheck,
--      with the navigator-supplied reason ("unchecked z-code coin log").
--   2. atlas.fn_override_enrollee_z_codes - SECURITY DEFINER command Remote
--      Procedure Call (RPC) that reconciles the active set to exactly the
--      checked codes: missing codes are inserted, unchecked codes are ENDED
--      (ended_at stamped, never hard-deleted, preserving resolution history),
--      and each removal is recorded in the audit log.
--
-- Partner-matching contract: route candidates read active enrollee Z-codes
-- (ended_at is null), so checked codes become active rows and matching keeps
-- working unchanged.

create table if not exists atlas.enrollee_z_code_uncheck_log (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references atlas.enrollments(id),
  -- The specific row that was ended, for precise history joins. Nullable only
  -- to survive a future hard cleanup of enrollee_z_codes rows.
  enrollee_z_code_id uuid references atlas.enrollee_z_codes(id) on delete set null,
  z_code_id uuid not null references atlas.z_codes(id),
  -- Denormalized code text so the audit trail stays readable even if catalog
  -- rows are deactivated later.
  z_code text not null,
  reason_code text not null
    constraint enrollee_z_code_uncheck_log_reason_code_check
      check (reason_code in ('restarting_readiness', 'entry_error', 'other')),
  reason_text text,
  -- 'Other:' requires a free-text explanation; the named reasons may omit it.
  constraint enrollee_z_code_uncheck_log_other_needs_text_check
    check (reason_code <> 'other' or nullif(btrim(reason_text), '') is not null),
  removed_by_auth_user_id uuid default auth.uid(),
  removed_by_person_id uuid references atlas.people(id),
  created_at timestamptz not null default now()
);

create index if not exists enrollee_z_code_uncheck_log_enrollment_idx
  on atlas.enrollee_z_code_uncheck_log (enrollment_id, created_at desc);

-- Row-Level Security (RLS): staff scoped to the enrollment may read the log;
-- all writes flow exclusively through the SECURITY DEFINER override RPC.
alter table atlas.enrollee_z_code_uncheck_log enable row level security;

drop policy if exists enrollee_z_code_uncheck_log_staff_select on atlas.enrollee_z_code_uncheck_log;
create policy enrollee_z_code_uncheck_log_staff_select
  on atlas.enrollee_z_code_uncheck_log
  for select
  to authenticated
  using (
    coalesce(((auth.jwt() -> 'app_metadata') ->> 'atlas_role'), '') = 'administrator'
    or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  );

revoke all on atlas.enrollee_z_code_uncheck_log from public, anon, authenticated;
grant select on atlas.enrollee_z_code_uncheck_log to authenticated;

create or replace function atlas.fn_override_enrollee_z_codes(
  p_enrollment_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  v_person_id uuid := atlas.fn_current_person_id();
  v_checked text[];
  v_unknown text[];
  v_missing_reason text[];
  v_now timestamptz := now();
begin
  if p_enrollment_id is null then
    raise exception 'enrollment_id is required' using errcode = '22023';
  end if;

  if not (v_is_admin or atlas.fn_can_access_enrollment_as_staff(p_enrollment_id)) then
    raise exception 'not authorized to override z-codes for enrollment %', p_enrollment_id
      using errcode = '42501';
  end if;

  -- Normalize checked codes from the payload (format-checked, uppercased,
  -- de-duplicated). Codes that do not exist in the catalog fail loudly rather
  -- than being silently dropped, per the app's fail-loud contract.
  select coalesce(array_agg(distinct code), '{}') into v_checked
  from (
    select upper(btrim(value #>> '{}')) as code
    from jsonb_array_elements(coalesce(p_payload -> 'checkedZCodes', '[]'::jsonb)) as value
  ) raw
  where code ~ '^Z\d{2}(\.\d+)?$';

  select coalesce(array_agg(c.code order by c.code), '{}') into v_unknown
  from unnest(v_checked) as c(code)
  where not exists (select 1 from atlas.z_codes z where z.z_code = c.code);

  if array_length(v_unknown, 1) is not null then
    raise exception 'unknown z-codes in override payload: %', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  -- Reasons are keyed by z-code. Every code being unchecked (active now but
  -- absent from the checked set) must carry a valid reason before anything is
  -- mutated, so the audit log can never have gaps. The reasons are parsed
  -- inline (not via a temp table) so the function stays safe to call multiple
  -- times inside a single transaction.
  with reasons as (
    select
      upper(btrim(reason ->> 'zCode')) as z_code,
      lower(btrim(reason ->> 'reasonCode')) as reason_code,
      nullif(btrim(reason ->> 'reasonText'), '') as reason_text
    from jsonb_array_elements(coalesce(p_payload -> 'uncheckReasons', '[]'::jsonb)) as reason
  )
  select coalesce(array_agg(active.z_code order by active.z_code), '{}') into v_missing_reason
  from (
    select z.z_code
    from atlas.enrollee_z_codes ez
    join atlas.z_codes z on z.id = ez.z_code_id
    where ez.enrollment_id = p_enrollment_id
      and ez.ended_at is null
      and z.z_code <> all (v_checked)
  ) active
  where not exists (
    select 1
    from reasons r
    where r.z_code = active.z_code
      and r.reason_code in ('restarting_readiness', 'entry_error', 'other')
      and (r.reason_code <> 'other' or r.reason_text is not null)
  );

  if array_length(v_missing_reason, 1) is not null then
    raise exception 'uncheck reason required for z-codes: %', array_to_string(v_missing_reason, ', ')
      using errcode = '22023';
  end if;

  -- Step 1: end (never delete) active rows that were unchecked, logging each
  -- removal. ended_at keeps resolution history intact for reporting.
  with reasons as (
    select
      upper(btrim(reason ->> 'zCode')) as z_code,
      lower(btrim(reason ->> 'reasonCode')) as reason_code,
      nullif(btrim(reason ->> 'reasonText'), '') as reason_text
    from jsonb_array_elements(coalesce(p_payload -> 'uncheckReasons', '[]'::jsonb)) as reason
  ),
  ended as (
    update atlas.enrollee_z_codes ez
    set ended_at = v_now
    from atlas.z_codes z
    where z.id = ez.z_code_id
      and ez.enrollment_id = p_enrollment_id
      and ez.ended_at is null
      and z.z_code <> all (v_checked)
    returning ez.id as enrollee_z_code_id, ez.z_code_id, z.z_code
  )
  insert into atlas.enrollee_z_code_uncheck_log (
    enrollment_id, enrollee_z_code_id, z_code_id, z_code,
    reason_code, reason_text, removed_by_auth_user_id, removed_by_person_id
  )
  select
    p_enrollment_id, ended.enrollee_z_code_id, ended.z_code_id, ended.z_code,
    r.reason_code, r.reason_text, auth.uid(), v_person_id
  from ended
  join reasons r on r.z_code = ended.z_code;

  -- Step 2: insert active rows for newly checked codes. Codes that already
  -- have an active row are left untouched so resolution state survives saves.
  insert into atlas.enrollee_z_codes (enrollment_id, z_code_id, is_resolved, resolution_at, source, ended_at)
  select p_enrollment_id, z.id, false, null, 'navigator_override', null
  from atlas.z_codes z
  where z.z_code = any (v_checked)
    and not exists (
      select 1 from atlas.enrollee_z_codes ez
      where ez.enrollment_id = p_enrollment_id
        and ez.z_code_id = z.id
        and ez.ended_at is null
    );

  -- Return the refreshed active set in the same camelCase shape as the
  -- canonical roster view, so the frontend can update state without a refetch.
  return (
    select jsonb_build_object(
      'enrollmentId', p_enrollment_id,
      'zCodeTags', coalesce(jsonb_agg(z.z_code order by z.z_code), '[]'::jsonb),
      'activeZCodeDetails', coalesce(
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
        ),
        '[]'::jsonb
      )
    )
    from atlas.enrollee_z_codes ez
    join atlas.z_codes z on z.id = ez.z_code_id
    left join atlas.partners rp on rp.id = ez.resolution_partner_id
    where ez.enrollment_id = p_enrollment_id
      and ez.ended_at is null
  );
end;
$$;

revoke execute on function atlas.fn_override_enrollee_z_codes(uuid, jsonb) from public, anon;
grant execute on function atlas.fn_override_enrollee_z_codes(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
