import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { NavigatorEnrollmentAssignmentRecord } from '@/features/atlas2026/singlepane/types'

interface NavigatorEnrollmentAssignmentsPanelProps {
  rows: NavigatorEnrollmentAssignmentRecord[]
  isLoading: boolean
  error: string | null
  assigningEnrollmentId: string | null
  onToggleAssignment: (enrollmentId: string, mode: 'assign' | 'unassign') => Promise<void> | void
}

export default function NavigatorEnrollmentAssignmentsPanel({
  rows,
  isLoading,
  error,
  assigningEnrollmentId,
  onToggleAssignment
}: NavigatorEnrollmentAssignmentsPanelProps) {
  return (
    <div className="atlas-surface-panel w-full px-5 py-5 text-white" style={{ borderColor: '#ffffff50' }}>
      <small className="atlas-overline mb-2 block text-[#cfcfcf]">navigator assignment board</small>
      <small className="atlas-panel-copy mb-4 block max-w-[780px] text-[#cfcfcf]">
        Review current navigator ownership. Assign unassigned enrollees to yourself or remove your assignment as needed.
      </small>
      {error ? <small className="atlas-caption mb-4 block text-[#ff7d7d]">{error}</small> : null}
      {isLoading ? (
        <small className="atlas-caption block text-[#cfcfcf]">Loading navigator assignment board...</small>
      ) : rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.enrollmentId}
              className="atlas-surface-raised flex flex-wrap items-center justify-between gap-3 px-4 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="atlas-h4 truncate text-[20px] font-medium text-white">{row.enrolleeName}</div>
                <small className="atlas-meta-muted mt-1 block text-[#cfcfcf]">
                  {row.caseId || 'case id pending'} • navigator: {row.assignedNavigatorLabel}
                </small>
                <small className="atlas-caption mt-2 block text-[#9bd4a5]">
                  {row.isAssignedToViewer ? 'assigned to you' : 'not assigned to you'}
                </small>
              </div>
              <AtlasTextButton
                onClick={() => void onToggleAssignment(row.enrollmentId, row.isAssignedToViewer ? 'unassign' : 'assign')}
                disabled={assigningEnrollmentId === row.enrollmentId}
                className="px-[19px] py-[10px] text-[15px] font-medium text-white"
                style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
              >
                {assigningEnrollmentId === row.enrollmentId
                  ? row.isAssignedToViewer
                    ? 'unassigning...'
                    : 'assigning...'
                  : row.isAssignedToViewer
                    ? 'unassign me'
                    : 'assign to me'}
              </AtlasTextButton>
            </div>
          ))}
        </div>
      ) : (
        <div className="atlas-empty-state">No enrollment records found.</div>
      )}
    </div>
  )
}
