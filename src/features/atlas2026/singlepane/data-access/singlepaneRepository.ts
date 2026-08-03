// Compatibility barrel: feature callers retain the established repository import path.
export {
  isCountyCommonsMenuEnabled,
  loadSinglePaneBootstrap
} from '@/features/atlas2026/singlepane/data-access/singlePaneBootstrapRepository'
export type {
  SinglePaneBootstrapData,
  SinglePaneBootstrapLoadOptions
} from '@/features/atlas2026/singlepane/data-access/singlePaneBootstrapRepository'

export {
  assignNavigatorEnrollmentToSelf,
  loadDemoTaggedEnrollmentIds,
  loadEnrollmentRequests,
  loadNavigatorEnrollmentAssignments,
  materializeClaimedReferralIntoEnrollment,
  unassignNavigatorEnrollmentFromSelf,
  upsertEnrollmentInferredZCodes
} from '@/features/atlas2026/singlepane/data-access/enrollmentAssignmentRepository'
export type { ReferralClaimMaterializationResult } from '@/features/atlas2026/singlepane/data-access/enrollmentAssignmentRepository'

export {
  invalidateJourneyStationMarkersCache,
  invalidateRouteCandidatesCache,
  loadAdminDataQuality,
  loadCountyHeatmap,
  loadJourneyStationMarkers,
  loadRouteCandidates,
  prefetchJourneyStationMarkersForEnrollments,
  prefetchRouteCandidatesForEnrollments
} from '@/features/atlas2026/singlepane/data-access/journeyRouteRepository'

export {
  overrideEnrolleeZCodes,
  setEnrolleeZCodeResolution,
  uploadAccountProfileImage,
  uploadEnrolleeProfileImage
} from '@/features/atlas2026/singlepane/data-access/enrolleeMediaRepository'

export {
  loadNavigatorStationContext,
  loadPartnerRadialLoad,
  loadPartnerRadialLoadBreakdown,
  loadPartnerStationProfile
} from '@/features/atlas2026/singlepane/data-access/partnerStationRepository'
export type { NavigatorStationContext } from '@/features/atlas2026/singlepane/data-access/partnerStationRepository'

export {
  loadAccountSettings,
  loadAdminPortalRegistry,
  loadEnrolleeIntakes,
  loadNavigatorProgramState,
  loadPartnerTroubleshootingGrants,
  loadRouteAssignments,
  saveAccountSettings,
  saveAdminPortalRegistry,
  saveEnrolleeIntake,
  saveNavigatorProgramState,
  savePartnerTroubleshootingGrant,
  saveRouteAssignment,
  saveTimelineConfig
} from '@/features/atlas2026/singlepane/data-access/localStateRepository'

export {
  appendRouteLog,
  saveRouteLogs
} from '@/features/atlas2026/singlepane/data-access/routeLogRepository'

export {
  loadNavigatorCompetencyAssessments,
  saveNavigatorCompetencyAssessment
} from '@/features/atlas2026/singlepane/data-access/navigatorAssessmentRepository'

export {
  loadNavigatorCreateReflection,
  loadNavigatorCreateReflections,
  loadNavigatorCreateSessions,
  loadNavigatorIpsSelfAssessments,
  loadNavigatorIpsccEncounterSubmissions,
  loadSupervisorIpsAssessments,
  saveNavigatorCreateReflection,
  saveNavigatorCreateSession,
  saveNavigatorIpsSelfAssessment,
  saveNavigatorIpsccEncounterSubmission,
  saveSupervisorIpsAssessment
} from '@/features/atlas2026/singlepane/data-access/navigatorProfileRepository'

export {
  deleteEnrolleeBurdenSurveyDraftRecord,
  loadEnrolleeBurdenSurvey,
  loadEnrolleeBurdenSurveyHistory,
  loadLatestEnrolleeBurdenSurveySubmissions,
  saveEnrolleeBurdenSurvey
} from '@/features/atlas2026/singlepane/data-access/enrolleeBurdenSurveyRepository'

export {
  deleteAdminServiceCapacitySubmission,
  deletePartnerServiceCapacityDraftRecord,
  ensurePartnerIdentifierRecordForSurvey,
  loadAdminDeletableServiceCapacitySubmissions,
  loadPartnerServiceCapacitySurvey,
  loadPartnerServiceCapacitySurveyHistory,
  loadZCodeDomainSurveyHistorySummary,
  savePartnerServiceCapacitySurvey,
  searchPartnerIdentifierRecordMatches,
  setZCodeDomainSurveyAnswerNullified
} from '@/features/atlas2026/singlepane/data-access/partnerServiceCapacityRepository'

export {
  loadAccessMatrixDataset,
  saveAccessMatrixEnrollmentNavigators,
  saveAccessMatrixPartnerPrimaryContacts,
  saveAccessMatrixPersonRoles,
  saveAccessMatrixSupervisorAssignments
} from '@/features/atlas2026/singlepane/data-access/accessMatrixRepository'
