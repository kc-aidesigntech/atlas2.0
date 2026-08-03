import React from 'react'
import { CalendarDays } from 'lucide-react'
import { AtlasIconButton } from '@/features/atlas2026/components/AtlasPrimitives'
import AtlasImageUploadTile from '@/features/atlas2026/components/AtlasImageUploadTile'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  AccountSettings,
  NavigatorEnrollmentAssignmentRecord
} from '@/features/atlas2026/shared/contracts'
import NavigatorEnrollmentAssignmentsPanel from '../NavigatorEnrollmentAssignmentsPanel'
import { ACTIVE_NAVIGATOR_PROFILE_CARDS } from './model'

interface NavigatorProfileOverviewProps {
  accountSettings: AccountSettings
  displayName: string
  fallbackAvatar: string
  assignedEnrolleeCount: number
  openReviewCount: number
  programError: string | null
  assignmentBoardRef: React.RefObject<HTMLElement | null>
  assignments: NavigatorEnrollmentAssignmentRecord[]
  assignmentsError: string | null
  isLoadingAssignments: boolean
  assigningEnrollmentId: string | null
  canViewAssignmentNames: boolean
  canToggleAssignments: boolean
  canOpenReferral: boolean
  isUploadingAvatar: boolean
  avatarUploadError: string | null
  onReplaceAvatar?: (file: File) => Promise<unknown> | unknown
  onOpenReviewQueue: () => void
  onOpenReferral?: () => void
  onToggleAssignment: (enrollmentId: string, mode: 'accept' | 'archive' | 'assign' | 'unassign') => Promise<void> | void
}

export default function NavigatorProfileOverview({
  accountSettings,
  displayName,
  fallbackAvatar,
  assignedEnrolleeCount,
  openReviewCount,
  programError,
  assignmentBoardRef,
  assignments,
  assignmentsError,
  isLoadingAssignments,
  assigningEnrollmentId,
  canViewAssignmentNames,
  canToggleAssignments,
  canOpenReferral,
  isUploadingAvatar,
  avatarUploadError,
  onReplaceAvatar,
  onOpenReviewQueue,
  onOpenReferral,
  onToggleAssignment
}: NavigatorProfileOverviewProps) {
  return (
    <div className="atlas-surface-panel relative flex h-full min-h-0 w-full flex-1 flex-col px-5 py-4">
      {openReviewCount ? (
        <div className="absolute right-4 top-4 z-10">
          <AtlasIconButton
            onClick={onOpenReviewQueue}
            aria-label={`Open required weekly regulation review (${openReviewCount} due)`}
            title="Required weekly regulation review"
            className="relative h-12 w-12 min-h-[48px] min-w-[48px] text-white"
            style={{ ['--button-border-color' as const]: '#ffffff3d', color: SP_COLORS.white } as React.CSSProperties}
          >
            <CalendarDays size={24} strokeWidth={2} aria-hidden="true" />
            <span
              className="atlas-regulation-review-badge absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SP_COLORS.red }}
              aria-hidden="true"
            />
          </AtlasIconButton>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
        <AtlasImageUploadTile
          imageSrc={accountSettings.avatarUrl || fallbackAvatar}
          alt={`${displayName} profile`}
          onSelectFile={onReplaceAvatar}
          disabled={!onReplaceAvatar}
          buttonTitle={onReplaceAvatar ? 'Replace profile image' : 'Profile image upload unavailable'}
          statusText={isUploadingAvatar ? 'uploading image...' : null}
          errorText={avatarUploadError}
          onImageError={(event) => {
            if (event.currentTarget.src !== fallbackAvatar) event.currentTarget.src = fallbackAvatar
          }}
        />
        <div className="min-w-[220px] flex-1 space-y-0.5 pr-14 pt-[2px] text-white" style={{ textTransform: 'none' }}>
          <h2 className="atlas-h3 text-[34px] font-medium leading-[1.1]" style={{ textTransform: 'none' }}>
            {displayName}
          </h2>
          <small className="atlas-meta block text-white">Role: navigator</small>
          <small className="atlas-meta block text-white">Org: {accountSettings.organization || 'not recorded'}</small>
          <small className="atlas-meta block text-white" style={{ textTransform: 'none' }}>
            E: {accountSettings.email || 'not recorded'}
          </small>
          <small className="atlas-meta block text-white">Assigned enrollees: {assignedEnrolleeCount}</small>
          <small className="atlas-meta block text-white">Active sections: {ACTIVE_NAVIGATOR_PROFILE_CARDS.length}</small>
        </div>
      </div>
      {programError ? (
        <div
          className="mt-3 rounded-[14px] border px-3 py-2 text-[12px]"
          style={{ borderColor: `${SP_COLORS.red}80`, color: SP_COLORS.red }}
        >
          {programError}
        </div>
      ) : null}
      {/* Assignment board fills remaining pane height so the rail can stretch even with this surface. */}
      <section ref={assignmentBoardRef} className="mt-4 flex-1">
        <div className="mb-3">
          <small className="atlas-overline block text-[#9eacb9]">navigator workflow</small>
          <div className="text-[18px] font-medium text-white">enrollment assignment board</div>
        </div>
        <NavigatorEnrollmentAssignmentsPanel
          rows={assignments}
          isLoading={isLoadingAssignments}
          error={assignmentsError}
          assigningEnrollmentId={assigningEnrollmentId}
          canViewNavigatorAssignmentNames={canViewAssignmentNames}
          canToggleAssignments={canToggleAssignments}
          canOpenReferralComposer={canOpenReferral}
          onOpenReferralComposer={onOpenReferral}
          onToggleAssignment={onToggleAssignment}
        />
      </section>
    </div>
  )
}
