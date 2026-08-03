import type {
  CreateSessionRecord,
  EnrolleeProfile,
  EnrollmentRequestRecord,
  IpsCompetencySelfAssessmentRecord,
  IpsccCompetencyKey,
  IpsccEncounterSubmissionRecord,
  IntervalAssessmentRule,
  NavigatorProgramState,
  NavigatorSelfAssessmentRecord,
  SupervisorIpsAssessmentRecord,
  SupervisionSessionRecord,
  UnassignedEnrolleePickupRecord
} from '@/features/atlas2026/shared/contracts'
import { IPSCC_COMPETENCY_DEFINITIONS } from '@/features/atlas2026/singlepane/data/intentionalPeerSupportCatalog'
import { getWeekStartIso, toMidnightIso } from '@/features/atlas2026/singlepane/domain/dates'

// Intentional Peer Support Core Competencies (IPSCC) seed data supports stable pilot demonstrations.
export const IPSCC_ITEM_COUNT = 10
/** Legacy two-row seed ids — replaced by the pilot 10-submission improving series. */
export const IPSCC_LEGACY_ENCOUNTER_SEED_PREFIX = 'ipscc-seed-'
/** Stable pilot seed ids so merge can refresh the series without wiping live submissions. */
export const IPSCC_PILOT_ENCOUNTER_SEED_PREFIX = 'ipscc-pilot-seed-'

export function clampLikertScore(value: number) {
  if (!Number.isFinite(value)) return 3
  return Math.max(1, Math.min(5, Math.round(value)))
}

/**
 * Encounter submissions store one score per Intentional Peer Support Core Competencies
 * (IPSCC) competency in catalog order (index 0 = competency 1). Older rows that used a
 * guessed multi-item mapping still reduce to one score per competency via itemIndexes.
 */
export function mapItemScoresToCompetencyScores(itemScores: number[]): Partial<Record<IpsccCompetencyKey, number>> {
  const normalized = Array.from({ length: IPSCC_ITEM_COUNT }, (_, index) => clampLikertScore(itemScores[index] ?? 3))
  return Object.fromEntries(
    IPSCC_COMPETENCY_DEFINITIONS.map((definition) => {
      const values = definition.itemIndexes.map((itemIndex) => normalized[itemIndex - 1]).filter(Number.isFinite)
      const average = values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null
      return [definition.key, average]
    })
  ) as Partial<Record<IpsccCompetencyKey, number>>
}

/**
 * Ten encounter submissions from a single enrollee for the pilot navigator.
 * Scores rise over ~9 weeks so admin and privacy-unlocked averages show improving
 * enrollee opinion of the navigator (also unlocks the ~10-entry anonymity floor).
 */
export function buildSeedIpsccEncounterSubmissions(
  navigatorName: string,
  enrollees: EnrolleeProfile[]
): IpsccEncounterSubmissionRecord[] {
  const enrollee = enrollees[0]
  if (!enrollee) return []
  const now = new Date()
  return Array.from({ length: 10 }, (_, index) => {
    // index 0 = oldest / lowest opinion; index 9 = most recent / highest opinion
    const submittedAt = new Date(now)
    submittedAt.setUTCDate(submittedAt.getUTCDate() - (9 - index) * 7)
    // Climb from roughly 2.1 toward 4.7 across the series with light per-competency variance.
    const progress = index / 9
    const center = 2.1 + progress * 2.6
    const itemScores = Array.from({ length: IPSCC_ITEM_COUNT }, (_, scoreIndex) => {
      const wobble = ((scoreIndex + index) % 3) - 1
      return clampLikertScore(center + wobble * 0.35)
    })
    return {
      id: `${IPSCC_PILOT_ENCOUNTER_SEED_PREFIX}${index + 1}`,
      navigatorName,
      enrolleeId: enrollee.id,
      enrolleeName: enrollee.fullName,
      enrollmentId: enrollee.enrollmentId || null,
      submittedAtIso: submittedAt.toISOString(),
      submittedBy: 'enrollee',
      itemScores,
      note:
        index === 0
          ? 'Pilot enrollee early encounter — cautious ratings.'
          : index === 9
            ? 'Pilot enrollee latest encounter — clear improvement in opinion of navigator.'
            : `Pilot enrollee encounter ${index + 1} of 10 — opinion trending upward.`
    }
  })
}

