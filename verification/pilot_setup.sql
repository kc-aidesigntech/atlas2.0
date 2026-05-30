-- =============================================================================
-- Atlas pilot setup: artificial logins for each role + scoped seed data.
--
-- Idempotent and re-runnable. Creates four Supabase Auth users (administrator,
-- navigator, supervisor, partner) with a shared password and email already
-- confirmed, then seeds each identity's Row-Level Security (RLS) scope so the
-- role's screens have data to act on:
--   - navigator  -> assigned to two enrollments (sees those enrollees)
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
-- 4) Navigator scope: assign the pilot navigator to two existing enrollments so
--    the enrollee dropdown and load board have data.
-- ---------------------------------------------------------------------------
insert into atlas.navigator_assignments (enrollment_id, navigator_person_id, starts_on)
select en.id, 'a11ce000-0000-0000-0000-000000000002'::uuid, current_date
from atlas.enrollments en
order by en.created_at
limit 2;

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
       (select count(*) from atlas.navigator_assignments na where na.navigator_person_id = u.id) as nav_assignments,
       (select count(*) from atlas.supervisor_navigator_assignments sa where sa.supervisor_person_id = u.id) as supervises
from auth.users u
where u.email like 'pilot.%@atlas.test'
order by u.email;
