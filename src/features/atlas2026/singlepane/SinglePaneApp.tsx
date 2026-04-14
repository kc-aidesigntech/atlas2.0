import React from 'react'
import AdminDataControlPanel from '@/features/atlas2026/admin/AdminDataControlPanel'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import AccountSettingsPanel from '@/features/atlas2026/singlepane/components/AccountSettingsPanel'
import ContextPanels from '@/features/atlas2026/singlepane/components/ContextPanels'
import MobileRouteBoardPanel from '@/features/atlas2026/singlepane/components/MobileRouteBoardPanel'
import ProfilePanel from '@/features/atlas2026/singlepane/components/ProfilePanel'
import RadialLoadChart from '@/features/atlas2026/singlepane/components/RadialLoadChart'
import RadialLoadTableOverlay from '@/features/atlas2026/singlepane/components/RadialLoadTableOverlay'
import RegulationTestsOverlay from '@/features/atlas2026/singlepane/components/RegulationTestsOverlay'
import RoleMenus from '@/features/atlas2026/singlepane/components/RoleMenus'
import RoutePlanningOverlay from '@/features/atlas2026/singlepane/components/RoutePlanningOverlay'
import StripMapTimeline from '@/features/atlas2026/singlepane/components/StripMapTimeline'
import TopNav from '@/features/atlas2026/singlepane/components/TopNav'
import VerticalStripMapTimeline from '@/features/atlas2026/singlepane/components/VerticalStripMapTimeline'
import ZCodeTaskPane from '@/features/atlas2026/singlepane/components/ZCodeTaskPane'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { JourneyStationMarker, StabilizationPhase } from '@/features/atlas2026/singlepane/types'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

