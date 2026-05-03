import React from 'react'
import type { SupervisorNavigatorCompetencySummary } from '@/features/atlas2026/singlepane/types'

interface SupervisorCompetencyPanelProps {
  competencyByNavigator: SupervisorNavigatorCompetencySummary[]
}

export default function SupervisorCompetencyPanel({ competencyByNavigator }: SupervisorCompetencyPanelProps) {
  if (!competencyByNavigator.length) {
    return (
      <div className="w-full rounded-2xl border px-4 py-3" style={{ borderColor: '#ffffff50' }}>
        <small className="text-[13px] text-white">navigator assessments</small>
        <small className="mt-2 block text-[12px] text-[#cfcfcf]">No navigator assessments recorded yet.</small>
      </div>
    )
  }

  return (
    <div className="w-full rounded-2xl border px-4 py-3" style={{ borderColor: '#ffffff50' }}>
      <small className="mb-2 block text-[13px] text-white">assigned navigators competency</small>
      <small className="mb-3 block text-[11px] text-[#cfcfcf]">
        {/* Weighting is intentionally front-loaded so supervisors react to recent changes without discarding trend context. */}
        Rolling weighted average uses the last three assessments: 3x most recent, 2x previous, 1x third.
      </small>
      <div className="space-y-2">
        {competencyByNavigator.map((row) => (
          <div key={row.navigatorName} className="flex items-center justify-between rounded-md border px-2 py-1.5" style={{ borderColor: '#ffffff3a' }}>
            <div>
              <small className="block text-[12px] text-white">{row.navigatorName}</small>
              <small className="text-[11px] text-[#cfcfcf]">
                {row.assessmentCount} assessments
                {row.lastAssessmentAtIso ? ` • last ${new Date(row.lastAssessmentAtIso).toLocaleDateString()}` : ''}
              </small>
            </div>
            <small className="text-[12px] font-medium text-white">{row.weightedRollingAverage.toFixed(2)}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
