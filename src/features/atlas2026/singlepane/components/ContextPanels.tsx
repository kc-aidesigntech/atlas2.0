import React from 'react'
import { AtlasTextLink } from '@/features/atlas2026/components/AtlasPrimitives'
import CountyCommonsHeatmap from '@/features/atlas2026/singlepane/components/CountyCommonsHeatmap'
import SupervisorCompetencyPanel from '@/features/atlas2026/singlepane/components/SupervisorCompetencyPanel'
import type { AtlasRole, CountyHeatPoint, EnrollmentRequestRecord, SupervisorNavigatorCompetencySummary } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface ContextPanelsProps {
  role: AtlasRole
  activeMenu: string
  enrollmentRequests: EnrollmentRequestRecord[]
  countyHeatmap: CountyHeatPoint[]
  supervisorNavigatorCompetency: SupervisorNavigatorCompetencySummary[]
}

export default function ContextPanels({ role, activeMenu, enrollmentRequests, countyHeatmap, supervisorNavigatorCompetency }: ContextPanelsProps) {
  if (activeMenu === 'requests to enroll') {
    return (
      <div className="w-full rounded-2xl border px-4 py-3" style={{ borderColor: '#ffffff50' }}>
        <small className="mb-2 block text-[13px] text-white">requests to enroll</small>
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
    return <CountyCommonsHeatmap points={countyHeatmap} />
  }

  if (role === 'supervisor' && (activeMenu === 'navigator assessments' || activeMenu === 'assigned navigators')) {
    return <SupervisorCompetencyPanel competencyByNavigator={supervisorNavigatorCompetency} />
  }

  if (activeMenu === 'referral portal') {
    return (
      <div className="space-y-2">
        <AtlasTextLink
          href="https://apps.apple.com/us/app/atlas-information-exchange/id6746423572"
          target="_blank"
          rel="noreferrer"
          className="inline-flex px-4 py-2 text-[13px] text-white"
          style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
        >
          open atlas referral portal
        </AtlasTextLink>
        <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
          referral portal is currently an external handoff with no in-shell write actions.
        </small>
      </div>
    )
  }

  return null
}
