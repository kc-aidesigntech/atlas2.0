# Multi-Role Identity and Access Matrix Runbook

This runbook documents the live multi-role identity rollout for `kchristianson@ai-designtech.com`, the schema model behind it, and troubleshooting and rollback steps.

## What was changed

- Multi-role support is enabled in `atlas.people_role_assignments` by removing the one-role-per-person unique index and replacing it with:
  - one active assignment per `person_id + role_id`
  - one active primary role per `person_id`
- Auth claim `raw_app_meta_data.atlas_role` is set to `administrator` for Row-Level Security (RLS)/admin pathways that read JavaScript Object Notation (JSON) Web Token (JWT) metadata.
- Role coverage for the target user now includes:
  - `administrator`
  - `supervisor`
  - `navigator`
  - `partner`
  - `enrollee`
- Baseline relationship assignments were seeded for testing:
  - active `navigator_assignments` rows for the target person
  - active `supervisor_navigator_assignments` rows where the target person is the supervisor
  - one active partner ownership mapping via partner primary contact fields

## Source files

- Migrations:
  - `supabase/migrations/20260503182646_matrix_many_to_many_foundation.sql`
  - `supabase/migrations/20260504010000_launch_identity_bridge_baseline.sql`
- Access matrix repo: `src/features/atlas2026/singlepane/data-access/accessMatrixRepository.ts`
- Access matrix panel: `src/features/atlas2026/singlepane/components/LiveAccessMatrixPanel.tsx`
- Admin integration: `src/features/atlas2026/singlepane/SinglePaneApp.tsx`
- Runtime role hardening: `src/features/atlas2026/singlepane/useSinglePaneData.ts`
- New shared types: `src/features/atlas2026/singlepane/types.ts`

## Live Structured Query Language (SQL) verification snapshot

Latest verified state after rollout:

- JWT role claim: `atlas_role = administrator`
- Active roles for the target user: `administrator`, `enrollee`, `navigator`, `partner`, `supervisor`
- Active navigator assignment count: `3`
- Active supervisor assignment count: `2`

## Operational architecture

1. Auth user signs in via Supabase Auth.
2. `atlas.people.external_ref` links person identity to `auth.users.id::text`.
3. Active role rows in `atlas.people_role_assignments` define role coverage for that person.
4. Assignment tables drive relational scope:
   - `atlas.navigator_assignments` -> enrollee coverage
   - `atlas.supervisor_navigator_assignments` -> reporting and supervision coverage
   - `atlas.partners` primary contact fields -> partner ownership mapping
5. Admin User Interface (UI) (`LiveAccessMatrixPanel`) writes through guarded Supabase Remote Procedure Call (RPC) functions that enforce administrator claims server-side.
6. Runtime hook syncs UI-enabled roles from live identity role assignments (email match), so role switching reflects actual assigned roles.

## Troubleshooting

### 1) User sees missing admin features

- Check JWT claim:
  - `select raw_app_meta_data->>'atlas_role' from auth.users where lower(email)=lower('<email>');`
- Expected for full admin path: `administrator`

### 2) Role is not toggleable in UI

- Check active role assignments:
  - `select r.role_key, pra.is_primary from atlas.people_role_assignments pra join atlas.roles r on r.id=pra.role_id where pra.person_id='<person_id>' and pra.ends_on is null order by r.role_key;`
- If missing, insert row or use live matrix to assign role.

### 3) Navigator view does not show expected enrollees

- Check active navigator assignments:
  - `select enrollment_id, navigator_person_id from atlas.navigator_assignments where navigator_person_id='<person_id>' and ends_on is null;`
- Confirm enrollment is active in `atlas.enrollments`.

### 4) Supervisor views do not include expected navigators

- Check active supervision links:
  - `select supervisor_person_id, navigator_person_id from atlas.supervisor_navigator_assignments where supervisor_person_id='<person_id>' and ends_on is null;`

### 5) Partner ownership does not resolve

- Check partner contact email:
  - `select id, organization_name, primary_contact_email from atlas.partners where is_active=true and lower(primary_contact_email)=lower('<email>');`

## Rollback snippets

Use these selectively if you need to revert the target user's test identity setup.

```sql
-- Replace with the target person id.
-- 1) End active role assignments for a person.
update atlas.people_role_assignments
set ends_on = current_date, is_primary = false
where person_id = '<person_id>'::uuid
  and ends_on is null;

-- 2) End active navigator assignments for a person.
update atlas.navigator_assignments
set ends_on = current_date
where navigator_person_id = '<person_id>'::uuid
  and ends_on is null;

-- 3) End active supervisor assignments for a person.
update atlas.supervisor_navigator_assignments
set ends_on = current_date
where supervisor_person_id = '<person_id>'::uuid
  and ends_on is null;

-- 4) Remove admin JWT claim (if needed).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'atlas_role'
where lower(email) = lower('kchristianson@ai-designtech.com');
```

## Ongoing maintenance notes

- Keep the migration and live matrix UI logic aligned. If role keys change in `atlas.roles`, update the known role list in `accessMatrixRepository.ts`.
- Keep one active primary role for every active person to avoid ambiguous role defaults in UI and policy checks.
- Matrix writes now use guarded RPC functions (`fn_access_matrix_save_*`). Keep direct table mutation paths disabled for browser clients.
