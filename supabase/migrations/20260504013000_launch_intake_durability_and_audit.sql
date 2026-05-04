-- Launch intake durability and audit expansion:
-- - persist public referral and inquiry submissions in atlas schema
-- - add demo access event logging table for temporary passcode workflow
-- - extend audit trigger coverage to assignment and identity edge tables

create table if not exists atlas.public_referral_intake_events (
  id uuid primary key default gen_random_uuid(),
  external_record_id text not null unique,
  event_type text not null check (event_type in ('referral', 'partner_inquiry')),
  source text not null default 'public_landing',
  payload jsonb not null default '{}'::jsonb,
  submitted_by_person_id uuid references atlas.people(id) on delete set null,
  submitted_by_email text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_public_referral_intake_events_submitted_at
  on atlas.public_referral_intake_events (submitted_at desc);

create index if not exists idx_public_referral_intake_events_event_type
  on atlas.public_referral_intake_events (event_type, submitted_at desc);

create table if not exists atlas.demo_access_events (
  id uuid primary key default gen_random_uuid(),
  access_mode text not null check (access_mode in ('passcode', 'administrator_bypass')),
  session_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table atlas.public_referral_intake_events enable row level security;
alter table atlas.demo_access_events enable row level security;

drop policy if exists public_referral_intake_events_insert_public on atlas.public_referral_intake_events;
drop policy if exists public_referral_intake_events_select_staff on atlas.public_referral_intake_events;
drop policy if exists demo_access_events_insert_authenticated on atlas.demo_access_events;
drop policy if exists demo_access_events_select_admin on atlas.demo_access_events;

create policy public_referral_intake_events_insert_public
on atlas.public_referral_intake_events
for insert
to anon, authenticated
with check (
  event_type in ('referral', 'partner_inquiry')
  and source = 'public_landing'
);

create policy public_referral_intake_events_select_staff
on atlas.public_referral_intake_events
for select
to authenticated
using (
  coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') in ('administrator', 'navigator', 'supervisor')
);

create policy demo_access_events_insert_authenticated
on atlas.demo_access_events
for insert
to authenticated
with check (
  access_mode in ('passcode', 'administrator_bypass')
);

create policy demo_access_events_select_admin
on atlas.demo_access_events
for select
to authenticated
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

grant insert on atlas.public_referral_intake_events to anon, authenticated;
grant select on atlas.public_referral_intake_events to authenticated;
grant insert on atlas.demo_access_events to authenticated;
grant select on atlas.demo_access_events to authenticated;

create or replace function atlas.fn_log_audit_with_actor()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  actor_person_id uuid;
begin
  actor_person_id := atlas.fn_current_person_id();
  insert into atlas.audit_events (actor_person_id, event_type, entity_name, entity_id, payload)
  values (
    actor_person_id,
    tg_op,
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    to_jsonb(coalesce(new, old))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_navigator_assignments on atlas.navigator_assignments;
create trigger trg_audit_navigator_assignments
after insert or update or delete on atlas.navigator_assignments
for each row execute function atlas.fn_log_audit_with_actor();

drop trigger if exists trg_audit_supervisor_navigator_assignments on atlas.supervisor_navigator_assignments;
create trigger trg_audit_supervisor_navigator_assignments
after insert or update or delete on atlas.supervisor_navigator_assignments
for each row execute function atlas.fn_log_audit_with_actor();

drop trigger if exists trg_audit_partner_contact_assignments on atlas.partner_contact_assignments;
create trigger trg_audit_partner_contact_assignments
after insert or update or delete on atlas.partner_contact_assignments
for each row execute function atlas.fn_log_audit_with_actor();

drop trigger if exists trg_audit_people_role_assignments on atlas.people_role_assignments;
create trigger trg_audit_people_role_assignments
after insert or update or delete on atlas.people_role_assignments
for each row execute function atlas.fn_log_audit_with_actor();

notify pgrst, 'reload schema';
