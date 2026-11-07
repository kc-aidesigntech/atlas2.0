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
import {
  dedupeMenus,
  isNavigatorTier,
  isSystemAdmin,
  normalizeAtlasRoleKey,
  workspaceExperience
} from '@/features/atlas2026/singlepane/domain/roles'
import { createDefaultTimelineConfig } from '@/features/atlas2026/singlepane/timelineConfigUtils'
import { menuListIncludesScribe, setScribeOnMenuList } from '@/features/atlas2026/scribe/scribeMenuVisibility'

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

/**
 * Stored `app_role_navigation.top_menus` label (lower-cased) to the `activeMenu`
 * screen id the workspace switches on. Tier rows seeded by the database use the
 * screen ids directly, so those entries map to themselves. Labels not listed
 * here pass through as written.
 */
export const TIER_MENU_SCREEN_IDS: Record<string, string> = {
  // Screens that exist today.
  refer: 'refer',
  'my wallet': 'my wallet',
  enrollees: 'enrollees',
  'warm line': 'warm line',
  'route planning': 'route planning',
  'team burden': 'team burden',
  'county commons': 'county commons',
  'system operations': 'system operations',
  governance: 'governance',
  fleet: 'fleet',
  scribe: 'scribe',
  'my station': 'my station',
  'service capacity': 'service capacity',
  // Tier feature screens rendered by components/tierFeaturePanels/TierFeatureScreen.
  leads: 'leads',
  'respite shifts': 'respite shifts',
  'secondment schedule': 'secondment schedule',
  partners: 'partners',
  cohorts: 'cohorts',
  sponsorships: 'sponsorships',
  'competency cards': 'competency cards',
  // Older labels that open an existing screen under a different name.
  'assigned enrollees': 'enrollees',
  'requests to enroll': 'my wallet',
  'my profile': 'my wallet',
  'assigned navigators': 'my wallet',
  'navigator assessments': 'my wallet',
  'referral portal': 'refer',
  'heat map': 'county commons',
  'county commons/heat map': 'county commons',
  navigators: 'my wallet',
  assessments: 'my wallet',
  pickup: 'enrollees',
  'ips core cohorts': 'cohorts',
  'competency card': 'competency cards',
  'respite shift': 'respite shifts',
  secondments: 'secondment schedule'
}

/** Screen id for a stored label (`referral portal` returns `refer`); null when the label is not in the table. */
export function tierMenuScreenId(menu: string) {
  return TIER_MENU_SCREEN_IDS[menu.trim().toLowerCase()] || null
}

function normalizeTierMenuLabel(menu: string) {
  return tierMenuScreenId(menu) || menu
}

function normalizeNavigatorTopMenus(menus: string[], canAccessWarmLine: boolean) {
  const normalized = hideUnconfiguredWarmLineMenu(
    hideDeferredCountyCommonsMenu(
      menus.map(normalizeTierMenuLabel).filter((menu) => menu.trim().toLowerCase() !== 'route planning')
    ),
    canAccessWarmLine
  )
  if (!normalized.some((menu) => menu.trim().toLowerCase() === 'enrollees')) normalized.unshift('enrollees')
  return dedupeMenus(normalized)
}

function normalizeSupervisorTopMenus(menus: string[], canAccessWarmLine: boolean) {
  const normalized = hideUnconfiguredWarmLineMenu(
    hideDeferredCountyCommonsMenu(
      menus
        .filter((menu) => menu.trim().toLowerCase() !== 'route planning')
        .map((menu) => {
          const lower = menu.trim().toLowerCase()
          // The supervisor shell keeps `referral portal` as its referral screen id.
          if (lower === 'referral portal' || lower === 'refer') return 'referral portal'
          return normalizeTierMenuLabel(menu)
        })
    ),
    canAccessWarmLine
  )
  const withReferral = normalized.includes('referral portal') ? normalized : ['referral portal', ...normalized]
  return dedupeMenus(withReferral)
}

