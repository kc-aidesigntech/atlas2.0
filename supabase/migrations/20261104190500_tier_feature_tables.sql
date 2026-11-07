-- Tier feature tables.
--
-- Residency tiers (20261104190000_tier_roles.sql) carry permission keys
-- seeded in a sibling migration. This file adds the feature tables those keys
-- gate: sponsorships, Intentional Peer Support (IPS) Core cohorts and their
-- enrollments, competency cards, respite shifts, secondments with a weekly
-- schedule, leads, and a referrer column on public referral intake events.
--
-- Every table has Row-Level Security (RLS) enabled. Each policy set is: the
-- person named on the row reads it; holders of the feature's permission key
-- (atlas.fn_has_permission) read and write; atlas.fn_is_system_admin() does
-- everything. The caller's person id is atlas.fn_current_person_id(), which
-- matches atlas.people.external_ref to auth.uid() and falls back to the JSON
-- Web Token (JWT) email claim (20260503231500).
--
-- Remote Procedure Calls (RPCs) at the end: fn_enroll_in_cohort,
-- fn_create_sponsorship, fn_issue_competency_card, fn_upsert_lead, and
-- fn_wallet_overview, which returns one JavaScript Object Notation (JSON)
-- document for the caller's wallet.

-- ---------------------------------------------------------------------------
-- sponsorships: one active row per (sponsor, sponsored) pair.
-- ---------------------------------------------------------------------------

