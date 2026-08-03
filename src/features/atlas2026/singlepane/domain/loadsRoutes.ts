import type {
  DomainLoad,
  DomainLoadBreakdown,
  EnrolleeBurdenSurveySubmissionRecord,
  EnrolleeProfile,
  IntervalAssessmentDueItem,
  IntervalAssessmentRule,
  NavigatorCompetencyAssessmentRecord,
  NavigatorLoadContributor,
  NavigatorSelfAssessmentRecord,
  RouteCandidateRecord,
  RouteLogEvent,
  StabilizationPhase,
  SupervisionSessionRecord,
  ZDomain
} from '@/features/atlas2026/shared/contracts'
import { mapZCodeToDomainBucket } from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { getWeekStartIso } from '@/features/atlas2026/singlepane/domain/dates'

export const DOMAIN_BY_ACTION: Record<string, ZDomain[]> = {
  'route planning': ['housing', 'work'],
  'log contact': ['social'],
  'append route step': ['health', 'social'],
  'escalate risk': ['legal', 'health'],
  'submit service update': ['housing'],
  'confirm milestone': ['work'],
  'request support': ['social', 'health'],
  'record navigator assessment': ['education', 'social'],
  'set policy threshold': ['legal'],
  'approve route template': ['education'],
  'audit event logs': ['legal', 'social']
}
export function getEnrollmentJourneyPhase(logs: RouteLogEvent[], fallback: StabilizationPhase = 'regulation'): StabilizationPhase {
  if (!logs.length) return fallback
  return logs[logs.length - 1]?.phase || fallback
}

export function getPhaseEntryIso(logs: RouteLogEvent[], phase: StabilizationPhase) {
  const first = logs.find((log) => log.phase === phase)
  if (first) return first.timestampIso
  const last = logs[logs.length - 1]
  return last?.timestampIso || new Date().toISOString()
}
export function cadenceDays(cadence: IntervalAssessmentRule['cadence']) {
  if (cadence === 'weekly') return 7
  if (cadence === 'monthly') return 30
  return 90
}

export function loadImageElement(objectUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to process image file.'))
    image.src = objectUrl
  })
}

/**
 * Offline / unsigned-in fallback: shrink the photo before writing a data Uniform Resource Locator (URL) so
 * account settings never exceed browser localStorage quota (QuotaExceededError).
 */
