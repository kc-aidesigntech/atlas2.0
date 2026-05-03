import { useEffect, useMemo, useState } from 'react'
import type {
  AccessMatrixDataset,
  AdminPortalRegistry,
  AdminPortalPersonRole,
  AdminDataQualityMetric,
  AccountSettings,
  AtlasRole,
  CountyHeatPoint,
  DomainLoadBreakdown,
  DomainLoad,
  EnrolleeActiveZCode,
  EnrolleeIntakeRecord,
  EnrollmentRequestRecord,
  EnrolleeProfile,
  EnrolleeZCodeResolutionInput,
  IntervalAssessmentDueItem,
  IntervalAssessmentRule,
  JourneyStationMarker,
  NavigatorProgramState,
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
  deletePartnerServiceCapacityDraftRecord,
  loadAdminPortalRegistry,
  loadAdminDataQuality,
  loadCountyHeatmap,
  loadEnrollmentRequests,
  prefetchJourneyStationMarkersForEnrollments,
  prefetchRouteCandidatesForEnrollments,
  loadPartnerServiceCapacitySurveyHistory,
  loadPartnerStationProfile,
  loadNavigatorProgramState,
  loadPartnerTroubleshootingGrants,
  searchPartnerIdentifierRecordMatches,
  ensurePartnerIdentifierRecordForSurvey,
  uploadEnrolleeProfileImage,
  saveAdminPortalRegistry as persistAdminPortalRegistry,
  saveAccountSettings as persistAccountSettings,
  saveAccessMatrixEnrollmentNavigators as persistAccessMatrixEnrollmentNavigators,
  saveAccessMatrixPartnerPrimaryContacts as persistAccessMatrixPartnerPrimaryContacts,
  saveAccessMatrixPersonRoles as persistAccessMatrixPersonRoles,
  saveAccessMatrixSupervisorAssignments as persistAccessMatrixSupervisorAssignments,
  saveNavigatorProgramState as persistNavigatorProgramState,
  savePartnerTroubleshootingGrant as persistPartnerTroubleshootingGrant,
  setEnrolleeZCodeResolution as persistEnrolleeZCodeResolution,
  savePartnerServiceCapacitySurvey as persistPartnerServiceCapacitySurvey,
  saveNavigatorCompetencyAssessment as persistNavigatorCompetencyAssessment,
  saveRouteAssignment as persistRouteAssignment,
  saveTimelineConfig as persistTimelineConfig,
  saveRouteLogs as persistRouteLogs,
  saveEnrolleeIntake as persistEnrolleeIntake,
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

/**
 * Primary single-pane orchestration hook.
 *
 * Purpose:
 * - composes bootstrap state, role workflows, and persistence writes.
 * - provides a stable Application Programming Interface (API) consumed by single-pane User Interface (UI) surfaces.
 */

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
  } catch {
    // Session restore is a progressive enhancement; storage failures stay non-fatal.
  }
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
  // Preserve previously persisted records, but seed deterministic starter data when
  // no state exists yet so navigator dashboards always have actionable baseline rows.
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
  const maxTotal = Math.max(totals.habitat, totals.work, totals.socialNetworks, 1)
  return {
    enrolleeId: 'navigator-aggregate',
    habitat: Math.round((totals.habitat / maxTotal) * 100),
    work: Math.round((totals.work / maxTotal) * 100),
    socialNetworks: Math.round((totals.socialNetworks / maxTotal) * 100)
  }
}

function deriveNavigatorLoadBreakdown(loadBreakdowns: Record<string, DomainLoadBreakdown>, navigatorName: string): DomainLoadBreakdown | null {
  const values = Object.values(loadBreakdowns)
  if (!values.length) return null
  const rows = values.flatMap((breakdown) => breakdown.rows)
  const totals = rows.reduce(
    (sum, row) => {
      if (row.mappedDomain === 'habitat') sum.habitatTotal += row.rawCount
      if (row.mappedDomain === 'work') sum.workTotal += row.rawCount
      if (row.mappedDomain === 'socialNetworks') sum.socialNetworksTotal += row.rawCount
      return sum
    },
    { habitatTotal: 0, workTotal: 0, socialNetworksTotal: 0 }
  )
  return {
    subjectId: 'navigator-aggregate',
    subjectLabel: navigatorName,
    sourceKind: 'enrolleeRecords',
    sourceLabel: 'Assigned enrollee aggregate',
    ...totals,
    rows: rows.map((row, index) => ({ ...row, id: `${row.id}:${index}` }))
  }
}

