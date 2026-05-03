import React from 'react'
import { useSupabaseAuth } from '@/auth/SupabaseAuthProvider'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled } from '@/lib/supabaseClient'
import AdminDataControlPanel from '../admin/AdminDataControlPanel'
import { AtlasTextButton } from '../components/AtlasPrimitives'
import AccountSettingsPanel from './components/AccountSettingsPanel'
import ContextPanels from './components/ContextPanels'
import MobileRouteBoardPanel from './components/MobileRouteBoardPanel'
import NavigatorMyProfilePanel from './components/NavigatorMyProfilePanel'
import PartnerReferralWorkflowPanel from './components/PartnerReferralWorkflowPanel'
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
import type { RouteCandidateRecord, StabilizationPhase } from './types'
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
    timelineConfig,
    enrollmentRequests,
    routeCandidates,
    countyHeatmap,
    adminMetrics,
    adminPortalRegistry,
    adminPortalRegistryError,
    navigatorProgramError,
    journeyStationMarkers,
    resolvedZCodeStripMarkers,
    currentNavigatorName,
    navigatorAggregateLoad,
    navigatorAggregateLoadBreakdown,
    pickupQueue,
    navigatorSelfAssessments,
    navigatorSelfAssessmentSummary,
    navigatorSupervisionSessions,
    navigatorAssignedCompetencySummary,
    navigatorIntervalDueItems,
    navigatorProgramState,
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
    supervisorNavigatorCompetency,
    regulationTestHistory,
    regulationTestStripMarkers,
    isRegulationCleared,
    shouldHideReadinessProgress,
    isSavingRegulationTest,
    regulationTestError,
    isUploadingProfileImage,
    profileImageUploadError,
    saveAccountSettings,
    saveAdminPortalRegistry,
    claimPickupQueueRecord,
    saveNavigatorSelfAssessment,
    saveSupervisionSession,
    saveIntervalAssessmentRule,
    submitPartnerReferral,
    replaceSelectedEnrolleeProfileImage,
    saveEnrolleeIntake,
    setEnrolleeZCodeResolution,
    saveRouteAssignment,
    saveNavigatorCompetencyAssessment,
    saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft
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
  const [selectedRouteCandidateId, setSelectedRouteCandidateId] = React.useState<string | null>(null)
  const [resolutionOverlayState, setResolutionOverlayState] = React.useState<ResolutionOverlayState | null>(null)
  const [lastContentMenu, setLastContentMenu] = React.useState('enrollees')
  const [contentOpacity, setContentOpacity] = React.useState(1)
  const transitionCycleRef = React.useRef(0)
  const transitionBootstrappedRef = React.useRef(false)
  const hashSyncBootstrappedRef = React.useRef(false)
  const actionMenus = (selectedRoleConfig.actionMenus || []).filter((label) => PERSISTED_ACTION_LABELS.has(label.trim().toLowerCase()))
  const standaloneSurveyUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '/service-capacity-survey'
    return new URL('service-capacity-survey', window.location.href.split('#')[0]).toString()
  }, [])

  React.useEffect(() => {
    // Keep the last non-overlay menu so closing route planning returns users to
    // their previous content context instead of forcing default navigation.
    if (activeMenu !== 'route planning') {
      setLastContentMenu(activeMenu)
    }
  }, [activeMenu])

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
    // Initial hash bootstrap prefers URL intent, then canonicalizes hash to the
    // exact current menu key for stable deep-link sharing.
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

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedRoleConfig.topMenus.length) return
    if (!selectedRoleConfig.topMenus.includes(activeMenu)) return
    const nextHash = menuToHash(activeMenu)
    if (!nextHash) return
    const currentHash = window.location.hash.replace(/^#/, '')
    if (currentHash === nextHash) return

    const nextUrl = `${window.location.pathname}${window.location.search}#${nextHash}`
    // First sync uses replaceState to avoid creating a duplicate history entry
    // on mount; subsequent menu changes intentionally push user-visible history.
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
      // Transition cycle token prevents stale async work from restoring opacity
      // after a newer enrollee selection has already started rendering.
      await sleep(160)
      if (cycle !== transitionCycleRef.current) return
      await preloadImageIfNeeded(targetAvatarUrl)
      if (cycle !== transitionCycleRef.current) return
      setContentOpacity(1)
    })()
  }, [enrollees, selectedEnrolleeId])

  React.useEffect(() => {
    if (role === 'partner' && activeMenu === 'service capacity') {
      window.location.assign(standaloneSurveyUrl)
    }
  }, [activeMenu, role, standaloneSurveyUrl])

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
    if (role !== 'navigator' || isRegulationCleared || !isRoutePlanningOpen) return
    setIsRoutePlanningOpen(false)
    setSelectedRouteCandidateId(null)
  }, [isRegulationCleared, isRoutePlanningOpen, role])

  const activeAction = actionMenus[0] || ''
  const isPartnerRole = role === 'partner'
  const isAdminSection = role === 'administrator' && ['system operations', 'governance'].includes(activeMenu)
  const isServiceCapacitySection = role === 'partner' && activeMenu === 'service capacity'
  const isPartnerReferralPortal = role === 'partner' && activeMenu === 'referral portal'
  const isNavigatorMyProfile = role === 'navigator' && activeMenu === 'my profile'
  const isReady = isPartnerRole ? true : isNavigatorMyProfile ? true : Boolean(selectedEnrollee && timelineConfig)
  const selectedRouteCandidate = routeCandidates.find((candidate) => candidate.stationId === selectedRouteCandidateId) || null
  const visibleLogs = React.useMemo(
    () => (role === 'navigator' && shouldHideReadinessProgress ? selectedLogs.filter((log) => log.phase === 'regulation') : selectedLogs),
    [role, selectedLogs, shouldHideReadinessProgress]
  )
  const visibleJourneyStationMarkers = React.useMemo(
    () =>
      role === 'navigator' && shouldHideReadinessProgress
        ? journeyStationMarkers.filter((marker) => marker.phase === 'regulation')
        : journeyStationMarkers,
    [journeyStationMarkers, role, shouldHideReadinessProgress]
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
  const showRoutePlanningQuickAction = role === 'navigator' ? isRegulationCleared : false
  const nextSuggestedPhase = React.useMemo(
    () => getNextSuggestedPhase(selectedLogs, isRegulationCleared),
    [isRegulationCleared, selectedLogs]
  )
  const hasEnteredRenewalStage = React.useMemo(
    () => selectedLogs.some((log) => log.phase === 'renewal') || nextSuggestedPhase === 'renewal',
    [nextSuggestedPhase, selectedLogs]
  )
  const highlightedStationName = isRoutePlanningOpen
    ? selectedRouteCandidate?.stationName || selectedRouteAssignment?.stationName || null
    : selectedRouteAssignment?.stationName || null
  const displayLoad = isNavigatorMyProfile ? navigatorAggregateLoad : selectedLoad
  const displayLoadBreakdown = isNavigatorMyProfile ? navigatorAggregateLoadBreakdown : selectedLoadBreakdown
  const partnerStationBadgeCodes = React.useMemo(() => derivePartnerBadgeCodes(selectedLoadBreakdown), [selectedLoadBreakdown])
  const partnerContactName = React.useMemo(() => {
    const firstName = partnerStationProfile?.primaryContactFirstName?.trim() || ''
    const lastName = partnerStationProfile?.primaryContactLastName?.trim() || ''
    const combined = `${firstName} ${lastName}`.trim()
    return combined || accountSettings.fullName || 'not configured'
  }, [accountSettings.fullName, partnerStationProfile?.primaryContactFirstName, partnerStationProfile?.primaryContactLastName])

  function handleMenuSelect(menu: string) {
    if (role === 'partner' && menu === 'service capacity') {
      window.location.assign(standaloneSurveyUrl)
      return
    }
    if (menu === 'route planning') {
      if (role === 'navigator' && !isRegulationCleared) {
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
      if (role === 'navigator' && !isRegulationCleared) {
        setAssessmentInitialTestType('mh_sca')
        setIsRegulationTestsOpen(true)
        return
      }
      setActiveMenu('route planning')
      setIsRoutePlanningOpen(true)
      return
    }
    if (role === 'supervisor' && label.trim().toLowerCase() === 'record navigator assessment') {
      if (!selectedEnrollee || !selectedLoadBreakdown) return
      // Derive a compact score payload from current breakdown rows so supervisors
      // can capture an assessment without leaving the workflow panel.
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
        role={role}
        roleConfig={selectedRoleConfig}
        activeMenu={activeMenu}
        onMenuSelect={handleMenuSelect}
        enrollees={enrollees}
        selectedEnrolleeId={selectedEnrolleeId}
        onSelectEnrollee={setSelectedEnrolleeId}
        onOpenAccountSettings={() => setIsAccountSettingsOpen(true)}
      />

      <main className="atlas-shell-edge-buffer relative py-[10px]">
        <section
          className="relative mx-auto min-h-[calc(100vh-112px)] w-full rounded-[38px] border bg-black px-[20px] pb-[12px] pt-[14px]"
          style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
        >
          <AccountSettingsPanel
            isOpen={isAccountSettingsOpen}
            role={role}
            settings={accountSettings}
            onClose={() => setIsAccountSettingsOpen(false)}
            onRoleChange={setRole}
            onSave={saveAccountSettings}
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
                      void signOut()
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
                    <div className="min-w-0 flex-1 basis-[520px] rounded-[26px] border p-4" style={{ borderColor: '#ffffff35' }}>
                      <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
                        my station
                      </small>
                      <div className="mt-1 text-[26px] font-medium text-white">
                        {partnerStationProfile?.stationName || accountSettings.organization?.trim() || '[My Station]'}
                      </div>
                      <small className="mt-2 block text-[14px] text-white">
                        Org: {partnerStationProfile?.organizationName || accountSettings.organization || 'not configured'}
                      </small>
                      <small className="mt-1 block text-[14px] text-white">
                        County: {partnerStationProfile?.countyName || 'not configured'}
                      </small>
                      <small className="mt-1 block text-[14px] text-white">Contact: {partnerContactName}</small>
                      <small className="mt-1 block text-[14px] text-white">
                        E: {partnerStationProfile?.primaryContactEmail || accountSettings.email || 'not configured'}
                      </small>
                      <div className="mt-4 flex justify-center">
                        <AtlasTextButton
                          onClick={() => setActiveMenu('referral portal')}
                          className="px-4 py-1 text-[13px] text-white"
                          style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                          title="Open the referral workflow."
                        >
                          refer
                        </AtlasTextButton>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {partnerStationBadgeCodes.map((code, index) => (
                          <span
                            key={`${code}-${index}`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[28px] font-bold"
                            style={{
                              backgroundColor: index % 3 === 1 ? SP_COLORS.red : index % 3 === 2 ? SP_COLORS.blue : SP_COLORS.yellow,
                              color: '#000000'
                            }}
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex w-full justify-center md:ml-auto md:w-auto md:flex-none md:justify-end md:pr-2">
                      <RadialLoadChart load={selectedLoad} onClick={() => setIsLoadTableOpen(true)} />
                    </div>
                  </div>
                ) : isNavigatorMyProfile ? (
                  <NavigatorMyProfilePanel
                    accountSettings={accountSettings}
                    currentNavigatorName={currentNavigatorName}
                    aggregateLoad={navigatorAggregateLoad}
                    assignedEnrolleeCount={enrollees.length}
                    pickupQueue={pickupQueue}
                    competencySummary={navigatorAssignedCompetencySummary}
                    selfAssessmentSummary={navigatorSelfAssessmentSummary}
                    selfAssessments={navigatorSelfAssessments}
                    supervisionSessions={navigatorSupervisionSessions}
                    dueItems={navigatorIntervalDueItems}
                    programError={navigatorProgramError}
                    onOpenLoadTable={() => setIsLoadTableOpen(true)}
                    onClaimPickupQueueRecord={claimPickupQueueRecord}
                    onSaveSelfAssessment={saveNavigatorSelfAssessment}
                    onSaveSupervisionSession={saveSupervisionSession}
                  />
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
                      />
                    </div>
                    <div className="flex w-full justify-center md:ml-auto md:w-auto md:flex-none md:justify-end md:pr-2">
                      <RadialLoadChart load={selectedLoad} onClick={() => setIsLoadTableOpen(true)} />
                    </div>
                  </div>
                )}

                {role !== 'navigator' && !showRoutePlanningQuickAction && actionMenus.length > 0 ? (
                  <div className="flex items-center justify-center py-1">
                    <RoleMenus labels={actionMenus} activeLabel={activeAction} onAction={handlePrimaryAction} />
                  </div>
                ) : null}

                {isAdminSection ? (
                  <div className="flex min-h-[220px] flex-1 items-start pt-1">
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
                      registry={adminPortalRegistry}
                      isSavingRegistry={isSavingAdminPortalRegistry}
                      registryError={adminPortalRegistryError}
                      onSaveRegistry={saveAdminPortalRegistry}
                      onSaveIntervalAssessmentRule={saveIntervalAssessmentRule}
                      onSaveIntake={saveEnrolleeIntake}
                    />
                  </div>
                ) : isServiceCapacitySection || isNavigatorMyProfile ? null : isPartnerRole ? (
                  <>
                    {isPartnerReferralPortal ? (
                      <PartnerReferralWorkflowPanel
                        defaultReferrerName={accountSettings.fullName}
                        defaultPartnerOrganizationName={
                          partnerStationProfile?.organizationName?.trim() || accountSettings.organization.trim()
                        }
                        recentReferrals={pickupQueue}
                        onSubmit={submitPartnerReferral}
                      />
                    ) : (
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
                          role={role}
                          activeMenu={activeMenu}
                          enrollmentRequests={enrollmentRequests}
                          countyHeatmap={countyHeatmap}
                          supervisorNavigatorCompetency={supervisorNavigatorCompetency}
                        />
                      </>
                    )}
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
                      role={role}
                      activeMenu={activeMenu}
                      enrollmentRequests={enrollmentRequests}
                      countyHeatmap={countyHeatmap}
                      supervisorNavigatorCompetency={supervisorNavigatorCompetency}
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
  // Invariant: never suggest readiness/renewal before regulation tests are cleared.
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
  // Prefer canonical parent codes from active details; only fall back to parsing
  // legacy tag strings when detail records are unavailable.
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

function derivePartnerBadgeCodes(loadBreakdown: { rows: { zCodeGroup: string }[] } | null) {
  const parsed = (loadBreakdown?.rows || [])
    .flatMap((row) => row.zCodeGroup.match(/\d+/g) || [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  const unique = Array.from(new Set(parsed))
  return unique.length ? unique.slice(0, 3) : ['56', '55', '57']
}
