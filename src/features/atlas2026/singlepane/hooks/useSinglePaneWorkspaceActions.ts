import type { AccountSettings, EnrolleeIntakeRecord, EnrolleeZCodeOverrideInput, EnrolleeZCodeResolutionInput, NavigatorCompetencyAssessmentRecord, PartnerServiceCapacityDeletionReasonCode, RouteAssignmentRecord, RouteCandidateRecord, StabilizationPhase } from '@/features/atlas2026/shared/contracts'
import {
  deleteAdminServiceCapacitySubmission as deleteAdminServiceCapacitySubmissionRecord,
  invalidateJourneyStationMarkersCache,
  invalidateRouteCandidatesCache,
  loadAdminDeletableServiceCapacitySubmissions,
  loadPartnerStationProfile,
  loadZCodeDomainSurveyHistorySummary,
  overrideEnrolleeZCodes as persistEnrolleeZCodeOverride,
  saveAccountSettings as persistAccountSettings,
  saveEnrolleeIntake as persistEnrolleeIntake,
  saveNavigatorCompetencyAssessment as persistNavigatorCompetencyAssessment,
  saveRouteAssignment as persistRouteAssignment,
  setEnrolleeZCodeResolution as persistEnrolleeZCodeResolution,
  setZCodeDomainSurveyAnswerNullified,
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { toSupabaseErrorMessage } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { createDefaultTimelineConfig } from '@/features/atlas2026/singlepane/timelineConfigUtils'
import { buildCompletedParentCodes } from '@/features/atlas2026/singlepane/domain/phaseAndZCodes'

type WorkspaceActionContext = Record<string, any>

/**
 * Owns persistence commands and their optimistic workspace state reconciliation.
 */
export function useSinglePaneWorkspaceActions(context: WorkspaceActionContext) {
  const {
    remoteSession,
    role,
    viewerRole,
    partnerStationProfile,
    setBootstrapState,
    setRoleState,
    ensureWriteAllowed,
    ensureRegulationReviewSettingForEnrollee,
    selectedEnrollee,
    setIsLoadingZCodeDomainSurveyHistorySummary,
    setZCodeDomainSurveyHistoryError,
    setZCodeDomainSurveyHistorySummary,
    setIsLoadingAdminDeletableServiceCapacitySubmissions,
    setAdminServiceCapacityDeletionError,
    setAdminDeletableServiceCapacitySubmissions,
    ensureAdminPermissionWrite,
    setIsSavingZCodeDomainSurveyNullification,
    effectiveAccountSettings,
    setDeletingAdminServiceCapacitySubmissionId,
  } = context

  async function saveAccountSettings(nextSettings: AccountSettings) {
    if (remoteSession) {
      throw new Error('Exit troubleshooting mode before editing account settings.')
    }
    const enabledRoles = nextSettings.enabledRoles.length ? nextSettings.enabledRoles : [role]
    const finalSettings = { ...nextSettings, enabledRoles }
    try {
      const saved = await persistAccountSettings(finalSettings)
      // Keep navigator station context anchored to linked partner assignment rather than
      // transient account organization edits.
      const stationOrganizationName = viewerRole === 'navigator' ? partnerStationProfile?.organizationName?.trim() || saved.organization : saved.organization
      const stationProfile = await loadPartnerStationProfile(stationOrganizationName, {
        fullName: saved.fullName,
        email: saved.email,
      })
      setBootstrapState((current) => ({
        ...current,
        accountSettings: saved,
        partnerStationProfile: stationProfile,
      }))
      if (!saved.enabledRoles.includes(role)) {
        setRoleState(saved.enabledRoles[0] || 'navigator')
      }
    } catch (error) {
      console.warn('Failed to save account settings.', error)
    }
  }

  function saveEnrolleeIntake(nextIntake: EnrolleeIntakeRecord) {
    ensureWriteAllowed('intake.write', 'save enrollee intake')
    persistEnrolleeIntake(nextIntake).then((saved) => {
      // Forced regulation review: intake-added enrollees get the review enabled by default
      // (no-op for enrollees that already carry an explicit setting).
      void ensureRegulationReviewSettingForEnrollee(saved.enrolleeId, saved.fullName)
      setBootstrapState((current) => ({
        ...current,
        intakeFormsByEnrolleeId: {
          ...current.intakeFormsByEnrolleeId,
          [saved.enrolleeId]: saved,
        },
        enrollees: current.enrollees.map((enrollee) =>
          enrollee.id === saved.enrolleeId
            ? {
                ...enrollee,
                fullName: saved.fullName,
                dob: saved.dob,
                caseId: saved.caseId,
                email: saved.email,
                assignedNavigator: saved.assignedNavigator,
                zCodeTags: saved.zCodeTags,
              }
            : enrollee,
        ),
        timelineConfigsByEnrolleeId: {
          ...current.timelineConfigsByEnrolleeId,
          [saved.enrolleeId]: current.timelineConfigsByEnrolleeId[saved.enrolleeId] ? { ...current.timelineConfigsByEnrolleeId[saved.enrolleeId], planStartIso: saved.enrollmentStartIso } : createDefaultTimelineConfig(saved.enrollmentStartIso),
        },
      }))
    })
  }

  function saveRouteAssignment(candidate: RouteCandidateRecord, phase: StabilizationPhase) {
    ensureWriteAllowed('routeAssignment.write', 'save route assignments')
    if (!selectedEnrollee) return
    const assignment: RouteAssignmentRecord = {
      enrolleeId: selectedEnrollee.id,
      stationId: candidate.stationId,
      stationName: candidate.stationName,
      assignedAtIso: new Date().toISOString(),
      phase,
      matchedZCodes: candidate.matchedZCodes,
    }
    persistRouteAssignment(assignment).then((saved) => {
      setBootstrapState((current) => ({
        ...current,
        routeAssignmentsByEnrolleeId: {
          ...current.routeAssignmentsByEnrolleeId,
          [saved.enrolleeId]: saved,
        },
      }))
      invalidateJourneyStationMarkersCache(selectedEnrollee.enrollmentId)
      void refreshAssignmentParityViews()
    })
  }

  async function setEnrolleeZCodeResolution(enrolleeZCodeId: string, isResolved: boolean, input: EnrolleeZCodeResolutionInput = {}) {
    ensureWriteAllowed('zcodes.write', 'update z-code resolution')
    if (!selectedEnrollee || !enrolleeZCodeId) return null
    const saved = await persistEnrolleeZCodeResolution(enrolleeZCodeId, isResolved, input)
    setBootstrapState((current) => ({
      ...current,
      enrollees: current.enrollees.map((enrollee) => {
        if (enrollee.id !== selectedEnrollee.id) return enrollee
        const activeZCodeDetails = enrollee.activeZCodeDetails.map((detail) =>
          detail.enrolleeZCodeId === saved.enrolleeZCodeId
            ? {
                ...detail,
                isResolved: saved.isResolved,
                resolutionAt: saved.resolutionAt,
                resolutionPartnerId: saved.resolutionPartnerId ?? (saved.isResolved ? (input.partnerId ?? null) : null),
                resolutionPartnerName: saved.resolutionPartnerName ?? (saved.isResolved ? (input.partnerName ?? null) : null),
                resolutionNote: saved.resolutionNote ?? (saved.isResolved ? input.resolutionNote?.trim() || null : null),
                // Readiness criteria echo whatever the Remote Procedure Call
                // (RPC) persisted so pills stay in sync without a refetch.
                codeReviewStatus: saved.codeReviewStatus,
                confidenceLevel: saved.confidenceLevel,
              }
            : detail,
        )
        return {
          ...enrollee,
          activeZCodeDetails,
          completedParentCodes: buildCompletedParentCodes(activeZCodeDetails),
        }
      }),
    }))
    invalidateRouteCandidatesCache(selectedEnrollee.enrollmentId)
    return saved
  }

  async function overrideEnrolleeZCodes(enrollmentId: string, input: EnrolleeZCodeOverrideInput) {
    ensureWriteAllowed('zcodes.write', 'override z-codes')
    const trimmedEnrollmentId = enrollmentId.trim()
    if (!trimmedEnrollmentId) return null
    // The command RPC reconciles the active set atomically and returns the
    // refreshed active z-code payload, so state is replaced (not patched)
    // for the affected enrollment - keeping partner matching inputs exact.
    const saved = await persistEnrolleeZCodeOverride(trimmedEnrollmentId, input)
    if (!saved) return null
    setBootstrapState((current) => ({
      ...current,
      enrollees: current.enrollees.map((enrollee) => {
        if (enrollee.enrollmentId !== trimmedEnrollmentId) return enrollee
        return {
          ...enrollee,
          zCodeTags: saved.zCodeTags,
          activeZCodeDetails: saved.activeZCodeDetails,
          completedParentCodes: buildCompletedParentCodes(saved.activeZCodeDetails),
        }
      }),
    }))
    invalidateRouteCandidatesCache(trimmedEnrollmentId)
    return saved
  }

  async function reloadZCodeDomainSurveyHistory() {
    if (viewerRole !== 'administrator') return
    setIsLoadingZCodeDomainSurveyHistorySummary(true)
    setZCodeDomainSurveyHistoryError(null)
    try {
      const rows = await loadZCodeDomainSurveyHistorySummary()
      setZCodeDomainSurveyHistorySummary(rows)
    } catch (error) {
      setZCodeDomainSurveyHistoryError(error instanceof Error ? error.message : 'Unable to load z-code domain survey history.')
    } finally {
      setIsLoadingZCodeDomainSurveyHistorySummary(false)
    }
  }

  async function reloadAdminDeletableServiceCapacitySubmissions() {
    if (viewerRole !== 'administrator') return
    setIsLoadingAdminDeletableServiceCapacitySubmissions(true)
    setAdminServiceCapacityDeletionError(null)
    try {
      const rows = await loadAdminDeletableServiceCapacitySubmissions()
      setAdminDeletableServiceCapacitySubmissions(rows)
    } catch (error) {
      setAdminServiceCapacityDeletionError(toSupabaseErrorMessage(error, 'Unable to load deletable service capacity survey records.'))
    } finally {
      setIsLoadingAdminDeletableServiceCapacitySubmissions(false)
    }
  }

  async function setZCodeDomainSurveyAnswerNullification(input: { answerId: string; isNullified: boolean; nullifiedReason?: string | null }) {
    ensureAdminPermissionWrite('nullify z-code domain survey answers')
    setIsSavingZCodeDomainSurveyNullification(true)
    setZCodeDomainSurveyHistoryError(null)
    try {
      await setZCodeDomainSurveyAnswerNullified({
        answerId: input.answerId,
        isNullified: input.isNullified,
        nullifiedByEmail: effectiveAccountSettings.email || null,
        nullifiedReason: input.nullifiedReason || null,
      })
      await reloadZCodeDomainSurveyHistory()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update z-code survey answer nullification.'
      setZCodeDomainSurveyHistoryError(message)
      throw error
    } finally {
      setIsSavingZCodeDomainSurveyNullification(false)
    }
  }

  async function deleteAdminServiceCapacitySubmission(input: { submissionId: string; reasonCode: PartnerServiceCapacityDeletionReasonCode; reasonOtherText?: string | null }) {
    ensureAdminPermissionWrite('delete service-capacity survey submissions')
    setDeletingAdminServiceCapacitySubmissionId(input.submissionId)
    setAdminServiceCapacityDeletionError(null)
    try {
      await deleteAdminServiceCapacitySubmissionRecord(input)
      // Refresh both grids because deleting one submission affects domain history
      // rollups and the deletable-record inventory at the same time.
      await Promise.all([reloadZCodeDomainSurveyHistory(), reloadAdminDeletableServiceCapacitySubmissions()])
    } catch (error) {
      setAdminServiceCapacityDeletionError(toSupabaseErrorMessage(error, 'Unable to delete the selected survey record.'))
      throw error
    } finally {
      setDeletingAdminServiceCapacitySubmissionId(null)
    }
  }

  async function saveNavigatorCompetencyAssessment(input: { navigatorName: string; supervisorName: string; formVersion: string; answers: NavigatorCompetencyAssessmentRecord['answers'] }) {
    ensureWriteAllowed('navigatorProgram.write', 'save navigator competency assessments')
    const saved = await persistNavigatorCompetencyAssessment(input)
    setBootstrapState((current) => ({
      ...current,
      navigatorCompetencyAssessments: [saved, ...current.navigatorCompetencyAssessments],
    }))
    return saved
  }

  return {
    saveAccountSettings,
    saveEnrolleeIntake,
    saveRouteAssignment,
    setEnrolleeZCodeResolution,
    overrideEnrolleeZCodes,
    reloadZCodeDomainSurveyHistory,
    reloadAdminDeletableServiceCapacitySubmissions,
    setZCodeDomainSurveyAnswerNullification,
    deleteAdminServiceCapacitySubmission,
    saveNavigatorCompetencyAssessment,
  }
}