create table if not exists atlas.sponsorships (
  id uuid primary key default gen_random_uuid(),
  sponsor_person_id uuid not null references atlas.people(id) on delete cascade,
  sponsored_person_id uuid not null references atlas.people(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsorships_distinct_people_check check (sponsor_person_id <> sponsored_person_id)
);

comment on table atlas.sponsorships is
  'A tier holder with sponsorship.give sponsors a t1 / t2 person. One active row per pair.';

-- The partial unique index rejects a second active row for the same pair;
-- ended rows for that pair may accumulate.
create unique index if not exists uq_sponsorships_active_pair
  on atlas.sponsorships(sponsor_person_id, sponsored_person_id)
  where status = 'active';

create index if not exists idx_sponsorships_sponsored on atlas.sponsorships(sponsored_person_id, status);

drop trigger if exists trg_sponsorships_touch_updated_at on atlas.sponsorships;
create trigger trg_sponsorships_touch_updated_at
before update on atlas.sponsorships
for each row execute function atlas.fn_touch_updated_at();

alter table atlas.sponsorships enable row level security;

drop policy if exists sponsorships_self_select on atlas.sponsorships;
create policy sponsorships_self_select on atlas.sponsorships
  for select to authenticated
  using (
    sponsor_person_id = atlas.fn_current_person_id()
    or sponsored_person_id = atlas.fn_current_person_id()
  );

drop policy if exists sponsorships_permission_select on atlas.sponsorships;
create policy sponsorships_permission_select on atlas.sponsorships
  for select to authenticated
  using (atlas.fn_has_permission('sponsorship.give'));

-- A sponsorship.give holder writes rows where they are the sponsor.
drop policy if exists sponsorships_permission_insert on atlas.sponsorships;
create policy sponsorships_permission_insert on atlas.sponsorships
  for insert to authenticated
  with check (
    atlas.fn_has_permission('sponsorship.give')
    and sponsor_person_id = atlas.fn_current_person_id()
  );

drop policy if exists sponsorships_permission_update on atlas.sponsorships;
create policy sponsorships_permission_update on atlas.sponsorships
  for update to authenticated
  using (
    atlas.fn_has_permission('sponsorship.give')
    and sponsor_person_id = atlas.fn_current_person_id()
  )
  with check (
    atlas.fn_has_permission('sponsorship.give')
    and sponsor_person_id = atlas.fn_current_person_id()
  );

drop policy if exists sponsorships_admin_all on atlas.sponsorships;
create policy sponsorships_admin_all on atlas.sponsorships
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

revoke all on table atlas.sponsorships from public, anon, authenticated;
grant select, insert, update, delete on table atlas.sponsorships to authenticated;
grant select, insert, update, delete on table atlas.sponsorships to service_role;

-- ---------------------------------------------------------------------------
-- ips_cohorts and ips_cohort_enrollments.
-- ---------------------------------------------------------------------------

create table if not exists atlas.ips_cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date,
  ends_on date,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ips_cohorts_date_order_check check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

comment on table atlas.ips_cohorts is
  'Intentional Peer Support (IPS) Core training cohorts.';

drop trigger if exists trg_ips_cohorts_touch_updated_at on atlas.ips_cohorts;
create trigger trg_ips_cohorts_touch_updated_at
before update on atlas.ips_cohorts
for each row execute function atlas.fn_touch_updated_at();

create table if not exists atlas.ips_cohort_enrollments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references atlas.ips_cohorts(id) on delete cascade,
  person_id uuid not null references atlas.people(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid references atlas.people(id) on delete set null,
  status text not null default 'enrolled' check (status in ('enrolled', 'completed', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ips_cohort_enrollments_cohort_id_person_id_key unique (cohort_id, person_id)
);

comment on table atlas.ips_cohort_enrollments is
  'One row per person per cohort. Inserting a row moves an active t1 person to t2.';

create index if not exists idx_ips_cohort_enrollments_person on atlas.ips_cohort_enrollments(person_id);

drop trigger if exists trg_ips_cohort_enrollments_touch_updated_at on atlas.ips_cohort_enrollments;
create trigger trg_ips_cohort_enrollments_touch_updated_at
before update on atlas.ips_cohort_enrollments
for each row execute function atlas.fn_touch_updated_at();

-- After an enrollment row is inserted, a person whose people_tiers row is
-- active t1 is moved to t2 through atlas.fn_tier_apply. Any other standing
-- (no row, alum, or t2 and above) is left as is.
create or replace function atlas.fn_ips_cohort_enrollment_advance_tier()
returns trigger
language plpgsql
security definer
set search_path = atlas, public
as $$
begin
  if exists (
    select 1
    from atlas.people_tiers pt
    where pt.person_id = new.person_id
      and pt.tier_key = 't1'
      and pt.tier_status = 'active'
  ) then
    perform atlas.fn_tier_apply(new.person_id, 't2');
  end if;
  return new;
end;
$$;

revoke all on function atlas.fn_ips_cohort_enrollment_advance_tier() from public;

drop trigger if exists trg_ips_cohort_enrollments_advance_tier on atlas.ips_cohort_enrollments;
create trigger trg_ips_cohort_enrollments_advance_tier
after insert on atlas.ips_cohort_enrollments
for each row execute function atlas.fn_ips_cohort_enrollment_advance_tier();

alter table atlas.ips_cohorts enable row level security;
alter table atlas.ips_cohort_enrollments enable row level security;

-- A person reads the cohorts they are enrolled in.
drop policy if exists ips_cohorts_self_select on atlas.ips_cohorts;
create policy ips_cohorts_self_select on atlas.ips_cohorts
  for select to authenticated
  using (
    exists (
      select 1
      from atlas.ips_cohort_enrollments e
      where e.cohort_id = ips_cohorts.id
        and e.person_id = atlas.fn_current_person_id()
    )
  );

drop policy if exists ips_cohorts_permission_select on atlas.ips_cohorts;
create policy ips_cohorts_permission_select on atlas.ips_cohorts
  for select to authenticated
  using (atlas.fn_has_permission('supervision.give'));

drop policy if exists ips_cohorts_permission_insert on atlas.ips_cohorts;
create policy ips_cohorts_permission_insert on atlas.ips_cohorts
  for insert to authenticated
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists ips_cohorts_permission_update on atlas.ips_cohorts;
create policy ips_cohorts_permission_update on atlas.ips_cohorts
  for update to authenticated
  using (atlas.fn_has_permission('supervision.give'))
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists ips_cohorts_admin_all on atlas.ips_cohorts;
create policy ips_cohorts_admin_all on atlas.ips_cohorts
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

drop policy if exists ips_cohort_enrollments_self_select on atlas.ips_cohort_enrollments;
create policy ips_cohort_enrollments_self_select on atlas.ips_cohort_enrollments
  for select to authenticated
  using (person_id = atlas.fn_current_person_id());

drop policy if exists ips_cohort_enrollments_permission_select on atlas.ips_cohort_enrollments;
create policy ips_cohort_enrollments_permission_select on atlas.ips_cohort_enrollments
  for select to authenticated
  using (atlas.fn_has_permission('supervision.give'));

drop policy if exists ips_cohort_enrollments_permission_insert on atlas.ips_cohort_enrollments;
create policy ips_cohort_enrollments_permission_insert on atlas.ips_cohort_enrollments
  for insert to authenticated
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists ips_cohort_enrollments_permission_update on atlas.ips_cohort_enrollments;
create policy ips_cohort_enrollments_permission_update on atlas.ips_cohort_enrollments
  for update to authenticated
  using (atlas.fn_has_permission('supervision.give'))
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists ips_cohort_enrollments_admin_all on atlas.ips_cohort_enrollments;
create policy ips_cohort_enrollments_admin_all on atlas.ips_cohort_enrollments
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

revoke all on table atlas.ips_cohorts from public, anon, authenticated;
revoke all on table atlas.ips_cohort_enrollments from public, anon, authenticated;
grant select, insert, update, delete on table atlas.ips_cohorts to authenticated;
grant select, insert, update, delete on table atlas.ips_cohort_enrollments to authenticated;
grant select, insert, update, delete on table atlas.ips_cohorts to service_role;
grant select, insert, update, delete on table atlas.ips_cohort_enrollments to service_role;

-- ---------------------------------------------------------------------------
-- competency_cards (catalog) and people_competency_cards (earned).
-- ---------------------------------------------------------------------------

create table if not exists atlas.competency_cards (
  id uuid primary key default gen_random_uuid(),
  card_key text not null unique,
  title text not null,
  description text,
  tier_min text check (tier_min is null or tier_min in ('t1', 't2', 't2b', 't3', 't3a', 't4', 't4plus')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table atlas.competency_cards is
  'Catalog of competency cards. tier_min is the lowest tier the card is normally issued at.';

drop trigger if exists trg_competency_cards_touch_updated_at on atlas.competency_cards;
create trigger trg_competency_cards_touch_updated_at
before update on atlas.competency_cards
for each row execute function atlas.fn_touch_updated_at();

insert into atlas.competency_cards (card_key, title, description, tier_min)
values
  ('ips_core_complete', 'IPS Core Complete', 'Completed an Intentional Peer Support (IPS) Core cohort.', 't2'),
  ('co_reflection', 'Co-Reflection', 'Practices co-reflection with peers and supervisors.', 't2'),
  ('relational_practice', 'Relational Practice', 'Holds mutual, relationship-first practice in encounters.', 't2'),
  ('hospitality', 'Hospitality', 'Welcomes and hosts people at a site or station.', 't2b'),
  ('warmline_operator', 'Warm Line Operator', 'Operates warm-line shifts.', 't2b'),
  ('group_facilitation', 'Group Facilitation', 'Facilitates peer groups.', 't2b'),
  ('navigation_systems', 'Navigation Systems', 'Navigates county, housing, and care systems with enrollees.', 't3a'),
  ('supervision_practice', 'Supervision Practice', 'Supervises and assesses peer navigators.', 't4')
on conflict (card_key) do update
set title = excluded.title,
    description = excluded.description,
    tier_min = excluded.tier_min;

create table if not exists atlas.people_competency_cards (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references atlas.people(id) on delete cascade,
  card_id uuid not null references atlas.competency_cards(id) on delete cascade,
  earned_at timestamptz not null default now(),
  issued_by_person_id uuid references atlas.people(id) on delete set null,
  assessment_id uuid references atlas.navigator_competency_assessments(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_competency_cards_person_id_card_id_key unique (person_id, card_id)
);

comment on table atlas.people_competency_cards is
  'Cards earned by a person. assessment_id links the issuing navigator competency assessment when there is one.';

create index if not exists idx_people_competency_cards_person on atlas.people_competency_cards(person_id, earned_at desc);

drop trigger if exists trg_people_competency_cards_touch_updated_at on atlas.people_competency_cards;
create trigger trg_people_competency_cards_touch_updated_at
before update on atlas.people_competency_cards
for each row execute function atlas.fn_touch_updated_at();

alter table atlas.competency_cards enable row level security;
alter table atlas.people_competency_cards enable row level security;

-- The catalog is read by every signed-in user; only supervision.give holders
-- and admins edit it.
drop policy if exists competency_cards_authenticated_select on atlas.competency_cards;
create policy competency_cards_authenticated_select on atlas.competency_cards
  for select to authenticated
  using (true);

drop policy if exists competency_cards_permission_insert on atlas.competency_cards;
create policy competency_cards_permission_insert on atlas.competency_cards
  for insert to authenticated
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists competency_cards_permission_update on atlas.competency_cards;
create policy competency_cards_permission_update on atlas.competency_cards
  for update to authenticated
  using (atlas.fn_has_permission('supervision.give'))
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists competency_cards_admin_all on atlas.competency_cards;
create policy competency_cards_admin_all on atlas.competency_cards
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

drop policy if exists people_competency_cards_self_select on atlas.people_competency_cards;
create policy people_competency_cards_self_select on atlas.people_competency_cards
  for select to authenticated
  using (person_id = atlas.fn_current_person_id());

drop policy if exists people_competency_cards_permission_select on atlas.people_competency_cards;
create policy people_competency_cards_permission_select on atlas.people_competency_cards
  for select to authenticated
  using (
    atlas.fn_has_permission('competency_cards.view')
    or atlas.fn_has_permission('supervision.give')
  );

drop policy if exists people_competency_cards_permission_insert on atlas.people_competency_cards;
create policy people_competency_cards_permission_insert on atlas.people_competency_cards
  for insert to authenticated
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists people_competency_cards_permission_update on atlas.people_competency_cards;
create policy people_competency_cards_permission_update on atlas.people_competency_cards
  for update to authenticated
  using (atlas.fn_has_permission('supervision.give'))
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists people_competency_cards_admin_all on atlas.people_competency_cards;
create policy people_competency_cards_admin_all on atlas.people_competency_cards
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

revoke all on table atlas.competency_cards from public, anon, authenticated;
revoke all on table atlas.people_competency_cards from public, anon, authenticated;
grant select, insert, update, delete on table atlas.competency_cards to authenticated;
grant select, insert, update, delete on table atlas.people_competency_cards to authenticated;
grant select, insert, update, delete on table atlas.competency_cards to service_role;
grant select, insert, update, delete on table atlas.people_competency_cards to service_role;

-- ---------------------------------------------------------------------------
-- respite_shifts.
-- ---------------------------------------------------------------------------

create table if not exists atlas.respite_shifts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references atlas.people(id) on delete cascade,
  site text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint respite_shifts_time_order_check check (ends_at > starts_at)
);

comment on table atlas.respite_shifts is
  'Respite shifts taken by t2b and higher (respite_shifts.take).';

create index if not exists idx_respite_shifts_person on atlas.respite_shifts(person_id, starts_at desc);

drop trigger if exists trg_respite_shifts_touch_updated_at on atlas.respite_shifts;
create trigger trg_respite_shifts_touch_updated_at
before update on atlas.respite_shifts
for each row execute function atlas.fn_touch_updated_at();

alter table atlas.respite_shifts enable row level security;

drop policy if exists respite_shifts_self_select on atlas.respite_shifts;
create policy respite_shifts_self_select on atlas.respite_shifts
  for select to authenticated
  using (person_id = atlas.fn_current_person_id());

drop policy if exists respite_shifts_permission_select on atlas.respite_shifts;
create policy respite_shifts_permission_select on atlas.respite_shifts
  for select to authenticated
  using (
    atlas.fn_has_permission('respite_shifts.take')
    or atlas.fn_has_permission('supervision.give')
  );

-- A respite_shifts.take holder writes their own shifts; a supervision.give
-- holder writes anyone's.
drop policy if exists respite_shifts_permission_insert on atlas.respite_shifts;
create policy respite_shifts_permission_insert on atlas.respite_shifts
  for insert to authenticated
  with check (
    (atlas.fn_has_permission('respite_shifts.take') and person_id = atlas.fn_current_person_id())
    or atlas.fn_has_permission('supervision.give')
  );

drop policy if exists respite_shifts_permission_update on atlas.respite_shifts;
create policy respite_shifts_permission_update on atlas.respite_shifts
  for update to authenticated
  using (
    (atlas.fn_has_permission('respite_shifts.take') and person_id = atlas.fn_current_person_id())
    or atlas.fn_has_permission('supervision.give')
  )
  with check (
    (atlas.fn_has_permission('respite_shifts.take') and person_id = atlas.fn_current_person_id())
    or atlas.fn_has_permission('supervision.give')
  );

drop policy if exists respite_shifts_admin_all on atlas.respite_shifts;
create policy respite_shifts_admin_all on atlas.respite_shifts
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

revoke all on table atlas.respite_shifts from public, anon, authenticated;
grant select, insert, update, delete on table atlas.respite_shifts to authenticated;
grant select, insert, update, delete on table atlas.respite_shifts to service_role;

-- ---------------------------------------------------------------------------
-- secondments and secondment_schedule.
-- ---------------------------------------------------------------------------

create table if not exists atlas.secondments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references atlas.people(id) on delete cascade,
  host_organization text not null,
  partner_id uuid references atlas.partners(id) on delete set null,
  starts_on date not null,
  ends_on date,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint secondments_date_order_check check (ends_on is null or ends_on >= starts_on)
);

comment on table atlas.secondments is
  'Travel Peer (t3) placements at a host organization. partner_id links the partner row when the host is a partner.';

create index if not exists idx_secondments_person on atlas.secondments(person_id, starts_on desc);

drop trigger if exists trg_secondments_touch_updated_at on atlas.secondments;
create trigger trg_secondments_touch_updated_at
before update on atlas.secondments
for each row execute function atlas.fn_touch_updated_at();

create table if not exists atlas.secondment_schedule (
  id uuid primary key default gen_random_uuid(),
  secondment_id uuid not null references atlas.secondments(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  starts_time time not null,
  ends_time time not null,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint secondment_schedule_time_order_check check (ends_time > starts_time)
);

comment on table atlas.secondment_schedule is
  'Weekly schedule rows for a secondment. day_of_week 0 is Sunday through 6 Saturday.';

create index if not exists idx_secondment_schedule_secondment on atlas.secondment_schedule(secondment_id, day_of_week, starts_time);

drop trigger if exists trg_secondment_schedule_touch_updated_at on atlas.secondment_schedule;
create trigger trg_secondment_schedule_touch_updated_at
before update on atlas.secondment_schedule
for each row execute function atlas.fn_touch_updated_at();

alter table atlas.secondments enable row level security;
alter table atlas.secondment_schedule enable row level security;

drop policy if exists secondments_self_select on atlas.secondments;
create policy secondments_self_select on atlas.secondments
  for select to authenticated
  using (person_id = atlas.fn_current_person_id());

drop policy if exists secondments_permission_select on atlas.secondments;
create policy secondments_permission_select on atlas.secondments
  for select to authenticated
  using (
    atlas.fn_has_permission('secondment_schedule.view')
    or atlas.fn_has_permission('supervision.give')
  );

drop policy if exists secondments_permission_insert on atlas.secondments;
create policy secondments_permission_insert on atlas.secondments
  for insert to authenticated
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists secondments_permission_update on atlas.secondments;
create policy secondments_permission_update on atlas.secondments
  for update to authenticated
  using (atlas.fn_has_permission('supervision.give'))
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists secondments_admin_all on atlas.secondments;
create policy secondments_admin_all on atlas.secondments
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

-- Schedule rows follow the parent secondment: the seconded person reads them.
drop policy if exists secondment_schedule_self_select on atlas.secondment_schedule;
create policy secondment_schedule_self_select on atlas.secondment_schedule
  for select to authenticated
  using (
    exists (
      select 1
      from atlas.secondments s
      where s.id = secondment_schedule.secondment_id
        and s.person_id = atlas.fn_current_person_id()
    )
  );

drop policy if exists secondment_schedule_permission_select on atlas.secondment_schedule;
create policy secondment_schedule_permission_select on atlas.secondment_schedule
  for select to authenticated
  using (
    atlas.fn_has_permission('secondment_schedule.view')
    or atlas.fn_has_permission('supervision.give')
  );

drop policy if exists secondment_schedule_permission_insert on atlas.secondment_schedule;
create policy secondment_schedule_permission_insert on atlas.secondment_schedule
  for insert to authenticated
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists secondment_schedule_permission_update on atlas.secondment_schedule;
create policy secondment_schedule_permission_update on atlas.secondment_schedule
  for update to authenticated
  using (atlas.fn_has_permission('supervision.give'))
  with check (atlas.fn_has_permission('supervision.give'));

drop policy if exists secondment_schedule_admin_all on atlas.secondment_schedule;
create policy secondment_schedule_admin_all on atlas.secondment_schedule
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

revoke all on table atlas.secondments from public, anon, authenticated;
revoke all on table atlas.secondment_schedule from public, anon, authenticated;
grant select, insert, update, delete on table atlas.secondments to authenticated;
grant select, insert, update, delete on table atlas.secondment_schedule to authenticated;
grant select, insert, update, delete on table atlas.secondments to service_role;
grant select, insert, update, delete on table atlas.secondment_schedule to service_role;

-- ---------------------------------------------------------------------------
-- leads.
-- ---------------------------------------------------------------------------

create table if not exists atlas.leads (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references atlas.people(id) on delete set null,
  display_name text not null,
  phone text,
  email text,
  source text,
  stage text not null default 'new' check (stage in ('new', 'contacted', 'engaged', 'referred', 'closed')),
  owner_person_id uuid references atlas.people(id) on delete set null,
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table atlas.leads is
  'People being engaged toward referral or enrollment. person_id is set once the lead has an atlas.people row.';

create index if not exists idx_leads_owner_stage on atlas.leads(owner_person_id, stage);
create index if not exists idx_leads_person on atlas.leads(person_id);

drop trigger if exists trg_leads_touch_updated_at on atlas.leads;
create trigger trg_leads_touch_updated_at
before update on atlas.leads
for each row execute function atlas.fn_touch_updated_at();

alter table atlas.leads enable row level security;

-- The lead's own person row or the owner reads the lead.
drop policy if exists leads_self_select on atlas.leads;
create policy leads_self_select on atlas.leads
  for select to authenticated
  using (
    person_id = atlas.fn_current_person_id()
    or owner_person_id = atlas.fn_current_person_id()
  );

drop policy if exists leads_permission_select on atlas.leads;
create policy leads_permission_select on atlas.leads
  for select to authenticated
  using (atlas.fn_has_permission('leads.engage'));

drop policy if exists leads_permission_insert on atlas.leads;
create policy leads_permission_insert on atlas.leads
  for insert to authenticated
  with check (atlas.fn_has_permission('leads.engage'));

drop policy if exists leads_permission_update on atlas.leads;
create policy leads_permission_update on atlas.leads
  for update to authenticated
  using (atlas.fn_has_permission('leads.engage'))
  with check (atlas.fn_has_permission('leads.engage'));

drop policy if exists leads_admin_all on atlas.leads;
create policy leads_admin_all on atlas.leads
  for all to authenticated
  using (atlas.fn_is_system_admin())
  with check (atlas.fn_is_system_admin());

revoke all on table atlas.leads from public, anon, authenticated;
grant select, insert, update, delete on table atlas.leads to authenticated;
grant select, insert, update, delete on table atlas.leads to service_role;

-- ---------------------------------------------------------------------------
-- public_referral_intake_events.referrer_person_id: the person whose referral
-- this is, so referrals count toward that person's sponsorship record.
-- ---------------------------------------------------------------------------

alter table atlas.public_referral_intake_events
  add column if not exists referrer_person_id uuid references atlas.people(id) on delete set null;

create index if not exists idx_public_referral_intake_events_referrer
  on atlas.public_referral_intake_events(referrer_person_id)
  where referrer_person_id is not null;

comment on column atlas.public_referral_intake_events.referrer_person_id is
  'The atlas.people row that made the referral. Null for anonymous public submissions.';

-- ---------------------------------------------------------------------------
-- RPCs. Each one is security definer, resolves the caller through
-- atlas.fn_current_person_id(), and checks fn_has_permission or
-- fn_is_system_admin before writing.
-- ---------------------------------------------------------------------------

-- Inserts an enrollment row for target_person_id in cohort_id and returns its
-- id. An existing (cohort_id, person_id) row is returned unchanged. The
-- after-insert trigger moves an active t1 person to t2.
create or replace function atlas.fn_enroll_in_cohort(cohort_id uuid, target_person_id uuid)
returns uuid
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_caller uuid := atlas.fn_current_person_id();
  v_enrollment_id uuid;
begin
  if not (atlas.fn_is_system_admin() or atlas.fn_has_permission('supervision.give')) then
    raise exception 'cohort enrollment requires supervision.give' using errcode = '42501';
  end if;
  if fn_enroll_in_cohort.cohort_id is null or target_person_id is null then
    raise exception 'cohort_id and target_person_id are required' using errcode = '22023';
  end if;
  if not exists (select 1 from atlas.ips_cohorts c where c.id = fn_enroll_in_cohort.cohort_id) then
    raise exception 'cohort not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from atlas.people p where p.id = target_person_id) then
    raise exception 'person not found' using errcode = 'P0002';
  end if;

  select e.id into v_enrollment_id
  from atlas.ips_cohort_enrollments e
  where e.cohort_id = fn_enroll_in_cohort.cohort_id
    and e.person_id = target_person_id
  limit 1;

  if v_enrollment_id is not null then
    return v_enrollment_id;
  end if;

  insert into atlas.ips_cohort_enrollments (cohort_id, person_id, enrolled_at, enrolled_by, status)
  values (fn_enroll_in_cohort.cohort_id, target_person_id, now(), v_caller, 'enrolled')
  returning id into v_enrollment_id;

  return v_enrollment_id;
end;
$$;

-- Inserts an active sponsorship and returns its id. The existing active row
-- for the pair is returned when there is one. A sponsorship.give holder may
-- only name themself as sponsor; supervision.give holders and admins may name
-- any sponsor.
create or replace function atlas.fn_create_sponsorship(sponsor_person_id uuid, sponsored_person_id uuid)
returns uuid
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_caller uuid := atlas.fn_current_person_id();
  v_sponsorship_id uuid;
  v_can_name_any_sponsor boolean := atlas.fn_is_system_admin() or atlas.fn_has_permission('supervision.give');
begin
  if fn_create_sponsorship.sponsor_person_id is null or fn_create_sponsorship.sponsored_person_id is null then
    raise exception 'sponsor_person_id and sponsored_person_id are required' using errcode = '22023';
  end if;
  if fn_create_sponsorship.sponsor_person_id = fn_create_sponsorship.sponsored_person_id then
    raise exception 'a person cannot sponsor themself' using errcode = '22023';
  end if;
  if not v_can_name_any_sponsor then
    if not atlas.fn_has_permission('sponsorship.give') then
      raise exception 'creating a sponsorship requires sponsorship.give' using errcode = '42501';
    end if;
    if v_caller is null or fn_create_sponsorship.sponsor_person_id <> v_caller then
      raise exception 'sponsor_person_id must be the caller' using errcode = '42501';
    end if;
  end if;
  if not exists (select 1 from atlas.people p where p.id = fn_create_sponsorship.sponsor_person_id)
    or not exists (select 1 from atlas.people p where p.id = fn_create_sponsorship.sponsored_person_id) then
    raise exception 'person not found' using errcode = 'P0002';
  end if;

  select s.id into v_sponsorship_id
  from atlas.sponsorships s
  where s.sponsor_person_id = fn_create_sponsorship.sponsor_person_id
    and s.sponsored_person_id = fn_create_sponsorship.sponsored_person_id
    and s.status = 'active'
  limit 1;

  if v_sponsorship_id is not null then
    return v_sponsorship_id;
  end if;

  insert into atlas.sponsorships (sponsor_person_id, sponsored_person_id, status, started_at)
  values (fn_create_sponsorship.sponsor_person_id, fn_create_sponsorship.sponsored_person_id, 'active', now())
  returning id into v_sponsorship_id;

  return v_sponsorship_id;
end;
$$;

-- Issues card_id to target_person_id and returns the people_competency_cards
-- id. When the pair already exists the row keeps its earned_at and only
-- issued_by_person_id and assessment_id are refreshed. assessment_id, when
-- given, must be an assessment of target_person_id.
create or replace function atlas.fn_issue_competency_card(
  target_person_id uuid,
  card_id uuid,
  assessment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_caller uuid := atlas.fn_current_person_id();
  v_row_id uuid;
begin
  if not (atlas.fn_is_system_admin() or atlas.fn_has_permission('supervision.give')) then
    raise exception 'issuing a competency card requires supervision.give' using errcode = '42501';
  end if;
  if target_person_id is null or fn_issue_competency_card.card_id is null then
    raise exception 'target_person_id and card_id are required' using errcode = '22023';
  end if;
  if not exists (select 1 from atlas.people p where p.id = target_person_id) then
    raise exception 'person not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from atlas.competency_cards c where c.id = fn_issue_competency_card.card_id) then
    raise exception 'competency card not found' using errcode = 'P0002';
  end if;
  if fn_issue_competency_card.assessment_id is not null and not exists (
    select 1
    from atlas.navigator_competency_assessments a
    where a.id = fn_issue_competency_card.assessment_id
      and a.navigator_person_id = target_person_id
  ) then
    raise exception 'assessment not found for this person' using errcode = 'P0002';
  end if;

  insert into atlas.people_competency_cards (person_id, card_id, earned_at, issued_by_person_id, assessment_id)
  values (target_person_id, fn_issue_competency_card.card_id, now(), v_caller, fn_issue_competency_card.assessment_id)
  on conflict on constraint people_competency_cards_person_id_card_id_key do update
  set issued_by_person_id = excluded.issued_by_person_id,
      assessment_id = coalesce(excluded.assessment_id, atlas.people_competency_cards.assessment_id)
  returning id into v_row_id;

  return v_row_id;
end;
$$;

-- Inserts or updates one atlas.leads row from a JSON payload and returns its
-- id. Payload keys: id (update when present), person_id, display_name, phone,
-- email, source, stage, owner_person_id, notes, last_contact_at. On insert the
-- owner defaults to the caller. On update only the keys present in the
-- payload are written.
create or replace function atlas.fn_upsert_lead(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = atlas, public
as $$
declare
  v_caller uuid := atlas.fn_current_person_id();
  v_payload jsonb := coalesce(payload, '{}'::jsonb);
  v_lead_id uuid := nullif(v_payload ->> 'id', '')::uuid;
  v_stage text := nullif(lower(btrim(v_payload ->> 'stage')), '');
begin
  if not (atlas.fn_is_system_admin() or atlas.fn_has_permission('leads.engage')) then
    raise exception 'lead changes require leads.engage' using errcode = '42501';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;
  if v_stage is not null and v_stage not in ('new', 'contacted', 'engaged', 'referred', 'closed') then
    raise exception 'unknown lead stage %', v_stage using errcode = '22023';
  end if;

  if v_lead_id is null then
    if nullif(btrim(v_payload ->> 'display_name'), '') is null then
      raise exception 'display_name is required for a new lead' using errcode = '22023';
    end if;

    insert into atlas.leads (
      person_id, display_name, phone, email, source, stage, owner_person_id, notes, last_contact_at
    )
    values (
      nullif(v_payload ->> 'person_id', '')::uuid,
      btrim(v_payload ->> 'display_name'),
      nullif(btrim(v_payload ->> 'phone'), ''),
      nullif(btrim(v_payload ->> 'email'), ''),
      nullif(btrim(v_payload ->> 'source'), ''),
      coalesce(v_stage, 'new'),
      coalesce(nullif(v_payload ->> 'owner_person_id', '')::uuid, v_caller),
      nullif(v_payload ->> 'notes', ''),
      nullif(v_payload ->> 'last_contact_at', '')::timestamptz
    )
    returning id into v_lead_id;

    return v_lead_id;
  end if;

  if not exists (select 1 from atlas.leads l where l.id = v_lead_id) then
    raise exception 'lead not found' using errcode = 'P0002';
  end if;

  update atlas.leads l
  set
    person_id = case when v_payload ? 'person_id' then nullif(v_payload ->> 'person_id', '')::uuid else l.person_id end,
    display_name = case when v_payload ? 'display_name' then coalesce(nullif(btrim(v_payload ->> 'display_name'), ''), l.display_name) else l.display_name end,
    phone = case when v_payload ? 'phone' then nullif(btrim(v_payload ->> 'phone'), '') else l.phone end,
    email = case when v_payload ? 'email' then nullif(btrim(v_payload ->> 'email'), '') else l.email end,
    source = case when v_payload ? 'source' then nullif(btrim(v_payload ->> 'source'), '') else l.source end,
    stage = coalesce(v_stage, l.stage),
    owner_person_id = case when v_payload ? 'owner_person_id' then nullif(v_payload ->> 'owner_person_id', '')::uuid else l.owner_person_id end,
    notes = case when v_payload ? 'notes' then nullif(v_payload ->> 'notes', '') else l.notes end,
    last_contact_at = case when v_payload ? 'last_contact_at' then nullif(v_payload ->> 'last_contact_at', '')::timestamptz else l.last_contact_at end
  where l.id = v_lead_id;

  return v_lead_id;
end;
$$;

-- Returns one JSON document for the caller's wallet:
-- {
--   tier: {tier_key, tier_status, is_lucid_employee, designations: text[]} | null,
--   competency_cards: [{card_key, title, earned_at}],
--   sponsorships_given: [{id, sponsored_person_id, sponsored_display_name, status, started_at, ended_at}],
--   sponsorships_received: [{id, sponsor_person_id, sponsor_display_name, status, started_at, ended_at}],
--   respite_shifts: [{id, site, starts_at, ends_at, status}],
--   secondments: [{id, host_organization, partner_id, starts_on, ends_on, status,
--                  schedule: [{day_of_week, starts_time, ends_time, location}]}],
--   leads_owned_count: integer
-- }
-- tier comes from atlas.fn_my_tier(); every list is for the caller's person
-- id only, so no permission key is required beyond being signed in.
create or replace function atlas.fn_wallet_overview()
returns jsonb
language sql
stable
security definer
set search_path = atlas, public
as $$
  with me as (
    select atlas.fn_current_person_id() as person_id
  )
  select jsonb_build_object(
    'tier',
    (
      select to_jsonb(t)
      from atlas.fn_my_tier() t
      limit 1
    ),
    'competency_cards',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'card_key', c.card_key,
            'title', c.title,
            'earned_at', pcc.earned_at
          )
          order by pcc.earned_at desc
        )
        from atlas.people_competency_cards pcc
        join atlas.competency_cards c on c.id = pcc.card_id
        join me on me.person_id = pcc.person_id
      ),
      '[]'::jsonb
    ),
    'sponsorships_given',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'sponsored_person_id', s.sponsored_person_id,
            'sponsored_display_name', p.display_name,
            'status', s.status,
            'started_at', s.started_at,
            'ended_at', s.ended_at
          )
          order by s.started_at desc
        )
        from atlas.sponsorships s
        join me on me.person_id = s.sponsor_person_id
        left join atlas.people p on p.id = s.sponsored_person_id
      ),
      '[]'::jsonb
    ),
    'sponsorships_received',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'sponsor_person_id', s.sponsor_person_id,
            'sponsor_display_name', p.display_name,
            'status', s.status,
            'started_at', s.started_at,
            'ended_at', s.ended_at
          )
          order by s.started_at desc
        )
        from atlas.sponsorships s
        join me on me.person_id = s.sponsored_person_id
        left join atlas.people p on p.id = s.sponsor_person_id
      ),
      '[]'::jsonb
    ),
    'respite_shifts',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', rs.id,
            'site', rs.site,
            'starts_at', rs.starts_at,
            'ends_at', rs.ends_at,
            'status', rs.status
          )
          order by rs.starts_at desc
        )
        from atlas.respite_shifts rs
        join me on me.person_id = rs.person_id
      ),
      '[]'::jsonb
    ),
    'secondments',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sec.id,
            'host_organization', sec.host_organization,
            'partner_id', sec.partner_id,
            'starts_on', sec.starts_on,
            'ends_on', sec.ends_on,
            'status', sec.status,
            'schedule', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'day_of_week', ss.day_of_week,
                    'starts_time', ss.starts_time,
                    'ends_time', ss.ends_time,
                    'location', ss.location
                  )
                  order by ss.day_of_week, ss.starts_time
                )
                from atlas.secondment_schedule ss
                where ss.secondment_id = sec.id
              ),
              '[]'::jsonb
            )
          )
          order by sec.starts_on desc
        )
        from atlas.secondments sec
        join me on me.person_id = sec.person_id
      ),
      '[]'::jsonb
    ),
    'leads_owned_count',
    coalesce(
      (
        select count(*)::int
        from atlas.leads l
        join me on me.person_id = l.owner_person_id
      ),
      0
    )
  )
$$;

revoke all on function atlas.fn_enroll_in_cohort(uuid, uuid) from public;
revoke all on function atlas.fn_create_sponsorship(uuid, uuid) from public;
revoke all on function atlas.fn_issue_competency_card(uuid, uuid, uuid) from public;
revoke all on function atlas.fn_upsert_lead(jsonb) from public;
revoke all on function atlas.fn_wallet_overview() from public;

grant execute on function atlas.fn_enroll_in_cohort(uuid, uuid) to authenticated;
grant execute on function atlas.fn_create_sponsorship(uuid, uuid) to authenticated;
grant execute on function atlas.fn_issue_competency_card(uuid, uuid, uuid) to authenticated;
grant execute on function atlas.fn_upsert_lead(jsonb) to authenticated;
grant execute on function atlas.fn_wallet_overview() to authenticated;

notify pgrst, 'reload schema';
