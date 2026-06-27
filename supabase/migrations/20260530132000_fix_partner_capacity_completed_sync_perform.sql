-- Fix: partner service-capacity save failed on COMPLETED, non domain-spectrum
-- submissions ("Unable to save service capacity survey").
--
-- Root cause: the derived burden/capability sync block in
-- atlas.fn_save_partner_service_capacity ended its data-modifying CTE chain with
-- a bare `select 1;`. A standalone SELECT with no destination is illegal inside a
-- PL/pgSQL function and raises:
--   42601: query has no destination for result data
--   HINT: If you want to discard the results of a SELECT, use PERFORM instead.
-- The block only runs for completed, non domain-spectrum surveys with a partner,
-- so draft autosaves and the domain-spectrum survey were unaffected -- which is
-- why this surfaced specifically when a (new) partner user COMPLETED the service
-- capacity survey.
--
-- Fix: keep the data-modifying CTEs at the top level (required for INSERT ...
-- RETURNING inside WITH) but give the statement a destination by selecting the
-- synced capability count into a throwaway variable. Data-modifying CTEs always
-- execute to completion regardless of what the primary query references, so both
-- the burden and capability upserts still run.
--
-- Function body is otherwise byte-for-byte identical to migration
-- 20260530126000; only the trailing discard statement and the v_sync_count
-- declaration changed.

