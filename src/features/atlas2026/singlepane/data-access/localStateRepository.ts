import type {
  AdminPortalRegistry,
  AccountSettings,
  AtlasRole,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  NavigatorProgramState,
  RouteAssignmentRecord,
  TimelineConfig
} from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const SETTINGS_CONFIG_KEY = 'account_settings'
const ENROLLEE_INTAKE_CONFIG_KEY_PREFIX = 'enrollee_intake:'
const ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX = 'route_assignment:'
const TIMELINE_CONFIG_KEY_PREFIX = 'timeline_config:'
const ADMIN_PORTAL_REGISTRY_CONFIG_KEY = 'admin_portal_registry'
const CONFIG_SURFACE = 'singlepane'
const CONFIG_VERSION = 'runtime-v1'
const LOCAL_ACCOUNT_SETTINGS_KEY = 'atlas2026.singlepane.account-settings.v2'
const LOCAL_ENROLLEE_INTAKES_KEY = 'atlas2026.singlepane.enrollee-intakes.v2'
const LOCAL_ROUTE_ASSIGNMENTS_KEY = 'atlas2026.singlepane.route-assignments.v2'
const LOCAL_TIMELINE_CONFIGS_KEY = 'atlas2026.singlepane.timeline-configs.v1'
const LOCAL_ADMIN_PORTAL_REGISTRY_KEY = 'atlas2026.singlepane.admin-portal-registry.v1'
const NAVIGATOR_PROGRAM_STATE_CONFIG_KEY = 'navigator_program_state'
const LOCAL_NAVIGATOR_PROGRAM_STATE_KEY = 'atlas2026.singlepane.navigator-program-state.v1'

function getDefaultAccountSettings(): AccountSettings {
  return {
    fullName: 'atlas operator',
    email: 'operator@atlas.local',
    organization: 'atlas operations',
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
    enabledRoles: enabledRoles.length ? enabledRoles : getDefaultAccountSettings().enabledRoles
  } satisfies AccountSettings
}

function loadLocalAccountSettingsState(): AccountSettings {
  if (typeof window === 'undefined') return getDefaultAccountSettings()
  const raw = window.localStorage.getItem(LOCAL_ACCOUNT_SETTINGS_KEY)
  if (!raw) return getDefaultAccountSettings()
  try {
    return normalizeAccountSettingsPayload(JSON.parse(raw) as Partial<AccountSettings>)
  } catch {
    return getDefaultAccountSettings()
  }
}

function persistLocalAccountSettingsState(settings: AccountSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_ACCOUNT_SETTINGS_KEY, JSON.stringify(settings))
}

function loadLocalEnrolleeIntakeState(): Record<string, EnrolleeIntakeRecord> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(LOCAL_ENROLLEE_INTAKES_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, EnrolleeIntakeRecord>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persistLocalEnrolleeIntakeState(state: Record<string, EnrolleeIntakeRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_ENROLLEE_INTAKES_KEY, JSON.stringify(state))
}

function loadLocalRouteAssignmentState(): Record<string, RouteAssignmentRecord> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(LOCAL_ROUTE_ASSIGNMENTS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, RouteAssignmentRecord>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persistLocalRouteAssignmentState(state: Record<string, RouteAssignmentRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_ROUTE_ASSIGNMENTS_KEY, JSON.stringify(state))
}

function loadLocalTimelineConfigState(): Record<string, TimelineConfig> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(LOCAL_TIMELINE_CONFIGS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, TimelineConfig>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persistLocalTimelineConfigState(state: Record<string, TimelineConfig>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_TIMELINE_CONFIGS_KEY, JSON.stringify(state))
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
  if (typeof window === 'undefined') return getDefaultAdminPortalRegistry()
  const raw = window.localStorage.getItem(LOCAL_ADMIN_PORTAL_REGISTRY_KEY)
  if (!raw) return getDefaultAdminPortalRegistry()
  try {
    return normalizeAdminPortalRegistry(JSON.parse(raw) as Partial<AdminPortalRegistry>)
  } catch {
    return getDefaultAdminPortalRegistry()
  }
}

