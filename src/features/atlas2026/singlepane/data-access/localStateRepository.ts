import type {
  AdminPortalRegistry,
  AccountSettings,
  AtlasRole,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  NavigatorProgramState,
  PartnerTroubleshootingGrant,
  RouteAssignmentRecord,
  TimelineConfig
} from '@/features/atlas2026/singlepane/types'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import {
  loadConfigPayloadMapByPrefix,
  loadLatestConfigPayload,
  loadLocalStorageState,
  persistLocalStorageState,
  upsertConfigPayload
} from '@/features/atlas2026/singlepane/data-access/configDocumentPersistence'

/**
 * Single-pane local/config repository.
 *
 * Purpose:
 * - owns normalization + persistence of UI-managed config documents.
 * - keeps localStorage and Supabase writes aligned under a local-first contract.
 */

// Contract constants mirror app_config_documents identity fields so reads/writes
// stay addressable across local-only and Supabase-backed runtime modes.
const SETTINGS_CONFIG_KEY = 'account_settings'
const ENROLLEE_INTAKE_CONFIG_KEY_PREFIX = 'enrollee_intake:'
const ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX = 'route_assignment:'
const TIMELINE_CONFIG_KEY_PREFIX = 'timeline_config:'
const ADMIN_PORTAL_REGISTRY_CONFIG_KEY = 'admin_portal_registry'
const LOCAL_ACCOUNT_SETTINGS_KEY = 'atlas2026.singlepane.account-settings.v2'
const LOCAL_ENROLLEE_INTAKES_KEY = 'atlas2026.singlepane.enrollee-intakes.v2'
const LOCAL_ROUTE_ASSIGNMENTS_KEY = 'atlas2026.singlepane.route-assignments.v2'
const LOCAL_TIMELINE_CONFIGS_KEY = 'atlas2026.singlepane.timeline-configs.v1'
const LOCAL_ADMIN_PORTAL_REGISTRY_KEY = 'atlas2026.singlepane.admin-portal-registry.v1'
const NAVIGATOR_PROGRAM_STATE_CONFIG_KEY = 'navigator_program_state'
const LOCAL_NAVIGATOR_PROGRAM_STATE_KEY = 'atlas2026.singlepane.navigator-program-state.v1'
const PARTNER_TROUBLESHOOTING_GRANT_CONFIG_KEY_PREFIX = 'partner_troubleshooting_grant:'
const LOCAL_PARTNER_TROUBLESHOOTING_GRANTS_KEY = 'atlas2026.singlepane.partner-troubleshooting-grants.v1'
const ALLOW_SENSITIVE_LOCAL_CACHE = import.meta.env.VITE_ALLOW_SENSITIVE_LOCAL_CACHE === 'true'

/**
 * Persistence strategy:
 * - account-level preferences can use localStorage for UX continuity.
 * - sensitive clinical/program payloads are local-cached only when explicitly enabled.
 * - Supabase writes are attempted for all config domains when configured.
 */

function getDefaultAccountSettings(): AccountSettings {
  return {
    fullName: 'atlas operator',
    email: 'operator@atlas.local',
    organization: 'atlas operations',
    avatarUrl: null,
    enabledRoles: ['administrator', 'supervisor', 'partner', 'navigator']
  }
}

function normalizeAccountSettingsPayload(payload: Partial<AccountSettings> | null | undefined) {
  const enabledRoles = Array.isArray(payload?.enabledRoles)
    ? payload!.enabledRoles.filter((role): role is AtlasRole => ['navigator', 'partner', 'supervisor', 'administrator'].includes(String(role)))
    : getDefaultAccountSettings().enabledRoles
  return {
    fullName: payload?.fullName || getDefaultAccountSettings().fullName,
    email: payload?.email || getDefaultAccountSettings().email,
    organization: payload?.organization || getDefaultAccountSettings().organization,
    avatarUrl: typeof payload?.avatarUrl === 'string' ? payload.avatarUrl : null,
    enabledRoles: enabledRoles.length ? enabledRoles : getDefaultAccountSettings().enabledRoles
  } satisfies AccountSettings
}