const PERSISTED_ACTION_LABELS = new Set([
  'route planning',
  'record navigator assessment'
])

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
    journeyStationMarkers,
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
    supervisorNavigatorCompetency,
    regulationTestHistory,
    regulationTestStripMarkers,
    isRegulationCleared,
    shouldHideReadinessProgress,
    isSavingRegulationTest,
    regulationTestError,
    saveAccountSettings,
    saveEnrolleeIntake,
    saveRouteAssignment,
    saveNavigatorCompetencyAssessment,
    saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft
  } = useSinglePaneData()
  const [activeZCode, setActiveZCode] = React.useState<string | null>(null)
  const [activeZCodeChildren, setActiveZCodeChildren] = React.useState<string[]>([])
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = React.useState(false)
  const [isRoutePlanningOpen, setIsRoutePlanningOpen] = React.useState(false)
  const [isRegulationTestsOpen, setIsRegulationTestsOpen] = React.useState(false)
  const [isLoadTableOpen, setIsLoadTableOpen] = React.useState(false)
  const [selectedRouteCandidateId, setSelectedRouteCandidateId] = React.useState<string | null>(null)
  const [lastContentMenu, setLastContentMenu] = React.useState('assigned enrollees')
  const actionMenus = (selectedRoleConfig.actionMenus || []).filter((label) => PERSISTED_ACTION_LABELS.has(label.trim().toLowerCase()))
  const standaloneSurveyUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '/service-capacity-survey'
    return new URL('service-capacity-survey', `${window.location.origin}${import.meta.env.BASE_URL}`).toString()
  }, [])

  React.useEffect(() => {
    if (activeMenu !== 'route planning') {
      setLastContentMenu(activeMenu)
    }
  }, [activeMenu])

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
  const isReady = isPartnerRole ? true : Boolean(selectedEnrollee && timelineConfig)
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
  const showRoutePlanningQuickAction = role === 'navigator' ? isRegulationCleared : false
  const highlightedStationName = isRoutePlanningOpen
    ? selectedRouteCandidate?.stationName || selectedRouteAssignment?.stationName || null
    : selectedRouteAssignment?.stationName || null
  const previewStationMarkers = React.useMemo(() => {
    if (role === 'navigator' && shouldHideReadinessProgress) {
      return visibleJourneyStationMarkers
    }
    const suggestedMarkers: JourneyStationMarker[] = routeCandidates.map((candidate) => ({
      id: `suggested-${candidate.stationId}`,
      stationName: candidate.stationName,
      assignedAtIso: timelineConfig?.planStartIso || new Date().toISOString(),
      phase: 'readiness',
      markerType: 'suggested'
    }))
    return [...visibleJourneyStationMarkers, ...suggestedMarkers]
  }, [role, routeCandidates, shouldHideReadinessProgress, timelineConfig?.planStartIso, visibleJourneyStationMarkers])
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
        setIsRegulationTestsOpen(true)
        return
      }
      setActiveMenu('route planning')
      setIsRoutePlanningOpen(true)
      return
    }
    if (role === 'supervisor' && label.trim().toLowerCase() === 'record navigator assessment') {
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
    const fallbackMenu =
      lastContentMenu && lastContentMenu !== 'route planning' ? lastContentMenu : selectedRoleConfig.topMenus?.[0] || 'assigned enrollees'
    setActiveMenu(fallbackMenu)
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

      <main className="relative px-[14px] py-[10px]">
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
          />
          {!isPartnerRole ? (
            <RoutePlanningOverlay
              isOpen={isRoutePlanningOpen}
              enrollee={selectedEnrollee}
              routeCandidates={routeCandidates}
              selectedCandidateId={selectedRouteCandidateId}
              onSelectCandidate={setSelectedRouteCandidateId}
              assignedCandidateId={selectedRouteAssignment?.stationId || null}
              onCommitCandidate={(candidate) => saveRouteAssignment(candidate, getNextSuggestedPhase(selectedLogs, isRegulationCleared))}
              enrollmentStartLabel={hasSavedIntake && selectedIntake ? formatDateLabel(selectedIntake.enrollmentStartIso) : 'not recorded'}
              hasRecordedIntake={hasSavedIntake}
              suggestedPhase={getNextSuggestedPhase(selectedLogs, isRegulationCleared)}
              onClose={closeRoutePlanning}
            />
          ) : null}
          <RadialLoadTableOverlay
            isOpen={isLoadTableOpen}
            load={selectedLoad}
            breakdown={selectedLoadBreakdown}
            onClose={() => setIsLoadTableOpen(false)}
          />
          <RegulationTestsOverlay
            isOpen={isRegulationTestsOpen}
            enrollee={selectedEnrollee}
            isSaving={isSavingRegulationTest}
            saveError={regulationTestError}
            history={regulationTestHistory}
            onClose={() => setIsRegulationTestsOpen(false)}
            onSave={saveNavigatorRegulationTest}
            onDeleteDraft={deleteNavigatorRegulationTestDraft}
          />
          <ZCodeTaskPane
            zCode={activeZCode}
            childCodes={activeZCodeChildren}
            onClose={() => {
              setActiveZCode(null)
              setActiveZCodeChildren([])
            }}
          />
          <div className="flex min-h-full flex-col gap-[10px]">
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
                      <div className="mt-3">
                        <AtlasTextButton
                          disabled
                          className="px-4 py-1 text-[13px] text-white"
                          style={{ ['--button-border-color' as const]: '#ffffff40', opacity: 0.5 } as React.CSSProperties}
                          title="Referral action disabled until explicit persistence contract is defined."
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
                ) : (
                  <div
                    className="flex min-h-[282px] flex-wrap items-start gap-x-4 gap-y-5 border-b pb-[12px]"
                    style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
                  >
                    <div className="min-w-0 flex-1 basis-[520px]">
                      <ProfilePanel
                        enrollee={selectedEnrollee}
                        onSelectZCode={(selection) => {
                          setActiveZCode(selection.parentCode)
                          setActiveZCodeChildren(selection.childCodes)
                        }}
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
                      selectedEnrollee={selectedEnrollee}
                      intake={selectedIntake}
                      hasRecordedIntake={hasSavedIntake}
                      onSaveIntake={saveEnrolleeIntake}
                    />
                  </div>
                ) : isServiceCapacitySection ? null : isPartnerRole ? (
                  <>
                    {timelineConfig ? (
                      <>
                        <div className="hidden min-h-[220px] flex-1 items-start md:flex">
                          <StripMapTimeline
                            events={selectedLogs}
                            timelineConfig={timelineConfig}
                            stationMarkers={previewStationMarkers}
                            highlightedStationName={highlightedStationName}
                            onEventDelete={deleteRouteLog}
                            onEventPositionChange={updateRouteLogTimelinePosition}
                            onEventDateChange={updateRouteLogDate}
                            onStartDateChange={updateTimelineStartDate}
                          />
                        </div>
                        <div className="flex min-h-[220px] flex-1 items-start md:hidden">
                          <VerticalStripMapTimeline
                            events={selectedLogs}
                            timelineConfig={timelineConfig}
                            stationMarkers={previewStationMarkers}
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
                ) : (
                  <>
                    <div className="hidden min-h-[220px] flex-1 items-start md:flex">
                      <StripMapTimeline
                        events={selectedLogs}
                        timelineConfig={timelineConfig}
                        stationMarkers={previewStationMarkers}
                        highlightedStationName={highlightedStationName}
                        showRoutePlanningQuickAction={showRoutePlanningQuickAction}
                        onRoutePlanningClick={() => {
                          setActiveMenu('route planning')
                          setIsRoutePlanningOpen(true)
                        }}
                        onRegulationTestsClick={() => setIsRegulationTestsOpen(true)}
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
                        selectedCandidateId={selectedRouteCandidateId}
                        assignedCandidateId={selectedRouteAssignment?.stationId || null}
                        highlightedStationName={isRegulationCleared ? highlightedStationName : null}
                        onSelectCandidate={setSelectedRouteCandidateId}
                        onCommitCandidate={(candidate) => saveRouteAssignment(candidate, getNextSuggestedPhase(selectedLogs, isRegulationCleared))}
                        showRoutePlanningQuickAction={showRoutePlanningQuickAction}
                        isRegulationCleared={isRegulationCleared}
                        regulationTestMarkers={regulationTestStripMarkers}
                        onRoutePlanningClick={() => {
                          if (!isRegulationCleared) {
                            setIsRegulationTestsOpen(true)
                            return
                          }
                          setActiveMenu('route planning')
                          setIsRoutePlanningOpen(true)
                        }}
                        onRegulationTestsClick={() => setIsRegulationTestsOpen(true)}
                        onStartDateChange={updateTimelineStartDate}
                        onTimelineConfigChange={updateTimelineConfig}
                        suggestedPhase={getNextSuggestedPhase(selectedLogs, isRegulationCleared)}
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

function derivePartnerBadgeCodes(loadBreakdown: { rows: { zCodeGroup: string }[] } | null) {
  const parsed = (loadBreakdown?.rows || [])
    .flatMap((row) => row.zCodeGroup.match(/\d+/g) || [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  const unique = Array.from(new Set(parsed))
  return unique.length ? unique.slice(0, 3) : ['56', '55', '57']
}
