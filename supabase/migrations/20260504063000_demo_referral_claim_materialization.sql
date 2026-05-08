create table if not exists atlas.demo_record_tags (
  id uuid primary key default gen_random_uuid(),
  tag text not null,
  record_type text not null,
  record_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tag, record_type, record_id)
);

create index if not exists idx_demo_record_tags_record on atlas.demo_record_tags(record_type, record_id);

create or replace function atlas.fn_claim_referral_queue_to_enrollment(
  queue_record_id text,
  full_name text,
  email text default null,
  phone text default null,
  case_id text default null,
  referrer_name text default null,
  referrer_organization text default null,
  background_notes text default null,
  metadata jsonb default '{}'::jsonb
)
returns table(
  enrollment_id uuid,
  enrollee_id uuid,
  enrollee_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_tag constant text := 'atlas_demo';
  v_now timestamptz := now();
  v_full_name text := coalesce(nullif(trim(full_name), ''), 'atlas demo enrollee');
  v_first_name text;
  v_last_name text;
  v_external_ref text := format('demo-referral:%s', coalesce(nullif(trim(queue_record_id), ''), md5(v_full_name || v_now::text)));
  v_person_id uuid;
  v_enrollee_id uuid;
  v_enrollment_id uuid;
  v_navigator_person_id uuid;
  v_case_id text := nullif(trim(case_id), '');
  v_metadata jsonb := coalesce(metadata, '{}'::jsonb);
begin
  v_first_name := split_part(v_full_name, ' ', 1);
  v_last_name := nullif(trim(substring(v_full_name from length(v_first_name) + 1)), '');
  if v_last_name is null then
    v_last_name := 'demo';
  end if;

  if v_case_id is null then
    v_case_id := format('DEMO-%s', upper(substr(md5(v_external_ref), 1, 8)));
  end if;

  begin
    select nullif(trim((atlas.fn_current_person_id())::text), '')::uuid into v_navigator_person_id;
  exception
    when others then
      v_navigator_person_id := null;
  end;

  if v_navigator_person_id is null then
    select pra.person_id
      into v_navigator_person_id
      from atlas.people_role_assignments pra
      join atlas.roles r on r.id = pra.role_id
     where r.role_key = 'navigator'
       and pra.ends_on is null
     order by pra.starts_on desc, pra.created_at desc
     limit 1;
  end if;

  insert into atlas.people (
    external_ref,
    first_name,
    last_name,
    display_name,
    email,
    phone,
    person_type,
    status
  )
  values (
    v_external_ref,
    v_first_name,
    v_last_name,
    v_full_name,
    nullif(trim(email), ''),
    nullif(trim(phone), ''),
    'enrollee',
    'active'
  )
  on conflict (external_ref) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      display_name = excluded.display_name,
      email = coalesce(excluded.email, atlas.people.email),
      phone = coalesce(excluded.phone, atlas.people.phone),
      updated_at = now()
  returning id into v_person_id;

  insert into atlas.enrollees (
    person_id,
    case_id,
    current_phase
  )
  values (
    v_person_id,
    v_case_id,
    'regulation'
  )
  on conflict (person_id) do update
  set case_id = coalesce(excluded.case_id, atlas.enrollees.case_id),
      updated_at = now()
  returning id into v_enrollee_id;

  select en.id
    into v_enrollment_id
    from atlas.enrollments en
   where en.enrollee_id = v_enrollee_id
     and en.status = 'active'
   order by en.created_at desc
   limit 1;

  if v_enrollment_id is null then
    insert into atlas.enrollments (
      enrollee_id,
      start_date,
      target_duration_months,
      status
    )
    values (
      v_enrollee_id,
      current_date,
      9,
      'active'
    )
    returning id into v_enrollment_id;
  end if;

  if v_navigator_person_id is not null then
    update atlas.navigator_assignments
       set ends_on = current_date
     where enrollment_id = v_enrollment_id
       and ends_on is null
       and navigator_person_id <> v_navigator_person_id;

    insert into atlas.navigator_assignments (
      enrollment_id,
      navigator_person_id,
      starts_on
    )
    values (
      v_enrollment_id,
      v_navigator_person_id,
      current_date
    )
    on conflict do nothing;
  end if;

  insert into atlas.demo_record_tags (tag, record_type, record_id, metadata)
  values
    (
      v_tag,
      'people',
      v_person_id,
      v_metadata || jsonb_build_object(
        'queue_record_id', queue_record_id,
        'referrer_name', referrer_name,
        'referrer_organization', referrer_organization,
        'background_notes', background_notes
      )
    ),
    (
      v_tag,
      'enrollees',
      v_enrollee_id,
      v_metadata || jsonb_build_object('queue_record_id', queue_record_id)
    ),
    (
      v_tag,
      'enrollments',
      v_enrollment_id,
      v_metadata || jsonb_build_object('queue_record_id', queue_record_id)
    )
  on conflict (tag, record_type, record_id) do update
  set metadata = atlas.demo_record_tags.metadata || excluded.metadata;

  return query
  select
    v_enrollment_id,
    v_enrollee_id,
    v_full_name,
    v_now;
end;
$$;

grant select, insert on table atlas.demo_record_tags to authenticated;
grant execute on function atlas.fn_claim_referral_queue_to_enrollment(text, text, text, text, text, text, text, text, jsonb) to authenticated;