create or replace function atlas.fn_save_partner_service_capacity(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_domain_form constant text := '2026-z-domain-spectrum-v1';
  v_draft_key text := coalesce(nullif(payload ->> 'draftKey', ''), 'partner-survey-' || gen_random_uuid()::text);
  v_status text := coalesce(nullif(payload ->> 'status', ''), 'draft');
  v_org text := nullif(btrim(payload #>> '{header,organizationName}'), '');
  v_norm text := case
    when v_org is not null
      then trim(both '-' from regexp_replace(lower(v_org), '[^a-z0-9]+', '-', 'g'))
    else null
  end;
  v_first text := nullif(btrim(payload #>> '{header,firstName}'), '');
  v_last text := nullif(btrim(payload #>> '{header,lastName}'), '');
  v_email text := nullif(btrim(payload #>> '{header,email}'), '');
  v_form text := coalesce(nullif(payload ->> 'formVersion', ''), 'unknown');
  v_completed_at timestamptz := case
    when v_status = 'completed'
      then coalesce(nullif(payload ->> 'completedAtIso', '')::timestamptz, now())
    else null
  end;
  v_partner_id uuid;
  v_submission_id uuid;
  -- Throwaway destination so the derived-sync CTE chain is a valid PL/pgSQL
  -- statement (a bare SELECT with no destination is not allowed here).
  v_sync_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication is required to submit a partner survey' using errcode = '42501';
  end if;

  -- Ensure the partner record (dedup on normalized organization name).
  if v_norm is not null and v_norm <> '' then
    select id into v_partner_id from atlas.partners where organization_name_normalized = v_norm limit 1;
    if v_partner_id is null then
      insert into atlas.partners (
        organization_name, organization_name_normalized,
        primary_contact_first_name, primary_contact_last_name, primary_contact_email, updated_at
      ) values (v_org, v_norm, v_first, v_last, v_email, now())
      returning id into v_partner_id;
    else
      update atlas.partners set
        primary_contact_first_name = coalesce(v_first, primary_contact_first_name),
        primary_contact_last_name = coalesce(v_last, primary_contact_last_name),
        primary_contact_email = coalesce(v_email, primary_contact_email),
        updated_at = now()
      where id = v_partner_id;
    end if;
  end if;

  insert into atlas.partner_service_capacity_submissions as s (
    draft_key, status, completed_at, partner_id, organization_name, organization_name_normalized,
    respondent_first_name, respondent_last_name, respondent_email, job_title, respondent_roles,
    other_role_text, form_version, raw_payload
  ) values (
    v_draft_key, v_status, v_completed_at, v_partner_id, v_org, v_norm,
    v_first, v_last, v_email, nullif(btrim(payload #>> '{header,jobTitle}'), ''),
    coalesce((
      select array_agg(value)
      from jsonb_array_elements_text(coalesce(payload #> '{header,respondentRoles}', '[]'::jsonb)) as t(value)
    ), '{}'),
    nullif(btrim(payload #>> '{header,otherRoleText}'), ''),
    v_form, payload
  )
  on conflict (draft_key) do update set
    status = excluded.status,
    completed_at = excluded.completed_at,
    partner_id = excluded.partner_id,
    organization_name = excluded.organization_name,
    organization_name_normalized = excluded.organization_name_normalized,
    respondent_first_name = excluded.respondent_first_name,
    respondent_last_name = excluded.respondent_last_name,
    respondent_email = excluded.respondent_email,
    job_title = excluded.job_title,
    respondent_roles = excluded.respondent_roles,
    other_role_text = excluded.other_role_text,
    form_version = excluded.form_version,
    raw_payload = excluded.raw_payload,
    updated_at = now()
  returning s.id into v_submission_id;

  delete from atlas.partner_service_capacity_answers where submission_id = v_submission_id;

  insert into atlas.partner_service_capacity_answers (
    submission_id, prompt_id, parent_code, z_code, normalized_z_code, title, description,
    burden_score, not_encountered
  )
  select
    v_submission_id, a ->> 'promptId', a ->> 'parentCode', a ->> 'zCode', a ->> 'normalizedZCode',
    a ->> 'title', nullif(a ->> 'description', ''),
    case when coalesce((a ->> 'notEncountered')::boolean, false) then null else nullif(a ->> 'score', '')::integer end,
    coalesce((a ->> 'notEncountered')::boolean, false)
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb)) as a;

  -- Derived burden/capability sync mirrors syncPartnerServiceCapacityDerivedTables:
  -- only completed, non domain-spectrum submissions with a partner, aggregating to
  -- the highest score per normalized z-code.
  if v_status = 'completed' and v_partner_id is not null and v_form <> v_domain_form then
    with agg as (
      select a ->> 'normalizedZCode' as nz, max(nullif(a ->> 'score', '')::numeric) as score
      from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb)) as a
      where coalesce((a ->> 'notEncountered')::boolean, false) = false
        and nullif(a ->> 'score', '') is not null
      group by a ->> 'normalizedZCode'
    ),
    resolved as (
      select agg.nz, agg.score, z.id as z_code_id
      from agg
      join atlas.z_codes z on z.z_code = agg.nz
    ),
    burden as (
      insert into atlas.partner_z_code_burden_scores (
        partner_id, submission_id, z_code_id, z_code, burden_score, derived_relation_type, strength, updated_at
      )
      select
        v_partner_id, v_submission_id, r.z_code_id, r.nz, r.score::int,
        case when r.score >= 7 then 'specialize' when r.score <= 3 then 'interfere' else null end,
        case when r.score >= 7 then (r.score - 6) / 3.0 when r.score <= 3 then (4 - r.score) / 3.0 else 0 end,
        now()
      from resolved r
      on conflict (partner_id, z_code_id) do update set
        submission_id = excluded.submission_id,
        z_code = excluded.z_code,
        burden_score = excluded.burden_score,
        derived_relation_type = excluded.derived_relation_type,
        strength = excluded.strength,
        updated_at = now()
      returning 1
    ),
    caps as (
      insert into atlas.partner_z_code_capabilities (
        partner_id, z_code_id, relation_type, strength, source, source_submitted_at, is_active
      )
      select v_partner_id, r.z_code_id, 'specialize',
        case when r.score >= 7 then (r.score - 6) / 3.0 else 0 end,
        'service_capacity_survey', now(), (r.score >= 7)
      from resolved r
      union all
      select v_partner_id, r.z_code_id, 'interfere',
        case when r.score <= 3 then (4 - r.score) / 3.0 else 0 end,
        'service_capacity_survey', now(), (r.score <= 3)
      from resolved r
      on conflict (partner_id, z_code_id, relation_type, source) do update set
        strength = excluded.strength,
        source_submitted_at = excluded.source_submitted_at,
        is_active = excluded.is_active
      returning 1
    )
    -- Assigning into v_sync_count gives the statement a destination; both the
    -- burden and caps data-modifying CTEs still execute to completion.
    select count(*) into v_sync_count from (
      select 1 from burden
      union all
      select 1 from caps
    ) as synced;
  end if;

  -- Return the identifiers the client needs to rebuild the record shape without a
  -- scoped read-back (survey-only users cannot select these rows under RLS).
  return jsonb_build_object(
    'submissionId', v_submission_id,
    'partnerId', v_partner_id,
    'draftKey', v_draft_key,
    'status', v_status,
    'organizationNameNormalized', v_norm,
    'completedAtIso', v_completed_at,
    'submittedAtIso', now(),
    'updatedAtIso', now()
  );
end;
$$;

revoke execute on function atlas.fn_save_partner_service_capacity(jsonb) from public;
grant execute on function atlas.fn_save_partner_service_capacity(jsonb) to authenticated;

notify pgrst, 'reload schema';
