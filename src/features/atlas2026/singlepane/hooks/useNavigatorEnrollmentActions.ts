import { useCallback, type Dispatch, type SetStateAction } from 'react'

import type {
  EnrolleeProfile,
  NavigatorEnrollmentAssignmentRecord
} from '@/features/atlas2026/shared/contracts'
import {
  assignNavigatorEnrollmentToSelf as persistAssignNavigatorEnrollmentToSelf,
  unassignNavigatorEnrollmentFromSelf as persistUnassignNavigatorEnrollmentFromSelf
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import {
  buildOptimisticEnrolleeFromAssignmentRow,
  getPickupRecordIdFromEnrollmentId,
  type NavigatorEnrollmentAssignmentAction
} from '@/features/atlas2026/singlepane/domain/enrollmentPickup'

interface UseNavigatorEnrollmentActionsInput {
  viewerCanUseAssignmentActions: boolean
  navigatorEnrollmentAssignments: NavigatorEnrollmentAssignmentRecord[]
  enrollees: EnrolleeProfile[]
  setAssigningNavigatorEnrollmentId: Dispatch<SetStateAction<string | null>>
  setNavigatorEnrollmentAssignmentsError: Dispatch<SetStateAction<string | null>>
  setPendingAssignmentEnrollees: Dispatch<SetStateAction<EnrolleeProfile[]>>
  updatePickupQueueStatus: (
    recordId: string,
    status: 'available' | 'accepted' | 'claimed' | 'archived'
  ) => Promise<unknown>
  claimPickupQueueRecord: (recordId: string) => Promise<unknown>
  refreshAssignmentParityViews: () => Promise<void>
}

/**
 * Coordinates navigator enrollment assignment and referral-queue actions.
 */
export function useNavigatorEnrollmentActions({
  viewerCanUseAssignmentActions,
  navigatorEnrollmentAssignments,
  enrollees,
  setAssigningNavigatorEnrollmentId,
  setNavigatorEnrollmentAssignmentsError,
  setPendingAssignmentEnrollees,
  updatePickupQueueStatus,
  claimPickupQueueRecord,
  refreshAssignmentParityViews
}: UseNavigatorEnrollmentActionsInput) {
  const assignNavigatorEnrollmentToSelf = useCallback(
    async (
      enrollmentId: string,
      mode: NavigatorEnrollmentAssignmentAction = 'assign'
    ) => {
      if (!viewerCanUseAssignmentActions) {
        setNavigatorEnrollmentAssignmentsError('Assignment actions are disabled by admin policy for this account.')
        return
      }
      const pickupRecordId = getPickupRecordIdFromEnrollmentId(enrollmentId)
      setAssigningNavigatorEnrollmentId(enrollmentId)
      setNavigatorEnrollmentAssignmentsError(null)
      // Optimistic User Interface (UI) feedback keeps the enrollee visible while the
      // database-synced roster catches up; failures roll this placeholder back below.
      let optimisticEnrolleeId: string | null = null
      if (mode === 'assign') {
        const assignmentRow = navigatorEnrollmentAssignments.find((row) => row.enrollmentId === enrollmentId)
        if (assignmentRow?.enrolleeId && !enrollees.some((enrollee) => enrollee.id === assignmentRow.enrolleeId)) {
          optimisticEnrolleeId = assignmentRow.enrolleeId
          const optimisticEnrollee = buildOptimisticEnrolleeFromAssignmentRow(assignmentRow)
          setPendingAssignmentEnrollees((current) =>
            current.some((pending) => pending.id === optimisticEnrollee.id)
              ? current
              : [...current, optimisticEnrollee]
          )
        }
      }
      const actionLabel =
        mode === 'unassign'
          ? 'Unassign failed'
          : mode === 'archive'
            ? 'Archive failed'
            : mode === 'accept'
              ? 'Accept failed'
              : 'Claim failed'
      const actionErrorPrefix = `${actionLabel} for enrollment ${enrollmentId}.`

      try {
        if (mode === 'accept' || mode === 'archive') {
          if (!pickupRecordId) {
            throw new Error(
              'This referral is missing a queue identifier. Refresh the page or contact support if the problem continues.'
            )
          }
          await updatePickupQueueStatus(pickupRecordId, mode === 'accept' ? 'accepted' : 'archived')
        } else if (mode === 'unassign') {
          await persistUnassignNavigatorEnrollmentFromSelf(enrollmentId)
        } else if (pickupRecordId) {
          await claimPickupQueueRecord(pickupRecordId)
        } else {
          await persistAssignNavigatorEnrollmentToSelf(enrollmentId)
        }
        await refreshAssignmentParityViews()
        // Settle stale optimistic rows after replication lag; the normal roster-sync effect wins first.
        if (optimisticEnrolleeId) {
          const enrolleeIdToSettle = optimisticEnrolleeId
          window.setTimeout(() => {
            setPendingAssignmentEnrollees((current) =>
              current.filter((pending) => pending.id !== enrolleeIdToSettle)
            )
          }, 12000)
        }
      } catch (error) {
        if (optimisticEnrolleeId) {
          const enrolleeIdToRollback = optimisticEnrolleeId
          setPendingAssignmentEnrollees((current) =>
            current.filter((pending) => pending.id !== enrolleeIdToRollback)
          )
        }
        const databaseError = error as { code?: string; message?: string; details?: string; hint?: string } | null
        if (databaseError?.code === 'PGRST202') {
          // PostgREST reports PGRST202 when the required Remote Procedure Call (RPC) is not deployed.
          setNavigatorEnrollmentAssignmentsError(
            mode === 'unassign'
              ? 'Navigator self-unassignment RPC is not deployed yet. Apply the latest Supabase migrations and retry.'
              : mode === 'assign'
                ? 'Navigator self-assignment RPC is not deployed yet. Apply the latest Supabase migrations and retry.'
                : 'Referral queue workflow RPC is not deployed yet. Apply the latest Supabase migrations and retry.'
          )
          return
        }
        if (databaseError?.message) {
          const detailParts = [
            databaseError.message,
            databaseError.details ? `details: ${databaseError.details}` : '',
            databaseError.hint ? `hint: ${databaseError.hint}` : '',
            databaseError.code ? `code: ${databaseError.code}` : ''
          ].filter(Boolean)
          setNavigatorEnrollmentAssignmentsError(`${actionErrorPrefix} ${detailParts.join(' | ')}`)
          return
        }
        setNavigatorEnrollmentAssignmentsError(
          error instanceof Error && error.message.trim()
            ? `${actionErrorPrefix} ${error.message}`
            : mode === 'unassign'
              ? `${actionErrorPrefix} Unable to unassign enrollee from navigator.`
              : mode === 'archive'
                ? `${actionErrorPrefix} Unable to archive referral.`
                : mode === 'accept'
                  ? `${actionErrorPrefix} Unable to accept referral.`
                  : `${actionErrorPrefix} Unable to assign enrollee to navigator.`
        )
      } finally {
        setAssigningNavigatorEnrollmentId(null)
      }
    },
    [
      claimPickupQueueRecord,
      enrollees,
      navigatorEnrollmentAssignments,
      refreshAssignmentParityViews,
      setAssigningNavigatorEnrollmentId,
      setNavigatorEnrollmentAssignmentsError,
      setPendingAssignmentEnrollees,
      updatePickupQueueStatus,
      viewerCanUseAssignmentActions
    ]
  )

  return { assignNavigatorEnrollmentToSelf }
}
