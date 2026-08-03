import type {
  EnrolleeProfile,
  PartnerStripAggregateDot,
  PartnerStripHistoryRecord,
  RegulationTestSubmissionRecord,
  RouteAssignmentRecord,
  RouteLogEvent,
  StabilizationPhase,
  UnassignedEnrolleePickupRecord
} from '@/features/atlas2026/shared/contracts'
import { normalizeOrganizationKey } from '@/features/atlas2026/singlepane/domain/dates'
import {
  buildZCodeTimelineShortLabel,
  getEnrollmentJourneyPhase,
  getPhaseEntryIso,
  normalizeZCode
} from '@/features/atlas2026/singlepane/domain/loadsRoutes'

interface ServiceCapacityPromptSummary {
  parentCode?: string
  title?: string
  description?: string
}

interface BuildPartnerStripJourneyInput {
  isPartnerStationView: boolean
  partnerOrganizationName: string
  pickupQueue: UnassignedEnrolleePickupRecord[]
  logs: RouteLogEvent[]
  scopedEnrolleeIdSet: Set<string>
  regulationTestHistory: RegulationTestSubmissionRecord[]
  routeAssignmentsByEnrolleeId: Record<string, RouteAssignmentRecord>
  scopedEnrollees: EnrolleeProfile[]
  serviceCapacityPromptByNormalizedZCode: Map<string, ServiceCapacityPromptSummary>
}

export interface PartnerStripJourneyModel {
  referredDots: PartnerStripAggregateDot[]
  activeDots: PartnerStripAggregateDot[]
  successHistory: PartnerStripHistoryRecord[]
}

/**
 * Builds the partner strip-map projection without owning React state. The projection
 * intentionally anonymizes participant labels while retaining enrollee identifiers for
 * authorized drill-down behavior in the existing partner workspace.
 */