/**
 * Keep live (non-seed) IPSCC rows, and always refresh the pilot 10-submission
 * improving series so demos unlock privacy averages and show opinion lift.
 */
export function mergeIpsccEncounterSubmissions(
  existing: IpsccEncounterSubmissionRecord[],
  navigatorName: string,
  enrollees: EnrolleeProfile[]
): IpsccEncounterSubmissionRecord[] {
  const liveRows = existing.filter(
    (record) =>
      !record.id.startsWith(IPSCC_LEGACY_ENCOUNTER_SEED_PREFIX) &&
      !record.id.startsWith(IPSCC_PILOT_ENCOUNTER_SEED_PREFIX)
  )
  const pilotSeries = buildSeedIpsccEncounterSubmissions(navigatorName, enrollees)
  if (!pilotSeries.length) return liveRows.length ? liveRows : existing
  return [...liveRows, ...pilotSeries].sort(
    (left, right) => new Date(left.submittedAtIso).getTime() - new Date(right.submittedAtIso).getTime()
  )
}

export function buildSeedIpsSelfAssessments(navigatorName: string): IpsCompetencySelfAssessmentRecord[] {
  const now = new Date()
  return [0, 7].map((daysAgo, index) => {
    const submittedAt = new Date(now)
    submittedAt.setUTCDate(submittedAt.getUTCDate() - daysAgo)
    return {
      id: `ips-self-${index + 1}`,
      navigatorName,
      weekStartIso: getWeekStartIso(submittedAt.toISOString()),
      submittedAtIso: submittedAt.toISOString(),
      competencyScores: Object.fromEntries(
        IPSCC_COMPETENCY_DEFINITIONS.map((definition, competencyIndex) => [
          definition.key,
          clampLikertScore(4 - ((index + competencyIndex) % 2))
        ])
      ) as Partial<Record<IpsccCompetencyKey, number>>,
      note: 'Seeded weekly pre-supervision self-assessment.'
    }
  })
}

export function buildSeedSupervisorIpsAssessments(
  navigatorName: string,
  supervisorName: string
): SupervisorIpsAssessmentRecord[] {
  const now = new Date()
  return [2, 9].map((daysAgo, index) => {
    const submittedAt = new Date(now)
    submittedAt.setUTCDate(submittedAt.getUTCDate() - daysAgo)
    return {
      id: `supervisor-ips-${index + 1}`,
      supervisorName,
      navigatorName,
      weekStartIso: getWeekStartIso(submittedAt.toISOString()),
      submittedAtIso: submittedAt.toISOString(),
      competencyScores: Object.fromEntries(
        IPSCC_COMPETENCY_DEFINITIONS.map((definition, competencyIndex) => [
          definition.key,
          clampLikertScore(4 - ((index + competencyIndex + 1) % 2))
        ])
      ) as Partial<Record<IpsccCompetencyKey, number>>,
      note: 'Seeded supervisor IPS assessment for comparison trend continuity.'
    }
  })
}

