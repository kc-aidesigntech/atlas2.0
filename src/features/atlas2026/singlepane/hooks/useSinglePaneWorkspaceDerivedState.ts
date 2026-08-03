import { useMemo } from 'react'
import type { PartnerServiceCapacityHeader, SupervisorNavigatorCompetencySummary } from '@/features/atlas2026/shared/contracts'
import { appendRouteLog as appendRouteLogRecord } from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { useJourneyStationMarkers } from '@/features/atlas2026/singlepane/hooks/useJourneyStationMarkers'
import { useCreateReflectionActions } from '@/features/atlas2026/singlepane/hooks/useCreateReflectionActions'
import { useNavigatorCompetencyDerived } from '@/features/atlas2026/singlepane/hooks/useNavigatorCompetencyDerived'
import { useNavigatorEnrollmentActions } from '@/features/atlas2026/singlepane/hooks/useNavigatorEnrollmentActions'
import { usePartnerServiceCapacityHistory } from '@/features/atlas2026/singlepane/hooks/usePartnerServiceCapacityHistory'
import { usePartnerSurveyActions } from '@/features/atlas2026/singlepane/hooks/usePartnerSurveyActions'
import { useProfileImageUploads } from '@/features/atlas2026/singlepane/hooks/useProfileImageUploads'
import { useRegulationReviewState } from '@/features/atlas2026/singlepane/hooks/useRegulationReviewState'
import { useRouteCandidates } from '@/features/atlas2026/singlepane/hooks/useRouteCandidates'
import { useSinglePaneBootstrapEffects } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapEffects'
import { useRouteLogTimelineActions } from '@/features/atlas2026/singlepane/hooks/useRouteLogTimelineActions'
import { useRemoteTroubleshootingSession } from '@/features/atlas2026/singlepane/hooks/useRemoteTroubleshootingSession'
import { usePickupQueueActions } from '@/features/atlas2026/singlepane/hooks/usePickupQueueActions'
import { toNormalizedRadialDomainLoad } from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { applyPartnerMyStationDebutMenuGate, evaluatePartnerMyStationDebut } from '@/features/atlas2026/singlepane/data-access/partnerMyStationDebut'
import { buildPartnerServiceCapacityDefaultHeader, buildSupervisorNavigatorCompetencySummaries } from '@/features/atlas2026/singlepane/useSinglePaneDataTransforms'
import { buildResolvedZCodeStripMarkers } from '@/features/atlas2026/singlepane/domain/phaseAndZCodes'
import { mergeNavigatorProgramState } from '@/features/atlas2026/singlepane/domain/ipsccSeeds'
import { buildPendingReferralAssignmentRows } from '@/features/atlas2026/singlepane/domain/enrollmentPickup'
import { buildNavigatorRouteBoardLoadBreakdown, deriveNavigatorLoad, deriveNavigatorLoadBreakdown, deriveNavigatorLoadContributors } from '@/features/atlas2026/singlepane/domain/loadsRoutes'
import { buildPartnerStripJourneyModel } from '@/features/atlas2026/singlepane/domain/partnerStripJourney'
import { normalizeOrganizationKey } from '@/features/atlas2026/singlepane/domain/dates'
import { dedupeMenus } from '@/features/atlas2026/singlepane/domain/roles'

