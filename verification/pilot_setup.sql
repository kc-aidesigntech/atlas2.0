-- =============================================================================
-- Atlas pilot setup: artificial logins for each role + scoped seed data.
--
-- Idempotent and re-runnable. Creates four Supabase Auth users (administrator,
-- navigator, supervisor, partner) with a shared password and email already
-- confirmed, then seeds each identity's Row-Level Security (RLS) scope so the
-- role's screens have data to act on:
--   - navigator  -> assigned to two enrollments (sees those enrollees) plus
--                  10 improving IPSCC encounter submissions from Sandra Morrison
--                  plus one complete C.R.E.A.T.E. session with Pilot Supervisor
--                  (Section 3 reflection is NOT SQL-seeded — generate via MCP/Ollama)
--   - supervisor -> supervises every navigator (sees competency rollups)
--   - partner    -> primary contact of a dedicated pilot partner org
--   - admin      -> app_metadata.atlas_role = 'administrator' (full access)
--
-- Run via the Supabase MCP (execute_sql) or psql as a privileged role; it writes
-- to auth.* and bypasses RLS, so it is a seed/operational script, NOT an app
-- migration. Do not add to supabase/migrations.
--
-- Shared password for all four logins: AtlasPilot2026!
-- =============================================================================

begin;

-- Fixed identifiers keep the seed referenceable and idempotent across re-runs.
-- Pilot user ids (auth.users.id == atlas.people.id by the identity bridge).
--   admin      a11ce000-0000-0000-0000-000000000001
--   navigator  a11ce000-0000-0000-0000-000000000002
--   supervisor a11ce000-0000-0000-0000-000000000003
--   partner    a11ce000-0000-0000-0000-000000000004
--   partner org a11ce000-0000-0000-0000-0000000000a4

-- ---------------------------------------------------------------------------
-- 1) Clean up any prior pilot rows (child-first) so re-runs start fresh.
-- ---------------------------------------------------------------------------
delete from atlas.navigator_assignments
 where navigator_person_id = 'a11ce000-0000-0000-0000-000000000002';
delete from atlas.navigator_ipscc_encounter_submissions
 where id in (
   'a11ce0cc-0000-4000-8000-000000000001',
   'a11ce0cc-0000-4000-8000-000000000002',
   'a11ce0cc-0000-4000-8000-000000000003',
   'a11ce0cc-0000-4000-8000-000000000004',
   'a11ce0cc-0000-4000-8000-000000000005',
   'a11ce0cc-0000-4000-8000-000000000006',
   'a11ce0cc-0000-4000-8000-000000000007',
   'a11ce0cc-0000-4000-8000-000000000008',
   'a11ce0cc-0000-4000-8000-000000000009',
   'a11ce0cc-0000-4000-8000-00000000000a'
 )
 or (
   lower(navigator_name) = 'pilot navigator'
   and enrollee_id = '00000000-0000-0000-0000-000000000401'
 );
delete from atlas.navigator_create_reflections
 where id = 'a11ce0c7-0000-4000-8000-0000000000f1'
    or lower(navigator_name) = 'pilot navigator';
delete from atlas.navigator_create_sessions
 where id = 'a11ce0c7-0000-4000-8000-000000000001'
    or (
      lower(navigator_name) = 'pilot navigator'
      and lower(supervisor_name) = 'pilot supervisor'
    );
delete from atlas.supervisor_navigator_assignments
 where supervisor_person_id = 'a11ce000-0000-0000-0000-000000000003'
    or navigator_person_id   = 'a11ce000-0000-0000-0000-000000000002';
delete from atlas.people_role_assignments
 where person_id in (
   'a11ce000-0000-0000-0000-000000000001',
   'a11ce000-0000-0000-0000-000000000002',
   'a11ce000-0000-0000-0000-000000000003',
   'a11ce000-0000-0000-0000-000000000004'
 );
delete from atlas.partners where id = 'a11ce000-0000-0000-0000-0000000000a4';
delete from atlas.people
 where id in (
   'a11ce000-0000-0000-0000-000000000001',
   'a11ce000-0000-0000-0000-000000000002',
   'a11ce000-0000-0000-0000-000000000003',
   'a11ce000-0000-0000-0000-000000000004'
 );
delete from auth.identities
 where user_id in (
   'a11ce000-0000-0000-0000-000000000001',
   'a11ce000-0000-0000-0000-000000000002',
   'a11ce000-0000-0000-0000-000000000003',
   'a11ce000-0000-0000-0000-000000000004'
 );
delete from auth.users
 where id in (
   'a11ce000-0000-0000-0000-000000000001',
   'a11ce000-0000-0000-0000-000000000002',
   'a11ce000-0000-0000-0000-000000000003',
   'a11ce000-0000-0000-0000-000000000004'
 );

