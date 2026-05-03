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
    <div className="w-full rounded-2xl border px-4 py-3" style={{ borderColor: '#ffffff50' }}>
      <small className="mb-2 block text-[13px] text-white">navigator assignment board</small>
      <small className="mb-3 block text-[11px] text-[#cfcfcf]">
        Review current navigator ownership. Assign unassigned enrollees to yourself or remove your assignment as needed.
      </small>
      {error ? <small className="mb-3 block text-[12px] text-[#ff7d7d]">{error}</small> : null}
      {isLoading ? (
        <small className="block text-[12px] text-[#cfcfcf]">Loading navigator assignment board...</small>
      ) : rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.enrollmentId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5"
              style={{ borderColor: '#ffffff3a' }}
            >
              <div>
                <small className="block text-[12px] text-white">{row.enrolleeName}</small>
                <small className="text-[11px] text-[#cfcfcf]">
                  {row.caseId || 'case id pending'} • navigator: {row.assignedNavigatorLabel}
                </small>
                <small className="mt-0.5 block text-[11px] text-[#9bd4a5]">
                  {row.isAssignedToViewer ? 'assigned to you' : 'not assigned to you'}
                </small>
              </div>
              <AtlasTextButton
                onClick={() => void onToggleAssignment(row.enrollmentId, row.isAssignedToViewer ? 'unassign' : 'assign')}
                disabled={assigningEnrollmentId === row.enrollmentId}
                className="px-3 py-1 text-[11px] font-medium text-white"
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
        <small className="block text-[12px] text-[#cfcfcf]">No enrollment records found.</small>
      )}
    </div>
  )
}
