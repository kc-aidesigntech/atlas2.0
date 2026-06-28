-- Restore authenticated read access for role key lookups used by the
-- admin access-matrix bootstrap flow.
grant select on table atlas.roles to authenticated;
