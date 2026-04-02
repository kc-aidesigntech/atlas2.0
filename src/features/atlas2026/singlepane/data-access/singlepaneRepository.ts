import type {
  AdminDataQualityMetric,
  AccountSettings,
  AtlasRole,
  CountyHeatPoint,
  DomainLoad,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  EnrollmentRequestRecord,
  JourneyStationMarker,
  RouteCandidateRecord,
  RouteLogEvent
} from '@/features/atlas2026/singlepane/types'
import {
  getLocalAdminDataQuality,
  getLocalBaseLogs,
  getLocalCountyHeatmap,
  getLocalEnrollmentRequests,
  getLocalPartnerRadialLoad,
  getLocalRouteCandidates,
  getLocalSinglePaneBootstrap,
  type SinglePaneBootstrapData
} from '@/features/atlas2026/singlepane/data-access/localCsvData'

const STORAGE_KEY = 'atlas2026.singlepane.logs.v3'
const ACCOUNT_SETTINGS_KEY = 'atlas2026.singlepane.account-settings.v1'
const ENROLLEE_INTAKES_KEY = 'atlas2026.singlepane.enrollee-intakes.v1'

interface PersistedRouteLogState {
  appendedLogs: RouteLogEvent[]
  overrides: Record<string, RouteLogEvent>
}

function normalizeLog(log: RouteLogEvent): RouteLogEvent {
  return {
    ...log,
    phase: log.phase || 'regulation',
    milestoneType: log.milestoneType || 'intervention',
    domainsRelieved: Array.isArray(log.domainsRelieved) ? log.domainsRelieved : ['social'],
    stationIcon: log.stationIcon || 'check'
  }
}

function areLogsEqual(left: RouteLogEvent, right: RouteLogEvent) {
  return (
    left.id === right.id &&
    left.enrolleeId === right.enrolleeId &&
    left.label === right.label &&
    left.timestampIso === right.timestampIso &&
    left.status === right.status &&
    left.phase === right.phase &&
    left.milestoneType === right.milestoneType &&
    left.stationIcon === right.stationIcon &&
    left.domainsRelieved.join('|') === right.domainsRelieved.join('|')
  )
}

function loadPersistedRouteLogState(): PersistedRouteLogState {
  if (typeof window === 'undefined') return { appendedLogs: [], overrides: {} }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return { appendedLogs: [], overrides: {} }
  try {
    const parsed = JSON.parse(raw) as PersistedRouteLogState
    return {
      appendedLogs: Array.isArray(parsed?.appendedLogs) ? parsed.appendedLogs.map(normalizeLog) : [],
      overrides:
        parsed?.overrides && typeof parsed.overrides === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.overrides).map(([key, value]) => [key, normalizeLog(value as RouteLogEvent)])
            )
          : {}
    }
  } catch {
    return { appendedLogs: [], overrides: {} }
  }
}

function loadLocalLogs(): RouteLogEvent[] {
  const baseLogs = getLocalBaseLogs().map(normalizeLog)
  const { appendedLogs, overrides } = loadPersistedRouteLogState()
  return [
    ...baseLogs.map((log) => normalizeLog(overrides[log.id] ? { ...log, ...overrides[log.id] } : log)),
    ...appendedLogs.map(normalizeLog)
  ]
}

function persistLocalLogs(logs: RouteLogEvent[]) {
  if (typeof window === 'undefined') return
  const baseLogs = getLocalBaseLogs().map(normalizeLog)
  const baseLogById = new Map(baseLogs.map((log) => [log.id, log]))
  const overrides: Record<string, RouteLogEvent> = {}
  const appendedLogs: RouteLogEvent[] = []

  for (const log of logs.map(normalizeLog)) {
    const baseLog = baseLogById.get(log.id)
    if (!baseLog) {
      appendedLogs.push(log)
      continue
    }
    if (!areLogsEqual(baseLog, log)) {
      overrides[log.id] = log
    }
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ appendedLogs, overrides } satisfies PersistedRouteLogState))
}

function getDefaultAccountSettings(): AccountSettings {
  return {
    fullName: 'atlas operator',
    email: 'operator@atlas.local',
    organization: 'atlas operations',
    enabledRoles: ['administrator', 'partner', 'navigator']
  }
}

