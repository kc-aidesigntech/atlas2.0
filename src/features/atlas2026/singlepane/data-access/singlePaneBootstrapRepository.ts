import type {
  AtlasRole,
  DomainLoad,
  DomainLoadBreakdown,
  EnrolleeProfile,
  RoleMenuConfig,
  RouteLogEvent,
  TimelineConfig
} from '@/features/atlas2026/shared/contracts'
import {
  fetchAppRoleNavigation,
  fetchNavigatorAssignedEnrollees,
  fetchSinglePaneEnrolleeDomainLoadBreakdown,
  fetchSinglePaneEnrolleeDomainLoads,
  fetchSinglePaneEnrolleeProfiles,
  fetchSinglePaneTimelineConfig
} from '@atlas/shared'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'
import { isPrayPhoneWarmLineConfigured } from '@/features/atlas2026/singlepane/data-access/prayphoneSubapp'
import { fetchCanAccessWarmLineAgent } from '@/features/atlas2026/singlepane/data-access/warmlineAccess'
import {
  applyIntakeOverrides,
  loadEnrolleeIntakes,
  loadTimelineConfigs
} from '@/features/atlas2026/singlepane/data-access/localStateRepository'
import { loadLocalLogs } from '@/features/atlas2026/singlepane/data-access/routeLogRepository'
import { mapZCodeToDomainBucket } from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { resolveSessionPersonIdFromMetadata } from '@/features/atlas2026/singlepane/data-access/enrollmentAssignmentRepository'
import { createDefaultTimelineConfig } from '@/features/atlas2026/singlepane/timelineConfigUtils'

export interface SinglePaneBootstrapData {
  enrollees: EnrolleeProfile[]
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  roleConfigs: RoleMenuConfig[]
  timelineConfig: TimelineConfig
  timelineConfigsByEnrolleeId: Record<string, TimelineConfig>
  logs: RouteLogEvent[]
}

// Single reversible switch for the deferred county-commons experience.
const SHOW_COUNTY_COMMONS = false

/** Phase 3 launch-guard smoke helper: County Commons stays hidden for first launch. */
export function isCountyCommonsMenuEnabled() {
  return SHOW_COUNTY_COMMONS
}

function hideDeferredCountyCommonsMenu(menus: string[]) {
  if (SHOW_COUNTY_COMMONS) return menus
  return menus.filter((menu) => menu.trim().toLowerCase() !== 'county commons')
}

/** Hide warm line unless the agent origin is configured and this identity may sit it. */
function hideUnconfiguredWarmLineMenu(menus: string[], canAccessWarmLine: boolean) {
  if (isPrayPhoneWarmLineConfigured() && canAccessWarmLine) return menus
  return menus.filter((menu) => menu.trim().toLowerCase() !== 'warm line')
}

function normalizeNavigatorTopMenus(menus: string[], canAccessWarmLine: boolean) {
  const normalized = hideUnconfiguredWarmLineMenu(
    hideDeferredCountyCommonsMenu(
      menus
        .map((menu) => {
          const lower = menu.trim().toLowerCase()
          if (lower === 'assigned enrollees') return 'enrollees'
          if (lower === 'requests to enroll') return 'my profile'
          if (lower === 'referral portal') return 'refer'
          return menu
        })
        .filter((menu) => menu.trim().toLowerCase() !== 'route planning')
    ),
    canAccessWarmLine
  )
  if (!normalized.some((menu) => menu.trim().toLowerCase() === 'enrollees')) normalized.unshift('enrollees')
  return normalized
}

function normalizeRoleTopMenus(roleKey: string, menus: string[], canAccessWarmLine: boolean) {
  if (roleKey === 'navigator') return normalizeNavigatorTopMenus(menus, canAccessWarmLine)
  if (roleKey === 'partner') return ['referral portal', 'my station', 'service capacity']
  if (roleKey === 'supervisor') {
    const normalized = hideUnconfiguredWarmLineMenu(
      hideDeferredCountyCommonsMenu(menus.filter((menu) => menu.trim().toLowerCase() !== 'route planning')),
      canAccessWarmLine
    )
    return normalized.includes('referral portal') ? normalized : ['referral portal', ...normalized]
  }
  return hideUnconfiguredWarmLineMenu(hideDeferredCountyCommonsMenu(menus), canAccessWarmLine)
}

