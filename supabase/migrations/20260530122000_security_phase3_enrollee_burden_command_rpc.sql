-- Security hardening Phase 3 (reference flow): move enrollee burden survey
-- writes behind a validated SECURITY DEFINER command Remote Procedure Call
-- (RPC). The frontend transmits the whole submission as a JSON packet; the
-- function validates caller scope, then atomically upserts the submission and
-- fully replaces its answers in a single transaction.
--
-- This lets us revoke direct INSERT/UPDATE/DELETE on the underlying tables
-- (done in the lock step) so the only write path is this audited entry point,
-- while reads continue through the existing scoped Row-Level Security (RLS)
-- policies.

create or replace function atlas.fn_save_enrollee_burden_submission(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  v_person uuid := atlas.fn_current_person_id();
  v_draft_key text := coalesce(nullif(payload ->> 'draftKey', ''), gen_random_uuid()::text);
  v_status text := coalesce(nullif(payload ->> 'status', ''), 'draft');
  v_enrollment_id uuid := nullif(payload #>> '{header,enrollmentId}', '')::uuid;
  v_enrollee_id uuid := nullif(payload #>> '{header,enrolleeId}', '')::uuid;
  v_respondent_person_id uuid := nullif(payload #>> '{header,respondentPersonId}', '')::uuid;
  v_completed_at timestamptz := case
    when v_status = 'completed'
      then coalesce(nullif(payload ->> 'completedAtIso', '')::timestamptz, now())
    else null
  end;
  v_submission_id uuid;
begin
  if v_enrollment_id is null or v_enrollee_id is null then
    raise exception 'enrollment_id and enrollee_id are required' using errcode = '22023';
  end if;

  -- Fail loudly on out-of-scope writes: only an administrator, or a staff
  -- member assigned to the enrollment recording as themselves, may submit.
  if not (
    v_is_admin
    or (
      atlas.fn_can_access_enrollment_as_staff(v_enrollment_id)
      and (v_respondent_person_id is null or v_respondent_person_id = v_person)
    )
  ) then
    raise exception 'not authorized to submit burden survey for enrollment %', v_enrollment_id
      using errcode = '42501';
  end if;

  insert into atlas.enrollee_burden_survey_submissions as s (
    draft_key, status, completed_at, enrollee_id, enrollment_id, enrollee_name,
    enrollee_case_id, respondent_person_id, respondent_name, respondent_role,
    organization_name, form_version, raw_payload
  ) values (
    v_draft_key, v_status, v_completed_at, v_enrollee_id, v_enrollment_id,
    payload #>> '{header,enrolleeName}', nullif(payload #>> '{header,enrolleeCaseId}', ''),
    coalesce(v_respondent_person_id, v_person), payload #>> '{header,respondentName}',
    payload #>> '{header,respondentRole}', nullif(payload #>> '{header,organizationName}', ''),
    coalesce(nullif(payload ->> 'formVersion', ''), 'v1'), payload
  )
  on conflict (draft_key) do update set
    status = excluded.status,
    completed_at = excluded.completed_at,
    enrollee_id = excluded.enrollee_id,
    enrollment_id = excluded.enrollment_id,
    enrollee_name = excluded.enrollee_name,
    enrollee_case_id = excluded.enrollee_case_id,
    respondent_person_id = excluded.respondent_person_id,
    respondent_name = excluded.respondent_name,
    respondent_role = excluded.respondent_role,
    organization_name = excluded.organization_name,
    form_version = excluded.form_version,
    raw_payload = excluded.raw_payload,
    updated_at = now()
  returning s.id into v_submission_id;

  -- Answers are fully replaced on each save (matches the prior client behavior).
  delete from atlas.enrollee_burden_survey_answers where submission_id = v_submission_id;

  insert into atlas.enrollee_burden_survey_answers (
    submission_id, prompt_id, parent_code, z_code, normalized_z_code, title,
    description, burden_score, not_encountered
  )
  select
    v_submission_id,
    a ->> 'promptId',
    a ->> 'parentCode',
    a ->> 'zCode',
    a ->> 'normalizedZCode',
    a ->> 'title',
    nullif(a ->> 'description', ''),
    case
      when coalesce((a ->> 'notEncountered')::boolean, false) then null
      else nullif(a ->> 'score', '')::smallint
    end,
    coalesce((a ->> 'notEncountered')::boolean, false)
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb)) as a;

  return v_submission_id;
end;
$$;

-- Deletes a draft (and cascades answers). Only the owning respondent or an
-- administrator may delete, and only while still in 'draft' status.
create or replace function atlas.fn_delete_enrollee_burden_draft(target_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  v_person uuid := atlas.fn_current_person_id();
  v_row atlas.enrollee_burden_survey_submissions%rowtype;
begin
  select * into v_row
  from atlas.enrollee_burden_survey_submissions
  where id = target_submission_id;

  if not found or v_row.status <> 'draft' then
    return null;
  end if;

  if not (v_is_admin or v_row.respondent_person_id = v_person) then
    raise exception 'not authorized to delete burden draft %', target_submission_id
      using errcode = '42501';
  end if;

  delete from atlas.enrollee_burden_survey_submissions where id = target_submission_id;
  return target_submission_id;
end;
$$;

grant execute on function atlas.fn_save_enrollee_burden_submission(jsonb) to authenticated;
grant execute on function atlas.fn_delete_enrollee_burden_draft(uuid) to authenticated;
