-- Tier permission seed.
--
-- Permission keys for the seven Residency tiers (t1 … t4plus) are inserted
-- into atlas.permissions and granted to tier roles through
-- atlas.role_permissions. warmline_agent.access keeps its name; it was seeded
-- for administrator / supervisor in 20260817120000 and those role rows no
-- longer exist, so the tier rows are added here. partner keeps
-- partner_capacity_submissions.read / .write; t4plus receives all three
-- partner_capacity_submissions keys.
--
-- Every insert is idempotent (on conflict do nothing). Role rows for the tiers
-- come from 20261104190000_tier_roles.sql.
--
-- A Remote Procedure Call (RPC) atlas.fn_my_permissions() returns the keys the
-- caller holds so screens gate on permission keys instead of role literals.

-- ---------------------------------------------------------------------------
-- Permission keys.
-- ---------------------------------------------------------------------------

-- Inserts each tier permission key with its description; existing keys are left as they are.
insert into atlas.permissions (permission_key, description)
values
  ('referral.submit', 'Submit a referral into the public referral intake.'),
  ('sponsorship.receive', 'Be named as the sponsored person on a sponsorship.'),
  ('sponsorship.give', 'Sponsor another person: create a sponsorship as the sponsor.'),
  ('wallet.access', 'Open My Wallet: tier identity, badge, ribbon, and wallet sections.'),
  ('competency_cards.view', 'View earned competency cards in the wallet.'),
  ('supervision.receive', 'Appear on a supervisor roster and receive competency assessments.'),
  ('supervision.give', 'Claim navigators onto a roster and record competency assessments.'),
  ('leads.engage', 'View the leads pipeline and take the engage action on a lead.'),
  ('respite_shifts.take', 'Take and view respite shifts.'),
  ('enrollee_profile.write', 'Edit enrollee profile fields.'),
  ('regulation_variables.write', 'Record MH-SCA / SVS regulation variables on an enrollee.'),
  ('pickup.claim', 'Claim an item from the pickup queue.'),
  ('route_plan.write', 'Create and append steps to route plans.'),
  ('z_burden.resolve', 'Resolve a partner Z-code burden score.'),
  ('secondment_schedule.view', 'View the secondment schedule.'),
  ('partner_profile.write', 'Edit partner station profiles.'),
  ('partner_milestones.write', 'Confirm and edit partner milestones.'),
  ('heatmap.view', 'View the county Z-code heat map.'),
  ('heatmap.toggle', 'Toggle the county heat map on and off for the workspace.')
