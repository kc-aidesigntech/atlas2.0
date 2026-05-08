import React from 'react'
import { useSupabaseAuth } from '../../../auth/SupabaseAuthProvider'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled } from '../../../lib/supabaseClient'
import AdminDataControlPanel from '../admin/AdminDataControlPanel'
import { AtlasCloseButton, AtlasTextButton } from '../components/AtlasPrimitives'
import AccountSettingsPanel from './components/AccountSettingsPanel'
import ContextPanels from './components/ContextPanels'
import LiveAccessMatrixPanel from './components/LiveAccessMatrixPanel'
import MobileRouteBoardPanel from './components/MobileRouteBoardPanel'
import EnrolleeBurdenSurveyPanel from './components/EnrolleeBurdenSurveyPanel'
import NavigatorMyProfilePanel from './components/NavigatorMyProfilePanel'
import NavigatorEnrollmentAssignmentsPanel from './components/NavigatorEnrollmentAssignmentsPanel'
import PartnerReferralWorkflowPanel from './components/PartnerReferralWorkflowPanel'
import PartnerSpecialtyOverlay from './components/PartnerSpecialtyOverlay'
import PartnerStationProfilePanel from './components/PartnerStationProfilePanel'
import ProfilePanel from './components/ProfilePanel'
import RadialLoadChart from './components/RadialLoadChart'
import RadialLoadTableOverlay from './components/RadialLoadTableOverlay'
import RegulationTestsOverlay from './components/RegulationTestsOverlay'
import ResolvedZCodesOverlay from './components/ResolvedZCodesOverlay'
import RoleMenus from './components/RoleMenus'
import RoutePlanningOverlay from './components/RoutePlanningOverlay'
import StripMapTimeline from './components/StripMapTimeline'
import TopNav from './components/TopNav'
import VerticalStripMapTimeline from './components/VerticalStripMapTimeline'
import { SP_COLORS } from './theme'
import type { AtlasRole, RouteCandidateRecord, StabilizationPhase } from './types'
import { useSinglePaneData } from './useSinglePaneData'

const PERSISTED_ACTION_LABELS = new Set([
  'route planning',
  'record navigator assessment'
])

interface ResolutionOverlayState {
  source: 'route-board' | 'page-zcode'
  candidate: RouteCandidateRecord | null
  filterParentCode?: string | null
  filterChildCodes?: string[]
}