function persistLocalAdminPortalRegistryState(registry: AdminPortalRegistry) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_ADMIN_PORTAL_REGISTRY_KEY, JSON.stringify(registry))
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
  if (typeof window === 'undefined') return getDefaultNavigatorProgramState()
  const raw = window.localStorage.getItem(LOCAL_NAVIGATOR_PROGRAM_STATE_KEY)
  if (!raw) return getDefaultNavigatorProgramState()
  try {
    return normalizeNavigatorProgramState(JSON.parse(raw) as Partial<NavigatorProgramState>)
  } catch {
    return getDefaultNavigatorProgramState()
  }
}

function persistLocalNavigatorProgramState(state: NavigatorProgramState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_NAVIGATOR_PROGRAM_STATE_KEY, JSON.stringify(state))
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
  if (!hasSupabaseConfig || !supabase) return loadLocalAccountSettingsState()
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('payload')
    .eq('surface', CONFIG_SURFACE)
    .eq('config_key', SETTINGS_CONFIG_KEY)
    .eq('version', CONFIG_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalAccountSettingsState()
    throw error
  }
  const payload = (data?.[0]?.payload || null) as Partial<AccountSettings> | null
  const normalized = normalizeAccountSettingsPayload(payload)
  persistLocalAccountSettingsState(normalized)
  return normalized
}

export async function saveAccountSettings(settings: AccountSettings): Promise<AccountSettings> {
  const normalized = normalizeAccountSettingsPayload(settings)
  persistLocalAccountSettingsState(normalized)
  if (!hasSupabaseConfig || !supabase) {
    return normalized
  }
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .upsert(
      {
        surface: CONFIG_SURFACE,
        config_key: SETTINGS_CONFIG_KEY,
        version: CONFIG_VERSION,
        payload: normalized
      },
      { onConflict: 'surface,config_key,version' }
    )
  if (error) {
    if (isOptionalSupabaseDataError(error)) return normalized
    throw error
  }
  return normalized
}

