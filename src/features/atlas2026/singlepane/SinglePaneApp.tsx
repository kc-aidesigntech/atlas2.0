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

      <main className="h-[calc(100vh-92px)] px-[14px] py-[10px]">
        <section className="relative h-full rounded-[24px] border bg-black pl-[74px] pr-[20px] pt-[14px]" style={{ borderColor: SP_COLORS.blue }}>
          <LeftRailLane />

          <div className="flex h-full flex-col gap-[10px]">
            <div className="grid grid-cols-[1.58fr_0.72fr] gap-3 border-b pb-[6px]" style={{ borderColor: SP_COLORS.border }}>
              <ProfilePanel enrollee={selectedEnrollee} />
              <div className="flex items-start justify-end pr-2">
                <RadialLoadChart load={selectedLoad} />
              </div>
            </div>

            <div className="flex items-center justify-center">
              <RoleMenus label={activeAction} onAppendLog={appendRouteLog} />
            </div>

            <div className="min-h-0 flex-1 pt-1">
              <StripMapTimeline events={selectedLogs} />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
