import type {
  IntervalCadence,
  RegulationReviewDueItem,
  RegulationReviewSettings,
  RegulationTestType,
  ResolvedZCodeStripMarker,
  RouteLogEvent
} from '@/features/atlas2026/shared/contracts'

/**
 * Forced weekly regulation cadence and Tacoma Z75 / Lucid milestone helpers.
 *
 * Product rules:
 * - Weekly Stress Vulnerability Scale (SVS) and Mental Health Self-Care Agency (MH-SCA)
 *   reviews cannot be skipped: both instruments must be completed inside the cadence window.
 * - When both instruments are currently passing (stable), the clearance is also a loggable
 *   route stop under Z75. In Tacoma the regulation provider for that stop is Lucid.
 */

export const REGULATION_CADENCE_INSTRUMENTS = ['mh_sca', 'svs'] as const
export type RegulationCadenceInstrument = (typeof REGULATION_CADENCE_INSTRUMENTS)[number]

/** Tacoma default: Lucid is the regulation provider logged under parent Z75. */
export const TACOMA_REGULATION_PROVIDER = {
  parentCode: 'Z75',
  // Helping-agency accessibility is the Z75 child that represents Lucid's regulation support.
  zCode: 'Z75.4',
  providerDisplayName: 'Lucid',
  partnerOrganizationHint: 'lucid'
} as const

export const REGULATION_MILESTONE_LABEL_PREFIX = 'Z75 · Lucid — SVS and MH-SCA stabilized'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export type RegulationInstrumentCompletionMap = Record<
  string,
  Partial<Record<RegulationCadenceInstrument, string>>
>

export function isRegulationCadenceInstrument(
  testType: RegulationTestType
): testType is RegulationCadenceInstrument {
  return (REGULATION_CADENCE_INSTRUMENTS as readonly string[]).includes(testType)
}

export function cadenceWindowMs(cadence: IntervalCadence) {
  if (cadence === 'weekly') return 7 * DAY_IN_MS
  if (cadence === 'monthly') return 30 * DAY_IN_MS
  return 90 * DAY_IN_MS
}

export function isInstrumentCompletedInsideWindow(
  completedAtIso: string | null | undefined,
  cadence: IntervalCadence,
  nowMs = Date.now()
) {
  if (!completedAtIso) return false
  const completedMs = new Date(completedAtIso).getTime()
  if (!Number.isFinite(completedMs)) return false
  return nowMs - completedMs < cadenceWindowMs(cadence)
}

/**
 * A cycle is satisfied only when both SVS and MH-SCA have completed submissions
 * inside the active cadence window. Completing one instrument alone never clears the due item.
 */
export function isRegulationReviewCycleSatisfied(
  completions: Partial<Record<RegulationCadenceInstrument, string>> | null | undefined,
  cadence: IntervalCadence,
  nowMs = Date.now()
) {
  return REGULATION_CADENCE_INSTRUMENTS.every((instrument) =>
    isInstrumentCompletedInsideWindow(completions?.[instrument], cadence, nowMs)
  )
}

export function listMissingRegulationInstruments(
  completions: Partial<Record<RegulationCadenceInstrument, string>> | null | undefined,
  cadence: IntervalCadence,
  nowMs = Date.now()
): RegulationCadenceInstrument[] {
  return REGULATION_CADENCE_INSTRUMENTS.filter(
    (instrument) => !isInstrumentCompletedInsideWindow(completions?.[instrument], cadence, nowMs)
  )
}

export function getRegulationReviewNextDueAtIso(
  completions: Partial<Record<RegulationCadenceInstrument, string>> | null | undefined,
  cadence: IntervalCadence,
  nowMs = Date.now()
) {
  const completedTimes = REGULATION_CADENCE_INSTRUMENTS.map((instrument) => completions?.[instrument])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
  if (!completedTimes.length) return new Date(nowMs).toISOString()
  // Next boundary is driven by the older of the two in-window completions so the
  // navigator cannot stretch a cycle by refreshing only the newer instrument.
  const oldestCompletedMs = Math.min(...completedTimes)
  return new Date(oldestCompletedMs + cadenceWindowMs(cadence)).toISOString()
}

export function getLatestRegulationReviewCompletedAtIso(
  completions: Partial<Record<RegulationCadenceInstrument, string>> | null | undefined
) {
  const completedTimes = REGULATION_CADENCE_INSTRUMENTS.map((instrument) => completions?.[instrument])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
  if (completedTimes.length < REGULATION_CADENCE_INSTRUMENTS.length) return null
  return new Date(Math.max(...completedTimes)).toISOString()
}