function buildAdminSupersetMenus(roleConfigs: Array<{ role: AtlasRole; topMenus: string[]; actionMenus: string[] }>) {
  const topMenus = new Set<string>()
  const actionMenus = new Set<string>()
  const orderedRolePriority: AtlasRole[] = ['navigator', 'partner', 'supervisor', 'administrator']
  for (const roleKey of orderedRolePriority) {
    const config = roleConfigs.find((item) => item.role === roleKey)
    if (!config) continue
    for (const menu of config.topMenus) topMenus.add(menu)
    for (const action of config.actionMenus) actionMenus.add(action)
  }
  return { topMenus: Array.from(topMenus), actionMenus: Array.from(actionMenus) }
}

function dedupeProfilesByEnrollmentId<T extends { enrollmentId?: string; enrolleeId?: string }>(profiles: T[]) {
  const seen = new Set<string>()
  return profiles.filter((profile) => {
    const key = profile.enrollmentId || profile.enrolleeId || ''
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function createEmptyBootstrap(logs: RouteLogEvent[]): SinglePaneBootstrapData {
  return {
    enrollees: [],
    loads: [],
    loadBreakdownsByEnrolleeId: {},
    roleConfigs: [],
    timelineConfig: createDefaultTimelineConfig(),
    timelineConfigsByEnrolleeId: {},
    logs
  }
}

export type SinglePaneBootstrapLoadOptions = {
  /**
   * Critical path skips local intake, timeline, and log input/output (I/O) so
   * cold open waits only on remote role menus and enrollee domain reads.
   */
  criticalOnly?: boolean
}

export async function loadSinglePaneBootstrap(
  role: AtlasRole,
  options?: SinglePaneBootstrapLoadOptions
): Promise<SinglePaneBootstrapData> {
  const criticalOnly = options?.criticalOnly === true
  let logs: Awaited<ReturnType<typeof loadLocalLogs>> = []
  let intakeOverrides: Awaited<ReturnType<typeof loadEnrolleeIntakes>> = {}
  let timelineOverrides: Awaited<ReturnType<typeof loadTimelineConfigs>> = {}
  if (!criticalOnly) {
    ;[logs, intakeOverrides, timelineOverrides] = await Promise.all([
      loadLocalLogs(),
      loadEnrolleeIntakes(),
      loadTimelineConfigs()
    ])
  }

  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) {
    return createEmptyBootstrap(logs)
  }

  const shouldLoadEnrolleeDomain = role !== 'partner'
  // Load role chrome, timeline defaults, and enrollee domain concurrently for first paint.
  const [
    roleNavigation,
    timelineDefaults,
    profiles,
    loadRows,
    breakdownRows,
    navigatorAssignedEnrollees,
    navigatorPersonId,
    canAccessWarmLine
  ] = await Promise.all([
    withOptionalSupabaseFallback('singlepane.roleNavigation', () => fetchAppRoleNavigation(supabase, 'singlepane'), []),
    withOptionalSupabaseFallback(
      'singlepane.timelineDefaults',
      () => fetchSinglePaneTimelineConfig(supabase),
      createDefaultTimelineConfig()
    ),
    shouldLoadEnrolleeDomain
      ? withOptionalSupabaseFallback('singlepane.enrolleeProfiles', () => fetchSinglePaneEnrolleeProfiles(supabase), [])
      : Promise.resolve([]),
    shouldLoadEnrolleeDomain
      ? withOptionalSupabaseFallback('singlepane.enrolleeDomainLoads', () => fetchSinglePaneEnrolleeDomainLoads(supabase), [])
      : Promise.resolve([]),
    shouldLoadEnrolleeDomain
      ? withOptionalSupabaseFallback(
          'singlepane.enrolleeDomainLoadBreakdown',
          () => fetchSinglePaneEnrolleeDomainLoadBreakdown(supabase),
          []
        )
      : Promise.resolve([]),
    role === 'navigator'
      ? withOptionalSupabaseFallback('singlepane.navigatorAssignedEnrollees', () => fetchNavigatorAssignedEnrollees(supabase), [])
      : Promise.resolve([]),
    role === 'navigator'
      ? withOptionalSupabaseFallback('singlepane.navigatorPersonFromMetadata', () => resolveSessionPersonIdFromMetadata(), null)
      : Promise.resolve(null),
    withOptionalSupabaseFallback('singlepane.warmLineAccess', () => fetchCanAccessWarmLineAgent(), false)
  ])

  const navigatorEnrollmentIds =
    role === 'navigator'
      ? new Set(
          // Database authorization scopes rows; absent metadata falls back to those scoped rows.
          navigatorAssignedEnrollees
            .filter((record) => (navigatorPersonId ? record.navigatorPersonId === navigatorPersonId : true))
            .map((record) => record.enrollmentId)
        )
      : null
  const visibleProfiles =
    role === 'navigator'
      ? profiles.filter((profile) => navigatorEnrollmentIds?.has(profile.enrollmentId))
      : profiles
  const uniqueVisibleProfiles = dedupeProfilesByEnrollmentId(visibleProfiles)
  const visibleLoadRows =
    role === 'navigator'
      ? loadRows.filter((row) => navigatorEnrollmentIds?.has(row.enrollmentId))
      : loadRows
  const visibleBreakdownRows =
    role === 'navigator'
      ? breakdownRows.filter((row) => navigatorEnrollmentIds?.has(row.enrollmentId))
      : breakdownRows
  const fallbackLoadByEnrollmentId = new Map(visibleLoadRows.map((row) => [row.enrollmentId, row]))
  const fallbackBreakdownRowsByEnrollmentId = visibleBreakdownRows.reduce<
    Map<string, Array<(typeof visibleBreakdownRows)[number]>>
  >((accumulator, row) => {
    const current = accumulator.get(row.enrollmentId) || []
    current.push(row)
    accumulator.set(row.enrollmentId, current)
    return accumulator
  }, new Map())

  const bootstrapEnrollees = uniqueVisibleProfiles.map((profile) => ({
    id: profile.enrolleeId,
    enrollmentId: profile.enrollmentId,
    fullName: profile.fullName,
    dob: profile.dob,
    caseId: profile.caseId,
    email: profile.email,
    avatarUrl: profile.avatarUrl || undefined,
    assignedNavigator: profile.assignedNavigator,
    zCodeTags: profile.zCodeTags,
    activeZCodeDetails: profile.activeZCodeDetails,
    completedParentCodes: profile.completedParentCodes,
    currentPhase: profile.currentPhase
  }))

  const normalizedRoleConfigs = roleNavigation.map((item) => ({
    role: item.roleKey as AtlasRole,
    topMenus: normalizeRoleTopMenus(item.roleKey, item.topMenus, canAccessWarmLine === true),
    actionMenus: item.actionMenus
  }))
  const adminSuperset = buildAdminSupersetMenus(normalizedRoleConfigs)
  const roleConfigs = normalizedRoleConfigs.map((item) =>
    item.role === 'administrator'
      ? { ...item, topMenus: adminSuperset.topMenus, actionMenus: adminSuperset.actionMenus }
      : item
  )

  const loadBreakdownsByEnrolleeId = Object.fromEntries(
    uniqueVisibleProfiles.map((profile) => {
      const canonicalRows = profile.activeZCodeDetails
        .map((detail) => {
          const normalizedZCode = detail.zCode.trim().toUpperCase()
          if (!normalizedZCode) return null
          const parentCode = detail.parentCode.trim().toUpperCase()
          return {
            id: detail.enrolleeZCodeId,
            zCodeGroup: normalizedZCode,
            parentCode,
            mappedDomain: mapZCodeToDomainBucket(parentCode, normalizedZCode),
            rawCount: 1,
            responseCount: 1,
            // Preserve the canonical row pointer so drilldown edits the source record.
            drilldownTarget: {
              kind: 'enrolleeZCode' as const,
              enrolleeId: profile.enrolleeId,
              enrollmentId: profile.enrollmentId,
              enrolleeZCodeId: detail.enrolleeZCodeId,
              normalizedZCode
            }
          }
        })
        .filter((row): row is DomainLoadBreakdown['rows'][number] => Boolean(row))
      const rows =
        canonicalRows.length > 0
          ? canonicalRows
          : (fallbackBreakdownRowsByEnrollmentId.get(profile.enrollmentId) || []).map((row) => ({
              id: `${profile.enrolleeId}:${row.zCodeGroup}`,
              zCodeGroup: row.zCodeGroup,
              mappedDomain: row.mappedDomain,
              rawCount: row.rawCount
            }))
      const totals = rows.reduce(
        (accumulator, row) => {
          if (row.mappedDomain === 'habitat') accumulator.habitatTotal += row.rawCount
          if (row.mappedDomain === 'work') accumulator.workTotal += row.rawCount
          if (row.mappedDomain === 'socialNetworks') accumulator.socialNetworksTotal += row.rawCount
          return accumulator
        },
        { habitatTotal: 0, workTotal: 0, socialNetworksTotal: 0 }
      )
      return [
        profile.enrolleeId,
        {
          subjectId: profile.enrolleeId,
          subjectLabel: profile.fullName,
          sourceKind: 'enrolleeRecords' as const,
          sourceLabel: 'Supabase enrollee z-codes',
          ...totals,
          rows
        } satisfies DomainLoadBreakdown
      ]
    })
  )
  const loads = uniqueVisibleProfiles.map((profile) => {
    const breakdown = loadBreakdownsByEnrolleeId[profile.enrolleeId]
    const fallbackRow = fallbackLoadByEnrollmentId.get(profile.enrollmentId)
    return {
      enrolleeId: profile.enrolleeId,
      habitat: breakdown?.habitatTotal ?? fallbackRow?.habitat ?? 0,
      work: breakdown?.workTotal ?? fallbackRow?.work ?? 0,
      socialNetworks: breakdown?.socialNetworksTotal ?? fallbackRow?.socialNetworks ?? 0
    }
  })

  const baseTimelineConfig = {
    planStartIso: new Date().toISOString(),
    durationMonths: timelineDefaults.durationMonths,
    maxDurationMonths: timelineDefaults.maxDurationMonths,
    gates: timelineDefaults.gates
  }
  const bootstrap: SinglePaneBootstrapData = {
    enrollees: bootstrapEnrollees,
    loads,
    loadBreakdownsByEnrolleeId,
    roleConfigs,
    timelineConfig: baseTimelineConfig,
    timelineConfigsByEnrolleeId: Object.fromEntries(
      uniqueVisibleProfiles.map((profile) => [
        profile.enrolleeId,
        {
          ...baseTimelineConfig,
          planStartIso: profile.enrollmentStartIso || baseTimelineConfig.planStartIso,
          durationMonths: profile.targetDurationMonths || baseTimelineConfig.durationMonths
        }
      ])
    ),
    logs
  }
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
  const mergedTimelineConfigs = Object.fromEntries(
    enrollees.map((enrollee) => [
      enrollee.id,
      timelineOverrides[`enrollment:${enrollee.enrollmentId}`] ||
        timelineOverrides[`enrollee:${enrollee.id}`] ||
        timelineOverrides[enrollee.id] ||
        timelineConfigsByEnrolleeId[enrollee.id] ||
        bootstrap.timelineConfig
    ])
  )
  return {
    ...bootstrap,
    enrollees,
    timelineConfigsByEnrolleeId: mergedTimelineConfigs,
    timelineConfig: mergedTimelineConfigs[firstEnrolleeId] || bootstrap.timelineConfig,
    logs
  }
}
