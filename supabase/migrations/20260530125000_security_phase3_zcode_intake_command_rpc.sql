-- Security hardening Phase 3: enrollee z-code intake.
--
-- Phase 1 added a temporary scoped INSERT policy on atlas.enrollee_z_codes so
-- the client's inference-intake path kept working. We now replace that direct
-- insert with a validated SECURITY DEFINER command RPC and remove the INSERT
-- policy + grant, leaving the table with scoped SELECT only (Phase 1 policy).
-- Resolution updates continue to flow through the existing
-- fn_set_enrollee_z_code_resolution* RPCs.

create or replace function atlas.fn_intake_enrollment_inferred_z_codes(
  p_enrollment_id uuid,
  p_z_codes text[],
  p_source text default 'demo_ollama_inference'
)
returns text[]
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  v_applied text[];
begin
  if p_enrollment_id is null then
    raise exception 'enrollment_id is required' using errcode = '22023';
  end if;

  if not (v_is_admin or atlas.fn_can_access_enrollment_as_staff(p_enrollment_id)) then
    raise exception 'not authorized to intake z-codes for enrollment %', p_enrollment_id
      using errcode = '42501';
  end if;

  with norm as (
    select distinct upper(btrim(c)) as code
    from unnest(coalesce(p_z_codes, '{}')) as c
    where upper(btrim(c)) ~ '^Z\d{2}(\.\d+)?$'
  ),
  active as (
    select z.id, z.z_code
    from atlas.z_codes z
    join norm n on n.code = z.z_code
  ),
  ins as (
    -- Data-modifying CTE: always executed once. Only inserts codes not already
    -- active on the enrollment (matches prior client de-duplication).
    insert into atlas.enrollee_z_codes (enrollment_id, z_code_id, is_resolved, resolution_at, source, ended_at)
    select p_enrollment_id, a.id, false, null, coalesce(nullif(p_source, ''), 'demo_ollama_inference'), null
    from active a
    where not exists (
      select 1 from atlas.enrollee_z_codes ez
      where ez.enrollment_id = p_enrollment_id
        and ez.z_code_id = a.id
        and ez.ended_at is null
    )
    returning 1
  )
  select coalesce(array_agg(a.z_code), '{}') into v_applied from active a;

  return v_applied;
end;
$$;

-- Remove the temporary direct-insert path from Phase 1; RPC-only writes now.
drop policy if exists enrollee_z_codes_staff_insert on atlas.enrollee_z_codes;
revoke insert on atlas.enrollee_z_codes from authenticated;

revoke execute on function atlas.fn_intake_enrollment_inferred_z_codes(uuid, text[], text) from public;
grant execute on function atlas.fn_intake_enrollment_inferred_z_codes(uuid, text[], text) to authenticated;