export function buildSeedCreateSessions(navigatorName: string): CreateSessionRecord[] {
  const now = new Date()
  return [5, 12].map((daysAgo, index) => {
    const sessionAt = new Date(now)
    sessionAt.setUTCDate(sessionAt.getUTCDate() - daysAgo)
    return {
      id: `create-session-${index + 1}`,
      navigatorName,
      supervisorName: 'peer supervisor',
      sessionAtIso: sessionAt.toISOString(),
      submittedAtIso: sessionAt.toISOString(),
      supervisionMode: 'in_person',
      sessionDurationMinutes: 50,
      connectFocusedListening: true,
      recognizeNotes: index === 0 ? 'Strong rapport built with new enrollees.' : 'Consistent follow-through with existing enrollees.',
      encourageNotes: 'Discussed current stuck points and brainstormed concrete options.',
      acknowledgeNotes: 'Highlighted initiative and advocacy in team communication.',
      trainNotes: 'Identified next learning resources and process confidence needs.',
      empowerNotes: 'Reviewed materials/time support needed to execute the work.',
      createActionPlan: 'Apply the discussed supervision commitments before next session.',
      supervisorSubmission: 'Supervisor reinforced strengths-based coaching focus.',
      superviseeSubmission: 'Navigator requested tighter feedback loops on difficult encounters.',
      peerSpecialistSignature: navigatorName,
      peerSpecialistSignedAtIso: sessionAt.toISOString(),
      supervisorSignature: 'peer supervisor',
      supervisorSignedAtIso: sessionAt.toISOString()
    }
  })
}

export function createNavigatorProgramState(): NavigatorProgramState {
  return {
    pickupQueue: [],
    selfAssessments: [],
    ipsSelfAssessments: [],
    supervisorIpsAssessments: [],
    ipsccEncounterSubmissions: [],
    createSessions: [],
    supervisionSessions: [],
    intervalAssessmentRules: [],
    updatedAtIso: new Date().toISOString()
  }
}
export function buildSeedPickupQueue(enrollmentRequests: EnrollmentRequestRecord[]): UnassignedEnrolleePickupRecord[] {
  return enrollmentRequests.map((request, index) => ({
    id: `pickup-${request.id}`,
    fullName: request.prospectiveEnrollee,
    dob: '',
    caseId: `atlas-intake-${index + 1}`.padEnd(12, '0'),
    email: request.email || '',
    phone: '',
    demographicsSummary: 'Demographics pending intake confirmation.',
    referredAtIso: request.submittedAt,
    referrerName: 'atlas referral intake',
    referrerOrganization: 'community referral network',
    backgroundNotes: request.status === 'assigned'
      ? 'Referral already assigned and awaiting navigator follow-through.'
      : 'Referral captured through Atlas intake; additional background details pending.',
    referrerMessage: 'Initial enrollee interest captured in referral intake. Review and claim if appropriate.',
    zCodeTags: [],
    status: request.status === 'assigned' ? 'claimed' : 'available',
    claimedByNavigatorName: null,
    claimedAtIso: null
  }))
}

export function buildSeedSelfAssessments(navigatorName: string): NavigatorSelfAssessmentRecord[] {
  const now = new Date()
  return [0, 7, 14].map((daysAgo, index) => {
    const submitted = new Date(now)
    submitted.setUTCDate(submitted.getUTCDate() - daysAgo)
    return {
      id: `self-assessment-${index + 1}`,
      navigatorName,
      weekStartIso: getWeekStartIso(submitted.toISOString()),
      submittedAtIso: submitted.toISOString(),
      stressLoadScore: 3 + (index % 2),
      confidenceScore: 4 - (index % 2),
      supportScore: 4,
      note: index === 0 ? 'Current caseload manageable with supervisor check-ins.' : 'Tracked as seeded historical weekly assessment.'
    }
  })
}

export function buildSeedSupervisionSessions(navigatorName: string): SupervisionSessionRecord[] {
  const now = new Date()
  return [5, 19].map((daysAgo, index) => {
    const sessionDate = new Date(now)
    sessionDate.setUTCDate(sessionDate.getUTCDate() - daysAgo)
    return {
      id: `supervision-${index + 1}`,
      navigatorName,
      supervisorName: 'peer supervisor',
      sessionAtIso: sessionDate.toISOString(),
      status: 'completed',
      supervisorNote: index === 0 ? 'Strong readiness planning judgment; continue documenting partner follow-through.' : 'Reviewed active caseload patterns and escalation discipline.',
      navigatorNote: index === 0 ? 'Need faster way to flag housing instability earlier in intake.' : '',
      actionItems: index === 0 ? 'Pilot earlier housing-risk review on new enrollees.' : 'Continue weekly self-assessment submissions.'
    }
  })
}