/** t1, t2, and t3 show their stored row with aliases mapped and gated menus hidden. */
function normalizeMemberTierTopMenus(menus: string[], canAccessWarmLine: boolean) {
  return dedupeMenus(
    hideUnconfiguredWarmLineMenu(hideDeferredCountyCommonsMenu(menus.map(normalizeTierMenuLabel)), canAccessWarmLine)
  )
}

function normalizeRoleTopMenus(role: AtlasRole, menus: string[], canAccessWarmLine: boolean) {
  const experience = workspaceExperience(role)
  switch (experience) {
    case 'navigator':
      return normalizeNavigatorTopMenus(menus, canAccessWarmLine)
    case 'partner':
      // Partner chrome is a fixed shell. Scribe is the one optional item, so it
      // follows the stored menu list instead of being dropped with the rest.
      return setScribeOnMenuList(['referral portal', 'my station', 'service capacity'], menuListIncludesScribe(menus))
    case 'supervisor':
      return normalizeSupervisorTopMenus(menus, canAccessWarmLine)
    case 'member':
      return normalizeMemberTierTopMenus(menus, canAccessWarmLine)
    case 'administrator':
      return hideUnconfiguredWarmLineMenu(hideDeferredCountyCommonsMenu(menus.map(normalizeTierMenuLabel)), canAccessWarmLine)
    default: {
      const exhaustive: never = experience
      return exhaustive
    }
  }
}

// Order the t4plus superset collects menus in: navigator tiers first, then partner,
// the member tiers, the supervisor, and the coordinator's own row last.
const SUPERSET_ROLE_PRIORITY: AtlasRole[] = ['t3a', 't2b', 'partner', 't3', 't2', 't1', 't4', 't4plus']

