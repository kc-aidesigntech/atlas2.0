import { useEffect, useMemo, useState } from 'react'
import type {
  AdminDataQualityMetric,
  AccountSettings,
  AtlasRole,
  CountyHeatPoint,
  DomainLoad,
  EnrolleeIntakeRecord,
  EnrollmentRequestRecord,
  EnrolleeProfile,
  JourneyStationMarker,
  RoleMenuConfig,
  RouteCandidateRecord,
  RouteLogEvent,
  StabilizationPhase,
  TimelineConfig,
  ZDomain
} from '@/features/atlas2026/singlepane/types'
import {
  appendRouteLog as appendRouteLogRecord,
  loadAdminDataQuality,
  loadAccountSettings,
  loadCountyHeatmap,
  loadEnrolleeIntakes,
  loadEnrollmentRequests,
  loadJourneyStationMarkers,
  loadPartnerRadialLoad,
  loadRouteCandidates,
  loadSinglePaneBootstrap,
  saveAccountSettings as persistAccountSettings,
  saveEnrolleeIntake as persistEnrolleeIntake
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'

const DOMAIN_BY_ACTION: Record<string, ZDomain[]> = {
  'route planning': ['housing', 'work'],
  'log contact': ['social'],
  'append route step': ['health', 'social'],
  'escalate risk': ['legal', 'health'],
  'submit service update': ['housing'],
  'confirm milestone': ['work'],
  'request support': ['social', 'health'],
  'set policy threshold': ['legal'],
  'approve route template': ['education'],
  'audit event logs': ['legal', 'social']
}

function nextPhase(current?: StabilizationPhase): StabilizationPhase {
  if (current === 'regulation') return 'readiness'
  if (current === 'readiness') return 'renewal'
  return 'renewal'
}

export function useSinglePaneData() {
  const [role, setRole] = useState<AtlasRole>('navigator')
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState<string>('')
  const [activeMenu, setActiveMenu] = useState<string>('assigned enrollees')
  const [enrollees, setEnrollees] = useState<EnrolleeProfile[]>([])
  const [loads, setLoads] = useState<DomainLoad[]>([])
  const [roleConfigs, setRoleConfigs] = useState<RoleMenuConfig[]>([])
  const [timelineConfig, setTimelineConfig] = useState<TimelineConfig | null>(null)
  const [timelineConfigsByEnrolleeId, setTimelineConfigsByEnrolleeId] = useState<Record<string, TimelineConfig>>({})
  const [logs, setLogs] = useState<RouteLogEvent[]>([])
  const [enrollmentRequests, setEnrollmentRequests] = useState<EnrollmentRequestRecord[]>([])
  const [routeCandidates, setRouteCandidates] = useState<RouteCandidateRecord[]>([])
  const [countyHeatmap, setCountyHeatmap] = useState<CountyHeatPoint[]>([])
  const [adminMetrics, setAdminMetrics] = useState<AdminDataQualityMetric[]>([])
  const [partnerLoad, setPartnerLoad] = useState<DomainLoad | null>(null)
  const [journeyStationMarkers, setJourneyStationMarkers] = useState<JourneyStationMarker[]>([])
  const [accountSettings, setAccountSettings] = useState<AccountSettings>({
    fullName: 'atlas operator',
    email: 'operator@atlas.local',
    organization: 'atlas operations',
    enabledRoles: ['administrator', 'partner', 'navigator']
  })
  const [intakeFormsByEnrolleeId, setIntakeFormsByEnrolleeId] = useState<Record<string, EnrolleeIntakeRecord>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function bootstrap() {
      if (isMounted) {
        setIsLoading(true)
      }
      const data = await loadSinglePaneBootstrap(role)
      const [requests, heatmap, quality, partnerViewLoad, nextAccountSettings, savedIntakes] = await Promise.all([
        loadEnrollmentRequests(role),
        loadCountyHeatmap(),
        loadAdminDataQuality(),
        loadPartnerRadialLoad(),
        loadAccountSettings(),
        loadEnrolleeIntakes()
      ])

      if (!isMounted) return
      setEnrollees(data.enrollees || [])
      setLoads(data.loads || [])
      setRoleConfigs(data.roleConfigs || [])
      setTimelineConfig(data.timelineConfig)
      setTimelineConfigsByEnrolleeId(data.timelineConfigsByEnrolleeId || {})
      setLogs(data.logs || [])
      setEnrollmentRequests(requests)
      setCountyHeatmap(heatmap)
      setAdminMetrics(quality)
      setPartnerLoad(partnerViewLoad)
      setAccountSettings(nextAccountSettings)
      setIntakeFormsByEnrolleeId(savedIntakes)
      setSelectedEnrolleeId((prev) => prev || data.enrollees?.[0]?.id || '')
      setIsLoading(false)
    }
    bootstrap()
    return () => {
      isMounted = false
    }
  }, [role])

  const selectedEnrollee = useMemo(
    () => enrollees.find((item) => item.id === selectedEnrolleeId) || enrollees[0] || null,
    [enrollees, selectedEnrolleeId]
  )

  const selectedLoad = useMemo(
    () => {
      if (role === 'partner' && partnerLoad) return partnerLoad
      return loads.find((item) => item.enrolleeId === selectedEnrollee?.id) || loads[0] || null
    },
    [loads, partnerLoad, role, selectedEnrollee]
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

  const selectedLogs = useMemo(
    () =>
      logs
        .filter((item) => item.enrolleeId === selectedEnrollee?.id)
        .slice()
        .sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()),
    [logs, selectedEnrollee]
  )

  useEffect(() => {
    let isMounted = true
    async function refreshRouteCandidates() {
      const candidates = await loadRouteCandidates(selectedEnrollee?.zCodeTags || [])
      if (!isMounted) return
      setRouteCandidates(candidates)
    }
    refreshRouteCandidates()
    return () => {
      isMounted = false
    }
  }, [selectedEnrollee])

  useEffect(() => {
    let isMounted = true
    async function hydrateStationMarkers() {
      const markers = await loadJourneyStationMarkers(selectedEnrollee?.enrollmentId || selectedEnrollee?.id)
      if (!isMounted) return

      if (markers.length) {
        setJourneyStationMarkers(markers)
        return
      }

      // Fallback when route_plan_stops are not yet provisioned for this enrollment.
      const derived = selectedLogs
        .filter((log) => log.phase !== 'regulation')
        .map((log, index) => {
          const candidate = routeCandidates[index % Math.max(routeCandidates.length, 1)]
          return {
            id: `station-marker-${log.id}`,
            stationName: candidate?.stationName || 'partner station',
            assignedAtIso: log.timestampIso,
            phase: log.phase,
            iconSlug: log.stationIcon
          } as JourneyStationMarker
        })
      setJourneyStationMarkers(derived)
    }
    hydrateStationMarkers()
    return () => {
      isMounted = false
    }
  }, [routeCandidates, selectedEnrollee?.enrollmentId, selectedEnrollee?.id, selectedLogs])

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

  function saveAccountSettings(nextSettings: AccountSettings) {
    const enabledRoles = nextSettings.enabledRoles.length ? nextSettings.enabledRoles : [role]
    const finalSettings = { ...nextSettings, enabledRoles }
    persistAccountSettings(finalSettings).then((saved) => {
      setAccountSettings(saved)
      if (!saved.enabledRoles.includes(role)) {
        setRole(saved.enabledRoles[0] || 'navigator')
      }
    })
  }

  function saveEnrolleeIntake(nextIntake: EnrolleeIntakeRecord) {
    persistEnrolleeIntake(nextIntake).then((saved) => {
      setIntakeFormsByEnrolleeId((current) => ({
        ...current,
        [saved.enrolleeId]: saved
      }))
      setEnrollees((current) =>
        current.map((enrollee) =>
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
        )
      )
      setTimelineConfigsByEnrolleeId((current) => ({
        ...current,
        [saved.enrolleeId]: current[saved.enrolleeId]
          ? { ...current[saved.enrolleeId], planStartIso: saved.enrollmentStartIso }
          : {
              planStartIso: saved.enrollmentStartIso,
              durationMonths: 6,
              maxDurationMonths: 12,
              gates: [
                { id: 'gate-regulation-start', label: 'regulation', phase: 'regulation', monthOffset: 0 },
                { id: 'gate-readiness-start', label: 'readiness', phase: 'readiness', monthOffset: 2 },
                { id: 'gate-renewal-start', label: 'renewal', phase: 'renewal', monthOffset: 4 },
                { id: 'gate-plan-end', label: 'plan end', phase: 'renewal', monthOffset: 6 }
              ]
            }
      }))
    })
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
    selectedLogs,
    selectedRoleConfig,
    timelineConfig: selectedTimelineConfig,
    enrollmentRequests,
    routeCandidates,
    countyHeatmap,
    adminMetrics,
    journeyStationMarkers,
    appendRouteLog,
    accountSettings,
    selectedIntake,
    hasSavedIntake,
    saveAccountSettings,
    saveEnrolleeIntake
  }
}
