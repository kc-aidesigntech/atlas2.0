-- Security hardening Phase 3 (assignment tables): scoped-read Row-Level Security
-- (RLS) on the navigator and supervisor assignment tables.
--
-- Before this change both tables had RLS DISABLED while still granting SELECT to
-- the authenticated role, so any signed-in user could read every navigator <->
-- enrollment and supervisor <-> navigator relationship in the system. Writes are
-- already RPC-only (no direct INSERT/UPDATE/DELETE grant; assignment mutations go
-- through the SECURITY DEFINER fn_navigator_assign_* / supervisor RPCs), so this
-- migration only constrains reads.
--
-- Safe to enable: atlas.fn_can_access_enrollment_as_staff and
-- atlas.fn_current_person_id are SECURITY DEFINER, so their internal reads of
-- these tables run as the function owner and are NOT subject to these policies
-- (no policy recursion). The administrator branch keeps the full assignment-board
-- views (which are security_invoker) working for administrators, while navigators
-- and supervisors are scoped to the relationships they participate in.

-- Navigator assignments: administrators see all; the assigned navigator sees their
-- own rows; any staff member who can access the linked enrollment (the navigator
-- or a supervisor over that navigator) sees the row.
alter table atlas.navigator_assignments enable row level security;
drop policy if exists navigator_assignments_select_scoped on atlas.navigator_assignments;
create policy navigator_assignments_select_scoped on atlas.navigator_assignments
  for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or navigator_person_id = atlas.fn_current_person_id()
    or atlas.fn_can_access_enrollment_as_staff(enrollment_id)
  );

-- Supervisor <-> navigator assignments: administrators see all; the supervisor and
-- the supervised navigator can each see the rows that link them.
alter table atlas.supervisor_navigator_assignments enable row level security;
drop policy if exists supervisor_navigator_assignments_select_scoped on atlas.supervisor_navigator_assignments;
create policy supervisor_navigator_assignments_select_scoped on atlas.supervisor_navigator_assignments
  for select to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator'
    or supervisor_person_id = atlas.fn_current_person_id()
    or navigator_person_id = atlas.fn_current_person_id()
  );
