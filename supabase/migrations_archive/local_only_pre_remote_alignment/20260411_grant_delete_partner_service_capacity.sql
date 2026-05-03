-- Temporary delete access for partner service-capacity workflows.
-- Intended as an interim step until user/role/permission and exception-based
-- authorization is enforced at the database policy layer.

grant delete on table atlas.partner_service_capacity_submissions to anon, authenticated;
grant delete on table atlas.partner_service_capacity_answers to anon, authenticated;
grant delete on table atlas.partner_z_code_burden_scores to anon, authenticated;
