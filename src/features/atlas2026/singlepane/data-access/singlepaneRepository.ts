import type {
  AdminDataQualityMetric,
  AtlasRole,
  CountyHeatPoint,
  DomainLoad,
  DomainLoadBreakdown,
  EnrollmentRequestRecord,
  JourneyStationMarker,
  RouteCandidateRecord
} from '@/features/atlas2026/singlepane/types'
import {
  applyIntakeOverrides,
  loadAccountSettings,
  loadEnrolleeIntakes,
  loadRouteAssignments,
  saveAccountSettings,
  saveEnrolleeIntake,
  saveRouteAssignment
} from '@/features/atlas2026/singlepane/data-access/localStateRepository'
import {
  getLocalAdminDataQuality,
  getLocalCountyHeatmap,
  getLocalEnrollmentRequests,
  getLocalPartnerRadialLoad,
  getLocalPartnerRadialLoadBreakdown,
  getLocalRouteCandidates,
  getLocalSinglePaneBootstrap,
  type SinglePaneBootstrapData
} from '@/features/atlas2026/singlepane/data-access/localCsvData'
import {
  appendRouteLog,
  loadLocalLogs,
  saveRouteLogs
} from '@/features/atlas2026/singlepane/data-access/routeLogRepository'
import {
  loadNavigatorCompetencyAssessments,
  saveNavigatorCompetencyAssessment
} from '@/features/atlas2026/singlepane/data-access/navigatorAssessmentRepository'
import {
  loadPartnerServiceCapacitySurvey,
  loadPartnerServiceCapacitySurveyHistory,
  savePartnerServiceCapacitySurvey,
  searchPartnerIdentifierRecordMatches
} from '@/features/atlas2026/singlepane/data-access/partnerServiceCapacityRepository'

export async function loadSinglePaneBootstrap(_role: AtlasRole): Promise<SinglePaneBootstrapData> {
  const bootstrap = getLocalSinglePaneBootstrap()
  const logs = loadLocalLogs()
  const intakeOverrides = await loadEnrolleeIntakes()
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
  return {
    ...bootstrap,
    enrollees,
    timelineConfigsByEnrolleeId,
    timelineConfig: timelineConfigsByEnrolleeId[firstEnrolleeId] || bootstrap.timelineConfig,
    logs
  }
}

export async function loadEnrollmentRequests(role: AtlasRole): Promise<EnrollmentRequestRecord[]> {
  return getLocalEnrollmentRequests(role)
}

export async function loadRouteCandidates(activeZCodes: string[] = []): Promise<RouteCandidateRecord[]> {
  return getLocalRouteCandidates(activeZCodes)
}

export async function loadCountyHeatmap(): Promise<CountyHeatPoint[]> {
  return getLocalCountyHeatmap()
}

export async function loadAdminDataQuality(): Promise<AdminDataQualityMetric[]> {
  return getLocalAdminDataQuality()
}

export async function loadJourneyStationMarkers(enrollmentId?: string): Promise<JourneyStationMarker[]> {
  if (!enrollmentId) return []
  const historyMarkers = loadLocalLogs()
    .filter((log) => log.enrolleeId === enrollmentId && log.phase !== 'regulation')
    .map((log, index) => ({
      id: `station-marker-${log.id}`,
      stationName: index === 0 ? 'partner station' : `partner station ${index + 1}`,
      assignedAtIso: log.timestampIso,
      phase: log.phase,
      iconSlug: log.stationIcon,
      markerType: 'history' as const
    }))
  const selectedAssignment = (await loadRouteAssignments())[enrollmentId]
  if (!selectedAssignment) return historyMarkers
  return [
    ...historyMarkers,
    {
      id: `route-assignment-${selectedAssignment.enrolleeId}`,
      stationName: selectedAssignment.stationName,
      assignedAtIso: selectedAssignment.assignedAtIso,
      phase: selectedAssignment.phase,
      markerType: 'selected'
    }
  ]
}

export async function loadPartnerRadialLoad(): Promise<DomainLoad | null> {
  return getLocalPartnerRadialLoad()
}

export async function loadPartnerRadialLoadBreakdown(): Promise<DomainLoadBreakdown | null> {
  return getLocalPartnerRadialLoadBreakdown()
}

export {
  appendRouteLog,
  loadAccountSettings,
  loadEnrolleeIntakes,
  loadNavigatorCompetencyAssessments,
  loadPartnerServiceCapacitySurvey,
  loadPartnerServiceCapacitySurveyHistory,
  loadRouteAssignments,
  saveAccountSettings,
  saveEnrolleeIntake,
  saveNavigatorCompetencyAssessment,
  savePartnerServiceCapacitySurvey,
  saveRouteAssignment,
  saveRouteLogs,
  searchPartnerIdentifierRecordMatches
}
