import React from 'react'
import AdminDataControlPanel from '@/features/atlas2026/admin/AdminDataControlPanel'
import AccountSettingsPanel from '@/features/atlas2026/singlepane/components/AccountSettingsPanel'
import ContextPanels from '@/features/atlas2026/singlepane/components/ContextPanels'
import ProfilePanel from '@/features/atlas2026/singlepane/components/ProfilePanel'
import RadialLoadChart from '@/features/atlas2026/singlepane/components/RadialLoadChart'
import RoleMenus from '@/features/atlas2026/singlepane/components/RoleMenus'
import RoutePlanningOverlay from '@/features/atlas2026/singlepane/components/RoutePlanningOverlay'
import StripMapTimeline from '@/features/atlas2026/singlepane/components/StripMapTimeline'
import TopNav from '@/features/atlas2026/singlepane/components/TopNav'
import VerticalStripMapTimeline from '@/features/atlas2026/singlepane/components/VerticalStripMapTimeline'
import ZCodeTaskPane from '@/features/atlas2026/singlepane/components/ZCodeTaskPane'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

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
    selectedLogs,
    selectedRoleConfig,
    timelineConfig,
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
  } = useSinglePaneData()
  const [activeZCode, setActiveZCode] = React.useState<string | null>(null)
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = React.useState(false)
  const [isRoutePlanningOpen, setIsRoutePlanningOpen] = React.useState(false)
  const [lastContentMenu, setLastContentMenu] = React.useState('assigned enrollees')
  const actionMenus = selectedRoleConfig.actionMenus?.length ? selectedRoleConfig.actionMenus : ['route planning']

  React.useEffect(() => {
    if (activeMenu !== 'route planning') {
      setLastContentMenu(activeMenu)
    }
  }, [activeMenu])

  const activeAction = actionMenus[0] || 'route planning'
  const isAdminSection = role === 'administrator' && ['system operations', 'governance'].includes(activeMenu)
  const isReady = Boolean(selectedEnrollee && timelineConfig)

  function handleMenuSelect(menu: string) {
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
    appendRouteLog(label)
  }

  function closeRoutePlanning() {
    setIsRoutePlanningOpen(false)
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
          <RoutePlanningOverlay
            isOpen={isRoutePlanningOpen}
            enrollee={selectedEnrollee}
            routeCandidates={routeCandidates}
            enrollmentStartLabel={hasSavedIntake && selectedIntake ? formatDateLabel(selectedIntake.enrollmentStartIso) : 'not recorded'}
            hasRecordedIntake={hasSavedIntake}
            onClose={closeRoutePlanning}
          />
          <ZCodeTaskPane zCode={activeZCode} onClose={() => setActiveZCode(null)} />
          <div className="flex min-h-full flex-col gap-[10px]">
            {isLoading || !isReady ? (
              <LoadingShell />
            ) : (
              <>
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
                    <RadialLoadChart load={selectedLoad} />
                  </div>
                </div>

                <div className="flex min-h-[46px] items-center justify-center">
                  <RoleMenus labels={actionMenus} activeLabel={activeAction} onAction={handlePrimaryAction} />
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
                ) : (
                  <>
                    <div className="hidden min-h-[220px] flex-1 items-center pt-1 md:flex">
                      <StripMapTimeline events={selectedLogs} timelineConfig={timelineConfig} stationMarkers={journeyStationMarkers} />
                    </div>
                    <div className="flex min-h-[220px] flex-1 items-start pt-1 md:hidden">
                      <VerticalStripMapTimeline events={selectedLogs} timelineConfig={timelineConfig} stationMarkers={journeyStationMarkers} />
                    </div>
                    <ContextPanels
                      activeMenu={activeMenu}
                      enrollmentRequests={enrollmentRequests}
                      countyHeatmap={countyHeatmap}
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

function formatDateLabel(dateValue: string) {
  const date = new Date(dateValue)
  if (!Number.isFinite(date.getTime())) return dateValue
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(date)
}
