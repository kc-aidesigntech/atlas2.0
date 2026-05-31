-- Security hardening Phase 1 of 4: restore core-domain visibility under
-- Row-Level Security (RLS).
--
-- Background: the canonical reporting views (v_active_enrollment_roster,
-- v_active_navigator_assignment_edges, ...) are declared security_invoker, so
-- they read base tables AS the calling role. Those base tables
-- (enrollments/enrollees/people/partner_stations) had RLS enabled with an
-- administrator-only policy and NO SELECT grant to the "authenticated" role.
-- Net effect: every non-admin (navigator/supervisor/partner) received a
-- permission error or zero rows, which the frontend silently swallowed -- the
-- reported "assigned enrollee is missing from the dropdown" bug.
--
-- Scoping intentionally uses the existing SECURITY DEFINER helpers, which key
-- off the signed-in person (auth.uid() -> atlas.people.external_ref) and the
-- assignment tables rather than the JSON Web Token (JWT) atlas_role claim
-- (atlas_role is frequently null for staff accounts):
--   atlas.fn_can_access_enrollment_as_staff(enrollment_id)
--   atlas.fn_current_person_id()

-- Base-table SELECT grants the security_invoker views depend on.
grant select on atlas.enrollments to authenticated;
grant select on atlas.enrollees to authenticated;
grant select on atlas.people to authenticated;
grant select on atlas.partner_stations to authenticated;
grant select on atlas.counties to authenticated;

-- Enrollments: staff read only the enrollments they are assigned to. The
-- pre-existing enrollments_admin_all policy continues to cover administrators.
drop policy if exists enrollments_staff_select on atlas.enrollments;
create policy enrollments_staff_select on atlas.enrollments
  for select to authenticated
  using (atlas.fn_can_access_enrollment_as_staff(id));

-- Enrollees: visible when the caller can access at least one of the enrollee's
-- enrollments.
drop policy if exists enrollees_staff_select on atlas.enrollees;
create policy enrollees_staff_select on atlas.enrollees
  for select to authenticated
  using (
    exists (
      select 1
      from atlas.enrollments en
      where en.enrollee_id = enrollees.id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  );

-- People: staff directory rows (person_type = 'staff') are low-sensitivity and
-- required by assignment boards/directories, so they stay readable by any
-- authenticated user. Enrollee/client Protected Health Information (PHI) rows
-- are restricted to the person themselves or to staff who can access an
-- enrollment for that person.
drop policy if exists people_directory_select on atlas.people;
create policy people_directory_select on atlas.people
  for select to authenticated
  using (
    person_type = 'staff'
    or id = atlas.fn_current_person_id()
    or exists (
      select 1
      from atlas.enrollees e
      join atlas.enrollments en on en.enrollee_id = e.id
      where e.person_id = people.id
        and atlas.fn_can_access_enrollment_as_staff(en.id)
    )
  );

-- Partner stations are non-PHI operational/directory data needed across all
-- partners for route ranking; readable by any authenticated user.
drop policy if exists partner_stations_authenticated_select on atlas.partner_stations;
create policy partner_stations_authenticated_select on atlas.partner_stations
  for select to authenticated
  using (true);

-- Enrollee Z-codes carry sensitive social-need data. Enable RLS scoped to staff
-- with enrollment access (administrators via the role claim). Reads and intake
-- inserts run directly from the app; resolution updates go through the
-- fn_set_enrollee_z_code_resolution* SECURITY DEFINER RPCs, so no UPDATE/DELETE
-- grant is issued here.
alter table atlas.enrollee_z_codes enable row level security;

drop policy if exists enrollee_z_codes_staff_select on atlas.enrollee_z_codes;
create policy enrollee_z_codes_staff_select on atlas.enrollee_z_codes
  for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  );

drop policy if exists enrollee_z_codes_staff_insert on atlas.enrollee_z_codes;
create policy enrollee_z_codes_staff_insert on atlas.enrollee_z_codes
  for insert to authenticated
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  );

grant select, insert on atlas.enrollee_z_codes to authenticated;
