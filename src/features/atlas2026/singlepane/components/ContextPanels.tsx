import React from 'react'
import SupervisorCompetencyPanel from '@/features/atlas2026/singlepane/components/SupervisorCompetencyPanel'
import type { AtlasRole, CountyHeatPoint, EnrollmentRequestRecord, SupervisorNavigatorCompetencySummary } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface ContextPanelsProps {
  role: AtlasRole
  activeMenu: string
  enrollmentRequests: EnrollmentRequestRecord[]
  countyHeatmap: CountyHeatPoint[]
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
  supervisorNavigatorCompetency,
  supervisorNavigatorDirectory,
  onToggleSupervisorManagedNavigator,
  isSavingAccessMatrix = false
}: ContextPanelsProps) {
  // Non-navigator "my profile" intentionally surfaces enrollment intake requests instead of navigator-only profile data.
  if (activeMenu === 'my profile' && role !== 'navigator') {
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
    // County commons stays intentionally hidden while the experience is being rebuilt.
    return null
  }

  if (role === 'supervisor' && (activeMenu === 'navigator assessments' || activeMenu === 'assigned navigators')) {
    return (
      <SupervisorCompetencyPanel
        mode={activeMenu === 'assigned navigators' ? 'assigned-navigators' : 'navigator-assessments'}
        navigatorDirectory={supervisorNavigatorDirectory}
        competencyByNavigator={supervisorNavigatorCompetency}
        onToggleManagedNavigator={onToggleSupervisorManagedNavigator}
        isSavingAssignments={isSavingAccessMatrix}
      />
    )
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
