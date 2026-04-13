import { useEffect, useMemo, useState } from 'react'
import type {
  AdminDataQualityMetric,
  AccountSettings,
  AtlasRole,
  CountyHeatPoint,
  DomainLoadBreakdown,
  DomainLoad,
  EnrolleeIntakeRecord,
  EnrollmentRequestRecord,
  EnrolleeProfile,
  JourneyStationMarker,
  PartnerIdentifierRecord,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  NavigatorCompetencyAssessmentRecord,
  SupervisorNavigatorCompetencySummary,
  RoleMenuConfig,
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
  searchPartnerIdentifierRecordMatches,
  saveAccountSettings as persistAccountSettings,
  savePartnerServiceCapacitySurvey as persistPartnerServiceCapacitySurvey,
  saveNavigatorCompetencyAssessment as persistNavigatorCompetencyAssessment,
  saveRouteAssignment as persistRouteAssignment,
  saveRouteLogs as persistRouteLogs,
  saveEnrolleeIntake as persistEnrolleeIntake
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { useJourneyStationMarkers } from '@/features/atlas2026/singlepane/hooks/useJourneyStationMarkers'
import { usePartnerServiceCapacityHistory } from '@/features/atlas2026/singlepane/hooks/usePartnerServiceCapacityHistory'
import { useRouteCandidates } from '@/features/atlas2026/singlepane/hooks/useRouteCandidates'
import { useSinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'

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
    durationMonths: 6,
    maxDurationMonths: 12,
    gates: [
      { id: 'gate-regulation-start', label: 'regulation', phase: 'regulation', monthOffset: 0 },
      { id: 'gate-readiness-start', label: 'readiness', phase: 'readiness', monthOffset: 2 },
      { id: 'gate-renewal-start', label: 'renewal', phase: 'renewal', monthOffset: 4 },
      { id: 'gate-plan-end', label: 'plan end', phase: 'renewal', monthOffset: 6 }
    ]
  }
}

export function useSinglePaneData(initialRole: AtlasRole = 'navigator') {
  const [role, setRole] = useState<AtlasRole>(initialRole)
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string>('')
  const [activeMenu, setActiveMenu] = useState<string>('route planning')
  const [isSavingPartnerServiceCapacitySurvey, setIsSavingPartnerServiceCapacitySurvey] = useState(false)
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
    () => (selectedEnrollee ? timelineConfigsByEnrolleeId[selectedEnrollee.id] || timelineConfig : timelineConfig),
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
    if (!selectedEnrolleeId && enrollees[0]?.id) {
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
    // #region agent log
    fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-2',hypothesisId:'H7',location:'useSinglePaneData.ts:230',message:'single pane survey state inputs',data:{role,accountOrganization:accountSettings.organization?.trim()??'',historyCount:partnerServiceCapacitySurveyHistory.length,historyError:partnerServiceCapacitySurveyError??null,defaultHeaderOrganization:partnerServiceCapacityDefaultHeader.organizationName},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [accountSettings.organization, partnerServiceCapacityDefaultHeader.organizationName, partnerServiceCapacitySurveyError, partnerServiceCapacitySurveyHistory.length, role])

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
      return nextLogs
    })
  }

  function deleteRouteLog(logId: string) {
    setLogs((current) => {
      const nextLogs = current.filter((log) => log.id !== logId)
      persistRouteLogs(nextLogs)
      return nextLogs
    })
  }

  function updateTimelineStartDate(nextStartIso: string) {
    if (!selectedIntake) return
    saveEnrolleeIntake({
      ...selectedIntake,
      enrollmentStartIso: nextStartIso
    })
  }

  function saveAccountSettings(nextSettings: AccountSettings) {
    const enabledRoles = nextSettings.enabledRoles.length ? nextSettings.enabledRoles : [role]
    const finalSettings = { ...nextSettings, enabledRoles }
    persistAccountSettings(finalSettings).then((saved) => {
      setBootstrapState((current) => ({
        ...current,
        accountSettings: saved
      }))
      if (!saved.enabledRoles.includes(role)) {
        setRole(saved.enabledRoles[0] || 'navigator')
      }
    })
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
      setJourneyStationMarkers((current) => {
        const withoutSelected = current.filter((marker) => marker.markerType !== 'selected')
        return [
          ...withoutSelected,
          {
            id: `route-assignment-${saved.enrolleeId}`,
            stationName: saved.stationName,
            assignedAtIso: saved.assignedAtIso,
            phase: saved.phase,
            markerType: 'selected'
          }
        ]
      })
    })
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

  async function searchPartnerIdentifierMatches(firstName: string, lastName: string): Promise<PartnerIdentifierRecord[]> {
    return searchPartnerIdentifierRecordMatches(firstName, lastName)
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
    partnerServiceCapacitySurveyHistory,
    partnerServiceCapacityDefaultHeader,
    isSavingPartnerServiceCapacitySurvey,
    partnerServiceCapacitySurveyError,
    searchPartnerIdentifierMatches,
    supervisorNavigatorCompetency,
    navigatorCompetencyAssessments,
    selectedRouteAssignment,
    appendRouteLog,
    deleteRouteLog,
    updateRouteLogTimelinePosition,
    updateRouteLogDate,
    updateTimelineStartDate,
    accountSettings,
    selectedIntake,
    hasSavedIntake,
    saveAccountSettings,
    saveEnrolleeIntake,
    saveRouteAssignment,
    savePartnerServiceCapacitySurvey,
    deletePartnerServiceCapacityDraft,
    saveNavigatorCompetencyAssessment
  }
}
