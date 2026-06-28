-- Administrative deletion workflow for partner service-capacity submissions:
-- capture an immutable snapshot + rationale before removing any submission row.
create table if not exists atlas.partner_service_capacity_deletion_log (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  submission_id uuid not null,
  form_version text not null,
  status text not null,
  organization_name text,
  record_deleted text not null,
  reason_code text not null check (reason_code in ('obsolete', 'not_relevant', 'mistakenly_entered', 'contained_errors', 'other')),
  reason_other_text text,
  deleted_by_user_id uuid,
  deleted_by_email text,
  deleted_record jsonb not null default '{}'::jsonb,
  check (reason_code <> 'other' or reason_other_text is not null)
);

create index if not exists idx_partner_service_capacity_deletion_log_deleted_at
  on atlas.partner_service_capacity_deletion_log(deleted_at desc);

create index if not exists idx_partner_service_capacity_deletion_log_submission
  on atlas.partner_service_capacity_deletion_log(submission_id);

alter table atlas.partner_service_capacity_deletion_log enable row level security;

drop policy if exists partner_service_capacity_deletion_log_admin_select on atlas.partner_service_capacity_deletion_log;
create policy partner_service_capacity_deletion_log_admin_select
on atlas.partner_service_capacity_deletion_log
for select
to authenticated
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

create or replace function atlas.fn_admin_delete_partner_service_capacity_submission(
  p_submission_id uuid,
  p_reason_code text,
  p_reason_other_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'atlas', 'public'
as $$
declare
  v_submission atlas.partner_service_capacity_submissions%rowtype;
  v_answers_snapshot jsonb := '[]'::jsonb;
  v_reason_code text := lower(btrim(coalesce(p_reason_code, '')));
  v_reason_other_text text := nullif(btrim(coalesce(p_reason_other_text, '')), '');
  v_deleted_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') <> 'administrator' then
    raise exception 'only administrators may delete partner service-capacity submissions' using errcode = '42501';
  end if;

  if v_reason_code not in ('obsolete', 'not_relevant', 'mistakenly_entered', 'contained_errors', 'other') then
    raise exception 'invalid deletion reason code' using errcode = '22023';
  end if;
  if v_reason_code = 'other' and v_reason_other_text is null then
    raise exception 'other deletion reason requires detail text' using errcode = '22023';
  end if;

  select *
  into v_submission
  from atlas.partner_service_capacity_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'service-capacity submission not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(to_jsonb(answer_row) order by answer_row.created_at), '[]'::jsonb)
  into v_answers_snapshot
  from atlas.partner_service_capacity_answers answer_row
  where answer_row.submission_id = v_submission.id;

  insert into atlas.partner_service_capacity_deletion_log (
    deleted_at,
    submission_id,
    form_version,
    status,
    organization_name,
    record_deleted,
    reason_code,
    reason_other_text,
    deleted_by_user_id,
    deleted_by_email,
    deleted_record
  ) values (
    v_deleted_at,
    v_submission.id,
    v_submission.form_version,
    v_submission.status,
    v_submission.organization_name,
    'partner_service_capacity_submissions:' || v_submission.id::text,
    v_reason_code,
    v_reason_other_text,
    auth.uid(),
    nullif(lower(btrim(coalesce(auth.jwt() ->> 'email', ''))), ''),
    jsonb_build_object(
      'submission', to_jsonb(v_submission),
      'answers', v_answers_snapshot
    )
  );

  delete from atlas.partner_service_capacity_submissions where id = v_submission.id;

  return jsonb_build_object(
    'id', v_submission.id,
    'deletedAt', v_deleted_at,
    'recordDeleted', 'partner_service_capacity_submissions:' || v_submission.id::text,
    'reasonCode', v_reason_code,
    'reasonOtherText', v_reason_other_text
  );
end;
$$;

revoke all on atlas.partner_service_capacity_deletion_log from authenticated;
grant select on atlas.partner_service_capacity_deletion_log to authenticated;

revoke execute on function atlas.fn_admin_delete_partner_service_capacity_submission(uuid, text, text) from public;
grant execute on function atlas.fn_admin_delete_partner_service_capacity_submission(uuid, text, text) to authenticated;
