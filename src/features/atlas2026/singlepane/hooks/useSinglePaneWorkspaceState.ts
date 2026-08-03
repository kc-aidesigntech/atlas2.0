import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  AdminDeletableServiceCapacitySubmissionRecord,
  AdminDataQualityMetric,
  AccountSettings,
  AtlasRole,
  CountyHeatPoint,
  DomainLoadBreakdown,
  DomainLoad,
  EnrolleeActiveZCode,
  EnrolleeIntakeRecord,
  EnrollmentRequestRecord,
  EnrolleeProfile,
  EnrolleeZCodeOverrideInput,
  EnrolleeZCodeResolutionInput,
  IntervalAssessmentDueItem,
  IntervalAssessmentRule,
  IpsCompetencySelfAssessmentRecord,
  IpsccCompetencyKey,
  IpsccEncounterSubmissionRecord,
  JourneyStationMarker,
  NavigatorProgramState,
  NavigatorEnrollmentAssignmentRecord,
  NavigatorLoadContributor,
  NavigatorSelfAssessmentRecord,
  PartnerTroubleshootingGrant,
  PartnerIdentifierRecord,
  PartnerReferralSubmissionInput,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacityDeletionReasonCode,
  NavigatorCompetencyAssessmentRecord,
  SupervisorNavigatorCompetencySummary,
  RoleMenuConfig,
  ResolvedZCodeStripMarker,
  RouteAssignmentRecord,
  RouteCandidateRecord,
  RouteLogEvent,
  StabilizationPhase,
  SupervisorIpsAssessmentRecord,
  SupervisionSessionRecord,
  CreateInsightRow,
  TroubleshootingSessionState,
  TimelineConfig,
  UnassignedEnrolleePickupRecord,
  ZCodeDomainSurveyHistorySummary,
  ZDomain
} from '@/features/atlas2026/shared/contracts'
import {
  appendRouteLog as appendRouteLogRecord,
  loadAdminDataQuality,
  loadCountyHeatmap,
  loadEnrollmentRequests,
  prefetchJourneyStationMarkersForEnrollments,
  prefetchRouteCandidatesForEnrollments,
  loadAdminDeletableServiceCapacitySubmissions,
  loadPartnerStationProfile,
  loadNavigatorProgramState,
  loadNavigatorEnrollmentAssignments,
  loadPartnerTroubleshootingGrants,
  loadDemoTaggedEnrollmentIds,
  loadZCodeDomainSurveyHistorySummary,
  searchPartnerIdentifierRecordMatches,
  ensurePartnerIdentifierRecordForSurvey,
  invalidateJourneyStationMarkersCache,
  invalidateRouteCandidatesCache,
  setZCodeDomainSurveyAnswerNullified,
  deleteAdminServiceCapacitySubmission as deleteAdminServiceCapacitySubmissionRecord,
  saveAccountSettings as persistAccountSettings,
  saveNavigatorProgramState as persistNavigatorProgramState,
  savePartnerTroubleshootingGrant as persistPartnerTroubleshootingGrant,
  overrideEnrolleeZCodes as persistEnrolleeZCodeOverride,
  setEnrolleeZCodeResolution as persistEnrolleeZCodeResolution,
  saveNavigatorCompetencyAssessment as persistNavigatorCompetencyAssessment,
  saveRouteAssignment as persistRouteAssignment,
  saveTimelineConfig as persistTimelineConfig,
  saveRouteLogs as persistRouteLogs,
  saveEnrolleeIntake as persistEnrolleeIntake,
  saveNavigatorIpsSelfAssessment as persistNavigatorIpsSelfAssessment,
  saveNavigatorIpsccEncounterSubmission as persistNavigatorIpsccEncounterSubmission,
  assignNavigatorEnrollmentToSelf as persistAssignNavigatorEnrollmentToSelf,
  materializeClaimedReferralIntoEnrollment,
  upsertEnrollmentInferredZCodes,
  saveSupervisorIpsAssessment as persistSupervisorIpsAssessment
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { toSupabaseErrorMessage } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { useJourneyStationMarkers } from '@/features/atlas2026/singlepane/hooks/useJourneyStationMarkers'
import { useAdminAccessMatrixState } from '@/features/atlas2026/singlepane/hooks/useAdminAccessMatrixState'
import { useCreateReflectionActions } from '@/features/atlas2026/singlepane/hooks/useCreateReflectionActions'
import { useNavigatorCompetencyDerived } from '@/features/atlas2026/singlepane/hooks/useNavigatorCompetencyDerived'
import { useNavigatorEnrollmentActions } from '@/features/atlas2026/singlepane/hooks/useNavigatorEnrollmentActions'
import { usePartnerServiceCapacityHistory } from '@/features/atlas2026/singlepane/hooks/usePartnerServiceCapacityHistory'
import { usePartnerSurveyActions } from '@/features/atlas2026/singlepane/hooks/usePartnerSurveyActions'
import { useProfileImageUploads } from '@/features/atlas2026/singlepane/hooks/useProfileImageUploads'
import { useRegulationReviewState } from '@/features/atlas2026/singlepane/hooks/useRegulationReviewState'
import { useRouteCandidates } from '@/features/atlas2026/singlepane/hooks/useRouteCandidates'
import { useScopedEnrolleeSelection } from '@/features/atlas2026/singlepane/hooks/useScopedEnrolleeSelection'
import { useSinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'
import { useSinglePaneBootstrapEffects } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapEffects'
import { useRouteLogTimelineActions } from '@/features/atlas2026/singlepane/hooks/useRouteLogTimelineActions'
import { useRemoteTroubleshootingSession } from '@/features/atlas2026/singlepane/hooks/useRemoteTroubleshootingSession'
import { usePickupQueueActions } from '@/features/atlas2026/singlepane/hooks/usePickupQueueActions'
import { useSinglePaneViewerState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneViewerState'
import {
  createDefaultTimelineConfig,
  extendTimelinePhaseByMonth,
  normalizeTimelineConfig
} from '@/features/atlas2026/singlepane/timelineConfigUtils'
import { splitFullName } from '@/features/atlas2026/singlepane/personNameUtils'
import {
  mapZCodeToDomainBucket,
  toNormalizedRadialDomainLoad
} from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import {
  applyPartnerMyStationDebutMenuGate,
  evaluatePartnerMyStationDebut
} from '@/features/atlas2026/singlepane/data-access/partnerMyStationDebut'
import { isCapabilityAllowedForRole } from '@/features/atlas2026/shared/roleCapabilityPolicy'
import {
  buildPartnerServiceCapacityDefaultHeader,
  buildSupervisorNavigatorCompetencySummaries
} from '@/features/atlas2026/singlepane/useSinglePaneDataTransforms'
import {
  DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION,
  flattenSurveyPrompts
} from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import { buildReferralQueueUpdate } from '@/features/atlas2026/singlepane/referralWorkflowUtils'
import {
  enqueuePublicReferralQueueRecord,
  loadPublicReferralQueueRecords,
  setPublicReferralQueueRecordStatus
} from '@/features/atlas2026/singlepane/data-access/publicReferralRepository'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { inferZCodesForReferral } from '@/services/atlas2026/inferZCodesService'
import { IPSCC_COMPETENCY_DEFINITIONS } from '@/features/atlas2026/singlepane/data/intentionalPeerSupportCatalog'
import {
  SESSION_ACTIVE_MENU_KEY,
  SESSION_REMOTE_SESSION_KEY,
  SESSION_ROLE_KEY,
  readSessionRemoteSession,
  readSessionRole,
  readSessionStorageValue,
  writeSessionStorageValue
} from '@/features/atlas2026/singlepane/domain/sessionStorage'
import {
  dedupeMenus,
  extractAuthoritativeRolesFromSession,
  haveSameRoles,
  normalizeAtlasRoleKeys,
  toRemoteSessionErrorMessage
} from '@/features/atlas2026/singlepane/domain/roles'
import { getWeekStartIso, normalizeOrganizationKey } from '@/features/atlas2026/singlepane/domain/dates'
import {
  buildCompletedParentCodes,
  buildResolvedZCodeStripMarkers,
  nextPhase
} from '@/features/atlas2026/singlepane/domain/phaseAndZCodes'
import {
  createNavigatorProgramState,
  mergeNavigatorProgramState
} from '@/features/atlas2026/singlepane/domain/ipsccSeeds'
import {
  buildPendingReferralAssignmentRows,
  getPickupRecordIdFromEnrollmentId,
  isPickupEnrollmentRow
} from '@/features/atlas2026/singlepane/domain/enrollmentPickup'
import {
  DOMAIN_BY_ACTION,
  buildNavigatorRouteBoardLoadBreakdown,
  deriveNavigatorLoad,
  deriveNavigatorLoadBreakdown,
  deriveNavigatorLoadContributors,
  normalizeZCode
} from '@/features/atlas2026/singlepane/domain/loadsRoutes'
import { buildPartnerStripJourneyModel } from '@/features/atlas2026/singlepane/domain/partnerStripJourney'

interface SupervisorNavigatorDirectoryEntry {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

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
  const canSwitchActiveExperience = useMemo(
    () => authoritativeAccountRoles.includes('administrator') || role === 'administrator',
    [authoritativeAccountRoles, role]
  )
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
  const [adminDeletableServiceCapacitySubmissions, setAdminDeletableServiceCapacitySubmissions] = useState<
    AdminDeletableServiceCapacitySubmissionRecord[]
  >([])
  const [isLoadingAdminDeletableServiceCapacitySubmissions, setIsLoadingAdminDeletableServiceCapacitySubmissions] =
    useState(false)
  const [deletingAdminServiceCapacitySubmissionId, setDeletingAdminServiceCapacitySubmissionId] = useState<string | null>(null)
  const [adminServiceCapacityDeletionError, setAdminServiceCapacityDeletionError] = useState<string | null>(null)
  const [isLoadingZCodeDomainSurveyHistorySummary, setIsLoadingZCodeDomainSurveyHistorySummary] = useState(false)
  const [isSavingZCodeDomainSurveyNullification, setIsSavingZCodeDomainSurveyNullification] = useState(false)
  const [zCodeDomainSurveyHistoryError, setZCodeDomainSurveyHistoryError] = useState<string | null>(null)
  const {
    state: {
      isLoading,
      error: bootstrapError,
      enrollees,
      loads,
      loadBreakdownsByEnrolleeId,
      roleConfigs,
      timelineConfig,
      timelineConfigsByEnrolleeId,
      logs,
      enrollmentRequests,
      countyHeatmap,
      adminMetrics,
      partnerLoad,
      partnerLoadBreakdown,
      partnerStationSpecialties,
      accountSettings,
      partnerStationProfile,
      intakeFormsByEnrolleeId,
      routeAssignmentsByEnrolleeId,
      navigatorCompetencyAssessments
    },
    setState: setBootstrapState,
    reload: reloadBootstrapState
  } = useSinglePaneBootstrapState(role)

  const viewerRole = remoteSession?.targetRole || role
  const {
    adminPortalRegistry,
    accessMatrixDataset,
    isSavingAdminPortalRegistry,
    isSavingAccessMatrix,
    adminPortalRegistryError,
    accessMatrixError,
    saveAdminPortalRegistry,
    saveAccessMatrixPersonRoles,
    saveAccessMatrixEnrollmentNavigators,
    saveAccessMatrixSupervisorAssignments,
    toggleSupervisorManagedNavigator,
    saveAccessMatrixPartnerPrimaryContacts
  } = useAdminAccessMatrixState({
    viewerRole,
    role,
    sessionEmail,
    accountSettings,
    remoteSessionActive: Boolean(remoteSession?.isActive),
    getViewerPersonId: () => viewerPerson?.id || null,
    canAccessAdminRegistryCards: () => viewerCanAccessAdminRegistryCards,
    ensureAdminPermissionWrite,
    refreshAssignmentParityViews
  })
  const remotePartnerAssignment =
    remoteSession?.targetRole === 'partner' && accessMatrixDataset
      ? accessMatrixDataset.partnerAssignments.find((partner) => partner.primaryContactPersonIds.includes(remoteSession.targetPersonId)) || null
      : null
  const isNavigatorMyStationView = viewerRole === 'navigator' && activeMenu.trim().toLowerCase() === 'my station'
  const isPartnerStationView = viewerRole === 'partner' || isNavigatorMyStationView
  const serviceCapacityPromptByNormalizedZCode = useMemo(() => {
    return new Map(
      flattenSurveyPrompts(DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION.sections).map((prompt) => [
        normalizeZCode(prompt.normalizedZCode || prompt.zCode),
        prompt
      ])
    )
  }, [])
  const effectivePartnerOrganizationName =
    remoteSession?.targetRole === 'partner'
      ? remotePartnerAssignment?.organizationName || remoteSession.targetOrganizationName || ''
      : partnerStationProfile?.organizationName?.trim() || accountSettings.organization
  const effectiveAccountSettings = useMemo<AccountSettings>(
    () =>
      remoteSession
        ? {
            ...accountSettings,
            fullName: remoteSession.targetDisplayName || accountSettings.fullName,
            email: remoteSession.targetEmail || accountSettings.email,
            organization: remoteSession.targetOrganizationName || accountSettings.organization
          }
        : accountSettings,
    [accountSettings, remoteSession]
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
    selectedLogs
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
    logs
  })
  const routeCandidates = useRouteCandidates(selectedEnrollee)
  const {
    isUploadingProfileImage,
    profileImageUploadError,
    isUploadingAccountProfileImage,
    accountProfileImageUploadError,
    replaceAccountProfileImage,
    replaceSelectedEnrolleeProfileImage
  } = useProfileImageUploads({
    remoteSessionActive: Boolean(remoteSession),
    accountSettings,
    viewerRole,
    partnerStationProfile,
    selectedEnrollee,
    setBootstrapState,
    ensureEnrolleeImageWriteAllowed: () =>
      ensureWriteAllowed('intake.write', 'replace enrollee profile images')
  })
  const navigatorRouteBoardLoadBreakdown = useMemo(
    () => (viewerRole === 'navigator' ? buildNavigatorRouteBoardLoadBreakdown(selectedEnrollee, routeCandidates) : null),
    [routeCandidates, selectedEnrollee, viewerRole]
  )
  const effectiveSelectedLoadBreakdown = useMemo(
    () => navigatorRouteBoardLoadBreakdown || selectedLoadBreakdown,
    [navigatorRouteBoardLoadBreakdown, selectedLoadBreakdown]
  )
  const effectiveSelectedLoad = useMemo(
    () => toNormalizedRadialDomainLoad(effectiveSelectedLoadBreakdown) || selectedLoad,
    [effectiveSelectedLoadBreakdown, selectedLoad]
  )

  // Base role menus before partner My Station debut commissioning is applied. Troubleshooting
  // grants still constrain remote partner shells here; debut gating is applied after survey history loads.
  const baseSelectedRoleConfig = useMemo(
    () => {
      const baseConfig =
        roleConfigs.find((item) => item.role === viewerRole) || roleConfigs[0] || { role: viewerRole, topMenus: [], actionMenus: [] }
      if (remoteSession?.targetRole !== 'partner') return baseConfig
      const allowedMenus = dedupeMenus(remoteSession.partnerGrant?.allowedMenus || [])
      return {
        ...baseConfig,
        topMenus: allowedMenus.length ? baseConfig.topMenus.filter((menu) => allowedMenus.includes(menu)) : []
      }
    },
    [remoteSession?.partnerGrant?.allowedMenus, remoteSession?.targetRole, roleConfigs, viewerRole]
  )

  const selectedRouteAssignment = useMemo(
    () => (selectedEnrollee ? routeAssignmentsByEnrolleeId[selectedEnrollee.id] || null : null),
    [routeAssignmentsByEnrolleeId, selectedEnrollee]
  )

  const resolvedZCodeStripMarkersFromActiveCodes = useMemo(
    () => buildResolvedZCodeStripMarkers(selectedEnrollee?.activeZCodeDetails || []),
    [selectedEnrollee?.activeZCodeDetails]
  )
  const {
    setLogs,
    appendRouteLog,
    deleteRouteLog,
    updateRouteLogTimelinePosition,
    updateRouteLogDate,
    updateTimelineStartDate,
    updateTimelinePhaseDuration,
    updateTimelineConfig
  } = useRouteLogTimelineActions({
    logs,
    selectedEnrollee,
    selectedLogs,
    selectedTimelineConfig,
    selectedIntake,
    setBootstrapState,
    setNavigatorProgramError,
    ensureWriteAllowed,
    saveEnrolleeIntake
  })
  const {
    regulationReviewSettings: effectiveRegulationReviewSettings,
    regulationReviewDueItems,
    regulationReviewError,
    regulationTestHistory,
    regulationTestStripMarkers,
    latestCompletedMhSca,
    latestCompletedSvs,
    isRegulationCleared,
    shouldHideReadinessProgress,
    resolvedZCodeStripMarkers,
    isSavingRegulationTest,
    regulationTestError,
    saveRegulationReviewSettings,
    ensureRegulationReviewSettingForEnrollee,
    saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft
  } = useRegulationReviewState({
    scopedEnrollees,
    selectedEnrollee,
    viewerRole,
    resolvedZCodeStripMarkersFromActiveCodes,
    logs,
    ensureReviewWriteAllowed: () =>
      ensureWriteAllowed('regulationReview.write', 'save regulation review settings'),
    ensureTestWriteAllowed: () => ensureWriteAllowed('regulationTests.write', 'save regulation tests'),
    appendRouteLogRecord,
    setLogs,
    setNavigatorProgramError
  })

  const partnerServiceCapacityDefaultHeader = useMemo<PartnerServiceCapacityHeader>(
    () => buildPartnerServiceCapacityDefaultHeader(effectiveAccountSettings, viewerRole),
    [effectiveAccountSettings, viewerRole]
  )
  const currentNavigatorName = useMemo(
    () =>
      (remoteSession?.targetRole === 'navigator' ? remoteSession.targetDisplayName : effectiveAccountSettings.fullName).trim() ||
      selectedEnrollee?.assignedNavigator ||
      'atlas navigator',
    [effectiveAccountSettings.fullName, remoteSession?.targetDisplayName, remoteSession?.targetRole, selectedEnrollee?.assignedNavigator]
  )
  const currentSupervisorName = useMemo(
    () =>
      (remoteSession?.targetRole === 'supervisor' ? remoteSession.targetDisplayName : effectiveAccountSettings.fullName).trim() ||
      'peer supervisor',
    [effectiveAccountSettings.fullName, remoteSession?.targetDisplayName, remoteSession?.targetRole]
  )

  const supervisorNavigatorCompetency = useMemo<SupervisorNavigatorCompetencySummary[]>(
    () => buildSupervisorNavigatorCompetencySummaries(scopedEnrollees, navigatorCompetencyAssessments),
    [navigatorCompetencyAssessments, scopedEnrollees]
  )
  const supervisorNavigatorDirectory = useMemo<SupervisorNavigatorDirectoryEntry[]>(() => {
    if (!accessMatrixDataset) {
      const entries = Array.from(new Set(scopedEnrollees.map((enrollee) => enrollee.assignedNavigator).filter(Boolean))).map((name) => ({
        navigatorPersonId: `fallback:${name.toLowerCase()}`,
        navigatorName: name,
        assignedEnrolleeCount: scopedEnrollees.filter((enrollee) => enrollee.assignedNavigator === name).length,
        isManagedByCurrentSupervisor: false
      }))
      return entries.sort((left, right) => left.navigatorName.localeCompare(right.navigatorName))
    }
    const assignmentByNavigator = new Map(
      accessMatrixDataset.supervisorAssignments.map((assignment) => [assignment.navigatorPersonId, assignment])
    )
    const enrolleeCountByNavigatorId = new Map<string, number>()
    for (const assignment of accessMatrixDataset.enrollmentAssignments) {
      for (const navigatorPersonId of assignment.navigatorPersonIds) {
        enrolleeCountByNavigatorId.set(navigatorPersonId, (enrolleeCountByNavigatorId.get(navigatorPersonId) || 0) + 1)
      }
    }
    return accessMatrixDataset.people
      .filter((person) => person.roleKeys.includes('navigator'))
      .map((person) => ({
        navigatorPersonId: person.id,
        navigatorName: person.fullName,
        assignedEnrolleeCount: enrolleeCountByNavigatorId.get(person.id) || 0,
        isManagedByCurrentSupervisor: Boolean(
          viewerPerson && assignmentByNavigator.get(person.id)?.supervisorPersonIds.includes(viewerPerson.id)
        )
      }))
      .sort((left, right) => left.navigatorName.localeCompare(right.navigatorName))
  }, [accessMatrixDataset, scopedEnrollees, viewerPerson])
  const mergedNavigatorProgramState = useMemo(
    () => mergeNavigatorProgramState(navigatorProgramState, currentNavigatorName, currentSupervisorName, enrollees, enrollmentRequests, publicQueueRecords),
    [currentNavigatorName, currentSupervisorName, enrollees, enrollmentRequests, navigatorProgramState, publicQueueRecords]
  )
  const partnerStripJourneyModel = useMemo(
    () =>
      buildPartnerStripJourneyModel({
        isPartnerStationView,
        partnerOrganizationName: effectivePartnerOrganizationName,
        pickupQueue: mergedNavigatorProgramState.pickupQueue,
        logs,
        scopedEnrolleeIdSet,
        regulationTestHistory,
        routeAssignmentsByEnrolleeId,
        scopedEnrollees,
        serviceCapacityPromptByNormalizedZCode
      }),
    [
    effectivePartnerOrganizationName,
    isPartnerStationView,
    logs,
    mergedNavigatorProgramState.pickupQueue,
    regulationTestHistory,
    routeAssignmentsByEnrolleeId,
    scopedEnrolleeIdSet,
    scopedEnrollees,
    serviceCapacityPromptByNormalizedZCode
    ]
  )
  const {
    navigatorSelfAssessments,
    navigatorSelfAssessmentSummary,
    navigatorIpsccEncounterSubmissions,
    navigatorIpsSelfAssessments,
    allSupervisorIpsAssessments,
    navigatorSupervisorIpsAssessments,
    navigatorCreateSessions,
    navigatorIpsccCompetencyAggregates,
    navigatorIpsccEnrolleeFeedbackPrivacy,
    navigatorSelfAwarenessCorrelation,
    navigatorCreateInsights,
    navigatorSupervisionSessions,
    navigatorIntervalRules,
    navigatorIntervalDueItems
  } = useNavigatorCompetencyDerived({
    currentNavigatorName,
    mergedNavigatorProgramState,
    navigatorCompetencyAssessments
  })
  const {
    navigatorCreateReflection,
    supervisorManagedCreateReflections,
    saveNavigatorCreateSession,
    saveSupervisorCreateReflectionOverride,
    restoreSupervisorCreateReflectionGenerated
  } = useCreateReflectionActions({
    currentNavigatorName,
    currentSupervisorName,
    managedNavigatorNames: supervisorNavigatorDirectory
      .filter((row) => row.isManagedByCurrentSupervisor)
      .map((row) => row.navigatorName),
    mergedNavigatorProgramState,
    setNavigatorProgramState,
    setNavigatorProgramError,
    ensureWriteAllowed,
    saveNavigatorProgramState: (state) => saveNavigatorProgramState(state)
  })
  const {
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
  } = usePickupQueueActions({
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
  })
  const {
    savePartnerTroubleshootingGrant,
    startTroubleshootingSession,
    stopTroubleshootingSession
  } = useRemoteTroubleshootingSession({
    accessMatrixDataset,
    partnerTroubleshootingGrants,
    setPartnerTroubleshootingGrants,
    setRemoteSession,
    ensureAdminPermissionWrite
  })
  const { assignNavigatorEnrollmentToSelf } = useNavigatorEnrollmentActions({
    viewerCanUseAssignmentActions,
    navigatorEnrollmentAssignments,
    enrollees,
    setAssigningNavigatorEnrollmentId,
    setNavigatorEnrollmentAssignmentsError,
    setPendingAssignmentEnrollees,
    updatePickupQueueStatus,
    claimPickupQueueRecord,
    refreshAssignmentParityViews
  })
  const navigatorAssignedCompetencySummary = useMemo(
    () =>
      supervisorNavigatorCompetency.find((summary) => summary.navigatorName === currentNavigatorName) ||
      supervisorNavigatorCompetency[0] ||
      null,
    [currentNavigatorName, supervisorNavigatorCompetency]
  )
  const navigatorAggregateLoad = useMemo(() => deriveNavigatorLoad(scopedLoads), [scopedLoads])
  const navigatorLoadContributors = useMemo(
    () => deriveNavigatorLoadContributors(scopedEnrollees, scopedLoads),
    [scopedEnrollees, scopedLoads]
  )
  const navigatorAggregateLoadBreakdown = useMemo(
    () => deriveNavigatorLoadBreakdown(scopedLoadBreakdownsByEnrolleeId, currentNavigatorName),
    [currentNavigatorName, scopedLoadBreakdownsByEnrolleeId]
  )
  const pickupQueue = useMemo(
    () => {
      const visibleQueue = mergedNavigatorProgramState.pickupQueue.filter((item) => item.status !== 'archived')
      if (!isPartnerStationView) {
        return visibleQueue
          .slice()
          .sort((left, right) => new Date(right.referredAtIso).getTime() - new Date(left.referredAtIso).getTime())
      }

      const normalizedOrg = normalizeOrganizationKey(effectivePartnerOrganizationName)
      const scopedQueue = normalizedOrg
        ? visibleQueue.filter(
            (item) => normalizeOrganizationKey(item.referrerOrganization) === normalizedOrg
          )
        : visibleQueue
      return scopedQueue
        .slice()
        .sort((left, right) => new Date(right.referredAtIso).getTime() - new Date(left.referredAtIso).getTime())
    },
    [effectivePartnerOrganizationName, isPartnerStationView, mergedNavigatorProgramState.pickupQueue]
  )
  const pickupQueueForAssignmentBoard = useMemo(() => {
    const normalizedOrg = normalizeOrganizationKey(effectivePartnerOrganizationName)
    if (isPartnerStationView) {
      return normalizedOrg
        ? mergedNavigatorProgramState.pickupQueue.filter(
            (item) => normalizeOrganizationKey(item.referrerOrganization) === normalizedOrg
          )
        : mergedNavigatorProgramState.pickupQueue
    }
    return mergedNavigatorProgramState.pickupQueue
  }, [effectivePartnerOrganizationName, isPartnerStationView, mergedNavigatorProgramState.pickupQueue])
  const navigatorAssignmentBoardRows = useMemo(() => {
    const pendingReferralRows = buildPendingReferralAssignmentRows(pickupQueueForAssignmentBoard, navigatorEnrollmentAssignments)
    return [...pendingReferralRows, ...navigatorEnrollmentAssignments].sort((left, right) =>
      left.enrolleeName.localeCompare(right.enrolleeName)
    )
  }, [navigatorEnrollmentAssignments, pickupQueueForAssignmentBoard])
  const { journeyStationMarkers, setJourneyStationMarkers } = useJourneyStationMarkers(selectedEnrollee, selectedLogs, routeCandidates)
  const {
    partnerServiceCapacitySurveyHistory,
    partnerServiceCapacitySurveyError,
    setPartnerServiceCapacitySurveyHistory,
    setPartnerServiceCapacitySurveyError
  } = usePartnerServiceCapacityHistory(viewerRole, effectivePartnerOrganizationName)
  const {
    isSavingPartnerServiceCapacitySurvey,
    isSavingEnrolleeBurdenSurvey,
    enrolleeBurdenSurveyError,
    enrolleeBurdenSurveyHistoryByEnrollmentId,
    savePartnerServiceCapacitySurvey,
    reloadEnrolleeBurdenSurveyHistoryForEnrollment,
    saveEnrolleeBurdenSurvey,
    reloadPartnerServiceCapacitySurveyHistory,
    deletePartnerServiceCapacityDraft,
    deleteEnrolleeBurdenSurveyDraft
  } = usePartnerSurveyActions({
    viewerRole,
    effectivePartnerOrganizationName,
    accountSettings,
    partnerServiceCapacitySurveyHistory,
    setPartnerServiceCapacitySurveyHistory,
    setPartnerServiceCapacitySurveyError,
    setBootstrapState,
    ensurePartnerSurveyWriteAllowed: () =>
      ensureWriteAllowed('partnerReferral.submit', 'save partner service-capacity surveys'),
    ensureEnrolleeSurveyWriteAllowed: (actionLabel) => ensureWriteAllowed('intake.write', actionLabel)
  })

  // Partner My Station debut: hide the menu until capacity commissioning + specialization clarity.
  // Administrator troubleshooting sessions keep grant-selected menus so ops can inspect early shells.
  const partnerMyStationDebut = useMemo(
    () =>
      evaluatePartnerMyStationDebut({
        stationProfile: effectivePartnerStationProfile,
        surveyHistory: partnerServiceCapacitySurveyHistory
      }),
    [effectivePartnerStationProfile, partnerServiceCapacitySurveyHistory]
  )
  const selectedRoleConfig = useMemo(() => {
    if (viewerRole !== 'partner' || remoteSession?.isActive) return baseSelectedRoleConfig
    return applyPartnerMyStationDebutMenuGate(baseSelectedRoleConfig, partnerMyStationDebut.canDebut)
  }, [baseSelectedRoleConfig, partnerMyStationDebut.canDebut, remoteSession?.isActive, viewerRole])
  const selectedRoleTopMenus = useMemo(
    () => selectedRoleConfig.topMenus.filter((menu) => Boolean(menu && menu.trim())),
    [selectedRoleConfig.topMenus]
  )
  const selectedRoleTopMenusKey = useMemo(() => selectedRoleTopMenus.join('||'), [selectedRoleTopMenus])

  useSinglePaneBootstrapEffects({
    role,
    viewerRole,
    activeMenu,
    selectedRoleTopMenus,
    selectedRoleTopMenusKey,
    remoteSession,
    setRemoteSession,
    setRoleState,
    setActiveMenu,
    sessionEmail,
    setSessionEmail,
    authoritativeAccountRoles,
    setAuthoritativeAccountRoles,
    adminDefaultAppliedForEmailRef,
    accountSettings,
    viewerPerson,
    remotePartnerOrganizationName: remotePartnerAssignment?.organizationName || null,
    navigatorAssignmentProfiles,
    scopedEnrollees,
    enrollees,
    setBootstrapState,
    setNavigatorProgramState,
    setNavigatorProgramError,
    setPartnerTroubleshootingGrants,
    setRemotePartnerStationProfile,
    setNavigatorEnrollmentAssignments,
    setNavigatorEnrollmentAssignmentsError,
    setIsLoadingNavigatorEnrollmentAssignments,
    setPendingAssignmentEnrollees,
    setDemoTaggedEnrollmentIds,
    setPublicQueueRecords,
    setZCodeDomainSurveyHistorySummary,
    setZCodeDomainSurveyHistoryError,
    setAdminDeletableServiceCapacitySubmissions,
    setAdminServiceCapacityDeletionError,
    reloadZCodeDomainSurveyHistory,
    reloadAdminDeletableServiceCapacitySubmissions
  })

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
      const stationOrganizationName = viewerRole === 'navigator'
        ? partnerStationProfile?.organizationName?.trim() || saved.organization
        : saved.organization
      const stationProfile = await loadPartnerStationProfile(stationOrganizationName, {
        fullName: saved.fullName,
        email: saved.email
      })
      setBootstrapState((current) => ({
        ...current,
        accountSettings: saved,
        partnerStationProfile: stationProfile
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
          [saved.enrolleeId]: saved
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
                zCodeTags: saved.zCodeTags
              }
            : enrollee
        ),
        timelineConfigsByEnrolleeId: {
          ...current.timelineConfigsByEnrolleeId,
          [saved.enrolleeId]: current.timelineConfigsByEnrolleeId[saved.enrolleeId]
            ? { ...current.timelineConfigsByEnrolleeId[saved.enrolleeId], planStartIso: saved.enrollmentStartIso }
            : createDefaultTimelineConfig(saved.enrollmentStartIso)
        }
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
      matchedZCodes: candidate.matchedZCodes
    }
    persistRouteAssignment(assignment).then((saved) => {
      setBootstrapState((current) => ({
        ...current,
        routeAssignmentsByEnrolleeId: {
          ...current.routeAssignmentsByEnrolleeId,
          [saved.enrolleeId]: saved
        }
      }))
      invalidateJourneyStationMarkersCache(selectedEnrollee.enrollmentId)
      void refreshAssignmentParityViews()
    })
  }

  async function setEnrolleeZCodeResolution(
    enrolleeZCodeId: string,
    isResolved: boolean,
    input: EnrolleeZCodeResolutionInput = {}
  ) {
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
                resolutionPartnerId: saved.resolutionPartnerId ?? (saved.isResolved ? input.partnerId ?? null : null),
                resolutionPartnerName: saved.resolutionPartnerName ?? (saved.isResolved ? input.partnerName ?? null : null),
                resolutionNote: saved.resolutionNote ?? (saved.isResolved ? input.resolutionNote?.trim() || null : null),
                // Readiness criteria echo whatever the Remote Procedure Call
                // (RPC) persisted so pills stay in sync without a refetch.
                codeReviewStatus: saved.codeReviewStatus,
                confidenceLevel: saved.confidenceLevel
              }
            : detail
        )
        return {
          ...enrollee,
          activeZCodeDetails,
          completedParentCodes: buildCompletedParentCodes(activeZCodeDetails)
        }
      })
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
          completedParentCodes: buildCompletedParentCodes(saved.activeZCodeDetails)
        }
      })
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
      setZCodeDomainSurveyHistoryError(
        error instanceof Error ? error.message : 'Unable to load z-code domain survey history.'
      )
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
      setAdminServiceCapacityDeletionError(
        toSupabaseErrorMessage(error, 'Unable to load deletable service capacity survey records.')
      )
    } finally {
      setIsLoadingAdminDeletableServiceCapacitySubmissions(false)
    }
  }

  async function setZCodeDomainSurveyAnswerNullification(input: {
    answerId: string
    isNullified: boolean
    nullifiedReason?: string | null
  }) {
    ensureAdminPermissionWrite('nullify z-code domain survey answers')
    setIsSavingZCodeDomainSurveyNullification(true)
    setZCodeDomainSurveyHistoryError(null)
    try {
      await setZCodeDomainSurveyAnswerNullified({
        answerId: input.answerId,
        isNullified: input.isNullified,
        nullifiedByEmail: effectiveAccountSettings.email || null,
        nullifiedReason: input.nullifiedReason || null
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

  async function deleteAdminServiceCapacitySubmission(input: {
    submissionId: string
    reasonCode: PartnerServiceCapacityDeletionReasonCode
    reasonOtherText?: string | null
  }) {
    ensureAdminPermissionWrite('delete service-capacity survey submissions')
    setDeletingAdminServiceCapacitySubmissionId(input.submissionId)
    setAdminServiceCapacityDeletionError(null)
    try {
      await deleteAdminServiceCapacitySubmissionRecord(input)
      // Refresh both grids because deleting one submission affects domain history
      // rollups and the deletable-record inventory at the same time.
      await Promise.all([
        reloadZCodeDomainSurveyHistory(),
        reloadAdminDeletableServiceCapacitySubmissions()
      ])
    } catch (error) {
      setAdminServiceCapacityDeletionError(
        toSupabaseErrorMessage(error, 'Unable to delete the selected survey record.')
      )
      throw error
    } finally {
      setDeletingAdminServiceCapacitySubmissionId(null)
    }
  }

  async function saveNavigatorCompetencyAssessment(input: {
    navigatorName: string
    supervisorName: string
    formVersion: string
    answers: NavigatorCompetencyAssessmentRecord['answers']
  }) {
    ensureWriteAllowed('navigatorProgram.write', 'save navigator competency assessments')
    const saved = await persistNavigatorCompetencyAssessment(input)
    setBootstrapState((current) => ({
      ...current,
      navigatorCompetencyAssessments: [saved, ...current.navigatorCompetencyAssessments]
    }))
    return saved
  }

  async function refreshAssignmentParityViews() {
    await Promise.all([
      // Assignment board and bootstrap are the canonical read paths for navigator claim state.
      loadNavigatorEnrollmentAssignments({ profileRows: navigatorAssignmentProfiles }).then((rows) => {
        setNavigatorEnrollmentAssignments(rows)
        setNavigatorEnrollmentAssignmentsError(null)
      }),
      reloadBootstrapState()
    ])
  }

  type SinglePaneWriteActionKey =
    | 'intake.write'
    | 'zcodes.write'
    | 'routeAssignment.write'
    | 'routeLogs.write'
    | 'timeline.write'
    | 'navigatorProgram.write'
    | 'regulationReview.write'
    | 'regulationTests.write'
    | 'partnerReferral.submit'

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

  async function ensurePartnerIdentifier(header: {
    firstName: string
    lastName: string
    organizationName: string
    email?: string | null
  }): Promise<PartnerIdentifierRecord> {
    return ensurePartnerIdentifierRecordForSurvey(header)
  }

  const setRole = useCallback(
    (nextRole: AtlasRole) => {
      // Active experience switching is admin-only. Non-admin users remain pinned
      // to their permission-scoped experience (their JWT-authoritative role).
      if (!authoritativeAccountRoles.includes('administrator')) return
      setRoleState(nextRole)
    },
    [authoritativeAccountRoles]
  )

  return {
    role,
    viewerRole,
    setRole,
    remoteSession,
    partnerTroubleshootingGrants,
    selectedEnrolleeId,
    setSelectedEnrolleeId,
    activeMenu,
    setActiveMenu,
    isLoading,
    bootstrapError,
    enrollees: scopedEnrollees,
    selectedEnrollee,
    selectedLoad: effectiveSelectedLoad,
    selectedLoadBreakdown: effectiveSelectedLoadBreakdown,
    selectedLogs,
    selectedRoleConfig,
    partnerMyStationDebut,
    timelineConfig: selectedTimelineConfig,
    enrollmentRequests,
    routeCandidates,
    countyHeatmap,
    adminMetrics,
    zCodeDomainSurveyHistorySummary,
    adminDeletableServiceCapacitySubmissions,
    isLoadingAdminDeletableServiceCapacitySubmissions,
    deletingAdminServiceCapacitySubmissionId,
    adminServiceCapacityDeletionError,
    isLoadingZCodeDomainSurveyHistorySummary,
    isSavingZCodeDomainSurveyNullification,
    zCodeDomainSurveyHistoryError,
    partnerStationSpecialties,
    adminPortalRegistry,
    adminPortalRegistryError,
    accessMatrixDataset,
    accessMatrixError,
    navigatorProgramState: mergedNavigatorProgramState,
    navigatorProgramError,
    journeyStationMarkers,
    partnerStripReferredDots: partnerStripJourneyModel.referredDots,
    partnerStripActiveDots: partnerStripJourneyModel.activeDots,
    partnerStripSuccessHistory: partnerStripJourneyModel.successHistory,
    resolvedZCodeStripMarkers,
    partnerServiceCapacitySurveyHistory,
    enrolleeBurdenSurveyHistoryByEnrollmentId,
    setPartnerServiceCapacitySurveyHistory,
    partnerServiceCapacityDefaultHeader,
    isSavingPartnerServiceCapacitySurvey,
    partnerServiceCapacitySurveyError,
    isSavingEnrolleeBurdenSurvey,
    enrolleeBurdenSurveyError,
    reloadPartnerServiceCapacitySurveyHistory,
    regulationTestHistory,
    regulationTestStripMarkers,
    latestCompletedMhSca,
    latestCompletedSvs,
    isRegulationCleared,
    shouldHideReadinessProgress,
    isSavingRegulationTest,
    regulationTestError,
    isUploadingProfileImage,
    profileImageUploadError,
    isUploadingAccountProfileImage,
    accountProfileImageUploadError,
    currentNavigatorName,
    currentSupervisorName,
    canSwitchActiveExperience,
    navigatorAggregateLoad,
    navigatorLoadContributors,
    navigatorAggregateLoadBreakdown,
    pickupQueue,
    navigatorIpsccEncounterSubmissions,
    navigatorIpsccCompetencyAggregates,
    navigatorIpsccEnrolleeFeedbackPrivacy,
    navigatorIpsSelfAssessments,
    navigatorSupervisorIpsAssessments,
    allSupervisorIpsAssessments,
    navigatorSelfAwarenessCorrelationRows: navigatorSelfAwarenessCorrelation.rows,
    navigatorSelfAwarenessSummary: navigatorSelfAwarenessCorrelation.summary,
    navigatorCreateSessions,
    navigatorCreateInsights,
    navigatorCreateReflection,
    supervisorManagedCreateReflections,
    navigatorSelfAssessments,
    navigatorSelfAssessmentSummary,
    navigatorEnrollmentAssignments: navigatorAssignmentBoardRows,
    viewerCanViewNavigatorAssignmentNames,
    viewerCanAccessAssignmentBoard,
    viewerCanUseAssignmentActions,
    viewerCanAddAssignmentBoardReferral,
    viewerCanAccessAdminRegistryCards,
    navigatorEnrollmentAssignmentsError,
    isLoadingNavigatorEnrollmentAssignments,
    assigningNavigatorEnrollmentId,
    pendingAssignmentEnrollees,
    navigatorSupervisionSessions,
    navigatorAssignedCompetencySummary,
    supervisorNavigatorDirectory,
    navigatorIntervalRules,
    navigatorIntervalDueItems,
    regulationReviewSettings: effectiveRegulationReviewSettings,
    regulationReviewDueItems,
    regulationReviewError,
    saveRegulationReviewSettings,
    searchPartnerIdentifierMatches,
    ensurePartnerIdentifier,
    supervisorNavigatorCompetency,
    navigatorCompetencyAssessments,
    selectedRouteAssignment,
    appendRouteLog,
    deleteRouteLog,
    updateRouteLogTimelinePosition,
    updateRouteLogDate,
    updateTimelineStartDate,
    updateTimelinePhaseDuration,
    updateTimelineConfig,
    accountSettings: effectiveAccountSettings,
    partnerStationProfile: effectivePartnerStationProfile,
    intakeFormsByEnrolleeId,
    selectedIntake,
    hasSavedIntake,
    isSavingAdminPortalRegistry,
    isSavingAccessMatrix,
    viewerCanWrite: remoteSession?.targetRole === 'partner' ? Boolean(remoteSession.partnerGrant?.allowWrite) : true,
    saveAccountSettings,
    saveAdminPortalRegistry,
    saveAccessMatrixPersonRoles,
    saveAccessMatrixEnrollmentNavigators,
    saveAccessMatrixSupervisorAssignments,
    toggleSupervisorManagedNavigator,
    assignNavigatorEnrollmentToSelf,
    saveAccessMatrixPartnerPrimaryContacts,
    startTroubleshootingSession,
    stopTroubleshootingSession,
    savePartnerTroubleshootingGrant,
    saveNavigatorProgramState,
    claimPickupQueueRecord,
    saveNavigatorSelfAssessment,
    saveNavigatorIpsSelfAssessment,
    saveSupervisorIpsAssessment,
    saveNavigatorIpsccEncounterSubmission,
    saveNavigatorCreateSession,
    saveSupervisorCreateReflectionOverride,
    restoreSupervisorCreateReflectionGenerated,
    saveSupervisionSession,
    saveIntervalAssessmentRule,
    submitPartnerReferral,
    replaceAccountProfileImage,
    replaceSelectedEnrolleeProfileImage,
    saveEnrolleeIntake,
    setEnrolleeZCodeResolution,
    overrideEnrolleeZCodes,
    saveRouteAssignment,
    savePartnerServiceCapacitySurvey,
    setZCodeDomainSurveyAnswerNullification,
    deleteAdminServiceCapacitySubmission,
    saveEnrolleeBurdenSurvey,
    deletePartnerServiceCapacityDraft,
    deleteEnrolleeBurdenSurveyDraft,
    reloadEnrolleeBurdenSurveyHistoryForEnrollment,
    saveNavigatorCompetencyAssessment,
    saveNavigatorRegulationTest,
    deleteNavigatorRegulationTestDraft
  }
}