interface SupervisorNavigatorDirectoryEntry {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

type WorkspaceDerivedContext = Record<string, any>

/**
 * Composes workspace-specific domain hooks and memoized projections outside the
 * public facade while preserving the same hook order and callback identities.
 */
export function useSinglePaneWorkspaceDerivedState(context: WorkspaceDerivedContext) {
  const {
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
    reloadZCodeDomainSurveyHistory, reloadAdminDeletableServiceCapacitySubmissions,
  } = context

  const routeCandidates = useRouteCandidates(selectedEnrollee)
  const { isUploadingProfileImage, profileImageUploadError, isUploadingAccountProfileImage, accountProfileImageUploadError, replaceAccountProfileImage, replaceSelectedEnrolleeProfileImage } = useProfileImageUploads({
    remoteSessionActive: Boolean(remoteSession),
    accountSettings,
    viewerRole,
    partnerStationProfile,
    selectedEnrollee,
    setBootstrapState,
    ensureEnrolleeImageWriteAllowed: () => ensureWriteAllowed('intake.write', 'replace enrollee profile images'),
  })
  const navigatorRouteBoardLoadBreakdown = useMemo(() => (viewerRole === 'navigator' ? buildNavigatorRouteBoardLoadBreakdown(selectedEnrollee, routeCandidates) : null), [routeCandidates, selectedEnrollee, viewerRole])
  const effectiveSelectedLoadBreakdown = useMemo(() => navigatorRouteBoardLoadBreakdown || selectedLoadBreakdown, [navigatorRouteBoardLoadBreakdown, selectedLoadBreakdown])
  const effectiveSelectedLoad = useMemo(() => toNormalizedRadialDomainLoad(effectiveSelectedLoadBreakdown) || selectedLoad, [effectiveSelectedLoadBreakdown, selectedLoad])

  // Base role menus before partner My Station debut commissioning is applied. Troubleshooting
  // grants still constrain remote partner shells here; debut gating is applied after survey history loads.
  const baseSelectedRoleConfig = useMemo(() => {
    const baseConfig = roleConfigs.find((item) => item.role === viewerRole) || roleConfigs[0] || { role: viewerRole, topMenus: [], actionMenus: [] }
    if (remoteSession?.targetRole !== 'partner') return baseConfig
    const allowedMenus = dedupeMenus(remoteSession.partnerGrant?.allowedMenus || [])
    return { ...baseConfig, topMenus: allowedMenus.length ? baseConfig.topMenus.filter((menu) => allowedMenus.includes(menu)) : [] }
  }, [remoteSession?.partnerGrant?.allowedMenus, remoteSession?.targetRole, roleConfigs, viewerRole])
  const selectedRouteAssignment = useMemo(() => selectedEnrollee ? routeAssignmentsByEnrolleeId[selectedEnrollee.id] || null : null, [routeAssignmentsByEnrolleeId, selectedEnrollee])
  const resolvedZCodeStripMarkersFromActiveCodes = useMemo(() => buildResolvedZCodeStripMarkers(selectedEnrollee?.activeZCodeDetails || []), [selectedEnrollee?.activeZCodeDetails])
  const routeLogActions = useRouteLogTimelineActions({
    logs, selectedEnrollee, selectedLogs, selectedTimelineConfig, selectedIntake,
    setBootstrapState, setNavigatorProgramError, ensureWriteAllowed, saveEnrolleeIntake,
  })
  const regulation = useRegulationReviewState({
    scopedEnrollees, selectedEnrollee, viewerRole, resolvedZCodeStripMarkersFromActiveCodes, logs,
    ensureReviewWriteAllowed: () => ensureWriteAllowed('regulationReview.write', 'save regulation review settings'),
    ensureTestWriteAllowed: () => ensureWriteAllowed('regulationTests.write', 'save regulation tests'),
    appendRouteLogRecord, setLogs: routeLogActions.setLogs, setNavigatorProgramError,
  })
  const partnerServiceCapacityDefaultHeader = useMemo<PartnerServiceCapacityHeader>(() => buildPartnerServiceCapacityDefaultHeader(effectiveAccountSettings, viewerRole), [effectiveAccountSettings, viewerRole])
  const currentNavigatorName = useMemo(() => (remoteSession?.targetRole === 'navigator' ? remoteSession.targetDisplayName : effectiveAccountSettings.fullName).trim() || selectedEnrollee?.assignedNavigator || 'atlas navigator', [effectiveAccountSettings.fullName, remoteSession?.targetDisplayName, remoteSession?.targetRole, selectedEnrollee?.assignedNavigator])
  const currentSupervisorName = useMemo(() => (remoteSession?.targetRole === 'supervisor' ? remoteSession.targetDisplayName : effectiveAccountSettings.fullName).trim() || 'peer supervisor', [effectiveAccountSettings.fullName, remoteSession?.targetDisplayName, remoteSession?.targetRole])
  const supervisorNavigatorCompetency = useMemo<SupervisorNavigatorCompetencySummary[]>(() => buildSupervisorNavigatorCompetencySummaries(scopedEnrollees, navigatorCompetencyAssessments), [navigatorCompetencyAssessments, scopedEnrollees])
  const supervisorNavigatorDirectory = useMemo<SupervisorNavigatorDirectoryEntry[]>(() => {
    if (!accessMatrixDataset) {
      return Array.from(new Set(scopedEnrollees.map((enrollee) => enrollee.assignedNavigator).filter(Boolean)))
        .map((name) => ({
          navigatorPersonId: `fallback:${name.toLowerCase()}`,
          navigatorName: name,
          assignedEnrolleeCount: scopedEnrollees.filter((enrollee) => enrollee.assignedNavigator === name).length,
          isManagedByCurrentSupervisor: false,
        }))
        .sort((left, right) => left.navigatorName.localeCompare(right.navigatorName))
    }
    const assignments = new Map(accessMatrixDataset.supervisorAssignments.map((assignment) => [assignment.navigatorPersonId, assignment]))
    const counts = new Map<string, number>()
    accessMatrixDataset.enrollmentAssignments.forEach((assignment) => assignment.navigatorPersonIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)))
    return accessMatrixDataset.people
      .filter((person) => person.roleKeys.includes('navigator'))
      .map((person) => ({
        navigatorPersonId: person.id, navigatorName: person.fullName,
        assignedEnrolleeCount: counts.get(person.id) || 0,
        isManagedByCurrentSupervisor: Boolean(viewerPerson && assignments.get(person.id)?.supervisorPersonIds.includes(viewerPerson.id)),
      }))
      .sort((left, right) => left.navigatorName.localeCompare(right.navigatorName))
  }, [accessMatrixDataset, scopedEnrollees, viewerPerson])
  const mergedNavigatorProgramState = useMemo(() => mergeNavigatorProgramState(navigatorProgramState, currentNavigatorName, currentSupervisorName, enrollees, enrollmentRequests, publicQueueRecords), [currentNavigatorName, currentSupervisorName, enrollees, enrollmentRequests, navigatorProgramState, publicQueueRecords])
  const partnerStripJourneyModel = useMemo(() => buildPartnerStripJourneyModel({
    isPartnerStationView, partnerOrganizationName: effectivePartnerOrganizationName,
    pickupQueue: mergedNavigatorProgramState.pickupQueue, logs, scopedEnrolleeIdSet,
    regulationTestHistory: regulation.regulationTestHistory, routeAssignmentsByEnrolleeId,
    scopedEnrollees, serviceCapacityPromptByNormalizedZCode,
  }), [effectivePartnerOrganizationName, isPartnerStationView, logs, mergedNavigatorProgramState.pickupQueue, regulation.regulationTestHistory, routeAssignmentsByEnrolleeId, scopedEnrolleeIdSet, scopedEnrollees, serviceCapacityPromptByNormalizedZCode])
  const competency = useNavigatorCompetencyDerived({ currentNavigatorName, mergedNavigatorProgramState, navigatorCompetencyAssessments })
  const reflection = useCreateReflectionActions({
    currentNavigatorName, currentSupervisorName,
    managedNavigatorNames: supervisorNavigatorDirectory.filter((row) => row.isManagedByCurrentSupervisor).map((row) => row.navigatorName),
    mergedNavigatorProgramState, setNavigatorProgramState, setNavigatorProgramError, ensureWriteAllowed,
    saveNavigatorProgramState: (state) => pickup.saveNavigatorProgramState(state),
  })
  const pickup = usePickupQueueActions({
    role, accountSettings, effectiveAccountSettings, effectivePartnerStationProfile,
    currentNavigatorName, mergedNavigatorProgramState, setNavigatorProgramState,
    setNavigatorProgramError, setPublicQueueRecords, ensureWriteAllowed,
    ensureRegulationReviewSettingForEnrollee: regulation.ensureRegulationReviewSettingForEnrollee,
    refreshAssignmentParityViews,
  })
  const troubleshooting = useRemoteTroubleshootingSession({
    accessMatrixDataset, partnerTroubleshootingGrants, setPartnerTroubleshootingGrants,
    setRemoteSession, ensureAdminPermissionWrite,
  })
  const enrollment = useNavigatorEnrollmentActions({
    viewerCanUseAssignmentActions, navigatorEnrollmentAssignments, enrollees,
    setAssigningNavigatorEnrollmentId, setNavigatorEnrollmentAssignmentsError,
    setPendingAssignmentEnrollees, updatePickupQueueStatus: pickup.updatePickupQueueStatus,
    claimPickupQueueRecord: pickup.claimPickupQueueRecord, refreshAssignmentParityViews,
  })
  const navigatorAssignedCompetencySummary = useMemo(() => supervisorNavigatorCompetency.find((summary) => summary.navigatorName === currentNavigatorName) || supervisorNavigatorCompetency[0] || null, [currentNavigatorName, supervisorNavigatorCompetency])
  const navigatorAggregateLoad = useMemo(() => deriveNavigatorLoad(scopedLoads), [scopedLoads])
  const navigatorLoadContributors = useMemo(() => deriveNavigatorLoadContributors(scopedEnrollees, scopedLoads), [scopedEnrollees, scopedLoads])
  const navigatorAggregateLoadBreakdown = useMemo(() => deriveNavigatorLoadBreakdown(scopedLoadBreakdownsByEnrolleeId, currentNavigatorName), [currentNavigatorName, scopedLoadBreakdownsByEnrolleeId])
  const pickupQueue = useMemo(() => {
    const visible = mergedNavigatorProgramState.pickupQueue.filter((item) => item.status !== 'archived')
    const organization = normalizeOrganizationKey(effectivePartnerOrganizationName)
    const scoped = isPartnerStationView && organization ? visible.filter((item) => normalizeOrganizationKey(item.referrerOrganization) === organization) : visible
    return scoped.slice().sort((left, right) => new Date(right.referredAtIso).getTime() - new Date(left.referredAtIso).getTime())
  }, [effectivePartnerOrganizationName, isPartnerStationView, mergedNavigatorProgramState.pickupQueue])
  const navigatorAssignmentBoardRows = useMemo(() => {
    const organization = normalizeOrganizationKey(effectivePartnerOrganizationName)
    const source = isPartnerStationView && organization
      ? mergedNavigatorProgramState.pickupQueue.filter((item) => normalizeOrganizationKey(item.referrerOrganization) === organization)
      : mergedNavigatorProgramState.pickupQueue
    return [...buildPendingReferralAssignmentRows(source, navigatorEnrollmentAssignments), ...navigatorEnrollmentAssignments]
      .sort((left, right) => left.enrolleeName.localeCompare(right.enrolleeName))
  }, [effectivePartnerOrganizationName, isPartnerStationView, mergedNavigatorProgramState.pickupQueue, navigatorEnrollmentAssignments])
  const journey = useJourneyStationMarkers(selectedEnrollee, selectedLogs, routeCandidates)
  const partnerHistory = usePartnerServiceCapacityHistory(viewerRole, effectivePartnerOrganizationName)
  const surveys = usePartnerSurveyActions({
    viewerRole, effectivePartnerOrganizationName, accountSettings,
    partnerServiceCapacitySurveyHistory: partnerHistory.partnerServiceCapacitySurveyHistory,
    setPartnerServiceCapacitySurveyHistory: partnerHistory.setPartnerServiceCapacitySurveyHistory,
    setPartnerServiceCapacitySurveyError: partnerHistory.setPartnerServiceCapacitySurveyError,
    setBootstrapState,
    ensurePartnerSurveyWriteAllowed: () => ensureWriteAllowed('partnerReferral.submit', 'save partner service-capacity surveys'),
    ensureEnrolleeSurveyWriteAllowed: (label) => ensureWriteAllowed('intake.write', label),
  })
  const partnerMyStationDebut = useMemo(() => evaluatePartnerMyStationDebut({
    stationProfile: effectivePartnerStationProfile,
    surveyHistory: partnerHistory.partnerServiceCapacitySurveyHistory,
  }), [effectivePartnerStationProfile, partnerHistory.partnerServiceCapacitySurveyHistory])
  const selectedRoleConfig = useMemo(() => viewerRole !== 'partner' || remoteSession?.isActive
    ? baseSelectedRoleConfig
    : applyPartnerMyStationDebutMenuGate(baseSelectedRoleConfig, partnerMyStationDebut.canDebut),
  [baseSelectedRoleConfig, partnerMyStationDebut.canDebut, remoteSession?.isActive, viewerRole])
  const topMenus = useMemo(() => selectedRoleConfig.topMenus.filter((menu) => Boolean(menu?.trim())), [selectedRoleConfig.topMenus])
  useSinglePaneBootstrapEffects({
    role, viewerRole, activeMenu, selectedRoleTopMenus: topMenus,
    selectedRoleTopMenusKey: topMenus.join('||'), remoteSession, setRemoteSession,
    setRoleState, setActiveMenu, sessionEmail, setSessionEmail, authoritativeAccountRoles,
    setAuthoritativeAccountRoles, adminDefaultAppliedForEmailRef, accountSettings, viewerPerson,
    remotePartnerOrganizationName: remotePartnerAssignment?.organizationName || null,
    navigatorAssignmentProfiles, scopedEnrollees, enrollees, setBootstrapState,
    setNavigatorProgramState, setNavigatorProgramError, setPartnerTroubleshootingGrants,
    setRemotePartnerStationProfile, setNavigatorEnrollmentAssignments,
    setNavigatorEnrollmentAssignmentsError, setIsLoadingNavigatorEnrollmentAssignments,
    setPendingAssignmentEnrollees, setDemoTaggedEnrollmentIds, setPublicQueueRecords,
    setZCodeDomainSurveyHistorySummary, setZCodeDomainSurveyHistoryError,
    setAdminDeletableServiceCapacitySubmissions, setAdminServiceCapacityDeletionError,
    reloadZCodeDomainSurveyHistory, reloadAdminDeletableServiceCapacitySubmissions,
  })
  return {
    routeCandidates, isUploadingProfileImage, profileImageUploadError, isUploadingAccountProfileImage,
    accountProfileImageUploadError, replaceAccountProfileImage, replaceSelectedEnrolleeProfileImage,
    effectiveSelectedLoadBreakdown, effectiveSelectedLoad, selectedRouteAssignment,
    ...routeLogActions,
    effectiveRegulationReviewSettings: regulation.regulationReviewSettings,
    ...regulation,
    partnerServiceCapacityDefaultHeader, currentNavigatorName, currentSupervisorName,
    supervisorNavigatorCompetency, supervisorNavigatorDirectory, mergedNavigatorProgramState,
    partnerStripJourneyModel, ...competency, ...reflection, ...pickup, ...troubleshooting, ...enrollment,
    navigatorAssignedCompetencySummary, navigatorAggregateLoad, navigatorLoadContributors,
    navigatorAggregateLoadBreakdown, pickupQueue, navigatorAssignmentBoardRows,
    journeyStationMarkers: journey.journeyStationMarkers,
    partnerServiceCapacitySurveyHistory: partnerHistory.partnerServiceCapacitySurveyHistory,
    partnerServiceCapacitySurveyError: partnerHistory.partnerServiceCapacitySurveyError,
    setPartnerServiceCapacitySurveyHistory: partnerHistory.setPartnerServiceCapacitySurveyHistory,
    ...surveys, partnerMyStationDebut, selectedRoleConfig,
  }
}