-- ---------------------------------------------------------------------------
-- 2) Create the four auth users. Token columns are empty strings (GoTrue treats
--    NULL token columns as an error on login); email is pre-confirmed; the
--    atlas_role app_metadata claim drives the admin RLS shortcut and the public
--    referral read policy. The AFTER INSERT trigger auto-creates the matching
--    atlas.people row.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, reauthentication_token, is_sso_user, is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000000','a11ce000-0000-0000-0000-000000000001','authenticated','authenticated',
   'pilot.admin@atlas.test', extensions.crypt('AtlasPilot2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"atlas_role":"administrator"}'::jsonb,
   '{"full_name":"Pilot Administrator"}'::jsonb, now(), now(), '', '', '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000','a11ce000-0000-0000-0000-000000000002','authenticated','authenticated',
   'pilot.navigator@atlas.test', extensions.crypt('AtlasPilot2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"atlas_role":"navigator"}'::jsonb,
   '{"full_name":"Pilot Navigator"}'::jsonb, now(), now(), '', '', '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000','a11ce000-0000-0000-0000-000000000003','authenticated','authenticated',
   'pilot.supervisor@atlas.test', extensions.crypt('AtlasPilot2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"atlas_role":"supervisor"}'::jsonb,
   '{"full_name":"Pilot Supervisor"}'::jsonb, now(), now(), '', '', '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000','a11ce000-0000-0000-0000-000000000004','authenticated','authenticated',
   'pilot.partner@atlas.test', extensions.crypt('AtlasPilot2026!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"],"atlas_role":"partner"}'::jsonb,
   '{"full_name":"Pilot Partner"}'::jsonb, now(), now(), '', '', '', '', '', '', false, false);

-- Email identities so password sign-in resolves a linked identity.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in (
  'a11ce000-0000-0000-0000-000000000001',
  'a11ce000-0000-0000-0000-000000000002',
  'a11ce000-0000-0000-0000-000000000003',
  'a11ce000-0000-0000-0000-000000000004'
);

-- ---------------------------------------------------------------------------
-- 3) Set the intended primary role for each pilot identity (the trigger seeds a
--    default 'partner' role; replace it with the role this login is piloting).
-- ---------------------------------------------------------------------------
delete from atlas.people_role_assignments
 where person_id in (
   'a11ce000-0000-0000-0000-000000000001',
   'a11ce000-0000-0000-0000-000000000002',
   'a11ce000-0000-0000-0000-000000000003',
   'a11ce000-0000-0000-0000-000000000004'
 );
insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on)
select v.person_id, r.id, true, current_date
from (values
  ('a11ce000-0000-0000-0000-000000000001'::uuid,'administrator'),
  ('a11ce000-0000-0000-0000-000000000002'::uuid,'navigator'),
  ('a11ce000-0000-0000-0000-000000000003'::uuid,'supervisor'),
  ('a11ce000-0000-0000-0000-000000000004'::uuid,'partner')
) as v(person_id, role_key)
join atlas.roles r on r.role_key = v.role_key;

-- ---------------------------------------------------------------------------
-- 4) Navigator scope: assign the pilot navigator to two active enrollments
--    (Sandra Morrison + Marcus Thompson when present) so the enrollee roster
--    and assignment board have claimed caseload.
-- ---------------------------------------------------------------------------
insert into atlas.navigator_assignments (enrollment_id, navigator_person_id, starts_on)
select en.id, 'a11ce000-0000-0000-0000-000000000002'::uuid, current_date
from atlas.enrollments en
where en.status = 'active'
  and en.id in (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000602'
  );

-- Fallback when the preferred demo enrollments are missing in an environment.
insert into atlas.navigator_assignments (enrollment_id, navigator_person_id, starts_on)
select en.id, 'a11ce000-0000-0000-0000-000000000002'::uuid, current_date
from atlas.enrollments en
where en.status = 'active'
  and not exists (
    select 1
    from atlas.navigator_assignments na
    where na.navigator_person_id = 'a11ce000-0000-0000-0000-000000000002'::uuid
      and na.ends_on is null
  )
order by en.created_at
limit 2;

-- ---------------------------------------------------------------------------
-- 4b) Ten improving IPSCC encounter submissions from Sandra Morrison so the
--     pilot navigator unlocks enrollee averages (privacy floor ≈ 10) and the
--     admin ledger can show opinion lift over time.
-- ---------------------------------------------------------------------------
insert into atlas.navigator_ipscc_encounter_submissions (
  id, navigator_name, enrollee_id, enrollee_name, enrollment_id,
  submitted_at, submitted_by, item_scores, note
)
select
  ('a11ce0cc-0000-4000-8000-00000000000' || to_hex(gs.i))::uuid,
  'Pilot Navigator',
  '00000000-0000-0000-0000-000000000401',
  'Sandra Morrison',
  '00000000-0000-0000-0000-000000000601',
  (now() - ((10 - gs.i) * interval '7 days')),
  'enrollee',
  (
    select jsonb_agg(
      greatest(1, least(5, round(2.1 + ((gs.i - 1)::numeric / 9.0) * 2.6 + ((comp + gs.i) % 3 - 1) * 0.35)))
    )
    from generate_series(0, 9) as comp
  ),
  case
    when gs.i = 1 then 'Pilot enrollee early encounter — cautious ratings.'
    when gs.i = 10 then 'Pilot enrollee latest encounter — clear improvement in opinion of navigator.'
    else format('Pilot enrollee encounter %s of 10 — opinion trending upward.', gs.i)
  end