on conflict (permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Role grants per tier.
-- ---------------------------------------------------------------------------

-- Inserts one role_permissions row per (tier, key) pair below; pairs already present are skipped.
insert into atlas.role_permissions (role_id, permission_id)
select r.id, p.id
from (
  values
    -- referral.submit: all seven tiers
    ('t1', 'referral.submit'),
    ('t2', 'referral.submit'),
    ('t2b', 'referral.submit'),
    ('t3', 'referral.submit'),
    ('t3a', 'referral.submit'),
    ('t4', 'referral.submit'),
    ('t4plus', 'referral.submit'),
    -- sponsorship.receive: t1, t2
    ('t1', 'sponsorship.receive'),
    ('t2', 'sponsorship.receive'),
    -- sponsorship.give: t2b and above
    ('t2b', 'sponsorship.give'),
    ('t3', 'sponsorship.give'),
    ('t3a', 'sponsorship.give'),
    ('t4', 'sponsorship.give'),
    ('t4plus', 'sponsorship.give'),
    -- wallet.access: t2 and above
    ('t2', 'wallet.access'),
    ('t2b', 'wallet.access'),
    ('t3', 'wallet.access'),
    ('t3a', 'wallet.access'),
    ('t4', 'wallet.access'),
    ('t4plus', 'wallet.access'),
    -- competency_cards.view: t2 and above
    ('t2', 'competency_cards.view'),
    ('t2b', 'competency_cards.view'),
    ('t3', 'competency_cards.view'),
    ('t3a', 'competency_cards.view'),
    ('t4', 'competency_cards.view'),
    ('t4plus', 'competency_cards.view'),
    -- supervision.receive: t2 and above
    ('t2', 'supervision.receive'),
    ('t2b', 'supervision.receive'),
    ('t3', 'supervision.receive'),
    ('t3a', 'supervision.receive'),
    ('t4', 'supervision.receive'),
    ('t4plus', 'supervision.receive'),
    -- supervision.give: t4, t4plus
    ('t4', 'supervision.give'),
    ('t4plus', 'supervision.give'),
    -- leads.engage: t2b, t3a, t4, t4plus
    ('t2b', 'leads.engage'),
    ('t3a', 'leads.engage'),
    ('t4', 'leads.engage'),
    ('t4plus', 'leads.engage'),
    -- warmline_agent.access (name kept): t2b, t3a, t4, t4plus
    ('t2b', 'warmline_agent.access'),
    ('t3a', 'warmline_agent.access'),
    ('t4', 'warmline_agent.access'),
    ('t4plus', 'warmline_agent.access'),
    -- respite_shifts.take: t2b, t3a, t4, t4plus
    ('t2b', 'respite_shifts.take'),
    ('t3a', 'respite_shifts.take'),
    ('t4', 'respite_shifts.take'),
    ('t4plus', 'respite_shifts.take'),
    -- enrollee_profile.write: t2b, t3a, t4, t4plus
    ('t2b', 'enrollee_profile.write'),
    ('t3a', 'enrollee_profile.write'),
    ('t4', 'enrollee_profile.write'),
    ('t4plus', 'enrollee_profile.write'),
    -- regulation_variables.write: t2b, t3a, t4, t4plus
    ('t2b', 'regulation_variables.write'),
    ('t3a', 'regulation_variables.write'),
    ('t4', 'regulation_variables.write'),
    ('t4plus', 'regulation_variables.write'),
    -- pickup.claim, route_plan.write, z_burden.resolve: t3a
    ('t3a', 'pickup.claim'),
    ('t3a', 'route_plan.write'),
    ('t3a', 'z_burden.resolve'),
    -- secondment_schedule.view: t3
    ('t3', 'secondment_schedule.view'),
    -- partner_profile.write, partner_milestones.write, heatmap.view, heatmap.toggle: t4plus
    ('t4plus', 'partner_profile.write'),
    ('t4plus', 'partner_milestones.write'),
    ('t4plus', 'heatmap.view'),
    ('t4plus', 'heatmap.toggle'),
    -- partner_capacity_submissions.read / .write: partner keeps the two keys it
    -- already holds (no-op rows); .delete is not granted to partner here. All
    -- three keys are granted to t4plus.
    ('partner', 'partner_capacity_submissions.read'),
    ('partner', 'partner_capacity_submissions.write'),
    ('t4plus', 'partner_capacity_submissions.read'),
    ('t4plus', 'partner_capacity_submissions.write'),
    ('t4plus', 'partner_capacity_submissions.delete')
) as grant_row(role_key, permission_key)
join atlas.roles r on r.role_key = grant_row.role_key
join atlas.permissions p on p.permission_key = grant_row.permission_key
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------------
-- fn_my_permissions: the caller's permission keys.
-- ---------------------------------------------------------------------------

-- Returns every permission_key when atlas.fn_is_system_admin() is true;
-- otherwise returns each atlas.permissions key for which
-- atlas.fn_has_permission(key) is true (role grants plus allow / deny
-- exceptions in atlas.user_permission_exceptions).
create or replace function atlas.fn_my_permissions()
returns setof text
language plpgsql
stable
security definer
set search_path = atlas, public
as $$
begin
  if atlas.fn_is_system_admin() then
    return query
      select p.permission_key
      from atlas.permissions p
      order by p.permission_key;
    return;
  end if;

  return query
    select p.permission_key
    from atlas.permissions p
    where atlas.fn_has_permission(p.permission_key)
    order by p.permission_key;
end;
$$;

comment on function atlas.fn_my_permissions() is
  'Returns the permission keys the signed-in Atlas identity holds: every key for a system administrator (atlas.fn_is_system_admin()), otherwise each atlas.permissions key for which atlas.fn_has_permission(key) is true. Screens gate on these keys instead of role literals.';

revoke all on function atlas.fn_my_permissions() from public;
grant execute on function atlas.fn_my_permissions() to authenticated;