function loadAccountSettingsState(): AccountSettings {
  if (typeof window === 'undefined') return getDefaultAccountSettings()
  const raw = window.localStorage.getItem(ACCOUNT_SETTINGS_KEY)
  if (!raw) return getDefaultAccountSettings()
  try {
    const parsed = JSON.parse(raw) as Partial<AccountSettings>
    const enabledRoles = Array.isArray(parsed.enabledRoles)
      ? parsed.enabledRoles.filter((role): role is AtlasRole => ['navigator', 'partner', 'administrator'].includes(String(role)))
      : getDefaultAccountSettings().enabledRoles
    return {
      fullName: parsed.fullName || getDefaultAccountSettings().fullName,
      email: parsed.email || getDefaultAccountSettings().email,
      organization: parsed.organization || getDefaultAccountSettings().organization,
      enabledRoles: enabledRoles.length ? enabledRoles : getDefaultAccountSettings().enabledRoles
    }
  } catch {
    return getDefaultAccountSettings()
  }
}

function persistAccountSettingsState(settings: AccountSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCOUNT_SETTINGS_KEY, JSON.stringify(settings))
}

function loadEnrolleeIntakeState(): Record<string, EnrolleeIntakeRecord> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(ENROLLEE_INTAKES_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, EnrolleeIntakeRecord>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persistEnrolleeIntakeState(intakes: Record<string, EnrolleeIntakeRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ENROLLEE_INTAKES_KEY, JSON.stringify(intakes))
}

function applyIntakeOverrides(enrollees: EnrolleeProfile[], intakeOverrides: Record<string, EnrolleeIntakeRecord>) {
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

export async function loadSinglePaneBootstrap(_role: AtlasRole): Promise<SinglePaneBootstrapData> {
  const bootstrap = getLocalSinglePaneBootstrap()
  const logs = loadLocalLogs()
  const intakeOverrides = loadEnrolleeIntakeState()
  const enrollees = applyIntakeOverrides(bootstrap.enrollees, intakeOverrides)
  const timelineConfigsByEnrolleeId = Object.fromEntries(
    Object.entries(bootstrap.timelineConfigsByEnrolleeId).map(([enrolleeId, config]) => [
      enrolleeId,
      intakeOverrides[enrolleeId]?.enrollmentStartIso
        ? { ...config, planStartIso: intakeOverrides[enrolleeId].enrollmentStartIso }
        : config
    ])
  )
  const firstEnrolleeId = enrollees[0]?.id || ''
  return {
    ...bootstrap,
    enrollees,
    timelineConfigsByEnrolleeId,
    timelineConfig: timelineConfigsByEnrolleeId[firstEnrolleeId] || bootstrap.timelineConfig,
    logs
  }
}

export async function appendRouteLog(logs: RouteLogEvent[], nextLog: RouteLogEvent) {
  const finalLogs = [...logs, nextLog].map(normalizeLog)
  persistLocalLogs(finalLogs)
  return finalLogs
}

export async function loadEnrollmentRequests(role: AtlasRole): Promise<EnrollmentRequestRecord[]> {
  return getLocalEnrollmentRequests(role)
}

export async function loadRouteCandidates(activeZCodes: string[] = []): Promise<RouteCandidateRecord[]> {
  return getLocalRouteCandidates(activeZCodes)
}

export async function loadCountyHeatmap(): Promise<CountyHeatPoint[]> {
  return getLocalCountyHeatmap()
}

export async function loadAdminDataQuality(): Promise<AdminDataQualityMetric[]> {
  return getLocalAdminDataQuality()
}

export async function loadJourneyStationMarkers(enrollmentId?: string): Promise<JourneyStationMarker[]> {
  if (!enrollmentId) return []
  return loadLocalLogs()
    .filter((log) => log.enrolleeId === enrollmentId && log.phase !== 'regulation')
    .map((log, index) => ({
      id: `station-marker-${log.id}`,
      stationName: index === 0 ? 'partner station' : `partner station ${index + 1}`,
      assignedAtIso: log.timestampIso,
      phase: log.phase,
      iconSlug: log.stationIcon
    }))
}

export async function loadPartnerRadialLoad(): Promise<DomainLoad | null> {
  return getLocalPartnerRadialLoad()
}

export async function loadAccountSettings(): Promise<AccountSettings> {
  return loadAccountSettingsState()
}

export async function saveAccountSettings(settings: AccountSettings): Promise<AccountSettings> {
  persistAccountSettingsState(settings)
  return settings
}

export async function loadEnrolleeIntakes(): Promise<Record<string, EnrolleeIntakeRecord>> {
  return loadEnrolleeIntakeState()
}

export async function saveEnrolleeIntake(intake: EnrolleeIntakeRecord): Promise<EnrolleeIntakeRecord> {
  const nextState = {
    ...loadEnrolleeIntakeState(),
    [intake.enrolleeId]: intake
  }
  persistEnrolleeIntakeState(nextState)
  return intake
}
