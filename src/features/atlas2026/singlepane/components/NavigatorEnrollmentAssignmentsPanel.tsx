import React from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import ZCodeBadge from '@/features/atlas2026/components/ZCodeBadge'
import type { NavigatorEnrollmentAssignmentRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface NavigatorEnrollmentAssignmentsPanelProps {
  rows: NavigatorEnrollmentAssignmentRecord[]
  isLoading: boolean
  error: string | null
  assigningEnrollmentId: string | null
  canViewNavigatorAssignmentNames: boolean
  canToggleAssignments: boolean
  onToggleAssignment: (
    enrollmentId: string,
    mode: 'accept' | 'archive' | 'assign' | 'unassign'
  ) => Promise<void> | void
}

export default function NavigatorEnrollmentAssignmentsPanel({
  rows,
  isLoading,
  error,
  assigningEnrollmentId,
  canViewNavigatorAssignmentNames,
  canToggleAssignments,
  onToggleAssignment
}: NavigatorEnrollmentAssignmentsPanelProps) {
  const [expandedEnrollmentIds, setExpandedEnrollmentIds] = React.useState<string[]>([])

  function toggleExpandedEnrollment(enrollmentId: string) {
    setExpandedEnrollmentIds((current) =>
      current.includes(enrollmentId) ? current.filter((value) => value !== enrollmentId) : [...current, enrollmentId]
    )
  }

  return (
    <div className="atlas-surface-panel w-full px-5 py-5 text-white" style={{ borderColor: '#ffffff50' }}>
      <small className="atlas-overline mb-2 block text-[#cfcfcf]">navigator assignment board</small>
      <small className="atlas-panel-copy mb-4 block max-w-[780px] text-[#cfcfcf]">
        Review current navigator ownership occupancy. You can still assign to yourself while multi-assignment is enabled.
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
                  {row.caseId || 'case id pending'} • assignment: {row.assignedNavigatorLabel}
                  {row.navigatorAssignmentCount > 0 ? ' • ' : ''}
                  {row.navigatorAssignmentCount > 0 ? (
                    canViewNavigatorAssignmentNames ? (
                      <button
                        type="button"
                        className="inline-flex items-center text-[#9bd4a5] underline-offset-2 hover:underline"
                        onClick={() => toggleExpandedEnrollment(row.enrollmentId)}
                        title="Toggle assigned navigator names."
                      >
                        [{row.navigatorAssignmentCount}] navigator{row.navigatorAssignmentCount === 1 ? '' : 's'}
                      </button>
                    ) : (
                      <span className="text-[#9ea8b4]">
                        [{row.navigatorAssignmentCount}] navigator{row.navigatorAssignmentCount === 1 ? '' : 's'}
                      </span>
                    )
                  ) : null}
                </small>
                <small className="atlas-caption mt-2 block text-[#9bd4a5]">
                  {row.statusNote || (row.isAssignedToViewer
                    ? 'assigned to you'
                    : row.isAssignedToAnyNavigator
                      ? 'already assigned to a navigator'
                      : 'not yet assigned')}
                </small>
                {canViewNavigatorAssignmentNames &&
                expandedEnrollmentIds.includes(row.enrollmentId) &&
                row.assignedNavigatorNames.length ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {row.assignedNavigatorNames.map((name) => (
                      <span
                        key={`${row.enrollmentId}:${name}`}
                        className="inline-flex rounded-full border px-2.5 py-1 text-[11px] text-white"
                        style={{ borderColor: '#ffffff40' }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {row.zCodeParentCodes.length ? (
                    row.zCodeParentCodes.slice(0, 6).map((parentCode) => (
                      <ZCodeBadge
                        key={`${row.enrollmentId}-${parentCode}`}
                        value={parentCode}
                        fill={getZCodeParentColor(parentCode) || SP_COLORS.white}
                        size="mobile"
                        stripLeadingZ
                      />
                    ))
                  ) : (
                    <small className="atlas-caption text-[#9ea8b4]">no z-code coins yet</small>
                  )}
                  {row.zCodeParentCodes.length > 6 ? (
                    <span className="inline-flex h-7 min-w-[2.1rem] items-center justify-center rounded-full border px-2 text-[11px] text-white" style={{ borderColor: '#ffffff40' }}>
                      +{row.zCodeParentCodes.length - 6}
                    </span>
                  ) : null}
                </div>
              </div>
              {row.pickupStatus === 'available' ? (
                <div className="flex items-center gap-2">
                  <AtlasTextButton
                    onClick={() => void onToggleAssignment(row.enrollmentId, 'archive')}
                    disabled={!canToggleAssignments || assigningEnrollmentId === row.enrollmentId}
                    className="px-[14px] py-[8px] text-[14px] font-medium text-white"
                    style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
                  >
                    {assigningEnrollmentId === row.enrollmentId ? 'archiving...' : 'archive'}
                  </AtlasTextButton>
                  <AtlasTextButton
                    onClick={() => void onToggleAssignment(row.enrollmentId, 'accept')}
                    disabled={!canToggleAssignments || assigningEnrollmentId === row.enrollmentId}
                    className="px-[19px] py-[10px] text-[15px] font-medium text-white"
                    style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
                  >
                    {assigningEnrollmentId === row.enrollmentId ? 'accepting...' : 'accept'}
                  </AtlasTextButton>
                </div>
              ) : row.pickupStatus === 'accepted' ? (
                <AtlasTextButton
                  onClick={() => void onToggleAssignment(row.enrollmentId, 'assign')}
                  disabled={!canToggleAssignments || assigningEnrollmentId === row.enrollmentId}
                  className="px-[19px] py-[10px] text-[15px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
                >
                  {assigningEnrollmentId === row.enrollmentId ? 'claiming...' : 'assign to me'}
                </AtlasTextButton>
              ) : row.pickupStatus === 'claimed' ? (
                <AtlasTextButton
                  disabled
                  className="px-[19px] py-[10px] text-[15px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff20', opacity: 0.45 } as React.CSSProperties}
                >
                  claimed
                </AtlasTextButton>
              ) : row.pickupStatus === 'archived' ? (
                <AtlasTextButton
                  disabled
                  className="px-[19px] py-[10px] text-[15px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff20', opacity: 0.45 } as React.CSSProperties}
                >
                  archived
                </AtlasTextButton>
              ) : (
                <AtlasTextButton
                  onClick={() => {
                    if (row.isActionable === false) return
                    void onToggleAssignment(row.enrollmentId, row.isAssignedToViewer ? 'unassign' : 'assign')
                  }}
                  disabled={!canToggleAssignments || row.isActionable === false || assigningEnrollmentId === row.enrollmentId}
                  className="px-[19px] py-[10px] text-[15px] font-medium text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
                >
                  {!canToggleAssignments
                    ? 'action disabled by policy'
                    : assigningEnrollmentId === row.enrollmentId
                    ? row.isAssignedToViewer
                      ? 'unassigning...'
                      : 'assigning...'
                    : row.isAssignedToViewer
                      ? 'unassign me'
                      : 'assign to me'}
                </AtlasTextButton>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="atlas-empty-state">No enrollment records found.</div>
      )}
    </div>
  )
}