export function buildPartnerStripJourneyModel({
  isPartnerStationView,
  partnerOrganizationName,
  pickupQueue,
  logs,
  scopedEnrolleeIdSet,
  regulationTestHistory,
  routeAssignmentsByEnrolleeId,
  scopedEnrollees,
  serviceCapacityPromptByNormalizedZCode
}: BuildPartnerStripJourneyInput): PartnerStripJourneyModel {
  if (!isPartnerStationView) {
    return { referredDots: [], activeDots: [], successHistory: [] }
  }

  const normalizedPartnerOrganization = normalizeOrganizationKey(partnerOrganizationName)
  const partnerReferralRecords = pickupQueue.filter((record) => {
    if (record.status === 'archived') return false
    if (!normalizedPartnerOrganization) return true
    return normalizeOrganizationKey(record.referrerOrganization) === normalizedPartnerOrganization
  })
  const referralIsoByCaseId = new Map(
    partnerReferralRecords
      .filter((record) => record.caseId.trim())
      .map((record) => [record.caseId.trim().toLowerCase(), record.referredAtIso] as const)
  )
  const scopedLogsByEnrolleeId = new Map<string, RouteLogEvent[]>()
  logs.forEach((log) => {
    if (!scopedEnrolleeIdSet.has(log.enrolleeId)) return
    const current = scopedLogsByEnrolleeId.get(log.enrolleeId) || []
    current.push(log)
    scopedLogsByEnrolleeId.set(log.enrolleeId, current)
  })
  scopedLogsByEnrolleeId.forEach((value, key) => {
    value.sort((left, right) => new Date(left.timestampIso).getTime() - new Date(right.timestampIso).getTime())
    scopedLogsByEnrolleeId.set(key, value)
  })
  const regulationByEnrollmentId = new Map<string, RegulationTestSubmissionRecord[]>()
  regulationTestHistory.forEach((record) => {
    const enrollmentId = (record.enrollmentId || '').trim()
    if (!enrollmentId) return
    const current = regulationByEnrollmentId.get(enrollmentId) || []
    current.push(record)
    regulationByEnrollmentId.set(enrollmentId, current)
  })
  regulationByEnrollmentId.forEach((value, key) => {
    value.sort((left, right) => new Date(left.updatedAtIso).getTime() - new Date(right.updatedAtIso).getTime())
    regulationByEnrollmentId.set(key, value)
  })

  const referredDots: PartnerStripAggregateDot[] = []
  const activeDots: PartnerStripAggregateDot[] = []
  const successHistory: PartnerStripHistoryRecord[] = []
  const orderedEnrollees = scopedEnrollees
    .slice()
    .sort((left, right) =>
      String(left.caseId || left.id).localeCompare(String(right.caseId || right.id), undefined, { numeric: true })
    )

  orderedEnrollees.forEach((enrollee, index) => {
    const logsForEnrollee = (scopedLogsByEnrolleeId.get(enrollee.id) || [])
      .slice()
      .sort((left, right) => new Date(left.timestampIso).getTime() - new Date(right.timestampIso).getTime())
    const routeAssignment = routeAssignmentsByEnrolleeId[enrollee.id] || null
    const enrollmentId = (enrollee.enrollmentId || '').trim()
    const completedRegulationForEnrollee = (regulationByEnrollmentId.get(enrollmentId) || []).filter(
      (record) =>
        record.status === 'completed' &&
        record.passed !== null &&
        (record.testType === 'mh_sca' || record.testType === 'svs')
    )
    const latestMhSca = [...completedRegulationForEnrollee].reverse().find((record) => record.testType === 'mh_sca')
    const latestSvs = [...completedRegulationForEnrollee].reverse().find((record) => record.testType === 'svs')
    const regulationClearedAtIso =
      latestMhSca?.passed && latestSvs?.passed
        ? [latestMhSca.updatedAtIso, latestSvs.updatedAtIso].sort(
            (left, right) => new Date(right).getTime() - new Date(left).getTime()
          )[0]
        : null
    const inferredPhaseFromLogs = getEnrollmentJourneyPhase(logsForEnrollee, 'regulation')
    const hasRenewalEvidence =
      routeAssignment?.phase === 'renewal' ||
      enrollee.currentPhase === 'renewal' ||
      logsForEnrollee.some((record) => record.phase === 'renewal')
    const effectivePhase: StabilizationPhase = hasRenewalEvidence
      ? 'renewal'
      : regulationClearedAtIso
        ? 'readiness'
        : routeAssignment?.phase || enrollee.currentPhase || inferredPhaseFromLogs
    const referralIsoFromQueue = referralIsoByCaseId.get((enrollee.caseId || '').trim().toLowerCase()) || null
    const explicitPhaseEntryIso = logsForEnrollee.find((log) => log.phase === effectivePhase)?.timestampIso || null
    const phaseEntryIso = explicitPhaseEntryIso || (effectivePhase === 'readiness' ? regulationClearedAtIso : null)
    const occurredAtIso = phaseEntryIso || routeAssignment?.assignedAtIso || referralIsoFromQueue || new Date().toISOString()
    const anonymousLabel = `participant-${String(index + 1).padStart(3, '0')}`
    const enrolleeName = enrollee.fullName?.trim() || anonymousLabel

    if (hasRenewalEvidence) {
      successHistory.push({
        id: `success-${enrollee.id}`,
        source: 'referred',
        reachedRenewalAtIso: getPhaseEntryIso(logsForEnrollee, 'renewal'),
        outcomeLabel: 'renewal reached',
        anonymousLabel
      })
    }

    const unresolvedActiveDetails = enrollee.activeZCodeDetails.filter((detail) => !detail.isResolved)
    const resolvedActiveDetails = enrollee.activeZCodeDetails
      .filter((detail) => detail.isResolved)
      .slice()
      .sort(
        (left, right) => new Date(right.resolutionAt || 0).getTime() - new Date(left.resolutionAt || 0).getTime()
      )
    const prioritizedActiveDetails = unresolvedActiveDetails.length ? unresolvedActiveDetails : resolvedActiveDetails
    const zCodeDetailsFromActive = prioritizedActiveDetails
      .map((detail) => ({
        enrolleeZCodeId: detail.enrolleeZCodeId,
        parentCode: detail.parentCode.trim().toUpperCase(),
        zCode: normalizeZCode(detail.zCode),
        description: (detail.description || detail.title || detail.zCode).trim()
      }))
      .filter((detail) => detail.parentCode && detail.zCode)
    const zCodeDetailsFromTags = enrollee.zCodeTags
      .map((tag) => normalizeZCode(tag))
      .filter(Boolean)
      .map((normalizedZCode) => {
        const prompt = serviceCapacityPromptByNormalizedZCode.get(normalizedZCode)
        return {
          enrolleeZCodeId: undefined,
          parentCode: (prompt?.parentCode || normalizedZCode.split('.')[0] || '').trim().toUpperCase(),
          zCode: normalizedZCode,
          description: (prompt?.description || prompt?.title || normalizedZCode).trim()
        }
      })
      .filter((detail) => detail.parentCode && detail.zCode)
    const rawTimelineDetails = zCodeDetailsFromActive.length ? zCodeDetailsFromActive : zCodeDetailsFromTags
    const timelineDetails = Array.from(
      new Map(rawTimelineDetails.map((detail) => [`${detail.parentCode}:${detail.zCode}`, detail])).values()
    )

    timelineDetails.forEach((detail) => {
      const sharedDot = {
        phase: effectivePhase,
        anonymousLabel,
        enrolleeId: enrollee.id,
        enrolleeName,
        enrolleeZCodeId: detail.enrolleeZCodeId,
        parentCode: detail.parentCode,
        zCode: detail.zCode,
        zCodeDescription: detail.description,
        zCodeShortLabel: buildZCodeTimelineShortLabel(detail.description, detail.zCode)
      }
      referredDots.push({
        ...sharedDot,
        id: `referred-${enrollee.id}-${detail.zCode}`,
        source: 'referred',
        occurredAtIso
      })
      if (routeAssignment) {
        activeDots.push({
          ...sharedDot,
          id: `active-${enrollee.id}-${detail.zCode}`,
          source: 'active',
          occurredAtIso: phaseEntryIso || routeAssignment.assignedAtIso || occurredAtIso
        })
      }
    })
  })

  successHistory.sort(
    (left, right) => new Date(right.reachedRenewalAtIso).getTime() - new Date(left.reachedRenewalAtIso).getTime()
  )
  return { referredDots, activeDots, successHistory }
}
