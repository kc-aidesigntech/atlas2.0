import React from 'react'
import AdminDataControlPanel from '@/features/atlas2026/admin/AdminDataControlPanel'
import AccountSettingsPanel from '@/features/atlas2026/singlepane/components/AccountSettingsPanel'
import ContextPanels from '@/features/atlas2026/singlepane/components/ContextPanels'
import ProfilePanel from '@/features/atlas2026/singlepane/components/ProfilePanel'
import RadialLoadChart from '@/features/atlas2026/singlepane/components/RadialLoadChart'
import RadialLoadTableOverlay from '@/features/atlas2026/singlepane/components/RadialLoadTableOverlay'
import RoleMenus from '@/features/atlas2026/singlepane/components/RoleMenus'
import RoutePlanningOverlay from '@/features/atlas2026/singlepane/components/RoutePlanningOverlay'
import StripMapTimeline from '@/features/atlas2026/singlepane/components/StripMapTimeline'
import TopNav from '@/features/atlas2026/singlepane/components/TopNav'
import VerticalStripMapTimeline from '@/features/atlas2026/singlepane/components/VerticalStripMapTimeline'
import ZCodeTaskPane from '@/features/atlas2026/singlepane/components/ZCodeTaskPane'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { JourneyStationMarker, StabilizationPhase } from '@/features/atlas2026/singlepane/types'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'
import arrowGlyphIcon from '../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png'

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
    accountSettings,
    selectedIntake,
    hasSavedIntake,
    supervisorNavigatorCompetency,
    saveAccountSettings,
    saveEnrolleeIntake,
    saveRouteAssignment,
    saveNavigatorCompetencyAssessment
  } = useSinglePaneData()
  const [activeZCode, setActiveZCode] = React.useState<string | null>(null)
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = React.useState(false)
  const [isRoutePlanningOpen, setIsRoutePlanningOpen] = React.useState(false)
  const [isLoadTableOpen, setIsLoadTableOpen] = React.useState(false)
  const [selectedRouteCandidateId, setSelectedRouteCandidateId] = React.useState<string | null>(null)
  const [lastContentMenu, setLastContentMenu] = React.useState('assigned enrollees')
  const actionMenus = selectedRoleConfig.actionMenus || []
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

  const activeAction = actionMenus[0] || ''
  const isPartnerRole = role === 'partner'
  const isAdminSection = role === 'administrator' && ['system operations', 'governance'].includes(activeMenu)
  const isServiceCapacitySection = role === 'partner' && activeMenu === 'service capacity'
  const isReady = isPartnerRole ? Boolean(selectedLoad) : Boolean(selectedEnrollee && timelineConfig)
  const selectedRouteCandidate = routeCandidates.find((candidate) => candidate.stationId === selectedRouteCandidateId) || null
  const journeyPhase = React.useMemo(() => deriveJourneyPhase(selectedLogs, 'regulation'), [selectedLogs])
  const showRoutePlanningQuickAction = journeyPhase === 'readiness'
  const highlightedStationName = isRoutePlanningOpen
    ? selectedRouteCandidate?.stationName || selectedRouteAssignment?.stationName || null
    : selectedRouteAssignment?.stationName || null
  const previewStationMarkers = React.useMemo(() => {
    const suggestedMarkers: JourneyStationMarker[] = routeCandidates.map((candidate) => ({
      id: `suggested-${candidate.stationId}`,
      stationName: candidate.stationName,
      assignedAtIso: timelineConfig?.planStartIso || new Date().toISOString(),
      phase: 'readiness',
      markerType: 'suggested'
    }))
    return [...journeyStationMarkers, ...suggestedMarkers]
  }, [journeyStationMarkers, routeCandidates, timelineConfig?.planStartIso])
  const partnerStationBadgeCodes = React.useMemo(() => {
    return derivePartnerBadgeCodes(selectedLoadBreakdown)
  }, [selectedLoadBreakdown])

  function handleMenuSelect(menu: string) {
    if (role === 'partner' && menu === 'service capacity') {
      window.location.assign(standaloneSurveyUrl)
      return
    }
    if (menu === 'route planning') {
      setActiveMenu(menu)
      setIsRoutePlanningOpen(true)
      return
    }
    setActiveMenu(menu)
  }

  function handlePrimaryAction(label: string) {
    if (label.trim().toLowerCase() === 'route planning') {
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
              onCommitCandidate={(candidate) => saveRouteAssignment(candidate, getNextSuggestedPhase(selectedLogs))}
              enrollmentStartLabel={hasSavedIntake && selectedIntake ? formatDateLabel(selectedIntake.enrollmentStartIso) : 'not recorded'}
              hasRecordedIntake={hasSavedIntake}
              suggestedPhase={getNextSuggestedPhase(selectedLogs)}
              onClose={closeRoutePlanning}
            />
          ) : null}
          <RadialLoadTableOverlay
            isOpen={isLoadTableOpen}
            load={selectedLoad}
            breakdown={selectedLoadBreakdown}
            onClose={() => setIsLoadTableOpen(false)}
          />
          <ZCodeTaskPane zCode={activeZCode} onClose={() => setActiveZCode(null)} />
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
                        {accountSettings.organization?.trim() || '[My Station]'}
                      </div>
                      <small className="mt-2 block text-[14px] text-white">Address: not configured</small>
                      <small className="mt-1 block text-[14px] text-white">C: ###-###-####</small>
                      <small className="mt-1 block text-[14px] text-white">E: {accountSettings.email || 'not configured'}</small>
                      <div className="mt-3">
                        <button
                          type="button"
                          className="rounded-full border px-4 py-1 text-[13px] text-white"
                          style={{ borderColor: '#ffffff40' }}
                        >
                          refer
                        </button>
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
                        onSelectZCode={setActiveZCode}
                        enrollmentStartLabel={hasSavedIntake && selectedIntake ? formatDateLabel(selectedIntake.enrollmentStartIso) : 'not recorded'}
                      />
                    </div>
                    <div className="flex w-full justify-center md:ml-auto md:w-auto md:flex-none md:justify-end md:pr-2">
                      <RadialLoadChart load={selectedLoad} onClick={() => setIsLoadTableOpen(true)} />
                    </div>
                  </div>
                )}

                <div className="flex min-h-[46px] items-center justify-center">
                  {!showRoutePlanningQuickAction && actionMenus.length > 0 ? (
                    <RoleMenus labels={actionMenus} activeLabel={activeAction} onAction={handlePrimaryAction} />
                  ) : null}
                </div>

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
                    <div className="mt-3 rounded-[22px] border px-5 py-5" style={{ borderColor: '#ffffff30', backgroundColor: '#020202' }}>
                      <div className="mx-auto flex max-w-[760px] items-center justify-center gap-3">
                        <div className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: SP_COLORS.red }} />
                        <img src={arrowGlyphIcon} alt="" aria-hidden className="h-8 w-8 -rotate-90 opacity-85" />
                        <div className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: SP_COLORS.yellow }} />
                        <img src={arrowGlyphIcon} alt="" aria-hidden className="h-8 w-8 -rotate-90 opacity-85" />
                        <div className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: SP_COLORS.deepGreen }} />
                      </div>
                    </div>
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
                    <div className="hidden min-h-[220px] flex-1 items-center pt-1 md:flex">
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
                        onEventDelete={deleteRouteLog}
                        onEventPositionChange={updateRouteLogTimelinePosition}
                        onEventDateChange={updateRouteLogDate}
                        onStartDateChange={updateTimelineStartDate}
                      />
                    </div>
                    <div className="flex min-h-[220px] flex-1 items-start pt-1 md:hidden">
                      <VerticalStripMapTimeline
                        events={selectedLogs}
                        timelineConfig={timelineConfig}
                        stationMarkers={previewStationMarkers}
                        highlightedStationName={highlightedStationName}
                        showRoutePlanningQuickAction={showRoutePlanningQuickAction}
                        onRoutePlanningClick={() => {
                          setActiveMenu('route planning')
                          setIsRoutePlanningOpen(true)
                        }}
                        onEventDelete={deleteRouteLog}
                        onEventDateChange={updateRouteLogDate}
                        onStartDateChange={updateTimelineStartDate}
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

function getNextSuggestedPhase(logs: { phase: StabilizationPhase; status: string }[]) {
  const last = logs[logs.length - 1]
  if (!last) return 'regulation'
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
