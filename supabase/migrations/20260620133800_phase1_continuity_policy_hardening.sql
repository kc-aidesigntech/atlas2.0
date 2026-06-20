-- Phase 1 continuity hardening:
-- 1) tighten atlas.app_config_documents write scope (no blanket authenticated all-write)
-- 2) allow staff status updates for canonical referral intake events

alter table atlas.app_config_documents enable row level security;

drop policy if exists app_config_documents_authenticated_all on atlas.app_config_documents;
drop policy if exists app_config_documents_authenticated_select on atlas.app_config_documents;
drop policy if exists app_config_documents_admin_write on atlas.app_config_documents;
drop policy if exists app_config_documents_singlepane_scoped_insert on atlas.app_config_documents;
drop policy if exists app_config_documents_singlepane_scoped_update on atlas.app_config_documents;

create policy app_config_documents_authenticated_select
  on atlas.app_config_documents
  for select
  to authenticated
  using (true);

create policy app_config_documents_admin_write
  on atlas.app_config_documents
  for all
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') = 'administrator');

create policy app_config_documents_singlepane_scoped_insert
  on atlas.app_config_documents
  for insert
  to authenticated
  with check (
    surface = 'singlepane'
    and version = 'runtime-v1'
    and (
      config_key = 'route_logs'
      or config_key = 'navigator_program_state'
      or config_key = 'regulation_review_settings'
      or config_key like 'account_settings%'
      or config_key like 'enrollee_intake:%'
      or config_key like 'route_assignment:%'
      or config_key like 'timeline_config:%'
      or config_key like 'partner_troubleshooting_grant:%'
      or config_key = 'admin_portal_registry'
    )
  );

create policy app_config_documents_singlepane_scoped_update
  on atlas.app_config_documents
  for update
  to authenticated
  using (
    surface = 'singlepane'
    and version = 'runtime-v1'
    and (
      config_key = 'route_logs'
      or config_key = 'navigator_program_state'
      or config_key = 'regulation_review_settings'
      or config_key like 'account_settings%'
      or config_key like 'enrollee_intake:%'
      or config_key like 'route_assignment:%'
      or config_key like 'timeline_config:%'
      or config_key like 'partner_troubleshooting_grant:%'
      or config_key = 'admin_portal_registry'
    )
  )
  with check (
    surface = 'singlepane'
    and version = 'runtime-v1'
    and (
      config_key = 'route_logs'
      or config_key = 'navigator_program_state'
      or config_key = 'regulation_review_settings'
      or config_key like 'account_settings%'
      or config_key like 'enrollee_intake:%'
      or config_key like 'route_assignment:%'
      or config_key like 'timeline_config:%'
      or config_key like 'partner_troubleshooting_grant:%'
      or config_key = 'admin_portal_registry'
    )
  );

alter table atlas.public_referral_intake_events enable row level security;
drop policy if exists public_referral_intake_events_update_staff on atlas.public_referral_intake_events;
create policy public_referral_intake_events_update_staff
  on atlas.public_referral_intake_events
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') in ('administrator', 'navigator', 'supervisor')
    and source = 'public_landing'
    and event_type in ('referral', 'partner_inquiry')
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'atlas_role', '') in ('administrator', 'navigator', 'supervisor')
    and source = 'public_landing'
    and event_type in ('referral', 'partner_inquiry')
  );

grant update on atlas.public_referral_intake_events to authenticated;

notify pgrst, 'reload schema';
