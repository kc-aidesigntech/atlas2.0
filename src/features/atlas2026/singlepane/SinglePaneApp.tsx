import React from 'react'
import LeftRailLane from '@/features/atlas2026/singlepane/components/LeftRailLane'
import ProfilePanel from '@/features/atlas2026/singlepane/components/ProfilePanel'
import RadialLoadChart from '@/features/atlas2026/singlepane/components/RadialLoadChart'
import RoleMenus from '@/features/atlas2026/singlepane/components/RoleMenus'
import StripMapTimeline from '@/features/atlas2026/singlepane/components/StripMapTimeline'
import TopNav from '@/features/atlas2026/singlepane/components/TopNav'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

export default function SinglePaneApp() {
  const {
    role,
    setRole,
    selectedEnrolleeId,
    setSelectedEnrolleeId,
    enrollees,
    selectedEnrollee,
    selectedLoad,
    selectedLogs,
    selectedRoleConfig,
    appendRouteLog
  } = useSinglePaneData()

  if (!selectedEnrollee) return null
  const activeAction = 'route planning'

  return (
    <div
      className="h-screen overflow-hidden bg-black text-white"
      style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <TopNav
        role={role}
        onRoleChange={setRole}
        roleConfig={selectedRoleConfig}
        enrollees={enrollees}
        selectedEnrolleeId={selectedEnrolleeId}
        onSelectEnrollee={setSelectedEnrolleeId}
      />

      <main className="relative h-[calc(100vh-92px)] px-[14px] py-[10px]">
        <LeftRailLane />

        <section
          className="relative mx-auto h-full w-[calc(100%-132px)] rounded-[38px] border bg-black px-[20px] pb-[12px] pt-[14px]"
          style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
        >
          <div className="flex h-full flex-col gap-[10px]">
            <div className="grid h-[252px] grid-cols-[1.58fr_0.72fr] gap-3 border-b pb-[6px]" style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}>
              <ProfilePanel enrollee={selectedEnrollee} />
              <div className="flex items-start justify-end pr-2">
                <RadialLoadChart load={selectedLoad} />
              </div>
            </div>

            <div className="flex h-[46px] items-center justify-center">
              <RoleMenus label={activeAction} onAppendLog={appendRouteLog} />
            </div>

            <div className="flex min-h-[220px] flex-1 items-center pt-1">
              <StripMapTimeline events={selectedLogs} />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