function loadLocalAccountSettingsState(): AccountSettings {
  return loadLocalStorageState(
    LOCAL_ACCOUNT_SETTINGS_KEY,
    getDefaultAccountSettings(),
    (parsed) => normalizeAccountSettingsPayload(parsed as Partial<AccountSettings>)
  )
}

function persistLocalAccountSettingsState(settings: AccountSettings) {
  persistLocalStorageState(LOCAL_ACCOUNT_SETTINGS_KEY, settings)
}

function loadLocalEnrolleeIntakeState(): Record<string, EnrolleeIntakeRecord> {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return {}
  return loadLocalStorageState(LOCAL_ENROLLEE_INTAKES_KEY, {}, (parsed) => {
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  })
}

function persistLocalEnrolleeIntakeState(state: Record<string, EnrolleeIntakeRecord>) {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return
  persistLocalStorageState(LOCAL_ENROLLEE_INTAKES_KEY, state)
}

function loadLocalRouteAssignmentState(): Record<string, RouteAssignmentRecord> {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return {}
  return loadLocalStorageState(LOCAL_ROUTE_ASSIGNMENTS_KEY, {}, (parsed) => {
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  })
}

function persistLocalRouteAssignmentState(state: Record<string, RouteAssignmentRecord>) {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return
  persistLocalStorageState(LOCAL_ROUTE_ASSIGNMENTS_KEY, state)
}

function loadLocalTimelineConfigState(): Record<string, TimelineConfig> {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return {}
  return loadLocalStorageState(LOCAL_TIMELINE_CONFIGS_KEY, {}, (parsed) => {
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  })
}

function persistLocalTimelineConfigState(state: Record<string, TimelineConfig>) {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return
  persistLocalStorageState(LOCAL_TIMELINE_CONFIGS_KEY, state)
}

function getDefaultAdminPortalRegistry(): AdminPortalRegistry {
  return {
    people: [],
    organizations: [],
    customEnrollees: [],
    archivedPersonIds: [],
    archivedOrganizationIds: [],
    archivedEnrolleeIds: [],
    updatedAtIso: new Date().toISOString()
  }
}

function normalizeAdminPortalRegistry(payload: Partial<AdminPortalRegistry> | null | undefined): AdminPortalRegistry {
  return {
    people: Array.isArray(payload?.people) ? payload!.people.filter(Boolean) : [],
    organizations: Array.isArray(payload?.organizations) ? payload!.organizations.filter(Boolean) : [],
    customEnrollees: Array.isArray(payload?.customEnrollees) ? payload!.customEnrollees.filter(Boolean) : [],
    archivedPersonIds: Array.isArray(payload?.archivedPersonIds)
      ? payload!.archivedPersonIds.map((value) => String(value)).filter(Boolean)
      : [],
    archivedOrganizationIds: Array.isArray(payload?.archivedOrganizationIds)
      ? payload!.archivedOrganizationIds.map((value) => String(value)).filter(Boolean)
      : [],
    archivedEnrolleeIds: Array.isArray(payload?.archivedEnrolleeIds)
      ? payload!.archivedEnrolleeIds.map((value) => String(value)).filter(Boolean)
      : [],
    updatedAtIso: payload?.updatedAtIso || new Date().toISOString()
  }
}

function loadLocalAdminPortalRegistryState(): AdminPortalRegistry {
  return loadLocalStorageState(
    LOCAL_ADMIN_PORTAL_REGISTRY_KEY,
    getDefaultAdminPortalRegistry(),
    (parsed) => normalizeAdminPortalRegistry(parsed as Partial<AdminPortalRegistry>)
  )
}

function persistLocalAdminPortalRegistryState(registry: AdminPortalRegistry) {
  persistLocalStorageState(LOCAL_ADMIN_PORTAL_REGISTRY_KEY, registry)
}

function getDefaultNavigatorProgramState(): NavigatorProgramState {
  return {
    pickupQueue: [],
    selfAssessments: [],
    supervisionSessions: [],
    intervalAssessmentRules: [],
    updatedAtIso: new Date().toISOString()
  }
}