interface SupervisorNavigatorDirectoryEntry {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

export function useSinglePaneData(initialRole: AtlasRole = 'navigator') {
  /**
   * Orchestrates single-pane read/write state across UI memory and persistence adapters.
   *
   * Data-flow boundary:
   * - `setBootstrapState` mutates immediate UI state for responsiveness.
   * - repository calls persist into local storage and/or Supabase depending on availability.
   * - hook-level helpers keep those two surfaces eventually consistent.
   */
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
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false)
  const [profileImageUploadError, setProfileImageUploadError] = useState<string | null>(null)
  const [isUploadingAccountProfileImage, setIsUploadingAccountProfileImage] = useState(false)
  const [accountProfileImageUploadError, setAccountProfileImageUploadError] = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState('')
  const [regulationTestHistory, setRegulationTestHistory] = useState<RegulationTestSubmissionRecord[]>([])
  const [isSavingRegulationTest, setIsSavingRegulationTest] = useState(false)
  const [regulationTestError, setRegulationTestError] = useState<string | null>(null)
  const publicQueueRecords = useMemo(() => loadPublicReferralQueueRecords(), [])
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
    setState: setBootstrapState
  } = useSinglePaneBootstrapState(role)

  const viewerRole = remoteSession?.targetRole || role
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
    if (!remoteSession || !accessMatrixDataset) return null
    if (remoteSession.targetRole === 'navigator') {
      return new Set(
        accessMatrixDataset.enrollmentAssignments
          .filter((assignment) => assignment.navigatorPersonIds.includes(remoteSession.targetPersonId))
          .map((assignment) => assignment.enrollmentId)
      )
    }
    if (remoteSession.targetRole === 'supervisor') {
      const navigatorIds = new Set(
        accessMatrixDataset.supervisorAssignments
          .filter((assignment) => assignment.supervisorPersonIds.includes(remoteSession.targetPersonId))
          .map((assignment) => assignment.navigatorPersonId)
      )
      return new Set(
        accessMatrixDataset.enrollmentAssignments
          .filter((assignment) => assignment.navigatorPersonIds.some((navigatorPersonId) => navigatorIds.has(navigatorPersonId)))
          .map((assignment) => assignment.enrollmentId)
      )
    }
    if (remoteSession.targetRole === 'partner') return new Set<string>()
    return null
  }, [accessMatrixDataset, remoteSession])
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
      if ((viewerRole === 'partner' || viewerRole === 'supervisor') && partnerLoad) return partnerLoad
      return scopedLoads.find((item) => item.enrolleeId === selectedEnrollee?.id) || scopedLoads[0] || null
    },
    [partnerLoad, scopedLoads, selectedEnrollee, viewerRole]
  )

  const selectedLoadBreakdown = useMemo(
    () => {
      if ((viewerRole === 'partner' || viewerRole === 'supervisor') && partnerLoadBreakdown) return partnerLoadBreakdown
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

  useEffect(() => {
    // Keep deep-linked menu state valid when role config changes.
    // Invariant: `activeMenu` must always be one of the current role's top menus.
    const firstMenu = selectedRoleConfig.topMenus?.[0]
    if (!firstMenu) return
    if (!selectedRoleConfig.topMenus.includes(activeMenu)) {
      setActiveMenu(firstMenu)
    }
  }, [activeMenu, selectedRoleConfig])

  useEffect(() => {
    // Maintain a stable selected enrollee pointer after bootstrap reloads
    // and role changes that may swap the visible enrollee list.
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
      // Fallback path for offline/mock states: derive navigator labels from enrollee headers.
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
    () =>
      mergedNavigatorProgramState.pickupQueue
        .filter((item) => item.status !== 'archived')
        .slice()
        .sort((left, right) => new Date(right.referredAtIso).getTime() - new Date(left.referredAtIso).getTime()),
    [mergedNavigatorProgramState.pickupQueue]
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
    // Defer prefetch slightly so visible screen work commits first, then warm route
    // and timeline caches for likely-next enrollees in the same navigator session.
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
      // Resolve identity linkage from live auth session first so role propagation
      // does not depend on potentially stale local account-settings email values.
      setSessionEmail(data.session?.user?.email?.trim() || '')
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    // Fire-and-forget bootstrap read; guard with `isMounted` to avoid setting stale
    // state if a role switch unmounts before the request resolves.
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
    // Program state has its own persistence stream because it can be mutated from
    // multiple UI surfaces (profile panel, referral flow, admin controls).
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
    if (viewerRole !== 'administrator') {
      // Access-matrix tables are admin-scoped. Clear stale values when role
      // changes away from admin to avoid permission-noise and stale UI state.
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
    // Regulation history is navigator + enrollee scoped; clear stale records eagerly
    // when either dimension changes to avoid rendering prior enrollee results.
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
    // Keep UI role options aligned to live role assignments for the signed-in identity.
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
      persistRouteLogs(nextLogs)
        // Timeline drag should never block UI updates; failed writes stay non-fatal
        // and are retried on future log persistence operations.
        .catch((error) => console.warn('Failed to persist route log timeline position.', error))
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
    // Update in-memory timeline immediately for smooth editing interactions, then
    // persist both timeline config and intake start date so those two fields cannot drift.
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
      // Optimistic preview is replaced with canonical persisted Uniform Resource Locator (URL) once upload succeeds.
      const uploaded = await uploadEnrolleeProfileImage(selectedEnrollee.id, file)
      setBootstrapState((current) => ({
        ...current,
        enrollees: current.enrollees.map((enrollee) =>
          enrollee.id === selectedEnrollee.id ? { ...enrollee, avatarUrl: uploaded.avatarUrl } : enrollee
        )
      }))
      return uploaded
    } catch (error) {
      // Roll back to the prior avatar on failure so UI does not keep a dead blob URL.
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
      // Blob Uniform Resource Locators (URLs) are process-local browser resources and must be revoked to avoid leaks.
      URL.revokeObjectURL(previewUrl)
      setIsUploadingProfileImage(false)
    }
  }

  function saveEnrolleeIntake(nextIntake: EnrolleeIntakeRecord) {
    ensureWriteAllowed()
    // Intake edits are a cross-surface source of truth: they update the intake record
    // and denormalized enrollee header fields consumed across profile and timeline views.
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
    // Persist first, then project the response into enrollee state so completed parent
    // code badges remain consistent with the resolved child-code set.
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
      // Best-effort account settings sync: survey completion should succeed even if
      // profile metadata persistence fails later.
      persistAccountSettings(nextAccountSettings)
      return saved
    } catch (error) {
      setPartnerServiceCapacitySurveyError(error instanceof Error ? error.message : 'Unable to save service capacity survey.')
      throw error
    } finally {
      setIsSavingPartnerServiceCapacitySurvey(false)
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

  async function saveNavigatorCompetencyAssessment(input: {
    navigatorName: string
    supervisorName: string
    formVersion: string
    answers: NavigatorCompetencyAssessmentRecord['answers']
  }) {
    ensureWriteAllowed()
    // Insert newest-first to keep supervisor views sorted without recomputing entire list.
    const saved = await persistNavigatorCompetencyAssessment(input)
    setBootstrapState((current) => ({
      ...current,
      navigatorCompetencyAssessments: [saved, ...current.navigatorCompetencyAssessments]
    }))
    return saved
  }

  async function saveAdminPortalRegistry(registry: AdminPortalRegistry) {
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
    setIsSavingAccessMatrix(true)
    setAccessMatrixError(null)
    try {
      await persistAccessMatrixEnrollmentNavigators(enrollmentId, navigatorPersonIds)
      await refreshAccessMatrixDataset()
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
      // Treat repository return as canonical because persistence layer normalizes payloads.
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
    return saveNavigatorProgramState(nextState)
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
    // Shared mapper keeps referral normalization logic consistent regardless of
    // where referral submissions are initiated in the product.
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
    setPartnerServiceCapacitySurveyHistory,
    partnerServiceCapacityDefaultHeader,
    isSavingPartnerServiceCapacitySurvey,
    partnerServiceCapacitySurveyError,
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
    deletePartnerServiceCapacityDraft,
    saveNavigatorCompetencyAssessment,
    saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft
  }
}