export function buildSeedIntervalRules(navigatorName: string): IntervalAssessmentRule[] {
  const startsAtIso = toMidnightIso(new Date())
  return [
    {
      id: 'rule-weekly-self-assessment',
      title: 'Weekly self assessment',
      assessmentType: 'navigator_self_assessment',
      assigneeRole: 'navigator',
      navigatorName,
      cadence: 'weekly',
      startsAtIso,
      weekday: 1,
      isActive: true,
      instructions: 'Every Monday, record stress load, confidence, and support for the prior week.',
      lastGeneratedAtIso: null
    },
    {
      id: 'rule-monthly-supervision',
      title: 'Monthly supervision session',
      assessmentType: 'supervision_session',
      assigneeRole: 'supervisor',
      navigatorName,
      cadence: 'monthly',
      startsAtIso,
      weekday: null,
      isActive: true,
      instructions: 'Schedule one completed supervision session per month with notes from both parties.',
      lastGeneratedAtIso: null
    },
    {
      id: 'rule-quarterly-competency',
      title: 'Quarterly navigator competency review',
      assessmentType: 'navigator_competency_review',
      assigneeRole: 'supervisor',
      navigatorName,
      cadence: 'quarterly',
      startsAtIso,
      weekday: null,
      isActive: true,
      instructions: 'Supervisor submits a competency assessment once per quarter.',
      lastGeneratedAtIso: null
    }
  ]
}

export function mergeNavigatorProgramState(
  rawState: NavigatorProgramState | null,
  navigatorName: string,
  supervisorName: string,
  enrollees: EnrolleeProfile[],
  enrollmentRequests: EnrollmentRequestRecord[],
  publicQueueRecords: UnassignedEnrolleePickupRecord[]
): NavigatorProgramState {
  const base = rawState || createNavigatorProgramState()
  // Persisted queue first so accept/archive/claim updates are not overwritten by the
  // last public/remote fetch snapshot when both sources share the same record id.
  const mergedPickupQueue = [...base.pickupQueue, ...publicQueueRecords]
    .filter(Boolean)
    .filter((record, index, records) => records.findIndex((candidate) => candidate.id === record.id) === index)
  return {
    pickupQueue: mergedPickupQueue.length ? mergedPickupQueue : buildSeedPickupQueue(enrollmentRequests),
    selfAssessments: base.selfAssessments.length ? base.selfAssessments : buildSeedSelfAssessments(navigatorName),
    ipsSelfAssessments: base.ipsSelfAssessments.length ? base.ipsSelfAssessments : buildSeedIpsSelfAssessments(navigatorName),
    supervisorIpsAssessments:
      base.supervisorIpsAssessments.length
        ? base.supervisorIpsAssessments
        : buildSeedSupervisorIpsAssessments(navigatorName, supervisorName),
    ipsccEncounterSubmissions: mergeIpsccEncounterSubmissions(
      base.ipsccEncounterSubmissions,
      navigatorName,
      enrollees
    ),
    createSessions: base.createSessions.length ? base.createSessions : buildSeedCreateSessions(navigatorName),
    supervisionSessions: base.supervisionSessions.length ? base.supervisionSessions : buildSeedSupervisionSessions(navigatorName),
    intervalAssessmentRules: base.intervalAssessmentRules.length ? base.intervalAssessmentRules : buildSeedIntervalRules(navigatorName),
    updatedAtIso: base.updatedAtIso || new Date().toISOString()
  }
}