function normalizeNavigatorProgramState(payload: Partial<NavigatorProgramState> | null | undefined): NavigatorProgramState {
  return {
    pickupQueue: Array.isArray(payload?.pickupQueue) ? payload!.pickupQueue.filter(Boolean) : [],
    selfAssessments: Array.isArray(payload?.selfAssessments) ? payload!.selfAssessments.filter(Boolean) : [],
    supervisionSessions: Array.isArray(payload?.supervisionSessions) ? payload!.supervisionSessions.filter(Boolean) : [],
    intervalAssessmentRules: Array.isArray(payload?.intervalAssessmentRules) ? payload!.intervalAssessmentRules.filter(Boolean) : [],
    updatedAtIso: payload?.updatedAtIso || new Date().toISOString()
  }
}

function loadLocalNavigatorProgramState(): NavigatorProgramState {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return getDefaultNavigatorProgramState()
  return loadLocalStorageState(
    LOCAL_NAVIGATOR_PROGRAM_STATE_KEY,
    getDefaultNavigatorProgramState(),
    (parsed) => normalizeNavigatorProgramState(parsed as Partial<NavigatorProgramState>)
  )
}

function persistLocalNavigatorProgramState(state: NavigatorProgramState) {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return
  persistLocalStorageState(LOCAL_NAVIGATOR_PROGRAM_STATE_KEY, state)
}

function normalizePartnerTroubleshootingGrant(
  payload: Partial<PartnerTroubleshootingGrant> | null | undefined,
  partnerId: string
): PartnerTroubleshootingGrant {
  return {
    partnerId,
    organizationName: payload?.organizationName?.trim() || '',
    allowedMenus: Array.isArray(payload?.allowedMenus) ? payload!.allowedMenus.map((value) => String(value)).filter(Boolean) : [],
    allowWrite: Boolean(payload?.allowWrite),
    updatedAtIso: payload?.updatedAtIso || new Date().toISOString()
  }
}

function loadLocalPartnerTroubleshootingGrantState(): Record<string, PartnerTroubleshootingGrant> {
  return loadLocalStorageState(LOCAL_PARTNER_TROUBLESHOOTING_GRANTS_KEY, {}, (parsed) => {
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, Partial<PartnerTroubleshootingGrant>>).map(([partnerId, payload]) => [
        partnerId,
        normalizePartnerTroubleshootingGrant(payload, partnerId)
      ])
    )
  })
}

function persistLocalPartnerTroubleshootingGrantState(state: Record<string, PartnerTroubleshootingGrant>) {
  persistLocalStorageState(LOCAL_PARTNER_TROUBLESHOOTING_GRANTS_KEY, state)
}

export function applyIntakeOverrides(enrollees: EnrolleeProfile[], intakeOverrides: Record<string, EnrolleeIntakeRecord>) {
  return enrollees.map((enrollee) => {
    const intake = intakeOverrides[enrollee.id]
    if (!intake) return enrollee
    return {
      ...enrollee,
      fullName: intake.fullName,
      dob: intake.dob,
      caseId: intake.caseId,
      email: intake.email,
      assignedNavigator: intake.assignedNavigator,
      zCodeTags: intake.zCodeTags
    }
  })
}

export async function loadAccountSettings(): Promise<AccountSettings> {
  const { payload, error } = await loadLatestConfigPayload<Partial<AccountSettings>>(SETTINGS_CONFIG_KEY)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalAccountSettingsState()
    throw error
  }
  const normalized = normalizeAccountSettingsPayload(payload)
  persistLocalAccountSettingsState(normalized)
  return normalized
}

export async function saveAccountSettings(settings: AccountSettings): Promise<AccountSettings> {
  const normalized = normalizeAccountSettingsPayload(settings)
  persistLocalAccountSettingsState(normalized)
  const error = await upsertConfigPayload(SETTINGS_CONFIG_KEY, normalized)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return normalized
    throw error
  }
  return normalized
}

