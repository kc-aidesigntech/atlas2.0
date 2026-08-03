-- The navigator My Profile workflow tables shipped with Row-Level Security (RLS)
-- policies for `authenticated`, but without table GRANTs. PostgREST then returns
-- HTTP 403 / Postgres 42501 ("permission denied for table ...") before RLS runs.
-- Restore staff read/write so IPSCC, IPS self-assessments, supervisor IPS, and
-- C.R.E.A.T.E. session APIs can load for signed-in operators.

grant select, insert, update, delete on table atlas.navigator_ipscc_encounter_submissions to authenticated;
grant select, insert, update, delete on table atlas.navigator_ips_self_assessments to authenticated;
grant select, insert, update, delete on table atlas.supervisor_ips_assessments to authenticated;
grant select, insert, update, delete on table atlas.navigator_create_sessions to authenticated;