export async function loadEnrolleeIntakes(): Promise<Record<string, EnrolleeIntakeRecord>> {
  if (!hasSupabaseConfig || !supabase) return loadLocalEnrolleeIntakeState()
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('config_key,payload')
    .eq('surface', CONFIG_SURFACE)
    .eq('version', CONFIG_VERSION)
    .like('config_key', `${ENROLLEE_INTAKE_CONFIG_KEY_PREFIX}%`)

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

export async function saveEnrolleeIntake(intake: EnrolleeIntakeRecord): Promise<EnrolleeIntakeRecord> {
  persistLocalEnrolleeIntakeState({
    ...loadLocalEnrolleeIntakeState(),
    [intake.enrolleeId]: intake
  })
  if (!hasSupabaseConfig || !supabase) {
    return intake
  }
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .upsert(
      {
        surface: CONFIG_SURFACE,
        config_key: `${ENROLLEE_INTAKE_CONFIG_KEY_PREFIX}${intake.enrolleeId}`,
        version: CONFIG_VERSION,
        payload: intake
      },
      { onConflict: 'surface,config_key,version' }
    )
  if (error) {
    if (isOptionalSupabaseDataError(error)) return intake
    throw error
  }
  return intake
}

export async function loadRouteAssignments(): Promise<Record<string, RouteAssignmentRecord>> {
  if (!hasSupabaseConfig || !supabase) return loadLocalRouteAssignmentState()
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('config_key,payload')
    .eq('surface', CONFIG_SURFACE)
    .eq('version', CONFIG_VERSION)
    .like('config_key', `${ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX}%`)

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
  if (!hasSupabaseConfig || !supabase) {
    return assignment
  }
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .upsert(
      {
        surface: CONFIG_SURFACE,
        config_key: `${ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX}${assignment.enrolleeId}`,
        version: CONFIG_VERSION,
        payload: assignment
      },
      { onConflict: 'surface,config_key,version' }
    )
  if (error) {
    if (isOptionalSupabaseDataError(error)) return assignment
    throw error
  }
  return assignment
}

export async function loadTimelineConfigs(): Promise<Record<string, TimelineConfig>> {
  if (!hasSupabaseConfig || !supabase) return loadLocalTimelineConfigState()
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('config_key,payload')
    .eq('surface', CONFIG_SURFACE)
    .eq('version', CONFIG_VERSION)
    .like('config_key', `${TIMELINE_CONFIG_KEY_PREFIX}%`)

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
  if (!hasSupabaseConfig || !supabase) return config

  for (const key of keys) {
    const { error } = await (supabase as any)
      .schema('atlas')
      .from('app_config_documents')
      .upsert(
        {
          surface: CONFIG_SURFACE,
          config_key: `${TIMELINE_CONFIG_KEY_PREFIX}${key}`,
          version: CONFIG_VERSION,
          payload: config
        },
        { onConflict: 'surface,config_key,version' }
      )
    if (error) {
      if (isOptionalSupabaseDataError(error)) return config
      throw error
    }
  }
  return config
}

export async function loadAdminPortalRegistry(): Promise<AdminPortalRegistry> {
  if (!hasSupabaseConfig || !supabase) return loadLocalAdminPortalRegistryState()
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('payload')
    .eq('surface', CONFIG_SURFACE)
    .eq('config_key', ADMIN_PORTAL_REGISTRY_CONFIG_KEY)
    .eq('version', CONFIG_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalAdminPortalRegistryState()
    throw error
  }

  const normalized = normalizeAdminPortalRegistry((data?.[0]?.payload || null) as Partial<AdminPortalRegistry> | null)
  persistLocalAdminPortalRegistryState(normalized)
  return normalized
}

export async function saveAdminPortalRegistry(registry: AdminPortalRegistry): Promise<AdminPortalRegistry> {
  const normalized = normalizeAdminPortalRegistry({
    ...registry,
    updatedAtIso: new Date().toISOString()
  })
  persistLocalAdminPortalRegistryState(normalized)
  if (!hasSupabaseConfig || !supabase) {
    return normalized
  }
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .upsert(
      {
        surface: CONFIG_SURFACE,
        config_key: ADMIN_PORTAL_REGISTRY_CONFIG_KEY,
        version: CONFIG_VERSION,
        payload: normalized
      },
      { onConflict: 'surface,config_key,version' }
    )
  if (error) {
    if (isOptionalSupabaseDataError(error)) return normalized
    throw error
  }
  return normalized
}

export async function loadNavigatorProgramState(): Promise<NavigatorProgramState> {
  if (!hasSupabaseConfig || !supabase) return loadLocalNavigatorProgramState()
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('payload')
    .eq('surface', CONFIG_SURFACE)
    .eq('config_key', NAVIGATOR_PROGRAM_STATE_CONFIG_KEY)
    .eq('version', CONFIG_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalNavigatorProgramState()
    throw error
  }

  const normalized = normalizeNavigatorProgramState((data?.[0]?.payload || null) as Partial<NavigatorProgramState> | null)
  persistLocalNavigatorProgramState(normalized)
  return normalized
}

export async function saveNavigatorProgramState(state: NavigatorProgramState): Promise<NavigatorProgramState> {
  const normalized = normalizeNavigatorProgramState({
    ...state,
    updatedAtIso: new Date().toISOString()
  })
  persistLocalNavigatorProgramState(normalized)
  if (!hasSupabaseConfig || !supabase) {
    return normalized
  }
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .upsert(
      {
        surface: CONFIG_SURFACE,
        config_key: NAVIGATOR_PROGRAM_STATE_CONFIG_KEY,
        version: CONFIG_VERSION,
        payload: normalized
      },
      { onConflict: 'surface,config_key,version' }
    )
  if (error) {
    if (isOptionalSupabaseDataError(error)) return normalized
    throw error
  }
  return normalized
}
