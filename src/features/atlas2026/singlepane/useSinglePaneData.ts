import { useEffect, useMemo, useState } from 'react'
import type {
  AdminPortalRegistry,
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
  PartnerIdentifierRecord,
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
  loadPartnerServiceCapacitySurveyHistory,
  loadPartnerStationProfile,
  loadNavigatorProgramState,
  searchPartnerIdentifierRecordMatches,
  ensurePartnerIdentifierRecordForSurvey,
  uploadEnrolleeProfileImage,
  saveAdminPortalRegistry as persistAdminPortalRegistry,
  saveAccountSettings as persistAccountSettings,
  saveNavigatorProgramState as persistNavigatorProgramState,
  setEnrolleeZCodeResolution as persistEnrolleeZCodeResolution,
  savePartnerServiceCapacitySurvey as persistPartnerServiceCapacitySurvey,
  saveNavigatorCompetencyAssessment as persistNavigatorCompetencyAssessment,
  saveRouteAssignment as persistRouteAssignment,
  saveTimelineConfig as persistTimelineConfig,
  saveRouteLogs as persistRouteLogs,
  saveEnrolleeIntake as persistEnrolleeIntake
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { useJourneyStationMarkers } from '@/features/atlas2026/singlepane/hooks/useJourneyStationMarkers'
import { usePartnerServiceCapacityHistory } from '@/features/atlas2026/singlepane/hooks/usePartnerServiceCapacityHistory'
import { useRouteCandidates } from '@/features/atlas2026/singlepane/hooks/useRouteCandidates'
import { useSinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'
import {
  buildDefaultTimelineGates,
  DEFAULT_TIMELINE_DURATION_MONTHS,
  DEFAULT_TIMELINE_MAX_DURATION_MONTHS,
  extendTimelinePhaseByMonth,
  normalizeTimelineConfig
} from '@/features/atlas2026/singlepane/timelineConfigUtils'
import {
  deleteRegulationTestDraft,
  loadRegulationTestHistory,
  saveRegulationTestSubmission
} from '@/features/atlas2026/singlepane/data-access/regulationTestsRepository'

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

function nextPhase(current?: StabilizationPhase): StabilizationPhase {
  if (current === 'regulation') return 'readiness'
  if (current === 'readiness') return 'renewal'
  return 'renewal'
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  }
}

function buildFallbackTimelineConfig(planStartIso: string): TimelineConfig {
  return {
    planStartIso,
    durationMonths: DEFAULT_TIMELINE_DURATION_MONTHS,
    maxDurationMonths: DEFAULT_TIMELINE_MAX_DURATION_MONTHS,
    gates: buildDefaultTimelineGates(DEFAULT_TIMELINE_DURATION_MONTHS)
  }
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
  enrollmentRequests: EnrollmentRequestRecord[]
): NavigatorProgramState {
  const base = rawState || createNavigatorProgramState()
  return {
    pickupQueue: base.pickupQueue.length ? base.pickupQueue : buildSeedPickupQueue(enrollmentRequests),
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

export function useSinglePaneData(initialRole: AtlasRole = 'navigator') {
  const [role, setRole] = useState<AtlasRole>(initialRole)
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string>('')
  const [activeMenu, setActiveMenu] = useState<string>('')
  const [adminPortalRegistry, setAdminPortalRegistry] = useState<AdminPortalRegistry | null>(null)
  const [navigatorProgramState, setNavigatorProgramState] = useState<NavigatorProgramState>(createNavigatorProgramState())
  const [isSavingAdminPortalRegistry, setIsSavingAdminPortalRegistry] = useState(false)
  const [adminPortalRegistryError, setAdminPortalRegistryError] = useState<string | null>(null)
  const [navigatorProgramError, setNavigatorProgramError] = useState<string | null>(null)
  const [isSavingPartnerServiceCapacitySurvey, setIsSavingPartnerServiceCapacitySurvey] = useState(false)
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false)
  const [profileImageUploadError, setProfileImageUploadError] = useState<string | null>(null)
  const [regulationTestHistory, setRegulationTestHistory] = useState<RegulationTestSubmissionRecord[]>([])
  const [isSavingRegulationTest, setIsSavingRegulationTest] = useState(false)
  const [regulationTestError, setRegulationTestError] = useState<string | null>(null)
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

  const selectedEnrollee = useMemo(
    () => enrollees.find((item) => item.id === selectedEnrolleeId) || enrollees[0] || null,
    [enrollees, selectedEnrolleeId]
  )

  const selectedLoad = useMemo(
    () => {
      if ((role === 'partner' || role === 'supervisor') && partnerLoad) return partnerLoad
      return loads.find((item) => item.enrolleeId === selectedEnrollee?.id) || loads[0] || null
    },
    [loads, partnerLoad, role, selectedEnrollee]
  )

  const selectedLoadBreakdown = useMemo(
    () => {
      if ((role === 'partner' || role === 'supervisor') && partnerLoadBreakdown) return partnerLoadBreakdown
      return loadBreakdownsByEnrolleeId[selectedEnrollee?.id || ''] || Object.values(loadBreakdownsByEnrolleeId)[0] || null
    },
    [loadBreakdownsByEnrolleeId, partnerLoadBreakdown, role, selectedEnrollee]
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
    () => roleConfigs.find((item) => item.role === role) || roleConfigs[0] || { role, topMenus: [], actionMenus: [] },
    [role, roleConfigs]
  )

  useEffect(() => {
    const firstMenu = selectedRoleConfig.topMenus?.[0]
    if (!firstMenu) return
    if (!selectedRoleConfig.topMenus.includes(activeMenu)) {
      setActiveMenu(firstMenu)
    }
  }, [activeMenu, selectedRoleConfig])

  useEffect(() => {
    if (!enrollees[0]?.id) return
    if (!selectedEnrolleeId || !enrollees.some((enrollee) => enrollee.id === selectedEnrolleeId)) {
      setSelectedEnrolleeId(enrollees[0].id)
    }
  }, [enrollees, selectedEnrolleeId])

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

  const partnerServiceCapacityDefaultHeader = useMemo<PartnerServiceCapacityHeader>(() => {
    const splitName = splitFullName(accountSettings.fullName)
    return {
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      email: accountSettings.email || '',
      organizationName: accountSettings.organization || '',
      jobTitle: '',
      respondentRoles: role === 'administrator' ? ['administrator'] : ['direct_service_provider'],
      otherRoleText: ''
    }
  }, [accountSettings.email, accountSettings.fullName, accountSettings.organization, role])
  const currentNavigatorName = useMemo(
    () => accountSettings.fullName.trim() || selectedEnrollee?.assignedNavigator || 'atlas navigator',
    [accountSettings.fullName, selectedEnrollee?.assignedNavigator]
  )

  const supervisorNavigatorCompetency = useMemo<SupervisorNavigatorCompetencySummary[]>(() => {
    const navigatorNames = Array.from(new Set(enrollees.map((enrollee) => enrollee.assignedNavigator).filter(Boolean)))
    const byNavigator = navigatorNames.map((navigatorName) => {
      const records = navigatorCompetencyAssessments
        .filter((assessment) => assessment.navigatorName === navigatorName)
        .sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime())
      const recent = records.slice(0, 3)
      const weightMap = [3, 2, 1]
      const weighted = recent.map((record, index) => {
        const avg = record.answers.length
          ? record.answers.reduce((sum, answer) => sum + answer.score, 0) / record.answers.length
          : 0
        return { avg, weight: weightMap[index] || 1 }
      })
      const weightedScore = weighted.reduce((sum, item) => sum + item.avg * item.weight, 0)
      const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0)
      return {
        navigatorName,
        assessmentCount: records.length,
        weightedRollingAverage: weightTotal ? Number((weightedScore / weightTotal).toFixed(2)) : 0,
        lastAssessmentAtIso: records[0]?.submittedAtIso || null
      } satisfies SupervisorNavigatorCompetencySummary
    })
    return byNavigator
  }, [enrollees, navigatorCompetencyAssessments])
  const mergedNavigatorProgramState = useMemo(
    () => mergeNavigatorProgramState(navigatorProgramState, currentNavigatorName, enrollmentRequests),
    [currentNavigatorName, enrollmentRequests, navigatorProgramState]
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
  const navigatorAggregateLoad = useMemo(() => deriveNavigatorLoad(loads), [loads])
  const navigatorAggregateLoadBreakdown = useMemo(
    () => deriveNavigatorLoadBreakdown(loadBreakdownsByEnrolleeId, currentNavigatorName),
    [currentNavigatorName, loadBreakdownsByEnrolleeId]
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
  } = usePartnerServiceCapacityHistory(role, accountSettings.organization)

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
    if (role !== 'navigator' || !selectedEnrollee?.id) {
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
  }, [role, selectedEnrollee?.id])

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
      const updatedLogs = logs.map((item) => (item.id === last.id ? { ...item, status: 'completed' } : item))
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

  async function replaceSelectedEnrolleeProfileImage(file: File) {
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
            : buildFallbackTimelineConfig(saved.enrollmentStartIso)
        }
      }))
    })
  }

  function saveRouteAssignment(candidate: RouteCandidateRecord, phase: StabilizationPhase) {
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
    setIsSavingPartnerServiceCapacitySurvey(true)
    setPartnerServiceCapacitySurveyError(null)
    try {
      const saved = await persistPartnerServiceCapacitySurvey(input)
      setPartnerServiceCapacitySurveyHistory((current) => {
        const nextHistory = current.filter((record) => record.draftKey !== saved.draftKey && record.id !== saved.id)
        return [saved, ...nextHistory].sort(
          (left, right) =>
            new Date(right.updatedAtIso || right.submittedAtIso).getTime() - new Date(left.updatedAtIso || left.submittedAtIso).getTime()
        )
      })
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

  async function reloadPartnerServiceCapacitySurveyHistory() {
    if (role !== 'partner') return
    const organizationName = accountSettings.organization?.trim()
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
    const nextState = {
      ...mergedNavigatorProgramState,
      intervalAssessmentRules: [
        rule,
        ...mergedNavigatorProgramState.intervalAssessmentRules.filter((item) => item.id !== rule.id)
      ]
    }
    return saveNavigatorProgramState(nextState)
  }

  async function saveNavigatorRegulationTest(input: RegulationTestSubmissionInput) {
    setIsSavingRegulationTest(true)
    setRegulationTestError(null)
    try {
      const saved = await saveRegulationTestSubmission(input)
      setRegulationTestHistory((current) => {
        const next = current.filter((record) => record.id !== saved.id && record.draftKey !== saved.draftKey)
        return [saved, ...next].sort((left, right) => new Date(right.updatedAtIso).getTime() - new Date(left.updatedAtIso).getTime())
      })
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
    setRole,
    selectedEnrolleeId,
    setSelectedEnrolleeId,
    activeMenu,
    setActiveMenu,
    isLoading,
    enrollees,
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
    currentNavigatorName,
    navigatorAggregateLoad,
    navigatorAggregateLoadBreakdown,
    pickupQueue,
    navigatorSelfAssessments,
    navigatorSelfAssessmentSummary,
    navigatorSupervisionSessions,
    navigatorAssignedCompetencySummary,
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
    accountSettings,
    partnerStationProfile,
    intakeFormsByEnrolleeId,
    selectedIntake,
    hasSavedIntake,
    isSavingAdminPortalRegistry,
    saveAccountSettings,
    saveAdminPortalRegistry,
    saveNavigatorProgramState,
    claimPickupQueueRecord,
    saveNavigatorSelfAssessment,
    saveSupervisionSession,
    saveIntervalAssessmentRule,
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
