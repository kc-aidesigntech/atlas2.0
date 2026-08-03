import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  AdminDeletableServiceCapacitySubmissionRecord, AtlasRole, EnrolleeIntakeRecord,
  EnrolleeProfile, NavigatorEnrollmentAssignmentRecord, NavigatorProgramState,
  PartnerIdentifierRecord, PartnerTroubleshootingGrant, TroubleshootingSessionState,
  UnassignedEnrolleePickupRecord, ZCodeDomainSurveyHistorySummary,
} from '@/features/atlas2026/shared/contracts'
import {
  ensurePartnerIdentifierRecordForSurvey, loadNavigatorEnrollmentAssignments,
  loadPartnerStationProfile, searchPartnerIdentifierRecordMatches,
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { useAdminAccessMatrixState } from '@/features/atlas2026/singlepane/hooks/useAdminAccessMatrixState'
import { useSinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'
import { useSinglePaneViewerState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneViewerState'
import { useSinglePaneWorkspaceDerivedState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneWorkspaceDerivedState'
import { useSinglePaneWorkspaceActions } from '@/features/atlas2026/singlepane/hooks/useSinglePaneWorkspaceActions'
import { DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION, flattenSurveyPrompts } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import { SESSION_ACTIVE_MENU_KEY, readSessionRemoteSession, readSessionRole, readSessionStorageValue } from '@/features/atlas2026/singlepane/domain/sessionStorage'
import { createNavigatorProgramState } from '@/features/atlas2026/singlepane/domain/ipsccSeeds'
import { normalizeZCode } from '@/features/atlas2026/singlepane/domain/loadsRoutes'

/**
 * Composes the domain hooks and action modules that back the public single-pane facade.
 * The public hook remains intentionally small while this hook owns workspace orchestration.
 */
export function useSinglePaneWorkspaceState(initialRole: AtlasRole = 'navigator') {
  const [role, setRoleState] = useState<AtlasRole>(() => readSessionRole(initialRole))
  const adminDefaultAppliedForEmailRef = useRef<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string>(() => readSessionStorageValue(SESSION_ACTIVE_MENU_KEY) || '')
  const [navigatorProgramState, setNavigatorProgramState] = useState<NavigatorProgramState>(createNavigatorProgramState())
  const [partnerTroubleshootingGrants, setPartnerTroubleshootingGrants] = useState<Record<string, PartnerTroubleshootingGrant>>({})
  const [remoteSession, setRemoteSession] = useState<TroubleshootingSessionState | null>(() => readSessionRemoteSession())
  const [remotePartnerStationProfile, setRemotePartnerStationProfile] = useState<Awaited<ReturnType<typeof loadPartnerStationProfile>> | null>(null)
  const [navigatorProgramError, setNavigatorProgramError] = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState('')
  const [authoritativeAccountRoles, setAuthoritativeAccountRoles] = useState<AtlasRole[]>([])
  const canSwitchActiveExperience = useMemo(() => authoritativeAccountRoles.includes('administrator') || role === 'administrator', [authoritativeAccountRoles, role])
  const [navigatorEnrollmentAssignments, setNavigatorEnrollmentAssignments] = useState<NavigatorEnrollmentAssignmentRecord[]>([])
  const [navigatorEnrollmentAssignmentsError, setNavigatorEnrollmentAssignmentsError] = useState<string | null>(null)
  const [isLoadingNavigatorEnrollmentAssignments, setIsLoadingNavigatorEnrollmentAssignments] = useState(false)
  const [assigningNavigatorEnrollmentId, setAssigningNavigatorEnrollmentId] = useState<string | null>(null)
  // Optimistic placeholders for enrollees a navigator just self-assigned. They render in the
  // dropdown with a syncing spinner until the database-synced roster reload surfaces the real
  // record (matched by id), giving immediate "your click did something" feedback without
  // mutating the authoritative `enrollees` list used for counts and charts.
  const [pendingAssignmentEnrollees, setPendingAssignmentEnrollees] = useState<EnrolleeProfile[]>([])
  const [demoTaggedEnrollmentIds, setDemoTaggedEnrollmentIds] = useState<string[]>([])
  const [publicQueueRecords, setPublicQueueRecords] = useState<UnassignedEnrolleePickupRecord[]>([])
  const [zCodeDomainSurveyHistorySummary, setZCodeDomainSurveyHistorySummary] = useState<ZCodeDomainSurveyHistorySummary[]>([])
  const [adminDeletableServiceCapacitySubmissions, setAdminDeletableServiceCapacitySubmissions] = useState<AdminDeletableServiceCapacitySubmissionRecord[]>([])
  const [isLoadingAdminDeletableServiceCapacitySubmissions, setIsLoadingAdminDeletableServiceCapacitySubmissions] = useState(false)
  const [deletingAdminServiceCapacitySubmissionId, setDeletingAdminServiceCapacitySubmissionId] = useState<string | null>(null)
  const [adminServiceCapacityDeletionError, setAdminServiceCapacityDeletionError] = useState<string | null>(null)
  const [isLoadingZCodeDomainSurveyHistorySummary, setIsLoadingZCodeDomainSurveyHistorySummary] = useState(false)
  const [isSavingZCodeDomainSurveyNullification, setIsSavingZCodeDomainSurveyNullification] = useState(false)
  const [zCodeDomainSurveyHistoryError, setZCodeDomainSurveyHistoryError] = useState<string | null>(null)
  const {
    state: { isLoading, error: bootstrapError, enrollees, loads, loadBreakdownsByEnrolleeId, roleConfigs, timelineConfig, timelineConfigsByEnrolleeId, logs, enrollmentRequests, countyHeatmap, adminMetrics, partnerLoad, partnerLoadBreakdown, partnerStationSpecialties, accountSettings, partnerStationProfile, intakeFormsByEnrolleeId, routeAssignmentsByEnrolleeId, navigatorCompetencyAssessments },
    setState: setBootstrapState,
    reload: reloadBootstrapState,
  } = useSinglePaneBootstrapState(role)

  const viewerRole = remoteSession?.targetRole || role
  const { adminPortalRegistry, accessMatrixDataset, isSavingAdminPortalRegistry, isSavingAccessMatrix, adminPortalRegistryError, accessMatrixError, saveAdminPortalRegistry, saveAccessMatrixPersonRoles, saveAccessMatrixEnrollmentNavigators, saveAccessMatrixSupervisorAssignments, toggleSupervisorManagedNavigator, saveAccessMatrixPartnerPrimaryContacts } = useAdminAccessMatrixState({
    viewerRole,
    role,
    sessionEmail,
    accountSettings,
    remoteSessionActive: Boolean(remoteSession?.isActive),
    getViewerPersonId: () => viewerPerson?.id || null,
    canAccessAdminRegistryCards: () => viewerCanAccessAdminRegistryCards,
    ensureAdminPermissionWrite,
    refreshAssignmentParityViews,
  })
  const remotePartnerAssignment = remoteSession?.targetRole === 'partner' && accessMatrixDataset ? accessMatrixDataset.partnerAssignments.find((partner) => partner.primaryContactPersonIds.includes(remoteSession.targetPersonId)) || null : null
  const isNavigatorMyStationView = viewerRole === 'navigator' && activeMenu.trim().toLowerCase() === 'my station'
  const isPartnerStationView = viewerRole === 'partner' || isNavigatorMyStationView
  const serviceCapacityPromptByNormalizedZCode = useMemo(() => {
    return new Map(flattenSurveyPrompts(DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION.sections).map((prompt) => [normalizeZCode(prompt.normalizedZCode || prompt.zCode), prompt]))
  }, [])
  const effectivePartnerOrganizationName = remoteSession?.targetRole === 'partner' ? remotePartnerAssignment?.organizationName || remoteSession.targetOrganizationName || '' : partnerStationProfile?.organizationName?.trim() || accountSettings.organization
  const effectiveAccountSettings = useMemo<AccountSettings>(
    () =>
      remoteSession
        ? {
            ...accountSettings,
            fullName: remoteSession.targetDisplayName || accountSettings.fullName,
            email: remoteSession.targetEmail || accountSettings.email,
            organization: remoteSession.targetOrganizationName || accountSettings.organization,
          }
        : accountSettings,
    [accountSettings, remoteSession],
  )
  const effectivePartnerStationProfile = remoteSession?.targetRole === 'partner' ? remotePartnerStationProfile : partnerStationProfile
  const {
    viewerPolicyRecord,
    isViewerPolicyAllowed,
    viewerPerson,
    viewerCanViewNavigatorAssignmentNames,
    viewerCanAccessAssignmentBoard,
    viewerCanUseAssignmentActions,
    viewerCanAddAssignmentBoardReferral,
    viewerCanAccessAdminRegistryCards,
    scopedEnrollmentIds,
    navigatorAssignmentProfiles,
    selectedEnrolleeId,
    setSelectedEnrolleeId,
    scopedEnrollees,
    scopedEnrolleeIdSet,
    scopedLoads,
    scopedLoadBreakdownsByEnrolleeId,
    selectedEnrollee,
    selectedLoad,
    selectedLoadBreakdown,
    selectedTimelineConfig,
    selectedIntake,
    hasSavedIntake,
    selectedLogs,
  } = useSinglePaneViewerState({
    role,
    viewerRole,
    sessionEmail,
    accountSettings,
    remoteSession,
    accessMatrixDataset,
    adminPortalRegistry,
    demoTaggedEnrollmentIds,
    enrollees,
    loads,
    loadBreakdownsByEnrolleeId,
    isPartnerStationView,
    partnerLoad,
    partnerLoadBreakdown,
    timelineConfig,
    timelineConfigsByEnrolleeId,
    intakeFormsByEnrolleeId,
    logs,
  })
  // Hoisted adapters let derived hooks retain stable callbacks while persistence
  // command ownership lives in the focused action hook below.
  function saveEnrolleeIntake(nextIntake: EnrolleeIntakeRecord) {
    return workspaceActions.saveEnrolleeIntake(nextIntake)
  }
  async function reloadZCodeDomainSurveyHistory() {
    return workspaceActions.reloadZCodeDomainSurveyHistory()
  }
  async function reloadAdminDeletableServiceCapacitySubmissions() {
    return workspaceActions.reloadAdminDeletableServiceCapacitySubmissions()
  }

  const derived = useSinglePaneWorkspaceDerivedState({
    selectedEnrollee, viewerRole, selectedLoadBreakdown, selectedLoad, roleConfigs, remoteSession,
    routeAssignmentsByEnrolleeId, selectedLogs, selectedTimelineConfig, selectedIntake,
    setBootstrapState, setNavigatorProgramError, ensureWriteAllowed, saveEnrolleeIntake,
    scopedEnrollees, logs, effectiveAccountSettings, navigatorCompetencyAssessments,
    accessMatrixDataset, viewerPerson, navigatorProgramState, enrollees, enrollmentRequests,
    publicQueueRecords, isPartnerStationView, effectivePartnerOrganizationName,
    scopedEnrolleeIdSet, serviceCapacityPromptByNormalizedZCode, setNavigatorProgramState,
    role, accountSettings, effectivePartnerStationProfile, setPublicQueueRecords,
    refreshAssignmentParityViews, partnerTroubleshootingGrants, setPartnerTroubleshootingGrants,
    setRemoteSession, ensureAdminPermissionWrite, viewerCanUseAssignmentActions,
    navigatorEnrollmentAssignments, setAssigningNavigatorEnrollmentId,
    setNavigatorEnrollmentAssignmentsError, setPendingAssignmentEnrollees, scopedLoads,
    scopedLoadBreakdownsByEnrolleeId, partnerStationProfile, activeMenu, setRoleState,
    setActiveMenu, sessionEmail, setSessionEmail, authoritativeAccountRoles,
    setAuthoritativeAccountRoles, adminDefaultAppliedForEmailRef, remotePartnerAssignment,
    navigatorAssignmentProfiles, setRemotePartnerStationProfile, setNavigatorEnrollmentAssignments,
    setIsLoadingNavigatorEnrollmentAssignments, setDemoTaggedEnrollmentIds,
    setZCodeDomainSurveyHistorySummary, setZCodeDomainSurveyHistoryError,
    setAdminDeletableServiceCapacitySubmissions, setAdminServiceCapacityDeletionError,
    reloadZCodeDomainSurveyHistory, reloadAdminDeletableServiceCapacitySubmissions
  })
  const {
    routeCandidates, isUploadingProfileImage, profileImageUploadError,
    isUploadingAccountProfileImage, accountProfileImageUploadError,
    replaceAccountProfileImage, replaceSelectedEnrolleeProfileImage,
    effectiveSelectedLoadBreakdown, effectiveSelectedLoad, selectedRouteAssignment,
    appendRouteLog, deleteRouteLog, updateRouteLogTimelinePosition, updateRouteLogDate,
    updateTimelineStartDate, updateTimelinePhaseDuration, updateTimelineConfig,
    effectiveRegulationReviewSettings, regulationReviewDueItems, regulationReviewError,
    regulationTestHistory, regulationTestStripMarkers, latestCompletedMhSca,
    latestCompletedSvs, isRegulationCleared, shouldHideReadinessProgress,
    resolvedZCodeStripMarkers, isSavingRegulationTest, regulationTestError,
    saveRegulationReviewSettings, saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft, partnerServiceCapacityDefaultHeader,
    currentNavigatorName, currentSupervisorName, supervisorNavigatorCompetency,
    supervisorNavigatorDirectory, mergedNavigatorProgramState, partnerStripJourneyModel,
    navigatorSelfAssessments, navigatorSelfAssessmentSummary, navigatorIpsccEncounterSubmissions,
    navigatorIpsSelfAssessments, allSupervisorIpsAssessments, navigatorSupervisorIpsAssessments,
    navigatorCreateSessions, navigatorIpsccCompetencyAggregates,
    navigatorIpsccEnrolleeFeedbackPrivacy, navigatorSelfAwarenessCorrelation,
    navigatorCreateInsights, navigatorSupervisionSessions, navigatorIntervalRules,
    navigatorIntervalDueItems, navigatorCreateReflection, supervisorManagedCreateReflections,
    saveNavigatorCreateSession, saveSupervisorCreateReflectionOverride,
    restoreSupervisorCreateReflectionGenerated, saveNavigatorProgramState,
    claimPickupQueueRecord, saveNavigatorSelfAssessment, saveNavigatorIpsSelfAssessment,
    saveSupervisorIpsAssessment, saveNavigatorIpsccEncounterSubmission,
    saveSupervisionSession, saveIntervalAssessmentRule, submitPartnerReferral,
    savePartnerTroubleshootingGrant, startTroubleshootingSession, stopTroubleshootingSession,
    assignNavigatorEnrollmentToSelf, navigatorAssignedCompetencySummary,
    navigatorAggregateLoad, navigatorLoadContributors, navigatorAggregateLoadBreakdown,
    pickupQueue, navigatorAssignmentBoardRows, journeyStationMarkers,
    partnerServiceCapacitySurveyHistory, partnerServiceCapacitySurveyError,
    setPartnerServiceCapacitySurveyHistory, isSavingPartnerServiceCapacitySurvey,
    isSavingEnrolleeBurdenSurvey, enrolleeBurdenSurveyError,
    enrolleeBurdenSurveyHistoryByEnrollmentId, savePartnerServiceCapacitySurvey,
    reloadEnrolleeBurdenSurveyHistoryForEnrollment, saveEnrolleeBurdenSurvey,
    reloadPartnerServiceCapacitySurveyHistory, deletePartnerServiceCapacityDraft,
    deleteEnrolleeBurdenSurveyDraft, partnerMyStationDebut, selectedRoleConfig
  } = derived

  const workspaceActions = useSinglePaneWorkspaceActions({
    remoteSession, role, viewerRole, partnerStationProfile, setBootstrapState, setRoleState,
    ensureWriteAllowed, ensureRegulationReviewSettingForEnrollee:
      derived.ensureRegulationReviewSettingForEnrollee, selectedEnrollee,
    setIsLoadingZCodeDomainSurveyHistorySummary, setZCodeDomainSurveyHistoryError,
    setZCodeDomainSurveyHistorySummary, setIsLoadingAdminDeletableServiceCapacitySubmissions,
    setAdminServiceCapacityDeletionError, setAdminDeletableServiceCapacitySubmissions,
    ensureAdminPermissionWrite, setIsSavingZCodeDomainSurveyNullification,
    effectiveAccountSettings, setDeletingAdminServiceCapacitySubmissionId
  })
  const {
    saveAccountSettings, saveRouteAssignment,
    setEnrolleeZCodeResolution, overrideEnrolleeZCodes,
    setZCodeDomainSurveyAnswerNullification, deleteAdminServiceCapacitySubmission,
    saveNavigatorCompetencyAssessment
  } = workspaceActions

  async function refreshAssignmentParityViews() {
    await Promise.all([
      // Assignment board and bootstrap are the canonical read paths for navigator claim state.
      loadNavigatorEnrollmentAssignments({ profileRows: navigatorAssignmentProfiles }).then((rows) => {
        setNavigatorEnrollmentAssignments(rows)
        setNavigatorEnrollmentAssignmentsError(null)
      }),
      reloadBootstrapState(),
    ])
  }

  type SinglePaneWriteActionKey = 'intake.write' | 'zcodes.write' | 'routeAssignment.write' | 'routeLogs.write' | 'timeline.write' | 'navigatorProgram.write' | 'regulationReview.write' | 'regulationTests.write' | 'partnerReferral.submit'

  function ensureWriteAllowed(actionKey: SinglePaneWriteActionKey, actionLabel: string) {
    if (remoteSession?.targetRole === 'partner' && !remoteSession.partnerGrant?.allowWrite) {
      throw new Error('This partner troubleshooting session is read-only until the partner grants write access.')
    }
    // Keep write-path enforcement aligned with the same per-action policy keys
    // that drive User Interface (UI) affordances, so hidden actions are never
    // still callable through callbacks.
    if (!isViewerPolicyAllowed('actionToggles', actionKey)) {
      throw new Error(`You do not have permission to ${actionLabel}.`)
    }
  }

  function ensureAdminPermissionWrite(actionLabel: string) {
    // Permission overrides and access-matrix writes are privileged operations.
    // Keep these operations scoped to administrators outside troubleshooting views.
    if (remoteSession) {
      throw new Error(`Exit troubleshooting mode before attempting to ${actionLabel}.`)
    }
    if (viewerRole !== 'administrator') {
      throw new Error(`Only administrators can ${actionLabel}.`)
    }
  }

  async function searchPartnerIdentifierMatches(firstName: string, lastName: string): Promise<PartnerIdentifierRecord[]> {
    return searchPartnerIdentifierRecordMatches(firstName, lastName)
  }

  async function ensurePartnerIdentifier(header: { firstName: string; lastName: string; organizationName: string; email?: string | null }): Promise<PartnerIdentifierRecord> {
    return ensurePartnerIdentifierRecordForSurvey(header)
  }

  const setRole = useCallback(
    (nextRole: AtlasRole) => {
      // Active experience switching is admin-only. Non-admin users remain pinned
      // to their permission-scoped experience (their JWT-authoritative role).
      if (!authoritativeAccountRoles.includes('administrator')) return
      setRoleState(nextRole)
    },
    [authoritativeAccountRoles],
  )

  return {
    // Domain hooks expose matching names directly; aliases below preserve the
    // established facade names where internal projections are more explicit.
    ...derived,
    ...workspaceActions,
    role, viewerRole, setRole, remoteSession, partnerTroubleshootingGrants,
    selectedEnrolleeId, setSelectedEnrolleeId, activeMenu, setActiveMenu,
    isLoading, bootstrapError, enrollees: scopedEnrollees, selectedEnrollee,
    selectedLoad: derived.effectiveSelectedLoad,
    selectedLoadBreakdown: derived.effectiveSelectedLoadBreakdown,
    selectedLogs, selectedRoleConfig: derived.selectedRoleConfig,
    timelineConfig: selectedTimelineConfig, enrollmentRequests, countyHeatmap, adminMetrics,
    zCodeDomainSurveyHistorySummary, adminDeletableServiceCapacitySubmissions,
    isLoadingAdminDeletableServiceCapacitySubmissions, deletingAdminServiceCapacitySubmissionId,
    adminServiceCapacityDeletionError, isLoadingZCodeDomainSurveyHistorySummary,
    isSavingZCodeDomainSurveyNullification, zCodeDomainSurveyHistoryError,
    partnerStationSpecialties, adminPortalRegistry, adminPortalRegistryError,
    accessMatrixDataset, accessMatrixError, navigatorProgramState: derived.mergedNavigatorProgramState,
    navigatorProgramError, partnerStripReferredDots: derived.partnerStripJourneyModel.referredDots,
    partnerStripActiveDots: derived.partnerStripJourneyModel.activeDots,
    partnerStripSuccessHistory: derived.partnerStripJourneyModel.successHistory,
    navigatorSelfAwarenessCorrelationRows: derived.navigatorSelfAwarenessCorrelation.rows,
    navigatorSelfAwarenessSummary: derived.navigatorSelfAwarenessCorrelation.summary,
    navigatorEnrollmentAssignments: derived.navigatorAssignmentBoardRows,
    viewerCanViewNavigatorAssignmentNames, viewerCanAccessAssignmentBoard,
    viewerCanUseAssignmentActions, viewerCanAddAssignmentBoardReferral,
    viewerCanAccessAdminRegistryCards, navigatorEnrollmentAssignmentsError,
    isLoadingNavigatorEnrollmentAssignments, assigningNavigatorEnrollmentId,
    pendingAssignmentEnrollees, regulationReviewSettings: derived.effectiveRegulationReviewSettings,
    searchPartnerIdentifierMatches, ensurePartnerIdentifier, navigatorCompetencyAssessments,
    accountSettings: effectiveAccountSettings, partnerStationProfile: effectivePartnerStationProfile,
    intakeFormsByEnrolleeId, selectedIntake, hasSavedIntake, canSwitchActiveExperience,
    isSavingAdminPortalRegistry, isSavingAccessMatrix,
    viewerCanWrite: remoteSession?.targetRole === 'partner' ? Boolean(remoteSession.partnerGrant?.allowWrite) : true,
    saveAdminPortalRegistry, saveAccessMatrixPersonRoles, saveAccessMatrixEnrollmentNavigators,
    saveAccessMatrixSupervisorAssignments, toggleSupervisorManagedNavigator,
    saveAccessMatrixPartnerPrimaryContacts, saveEnrolleeIntake,
    reloadZCodeDomainSurveyHistory, reloadAdminDeletableServiceCapacitySubmissions,
  }
}
