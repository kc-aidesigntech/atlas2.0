import type { Dispatch, SetStateAction } from 'react'
import type {
  AccountSettings,
  AtlasRole,
  IntervalAssessmentRule,
  IpsCompetencySelfAssessmentRecord,
  IpsccEncounterSubmissionRecord,
  NavigatorProgramState,
  NavigatorSelfAssessmentRecord,
  PartnerReferralSubmissionInput,
  PartnerStationProfile,
  SupervisionSessionRecord,
  SupervisorIpsAssessmentRecord,
  UnassignedEnrolleePickupRecord
} from '@/features/atlas2026/shared/contracts'
import {
  assignNavigatorEnrollmentToSelf as persistAssignNavigatorEnrollmentToSelf,
  materializeClaimedReferralIntoEnrollment,
  saveNavigatorIpsSelfAssessment as persistNavigatorIpsSelfAssessment,
  saveNavigatorIpsccEncounterSubmission as persistNavigatorIpsccEncounterSubmission,
  saveNavigatorProgramState as persistNavigatorProgramState,
  saveSupervisorIpsAssessment as persistSupervisorIpsAssessment,
  upsertEnrollmentInferredZCodes
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import {
  enqueuePublicReferralQueueRecord,
  loadPublicReferralQueueRecords,
  setPublicReferralQueueRecordStatus
} from '@/features/atlas2026/singlepane/data-access/publicReferralRepository'
import { buildReferralQueueUpdate } from '@/features/atlas2026/singlepane/referralWorkflowUtils'
import { inferZCodesForReferral } from '@/services/atlas2026/inferZCodesService'

type EnsureWriteAllowed = (
  actionKey: 'navigatorProgram.write' | 'partnerReferral.submit',
  actionLabel: string
) => void

interface UsePickupQueueActionsInput {
  role: AtlasRole
  accountSettings: AccountSettings
  effectiveAccountSettings: AccountSettings
  effectivePartnerStationProfile: PartnerStationProfile | null
  currentNavigatorName: string
  mergedNavigatorProgramState: NavigatorProgramState
  setNavigatorProgramState: Dispatch<SetStateAction<NavigatorProgramState>>
  setNavigatorProgramError: Dispatch<SetStateAction<string | null>>
  setPublicQueueRecords: Dispatch<SetStateAction<UnassignedEnrolleePickupRecord[]>>
  ensureWriteAllowed: EnsureWriteAllowed
  ensureRegulationReviewSettingForEnrollee: (enrolleeId: string, fullName: string) => Promise<unknown>
  refreshAssignmentParityViews: () => Promise<void>
}

/**
 * Coordinates referral queue claims with enrollment materialization and the
 * navigator program records that share the same persistence boundary.
 */
export function usePickupQueueActions({
  role,
  accountSettings,
  effectiveAccountSettings,
  effectivePartnerStationProfile,
  currentNavigatorName,
  mergedNavigatorProgramState,
  setNavigatorProgramState,
  setNavigatorProgramError,
  setPublicQueueRecords,
  ensureWriteAllowed,
  ensureRegulationReviewSettingForEnrollee,
  refreshAssignmentParityViews
}: UsePickupQueueActionsInput) {
  async function saveNavigatorProgramState(state: NavigatorProgramState) {
    ensureWriteAllowed('navigatorProgram.write', 'save navigator program state')
    setNavigatorProgramError(null)
    try {
      const saved = await persistNavigatorProgramState(state)
      setNavigatorProgramState(saved)
      return saved
    } catch (error) {
      setNavigatorProgramError(error instanceof Error ? error.message : 'Unable to save navigator program state.')
      throw error
    }
  }

  async function updatePickupQueueStatus(
    recordId: string,
    status: 'available' | 'accepted' | 'claimed' | 'archived'
  ) {
    ensureWriteAllowed('navigatorProgram.write', 'update referral queue status')
    const trimmedId = recordId.trim()
    if (!trimmedId) throw new Error('Missing referral queue record id.')
    if (!mergedNavigatorProgramState.pickupQueue.some((record) => record.id === trimmedId)) {
      throw new Error(`No referral queue row with id "${trimmedId}" is loaded. Refresh the assignment board and try again.`)
    }
    const saved = await setPublicReferralQueueRecordStatus(trimmedId, status, {
      claimedByNavigatorName: status === 'claimed' ? currentNavigatorName : null
    })
    setPublicQueueRecords((current) => [saved, ...current.filter((record) => record.id !== saved.id)])
    return saved
  }

  async function claimPickupQueueRecord(recordId: string) {
    ensureWriteAllowed('navigatorProgram.write', 'claim referral queue records')
    const claimedRecord = mergedNavigatorProgramState.pickupQueue.find((record) => record.id === recordId) || null
    if (!claimedRecord) {
      throw new Error('Unable to claim this referral because it is no longer available in your queue view.')
    }
    const materialized = await materializeClaimedReferralIntoEnrollment(claimedRecord)
    if (!materialized?.enrollmentId) {
      throw new Error('Unable to claim this referral because no enrollment record was materialized.')
    }
    // Claim, explicit navigator assignment, and mandatory regulation review stay coupled.
    await persistAssignNavigatorEnrollmentToSelf(materialized.enrollmentId)
    await ensureRegulationReviewSettingForEnrollee(materialized.enrolleeId, materialized.enrolleeName)
    try {
      const inferred = await inferZCodesForReferral({
        fullName: claimedRecord.fullName,
        situationCategories: claimedRecord.zCodeTags,
        backgroundNotes: claimedRecord.backgroundNotes,
        referrerMessage: claimedRecord.referrerMessage
      })
      await upsertEnrollmentInferredZCodes(materialized.enrollmentId, inferred.zCodes)
    } catch (error) {
      // Inference enrichment is optional; the canonical claim must remain usable when it fails.
      console.warn('Unable to enrich claimed referral with inferred z-codes.', error)
    }
    const saved = await updatePickupQueueStatus(recordId, 'claimed')
    await refreshAssignmentParityViews()
    return saved
  }

  async function saveNavigatorSelfAssessment(record: NavigatorSelfAssessmentRecord) {
    return saveNavigatorProgramState({
      ...mergedNavigatorProgramState,
      selfAssessments: [
        record,
        ...mergedNavigatorProgramState.selfAssessments.filter((item) => item.id !== record.id)
      ]
    })
  }

  async function saveNavigatorIpsSelfAssessment(record: IpsCompetencySelfAssessmentRecord) {
    ensureWriteAllowed('navigatorProgram.write', 'save Intentional Peer Support self-assessments')
    const saved = await persistNavigatorIpsSelfAssessment(record)
    return saveNavigatorProgramState({
      ...mergedNavigatorProgramState,
      ipsSelfAssessments: [
        saved,
        ...mergedNavigatorProgramState.ipsSelfAssessments.filter((item) => item.id !== saved.id)
      ]
    })
  }

  async function saveSupervisorIpsAssessment(record: SupervisorIpsAssessmentRecord) {
    ensureWriteAllowed('navigatorProgram.write', 'save supervisor Intentional Peer Support assessments')
    const saved = await persistSupervisorIpsAssessment(record)
    return saveNavigatorProgramState({
      ...mergedNavigatorProgramState,
      supervisorIpsAssessments: [
        saved,
        ...mergedNavigatorProgramState.supervisorIpsAssessments.filter((item) => item.id !== saved.id)
      ]
    })
  }

  async function saveNavigatorIpsccEncounterSubmission(record: IpsccEncounterSubmissionRecord) {
    ensureWriteAllowed('navigatorProgram.write', 'save Intentional Peer Support Core Competencies encounter submissions')
    const saved = await persistNavigatorIpsccEncounterSubmission(record)
    return saveNavigatorProgramState({
      ...mergedNavigatorProgramState,
      ipsccEncounterSubmissions: [
        saved,
        ...mergedNavigatorProgramState.ipsccEncounterSubmissions.filter((item) => item.id !== saved.id)
      ]
    })
  }

  async function saveSupervisionSession(record: SupervisionSessionRecord) {
    return saveNavigatorProgramState({
      ...mergedNavigatorProgramState,
      supervisionSessions: [
        record,
        ...mergedNavigatorProgramState.supervisionSessions.filter((item) => item.id !== record.id)
      ]
    })
  }

  async function saveIntervalAssessmentRule(rule: IntervalAssessmentRule) {
    return saveNavigatorProgramState({
      ...mergedNavigatorProgramState,
      intervalAssessmentRules: [
        rule,
        ...mergedNavigatorProgramState.intervalAssessmentRules.filter((item) => item.id !== rule.id)
      ]
    })
  }

  async function submitPartnerReferral(input: PartnerReferralSubmissionInput) {
    ensureWriteAllowed('partnerReferral.submit', 'submit partner referrals')
    const { nextRecord } = buildReferralQueueUpdate(input, mergedNavigatorProgramState, {
      accountFullName: accountSettings.fullName,
      accountOrganization: effectiveAccountSettings.organization,
      partnerStationOrganizationName: effectivePartnerStationProfile?.organizationName || null,
      actorRoleLabel: role,
      sourceLabel: 'single-pane referral portal'
    })
    await enqueuePublicReferralQueueRecord(nextRecord)
    setPublicQueueRecords(await loadPublicReferralQueueRecords())
    return nextRecord
  }

  return {
    saveNavigatorProgramState,
    updatePickupQueueStatus,
    claimPickupQueueRecord,
    saveNavigatorSelfAssessment,
    saveNavigatorIpsSelfAssessment,
    saveSupervisorIpsAssessment,
    saveNavigatorIpsccEncounterSubmission,
    saveSupervisionSession,
    saveIntervalAssessmentRule,
    submitPartnerReferral
  }
}
