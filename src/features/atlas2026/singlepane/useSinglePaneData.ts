import { useEffect, useMemo, useState } from 'react'
import type {
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
  JourneyStationMarker,
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
  TimelineConfig,
  ZDomain
} from '@/features/atlas2026/singlepane/types'
import {
  appendRouteLog as appendRouteLogRecord,
  deletePartnerServiceCapacityDraftRecord,
  loadAdminDataQuality,
  loadCountyHeatmap,
  loadEnrollmentRequests,
  loadPartnerServiceCapacitySurveyHistory,
  loadPartnerStationProfile,
  searchPartnerIdentifierRecordMatches,
  ensurePartnerIdentifierRecordForSurvey,
  uploadEnrolleeProfileImage,
  saveAccountSettings as persistAccountSettings,
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
  return testType === 'mh_sca' ? 'MH-SCA' : 'SVS'
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

export function useSinglePaneData(initialRole: AtlasRole = 'navigator') {
  const [role, setRole] = useState<AtlasRole>(initialRole)
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string>('')
  const [activeMenu, setActiveMenu] = useState<string>('route planning')
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
  const routeCandidates = useRouteCandidates(selectedEnrollee)
  const { journeyStationMarkers, setJourneyStationMarkers } = useJourneyStationMarkers(selectedEnrollee, selectedLogs, routeCandidates)
  const {
    partnerServiceCapacitySurveyHistory,
    partnerServiceCapacitySurveyError,
    setPartnerServiceCapacitySurveyHistory,
    setPartnerServiceCapacitySurveyError
  } = usePartnerServiceCapacityHistory(role, accountSettings.organization)

  useEffect(() => {
    if (role !== 'navigator' || !selectedEnrollee?.id) {
      setRegulationTestHistory([])
      setRegulationTestError(null)
      return
    }
    let isMounted = true
    Promise.all([
      loadRegulationTestHistory(selectedEnrollee.id, 'mh_sca'),
      loadRegulationTestHistory(selectedEnrollee.id, 'svs')
    ])
      .then(([mhsca, svs]) => {
        if (!isMounted) return
        setRegulationTestHistory([...mhsca, ...svs])
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
        .filter((record) => record.status === 'completed' && record.passed !== null)
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
    selectedIntake,
    hasSavedIntake,
    saveAccountSettings,
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
