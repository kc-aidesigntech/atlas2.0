-- Security hardening Phase 3: navigator regulation/renewal tests.
--
-- Previously these tables had NO Row-Level Security and full anon+authenticated
-- CRUD (anon was revoked in Phase 2). Here we:
--   1. Add a validated SECURITY DEFINER command RPC for writes (JSON packet).
--   2. Enable scoped-read RLS.
--   3. Revoke direct writes from authenticated (RPC-only writes).
--
-- Access scope (identical for read and write): administrator, OR a staff member
-- assigned to the linked enrollment, OR a staff member who can access any
-- enrollment for the row's enrollee (covers historical rows that recorded an
-- enrollee_id but no enrollment_id). Orphan renewal/self-study rows (no
-- resolvable enrollment) remain admin-only on the server; the client keeps its
-- local-storage fallback for those.

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
  v_id uuid;
begin
  if v_enrollee_id is null or v_test_type is null then
    raise exception 'enrolleeId and testType are required' using errcode = '22023';
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
    nullif(payload ->> 'totalScore', '')::numeric,
    coalesce(nullif(payload ->> 'passThreshold', '')::numeric, 0),
    case when payload ->> 'passed' is null then null else (payload ->> 'passed')::boolean end,
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

create or replace function atlas.fn_delete_regulation_test_draft(target_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator';
  v_row atlas.navigator_regulation_test_submissions%rowtype;
begin
  select * into v_row from atlas.navigator_regulation_test_submissions where id = target_submission_id;
  if not found or v_row.status <> 'draft' then
    return null;
  end if;

  if not (
    v_is_admin
    or (v_row.enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(v_row.enrollment_id))
    or exists (
      select 1 from atlas.enrollments en
      where en.enrollee_id::text = v_row.enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  ) then
    raise exception 'not authorized to delete regulation test %', target_submission_id
      using errcode = '42501';
  end if;

  delete from atlas.navigator_regulation_test_submissions where id = target_submission_id;
  return target_submission_id;
end;
$$;

-- Scoped-read RLS (mirrors the command-RPC access condition).
alter table atlas.navigator_regulation_test_submissions enable row level security;
drop policy if exists navigator_regulation_test_submissions_select_scoped on atlas.navigator_regulation_test_submissions;
create policy navigator_regulation_test_submissions_select_scoped on atlas.navigator_regulation_test_submissions
  for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or (enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(enrollment_id))
    or exists (
      select 1 from atlas.enrollments en
      where en.enrollee_id::text = navigator_regulation_test_submissions.enrollee_id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  );

alter table atlas.navigator_regulation_test_answers enable row level security;
drop policy if exists navigator_regulation_test_answers_select_scoped on atlas.navigator_regulation_test_answers;
create policy navigator_regulation_test_answers_select_scoped on atlas.navigator_regulation_test_answers
  for select to authenticated
  using (
    exists (
      select 1
      from atlas.navigator_regulation_test_submissions s
      where s.id = navigator_regulation_test_answers.submission_id
        and (
          coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
          or (s.enrollment_id is not null and atlas.fn_can_access_enrollment_as_staff(s.enrollment_id))
          or exists (
            select 1 from atlas.enrollments en
            where en.enrollee_id::text = s.enrollee_id
              and atlas.fn_can_access_enrollment_as_staff(en.id)
          )
        )
    )
  );

-- RPC-only writes.
revoke insert, update, delete on atlas.navigator_regulation_test_submissions from authenticated;
revoke insert, update, delete on atlas.navigator_regulation_test_answers from authenticated;
grant execute on function atlas.fn_save_regulation_test_submission(jsonb) to authenticated;
grant execute on function atlas.fn_delete_regulation_test_draft(uuid) to authenticated;
