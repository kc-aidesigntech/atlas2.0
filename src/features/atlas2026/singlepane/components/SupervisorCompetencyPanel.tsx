import React from 'react'
import type { SupervisorNavigatorCompetencySummary } from '@/features/atlas2026/singlepane/types'

interface SupervisorNavigatorDirectoryEntry {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

interface SupervisorCompetencyPanelProps {
  mode: 'assigned-navigators' | 'navigator-assessments'
  navigatorDirectory: SupervisorNavigatorDirectoryEntry[]
  onToggleManagedNavigator?: (navigatorPersonId: string, isManaged: boolean) => Promise<void> | void
  isSavingAssignments?: boolean
  competencyByNavigator: SupervisorNavigatorCompetencySummary[]
}

export default function SupervisorCompetencyPanel({
  mode,
  navigatorDirectory,
  onToggleManagedNavigator,
  isSavingAssignments = false,
  competencyByNavigator
}: SupervisorCompetencyPanelProps) {
  if (mode === 'assigned-navigators') {
    return (
      <div className="w-full rounded-2xl border px-4 py-3" style={{ borderColor: '#ffffff50' }}>
        <small className="mb-2 block text-[13px] text-white">assigned navigators</small>
        <small className="mb-3 block text-[11px] text-[#cfcfcf]">
          Manage which navigators roll up to you as supervisor.
        </small>
        {navigatorDirectory.length ? (
          <div className="space-y-2">
            {navigatorDirectory.map((row) => (
              <label
                key={row.navigatorPersonId}
                className="flex items-center justify-between rounded-md border px-2 py-1.5"
                style={{ borderColor: '#ffffff3a' }}
              >
                <div>
                  <small className="block text-[12px] text-white">{row.navigatorName}</small>
                  <small className="text-[11px] text-[#cfcfcf]">{row.assignedEnrolleeCount} assigned enrollees</small>
                </div>
                <input
                  type="checkbox"
                  checked={row.isManagedByCurrentSupervisor}
                  onChange={() => onToggleManagedNavigator?.(row.navigatorPersonId, !row.isManagedByCurrentSupervisor)}
                  className="h-4 w-4 accent-white"
                  disabled={isSavingAssignments}
                />
              </label>
            ))}
          </div>
        ) : (
          <small className="block text-[12px] text-[#cfcfcf]">No navigator identities are available yet.</small>
        )}
      </div>
    )
  }

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
