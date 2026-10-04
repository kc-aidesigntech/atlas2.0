import React from 'react'
import type { SupervisorTeamNavigator } from '@/features/atlas2026/singlepane/domain/supervisorTeamBurden'

interface SupervisorTeamBurdenPanelProps {
  navigators: SupervisorTeamNavigator[]
  enrolleeCount: number
  entryCount: number
}

export default function SupervisorTeamBurdenPanel({ navigators, enrolleeCount, entryCount }: SupervisorTeamBurdenPanelProps) {
  return (
    <div className="atlas-surface-panel w-full px-5 py-4">
      <div className="atlas-h3 text-[34px] font-medium leading-[1.1] text-white">my team</div>
      <small className="mt-2 block text-[13px] text-[#9eacb9]">
        {navigators.length} navigator{navigators.length === 1 ? '' : 's'} · {enrolleeCount} enrollee{enrolleeCount === 1 ? '' : 's'} · {entryCount} strip {entryCount === 1 ? 'entry' : 'entries'}
      </small>
      <div className="mt-4 space-y-2">
        {navigators.map((navigator) => (
          <div key={navigator.navigatorPersonId} className="flex items-center justify-between rounded-md border px-3 py-2" style={{ borderColor: '#ffffff3a' }}>
            <small className="text-[13px] text-white">{navigator.navigatorName}</small>
            <small className="text-[12px] text-[#cfcfcf]">
              {navigator.assignedEnrolleeCount} enrollee{navigator.assignedEnrolleeCount === 1 ? '' : 's'}
            </small>
          </div>
        ))}
        {!navigators.length ? (
          <small className="block text-[13px] text-[#cfcfcf]">No navigators are assigned to you yet, so there is no team burden to show.</small>
        ) : null}
      </div>
    </div>
  )
}