export default function SinglePaneApp() {
  const {
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
    enrollees,
    selectedEnrollee,
    selectedLoad,
    selectedLoadBreakdown,
    selectedLogs,
    selectedRoleConfig,
    timelineConfig,
    enrollmentRequests,
    routeCandidates,
    countyHeatmap,
    adminMetrics,
    adminPortalRegistry,
    adminPortalRegistryError,
    accessMatrixDataset,
    accessMatrixError,
    navigatorProgramError,
    journeyStationMarkers,
    resolvedZCodeStripMarkers,
    currentNavigatorName,
    navigatorAggregateLoad,
    navigatorAggregateLoadBreakdown,
    navigatorEnrollmentAssignments,
    viewerCanViewNavigatorAssignmentNames,
    viewerCanAccessAssignmentBoard,
    viewerCanUseAssignmentActions,
    viewerCanAccessAdminRegistryCards,
    navigatorEnrollmentAssignmentsError,
    isLoadingNavigatorEnrollmentAssignments,
    assigningNavigatorEnrollmentId,
    pickupQueue,
    navigatorSelfAssessments,
    navigatorSelfAssessmentSummary,
    navigatorSupervisionSessions,
    navigatorAssignedCompetencySummary,
    supervisorNavigatorDirectory,
    navigatorIntervalDueItems,
    navigatorProgramState,
    enrolleeBurdenSurveyHistoryByEnrollmentId,
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
    isSavingAccessMatrix,
    viewerCanWrite,
    isSavingEnrolleeBurdenSurvey,
    supervisorNavigatorCompetency,
    regulationTestHistory,
    regulationTestStripMarkers,
    isRegulationCleared,
    shouldHideReadinessProgress,
    isSavingRegulationTest,
    regulationTestError,
    isUploadingProfileImage,
    profileImageUploadError,
    isUploadingAccountProfileImage,
    accountProfileImageUploadError,
    enrolleeBurdenSurveyError,
    saveAccountSettings,
    saveAdminPortalRegistry,
    saveAccessMatrixPersonRoles,
    saveAccessMatrixEnrollmentNavigators,
    saveAccessMatrixSupervisorAssignments,
    saveAccessMatrixPartnerPrimaryContacts,
    toggleSupervisorManagedNavigator,
    assignNavigatorEnrollmentToSelf,
    startTroubleshootingSession,
    stopTroubleshootingSession,
    savePartnerTroubleshootingGrant,
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
    saveEnrolleeBurdenSurvey,
    saveNavigatorCompetencyAssessment,
    saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft,
    deleteEnrolleeBurdenSurveyDraft,
    partnerStationSpecialties,
    reloadEnrolleeBurdenSurveyHistoryForEnrollment
  } = useSinglePaneData()
  const { session, signOut, refreshIdentities, linkOAuthProvider } = useSupabaseAuth()
  const showLiveAuthSecurity = hasSupabaseConfig && isSinglePaneSupabaseBootstrapEnabled && Boolean(session)
  const [linkedAuthProviders, setLinkedAuthProviders] = React.useState<string[] | null>(null)
  const [linkBusyProvider, setLinkBusyProvider] = React.useState<'google' | 'apple' | null>(null)
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = React.useState(false)
  const [isRoutePlanningOpen, setIsRoutePlanningOpen] = React.useState(false)
  const [isRegulationTestsOpen, setIsRegulationTestsOpen] = React.useState(false)
  const [assessmentInitialTestType, setAssessmentInitialTestType] = React.useState<'mh_sca' | 'svs' | 'ipf' | 'b_ipf' | null>(null)
  const [isLoadTableOpen, setIsLoadTableOpen] = React.useState(false)
  const [isReferralPortalOpen, setIsReferralPortalOpen] = React.useState(false)
  const [enrolleeSurveyTargetId, setEnrolleeSurveyTargetId] = React.useState<string | null>(null)
  const [selectedRouteCandidateId, setSelectedRouteCandidateId] = React.useState<string | null>(null)
  const [resolutionOverlayState, setResolutionOverlayState] = React.useState<ResolutionOverlayState | null>(null)
  const [selectedPartnerSpecialtyGroup, setSelectedPartnerSpecialtyGroup] = React.useState<(typeof partnerStationSpecialties)[number] | null>(null)
  const [navigatorEnrolleeView, setNavigatorEnrolleeView] = React.useState<'my' | 'add'>('my')
  const [lastContentMenu, setLastContentMenu] = React.useState('enrollees')
  const [contentOpacity, setContentOpacity] = React.useState(1)
  const transitionCycleRef = React.useRef(0)
  const transitionBootstrappedRef = React.useRef(false)
  const hashSyncBootstrappedRef = React.useRef(false)
  const previousUiRoleRef = React.useRef<AtlasRole | null>(null)
  const actionMenus = (selectedRoleConfig.actionMenus || []).filter((label) => PERSISTED_ACTION_LABELS.has(label.trim().toLowerCase()))
  const uiRole = viewerRole
  const activeEnrolleeSurveyTarget = React.useMemo(
    () => enrollees.find((item) => item.id === enrolleeSurveyTargetId) || null,
    [enrollees, enrolleeSurveyTargetId]
  )
  const activeEnrolleeSurveyHistory = React.useMemo(
    () =>
      activeEnrolleeSurveyTarget?.enrollmentId
        ? enrolleeBurdenSurveyHistoryByEnrollmentId[activeEnrolleeSurveyTarget.enrollmentId] || []
        : [],
    [activeEnrolleeSurveyTarget, enrolleeBurdenSurveyHistoryByEnrollmentId]
  )
  const standaloneSurveyUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '/service-capacity-survey'
    return new URL('service-capacity-survey', window.location.href.split('#')[0]).toString()
  }, [])

  React.useEffect(() => {
    if (activeMenu !== 'route planning' && activeMenu !== 'referral portal' && activeMenu !== 'refer') {
      setLastContentMenu(activeMenu)
    }
  }, [activeMenu])

  React.useEffect(() => {
    const previousRole = previousUiRoleRef.current
    previousUiRoleRef.current = uiRole
    if (!previousRole || previousRole === uiRole) return

    setIsReferralPortalOpen(false)

    const isReferralPortalSelection = activeMenu === 'referral portal' || activeMenu === 'refer'
    if (!isReferralPortalSelection || uiRole === 'partner') return

    const fallbackMenu =
      (lastContentMenu && lastContentMenu !== 'route planning' && lastContentMenu !== 'referral portal' && lastContentMenu !== 'refer'
        ? lastContentMenu
        : selectedRoleConfig.topMenus.find((menu) => menu !== 'referral portal' && menu !== 'refer')) ||
      selectedRoleConfig.topMenus[0] ||
      'enrollees'
    if (fallbackMenu !== activeMenu) {
      setActiveMenu(fallbackMenu)
    }
  }, [activeMenu, lastContentMenu, selectedRoleConfig.topMenus, setActiveMenu, uiRole])

  React.useEffect(() => {
    if (!isAccountSettingsOpen || !showLiveAuthSecurity) return
    let cancelled = false
    setLinkedAuthProviders(null)
    void refreshIdentities().then((identities) => {
      if (!cancelled) {
        setLinkedAuthProviders(identities.map((identity) => identity.provider))
      }
    })
    return () => {
      cancelled = true
    }
  }, [isAccountSettingsOpen, showLiveAuthSecurity, session?.user?.id, refreshIdentities])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedRoleConfig.topMenus.length) return
    const hashTarget = hashToMenu(window.location.hash, selectedRoleConfig.topMenus)
    const fallbackMenu = hashTarget || selectedRoleConfig.topMenus[0]
    if (!fallbackMenu) return
    if (fallbackMenu !== activeMenu) {
      setActiveMenu(fallbackMenu)
      return
    }
    const fallbackHash = menuToHash(fallbackMenu)
    if (!fallbackHash) return
    const currentHash = window.location.hash.replace(/^#/, '')
    if (currentHash !== fallbackHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${fallbackHash}`)
    }
    hashSyncBootstrappedRef.current = true
  }, [selectedRoleConfig.topMenus, setActiveMenu])

  const openEnrolleeBurdenSurvey = React.useCallback(
    async (enrolleeId: string) => {
      const target = enrollees.find((item) => item.id === enrolleeId) || null
      if (!target) return
      setSelectedEnrolleeId(enrolleeId)
      setEnrolleeSurveyTargetId(enrolleeId)
      if (target.enrollmentId) {
        try {
          await reloadEnrolleeBurdenSurveyHistoryForEnrollment(target.enrollmentId)
        } catch {}
      }
    },
    [enrollees, reloadEnrolleeBurdenSurveyHistoryForEnrollment, setSelectedEnrolleeId]
  )

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedRoleConfig.topMenus.length) return
    if (!selectedRoleConfig.topMenus.includes(activeMenu)) return
    const nextHash = menuToHash(activeMenu)
    if (!nextHash) return
    const currentHash = window.location.hash.replace(/^#/, '')
    if (currentHash === nextHash) return

    const nextUrl = `${window.location.pathname}${window.location.search}#${nextHash}`
    if (!hashSyncBootstrappedRef.current) {
      window.history.replaceState(null, '', nextUrl)
      hashSyncBootstrappedRef.current = true
      return
    }
    window.history.pushState(null, '', nextUrl)
  }, [activeMenu])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedRoleConfig.topMenus.length) return

    function syncMenuFromLocation() {
      const hashTarget = hashToMenu(window.location.hash, selectedRoleConfig.topMenus)
      if (hashTarget && hashTarget !== activeMenu) {
        setActiveMenu(hashTarget)
      }
    }

    window.addEventListener('hashchange', syncMenuFromLocation)
    window.addEventListener('popstate', syncMenuFromLocation)
    return () => {
      window.removeEventListener('hashchange', syncMenuFromLocation)
      window.removeEventListener('popstate', syncMenuFromLocation)
    }
  }, [activeMenu, selectedRoleConfig.topMenus, setActiveMenu])

  React.useEffect(() => {
    if (!selectedEnrolleeId) return
    if (!transitionBootstrappedRef.current) {
      transitionBootstrappedRef.current = true
      return
    }
    const cycle = transitionCycleRef.current + 1
    transitionCycleRef.current = cycle
    setContentOpacity(0)
    const targetAvatarUrl = enrollees.find((enrollee) => enrollee.id === selectedEnrolleeId)?.avatarUrl || null
    void (async () => {
      await sleep(160)
      if (cycle !== transitionCycleRef.current) return
      await preloadImageIfNeeded(targetAvatarUrl)
      if (cycle !== transitionCycleRef.current) return
      setContentOpacity(1)
    })()
  }, [enrollees, selectedEnrolleeId])

  React.useEffect(() => {
    if (!remoteSession?.isActive && uiRole === 'partner' && activeMenu === 'service capacity') {
      window.location.assign(standaloneSurveyUrl)
    }
  }, [activeMenu, remoteSession?.isActive, standaloneSurveyUrl, uiRole])

  React.useEffect(() => {
    if (activeMenu !== 'enrollees' || uiRole !== 'navigator') {
      setNavigatorEnrolleeView('my')
    }
  }, [activeMenu, uiRole])

  React.useEffect(() => {
    if (!isRoutePlanningOpen) {
      setSelectedRouteCandidateId(selectedRouteAssignment?.stationId || null)
      return
    }
    if (!routeCandidates.length) {
      setSelectedRouteCandidateId(null)
      return
    }
    setSelectedRouteCandidateId((current) =>
      current && routeCandidates.some((candidate) => candidate.stationId === current)
        ? current
        : selectedRouteAssignment?.stationId && routeCandidates.some((candidate) => candidate.stationId === selectedRouteAssignment.stationId)
          ? selectedRouteAssignment.stationId
          : routeCandidates[0].stationId
    )
  }, [isRoutePlanningOpen, routeCandidates, selectedRouteAssignment])

  React.useEffect(() => {
    if (uiRole !== 'navigator' || isRegulationCleared || !isRoutePlanningOpen) return
    setIsRoutePlanningOpen(false)
    setSelectedRouteCandidateId(null)
  }, [isRegulationCleared, isRoutePlanningOpen, uiRole])

  const activeAction = actionMenus[0] || ''
  const isPartnerRole = uiRole === 'partner'
  const isAdminSection = uiRole === 'administrator' && ['system operations', 'governance'].includes(activeMenu)
  const isServiceCapacitySection = uiRole === 'partner' && activeMenu === 'service capacity'
  const isReferralPortalMenu = activeMenu === 'referral portal' || activeMenu === 'refer'
  const canUseReferralPortal = uiRole === 'partner' || uiRole === 'navigator' || uiRole === 'supervisor'
  const isNavigatorMyProfile = uiRole === 'navigator' && activeMenu === 'my profile'
  const isNavigatorEnrolleeMenu = uiRole === 'navigator' && activeMenu === 'enrollees'
  const assignmentBoardRows = viewerCanAccessAssignmentBoard ? navigatorEnrollmentAssignments : []
  const assignmentBoardError = viewerCanAccessAssignmentBoard
    ? navigatorEnrollmentAssignmentsError
    : 'Assignment board is hidden by administrator policy.'
  const isSupervisorNavigatorManagementView =
    uiRole === 'supervisor' && (activeMenu === 'assigned navigators' || activeMenu === 'navigator assessments')
  const isReady = isPartnerRole ? true : isNavigatorMyProfile || isNavigatorEnrolleeMenu ? true : Boolean(selectedEnrollee && timelineConfig)
  const selectedRouteCandidate = routeCandidates.find((candidate) => candidate.stationId === selectedRouteCandidateId) || null
  const visibleLogs = React.useMemo(
    () => (uiRole === 'navigator' && shouldHideReadinessProgress ? selectedLogs.filter((log) => log.phase === 'regulation') : selectedLogs),
    [selectedLogs, shouldHideReadinessProgress, uiRole]
  )
  const visibleJourneyStationMarkers = React.useMemo(
    () =>
      uiRole === 'navigator' && shouldHideReadinessProgress
        ? journeyStationMarkers.filter((marker) => marker.phase === 'regulation')
        : journeyStationMarkers,
    [journeyStationMarkers, shouldHideReadinessProgress, uiRole]
  )
  const historyOnlyLogs = React.useMemo(() => visibleLogs.filter((log) => log.status === 'completed'), [visibleLogs])
  const readinessParentCodes = React.useMemo(
    () => deriveEnrolleeParentCodes(selectedEnrollee),
    [selectedEnrollee]
  )
  const completedParentCodes = selectedEnrollee?.completedParentCodes || []
  const resolutionPartnerOptions = React.useMemo(() => {
    const seen = new Set<string>()
    return routeCandidates
      .filter((candidate) => {
        const normalizedPartnerId = candidate.partnerId?.trim()
        if (!normalizedPartnerId || seen.has(normalizedPartnerId)) return false
        seen.add(normalizedPartnerId)
        return true
      })
      .map((candidate) => ({
        partnerId: candidate.partnerId,
        label: candidate.stationName
      }))
  }, [routeCandidates])
  const showRoutePlanningQuickAction = uiRole === 'navigator' ? isRegulationCleared : false
  const nextSuggestedPhase = React.useMemo(
    () => getNextSuggestedPhase(selectedLogs, isRegulationCleared),
    [isRegulationCleared, selectedLogs]
  )
  const hasEnteredRenewalStage = React.useMemo(
    () => {
      const resolvedByZCodes = Boolean(
        selectedEnrollee?.activeZCodeDetails.length &&
        selectedEnrollee.activeZCodeDetails.every((detail) => detail.isResolved)
      )
      return selectedLogs.some((log) => log.phase === 'renewal') || nextSuggestedPhase === 'renewal' || resolvedByZCodes
    },
    [nextSuggestedPhase, selectedEnrollee?.activeZCodeDetails, selectedLogs]
  )
  const highlightedStationName = isRoutePlanningOpen
    ? selectedRouteCandidate?.stationName || selectedRouteAssignment?.stationName || null
    : selectedRouteAssignment?.stationName || null
  const displayLoad = isNavigatorMyProfile ? navigatorAggregateLoad : selectedLoad
  const displayLoadBreakdown = isNavigatorMyProfile ? navigatorAggregateLoadBreakdown : selectedLoadBreakdown
  const partnerContactName = React.useMemo(() => {
    const firstName = partnerStationProfile?.primaryContactFirstName?.trim() || ''
    const lastName = partnerStationProfile?.primaryContactLastName?.trim() || ''
    const combined = `${firstName} ${lastName}`.trim()
    return combined || accountSettings.fullName || 'not configured'
  }, [accountSettings.fullName, partnerStationProfile?.primaryContactFirstName, partnerStationProfile?.primaryContactLastName])
  const partnerUnresolvedCodes = React.useMemo(
    () =>
      (selectedEnrollee?.activeZCodeDetails || [])
        .filter((detail) => !detail.isResolved)
        .map((detail) => detail.zCode)
        .slice(0, 8),
    [selectedEnrollee?.activeZCodeDetails]
  )

  function handleMenuSelect(menu: string) {
    if (!remoteSession?.isActive && uiRole === 'partner' && menu === 'service capacity') {
      window.location.assign(standaloneSurveyUrl)
      return
    }
    if (menu === 'referral portal' || menu === 'refer') {
      if (uiRole === 'partner') {
        setActiveMenu(menu)
        setIsReferralPortalOpen(false)
        return
      }
      setIsReferralPortalOpen(true)
      return
    }
    if (menu === 'route planning') {
      if (uiRole === 'navigator' && !isRegulationCleared) {
        setAssessmentInitialTestType('mh_sca')
        setIsRegulationTestsOpen(true)
        return
      }
      setActiveMenu(menu)
      setIsRoutePlanningOpen(true)
      return
    }
    setActiveMenu(menu)
  }

  function handlePrimaryAction(label: string) {
    if (!PERSISTED_ACTION_LABELS.has(label.trim().toLowerCase())) {
      return
    }
    if (label.trim().toLowerCase() === 'route planning') {
      if (uiRole === 'navigator' && !isRegulationCleared) {
        setAssessmentInitialTestType('mh_sca')
        setIsRegulationTestsOpen(true)
        return
      }
      setActiveMenu('route planning')
      setIsRoutePlanningOpen(true)
      return
    }
    if (uiRole === 'supervisor' && label.trim().toLowerCase() === 'record navigator assessment') {
      if (!selectedEnrollee || !selectedLoadBreakdown) return
      const answers = selectedLoadBreakdown.rows.slice(0, 12).map((row) => ({
        parentCode: row.zCodeGroup.toUpperCase(),
        theme: row.mappedDomain,
        score: toCompetencyScore(row.rawCount, row.specializeCount || 0)
      }))
      saveNavigatorCompetencyAssessment({
        navigatorName: selectedEnrollee.assignedNavigator,
        supervisorName: accountSettings.fullName,
        formVersion: 'v1',
        answers
      })
      return
    }
    appendRouteLog(label)
  }

  function closeRoutePlanning() {
    setIsRoutePlanningOpen(false)
    setSelectedRouteCandidateId(null)
    setResolutionOverlayState(null)
    const fallbackMenu =
      lastContentMenu && lastContentMenu !== 'route planning' ? lastContentMenu : selectedRoleConfig.topMenus?.[0] || 'enrollees'
    setActiveMenu(fallbackMenu)
  }

  function handleAssignCandidate(candidate: RouteCandidateRecord) {
    saveRouteAssignment(candidate, getNextSuggestedPhase(selectedLogs, isRegulationCleared))
    setSelectedRouteCandidateId(candidate.stationId)
  }

  function handleDoneCandidate(candidate: RouteCandidateRecord) {
    setResolutionOverlayState({
      source: 'route-board',
      candidate
    })
  }

  function openAssessmentOverlay(testType: 'mh_sca' | 'svs' | 'ipf' | 'b_ipf') {
    setAssessmentInitialTestType(testType)
    setIsRegulationTestsOpen(true)
  }

  function closeResolvedZCodesOverlay() {
    setResolutionOverlayState(null)
  }

  function openCanonicalZCodeOverlay(selection: { parentCode: string; childCodes: string[] }) {
    setResolutionOverlayState({
      source: 'page-zcode',
      candidate: null,
      filterParentCode: selection.parentCode,
      filterChildCodes: selection.childCodes
    })
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-black text-white"
      style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <TopNav
        role={uiRole}
        roleConfig={selectedRoleConfig}
        activeMenu={activeMenu}
        onMenuSelect={handleMenuSelect}
        enrollees={enrollees}
        selectedEnrolleeId={selectedEnrolleeId}
        onSelectEnrollee={setSelectedEnrolleeId}
        navigatorEnrolleeView={navigatorEnrolleeView}
        onNavigatorEnrolleeViewChange={setNavigatorEnrolleeView}
        onOpenAccountSettings={() => setIsAccountSettingsOpen((current) => !current)}
      />

      <main className="atlas-shell-edge-buffer relative py-[10px]">
        {isReferralPortalOpen && canUseReferralPortal && !isPartnerRole ? (
          <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-[2px]">
            <div className="relative max-h-[92vh] w-full max-w-[1040px] overflow-y-auto">
              <div className="mb-3 flex justify-end">
                <AtlasCloseButton
                  onClick={() => setIsReferralPortalOpen(false)}
                  style={{ ['--button-border-color' as const]: '#ffffff30', color: '#ffffff' } as React.CSSProperties}
                />
              </div>
              <PartnerReferralWorkflowPanel
                defaultReferrerName={accountSettings.fullName}
                defaultPartnerOrganizationName={
                  partnerStationProfile?.organizationName?.trim() || accountSettings.organization.trim()
                }
                recentReferrals={pickupQueue}
                onSubmit={submitPartnerReferral}
                accentColor="var(--atlas-signal-lucid-green)"
              />
            </div>
          </div>
        ) : null}
        <section
          className="relative mx-auto min-h-[calc(100vh-112px)] w-full rounded-[38px] border bg-black px-[20px] pb-[12px] pt-[14px]"
          style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
        >
          {remoteSession?.isActive ? (
            <div
              className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border px-4 py-3"
              style={{ borderColor: '#ffffff40', backgroundColor: '#0f0f0f' }}
            >
              <div>
                <small className="block text-[11px] uppercase tracking-[0.14em] text-[#cfcfcf]">troubleshooting session</small>
                <div className="text-[15px] font-medium text-white">
                  Viewing {remoteSession.targetDisplayName} as `{remoteSession.targetRole}`
                </div>
                <small className="text-[12px] text-[#b7b7b7]">
                  {remoteSession.targetRole === 'partner'
                    ? `${viewerCanWrite ? 'write enabled' : 'read only'}${remoteSession.partnerGrant?.allowedMenus.length ? `, ${remoteSession.partnerGrant.allowedMenus.length} granted menu(s)` : ''}`
                    : 'full act-as enabled'}
                </small>
              </div>
              <AtlasTextButton
                onClick={stopTroubleshootingSession}
                className="px-[19px] py-[10px] text-[14px] font-medium text-white"
                style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
              >
                exit troubleshooting
              </AtlasTextButton>
            </div>
          ) : null}
          <AccountSettingsPanel
            isOpen={isAccountSettingsOpen}
            role={role}
            settings={accountSettings}
            onClose={() => setIsAccountSettingsOpen(false)}
            onRoleChange={setRole}
            onSave={saveAccountSettings}
            partnerTroubleshootingGrant={
              role === 'partner' && partnerStationProfile?.partnerId
                ? partnerTroubleshootingGrants[partnerStationProfile.partnerId] || {
                    partnerId: partnerStationProfile.partnerId,
                    organizationName: partnerStationProfile.organizationName,
                    allowedMenus: [],
                    allowWrite: false,
                    updatedAtIso: new Date().toISOString()
                  }
                : null
            }
            onSavePartnerTroubleshootingGrant={
              role === 'partner' && partnerStationProfile?.partnerId ? savePartnerTroubleshootingGrant : undefined
            }
            security={
              showLiveAuthSecurity
                ? {
                    sessionEmail: session?.user.email ?? null,
                    linkedProviders: linkedAuthProviders,
                    linkBusyProvider,
                    onLinkProvider: async (provider) => {
                      setLinkBusyProvider(provider)
                      const { error } = await linkOAuthProvider(provider)
                      setLinkBusyProvider(null)
                      if (error && typeof window !== 'undefined') {
                        window.alert(error.message)
                      }
                    },
                    onSignOut: () => {
                      void (async () => {
                        await signOut()
                        if (typeof window !== 'undefined') {
                          window.location.assign('/')
                        }
                      })()
                    }
                  }
                : null
            }
          />
          {!isPartnerRole ? (
            <RoutePlanningOverlay
              isOpen={isRoutePlanningOpen}
              enrollee={selectedEnrollee}
              routeCandidates={routeCandidates}
              headerParentCodes={readinessParentCodes}
              completedParentCodes={completedParentCodes}
              selectedCandidateId={selectedRouteCandidateId}
              onSelectCandidate={setSelectedRouteCandidateId}
              assignedCandidateId={selectedRouteAssignment?.stationId || null}
              onAssignCandidate={handleAssignCandidate}
              onDoneCandidate={handleDoneCandidate}
              onSelectZCode={openCanonicalZCodeOverlay}
              enrollmentStartLabel={hasSavedIntake && selectedIntake ? formatDateLabel(selectedIntake.enrollmentStartIso) : 'not recorded'}
              hasRecordedIntake={hasSavedIntake}
              suggestedPhase={nextSuggestedPhase}
              onClose={closeRoutePlanning}
            />
          ) : null}
          <ResolvedZCodesOverlay
            key={
              resolutionOverlayState
                ? `${resolutionOverlayState.source}:${resolutionOverlayState.candidate?.stationId || 'none'}:${resolutionOverlayState.filterParentCode || 'all'}`
                : 'closed'
            }
            isOpen={Boolean(resolutionOverlayState)}
            enrollee={selectedEnrollee}
            candidate={resolutionOverlayState?.candidate || null}
            partnerOptions={resolutionPartnerOptions}
            launchSource={resolutionOverlayState?.source || 'page-zcode'}
            filterParentCode={resolutionOverlayState?.filterParentCode || null}
            filterChildCodes={resolutionOverlayState?.filterChildCodes || []}
            onToggleResolution={setEnrolleeZCodeResolution}
            onClose={closeResolvedZCodesOverlay}
          />
          <RadialLoadTableOverlay
            isOpen={isLoadTableOpen}
            load={displayLoad}
            breakdown={displayLoadBreakdown}
            onClose={() => setIsLoadTableOpen(false)}
          />
          <PartnerSpecialtyOverlay
            specialtyGroup={selectedPartnerSpecialtyGroup}
            specialtyGroups={partnerStationSpecialties}
            onSelectSpecialty={setSelectedPartnerSpecialtyGroup}
            onClose={() => setSelectedPartnerSpecialtyGroup(null)}
          />
          <RegulationTestsOverlay
            isOpen={isRegulationTestsOpen}
            enrollee={selectedEnrollee}
            isSaving={isSavingRegulationTest}
            saveError={regulationTestError}
            history={regulationTestHistory}
            initialTestType={assessmentInitialTestType}
            onClose={() => {
              setIsRegulationTestsOpen(false)
              setAssessmentInitialTestType(null)
            }}
            onSave={saveNavigatorRegulationTest}
            onDeleteDraft={deleteNavigatorRegulationTestDraft}
          />
          {activeEnrolleeSurveyTarget ? (
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
              <div className="atlas-surface-panel max-h-[92vh] w-full max-w-[1180px] overflow-y-auto bg-[color:var(--surface-panel)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.45)] md:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <small className="atlas-overline block text-[#9fb0c1]">intervallic assessments</small>
                    <div className="atlas-h4 mt-1 text-[24px] font-medium text-white">enrollee burden survey</div>
                  </div>
                  <AtlasCloseButton
                    onClick={() => setEnrolleeSurveyTargetId(null)}
                    style={{ ['--button-border-color' as const]: '#ffffff30', color: '#ffffff' } as React.CSSProperties}
                  />
                </div>
                <EnrolleeBurdenSurveyPanel
                  enrollee={activeEnrolleeSurveyTarget}
                  respondentName={accountSettings.fullName || currentNavigatorName}
                  respondentRole={viewerRole === 'supervisor' ? 'supervisor' : 'navigator'}
                  organizationName={accountSettings.organization}
                  canEdit={viewerRole === 'navigator' && viewerCanWrite}
                  submissionHistory={activeEnrolleeSurveyHistory}
                  isSaving={isSavingEnrolleeBurdenSurvey}
                  saveError={enrolleeBurdenSurveyError}
                  onSubmit={saveEnrolleeBurdenSurvey}
                  onDeleteDraft={deleteEnrolleeBurdenSurveyDraft}
                />
              </div>
            </div>
          ) : null}
          <div className="flex min-h-full flex-col gap-[10px] transition-opacity duration-300 ease-in-out" style={{ opacity: contentOpacity }}>
            {isLoading || !isReady ? (
              <LoadingShell />
            ) : (
              <>
                {isPartnerRole ? (
                  <div
                    className="flex min-h-[282px] flex-wrap items-start gap-x-4 gap-y-5 border-b pb-[12px]"
                    style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
                  >
                    <PartnerStationProfilePanel
                      accountSettings={accountSettings}
                      partnerStationProfile={partnerStationProfile}
                      partnerContactName={partnerContactName}
                      partnerUnresolvedCodes={partnerUnresolvedCodes}
                      specialtyGroups={partnerStationSpecialties}
                      onSelectSpecialty={setSelectedPartnerSpecialtyGroup}
                      isUploadingAvatar={isUploadingAccountProfileImage}
                      avatarUploadError={accountProfileImageUploadError}
                      onReplaceAvatar={remoteSession ? undefined : replaceAccountProfileImage}
                    />
                    <div className="flex w-full justify-center md:ml-auto md:w-auto md:flex-none md:justify-end md:pr-2">
                      <RadialLoadChart load={displayLoad} onClick={() => setIsLoadTableOpen(true)} />
                    </div>
                  </div>
                ) : isNavigatorMyProfile ? (
                  <NavigatorMyProfilePanel
                    accountSettings={accountSettings}
                    currentNavigatorName={currentNavigatorName}
                    aggregateLoad={navigatorAggregateLoad}
                    assignedEnrolleeCount={enrollees.length}
                    assignedEnrollees={enrollees}
                    navigatorEnrollmentAssignments={assignmentBoardRows}
                    navigatorEnrollmentAssignmentsError={assignmentBoardError}
                    isLoadingNavigatorEnrollmentAssignments={viewerCanAccessAssignmentBoard && isLoadingNavigatorEnrollmentAssignments}
                    assigningEnrollmentId={assigningNavigatorEnrollmentId}
                    canViewNavigatorAssignmentNames={viewerCanViewNavigatorAssignmentNames}
                    canToggleAssignmentActions={viewerCanUseAssignmentActions}
                    competencySummary={navigatorAssignedCompetencySummary}
                    selfAssessmentSummary={navigatorSelfAssessmentSummary}
                    selfAssessments={navigatorSelfAssessments}
                    supervisionSessions={navigatorSupervisionSessions}
                    dueItems={navigatorIntervalDueItems}
                    programError={navigatorProgramError}
                    onOpenLoadTable={() => setIsLoadTableOpen(true)}
                    isUploadingAvatar={isUploadingAccountProfileImage}
                    avatarUploadError={accountProfileImageUploadError}
                    onReplaceAvatar={replaceAccountProfileImage}
                    onOpenEnrolleeSurvey={(enrolleeId) => void openEnrolleeBurdenSurvey(enrolleeId)}
                    onToggleEnrollmentAssignment={assignNavigatorEnrollmentToSelf}
                    onSaveSelfAssessment={saveNavigatorSelfAssessment}
                    onSaveSupervisionSession={saveSupervisionSession}
                  />
                ) : isSupervisorNavigatorManagementView ? (
                  <div
                    className="flex min-h-[282px] flex-wrap items-start gap-x-4 gap-y-5 border-b pb-[12px]"
                    style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
                  >
                    <div className="w-full">
                      <ContextPanels
                        role={uiRole}
                        activeMenu={activeMenu}
                        enrollmentRequests={enrollmentRequests}
                        countyHeatmap={countyHeatmap}
                        supervisorNavigatorCompetency={supervisorNavigatorCompetency}
                        supervisorNavigatorDirectory={supervisorNavigatorDirectory}
                        onToggleSupervisorManagedNavigator={toggleSupervisorManagedNavigator}
                        isSavingAccessMatrix={isSavingAccessMatrix}
                      />
                    </div>
                  </div>
                ) : isNavigatorEnrolleeMenu && navigatorEnrolleeView === 'add' ? (
                  <div
                    className="flex min-h-[282px] flex-wrap items-start gap-x-4 gap-y-5 border-b pb-[12px]"
                    style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
                  >
                    <div className="w-full">
                      <NavigatorEnrollmentAssignmentsPanel
                        rows={assignmentBoardRows}
                        isLoading={viewerCanAccessAssignmentBoard && isLoadingNavigatorEnrollmentAssignments}
                        error={assignmentBoardError}
                        assigningEnrollmentId={assigningNavigatorEnrollmentId}
                        canViewNavigatorAssignmentNames={viewerCanViewNavigatorAssignmentNames}
                        canToggleAssignments={viewerCanUseAssignmentActions}
                        onToggleAssignment={assignNavigatorEnrollmentToSelf}
                      />
                    </div>
                  </div>
                ) : isNavigatorEnrolleeMenu && !selectedEnrollee ? (
                  <div
                    className="flex min-h-[282px] flex-wrap items-start gap-x-4 gap-y-5 border-b pb-[12px]"
                    style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
                  >
                    <div className="atlas-surface-panel w-full px-5 py-5 text-white">
                      <small className="atlas-overline block text-[#bcbcbc]">my enrollees</small>
                      <div className="atlas-h4 mt-2 text-[18px] font-medium">No enrollees are currently assigned to you.</div>
                      <small className="atlas-caption mt-2 block text-[#bcbcbc]">
                        Use the dropdown next to "enrollees" and switch to "add enrollees" to claim one.
                      </small>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex min-h-[282px] flex-wrap items-start gap-x-4 gap-y-5 border-b pb-[12px]"
                    style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
                  >
                    <div className="min-w-0 flex-1 basis-[520px]">
                      <ProfilePanel
                        enrollee={selectedEnrollee}
                        isUploadingAvatar={isUploadingProfileImage}
                        avatarUploadError={profileImageUploadError}
                        onReplaceAvatar={replaceSelectedEnrolleeProfileImage}
                        onSelectZCode={openCanonicalZCodeOverlay}
                        enrollmentStartLabel={hasSavedIntake && selectedIntake ? formatDateLabel(selectedIntake.enrollmentStartIso) : 'not recorded'}
                        onOpenBurdenSurvey={
                          viewerRole === 'navigator' || viewerRole === 'supervisor'
                            ? () => void openEnrolleeBurdenSurvey(selectedEnrollee.id)
                            : undefined
                        }
                        burdenSurveyLabel={viewerRole === 'supervisor' ? 'review burden survey' : 'open burden survey'}
                      />
                    </div>
                    <div className="flex w-full justify-center md:ml-auto md:w-auto md:flex-none md:justify-end md:pr-2">
                      <RadialLoadChart load={selectedLoad} onClick={() => setIsLoadTableOpen(true)} />
                    </div>
                  </div>
                )}

                {uiRole !== 'navigator' && !showRoutePlanningQuickAction && actionMenus.length > 0 ? (
                  <div className="flex items-center justify-center py-1">
                    <RoleMenus labels={actionMenus} activeLabel={activeAction} onAction={handlePrimaryAction} />
                  </div>
                ) : null}
                {canUseReferralPortal && !isReferralPortalMenu ? (
                  <div className="flex items-center justify-center py-1">
                    <AtlasTextButton
                      onClick={() => {
                        if (uiRole === 'partner') {
                          setActiveMenu('referral portal')
                          setIsReferralPortalOpen(false)
                          return
                        }
                        setIsReferralPortalOpen(true)
                      }}
                      className="px-[19px] py-[6px] text-[14px] text-white"
                      style={{ ['--button-border-color' as const]: '#ffffff', color: '#111111' } as React.CSSProperties}
                      title="Open referral portal."
                    >
                      refer
                    </AtlasTextButton>
                  </div>
                ) : null}

                {isAdminSection ? (
                  <div className="flex min-h-[220px] flex-1 items-start pt-1">
                    {viewerCanAccessAdminRegistryCards ? (
                      <div className="w-full space-y-4">
                        <LiveAccessMatrixPanel
                          dataset={accessMatrixDataset}
                          error={accessMatrixError}
                          isSaving={isSavingAccessMatrix}
                          onSavePersonRoles={saveAccessMatrixPersonRoles}
                          onSaveEnrollmentNavigator={saveAccessMatrixEnrollmentNavigators}
                          onSaveSupervisorAssignment={saveAccessMatrixSupervisorAssignments}
                          onSavePartnerPrimaryContact={saveAccessMatrixPartnerPrimaryContacts}
                          remoteSession={remoteSession}
                          partnerTroubleshootingGrants={partnerTroubleshootingGrants}
                          onStartTroubleshooting={startTroubleshootingSession}
                          onStopTroubleshooting={stopTroubleshootingSession}
                        />
                        <AdminDataControlPanel
                          metrics={adminMetrics}
                          enrollees={enrollees}
                          intakeFormsByEnrolleeId={intakeFormsByEnrolleeId}
                          selectedEnrollee={selectedEnrollee}
                          accountSettings={accountSettings}
                          enrollmentRequests={enrollmentRequests}
                          supervisorNavigatorCompetency={supervisorNavigatorCompetency}
                          navigatorProgramState={navigatorProgramState}
                          navigatorIntervalDueItems={navigatorIntervalDueItems}
                          accessMatrixDataset={accessMatrixDataset}
                          registry={adminPortalRegistry}
                          isSavingRegistry={isSavingAdminPortalRegistry}
                          registryError={adminPortalRegistryError}
                          onSaveRegistry={saveAdminPortalRegistry}
                          onSaveEnrollmentNavigators={saveAccessMatrixEnrollmentNavigators}
                          onSaveIntervalAssessmentRule={saveIntervalAssessmentRule}
                          onSaveIntake={saveEnrolleeIntake}
                        />
                      </div>
                    ) : (
                      <div className="atlas-surface-panel w-full px-5 py-5 text-white">
                        <small className="atlas-overline block text-[#bcbcbc]">administrator controls</small>
                        <div className="atlas-h4 mt-2 text-[18px] font-medium">Admin registry tools are blocked by policy.</div>
                      </div>
                    )}
                  </div>
                ) : isServiceCapacitySection ? (
                  remoteSession?.isActive ? (
                    <div className="rounded-[24px] border px-5 py-5 text-white" style={{ borderColor: '#ffffff30' }}>
                      <small className="block text-[12px] uppercase tracking-[0.14em] text-[#bcbcbc]">service capacity</small>
                      <div className="mt-2 text-[18px] font-medium">Partner service-capacity troubleshooting view</div>
                      <small className="mt-2 block text-[12px] text-[#bcbcbc]">
                        The standalone survey flow stays outside the single-pane shell, so remote-view keeps this section
                        in-place rather than navigating away from the active troubleshooting session.
                      </small>
                    </div>
                  ) : null
                ) : isPartnerRole && isReferralPortalMenu ? (
                  <div className="rounded-[24px] border px-4 py-4" style={{ borderColor: '#ffffff30' }}>
                    <PartnerReferralWorkflowPanel
                      defaultReferrerName={accountSettings.fullName}
                      defaultPartnerOrganizationName={
                        partnerStationProfile?.organizationName?.trim() || accountSettings.organization.trim()
                      }
                      recentReferrals={pickupQueue}
                      onSubmit={submitPartnerReferral}
                      accentColor="var(--atlas-signal-lucid-green)"
                    />
                  </div>
                ) : isNavigatorMyProfile || isSupervisorNavigatorManagementView || (isNavigatorEnrolleeMenu && navigatorEnrolleeView === 'add') ? null : isPartnerRole ? (
                  <>
                    {timelineConfig ? (
                      <>
                        <div className="hidden min-h-[220px] flex-1 items-start md:flex">
                          <StripMapTimeline
                            events={historyOnlyLogs}
                            timelineConfig={timelineConfig}
                            completedParentCodes={completedParentCodes}
                            resolvedZCodeMarkers={resolvedZCodeStripMarkers}
                            stationMarkers={visibleJourneyStationMarkers}
                            highlightedStationName={highlightedStationName}
                            onEventDelete={deleteRouteLog}
                            onEventPositionChange={updateRouteLogTimelinePosition}
                            onEventDateChange={updateRouteLogDate}
                            onStartDateChange={updateTimelineStartDate}
                          />
                        </div>
                        <div className="flex min-h-[220px] flex-1 items-start md:hidden">
                          <VerticalStripMapTimeline
                            events={historyOnlyLogs}
                            timelineConfig={timelineConfig}
                            completedParentCodes={completedParentCodes}
                            resolvedZCodeMarkers={resolvedZCodeStripMarkers}
                            stationMarkers={visibleJourneyStationMarkers}
                            highlightedStationName={highlightedStationName}
                            onEventDelete={deleteRouteLog}
                            onEventDateChange={updateRouteLogDate}
                            onStartDateChange={updateTimelineStartDate}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="mt-3 rounded-[18px] border px-4 py-3 text-[13px]" style={{ borderColor: '#ffffff28', color: SP_COLORS.muted }}>
                        Timeline configuration is not available yet.
                      </div>
                    )}
                    <ContextPanels
                      role={uiRole}
                      activeMenu={activeMenu}
                      enrollmentRequests={enrollmentRequests}
                      countyHeatmap={countyHeatmap}
                      supervisorNavigatorCompetency={supervisorNavigatorCompetency}
                          supervisorNavigatorDirectory={supervisorNavigatorDirectory}
                          onToggleSupervisorManagedNavigator={toggleSupervisorManagedNavigator}
                          isSavingAccessMatrix={isSavingAccessMatrix}
                    />
                  </>
                ) : (
                  <>
                    <div className="hidden min-h-[220px] flex-1 items-start md:flex">
                      <StripMapTimeline
                        events={historyOnlyLogs}
                        timelineConfig={timelineConfig}
                        completedParentCodes={completedParentCodes}
                        resolvedZCodeMarkers={resolvedZCodeStripMarkers}
                        stationMarkers={visibleJourneyStationMarkers}
                        highlightedStationName={highlightedStationName}
                        showRoutePlanningQuickAction={showRoutePlanningQuickAction}
                        onRoutePlanningClick={() => {
                          setActiveMenu('route planning')
                          setIsRoutePlanningOpen(true)
                        }}
                        onRegulationTestsClick={() => openAssessmentOverlay('mh_sca')}
                        onRenewalTestsClick={hasEnteredRenewalStage ? () => openAssessmentOverlay('ipf') : undefined}
                        onEventDelete={deleteRouteLog}
                        onEventPositionChange={updateRouteLogTimelinePosition}
                        onEventDateChange={updateRouteLogDate}
                        onStartDateChange={updateTimelineStartDate}
                        onExtendPhaseDuration={updateTimelinePhaseDuration}
                        onTimelineConfigChange={updateTimelineConfig}
                      />
                    </div>
                    <div className="flex min-h-[220px] flex-1 items-start md:hidden">
                      <MobileRouteBoardPanel
                        timelineConfig={timelineConfig}
                        routeCandidates={isRegulationCleared ? routeCandidates : []}
                        activeZCodeCount={selectedEnrollee?.activeZCodeDetails.length || selectedEnrollee?.zCodeTags.length || 0}
                        headerParentCodes={readinessParentCodes}
                        completedParentCodes={completedParentCodes}
                        selectedCandidateId={selectedRouteCandidateId}
                        assignedCandidateId={selectedRouteAssignment?.stationId || null}
                        highlightedStationName={isRegulationCleared ? highlightedStationName : null}
                        onSelectCandidate={setSelectedRouteCandidateId}
                        onAssignCandidate={handleAssignCandidate}
                        onDoneCandidate={handleDoneCandidate}
                        onSelectZCode={openCanonicalZCodeOverlay}
                        showRoutePlanningQuickAction={showRoutePlanningQuickAction}
                        isRegulationCleared={isRegulationCleared}
                        regulationTestMarkers={regulationTestStripMarkers}
                        onRoutePlanningClick={() => {
                          if (!isRegulationCleared) {
                            openAssessmentOverlay('mh_sca')
                            return
                          }
                          setActiveMenu('route planning')
                          setIsRoutePlanningOpen(true)
                        }}
                        onRegulationTestsClick={() => openAssessmentOverlay('mh_sca')}
                        onRenewalTestsClick={hasEnteredRenewalStage ? () => openAssessmentOverlay('ipf') : undefined}
                        onStartDateChange={updateTimelineStartDate}
                        onTimelineConfigChange={updateTimelineConfig}
                        suggestedPhase={nextSuggestedPhase}
                      />
                    </div>
                    <ContextPanels
                      role={uiRole}
                      activeMenu={activeMenu}
                      enrollmentRequests={enrollmentRequests}
                      countyHeatmap={countyHeatmap}
                      supervisorNavigatorCompetency={supervisorNavigatorCompetency}
                      supervisorNavigatorDirectory={supervisorNavigatorDirectory}
                      onToggleSupervisorManagedNavigator={toggleSupervisorManagedNavigator}
                      isSavingAccessMatrix={isSavingAccessMatrix}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function preloadImageIfNeeded(url: string | null) {
  if (!url || url.startsWith('data:image/')) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

function LoadingShell() {
  return (
    <>
      <div
        className="flex min-h-[282px] flex-col gap-4 border-b pb-[12px] md:flex-row md:items-start"
        style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
      >
        <div className="flex-1 space-y-3">
          <div className="h-7 w-[240px] rounded-full bg-white/10" />
          <div className="h-4 w-[180px] rounded-full bg-white/10" />
          <div className="h-4 w-[220px] rounded-full bg-white/10" />
          <div className="flex flex-wrap gap-2 pt-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 w-11 rounded-full bg-white/10" />
            ))}
          </div>
        </div>
        <div className="h-[260px] w-full rounded-[30px] border border-white/15 bg-white/5 md:max-w-[360px]" />
      </div>

      <div className="flex min-h-[46px] items-center justify-center">
        <div className="h-10 w-full max-w-[520px] rounded-full border border-white/15 bg-white/5" />
      </div>

      <div className="h-[220px] rounded-[28px] border border-white/15 bg-white/5" />
    </>
  )
}

function getNextSuggestedPhase(logs: { phase: StabilizationPhase; status: string }[], isRegulationCleared: boolean) {
  const last = logs[logs.length - 1]
  if (!last) return isRegulationCleared ? 'readiness' : 'regulation'
  if (last.status !== 'active') return last.phase
  if (last.phase === 'regulation') return 'readiness'
  if (last.phase === 'readiness') return 'renewal'
  return 'renewal'
}

function formatDateLabel(dateValue: string) {
  const date = new Date(dateValue)
  if (!Number.isFinite(date.getTime())) return dateValue
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date)
}

function toCompetencyScore(rawCount: number, specializeCount: number) {
  const baseline = Math.min(10, Math.max(1, 4 + specializeCount + Math.round(rawCount / 2)))
  return baseline
}

function deriveJourneyPhase(logs: { phase: StabilizationPhase }[], fallback: StabilizationPhase): StabilizationPhase {
  if (!logs.length) return fallback
  return logs[logs.length - 1]?.phase || fallback
}

function deriveEnrolleeParentCodes(
  enrollee: { activeZCodeDetails: { parentCode: string }[]; zCodeTags: string[] } | null
) {
  if (!enrollee) return []
  const fromDetails = enrollee.activeZCodeDetails
    .map((detail) => detail.parentCode.trim().toUpperCase())
    .filter(Boolean)
  const source = fromDetails.length
    ? fromDetails
    : enrollee.zCodeTags
        .map((tag) => {
          const match = tag.trim().toUpperCase().match(/^Z(\d{2})/)
          return match ? `Z${match[1]}` : ''
        })
        .filter(Boolean)
  return Array.from(new Set(source)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

function menuToHash(menu: string) {
  return menu
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hashToMenu(hashValue: string, menus: string[]) {
  const normalizedHash = hashValue.replace(/^#/, '').trim().toLowerCase()
  if (!normalizedHash) return null
  return menus.find((menu) => menuToHash(menu) === normalizedHash) || null
}

