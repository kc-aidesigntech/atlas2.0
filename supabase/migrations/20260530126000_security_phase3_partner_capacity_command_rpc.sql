-- Security hardening Phase 3: partner service-capacity survey + partner records.
--
-- The partner z-code survey is performed by authenticated (not-yet-workspace)
-- users. Previously the browser wrote partners, submissions, answers, and the
-- derived burden/capability tables directly (anon-capable before Phase 2). We
-- consolidate the entire flow into validated SECURITY DEFINER command RPCs:
--   * fn_save_partner_service_capacity        - upsert partner + submission +
--     answers, and (for completed, non domain-spectrum forms) sync the derived
--     burden/capability tables atomically.
--   * fn_ensure_partner_identifier            - partner identity upsert.
--   * fn_delete_partner_service_capacity_draft - delete a draft.
--   * fn_set_partner_survey_answer_nullification - administrator answer review.
--
-- Direct writes to all five tables are then revoked (RPC-only writes). Existing
-- scoped SELECT policies on submissions/answers/burden are preserved; partners
-- and partner_z_code_capabilities (which had NO Row-Level Security) get RLS with
-- broad authenticated read (non-PHI operational/directory + route-ranking data).
--
-- The organization-name normalization MUST stay byte-for-byte identical to the
-- client (normalizeOrganizationName): trim -> lowercase -> non-alphanumeric runs
-- to '-' -> strip leading/trailing '-'. Partner identity joins depend on it.

-- Drop first: an earlier revision returned uuid, and CREATE OR REPLACE cannot
-- change a function's return type. The signature (jsonb) is unchanged, so the
-- drop targets that single overload; grants are reissued at the end.
drop function if exists atlas.fn_save_partner_service_capacity(jsonb);

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
    select 1;
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

create or replace function atlas.fn_ensure_partner_identifier(
  p_first_name text, p_last_name text, p_organization_name text, p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_first text := nullif(btrim(p_first_name), '');
  v_last text := nullif(btrim(p_last_name), '');
  v_org text := nullif(btrim(p_organization_name), '');
  v_email text := nullif(btrim(p_email), '');
  v_norm text;
  v_row atlas.partners%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_first is null or v_last is null or v_org is null then
    raise exception 'first name, last name, and organization name are required' using errcode = '22023';
  end if;

  v_norm := trim(both '-' from regexp_replace(lower(v_org), '[^a-z0-9]+', '-', 'g'));

  select * into v_row from atlas.partners where organization_name_normalized = v_norm limit 1;
  if found then
    update atlas.partners set
      primary_contact_first_name = v_first,
      primary_contact_last_name = v_last,
      primary_contact_email = v_email,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  else
    insert into atlas.partners (
      organization_name, organization_name_normalized,
      primary_contact_first_name, primary_contact_last_name, primary_contact_email, updated_at
    ) values (v_org, v_norm, v_first, v_last, v_email, now())
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'partnerId', v_row.id,
    'firstName', coalesce(v_row.primary_contact_first_name, ''),
    'lastName', coalesce(v_row.primary_contact_last_name, ''),
    'organizationName', v_row.organization_name,
    'email', coalesce(v_row.primary_contact_email, '')
  );
end;
$$;

create or replace function atlas.fn_delete_partner_service_capacity_draft(target_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_row atlas.partner_service_capacity_submissions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_row from atlas.partner_service_capacity_submissions where id = target_submission_id;
  if not found then
    raise exception 'draft record not found' using errcode = 'P0002';
  end if;
  if v_row.status <> 'draft' then
    raise exception 'only draft service-capacity records can be deleted' using errcode = '22023';
  end if;

  delete from atlas.partner_service_capacity_submissions where id = target_submission_id;
  return jsonb_build_object('id', v_row.id, 'draftKey', coalesce(v_row.draft_key, v_row.id::text));
end;
$$;

create or replace function atlas.fn_set_partner_survey_answer_nullification(
  p_answer_id uuid, p_is_nullified boolean, p_nullified_by_email text default null, p_nullified_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_row atlas.partner_service_capacity_answers%rowtype;
begin
  -- Answer nullification is an administrative review action.
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') <> 'administrator' then
    raise exception 'only administrators may nullify survey answers' using errcode = '42501';
  end if;

  update atlas.partner_service_capacity_answers set
    is_nullified = p_is_nullified,
    nullified_at = case when p_is_nullified then now() else null end,
    nullified_by_email = case when p_is_nullified then nullif(btrim(p_nullified_by_email), '') else null end,
    nullified_reason = case when p_is_nullified then nullif(btrim(p_nullified_reason), '') else null end
  where id = p_answer_id
  returning * into v_row;

  if not found then
    raise exception 'answer not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'isNullified', v_row.is_nullified,
    'nullifiedAt', v_row.nullified_at,
    'nullifiedByEmail', v_row.nullified_by_email,
    'nullifiedReason', v_row.nullified_reason
  );
end;
$$;

-- Enable RLS with broad authenticated read on the two previously unprotected
-- operational tables; writes flow exclusively through the RPCs above.
alter table atlas.partners enable row level security;
drop policy if exists partners_authenticated_select on atlas.partners;
create policy partners_authenticated_select on atlas.partners
  for select to authenticated using (true);

alter table atlas.partner_z_code_capabilities enable row level security;
drop policy if exists partner_z_code_capabilities_authenticated_select on atlas.partner_z_code_capabilities;
create policy partner_z_code_capabilities_authenticated_select on atlas.partner_z_code_capabilities
  for select to authenticated using (true);

-- RPC-only writes across the partner survey surface.
revoke insert, update, delete on atlas.partners from authenticated;
revoke insert, update, delete on atlas.partner_service_capacity_submissions from authenticated;
revoke insert, update, delete on atlas.partner_service_capacity_answers from authenticated;
revoke insert, update, delete on atlas.partner_z_code_burden_scores from authenticated;
revoke insert, update, delete on atlas.partner_z_code_capabilities from authenticated;

revoke execute on function atlas.fn_save_partner_service_capacity(jsonb) from public;
revoke execute on function atlas.fn_ensure_partner_identifier(text, text, text, text) from public;
revoke execute on function atlas.fn_delete_partner_service_capacity_draft(uuid) from public;
revoke execute on function atlas.fn_set_partner_survey_answer_nullification(uuid, boolean, text, text) from public;
grant execute on function atlas.fn_save_partner_service_capacity(jsonb) to authenticated;
grant execute on function atlas.fn_ensure_partner_identifier(text, text, text, text) to authenticated;
grant execute on function atlas.fn_delete_partner_service_capacity_draft(uuid) to authenticated;
grant execute on function atlas.fn_set_partner_survey_answer_nullification(uuid, boolean, text, text) to authenticated;