export async function loadPartnerTroubleshootingGrants(): Promise<Record<string, PartnerTroubleshootingGrant>> {
  const { rows: data, error } = await loadConfigPayloadMapByPrefix<PartnerTroubleshootingGrant>(PARTNER_TROUBLESHOOTING_GRANT_CONFIG_KEY_PREFIX)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalPartnerTroubleshootingGrantState()
    throw error
  }
  const normalized = Object.fromEntries(
    (data || [])
      .map((row: { config_key?: string; payload?: unknown }) => {
        const partnerId = row.config_key?.replace(PARTNER_TROUBLESHOOTING_GRANT_CONFIG_KEY_PREFIX, '')
        if (!partnerId) return null
        return [partnerId, normalizePartnerTroubleshootingGrant(row.payload as Partial<PartnerTroubleshootingGrant>, partnerId)] as const
      })
      .filter((entry): entry is readonly [string, PartnerTroubleshootingGrant] => Boolean(entry))
  )
  persistLocalPartnerTroubleshootingGrantState(normalized)
  return normalized
}

export async function savePartnerTroubleshootingGrant(grant: PartnerTroubleshootingGrant): Promise<PartnerTroubleshootingGrant> {
  const normalized = normalizePartnerTroubleshootingGrant(grant, grant.partnerId)
  persistLocalPartnerTroubleshootingGrantState({
    ...loadLocalPartnerTroubleshootingGrantState(),
    [normalized.partnerId]: normalized
  })
  const error = await upsertConfigPayload(`${PARTNER_TROUBLESHOOTING_GRANT_CONFIG_KEY_PREFIX}${normalized.partnerId}`, normalized)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return normalized
    throw error
  }
  return normalized
}

export async function loadEnrolleeIntakes(): Promise<Record<string, EnrolleeIntakeRecord>> {
  const { rows: data, error } = await loadConfigPayloadMapByPrefix<EnrolleeIntakeRecord>(ENROLLEE_INTAKE_CONFIG_KEY_PREFIX)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalEnrolleeIntakeState()
    throw error
  }
  const normalized = Object.fromEntries(
    (data || [])
      .map((row: { config_key?: string; payload?: unknown }) => {
        const key = row.config_key?.replace(ENROLLEE_INTAKE_CONFIG_KEY_PREFIX, '')
        const payload = row.payload as EnrolleeIntakeRecord | null
        if (!key || !payload) return null
        return [key, payload] as const
      })
      .filter((entry): entry is readonly [string, EnrolleeIntakeRecord] => Boolean(entry))
  )
  persistLocalEnrolleeIntakeState(normalized)
  return normalized
}

// Intake/route/timeline writes optionally update local cache first when enabled
// for controlled non-production/offline workflows.
export async function saveEnrolleeIntake(intake: EnrolleeIntakeRecord): Promise<EnrolleeIntakeRecord> {
  persistLocalEnrolleeIntakeState({
    ...loadLocalEnrolleeIntakeState(),
    [intake.enrolleeId]: intake
  })
  const error = await upsertConfigPayload(`${ENROLLEE_INTAKE_CONFIG_KEY_PREFIX}${intake.enrolleeId}`, intake)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return intake
    throw error
  }
  return intake
}

export async function loadRouteAssignments(): Promise<Record<string, RouteAssignmentRecord>> {
  const { rows: data, error } = await loadConfigPayloadMapByPrefix<RouteAssignmentRecord>(ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalRouteAssignmentState()
    throw error
  }
  const normalized = Object.fromEntries(
    (data || [])
      .map((row: { config_key?: string; payload?: unknown }) => {
        const key = row.config_key?.replace(ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX, '')
        const payload = row.payload as RouteAssignmentRecord | null
        if (!key || !payload) return null
        return [key, payload] as const
      })
      .filter((entry): entry is readonly [string, RouteAssignmentRecord] => Boolean(entry))
  )
  persistLocalRouteAssignmentState(normalized)
  return normalized
}

export async function saveRouteAssignment(assignment: RouteAssignmentRecord): Promise<RouteAssignmentRecord> {
  persistLocalRouteAssignmentState({
    ...loadLocalRouteAssignmentState(),
    [assignment.enrolleeId]: assignment
  })
  const error = await upsertConfigPayload(`${ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX}${assignment.enrolleeId}`, assignment)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return assignment
    throw error
  }
  return assignment
}