from generate_series(1, 10) as gs(i)
where exists (
  select 1 from atlas.enrollees e where e.id = '00000000-0000-0000-0000-000000000401'
);

-- ---------------------------------------------------------------------------
-- 5) Supervisor scope: the pilot supervisor supervises every navigator (incl.
--    the pilot navigator) so competency rollups and the supervision board show
--    real data.
-- ---------------------------------------------------------------------------
insert into atlas.supervisor_navigator_assignments (supervisor_person_id, navigator_person_id, starts_on)
select distinct 'a11ce000-0000-0000-0000-000000000003'::uuid, pra.person_id, current_date
from atlas.people_role_assignments pra
join atlas.roles r on r.id = pra.role_id
where r.role_key = 'navigator'
  and pra.ends_on is null
  and pra.person_id <> 'a11ce000-0000-0000-0000-000000000003'::uuid;

-- ---------------------------------------------------------------------------
-- 5b) One complete C.R.E.A.T.E. supervision session for Pilot Navigator /
--     Pilot Supervisor. Do NOT SQL-seed Section 3 reflection text — that must
--     come from MCP → Ollama (or the app's honest offline fallback after save).
--     See verification/generate_pilot_create_reflection.mjs to exercise generation.
-- ---------------------------------------------------------------------------
insert into atlas.navigator_create_sessions (
  id, navigator_name, supervisor_name, session_at, submitted_at, supervision_mode,
  session_duration_minutes, connect_focused_listening,
  recognize_notes, encourage_notes, acknowledge_notes, train_notes, empower_notes,
  create_action_plan, supervisor_submission, supervisee_submission,
  peer_specialist_signature, peer_specialist_signed_at,
  supervisor_signature, supervisor_signed_at, created_at, updated_at
) values (
  'a11ce0c7-0000-4000-8000-000000000001',
  'Pilot Navigator',
  'Pilot Supervisor',
  now() - interval '2 days',
  now() - interval '2 days',
  'in_person',
  55,
  true,
  'You are building genuine warmth with Sandra and Marcus — enrollee IPSCC scores are climbing because people feel seen, not managed. I especially noticed how you named shared ground before problem-solving.',
  'Housing follow-through and transportation friction still pull you into fixing mode under time pressure. When that happens, slow down and ask what the service user already knows before offering options.',
  'You advocated clearly in interdisciplinary updates this week and invited Marcus into the plan instead of speaking for him. That mutuality is leadership worth naming out loud.',
  'Practice one co-learning opener in every encounter this week: “What have you already tried?” Then stay with their answer for two full sentences before adding anything of yours.',
  'You asked for clearer prep time before supervision and for a simple checklist when coordinating partner handoffs — both are fair. I will protect that prep block on our calendar and share the handoff template tomorrow.',
  'Before next supervision: (1) use the co-learning opener with both assigned enrollees, (2) jot one reconnect moment when disconnection shows up, (3) bring one sticky encounter for us to unpack without rushing to solutions.',
  'Pilot Navigator is showing strong connection and mutuality with assigned enrollees, and enrollee opinion of the work is trending upward. The growth edge is staying in learning-together when logistics get loud. We agreed on a concrete practice target and the supports I will provide so the plan is doable, not aspirational.',
  'I want tighter feedback when I slip into advising, and I want help noticing disconnect earlier with Sandra when conversations go flat. The co-learning opener feels usable this week.',
  'Pilot Navigator',
  now() - interval '2 days',
  'Pilot Supervisor',
  now() - interval '2 days',
  now() - interval '2 days',
  now() - interval '2 days'
);

-- ---------------------------------------------------------------------------
-- 6) Partner scope: a dedicated pilot partner org whose primary contact email
--    matches the pilot partner login, satisfying fn_can_access_partner_scope.
-- ---------------------------------------------------------------------------
insert into atlas.partners (id, organization_name, organization_name_normalized, primary_contact_email)
values ('a11ce000-0000-0000-0000-0000000000a4','Atlas Pilot Partner Org','atlas pilot partner org','pilot.partner@atlas.test');

commit;

-- Quick confirmation of what was provisioned.
select u.email,
       u.raw_app_meta_data->>'atlas_role' as app_role,
       (select string_agg(r.role_key, ',') from atlas.people_role_assignments pra
          join atlas.roles r on r.id = pra.role_id where pra.person_id = u.id) as assigned_roles,
       (select count(*) from atlas.navigator_assignments na where na.navigator_person_id = u.id and na.ends_on is null) as nav_assignments,
       (select count(*) from atlas.supervisor_navigator_assignments sa where sa.supervisor_person_id = u.id) as supervises,
       (select count(*) from atlas.navigator_ipscc_encounter_submissions s
          where lower(s.navigator_name) = lower(coalesce(
            (select p.display_name from atlas.people p where p.id = u.id), ''
          ))) as ipscc_encounters
from auth.users u
where u.email like 'pilot.%@atlas.test'
order by u.email;
