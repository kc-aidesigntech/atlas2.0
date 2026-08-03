-- =============================================================================
-- Demo partner login setup: Supabase Auth user for the Harborview demo partner.
--
-- Plan-of-record: demo.md ("Login wiring"). Run AFTER the seed migration
-- supabase/migrations/20260715180000_demo_partner_phenotype_seed.sql, which
-- creates the atlas-side records (partner org, contact person, phenotype
-- enrollees). This script only provisions the auth login and its identity;
-- the identity-bridge trigger merges into the pre-seeded atlas.people row
-- because the auth user id equals the contact person id.
--
-- Idempotent and re-runnable. Writes to auth.* and bypasses Row-Level
-- Security (RLS), so it is a seed/operational script, NOT an app migration
-- (same convention as verification/pilot_setup.sql). Run via the Supabase
-- Model Context Protocol (MCP) execute_sql or psql as a privileged role.
--
-- Login: demo.partner@atlas.test / AtlasPilot2026!  (pilot password convention)
-- Auth user id == atlas.people.id: de300000-0000-0000-0000-0000000000c1
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Remove any prior demo partner auth rows so re-runs start fresh. The
--    atlas.people row is intentionally NOT deleted: the seed migration owns it
--    and the auth trigger upserts into it by id.
-- ---------------------------------------------------------------------------
delete from auth.identities where user_id = 'de300000-0000-0000-0000-0000000000c1';
delete from auth.users where id = 'de300000-0000-0000-0000-0000000000c1';

-- ---------------------------------------------------------------------------
-- 2) Create the auth user. Token columns are empty strings (GoTrue treats NULL
--    token columns as an error on login); email is pre-confirmed.
--    - app_metadata.atlas_role = 'partner' drives partner-role behavior.
--    - user_metadata.organization_name = the Harborview organization name so
--      account-settings fallback resolves the org, which is what the partner
--      station lookup (atlas.v_partner_station_directory) keys on.
--    The AFTER INSERT identity-bridge trigger upserts the matching
--    atlas.people row (id conflict -> update in place).
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, reauthentication_token, is_sso_user, is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  'de300000-0000-0000-0000-0000000000c1',
  'authenticated',
  'authenticated',
  'demo.partner@atlas.test',
  extensions.crypt('AtlasPilot2026!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"atlas_role":"partner"}'::jsonb,
  '{"full_name":"Harper Voss","organization_name":"Harborview Family Advocacy Center"}'::jsonb,
  now(), now(), '', '', '', '', '', '', false, false
);

-- Email identity so password sign-in resolves a linked identity.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id = 'de300000-0000-0000-0000-0000000000c1';

-- ---------------------------------------------------------------------------
-- 3) Repair drift the identity-bridge trigger may introduce on the pre-seeded
--    contact person (the trigger falls back to '<email-local> User' naming
--    when it fires before metadata is readable, and it must not demote the
--    partner role). Idempotent restatement of the seed-owned values.
-- ---------------------------------------------------------------------------
update atlas.people
set first_name = 'Harper',
    last_name = 'Voss',
    display_name = 'Harper Voss',
    email = 'demo.partner@atlas.test',
    person_type = 'staff',
    status = 'active',
    updated_at = now()
where id = 'de300000-0000-0000-0000-0000000000c1';

-- The trigger only adds a default role when none is active, but restate the
-- partner role defensively in case this script runs before the seed migration.
insert into atlas.people_role_assignments (person_id, role_id, is_primary, starts_on)
select 'de300000-0000-0000-0000-0000000000c1', r.id,
       not exists (
         select 1 from atlas.people_role_assignments existing
         where existing.person_id = 'de300000-0000-0000-0000-0000000000c1'
           and existing.is_primary = true
           and existing.ends_on is null
       ),
       current_date
from atlas.roles r
where r.role_key = 'partner'
  and not exists (
    select 1 from atlas.people_role_assignments pra
    where pra.person_id = 'de300000-0000-0000-0000-0000000000c1'
      and pra.role_id = r.id
      and pra.ends_on is null
  );

commit;

-- Quick confirmation of what was provisioned.
select u.email,
       u.raw_app_meta_data->>'atlas_role' as app_role,
       u.raw_user_meta_data->>'organization_name' as organization,
       p.display_name as person_display_name,
       (select string_agg(r.role_key, ',')
          from atlas.people_role_assignments pra
          join atlas.roles r on r.id = pra.role_id
         where pra.person_id = u.id and pra.ends_on is null) as active_roles,
       (select count(*) from atlas.supervisor_navigator_assignments sna
         where sna.supervisor_person_id = u.id and sna.ends_on is null) as oversees_navigators
from auth.users u
join atlas.people p on p.id = u.id
where u.id = 'de300000-0000-0000-0000-0000000000c1';