type OwnedEnrolleeLike = {
  id: string
  fullName: string
  assignedNavigator?: string | null
}

/**
 * One due item per owned enrollee whose review is active. Open status means at least one
 * of SVS / MH-SCA is missing inside the cadence window — the cycle cannot be skipped.
 */
export function buildForcedRegulationReviewDueItems(
  settings: RegulationReviewSettings,
  ownedEnrollees: OwnedEnrolleeLike[],
  completionsByEnrolleeId: RegulationInstrumentCompletionMap,
  nowMs = Date.now()
): RegulationReviewDueItem[] {
  return ownedEnrollees
    .map((enrollee) => {
      const override = settings.enrolleeSettings[enrollee.id] || null
      // Default-active contract: enrollees without an explicit per-enrollee entry inherit
      // the admin default so newly added enrollees are enforced without extra setup.
      const isActive = override ? override.isActive : settings.isActiveForNewEnrollees
      if (!isActive) return null
      const cadence = override?.cadence || settings.defaultCadence
      const completions = completionsByEnrolleeId[enrollee.id] || {}
      const isSatisfied = isRegulationReviewCycleSatisfied(completions, cadence, nowMs)
      const missingInstruments = listMissingRegulationInstruments(completions, cadence, nowMs)
      return {
        id: `regulation-review-${enrollee.id}`,
        enrolleeId: enrollee.id,
        enrolleeName: enrollee.fullName,
        navigatorName: enrollee.assignedNavigator || null,
        cadence,
        dueAtIso: getRegulationReviewNextDueAtIso(completions, cadence, nowMs),
        lastCompletedAtIso: getLatestRegulationReviewCompletedAtIso(completions),
        status: isSatisfied ? 'completed' : 'open',
        missingInstruments
      } satisfies RegulationReviewDueItem
    })
    .filter((item): item is RegulationReviewDueItem => Boolean(item))
}

export function buildRegulationMilestoneLabel(stabilizedAtIso: string) {
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(stabilizedAtIso))
  return `${REGULATION_MILESTONE_LABEL_PREFIX} (${dateLabel})`
}

export function isRegulationMilestoneRouteLog(log: Pick<RouteLogEvent, 'label' | 'milestoneType' | 'phase'>) {
  return (
    log.phase === 'regulation' &&
    log.milestoneType === 'verifiedMilestone' &&
    log.label.trim().toLowerCase().startsWith(REGULATION_MILESTONE_LABEL_PREFIX.toLowerCase())
  )
}

export function hasOpenRegulationMilestoneForStabilization(
  logs: RouteLogEvent[],
  enrolleeId: string,
  stabilizedAtIso: string
) {
  const stabilizedMs = new Date(stabilizedAtIso).getTime()
  return logs.some((log) => {
    if (log.enrolleeId !== enrolleeId || !isRegulationMilestoneRouteLog(log)) return false
    // Treat an existing Z75 Lucid stop at/after the current stabilization time as already logged
    // so re-saving the same passing pair does not duplicate the stop.
    return new Date(log.timestampIso).getTime() >= stabilizedMs - DAY_IN_MS
  })
}

export function buildRegulationMilestoneRouteLog(input: {
  enrolleeId: string
  stabilizedAtIso: string
}): RouteLogEvent {
  return {
    id: `reg-milestone-z75-${input.enrolleeId}-${new Date(input.stabilizedAtIso).getTime()}`,
    enrolleeId: input.enrolleeId,
    label: buildRegulationMilestoneLabel(input.stabilizedAtIso),
    timestampIso: input.stabilizedAtIso,
    status: 'completed',
    phase: 'regulation',
    milestoneType: 'verifiedMilestone',
    domainsRelieved: ['health'],
    stationIcon: 'check'
  }
}

/**
 * Strip marker for the Tacoma Z75 / Lucid regulation stop so the milestone appears with
 * other resolved Z-code stops once SVS + MH-SCA are both currently passing.
 */
export function buildRegulationZ75StripMarker(input: {
  enrolleeId: string
  stabilizedAtIso: string
}): ResolvedZCodeStripMarker {
  return {
    id: `regulation-z75-${input.enrolleeId}`,
    parentCode: TACOMA_REGULATION_PROVIDER.parentCode,
    zCode: TACOMA_REGULATION_PROVIDER.zCode,
    description: 'SVS and MH-SCA stabilized under Lucid regulation support',
    resolvedAtIso: input.stabilizedAtIso,
    partnerName: TACOMA_REGULATION_PROVIDER.providerDisplayName,
    resolutionNote: 'Regulation milestone logged under Z75 (Tacoma · Lucid).'
  }
}
