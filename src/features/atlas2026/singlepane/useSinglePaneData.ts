import { useEffect, useMemo, useState } from 'react'
import type {
  AccessMatrixDataset,
  AdminPortalPersonRecord,
  AdminPortalRegistry,
  AdminPortalPersonRole,
  AdminDataQualityMetric,
  AccountSettings,
  AtlasRole,
  CountyHeatPoint,
  DomainLoadBreakdown,
  DomainLoad,
  EnrolleeBurdenSurveySubmissionInput,
  EnrolleeBurdenSurveySubmissionRecord,
  EnrolleeActiveZCode,
  EnrolleeIntakeRecord,
  EnrollmentRequestRecord,
  EnrolleeProfile,
  EnrolleeZCodeResolutionInput,
  IntervalAssessmentDueItem,
  IntervalAssessmentRule,
  JourneyStationMarker,
  NavigatorProgramState,
  NavigatorEnrollmentAssignmentRecord,
  NavigatorSelfAssessmentRecord,
  NavigatorSelfAssessmentSummary,
  PartnerTroubleshootingGrant,
  PartnerIdentifierRecord,
  PartnerReferralSubmissionInput,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  NavigatorCompetencyAssessmentRecord,
  SupervisorNavigatorCompetencySummary,
  RoleMenuConfig,
  RegulationTestSubmissionInput,
  RegulationTestSubmissionRecord,
  RegulationTestStripMarker,
  ResolvedZCodeStripMarker,
  RouteAssignmentRecord,
  RouteCandidateRecord,
  RouteLogEvent,
  StabilizationPhase,
  SupervisionSessionRecord,
  TroubleshootingSessionState,
  TimelineConfig,
  UnassignedEnrolleePickupRecord,
  ZDomain
} from '@/features/atlas2026/singlepane/types'
import {
  appendRouteLog as appendRouteLogRecord,
  deleteEnrolleeBurdenSurveyDraftRecord,
  deletePartnerServiceCapacityDraftRecord,
  loadAdminPortalRegistry,
  loadAdminDataQuality,
  loadCountyHeatmap,
  loadEnrolleeBurdenSurveyHistory,
  loadEnrollmentRequests,
  prefetchJourneyStationMarkersForEnrollments,
  prefetchRouteCandidatesForEnrollments,
  loadPartnerServiceCapacitySurveyHistory,
  loadPartnerStationProfile,
  loadNavigatorProgramState,
  loadNavigatorEnrollmentAssignments,
  loadPartnerTroubleshootingGrants,
  loadDemoTaggedEnrollmentIds,
  searchPartnerIdentifierRecordMatches,
  ensurePartnerIdentifierRecordForSurvey,
  uploadEnrolleeProfileImage,
  saveAdminPortalRegistry as persistAdminPortalRegistry,
  saveAccountSettings as persistAccountSettings,
  saveAccessMatrixEnrollmentNavigators as persistAccessMatrixEnrollmentNavigators,
  saveAccessMatrixPartnerPrimaryContacts as persistAccessMatrixPartnerPrimaryContacts,
  saveAccessMatrixPersonRoles as persistAccessMatrixPersonRoles,
  saveAccessMatrixSupervisorAssignments as persistAccessMatrixSupervisorAssignments,
  saveEnrolleeBurdenSurvey as persistEnrolleeBurdenSurvey,
  saveNavigatorProgramState as persistNavigatorProgramState,
  savePartnerTroubleshootingGrant as persistPartnerTroubleshootingGrant,
  setEnrolleeZCodeResolution as persistEnrolleeZCodeResolution,
  savePartnerServiceCapacitySurvey as persistPartnerServiceCapacitySurvey,
  saveNavigatorCompetencyAssessment as persistNavigatorCompetencyAssessment,
  saveRouteAssignment as persistRouteAssignment,
  saveTimelineConfig as persistTimelineConfig,
  saveRouteLogs as persistRouteLogs,
  saveEnrolleeIntake as persistEnrolleeIntake,
  assignNavigatorEnrollmentToSelf as persistAssignNavigatorEnrollmentToSelf,
  unassignNavigatorEnrollmentFromSelf as persistUnassignNavigatorEnrollmentFromSelf,
  materializeClaimedReferralIntoEnrollment,
  upsertEnrollmentInferredZCodes,
  loadAccessMatrixDataset
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { useJourneyStationMarkers } from '@/features/atlas2026/singlepane/hooks/useJourneyStationMarkers'
import { usePartnerServiceCapacityHistory } from '@/features/atlas2026/singlepane/hooks/usePartnerServiceCapacityHistory'
import { useRouteCandidates } from '@/features/atlas2026/singlepane/hooks/useRouteCandidates'
import { useSinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'
import {
  createDefaultTimelineConfig,
  extendTimelinePhaseByMonth,
  normalizeTimelineConfig
} from '@/features/atlas2026/singlepane/timelineConfigUtils'
import { splitFullName } from '@/features/atlas2026/singlepane/personNameUtils'
import {
  buildSurveyDomainLoadBreakdown,
  toNormalizedRadialDomainLoad
} from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import {
  buildPartnerServiceCapacityDefaultHeader,
  buildSupervisorNavigatorCompetencySummaries,
  upsertRegulationTestHistory,
  upsertServiceCapacitySubmissionHistory
} from '@/features/atlas2026/singlepane/useSinglePaneDataTransforms'
import {
  deleteRegulationTestDraft,
  loadRegulationTestHistory,
  saveRegulationTestSubmission
} from '@/features/atlas2026/singlepane/data-access/regulationTestsRepository'
import { buildReferralQueueUpdate } from '@/features/atlas2026/singlepane/referralWorkflowUtils'
import { loadPublicReferralQueueRecords } from '@/features/atlas2026/singlepane/data-access/publicReferralRepository'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { inferZCodesForReferral } from '@/services/atlas2026/demoInferenceService'

const DOMAIN_BY_ACTION: Record<string, ZDomain[]> = {
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

const SESSION_ROLE_KEY = 'atlas2026.singlepane.session.role'
const SESSION_ACTIVE_MENU_KEY = 'atlas2026.singlepane.session.active-menu'
const SESSION_SELECTED_ENROLLEE_KEY = 'atlas2026.singlepane.session.selected-enrollee'
const SESSION_REMOTE_SESSION_KEY = 'atlas2026.singlepane.session.remote-session'

function readSessionStorageValue(key: string) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSessionStorageValue(key: string, value: string | null) {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return
  try {
    if (!value) {
      window.sessionStorage.removeItem(key)
      return
    }
    window.sessionStorage.setItem(key, value)
  } catch {}
}

function readSessionRole(initialRole: AtlasRole) {
  const stored = readSessionStorageValue(SESSION_ROLE_KEY)
  return stored === 'administrator' || stored === 'supervisor' || stored === 'partner' || stored === 'navigator'
    ? stored
    : initialRole
}

function readSessionRemoteSession(): TroubleshootingSessionState | null {
  const raw = readSessionStorageValue(SESSION_REMOTE_SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TroubleshootingSessionState>
    if (!parsed || !parsed.isActive || !parsed.targetPersonId || !parsed.targetRole) return null
    return {
      isActive: true,
      targetPersonId: String(parsed.targetPersonId),
      targetRole: parsed.targetRole,
      targetDisplayName: String(parsed.targetDisplayName || ''),
      targetEmail: String(parsed.targetEmail || ''),
      targetOrganizationName: parsed.targetOrganizationName ? String(parsed.targetOrganizationName) : null,
      startedAtIso: String(parsed.startedAtIso || new Date().toISOString()),
      partnerGrant: parsed.partnerGrant || null
    }
  } catch {
    return null
  }
}

function nextPhase(current?: StabilizationPhase): StabilizationPhase {
  if (current === 'regulation') return 'readiness'
  if (current === 'readiness') return 'renewal'
  return 'renewal'
}

function getRegulationTestLabel(testType: RegulationTestSubmissionRecord['testType']) {
  if (testType === 'mh_sca') return 'MH-SCA'
  if (testType === 'svs') return 'SVS'
  if (testType === 'ipf') return 'IPF'
  return 'B-IPF'
}

function buildCompletedParentCodes(activeZCodeDetails: EnrolleeActiveZCode[]) {
  const grouped = new Map<string, boolean[]>()
  for (const detail of activeZCodeDetails) {
    const parentCode = detail.parentCode.trim().toUpperCase()
    const current = grouped.get(parentCode) || []
    current.push(detail.isResolved)
    grouped.set(parentCode, current)
  }
  return Array.from(grouped.entries())
    .filter(([, values]) => values.length > 0 && values.every(Boolean))
    .map(([parentCode]) => parentCode)
}

function buildResolvedZCodeStripMarkers(activeZCodeDetails: EnrolleeActiveZCode[]) {
  return activeZCodeDetails
    .filter((detail) => detail.isResolved && detail.resolutionAt)
    .slice()
    .sort((left, right) => new Date(left.resolutionAt || 0).getTime() - new Date(right.resolutionAt || 0).getTime())
    .map((detail) => ({
      id: detail.enrolleeZCodeId,
      parentCode: detail.parentCode.trim().toUpperCase(),
      zCode: detail.zCode.trim().toUpperCase(),
      description: detail.description || detail.title || detail.zCode,
      resolvedAtIso: detail.resolutionAt || new Date().toISOString(),
      partnerName: detail.resolutionPartnerName?.trim() || null,
      resolutionNote: detail.resolutionNote?.trim() || null
    })) satisfies ResolvedZCodeStripMarker[]
}

function createNavigatorProgramState(): NavigatorProgramState {
  return {
    pickupQueue: [],
    selfAssessments: [],
    supervisionSessions: [],
    intervalAssessmentRules: [],
    updatedAtIso: new Date().toISOString()
  }
}

function normalizeAtlasRoleKeys(values: string[]): AtlasRole[] {
  return values.filter((value): value is AtlasRole => value === 'administrator' || value === 'supervisor' || value === 'partner' || value === 'navigator')
}

function haveSameRoles(left: AtlasRole[], right: AtlasRole[]) {
  if (left.length !== right.length) return false
  const a = [...left].sort()
  const b = [...right].sort()
  return a.every((value, index) => value === b[index])
}

function dedupeMenus(menus: string[]) {
  return Array.from(new Set(menus.map((menu) => menu.trim()).filter(Boolean)))
}

function toRemoteSessionErrorMessage(role: AtlasRole) {
  if (role === 'partner') return 'Partner troubleshooting is unavailable until the partner grants access.'
  return 'Unable to start troubleshooting session.'
}

function toMidnightIso(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString()
}

function getWeekStartIso(dateIso: string) {
  const date = new Date(dateIso)
  if (!Number.isFinite(date.getTime())) return toMidnightIso(new Date())
  const day = date.getUTCDay()
  const diff = (day + 6) % 7
  date.setUTCDate(date.getUTCDate() - diff)
  return toMidnightIso(date)
}

function normalizeOrganizationKey(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function buildSeedPickupQueue(enrollmentRequests: EnrollmentRequestRecord[]): UnassignedEnrolleePickupRecord[] {
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

function buildSeedSelfAssessments(navigatorName: string): NavigatorSelfAssessmentRecord[] {
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

function buildSeedSupervisionSessions(navigatorName: string): SupervisionSessionRecord[] {
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

function buildSeedIntervalRules(navigatorName: string): IntervalAssessmentRule[] {
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

function mergeNavigatorProgramState(
  rawState: NavigatorProgramState | null,
  navigatorName: string,
  enrollmentRequests: EnrollmentRequestRecord[],
  publicQueueRecords: UnassignedEnrolleePickupRecord[]
): NavigatorProgramState {
  const base = rawState || createNavigatorProgramState()
  const mergedPickupQueue = [...publicQueueRecords, ...base.pickupQueue]
    .filter(Boolean)
    .filter((record, index, records) => records.findIndex((candidate) => candidate.id === record.id) === index)
  return {
    pickupQueue: mergedPickupQueue.length ? mergedPickupQueue : buildSeedPickupQueue(enrollmentRequests),
    selfAssessments: base.selfAssessments.length ? base.selfAssessments : buildSeedSelfAssessments(navigatorName),
    supervisionSessions: base.supervisionSessions.length ? base.supervisionSessions : buildSeedSupervisionSessions(navigatorName),
    intervalAssessmentRules: base.intervalAssessmentRules.length ? base.intervalAssessmentRules : buildSeedIntervalRules(navigatorName),
    updatedAtIso: base.updatedAtIso || new Date().toISOString()
  }
}

function buildNavigatorSelfAssessmentSummary(records: NavigatorSelfAssessmentRecord[]): NavigatorSelfAssessmentSummary {
  if (!records.length) {
    return {
      responseCount: 0,
      averageStressLoad: 0,
      averageConfidence: 0,
      averageSupport: 0,
      averageComposite: 0,
      latestSubmittedAtIso: null
    }
  }
  const totals = records.reduce(
    (sum, record) => {
      sum.stress += record.stressLoadScore
      sum.confidence += record.confidenceScore
      sum.support += record.supportScore
      return sum
    },
    { stress: 0, confidence: 0, support: 0 }
  )
  const count = records.length
  const latest = records
    .slice()
    .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime())[0]
  const averageStressLoad = Number((totals.stress / count).toFixed(2))
  const averageConfidence = Number((totals.confidence / count).toFixed(2))
  const averageSupport = Number((totals.support / count).toFixed(2))
  return {
    responseCount: count,
    averageStressLoad,
    averageConfidence,
    averageSupport,
    averageComposite: Number(((averageStressLoad + averageConfidence + averageSupport) / 3).toFixed(2)),
    latestSubmittedAtIso: latest?.submittedAtIso || null
  }
}

function cadenceDays(cadence: IntervalAssessmentRule['cadence']) {
  if (cadence === 'weekly') return 7
  if (cadence === 'monthly') return 30
  return 90
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Unable to read image file.'))
    }
    reader.onerror = () => reject(reader.error || new Error('Unable to read image file.'))
    reader.readAsDataURL(file)
  })
}

function buildIntervalDueItems(
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

function deriveNavigatorLoad(loads: DomainLoad[]): DomainLoad | null {
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

function deriveNavigatorLoadBreakdown(loadBreakdowns: Record<string, DomainLoadBreakdown>, navigatorName: string): DomainLoadBreakdown | null {
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
    responseCount: row.sampleCount
  }))
  const habitatRows = rows.filter((row) => row.mappedDomain === 'habitat')
  const workRows = rows.filter((row) => row.mappedDomain === 'work')
  const socialRows = rows.filter((row) => row.mappedDomain === 'socialNetworks')
  const totals = {
    habitatTotal: habitatRows.length ? habitatRows.reduce((sum, row) => sum + row.rawCount, 0) / habitatRows.length : 0,
    workTotal: workRows.length ? workRows.reduce((sum, row) => sum + row.rawCount, 0) / workRows.length : 0,
    socialNetworksTotal: socialRows.length ? socialRows.reduce((sum, row) => sum + row.rawCount, 0) / socialRows.length : 0
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

function getEnrolleeSurveySortTime(record: EnrolleeBurdenSurveySubmissionRecord) {
  return new Date(record.updatedAtIso || record.submittedAtIso).getTime()
}

function upsertEnrolleeBurdenSurveyHistory(
  history: EnrolleeBurdenSurveySubmissionRecord[],
  saved: EnrolleeBurdenSurveySubmissionRecord
) {
  return history
    .filter((record) => record.id !== saved.id && record.draftKey !== saved.draftKey)
    .concat(saved)
    .sort((left, right) => getEnrolleeSurveySortTime(right) - getEnrolleeSurveySortTime(left))
}

interface SupervisorNavigatorDirectoryEntry {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

export function useSinglePaneData(initialRole: AtlasRole = 'navigator') {
  const [role, setRole] = useState<AtlasRole>(() => readSessionRole(initialRole))
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string>(() => readSessionStorageValue(SESSION_SELECTED_ENROLLEE_KEY) || '')
  const [activeMenu, setActiveMenu] = useState<string>(() => readSessionStorageValue(SESSION_ACTIVE_MENU_KEY) || '')
  const [adminPortalRegistry, setAdminPortalRegistry] = useState<AdminPortalRegistry | null>(null)
  const [accessMatrixDataset, setAccessMatrixDataset] = useState<AccessMatrixDataset | null>(null)
  const [navigatorProgramState, setNavigatorProgramState] = useState<NavigatorProgramState>(createNavigatorProgramState())
  const [partnerTroubleshootingGrants, setPartnerTroubleshootingGrants] = useState<Record<string, PartnerTroubleshootingGrant>>({})
  const [remoteSession, setRemoteSession] = useState<TroubleshootingSessionState | null>(() => readSessionRemoteSession())
  const [remotePartnerStationProfile, setRemotePartnerStationProfile] = useState<Awaited<ReturnType<typeof loadPartnerStationProfile>> | null>(null)
  const [isSavingAdminPortalRegistry, setIsSavingAdminPortalRegistry] = useState(false)
  const [isSavingAccessMatrix, setIsSavingAccessMatrix] = useState(false)
  const [adminPortalRegistryError, setAdminPortalRegistryError] = useState<string | null>(null)
  const [accessMatrixError, setAccessMatrixError] = useState<string | null>(null)
  const [navigatorProgramError, setNavigatorProgramError] = useState<string | null>(null)
  const [isSavingPartnerServiceCapacitySurvey, setIsSavingPartnerServiceCapacitySurvey] = useState(false)
  const [isSavingEnrolleeBurdenSurvey, setIsSavingEnrolleeBurdenSurvey] = useState(false)
  const [enrolleeBurdenSurveyError, setEnrolleeBurdenSurveyError] = useState<string | null>(null)
  const [enrolleeBurdenSurveyHistoryByEnrollmentId, setEnrolleeBurdenSurveyHistoryByEnrollmentId] = useState<
    Record<string, EnrolleeBurdenSurveySubmissionRecord[]>
  >({})
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false)
  const [profileImageUploadError, setProfileImageUploadError] = useState<string | null>(null)
  const [isUploadingAccountProfileImage, setIsUploadingAccountProfileImage] = useState(false)
  const [accountProfileImageUploadError, setAccountProfileImageUploadError] = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState('')
  const [regulationTestHistory, setRegulationTestHistory] = useState<RegulationTestSubmissionRecord[]>([])
  const [isSavingRegulationTest, setIsSavingRegulationTest] = useState(false)
  const [regulationTestError, setRegulationTestError] = useState<string | null>(null)
  const [navigatorEnrollmentAssignments, setNavigatorEnrollmentAssignments] = useState<NavigatorEnrollmentAssignmentRecord[]>([])
  const [navigatorEnrollmentAssignmentsError, setNavigatorEnrollmentAssignmentsError] = useState<string | null>(null)
  const [isLoadingNavigatorEnrollmentAssignments, setIsLoadingNavigatorEnrollmentAssignments] = useState(false)
  const [assigningNavigatorEnrollmentId, setAssigningNavigatorEnrollmentId] = useState<string | null>(null)
  const [demoTaggedEnrollmentIds, setDemoTaggedEnrollmentIds] = useState<string[]>([])
  const [publicQueueRecords, setPublicQueueRecords] = useState<UnassignedEnrolleePickupRecord[]>([])
  useEffect(() => {
    let isMounted = true
    void loadPublicReferralQueueRecords().then((records) => {
      if (!isMounted) return
      setPublicQueueRecords(records)
    })
    return () => {
      isMounted = false
    }
  }, [])
  const {
    state: {
      isLoading,
      enrollees,
      loads,
      loadBreakdownsByEnrolleeId,
      roleConfigs,
      timelineConfig,
      timelineConfigsByEnrolleeId,
      logs,
      enrollmentRequests,
      countyHeatmap,
      adminMetrics,
      partnerLoad,
      partnerLoadBreakdown,
      accountSettings,
      partnerStationProfile,
      intakeFormsByEnrolleeId,
      routeAssignmentsByEnrolleeId,
      navigatorCompetencyAssessments
    },
    setState: setBootstrapState,
    reload: reloadBootstrapState
  } = useSinglePaneBootstrapState(role)

  const viewerRole = remoteSession?.targetRole || role
  const targetViewerEmail = (remoteSession?.isActive ? remoteSession.targetEmail : sessionEmail || accountSettings.email || '')
    .trim()
    .toLowerCase()
  const viewerPolicyRecord = useMemo(() => {
    if (!adminPortalRegistry || !targetViewerEmail) return null
    return (
      adminPortalRegistry.people.find((person) => {
        const primaryEmail = person.email.trim().toLowerCase()
        const linkedEmails = person.linkedEmails.map((value) => value.trim().toLowerCase())
        return primaryEmail === targetViewerEmail || linkedEmails.includes(targetViewerEmail)
      }) || null
    )
  }, [adminPortalRegistry, targetViewerEmail])
  const viewerFeaturePolicy = viewerPolicyRecord?.featurePolicy || {
    screenToggles: {},
    cardToggles: {},
    actionToggles: {}
  }
  const isPolicyAllowed = (scope: Record<string, boolean> | undefined, key: string) => (scope?.[key] ?? true) !== false
  const viewerPerson = useMemo(() => {
    if (!accessMatrixDataset) return null
    const normalizedCandidates = new Set(
      [sessionEmail, accountSettings.email]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
    if (!normalizedCandidates.size) return null
    return accessMatrixDataset.people.find((person) => normalizedCandidates.has(person.email.trim().toLowerCase())) || null
  }, [accessMatrixDataset, accountSettings.email, sessionEmail])
  const viewerCanViewNavigatorAssignmentNames = useMemo(() => {
    if (viewerRole === 'administrator') return true
    return Boolean(viewerPolicyRecord?.canViewNavigatorAssignmentNames) && isPolicyAllowed(viewerFeaturePolicy.actionToggles, 'assignmentBoard.viewNavigatorNames')
  }, [viewerFeaturePolicy.actionToggles, viewerPolicyRecord?.canViewNavigatorAssignmentNames, viewerRole])
  const viewerCanAccessAssignmentBoard = useMemo(
    () => isPolicyAllowed(viewerFeaturePolicy.screenToggles, 'assignmentBoard'),
    [viewerFeaturePolicy.screenToggles]
  )
  const viewerCanUseAssignmentActions = useMemo(
    () => isPolicyAllowed(viewerFeaturePolicy.actionToggles, 'assignmentBoard.assignSelf'),
    [viewerFeaturePolicy.actionToggles]
  )
  const viewerCanAccessAdminRegistryCards = useMemo(
    () =>
      isPolicyAllowed(viewerFeaturePolicy.cardToggles, 'navigatorCoverageCard') &&
      isPolicyAllowed(viewerFeaturePolicy.cardToggles, 'liveAccessMatrix') &&
      isPolicyAllowed(viewerFeaturePolicy.actionToggles, 'admin.saveRegistry'),
    [viewerFeaturePolicy.actionToggles, viewerFeaturePolicy.cardToggles]
  )
  const remotePartnerAssignment =
    remoteSession?.targetRole === 'partner' && accessMatrixDataset
      ? accessMatrixDataset.partnerAssignments.find((partner) => partner.primaryContactPersonIds.includes(remoteSession.targetPersonId)) || null
      : null
  const effectivePartnerOrganizationName =
    remoteSession?.targetRole === 'partner'
      ? remotePartnerAssignment?.organizationName || remoteSession.targetOrganizationName || ''
      : accountSettings.organization
  const effectiveAccountSettings = useMemo<AccountSettings>(
    () =>
      remoteSession
        ? {
            ...accountSettings,
            fullName: remoteSession.targetDisplayName || accountSettings.fullName,
            email: remoteSession.targetEmail || accountSettings.email,
            organization: remoteSession.targetOrganizationName || accountSettings.organization
          }
        : accountSettings,
    [accountSettings, remoteSession]
  )
  const effectivePartnerStationProfile = remoteSession?.targetRole === 'partner' ? remotePartnerStationProfile : partnerStationProfile
  const scopedEnrollmentIds = useMemo(() => {
    if (!accessMatrixDataset) return null
    const scopedRole = remoteSession?.targetRole || role
    if (scopedRole === 'navigator') {
      const navigatorPersonId = remoteSession?.targetRole === 'navigator' ? remoteSession.targetPersonId : viewerPerson?.id
      if (!navigatorPersonId) return new Set<string>()
      return new Set(
        accessMatrixDataset.enrollmentAssignments
          .filter((assignment) => assignment.navigatorPersonIds.includes(navigatorPersonId))
          .map((assignment) => assignment.enrollmentId)
      )
    }
    if (scopedRole === 'supervisor') {
      const supervisorPersonId = remoteSession?.targetRole === 'supervisor' ? remoteSession.targetPersonId : viewerPerson?.id
      if (!supervisorPersonId) return new Set<string>()
      const navigatorIds = new Set(
        accessMatrixDataset.supervisorAssignments
          .filter((assignment) => assignment.supervisorPersonIds.includes(supervisorPersonId))
          .map((assignment) => assignment.navigatorPersonId)
      )
      return new Set(
        accessMatrixDataset.enrollmentAssignments
          .filter((assignment) => assignment.navigatorPersonIds.some((navigatorPersonId) => navigatorIds.has(navigatorPersonId)))
          .map((assignment) => assignment.enrollmentId)
      )
    }
    if (scopedRole === 'partner') return new Set<string>(demoTaggedEnrollmentIds)
    return null
  }, [accessMatrixDataset, demoTaggedEnrollmentIds, remoteSession, role, viewerPerson?.id])
  const scopedEnrollees = useMemo(
    () =>
      scopedEnrollmentIds
        ? enrollees.filter((enrollee) => enrollee.enrollmentId && scopedEnrollmentIds.has(enrollee.enrollmentId))
        : enrollees,
    [enrollees, scopedEnrollmentIds]
  )
  const scopedEnrolleeIdSet = useMemo(() => new Set(scopedEnrollees.map((enrollee) => enrollee.id)), [scopedEnrollees])
  const scopedLoads = useMemo(
    () => loads.filter((item) => scopedEnrolleeIdSet.has(item.enrolleeId)),
    [loads, scopedEnrolleeIdSet]
  )
  const scopedLoadBreakdownsByEnrolleeId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(loadBreakdownsByEnrolleeId).filter(([enrolleeId]) => scopedEnrolleeIdSet.has(enrolleeId))
      ),
    [loadBreakdownsByEnrolleeId, scopedEnrolleeIdSet]
  )

  const selectedEnrollee = useMemo(
    () => scopedEnrollees.find((item) => item.id === selectedEnrolleeId) || scopedEnrollees[0] || null,
    [scopedEnrollees, selectedEnrolleeId]
  )

  const selectedLoad = useMemo(
    () => {
      if (viewerRole === 'partner' && partnerLoad) return partnerLoad
      return scopedLoads.find((item) => item.enrolleeId === selectedEnrollee?.id) || scopedLoads[0] || null
    },
    [partnerLoad, scopedLoads, selectedEnrollee, viewerRole]
  )

  const selectedLoadBreakdown = useMemo(
    () => {
      if (viewerRole === 'partner' && partnerLoadBreakdown) return partnerLoadBreakdown
      return (
        scopedLoadBreakdownsByEnrolleeId[selectedEnrollee?.id || ''] ||
        Object.values(scopedLoadBreakdownsByEnrolleeId)[0] ||
        null
      )
    },
    [partnerLoadBreakdown, scopedLoadBreakdownsByEnrolleeId, selectedEnrollee, viewerRole]
  )

  const selectedTimelineConfig = useMemo(
    () => {
      const activeTimelineConfig = selectedEnrollee ? timelineConfigsByEnrolleeId[selectedEnrollee.id] || timelineConfig : timelineConfig
      return activeTimelineConfig ? normalizeTimelineConfig(activeTimelineConfig) : null
    },
    [selectedEnrollee, timelineConfig, timelineConfigsByEnrolleeId]
  )

  const selectedIntake = useMemo(() => {
    if (!selectedEnrollee) return null
    const existing = intakeFormsByEnrolleeId[selectedEnrollee.id]
    if (existing) return existing
    return {
      enrolleeId: selectedEnrollee.id,
      fullName: selectedEnrollee.fullName,
      dob: selectedEnrollee.dob,
      caseId: selectedEnrollee.caseId,
      email: selectedEnrollee.email,
      assignedNavigator: selectedEnrollee.assignedNavigator,
      enrollmentStartIso: selectedTimelineConfig?.planStartIso || new Date().toISOString(),
      zCodeTags: selectedEnrollee.zCodeTags
    } satisfies EnrolleeIntakeRecord
  }, [intakeFormsByEnrolleeId, selectedEnrollee, selectedTimelineConfig])

  const hasSavedIntake = useMemo(
    () => Boolean(selectedEnrollee && intakeFormsByEnrolleeId[selectedEnrollee.id]),
    [intakeFormsByEnrolleeId, selectedEnrollee]
  )

  const selectedRoleConfig = useMemo(
    () => {
      const baseConfig =
        roleConfigs.find((item) => item.role === viewerRole) || roleConfigs[0] || { role: viewerRole, topMenus: [], actionMenus: [] }
      if (remoteSession?.targetRole !== 'partner') return baseConfig
      const allowedMenus = dedupeMenus(remoteSession.partnerGrant?.allowedMenus || [])
      return {
        ...baseConfig,
        topMenus: allowedMenus.length ? baseConfig.topMenus.filter((menu) => allowedMenus.includes(menu)) : []
      }
    },
    [remoteSession?.partnerGrant?.allowedMenus, remoteSession?.targetRole, roleConfigs, viewerRole]
  )
  const selectedRoleTopMenus = useMemo(
    () => selectedRoleConfig.topMenus.filter((menu) => Boolean(menu && menu.trim())),
    [selectedRoleConfig.topMenus]
  )
  const selectedRoleTopMenusKey = useMemo(() => selectedRoleTopMenus.join('||'), [selectedRoleTopMenus])

  useEffect(() => {
    const firstMenu = selectedRoleTopMenus[0]
    if (!firstMenu) return
    setActiveMenu((current) => (selectedRoleTopMenus.includes(current) ? current : firstMenu))
  }, [selectedRoleTopMenus, selectedRoleTopMenusKey])

  useEffect(() => {
    if (!scopedEnrollees[0]?.id) return
    if (!selectedEnrolleeId || !scopedEnrollees.some((enrollee) => enrollee.id === selectedEnrolleeId)) {
      setSelectedEnrolleeId(scopedEnrollees[0].id)
    }
  }, [scopedEnrollees, selectedEnrolleeId])

  useEffect(() => {
    writeSessionStorageValue(SESSION_ROLE_KEY, role)
  }, [role])

  useEffect(() => {
    writeSessionStorageValue(SESSION_ACTIVE_MENU_KEY, activeMenu || null)
  }, [activeMenu])

  useEffect(() => {
    writeSessionStorageValue(SESSION_SELECTED_ENROLLEE_KEY, selectedEnrolleeId || null)
  }, [selectedEnrolleeId])

  useEffect(() => {
    writeSessionStorageValue(SESSION_REMOTE_SESSION_KEY, remoteSession?.isActive ? JSON.stringify(remoteSession) : null)
  }, [remoteSession])

  const selectedLogs = useMemo(
    () =>
      logs
        .filter((item) => item.enrolleeId === selectedEnrollee?.id)
        .slice()
        .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()),
    [logs, selectedEnrollee]
  )

  const selectedRouteAssignment = useMemo(
    () => (selectedEnrollee ? routeAssignmentsByEnrolleeId[selectedEnrollee.id] || null : null),
    [routeAssignmentsByEnrolleeId, selectedEnrollee]
  )

  const resolvedZCodeStripMarkers = useMemo(
    () => buildResolvedZCodeStripMarkers(selectedEnrollee?.activeZCodeDetails || []),
    [selectedEnrollee?.activeZCodeDetails]
  )

  const partnerServiceCapacityDefaultHeader = useMemo<PartnerServiceCapacityHeader>(
    () => buildPartnerServiceCapacityDefaultHeader(effectiveAccountSettings, viewerRole),
    [effectiveAccountSettings, viewerRole]
  )
  const currentNavigatorName = useMemo(
    () =>
      (remoteSession?.targetRole === 'navigator' ? remoteSession.targetDisplayName : effectiveAccountSettings.fullName).trim() ||
      selectedEnrollee?.assignedNavigator ||
      'atlas navigator',
    [effectiveAccountSettings.fullName, remoteSession?.targetDisplayName, remoteSession?.targetRole, selectedEnrollee?.assignedNavigator]
  )

  const supervisorNavigatorCompetency = useMemo<SupervisorNavigatorCompetencySummary[]>(
    () => buildSupervisorNavigatorCompetencySummaries(scopedEnrollees, navigatorCompetencyAssessments),
    [navigatorCompetencyAssessments, scopedEnrollees]
  )
  const supervisorNavigatorDirectory = useMemo<SupervisorNavigatorDirectoryEntry[]>(() => {
    if (!accessMatrixDataset) {
      const entries = Array.from(new Set(scopedEnrollees.map((enrollee) => enrollee.assignedNavigator).filter(Boolean))).map((name) => ({
        navigatorPersonId: `fallback:${name.toLowerCase()}`,
        navigatorName: name,
        assignedEnrolleeCount: scopedEnrollees.filter((enrollee) => enrollee.assignedNavigator === name).length,
        isManagedByCurrentSupervisor: false
      }))
      return entries.sort((left, right) => left.navigatorName.localeCompare(right.navigatorName))
    }
    const assignmentByNavigator = new Map(
      accessMatrixDataset.supervisorAssignments.map((assignment) => [assignment.navigatorPersonId, assignment])
    )
    const enrolleeCountByNavigatorId = new Map<string, number>()
    for (const assignment of accessMatrixDataset.enrollmentAssignments) {
      for (const navigatorPersonId of assignment.navigatorPersonIds) {
        enrolleeCountByNavigatorId.set(navigatorPersonId, (enrolleeCountByNavigatorId.get(navigatorPersonId) || 0) + 1)
      }
    }
    return accessMatrixDataset.people
      .filter((person) => person.roleKeys.includes('navigator'))
      .map((person) => ({
        navigatorPersonId: person.id,
        navigatorName: person.fullName,
        assignedEnrolleeCount: enrolleeCountByNavigatorId.get(person.id) || 0,
        isManagedByCurrentSupervisor: Boolean(
          viewerPerson && assignmentByNavigator.get(person.id)?.supervisorPersonIds.includes(viewerPerson.id)
        )
      }))
      .sort((left, right) => left.navigatorName.localeCompare(right.navigatorName))
  }, [accessMatrixDataset, scopedEnrollees, viewerPerson])
  const mergedNavigatorProgramState = useMemo(
    () => mergeNavigatorProgramState(navigatorProgramState, currentNavigatorName, enrollmentRequests, publicQueueRecords),
    [currentNavigatorName, enrollmentRequests, navigatorProgramState, publicQueueRecords]
  )
  const navigatorSelfAssessments = useMemo(
    () =>
      mergedNavigatorProgramState.selfAssessments
        .filter((record) => record.navigatorName === currentNavigatorName)
        .slice()
        .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime()),
    [currentNavigatorName, mergedNavigatorProgramState.selfAssessments]
  )
  const navigatorSelfAssessmentSummary = useMemo(
    () => buildNavigatorSelfAssessmentSummary(navigatorSelfAssessments),
    [navigatorSelfAssessments]
  )
  const navigatorSupervisionSessions = useMemo(
    () =>
      mergedNavigatorProgramState.supervisionSessions
        .filter((record) => record.navigatorName === currentNavigatorName)
        .slice()
        .sort((left, right) => new Date(right.sessionAtIso).getTime() - new Date(left.sessionAtIso).getTime()),
    [currentNavigatorName, mergedNavigatorProgramState.supervisionSessions]
  )
  const navigatorIntervalRules = useMemo(
    () =>
      mergedNavigatorProgramState.intervalAssessmentRules.filter(
        (rule) => !rule.navigatorName || rule.navigatorName === currentNavigatorName
      ),
    [currentNavigatorName, mergedNavigatorProgramState.intervalAssessmentRules]
  )
  const navigatorIntervalDueItems = useMemo(
    () =>
      buildIntervalDueItems(
        navigatorIntervalRules,
        navigatorSelfAssessments,
        navigatorSupervisionSessions,
        navigatorCompetencyAssessments.filter((record) => record.navigatorName === currentNavigatorName)
      ),
    [currentNavigatorName, navigatorCompetencyAssessments, navigatorIntervalRules, navigatorSelfAssessments, navigatorSupervisionSessions]
  )
  const navigatorAssignedCompetencySummary = useMemo(
    () =>
      supervisorNavigatorCompetency.find((summary) => summary.navigatorName === currentNavigatorName) ||
      supervisorNavigatorCompetency[0] ||
      null,
    [currentNavigatorName, supervisorNavigatorCompetency]
  )
  const navigatorAggregateLoad = useMemo(() => deriveNavigatorLoad(scopedLoads), [scopedLoads])
  const navigatorAggregateLoadBreakdown = useMemo(
    () => deriveNavigatorLoadBreakdown(scopedLoadBreakdownsByEnrolleeId, currentNavigatorName),
    [currentNavigatorName, scopedLoadBreakdownsByEnrolleeId]
  )
  const pickupQueue = useMemo(
    () => {
      const visibleQueue = mergedNavigatorProgramState.pickupQueue.filter((item) => item.status !== 'archived')
      if (viewerRole !== 'partner') {
        return visibleQueue
          .slice()
          .sort((left, right) => new Date(right.referredAtIso).getTime() - new Date(left.referredAtIso).getTime())
      }

      const normalizedOrg = normalizeOrganizationKey(effectivePartnerOrganizationName)
      const scopedQueue = normalizedOrg
        ? visibleQueue.filter(
            (item) => normalizeOrganizationKey(item.referrerOrganization) === normalizedOrg
          )
        : visibleQueue
      return scopedQueue
        .slice()
        .sort((left, right) => new Date(right.referredAtIso).getTime() - new Date(left.referredAtIso).getTime())
    },
    [effectivePartnerOrganizationName, mergedNavigatorProgramState.pickupQueue, viewerRole]
  )
  const routeCandidates = useRouteCandidates(selectedEnrollee)
  const { journeyStationMarkers, setJourneyStationMarkers } = useJourneyStationMarkers(selectedEnrollee, selectedLogs, routeCandidates)
  const {
    partnerServiceCapacitySurveyHistory,
    partnerServiceCapacitySurveyError,
    setPartnerServiceCapacitySurveyHistory,
    setPartnerServiceCapacitySurveyError
  } = usePartnerServiceCapacityHistory(viewerRole, effectivePartnerOrganizationName)

  const backgroundPrefetchEnrollments = useMemo(
    () =>
      scopedEnrollees
        .slice(0, 6)
        .map((enrollee) => ({
          enrollmentId: enrollee.enrollmentId,
          enrolleeId: enrollee.id
        }))
        .filter((entry) => Boolean(entry.enrollmentId)),
    [scopedEnrollees]
  )

  useEffect(() => {
    if (!backgroundPrefetchEnrollments.length) return
    if (typeof window === 'undefined') return
    const timeoutId = window.setTimeout(() => {
      void prefetchRouteCandidatesForEnrollments(
        backgroundPrefetchEnrollments
          .map((entry) => entry.enrollmentId || '')
          .filter(Boolean)
      )
      void prefetchJourneyStationMarkersForEnrollments(backgroundPrefetchEnrollments)
    }, 180)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [backgroundPrefetchEnrollments])

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setSessionEmail('')
      return
    }
    let isMounted = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted || error) return
      setSessionEmail(data.session?.user?.email?.trim() || '')
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    loadAdminPortalRegistry()
      .then((registry) => {
        if (!isMounted) return
        setAdminPortalRegistry(registry)
        setAdminPortalRegistryError(null)
      })
      .catch((error) => {
        if (!isMounted) return
        setAdminPortalRegistryError(error instanceof Error ? error.message : 'Unable to load admin portal registry.')
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    loadNavigatorProgramState()
      .then((state) => {
        if (!isMounted) return
        setNavigatorProgramState(state)
        setNavigatorProgramError(null)
      })
      .catch((error) => {
        if (!isMounted) return
        setNavigatorProgramError(error instanceof Error ? error.message : 'Unable to load navigator program state.')
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!adminPortalRegistry || remoteSession?.isActive) return
    const normalizedEmail = (sessionEmail || accountSettings.email || '').trim().toLowerCase()
    if (!normalizedEmail) return
    const existingPerson =
      adminPortalRegistry.people.find(
        (person) =>
          person.email.trim().toLowerCase() === normalizedEmail ||
          person.linkedEmails.map((value) => value.trim().toLowerCase()).includes(normalizedEmail)
      ) || null
    const normalizedRole = (role === 'administrator' || role === 'supervisor' || role === 'navigator' || role === 'partner'
      ? role
      : 'navigator') as AdminPortalPersonRole
    const createdPerson: AdminPortalPersonRecord = {
      id: `person-${Date.now().toString(36)}`,
      fullName: accountSettings.fullName.trim() || normalizedEmail,
      email: normalizedEmail,
      title: '',
      roles: [normalizedRole],
      canViewNavigatorAssignmentNames: normalizedRole === 'administrator',
      approvalState: 'pending',
      identityGroupId: `identity-${normalizedEmail}`,
      linkedEmails: [normalizedEmail],
      featurePolicy: { screenToggles: {}, cardToggles: {}, actionToggles: {} },
      organizationId: null,
      reportsToPersonId: null,
      linkedEnrolleeId: null,
      status: 'active',
      notes: 'Auto-created from auth signup continuity.'
    }
    const registryToSave = existingPerson
      ? {
          ...adminPortalRegistry,
          people: adminPortalRegistry.people.map((person) =>
            person.id === existingPerson.id
              ? {
                  ...person,
                  linkedEmails: Array.from(new Set([normalizedEmail, ...person.linkedEmails.map((value) => value.trim().toLowerCase())])),
                  identityGroupId: person.identityGroupId.trim() || person.id,
                  featurePolicy: person.featurePolicy || { screenToggles: {}, cardToggles: {}, actionToggles: {} }
                }
              : person
          ),
          updatedAtIso: new Date().toISOString()
        }
      : {
          ...adminPortalRegistry,
          people: [
            ...adminPortalRegistry.people,
            createdPerson
          ],
          updatedAtIso: new Date().toISOString()
        }
    const changed = JSON.stringify(registryToSave.people) !== JSON.stringify(adminPortalRegistry.people)
    if (!changed) return
    // Persist deterministic auth-email -> person linkage so signup identity survives across sessions.
    void persistAdminPortalRegistry(registryToSave)
      .then((saved) => setAdminPortalRegistry(saved))
      .catch((error) => {
        console.warn('Unable to persist signup/person continuity update.', error)
      })
  }, [accountSettings.email, accountSettings.fullName, adminPortalRegistry, remoteSession?.isActive, role, sessionEmail])

  useEffect(() => {
    if (viewerRole !== 'administrator') {
      setAccessMatrixDataset(null)
      setAccessMatrixError(null)
      return
    }
    let isMounted = true
    loadAccessMatrixDataset()
      .then((dataset) => {
        if (!isMounted) return
        setAccessMatrixDataset(dataset)
        setAccessMatrixError(null)
      })
      .catch((error) => {
        if (!isMounted) return
        setAccessMatrixError(error instanceof Error ? error.message : 'Unable to load access matrix dataset.')
      })
    return () => {
      isMounted = false
    }
  }, [viewerRole])

  useEffect(() => {
    let isMounted = true
    loadPartnerTroubleshootingGrants()
      .then((grants) => {
        if (!isMounted) return
        setPartnerTroubleshootingGrants(grants)
      })
      .catch((error) => {
        if (!isMounted) return
        console.warn('Unable to load partner troubleshooting grants.', error)
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (viewerRole !== 'navigator' || !selectedEnrollee?.id) {
      setRegulationTestHistory([])
      setRegulationTestError(null)
      return
    }
    let isMounted = true
    Promise.all([
      loadRegulationTestHistory(selectedEnrollee.id, 'mh_sca'),
      loadRegulationTestHistory(selectedEnrollee.id, 'svs'),
      loadRegulationTestHistory(selectedEnrollee.id, 'ipf'),
      loadRegulationTestHistory(selectedEnrollee.id, 'b_ipf')
    ])
      .then(([mhsca, svs, ipf, bipf]) => {
        if (!isMounted) return
        setRegulationTestHistory([...mhsca, ...svs, ...ipf, ...bipf])
        setRegulationTestError(null)
      })
      .catch((error) => {
        if (!isMounted) return
        setRegulationTestError(error instanceof Error ? error.message : 'Unable to load regulation test history.')
      })
    return () => {
      isMounted = false
    }
  }, [selectedEnrollee?.id, viewerRole])

  useEffect(() => {
    if (remoteSession || !viewerPerson) return
    const derivedRoles = normalizeAtlasRoleKeys(viewerPerson.roleKeys)
    if (!derivedRoles.length || haveSameRoles(derivedRoles, accountSettings.enabledRoles)) return
    setBootstrapState((current) => ({
      ...current,
      accountSettings: {
        ...current.accountSettings,
        enabledRoles: derivedRoles
      }
    }))
    if (!derivedRoles.includes(role)) {
      setRole(derivedRoles[0] || 'navigator')
    }
  }, [accountSettings.enabledRoles, remoteSession, role, setBootstrapState, viewerPerson])

  useEffect(() => {
    if (remoteSession?.targetRole !== 'partner') {
      setRemotePartnerStationProfile(null)
      return
    }
    const organizationName = remotePartnerAssignment?.organizationName || remoteSession.targetOrganizationName || ''
    if (!organizationName.trim()) {
      setRemotePartnerStationProfile(null)
      return
    }
    let isMounted = true
    loadPartnerStationProfile(organizationName, {
      fullName: remoteSession.targetDisplayName,
      email: remoteSession.targetEmail
    })
      .then((profile) => {
        if (isMounted) setRemotePartnerStationProfile(profile)
      })
      .catch((error) => {
        if (!isMounted) return
        console.warn('Unable to load remote partner station profile.', error)
        setRemotePartnerStationProfile(null)
      })
    return () => {
      isMounted = false
    }
  }, [remotePartnerAssignment?.organizationName, remoteSession?.targetDisplayName, remoteSession?.targetEmail, remoteSession?.targetOrganizationName, remoteSession?.targetRole])

  useEffect(() => {
    if (viewerRole !== 'navigator' || role === 'navigator') return
    let isMounted = true
    loadEnrollmentRequests('navigator')
      .then((requests) => {
        if (!isMounted) return
        setBootstrapState((current) => ({
          ...current,
          enrollmentRequests: requests
        }))
      })
      .catch((error) => {
        if (isMounted) {
          console.warn('Unable to load navigator enrollment requests for troubleshooting.', error)
        }
      })
    return () => {
      isMounted = false
    }
  }, [role, setBootstrapState, viewerRole])

  useEffect(() => {
    if (viewerRole !== 'navigator') {
      setNavigatorEnrollmentAssignments([])
      setNavigatorEnrollmentAssignmentsError(null)
      setIsLoadingNavigatorEnrollmentAssignments(false)
      return
    }
    let isMounted = true
    setIsLoadingNavigatorEnrollmentAssignments(true)
    loadNavigatorEnrollmentAssignments()
      .then((rows) => {
        if (!isMounted) return
        setNavigatorEnrollmentAssignments(rows)
        setNavigatorEnrollmentAssignmentsError(null)
      })
      .catch((error) => {
        if (!isMounted) return
        setNavigatorEnrollmentAssignmentsError(
          error instanceof Error ? error.message : 'Unable to load navigator assignment board.'
        )
      })
      .finally(() => {
        if (isMounted) setIsLoadingNavigatorEnrollmentAssignments(false)
      })
    return () => {
      isMounted = false
    }
  }, [viewerRole])

  useEffect(() => {
    if (viewerRole !== 'partner') {
      setDemoTaggedEnrollmentIds([])
      return
    }
    let isMounted = true
    loadDemoTaggedEnrollmentIds()
      .then((ids) => {
        if (!isMounted) return
        setDemoTaggedEnrollmentIds(ids)
      })
      .catch((error) => {
        if (!isMounted) return
        const typedError = error as { code?: string; message?: string } | null
        console.warn('Unable to load demo-tagged enrollment ids for partner scope.', error)
      })
    return () => {
      isMounted = false
    }
  }, [viewerRole])

  const completedRegulationTests = useMemo(
    () =>
      regulationTestHistory
        .filter(
          (record) =>
            record.status === 'completed' &&
            record.passed !== null &&
            (record.testType === 'mh_sca' || record.testType === 'svs')
        )
        .slice()
        .sort((left, right) => new Date(left.updatedAtIso).getTime() - new Date(right.updatedAtIso).getTime()),
    [regulationTestHistory]
  )

  const latestCompletedMhSca = useMemo(
    () =>
      [...completedRegulationTests]
        .reverse()
        .find((record) => record.testType === 'mh_sca') || null,
    [completedRegulationTests]
  )

  const latestCompletedSvs = useMemo(
    () =>
      [...completedRegulationTests]
        .reverse()
        .find((record) => record.testType === 'svs') || null,
    [completedRegulationTests]
  )

  const isRegulationCleared = Boolean(latestCompletedMhSca?.passed && latestCompletedSvs?.passed)

  const regulationTestStripMarkers = useMemo<RegulationTestStripMarker[]>(
    () =>
      completedRegulationTests.map((record) => ({
        id: record.id,
        label: getRegulationTestLabel(record.testType),
        testType: record.testType,
        attemptedAtIso: record.updatedAtIso,
        passed: Boolean(record.passed),
        isLatestCompleted:
          (record.testType === 'mh_sca' && record.id === latestCompletedMhSca?.id) ||
          (record.testType === 'svs' && record.id === latestCompletedSvs?.id)
      })),
    [completedRegulationTests, latestCompletedMhSca?.id, latestCompletedSvs?.id]
  )

  const shouldHideReadinessProgress = !isRegulationCleared

  function setLogs(nextLogs: RouteLogEvent[] | ((current: RouteLogEvent[]) => RouteLogEvent[])) {
    setBootstrapState((current) => ({
      ...current,
      logs: typeof nextLogs === 'function' ? nextLogs(current.logs) : nextLogs
    }))
  }

  function appendRouteLog(label: string) {
    if (!selectedEnrollee || !label.trim()) return
    const last = selectedLogs[selectedLogs.length - 1]
    const newPhase = nextPhase(last?.phase)
    const domains = DOMAIN_BY_ACTION[label.trim().toLowerCase()] || ['social']

    if (last && last.status === 'active') {
      const updatedLogs: RouteLogEvent[] = logs.map((item) => (item.id === last.id ? { ...item, status: 'completed' as const } : item))
      const next: RouteLogEvent = {
        id: `log-${Date.now().toString(36)}`,
        enrolleeId: selectedEnrollee.id,
        label: label.trim(),
        timestampIso: new Date().toISOString(),
        status: 'active',
        phase: newPhase,
        milestoneType: 'intervention',
        domainsRelieved: domains
      }
      appendRouteLogRecord(updatedLogs, next).then((finalLogs) => setLogs(finalLogs))
      return
    }
    const next: RouteLogEvent = {
      id: `log-${Date.now().toString(36)}`,
      enrolleeId: selectedEnrollee.id,
      label: label.trim(),
      timestampIso: new Date().toISOString(),
      status: 'active',
      phase: 'regulation',
      milestoneType: 'intervention',
      domainsRelieved: domains
    }
    appendRouteLogRecord(logs, next).then((finalLogs) => setLogs(finalLogs))
  }

  function updateRouteLogTimelinePosition(logId: string, timelinePositionRatio: number | null) {
    setLogs((current) => {
      const nextLogs = current.map((log) =>
        log.id === logId
          ? {
              ...log,
              timelinePositionRatio:
                typeof timelinePositionRatio === 'number' && Number.isFinite(timelinePositionRatio)
                  ? Math.max(0, Math.min(1, timelinePositionRatio))
                  : null
            }
          : log
      )
      persistRouteLogs(nextLogs).catch((error) => console.warn('Failed to persist route log timeline position.', error))
      return nextLogs
    })
  }

  function updateRouteLogDate(logId: string, nextTimestampIso: string) {
    setLogs((current) => {
      const nextLogs = current.map((log) =>
        log.id === logId
          ? {
              ...log,
              timestampIso: nextTimestampIso,
              timelinePositionRatio: null
            }
          : log
      )
      persistRouteLogs(nextLogs)
        .catch((error) => console.warn('Failed to persist route log date override.', error))
      return nextLogs
    })
  }

  function deleteRouteLog(logId: string) {
    setLogs((current) => {
      const nextLogs = current.filter((log) => log.id !== logId)
      persistRouteLogs(nextLogs)
        .catch((error) => console.warn('Failed to persist route log deletion.', error))
      return nextLogs
    })
  }

  function updateTimelineStartDate(nextStartIso: string) {
    if (!selectedTimelineConfig) return
    updateTimelineConfig({
      ...selectedTimelineConfig,
      planStartIso: nextStartIso
    })
  }

  function updateTimelinePhaseDuration(phase: StabilizationPhase) {
    if (!selectedTimelineConfig) return
    updateTimelineConfig(extendTimelinePhaseByMonth(selectedTimelineConfig, phase))
  }

  function updateTimelineConfig(nextConfig: TimelineConfig) {
    if (!selectedEnrollee) return
    const normalizedTimelineConfig = normalizeTimelineConfig(nextConfig)
    setBootstrapState((current) => ({
      ...current,
      timelineConfig: normalizedTimelineConfig,
      timelineConfigsByEnrolleeId: {
        ...current.timelineConfigsByEnrolleeId,
        [selectedEnrollee.id]: normalizedTimelineConfig
      }
    }))
    if (selectedIntake && selectedIntake.enrollmentStartIso !== normalizedTimelineConfig.planStartIso) {
      saveEnrolleeIntake({
        ...selectedIntake,
        enrollmentStartIso: normalizedTimelineConfig.planStartIso
      })
    }
    persistTimelineConfig(
      {
        enrolleeId: selectedEnrollee.id,
        enrollmentId: selectedEnrollee.enrollmentId
      },
      normalizedTimelineConfig
    ).catch((error) =>
      console.warn('Failed to persist enrollee timeline config.', error)
    )
  }

  async function saveAccountSettings(nextSettings: AccountSettings) {
    if (remoteSession) {
      throw new Error('Exit troubleshooting mode before editing account settings.')
    }
    const enabledRoles = nextSettings.enabledRoles.length ? nextSettings.enabledRoles : [role]
    const finalSettings = { ...nextSettings, enabledRoles }
    try {
      const saved = await persistAccountSettings(finalSettings)
      const stationProfile = await loadPartnerStationProfile(saved.organization, {
        fullName: saved.fullName,
        email: saved.email
      })
      setBootstrapState((current) => ({
        ...current,
        accountSettings: saved,
        partnerStationProfile: stationProfile
      }))
      if (!saved.enabledRoles.includes(role)) {
        setRole(saved.enabledRoles[0] || 'navigator')
      }
    } catch (error) {
      console.warn('Failed to save account settings.', error)
    }
  }

  async function replaceAccountProfileImage(file: File) {
    if (remoteSession) {
      throw new Error('Exit troubleshooting mode before editing account settings.')
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file.')
    }

    const previewUrl = URL.createObjectURL(file)
    const previousAvatarUrl = accountSettings.avatarUrl || null
    setIsUploadingAccountProfileImage(true)
    setAccountProfileImageUploadError(null)
    setBootstrapState((current) => ({
      ...current,
      accountSettings: {
        ...current.accountSettings,
        avatarUrl: previewUrl
      }
    }))

    try {
      const avatarUrl = await readFileAsDataUrl(file)
      const saved = await persistAccountSettings({
        ...accountSettings,
        avatarUrl
      })
      const stationProfile = await loadPartnerStationProfile(saved.organization, {
        fullName: saved.fullName,
        email: saved.email
      })
      setBootstrapState((current) => ({
        ...current,
        accountSettings: saved,
        partnerStationProfile: stationProfile
      }))
      return { avatarUrl }
    } catch (error) {
      setBootstrapState((current) => ({
        ...current,
        accountSettings: {
          ...current.accountSettings,
          avatarUrl: previousAvatarUrl
        }
      }))
      const message = error instanceof Error ? error.message : 'Unable to upload profile image.'
      setAccountProfileImageUploadError(message)
      throw error
    } finally {
      URL.revokeObjectURL(previewUrl)
      setIsUploadingAccountProfileImage(false)
    }
  }

  async function replaceSelectedEnrolleeProfileImage(file: File) {
    ensureWriteAllowed()
    if (!selectedEnrollee) {
      throw new Error('Select an enrollee profile before uploading an image.')
    }

    const previewUrl = URL.createObjectURL(file)
    const previousAvatarUrl = selectedEnrollee.avatarUrl || null
    setIsUploadingProfileImage(true)
    setProfileImageUploadError(null)
    setBootstrapState((current) => ({
      ...current,
      enrollees: current.enrollees.map((enrollee) =>
        enrollee.id === selectedEnrollee.id ? { ...enrollee, avatarUrl: previewUrl } : enrollee
      )
    }))

    try {
      const uploaded = await uploadEnrolleeProfileImage(selectedEnrollee.id, file)
      setBootstrapState((current) => ({
        ...current,
        enrollees: current.enrollees.map((enrollee) =>
          enrollee.id === selectedEnrollee.id ? { ...enrollee, avatarUrl: uploaded.avatarUrl } : enrollee
        )
      }))
      return uploaded
    } catch (error) {
      setBootstrapState((current) => ({
        ...current,
        enrollees: current.enrollees.map((enrollee) =>
          enrollee.id === selectedEnrollee.id ? { ...enrollee, avatarUrl: previousAvatarUrl || undefined } : enrollee
        )
      }))
      const message = error instanceof Error ? error.message : 'Unable to upload profile image.'
      setProfileImageUploadError(message)
      throw error
    } finally {
      URL.revokeObjectURL(previewUrl)
      setIsUploadingProfileImage(false)
    }
  }

  function saveEnrolleeIntake(nextIntake: EnrolleeIntakeRecord) {
    ensureWriteAllowed()
    persistEnrolleeIntake(nextIntake).then((saved) => {
      setBootstrapState((current) => ({
        ...current,
        intakeFormsByEnrolleeId: {
          ...current.intakeFormsByEnrolleeId,
          [saved.enrolleeId]: saved
        },
        enrollees: current.enrollees.map((enrollee) =>
          enrollee.id === saved.enrolleeId
            ? {
                ...enrollee,
                fullName: saved.fullName,
                dob: saved.dob,
                caseId: saved.caseId,
                email: saved.email,
                assignedNavigator: saved.assignedNavigator,
                zCodeTags: saved.zCodeTags
              }
            : enrollee
        ),
        timelineConfigsByEnrolleeId: {
          ...current.timelineConfigsByEnrolleeId,
          [saved.enrolleeId]: current.timelineConfigsByEnrolleeId[saved.enrolleeId]
            ? { ...current.timelineConfigsByEnrolleeId[saved.enrolleeId], planStartIso: saved.enrollmentStartIso }
            : createDefaultTimelineConfig(saved.enrollmentStartIso)
        }
      }))
    })
  }

  function saveRouteAssignment(candidate: RouteCandidateRecord, phase: StabilizationPhase) {
    ensureWriteAllowed()
    if (!selectedEnrollee) return
    const assignment: RouteAssignmentRecord = {
      enrolleeId: selectedEnrollee.id,
      stationId: candidate.stationId,
      stationName: candidate.stationName,
      assignedAtIso: new Date().toISOString(),
      phase,
      matchedZCodes: candidate.matchedZCodes
    }
    persistRouteAssignment(assignment).then((saved) => {
      setBootstrapState((current) => ({
        ...current,
        routeAssignmentsByEnrolleeId: {
          ...current.routeAssignmentsByEnrolleeId,
          [saved.enrolleeId]: saved
        }
      }))
    })
  }

  async function setEnrolleeZCodeResolution(
    enrolleeZCodeId: string,
    isResolved: boolean,
    input: EnrolleeZCodeResolutionInput = {}
  ) {
    ensureWriteAllowed()
    if (!selectedEnrollee || !enrolleeZCodeId) return null
    const saved = await persistEnrolleeZCodeResolution(enrolleeZCodeId, isResolved, input)
    setBootstrapState((current) => ({
      ...current,
      enrollees: current.enrollees.map((enrollee) => {
        if (enrollee.id !== selectedEnrollee.id) return enrollee
        const activeZCodeDetails = enrollee.activeZCodeDetails.map((detail) =>
          detail.enrolleeZCodeId === saved.enrolleeZCodeId
            ? {
                ...detail,
                isResolved: saved.isResolved,
                resolutionAt: saved.resolutionAt,
                resolutionPartnerId: saved.resolutionPartnerId ?? (saved.isResolved ? input.partnerId ?? null : null),
                resolutionPartnerName: saved.resolutionPartnerName ?? (saved.isResolved ? input.partnerName ?? null : null),
                resolutionNote: saved.resolutionNote ?? (saved.isResolved ? input.resolutionNote?.trim() || null : null)
              }
            : detail
        )
        return {
          ...enrollee,
          activeZCodeDetails,
          completedParentCodes: buildCompletedParentCodes(activeZCodeDetails)
        }
      })
    }))
    return saved
  }

  async function savePartnerServiceCapacitySurvey(input: PartnerServiceCapacitySubmissionInput) {
    ensureWriteAllowed()
    setIsSavingPartnerServiceCapacitySurvey(true)
    setPartnerServiceCapacitySurveyError(null)
    try {
      const saved = await persistPartnerServiceCapacitySurvey(input)
      setPartnerServiceCapacitySurveyHistory((current) => upsertServiceCapacitySubmissionHistory(current, saved))
      const nextAccountSettings = {
        ...accountSettings,
        fullName: `${input.header.firstName} ${input.header.lastName}`.trim() || accountSettings.fullName,
        email: input.header.email || accountSettings.email,
        organization: input.header.organizationName
      }
      setBootstrapState((current) => ({
        ...current,
        accountSettings: nextAccountSettings
      }))
      persistAccountSettings(nextAccountSettings)
      return saved
    } catch (error) {
      setPartnerServiceCapacitySurveyError(error instanceof Error ? error.message : 'Unable to save service capacity survey.')
      throw error
    } finally {
      setIsSavingPartnerServiceCapacitySurvey(false)
    }
  }

  async function reloadEnrolleeBurdenSurveyHistoryForEnrollment(enrollmentId: string) {
    const trimmedEnrollmentId = enrollmentId.trim()
    if (!trimmedEnrollmentId) return []
    setEnrolleeBurdenSurveyError(null)
    try {
      const rows = await loadEnrolleeBurdenSurveyHistory(trimmedEnrollmentId)
      setEnrolleeBurdenSurveyHistoryByEnrollmentId((current) => ({
        ...current,
        [trimmedEnrollmentId]: rows
      }))
      return rows
    } catch (error) {
      setEnrolleeBurdenSurveyError(
        error instanceof Error ? error.message : 'Unable to load enrollee burden survey.'
      )
      throw error
    }
  }

  async function saveEnrolleeBurdenSurvey(input: EnrolleeBurdenSurveySubmissionInput) {
    ensureWriteAllowed()
    setIsSavingEnrolleeBurdenSurvey(true)
    setEnrolleeBurdenSurveyError(null)
    try {
      const saved = await persistEnrolleeBurdenSurvey(input)
      setEnrolleeBurdenSurveyHistoryByEnrollmentId((current) => ({
        ...current,
        [input.header.enrollmentId]: upsertEnrolleeBurdenSurveyHistory(current[input.header.enrollmentId] || [], saved)
      }))

      if (saved.status === 'completed') {
        const breakdown = buildSurveyDomainLoadBreakdown({
          subjectId: saved.header.enrolleeId,
          subjectLabel: saved.header.enrolleeName,
          sourceKind: 'enrolleeSurvey',
          sourceLabel: `${saved.header.respondentRole} burden survey`,
          answers: saved.answers
        })
        const normalized = toNormalizedRadialDomainLoad(breakdown)
        setBootstrapState((current) => {
          const nextLoadMap = new Map(current.loads.map((load) => [load.enrolleeId, load]))
          if (normalized) {
            nextLoadMap.set(normalized.enrolleeId, normalized)
          }
          return {
            ...current,
            loads: Array.from(nextLoadMap.values()),
            loadBreakdownsByEnrolleeId: {
              ...current.loadBreakdownsByEnrolleeId,
              [saved.header.enrolleeId]: breakdown
            }
          }
        })
      }

      return saved
    } catch (error) {
      setEnrolleeBurdenSurveyError(
        error instanceof Error ? error.message : 'Unable to save enrollee burden survey.'
      )
      throw error
    } finally {
      setIsSavingEnrolleeBurdenSurvey(false)
    }
  }

  async function reloadPartnerServiceCapacitySurveyHistory() {
    if (viewerRole !== 'partner') return
    const organizationName = effectivePartnerOrganizationName?.trim()
    if (!organizationName) return
    setPartnerServiceCapacitySurveyError(null)
    try {
      const rows = await loadPartnerServiceCapacitySurveyHistory(organizationName)
      setPartnerServiceCapacitySurveyHistory(rows)
    } catch (error) {
      setPartnerServiceCapacitySurveyError(
        error instanceof Error ? error.message : 'Unable to load service capacity survey.'
      )
    }
  }

  async function deletePartnerServiceCapacityDraft(submissionId: string) {
    ensureWriteAllowed()
    setIsSavingPartnerServiceCapacitySurvey(true)
    setPartnerServiceCapacitySurveyError(null)
    try {
      const deleted = await deletePartnerServiceCapacityDraftRecord(submissionId)
      setPartnerServiceCapacitySurveyHistory((current) =>
        current.filter((record) => record.id !== deleted.id && record.draftKey !== deleted.draftKey)
      )
      return deleted
    } catch (error) {
      setPartnerServiceCapacitySurveyError(error instanceof Error ? error.message : 'Unable to delete service capacity draft.')
      throw error
    } finally {
      setIsSavingPartnerServiceCapacitySurvey(false)
    }
  }

  async function deleteEnrolleeBurdenSurveyDraft(submissionId: string, enrollmentId: string) {
    ensureWriteAllowed()
    setIsSavingEnrolleeBurdenSurvey(true)
    setEnrolleeBurdenSurveyError(null)
    try {
      const deleted = await deleteEnrolleeBurdenSurveyDraftRecord(submissionId)
      setEnrolleeBurdenSurveyHistoryByEnrollmentId((current) => ({
        ...current,
        [enrollmentId]: (current[enrollmentId] || []).filter(
          (record) => record.id !== deleted?.id && record.draftKey !== deleted?.draftKey
        )
      }))
      return deleted
    } catch (error) {
      setEnrolleeBurdenSurveyError(
        error instanceof Error ? error.message : 'Unable to delete enrollee burden draft.'
      )
      throw error
    } finally {
      setIsSavingEnrolleeBurdenSurvey(false)
    }
  }

  async function saveNavigatorCompetencyAssessment(input: {
    navigatorName: string
    supervisorName: string
    formVersion: string
    answers: NavigatorCompetencyAssessmentRecord['answers']
  }) {
    ensureWriteAllowed()
    const saved = await persistNavigatorCompetencyAssessment(input)
    setBootstrapState((current) => ({
      ...current,
      navigatorCompetencyAssessments: [saved, ...current.navigatorCompetencyAssessments]
    }))
    return saved
  }

  async function saveAdminPortalRegistry(registry: AdminPortalRegistry) {
    if (!viewerCanAccessAdminRegistryCards) {
      throw new Error('Admin registry updates are disabled by policy for this account.')
    }
    setIsSavingAdminPortalRegistry(true)
    setAdminPortalRegistryError(null)
    try {
      const saved = await persistAdminPortalRegistry(registry)
      setAdminPortalRegistry(saved)
      return saved
    } catch (error) {
      setAdminPortalRegistryError(error instanceof Error ? error.message : 'Unable to save admin portal registry.')
      throw error
    } finally {
      setIsSavingAdminPortalRegistry(false)
    }
  }

  async function refreshAccessMatrixDataset() {
    const dataset = await loadAccessMatrixDataset()
    setAccessMatrixDataset(dataset)
    return dataset
  }

  async function refreshAssignmentParityViews() {
    await Promise.all([
      loadNavigatorEnrollmentAssignments().then((rows) => {
        setNavigatorEnrollmentAssignments(rows)
        setNavigatorEnrollmentAssignmentsError(null)
      }),
      reloadBootstrapState()
    ])
  }

  async function savePartnerGrant(grant: PartnerTroubleshootingGrant) {
    const saved = await persistPartnerTroubleshootingGrant(grant)
    setPartnerTroubleshootingGrants((current) => ({
      ...current,
      [saved.partnerId]: saved
    }))
    setRemoteSession((current) =>
      current?.targetRole === 'partner' && current.partnerGrant?.partnerId === saved.partnerId
        ? { ...current, partnerGrant: saved }
        : current
    )
    return saved
  }

  async function startTroubleshootingSession(targetPersonId: string, targetRole: AtlasRole) {
    const targetPerson = accessMatrixDataset?.people.find((person) => person.id === targetPersonId) || null
    if (!targetPerson) {
      throw new Error(toRemoteSessionErrorMessage(targetRole))
    }
    const partnerAssignment =
      targetRole === 'partner'
        ? accessMatrixDataset?.partnerAssignments.find((partner) => partner.primaryContactPersonIds.includes(targetPersonId)) || null
        : null
    const partnerGrant = partnerAssignment ? partnerTroubleshootingGrants[partnerAssignment.partnerId] || null : null
    if (targetRole === 'partner' && (!partnerAssignment || !partnerGrant || !partnerGrant.allowedMenus.length)) {
      throw new Error(toRemoteSessionErrorMessage(targetRole))
    }
    setRemoteSession({
      isActive: true,
      targetPersonId,
      targetRole,
      targetDisplayName: targetPerson.fullName,
      targetEmail: targetPerson.email,
      targetOrganizationName: partnerAssignment?.organizationName || null,
      startedAtIso: new Date().toISOString(),
      partnerGrant
    })
  }

  function stopTroubleshootingSession() {
    setRemoteSession(null)
  }

  function ensureWriteAllowed() {
    if (remoteSession?.targetRole === 'partner' && !remoteSession.partnerGrant?.allowWrite) {
      throw new Error('This partner troubleshooting session is read-only until the partner grants write access.')
    }
  }

  async function saveAccessMatrixPersonRoles(personId: string, roleKeys: AdminPortalPersonRole[]) {
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixPersonRoles(personId, roleKeys)
      await refreshAccessMatrixDataset()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : 'Unable to save person role assignments.')
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  async function saveAccessMatrixEnrollmentNavigators(enrollmentId: string, navigatorPersonIds: string[]) {
    if (!viewerCanAccessAdminRegistryCards) {
      throw new Error('Coverage updates are disabled by policy for this account.')
    }
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixEnrollmentNavigators(enrollmentId, navigatorPersonIds)
      await refreshAccessMatrixDataset()
      await refreshAssignmentParityViews()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : 'Unable to save navigator enrollment assignments.')
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  async function saveAccessMatrixSupervisorAssignments(navigatorPersonId: string, supervisorPersonIds: string[]) {
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixSupervisorAssignments(navigatorPersonId, supervisorPersonIds)
      await refreshAccessMatrixDataset()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : 'Unable to save supervisor assignments.')
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  async function toggleSupervisorManagedNavigator(navigatorPersonId: string, isManaged: boolean) {
    if (!viewerPerson?.id || !accessMatrixDataset) return
    const currentAssignment = accessMatrixDataset.supervisorAssignments.find(
      (assignment) => assignment.navigatorPersonId === navigatorPersonId
    )
    const currentSupervisorIds = currentAssignment?.supervisorPersonIds || []
    const nextSupervisorIds = isManaged
      ? Array.from(new Set([...currentSupervisorIds, viewerPerson.id]))
      : currentSupervisorIds.filter((supervisorPersonId) => supervisorPersonId !== viewerPerson.id)
    await saveAccessMatrixSupervisorAssignments(navigatorPersonId, nextSupervisorIds)
  }

  async function assignNavigatorEnrollmentToSelf(enrollmentId: string, mode: 'assign' | 'unassign' = 'assign') {
    if (!viewerCanUseAssignmentActions) {
      setNavigatorEnrollmentAssignmentsError('Assignment actions are disabled by admin policy for this account.')
      return
    }
    setAssigningNavigatorEnrollmentId(enrollmentId)
    setNavigatorEnrollmentAssignmentsError(null)
    try {
      if (mode === 'unassign') {
        await persistUnassignNavigatorEnrollmentFromSelf(enrollmentId)
      } else {
        await persistAssignNavigatorEnrollmentToSelf(enrollmentId)
      }
      await Promise.all([
        loadNavigatorEnrollmentAssignments().then((rows) => setNavigatorEnrollmentAssignments(rows)),
        reloadBootstrapState()
      ])
    } catch (error) {
      const typedDatabaseError = error as { code?: string; message?: string; details?: string; hint?: string } | null
      const databaseErrorCode = typedDatabaseError?.code
      if (databaseErrorCode === 'PGRST202') {
        setNavigatorEnrollmentAssignmentsError(
          mode === 'unassign'
            ? 'Navigator self-unassignment RPC is not deployed yet. Apply the latest Supabase migrations and retry.'
            : 'Navigator self-assignment RPC is not deployed yet. Apply the latest Supabase migrations and retry.'
        )
        return
      }
      if (typedDatabaseError?.message) {
        const detailParts = [
          typedDatabaseError.message,
          typedDatabaseError.details ? `details: ${typedDatabaseError.details}` : '',
          typedDatabaseError.hint ? `hint: ${typedDatabaseError.hint}` : '',
          databaseErrorCode ? `code: ${databaseErrorCode}` : ''
        ].filter(Boolean)
        setNavigatorEnrollmentAssignmentsError(detailParts.join(' | '))
        return
      }
      setNavigatorEnrollmentAssignmentsError(
        error instanceof Error
          ? error.message
          : mode === 'unassign'
            ? 'Unable to unassign enrollee from navigator.'
            : 'Unable to assign enrollee to navigator.'
      )
    } finally {
      setAssigningNavigatorEnrollmentId(null)
    }
  }

  async function saveAccessMatrixPartnerPrimaryContacts(partnerId: string, primaryContactPersonIds: string[]) {
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixPartnerPrimaryContacts(partnerId, primaryContactPersonIds)
      await refreshAccessMatrixDataset()
    } catch (error) {
      setAccessMatrixError(error instanceof Error ? error.message : 'Unable to save partner ownership assignments.')
      throw error
    } finally {
      setIsSavingAccessMatrix(false)
    }
  }

  async function saveNavigatorProgramState(state: NavigatorProgramState) {
    setNavigatorProgramError(null)
    try {
      const saved = await persistNavigatorProgramState(state)
      setNavigatorProgramState(saved)
      return saved
    } catch (error) {
      setNavigatorProgramError(error instanceof Error ? error.message : 'Unable to save navigator program state.')
      throw error
    }
  }

  async function claimPickupQueueRecord(recordId: string) {
    ensureWriteAllowed()
    const claimedRecord = mergedNavigatorProgramState.pickupQueue.find((record) => record.id === recordId) || null
    const nextState = {
      ...mergedNavigatorProgramState,
      pickupQueue: mergedNavigatorProgramState.pickupQueue.map((record) =>
        record.id === recordId
          ? {
              ...record,
              status: 'claimed' as const,
              claimedByNavigatorName: currentNavigatorName,
              claimedAtIso: new Date().toISOString()
            }
          : record
      )
    }
    const savedState = await saveNavigatorProgramState(nextState)
    if (claimedRecord) {
      try {
        const materialized = await materializeClaimedReferralIntoEnrollment(claimedRecord)
        if (materialized?.enrollmentId) {
          await persistAssignNavigatorEnrollmentToSelf(materialized.enrollmentId)
          try {
            const inferred = await inferZCodesForReferral({
              fullName: claimedRecord.fullName,
              situationCategories: claimedRecord.zCodeTags,
              backgroundNotes: claimedRecord.backgroundNotes,
              referrerMessage: claimedRecord.referrerMessage
            })
            await upsertEnrollmentInferredZCodes(materialized.enrollmentId, inferred.zCodes)
          } catch (inferenceError) {
            console.warn('Unable to enrich claimed referral with inferred z-codes.', inferenceError)
          }
        }
      } catch (error) {
        setNavigatorProgramError(
          error instanceof Error
            ? error.message
            : 'Claim saved, but we could not associate this enrollee to your navigator profile.'
        )
        console.warn('Unable to materialize claimed referral into enrollee enrollment.', error)
      }
      await Promise.all([
        loadNavigatorEnrollmentAssignments().then((rows) => setNavigatorEnrollmentAssignments(rows)),
        reloadBootstrapState()
      ])
    }
    return savedState
  }

  async function saveNavigatorSelfAssessment(record: NavigatorSelfAssessmentRecord) {
    ensureWriteAllowed()
    const nextState = {
      ...mergedNavigatorProgramState,
      selfAssessments: [
        record,
        ...mergedNavigatorProgramState.selfAssessments.filter((item) => item.id !== record.id)
      ]
    }
    return saveNavigatorProgramState(nextState)
  }

  async function saveSupervisionSession(record: SupervisionSessionRecord) {
    ensureWriteAllowed()
    const nextState = {
      ...mergedNavigatorProgramState,
      supervisionSessions: [
        record,
        ...mergedNavigatorProgramState.supervisionSessions.filter((item) => item.id !== record.id)
      ]
    }
    return saveNavigatorProgramState(nextState)
  }

  async function saveIntervalAssessmentRule(rule: IntervalAssessmentRule) {
    ensureWriteAllowed()
    const nextState = {
      ...mergedNavigatorProgramState,
      intervalAssessmentRules: [
        rule,
        ...mergedNavigatorProgramState.intervalAssessmentRules.filter((item) => item.id !== rule.id)
      ]
    }
    return saveNavigatorProgramState(nextState)
  }

  async function submitPartnerReferral(input: PartnerReferralSubmissionInput) {
    ensureWriteAllowed()
    const { nextRecord, nextState } = buildReferralQueueUpdate(input, mergedNavigatorProgramState, {
      accountFullName: accountSettings.fullName,
      accountOrganization: effectiveAccountSettings.organization,
      partnerStationOrganizationName: effectivePartnerStationProfile?.organizationName || null,
      actorRoleLabel: role,
      sourceLabel: 'single-pane referral portal'
    })
    await saveNavigatorProgramState(nextState)
    return nextRecord
  }

  async function saveNavigatorRegulationTest(input: RegulationTestSubmissionInput) {
    ensureWriteAllowed()
    setIsSavingRegulationTest(true)
    setRegulationTestError(null)
    try {
      const saved = await saveRegulationTestSubmission(input)
      setRegulationTestHistory((current) => upsertRegulationTestHistory(current, saved))
      return saved
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save regulation test.'
      setRegulationTestError(message)
      throw error
    } finally {
      setIsSavingRegulationTest(false)
    }
  }

  async function deleteNavigatorRegulationTestDraft(submissionId: string) {
    ensureWriteAllowed()
    setIsSavingRegulationTest(true)
    setRegulationTestError(null)
    try {
      const deleted = await deleteRegulationTestDraft(submissionId)
      if (!deleted) return
      setRegulationTestHistory((current) =>
        current.filter((record) => record.id !== deleted.id && record.draftKey !== deleted.draftKey)
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete regulation test draft.'
      setRegulationTestError(message)
      throw error
    } finally {
      setIsSavingRegulationTest(false)
    }
  }

  async function searchPartnerIdentifierMatches(firstName: string, lastName: string): Promise<PartnerIdentifierRecord[]> {
    return searchPartnerIdentifierRecordMatches(firstName, lastName)
  }

  async function ensurePartnerIdentifier(header: {
    firstName: string
    lastName: string
    organizationName: string
    email?: string | null
  }): Promise<PartnerIdentifierRecord> {
    return ensurePartnerIdentifierRecordForSurvey(header)
  }

  return {
    role,
    viewerRole,
    setRole,
    remoteSession,
    partnerTroubleshootingGrants,
    selectedEnrolleeId,
    setSelectedEnrolleeId,
    activeMenu,
    setActiveMenu,
    isLoading,
    enrollees: scopedEnrollees,
    selectedEnrollee,
    selectedLoad,
    selectedLoadBreakdown,
    selectedLogs,
    selectedRoleConfig,
    timelineConfig: selectedTimelineConfig,
    enrollmentRequests,
    routeCandidates,
    countyHeatmap,
    adminMetrics,
    adminPortalRegistry,
    adminPortalRegistryError,
    accessMatrixDataset,
    accessMatrixError,
    navigatorProgramState: mergedNavigatorProgramState,
    navigatorProgramError,
    journeyStationMarkers,
    resolvedZCodeStripMarkers,
    partnerServiceCapacitySurveyHistory,
    enrolleeBurdenSurveyHistoryByEnrollmentId,
    setPartnerServiceCapacitySurveyHistory,
    partnerServiceCapacityDefaultHeader,
    isSavingPartnerServiceCapacitySurvey,
    partnerServiceCapacitySurveyError,
    isSavingEnrolleeBurdenSurvey,
    enrolleeBurdenSurveyError,
    reloadPartnerServiceCapacitySurveyHistory,
    regulationTestHistory,
    regulationTestStripMarkers,
    latestCompletedMhSca,
    latestCompletedSvs,
    isRegulationCleared,
    shouldHideReadinessProgress,
    isSavingRegulationTest,
    regulationTestError,
    isUploadingProfileImage,
    profileImageUploadError,
    isUploadingAccountProfileImage,
    accountProfileImageUploadError,
    currentNavigatorName,
    navigatorAggregateLoad,
    navigatorAggregateLoadBreakdown,
    pickupQueue,
    navigatorSelfAssessments,
    navigatorSelfAssessmentSummary,
    navigatorEnrollmentAssignments,
    viewerCanViewNavigatorAssignmentNames,
    viewerCanAccessAssignmentBoard,
    viewerCanUseAssignmentActions,
    viewerCanAccessAdminRegistryCards,
    navigatorEnrollmentAssignmentsError,
    isLoadingNavigatorEnrollmentAssignments,
    assigningNavigatorEnrollmentId,
    navigatorSupervisionSessions,
    navigatorAssignedCompetencySummary,
    supervisorNavigatorDirectory,
    navigatorIntervalRules,
    navigatorIntervalDueItems,
    searchPartnerIdentifierMatches,
    ensurePartnerIdentifier,
    supervisorNavigatorCompetency,
    navigatorCompetencyAssessments,
    selectedRouteAssignment,
    appendRouteLog,
    deleteRouteLog,
    updateRouteLogTimelinePosition,
    updateRouteLogDate,
    updateTimelineStartDate,
    updateTimelinePhaseDuration,
    updateTimelineConfig,
    accountSettings: effectiveAccountSettings,
    partnerStationProfile: effectivePartnerStationProfile,
    intakeFormsByEnrolleeId,
    selectedIntake,
    hasSavedIntake,
    isSavingAdminPortalRegistry,
    isSavingAccessMatrix,
    viewerCanWrite: remoteSession?.targetRole === 'partner' ? Boolean(remoteSession.partnerGrant?.allowWrite) : true,
    saveAccountSettings,
    saveAdminPortalRegistry,
    saveAccessMatrixPersonRoles,
    saveAccessMatrixEnrollmentNavigators,
    saveAccessMatrixSupervisorAssignments,
    toggleSupervisorManagedNavigator,
    assignNavigatorEnrollmentToSelf,
    saveAccessMatrixPartnerPrimaryContacts,
    startTroubleshootingSession,
    stopTroubleshootingSession,
    savePartnerTroubleshootingGrant: savePartnerGrant,
    saveNavigatorProgramState,
    claimPickupQueueRecord,
    saveNavigatorSelfAssessment,
    saveSupervisionSession,
    saveIntervalAssessmentRule,
    submitPartnerReferral,
    replaceAccountProfileImage,
    replaceSelectedEnrolleeProfileImage,
    saveEnrolleeIntake,
    setEnrolleeZCodeResolution,
    saveRouteAssignment,
    savePartnerServiceCapacitySurvey,
    saveEnrolleeBurdenSurvey,
    deletePartnerServiceCapacityDraft,
    deleteEnrolleeBurdenSurveyDraft,
    reloadEnrolleeBurdenSurveyHistoryForEnrollment,
    saveNavigatorCompetencyAssessment,
    saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft
  }
}