export async function loadTimelineConfigs(): Promise<Record<string, TimelineConfig>> {
  const { rows: data, error } = await loadConfigPayloadMapByPrefix<TimelineConfig>(TIMELINE_CONFIG_KEY_PREFIX)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalTimelineConfigState()
    throw error
  }
  const normalized = Object.fromEntries(
    (data || [])
      .map((row: { config_key?: string; payload?: unknown }) => {
        const key = row.config_key?.replace(TIMELINE_CONFIG_KEY_PREFIX, '')
        const payload = row.payload as TimelineConfig | null
        if (!key || !payload) return null
        return [key, payload] as const
      })
      .filter((entry): entry is readonly [string, TimelineConfig] => Boolean(entry))
  )
  persistLocalTimelineConfigState(normalized)
  return normalized
}

function buildTimelineConfigKeys(enrolleeId: string, enrollmentId?: string | null) {
  // Keep both key variants in sync so migrations between enrollment-scoped and
  // enrollee-scoped lookups can read the same timeline configuration.
  const keys = [`enrollee:${enrolleeId}`]
  if (enrollmentId?.trim()) {
    keys.unshift(`enrollment:${enrollmentId.trim()}`)
  }
  return keys
}

export async function saveTimelineConfig(
  ids: { enrolleeId: string; enrollmentId?: string | null },
  config: TimelineConfig
): Promise<TimelineConfig> {
  const keys = buildTimelineConfigKeys(ids.enrolleeId, ids.enrollmentId)
  const nextLocalState = {
    ...loadLocalTimelineConfigState()
  }
  for (const key of keys) {
    nextLocalState[key] = config
  }
  persistLocalTimelineConfigState(nextLocalState)

  // Persist each addressable key to keep reads consistent regardless of which
  // identifier a caller currently has available.
  for (const key of keys) {
    const error = await upsertConfigPayload(`${TIMELINE_CONFIG_KEY_PREFIX}${key}`, config)
    if (error) {
      if (isOptionalSupabaseDataError(error)) return config
      throw error
    }
  }
  return config
}

export async function loadAdminPortalRegistry(): Promise<AdminPortalRegistry> {
  const { payload, error } = await loadLatestConfigPayload<Partial<AdminPortalRegistry>>(ADMIN_PORTAL_REGISTRY_CONFIG_KEY)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalAdminPortalRegistryState()
    throw error
  }

  const normalized = normalizeAdminPortalRegistry(payload)
  persistLocalAdminPortalRegistryState(normalized)
  return normalized
}

export async function saveAdminPortalRegistry(registry: AdminPortalRegistry): Promise<AdminPortalRegistry> {
  const normalized = normalizeAdminPortalRegistry({
    ...registry,
    updatedAtIso: new Date().toISOString()
  })
  persistLocalAdminPortalRegistryState(normalized)
  const error = await upsertConfigPayload(ADMIN_PORTAL_REGISTRY_CONFIG_KEY, normalized)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return normalized
    throw error
  }
  return normalized
}

export async function loadNavigatorProgramState(): Promise<NavigatorProgramState> {
  const { payload, error } = await loadLatestConfigPayload<Partial<NavigatorProgramState>>(NAVIGATOR_PROGRAM_STATE_CONFIG_KEY)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalNavigatorProgramState()
    throw error
  }

  const normalized = normalizeNavigatorProgramState(payload)
  persistLocalNavigatorProgramState(normalized)
  return normalized
}

export async function saveNavigatorProgramState(state: NavigatorProgramState): Promise<NavigatorProgramState> {
  const normalized = normalizeNavigatorProgramState({
    ...state,
    updatedAtIso: new Date().toISOString()
  })
  // Updated timestamp is owned by persistence boundary to prevent clients from
  // accidentally writing stale metadata.
  persistLocalNavigatorProgramState(normalized)
  const error = await upsertConfigPayload(NAVIGATOR_PROGRAM_STATE_CONFIG_KEY, normalized)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return normalized
    throw error
  }
  return normalized
}
