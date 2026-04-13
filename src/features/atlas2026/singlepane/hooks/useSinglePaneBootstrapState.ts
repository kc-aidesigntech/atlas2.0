import { useEffect, useState } from 'react'
import type {
  AccountSettings,
  AdminDataQualityMetric,
  AtlasRole,
  CountyHeatPoint,
  DomainLoad,
  DomainLoadBreakdown,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  EnrollmentRequestRecord,
  NavigatorCompetencyAssessmentRecord,
  RoleMenuConfig,
  RouteAssignmentRecord,
  RouteLogEvent,
  TimelineConfig,
} from '@/features/atlas2026/singlepane/types'
import {
  loadAdminDataQuality,
  loadAccountSettings,
  loadCountyHeatmap,
  loadEnrolleeIntakes,
  loadEnrollmentRequests,
  loadNavigatorCompetencyAssessments,
  loadPartnerRadialLoad,
  loadPartnerRadialLoadBreakdown,
  loadRouteAssignments,
  loadSinglePaneBootstrap
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'

export interface SinglePaneBootstrapState {
  isLoading: boolean
  enrollees: EnrolleeProfile[]
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  roleConfigs: RoleMenuConfig[]
  timelineConfig: TimelineConfig | null
  timelineConfigsByEnrolleeId: Record<string, TimelineConfig>
  logs: RouteLogEvent[]
  enrollmentRequests: EnrollmentRequestRecord[]
  countyHeatmap: CountyHeatPoint[]
  adminMetrics: AdminDataQualityMetric[]
  partnerLoad: DomainLoad | null
  partnerLoadBreakdown: DomainLoadBreakdown | null
  accountSettings: AccountSettings
  intakeFormsByEnrolleeId: Record<string, EnrolleeIntakeRecord>
  routeAssignmentsByEnrolleeId: Record<string, RouteAssignmentRecord>
  navigatorCompetencyAssessments: NavigatorCompetencyAssessmentRecord[]
  selectedEnrolleeId: string
}

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  fullName: 'atlas operator',
  email: 'operator@atlas.local',
  organization: 'atlas operations',
  enabledRoles: ['administrator', 'supervisor', 'partner', 'navigator']
}

export function useSinglePaneBootstrapState(role: AtlasRole) {
  const [state, setState] = useState<SinglePaneBootstrapState>({
    isLoading: true,
    enrollees: [],
    loads: [],
    loadBreakdownsByEnrolleeId: {},
    roleConfigs: [],
    timelineConfig: null,
    timelineConfigsByEnrolleeId: {},
    logs: [],
    enrollmentRequests: [],
    countyHeatmap: [],
    adminMetrics: [],
    partnerLoad: null,
    partnerLoadBreakdown: null,
    accountSettings: DEFAULT_ACCOUNT_SETTINGS,
    intakeFormsByEnrolleeId: {},
    routeAssignmentsByEnrolleeId: {},
    navigatorCompetencyAssessments: [],
    selectedEnrolleeId: ''
  })

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      if (isMounted) {
        setState((current) => ({ ...current, isLoading: true }))
      }

      const data = await loadSinglePaneBootstrap(role)
      const [
        requests,
        heatmap,
        quality,
        partnerViewLoad,
        partnerViewLoadBreakdown,
        nextAccountSettings,
        savedIntakes,
        savedRouteAssignments,
        savedNavigatorAssessments
      ] = await Promise.all([
        loadEnrollmentRequests(role),
        loadCountyHeatmap(),
        loadAdminDataQuality(),
        loadPartnerRadialLoad(),
        loadPartnerRadialLoadBreakdown(),
        loadAccountSettings(),
        loadEnrolleeIntakes(),
        loadRouteAssignments(),
        loadNavigatorCompetencyAssessments()
      ])

      if (!isMounted) return

      setState((current) => ({
        ...current,
        isLoading: false,
        enrollees: data.enrollees || [],
        loads: data.loads || [],
        loadBreakdownsByEnrolleeId: data.loadBreakdownsByEnrolleeId || {},
        roleConfigs: data.roleConfigs || [],
        timelineConfig: data.timelineConfig,
        timelineConfigsByEnrolleeId: data.timelineConfigsByEnrolleeId || {},
        logs: data.logs || [],
        enrollmentRequests: requests,
        countyHeatmap: heatmap,
        adminMetrics: quality,
        partnerLoad: partnerViewLoad,
        partnerLoadBreakdown: partnerViewLoadBreakdown,
        accountSettings: nextAccountSettings,
        intakeFormsByEnrolleeId: savedIntakes,
        routeAssignmentsByEnrolleeId: savedRouteAssignments,
        navigatorCompetencyAssessments: savedNavigatorAssessments,
        selectedEnrolleeId: current.selectedEnrolleeId || data.enrollees?.[0]?.id || ''
      }))
    }

    bootstrap()
    return () => {
      isMounted = false
    }
  }, [role])

  return {
    state,
    setState
  }
}
