import React from 'react'
import type { AtlasRole, CountyHeatPoint, EnrollmentRequestRecord, SupervisorNavigatorCompetencySummary } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import CountyCommonsHeatmap from '@/features/atlas2026/singlepane/components/CountyCommonsHeatmap'
import { isCountyCommonsMenuEnabled } from '@/features/atlas2026/singlepane/data-access/singlePaneBootstrapRepository'
import { isNavigatorTier, isSupervisorTier } from '@/features/atlas2026/singlepane/domain/roles'

interface ContextPanelsProps {
  role: AtlasRole
  activeMenu: string
  enrollmentRequests: EnrollmentRequestRecord[]
  countyHeatmap: CountyHeatPoint[]
  /** `heatmap.view`: the county commons heat map renders. */
  canViewHeatmap?: boolean
  /** `heatmap.toggle`: the collapse control on the heat map renders. */
  canToggleHeatmap?: boolean
  supervisorNavigatorCompetency: SupervisorNavigatorCompetencySummary[]
  supervisorNavigatorDirectory: Array<{
    navigatorPersonId: string
    navigatorName: string
    assignedEnrolleeCount: number
    isManagedByCurrentSupervisor: boolean
  }>
  onToggleSupervisorManagedNavigator?: (navigatorPersonId: string, isManaged: boolean) => Promise<void> | void
  isSavingAccessMatrix?: boolean
}

export default function ContextPanels({
  role,
  activeMenu,
  enrollmentRequests,
  countyHeatmap,
  canViewHeatmap = false,
  canToggleHeatmap = false
}: ContextPanelsProps) {
  // Enrollment intake stays off my wallet. This branch only remains for a stored menu label
  // that normalization did not rewrite.
  if (activeMenu === 'my profile' && !isNavigatorTier(role) && !isSupervisorTier(role)) {
    return (
      <div className="w-full rounded-2xl border px-4 py-3" style={{ borderColor: '#ffffff50' }}>
        <small className="mb-2 block text-[13px] text-white">my profile</small>
        <div className="space-y-2">
          {enrollmentRequests.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border px-2 py-1.5" style={{ borderColor: '#ffffff3a' }}>
              <div>
                <small className="block text-[12px] text-white">{item.prospectiveEnrollee}</small>
                <small className="text-[11px] text-[#cfcfcf]">{item.email || 'no email'}</small>
              </div>
              <small className="text-[11px] uppercase text-white">{item.status}</small>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (activeMenu === 'county commons') {
    // The heat map renders only for heatmap.view holders while the county commons
    // switch is on; the collapse control renders only for heatmap.toggle holders.
    if (!canViewHeatmap || !isCountyCommonsMenuEnabled()) return null
    return <CountyCommonsHeatmap points={countyHeatmap} canToggle={canToggleHeatmap} />
  }

  if (activeMenu === 'refer' || activeMenu === 'referral portal') {
    return (
      <div className="space-y-2">
        <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
          referral workflow is available directly in this app.
        </small>
      </div>
    )
  }

  return null
}