function buildAdminSupersetMenus(roleConfigs: Array<{ role: AtlasRole; topMenus: string[]; actionMenus: string[] }>) {
  const topMenus = new Set<string>()
  const actionMenus = new Set<string>()
  for (const roleKey of SUPERSET_ROLE_PRIORITY) {
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

type RosterProfile = Awaited<ReturnType<typeof fetchSinglePaneEnrolleeProfiles>>[number]

/**
 * Rebuild one enrollee's shell records from a roster profile. Used when that
 * enrollment's revision changed and the rest of the remembered workspace can stay.
 */
export function projectRememberedEnrollee(profile: RosterProfile, timelineTemplate: TimelineConfig) {
  const enrollee: EnrolleeProfile = {
    id: profile.enrolleeId,
    enrollmentId: profile.enrollmentId,
    fullName: profile.fullName,
    dob: profile.dob,
    caseId: profile.caseId,
    email: profile.email,
    phones: profile.phones,
    avatarUrl: profile.avatarUrl || undefined,
    assignedNavigator: profile.assignedNavigator,
    zCodeTags: profile.zCodeTags,
    activeZCodeDetails: profile.activeZCodeDetails,
    completedParentCodes: profile.completedParentCodes,
    currentPhase: profile.currentPhase
  }
  const rows = profile.activeZCodeDetails.flatMap((detail) => {
    const normalizedZCode = detail.zCode.trim().toUpperCase()
    if (!normalizedZCode) return []
    const parentCode = detail.parentCode.trim().toUpperCase()
    return [
      {
        id: detail.enrolleeZCodeId,
        zCodeGroup: normalizedZCode,
        parentCode,
        mappedDomain: mapZCodeToDomainBucket(parentCode, normalizedZCode),
        rawCount: 1,
        responseCount: 1,
        drilldownTarget: {
          kind: 'enrolleeZCode' as const,
          enrolleeId: profile.enrolleeId,
          enrollmentId: profile.enrollmentId,
          enrolleeZCodeId: detail.enrolleeZCodeId,
          normalizedZCode
        }
      }
    ]
  })
  const totals = rows.reduce(
    (accumulator, row) => {
      if (row.mappedDomain === 'habitat') accumulator.habitatTotal += row.rawCount
      if (row.mappedDomain === 'work') accumulator.workTotal += row.rawCount
      if (row.mappedDomain === 'socialNetworks') accumulator.socialNetworksTotal += row.rawCount
      return accumulator
    },
    { habitatTotal: 0, workTotal: 0, socialNetworksTotal: 0 }
  )
  const breakdown: DomainLoadBreakdown = {
    subjectId: profile.enrolleeId,
    subjectLabel: profile.fullName,
    sourceKind: 'enrolleeRecords',
    sourceLabel: 'Supabase enrollee z-codes',
    ...totals,
    rows
  }
  const load: DomainLoad = {
    enrolleeId: profile.enrolleeId,
    habitat: totals.habitatTotal,
    work: totals.workTotal,
    socialNetworks: totals.socialNetworksTotal
  }
  const timeline: TimelineConfig = {
    ...timelineTemplate,
    planStartIso: profile.enrollmentStartIso || timelineTemplate.planStartIso,
    durationMonths: profile.targetDurationMonths || timelineTemplate.durationMonths
  }
  return { enrollee, load, breakdown, timeline }
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
    isNavigatorTier(role)
      ? withOptionalSupabaseFallback('singlepane.navigatorAssignedEnrollees', () => fetchNavigatorAssignedEnrollees(supabase), [])
      : Promise.resolve([]),
    isNavigatorTier(role)
      ? withOptionalSupabaseFallback('singlepane.navigatorPersonFromMetadata', () => resolveSessionPersonIdFromMetadata(), null)
      : Promise.resolve(null),
    withOptionalSupabaseFallback('singlepane.warmLineAccess', () => fetchCanAccessWarmLineAgent(), false)
  ])

  const navigatorEnrollmentIds =
    isNavigatorTier(role)
      ? new Set(
          // Database authorization scopes rows; absent metadata falls back to those scoped rows.
          navigatorAssignedEnrollees
            .filter((record) => (navigatorPersonId ? record.navigatorPersonId === navigatorPersonId : true))
            .map((record) => record.enrollmentId)
        )
      : null
  const visibleProfiles =
    isNavigatorTier(role)
      ? profiles.filter((profile) => navigatorEnrollmentIds?.has(profile.enrollmentId))
      : profiles
  const uniqueVisibleProfiles = dedupeProfilesByEnrollmentId(visibleProfiles)
  const visibleLoadRows =
    isNavigatorTier(role)
      ? loadRows.filter((row) => navigatorEnrollmentIds?.has(row.enrollmentId))
      : loadRows
  const visibleBreakdownRows =
    isNavigatorTier(role)
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
    phones: profile.phones,
    avatarUrl: profile.avatarUrl || undefined,
    assignedNavigator: profile.assignedNavigator,
    zCodeTags: profile.zCodeTags,
    activeZCodeDetails: profile.activeZCodeDetails,
    completedParentCodes: profile.completedParentCodes,
    currentPhase: profile.currentPhase
  }))

  // Legacy row keys (navigator, supervisor, administrator) map onto their tier; unknown keys drop.
  const normalizedRoleConfigs = roleNavigation.flatMap((item) => {
    const role = normalizeAtlasRoleKey(item.roleKey)
    if (!role) return []
    return [
      {
        role,
        topMenus: normalizeRoleTopMenus(role, item.topMenus, canAccessWarmLine === true),
        actionMenus: item.actionMenus
      }
    ]
  })
  const adminSuperset = buildAdminSupersetMenus(normalizedRoleConfigs)
  // The t4plus menu is a superset of every role, except scribe. Scribe stays on
  // the t4plus row alone so hiding it for coordinators does not depend on
  // whether another permission level still shows it.
  const administratorHasScribe = menuListIncludesScribe(
    normalizedRoleConfigs.find((item) => isSystemAdmin(item.role))?.topMenus || []
  )
  const roleConfigs = normalizedRoleConfigs.map((item) => {
    if (!isSystemAdmin(item.role)) return item
    const topMenus = setScribeOnMenuList(adminSuperset.topMenus, administratorHasScribe)
    return { ...item, topMenus, actionMenus: adminSuperset.actionMenus }
  })

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