export async function compressImageToDataUrl(file: File, maxEdge = 512, quality = 0.82) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImageElement(objectUrl)
    const scale = Math.min(1, maxEdge / Math.max(image.width || 1, image.height || 1))
    const width = Math.max(1, Math.round((image.width || 1) * scale))
    const height = Math.max(1, Math.round((image.height || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to process image file.')
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function buildIntervalDueItems(
  rules: IntervalAssessmentRule[],
  selfAssessments: NavigatorSelfAssessmentRecord[],
  supervisionSessions: SupervisionSessionRecord[],
  competency: NavigatorCompetencyAssessmentRecord[]
): IntervalAssessmentDueItem[] {
  const today = new Date()
  return rules
    .filter((rule) => rule.isActive)
    .map((rule) => {
      const dueDate = new Date(rule.startsAtIso)
      while (dueDate.getTime() + cadenceDays(rule.cadence) * 24 * 60 * 60 * 1000 < today.getTime()) {
        dueDate.setUTCDate(dueDate.getUTCDate() + cadenceDays(rule.cadence))
      }
      const status =
        rule.assessmentType === 'navigator_self_assessment'
          ? selfAssessments.some((record) => record.weekStartIso === getWeekStartIso(dueDate.toISOString()))
          : rule.assessmentType === 'supervision_session'
            ? supervisionSessions.some((record) => getWeekStartIso(record.sessionAtIso) === getWeekStartIso(dueDate.toISOString()))
            : competency.some((record) => new Date(record.submittedAtIso).getTime() >= dueDate.getTime())
      return {
        id: `due-${rule.id}`,
        ruleId: rule.id,
        title: rule.title,
        assessmentType: rule.assessmentType,
        navigatorName: rule.navigatorName,
        dueAtIso: dueDate.toISOString(),
        cadence: rule.cadence,
        status: status ? 'completed' : 'open'
      } satisfies IntervalAssessmentDueItem
    })
}

export function deriveNavigatorLoad(loads: DomainLoad[]): DomainLoad | null {
  if (!loads.length) return null
  const totals = loads.reduce(
    (sum, load) => {
      sum.habitat += load.habitat
      sum.work += load.work
      sum.socialNetworks += load.socialNetworks
      return sum
    },
    { habitat: 0, work: 0, socialNetworks: 0 }
  )
  return {
    enrolleeId: 'navigator-aggregate',
    habitat: totals.habitat / loads.length,
    work: totals.work / loads.length,
    socialNetworks: totals.socialNetworks / loads.length
  }
}

export function deriveNavigatorLoadContributors(enrollees: EnrolleeProfile[], loads: DomainLoad[]): NavigatorLoadContributor[] {
  if (!enrollees.length || !loads.length) return []
  const loadsByEnrolleeId = new Map(loads.map((load) => [load.enrolleeId, load]))
  return enrollees
    .map((enrollee) => {
      const load = loadsByEnrolleeId.get(enrollee.id)
      if (!load) return null
      return {
        enrolleeId: enrollee.id,
        enrolleeName: enrollee.fullName,
        habitat: load.habitat,
        work: load.work,
        socialNetworks: load.socialNetworks
      } satisfies NavigatorLoadContributor
    })
    .filter((item): item is NavigatorLoadContributor => Boolean(item))
}

export function deriveNavigatorLoadBreakdown(loadBreakdowns: Record<string, DomainLoadBreakdown>, navigatorName: string): DomainLoadBreakdown | null {
  const values = Object.values(loadBreakdowns)
  if (!values.length) return null
  const groupedRows = new Map<string, DomainLoadBreakdown['rows'][number] & { sampleCount: number }>()
  values.flatMap((breakdown) => breakdown.rows).forEach((row) => {
    const key = `${row.zCodeGroup}:${row.mappedDomain}`
    const existing = groupedRows.get(key)
    if (!existing) {
      groupedRows.set(key, {
        ...row,
        sampleCount: 1,
        specializeCount: row.specializeCount || 0,
        interfereCount: row.interfereCount || 0
      })
      return
    }
    existing.rawCount += row.rawCount
    existing.specializeCount = (existing.specializeCount || 0) + (row.specializeCount || 0)
    existing.interfereCount = (existing.interfereCount || 0) + (row.interfereCount || 0)
    existing.sampleCount += 1
  })
  const rows = Array.from(groupedRows.values()).map((row, index) => ({
    ...row,
    id: `${row.id}:${index}`,
    rawCount: row.rawCount / row.sampleCount,
    specializeCount: row.specializeCount ? row.specializeCount / row.sampleCount : undefined,
    interfereCount: row.interfereCount ? row.interfereCount / row.sampleCount : undefined,
    responseCount: row.sampleCount,
    // Aggregate rows blend multiple enrollees, so a single "true record" pointer
    // would be misleading; keep drilldown disabled at this level.
    drilldownTarget: undefined
  }))
  // Navigator my-profile summaries must reflect the average of assigned enrollees'
  // domain totals (same basis as navigatorAggregateLoad), not the average of grouped
  // Z-code rows. Grouped rows are for audit visibility only.
  const totals = {
    habitatTotal: values.reduce((sum, breakdown) => sum + (breakdown.habitatTotal || 0), 0) / values.length,
    workTotal: values.reduce((sum, breakdown) => sum + (breakdown.workTotal || 0), 0) / values.length,
    socialNetworksTotal: values.reduce((sum, breakdown) => sum + (breakdown.socialNetworksTotal || 0), 0) / values.length
  }
  return {
    subjectId: 'navigator-aggregate',
    subjectLabel: navigatorName,
    sourceKind: values.some((breakdown) => breakdown.sourceKind === 'enrolleeSurvey') ? 'enrolleeSurvey' : 'enrolleeRecords',
    sourceLabel: 'Assigned enrollee aggregate',
    ...totals,
    rows
  }
}

export function normalizeZCode(value: string) {
  return value.trim().toUpperCase()
}

export function buildZCodeTimelineShortLabel(description: string, fallbackCode: string) {
  const normalized = description.trim()
  if (!normalized) return fallbackCode
  const cleaned = normalized
    .replace(/\b(and|or|with|without|related|problem|problems|specified|unspecified|other|to|of|the|in)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(Boolean)
  if (!words.length) return fallbackCode
  if (words.length === 1) {
    const single = words[0]
    return single.length <= 18 ? single : `${single.slice(0, 17)}...`
  }
  const shorthand = words
    .slice(0, 4)
    .map((word) => {
      if (word.length <= 4) return word
      return `${word.slice(0, 4)}.`
    })
    .join(' ')
  return shorthand.length <= 24 ? shorthand : `${shorthand.slice(0, 23)}...`
}

export function buildNavigatorRouteBoardLoadBreakdown(
  selectedEnrollee: EnrolleeProfile | null,
  routeCandidates: RouteCandidateRecord[]
): DomainLoadBreakdown | null {
  if (!selectedEnrollee) return null
  if (!routeCandidates.length) return null

  const rows = selectedEnrollee.activeZCodeDetails
    .map((detail) => {
      const normalizedParentCode = detail.parentCode.trim().toUpperCase()
      const normalizedZCode = normalizeZCode(detail.zCode)
      if (!normalizedParentCode || !normalizedZCode) return null
      const partnerScoreTrace = routeCandidates.map((candidate) => {
        const matchingSummary = candidate.matchedParentSummaries.find((summary) => {
          if (summary.parentCode.trim().toUpperCase() !== normalizedParentCode) return false
          const childZCodes = summary.matchedChildZCodes.map((code) => normalizeZCode(code))
          if (childZCodes.length) return childZCodes.includes(normalizedZCode)
          return true
        })
        const candidateStrength = matchingSummary && matchingSummary.avgBurdenScore > 0 ? matchingSummary.avgBurdenScore : 0
        return {
          partnerId: candidate.partnerId || null,
          partnerLabel: candidate.stationName,
          score: candidateStrength
        }
      })
      const cumulativeStrength = partnerScoreTrace.reduce((sum, traceRow) => sum + traceRow.score, 0)
      const averageStrength = routeCandidates.length ? cumulativeStrength / routeCandidates.length : 0
      // Higher partner strength means lower burden on the enrollee axis.
      const invertedBurden = Math.max(1, Math.min(9, 10 - averageStrength))
      return {
        id: `route-board:${detail.enrolleeZCodeId}`,
        zCodeGroup: normalizedZCode,
        parentCode: normalizedParentCode,
        mappedDomain: mapZCodeToDomainBucket(normalizedParentCode, normalizedZCode),
        rawCount: invertedBurden,
        responseCount: routeCandidates.length,
        partnerScoreTrace,
        averagePartnerStrength: averageStrength,
        // Route-board projections are still anchored to one canonical enrollee
        // Z-code row; this keeps "open true record" focused on editable source data.
        drilldownTarget: {
          kind: 'enrolleeZCode',
          enrolleeId: selectedEnrollee.id,
          enrollmentId: selectedEnrollee.enrollmentId,
          enrolleeZCodeId: detail.enrolleeZCodeId,
          normalizedZCode
        }
      } satisfies DomainLoadBreakdown['rows'][number]
    })
    .filter(Boolean) as DomainLoadBreakdown['rows']

  if (!rows.length) return null

  const habitatRows = rows.filter((row) => row.mappedDomain === 'habitat')
  const workRows = rows.filter((row) => row.mappedDomain === 'work')
  const socialRows = rows.filter((row) => row.mappedDomain === 'socialNetworks')

  return {
    subjectId: selectedEnrollee.id,
    subjectLabel: selectedEnrollee.fullName,
    sourceKind: 'enrolleeRecords',
    sourceLabel: `route-board capacity inversion · ${routeCandidates.length} prospective partners`,
    habitatTotal: habitatRows.length ? habitatRows.reduce((sum, row) => sum + row.rawCount, 0) / habitatRows.length : 0,
    workTotal: workRows.length ? workRows.reduce((sum, row) => sum + row.rawCount, 0) / workRows.length : 0,
    socialNetworksTotal: socialRows.length ? socialRows.reduce((sum, row) => sum + row.rawCount, 0) / socialRows.length : 0,
    rows
  }
}

export function getEnrolleeSurveySortTime(record: EnrolleeBurdenSurveySubmissionRecord) {
  return new Date(record.updatedAtIso || record.submittedAtIso).getTime()
}

export function upsertEnrolleeBurdenSurveyHistory(
  history: EnrolleeBurdenSurveySubmissionRecord[],
  saved: EnrolleeBurdenSurveySubmissionRecord
) {
  return history
    .filter((record) => record.id !== saved.id && record.draftKey !== saved.draftKey)
    .concat(saved)
    .sort((left, right) => getEnrolleeSurveySortTime(right) - getEnrolleeSurveySortTime(left))
}
