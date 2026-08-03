import type {
  EnrolleeProfile,
  NavigatorEnrollmentAssignmentRecord,
  UnassignedEnrolleePickupRecord
} from '@/features/atlas2026/shared/contracts'
import { derivePickupQueueParentCodes } from '@/features/atlas2026/singlepane/domain/phaseAndZCodes'

// Builds a minimal, display-only enrollee profile from an assignment-board row so a freshly
// self-assigned enrollee can appear in the navigator's dropdown immediately (optimistic User Interface (UI)),
// before the database-synced roster reload returns. Only fields the dropdown renders are
// populated; the authoritative record (with z-codes, dob, etc.) replaces it on sync via id match.
export function buildOptimisticEnrolleeFromAssignmentRow(row: NavigatorEnrollmentAssignmentRecord): EnrolleeProfile {
  return {
    id: row.enrolleeId,
    enrollmentId: row.enrollmentId,
    fullName: row.enrolleeName,
    dob: '',
    caseId: row.caseId,
    email: '',
    assignedNavigator: '',
    zCodeTags: [],
    activeZCodeDetails: [],
    completedParentCodes: [],
    currentPhase: row.currentPhase
  }
}
export type NavigatorEnrollmentAssignmentAction = 'accept' | 'archive' | 'assign' | 'unassign'

export function isPickupEnrollmentRow(enrollmentId: string) {
  return enrollmentId.startsWith('pickup:')
}

export function getPickupRecordIdFromEnrollmentId(enrollmentId: string) {
  return isPickupEnrollmentRow(enrollmentId) ? enrollmentId.slice('pickup:'.length).trim() : ''
}

export function buildPendingReferralAssignmentRows(
  pickupQueue: UnassignedEnrolleePickupRecord[],
  enrollmentRows: NavigatorEnrollmentAssignmentRecord[]
) {
  const existingCaseIds = new Set(
    enrollmentRows
      .map((row) => row.caseId.trim().toLowerCase())
      .filter(Boolean)
  )
  const existingNameKeys = new Set(
    enrollmentRows
      .map((row) => row.enrolleeName.trim().toLowerCase())
      .filter(Boolean)
  )

  return pickupQueue
    .filter((record) => record.status !== 'archived')
    .filter((record) => {
      const caseKey = record.caseId.trim().toLowerCase()
      if (caseKey && existingCaseIds.has(caseKey)) return false
      const nameKey = record.fullName.trim().toLowerCase()
      if (!caseKey && nameKey && existingNameKeys.has(nameKey)) return false
      return true
    })
    .map<NavigatorEnrollmentAssignmentRecord>((record) => ({
      enrollmentId: `pickup:${record.id}`,
      enrolleeId: `pickup:${record.id}`,
      enrolleeName: record.fullName || 'pending referral',
      caseId: record.caseId || 'case id pending',
      assignedNavigatorLabel:
        record.status === 'claimed'
          ? 'claimed'
          : record.status === 'accepted'
          ? 'accepted'
          : record.status === 'archived'
            ? 'archived'
            : 'pending intake',
      navigatorAssignmentCount: 0,
      assignedNavigatorNames: [],
      zCodeParentCodes: derivePickupQueueParentCodes(record.zCodeTags),
      isAssignedToAnyNavigator: false,
      isAssignedToViewer: false,
      isActionable: record.status === 'accepted',
      statusNote:
        record.status === 'claimed'
          ? 'marked claimed in intake queue; enrollee/enrollment rows are created when referral sync completes'
          : record.status === 'accepted'
            ? 'accepted referral; ready to be claimed by a navigator'
          : record.status === 'archived'
            ? 'archived referral'
            : 'submitted via referral form; accept or archive before assignment',
      pickupStatus: record.status,
      pickupRecordId: record.id
    }))
}
