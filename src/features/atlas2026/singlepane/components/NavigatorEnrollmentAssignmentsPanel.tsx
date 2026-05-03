import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { NavigatorEnrollmentAssignmentRecord } from '@/features/atlas2026/singlepane/types'

interface NavigatorEnrollmentAssignmentsPanelProps {
  rows: NavigatorEnrollmentAssignmentRecord[]
  isLoading: boolean
  error: string | null
  assigningEnrollmentId: string | null
  onAssignToSelf: (enrollmentId: string) => Promise<void> | void
}

export default function NavigatorEnrollmentAssignmentsPanel({
  rows,
  isLoading,
  error,
  assigningEnrollmentId,
  onAssignToSelf
}: NavigatorEnrollmentAssignmentsPanelProps) {
  return (
    <div className="w-full rounded-2xl border px-4 py-3" style={{ borderColor: '#ffffff50' }}>
      <small className="mb-2 block text-[13px] text-white">navigator assignment board</small>
      <small className="mb-3 block text-[11px] text-[#cfcfcf]">
        Review current navigator ownership and assign any enrollee to yourself.
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
              </div>
              <AtlasTextButton
                onClick={() => void onAssignToSelf(row.enrollmentId)}
                disabled={row.isAssignedToViewer || assigningEnrollmentId === row.enrollmentId}
                className="px-3 py-1 text-[11px] font-medium text-white"
                style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
              >
                {row.isAssignedToViewer ? 'assigned to me' : assigningEnrollmentId === row.enrollmentId ? 'assigning...' : 'assign to me'}
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
