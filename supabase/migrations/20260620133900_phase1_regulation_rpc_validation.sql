-- Phase 1 continuity hardening:
-- strengthen fn_save_regulation_test_submission payload validation so score/pass
-- fields cannot drift from each other.

create or replace function atlas.fn_save_regulation_test_submission(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  v_draft_key text := coalesce(nullif(payload ->> 'draftKey', ''), 'reg-test-' || gen_random_uuid()::text);
  v_enrollee_id text := nullif(payload ->> 'enrolleeId', '');
  v_enrollment_id uuid := nullif(payload ->> 'enrollmentId', '')::uuid;
  v_test_type text := nullif(payload ->> 'testType', '');
  v_status text := coalesce(nullif(payload ->> 'status', ''), 'draft');
  v_total_score numeric := nullif(payload ->> 'totalScore', '')::numeric;
  v_pass_threshold numeric := coalesce(nullif(payload ->> 'passThreshold', '')::numeric, 0);
  v_passed boolean := case when payload ->> 'passed' is null then null else (payload ->> 'passed')::boolean end;
  v_id uuid;
begin
  if v_enrollee_id is null or v_test_type is null then
    raise exception 'enrolleeId and testType are required' using errcode = '22023';
  end if;

  if v_pass_threshold < 0 then
    raise exception 'passThreshold must be non-negative' using errcode = '22023';
  end if;
  if v_total_score is not null and v_total_score < 0 then
    raise exception 'totalScore must be non-negative' using errcode = '22023';
  end if;
  if v_passed is not null and v_total_score is null then
    raise exception 'passed cannot be provided when totalScore is null' using errcode = '22023';
  end if;
  if v_passed is not null and v_total_score is not null and v_passed <> (v_total_score >= v_pass_threshold) then
    raise exception 'passed does not match totalScore/passThreshold relationship' using errcode = '22023';
  end if;
  if v_status = 'completed' and (v_total_score is null or v_passed is null) then
    raise exception 'completed submissions require totalScore and passed' using errcode = '22023';
  end if;

  if not (
    v_is_admin
    or (v_enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(v_enrollment_id))
    or exists (
      select 1 from atlas.enrollments en
      where en.enrollee_id::text = v_enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  ) then
    raise exception 'not authorized to save regulation test for enrollee %', v_enrollee_id
      using errcode = '42501';
  end if;

  insert into atlas.navigator_regulation_test_submissions as s (
    draft_key, enrollee_id, enrollment_id, test_type, status, enrollee_name,
    enrollee_case_id, enrollee_email, total_score, pass_threshold, passed,
    submitted_at, updated_at
  ) values (
    v_draft_key, v_enrollee_id, v_enrollment_id, v_test_type, v_status,
    coalesce(payload ->> 'enrolleeName', ''), coalesce(payload ->> 'enrolleeCaseId', ''),
    coalesce(payload ->> 'enrolleeEmail', ''),
    v_total_score,
    v_pass_threshold,
    v_passed,
    now(), now()
  )
  on conflict (enrollee_id, test_type, draft_key) do update set
    enrollment_id = excluded.enrollment_id,
    status = excluded.status,
    enrollee_name = excluded.enrollee_name,
    enrollee_case_id = excluded.enrollee_case_id,
    enrollee_email = excluded.enrollee_email,
    total_score = excluded.total_score,
    pass_threshold = excluded.pass_threshold,
    passed = excluded.passed,
    updated_at = now()
  returning s.id into v_id;

  delete from atlas.navigator_regulation_test_answers where submission_id = v_id;

  insert into atlas.navigator_regulation_test_answers (
    submission_id, prompt_id, prompt_label, response_value
  )
  select
    v_id,
    a ->> 'promptId',
    coalesce(a ->> 'promptLabel', ''),
    nullif(a ->> 'responseValue', '')::numeric
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb)) as a;

  return v_id;
end;
$$;

notify pgrst, 'reload schema';
