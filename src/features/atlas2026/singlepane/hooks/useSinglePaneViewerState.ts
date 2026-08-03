import { useMemo } from 'react'
import type {
  AccessMatrixDataset,
  AccountSettings,
  AdminPortalRegistry,
  AtlasRole,
  DomainLoad,
  DomainLoadBreakdown,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  RoleMenuConfig,
  RouteLogEvent,
  TimelineConfig,
  TroubleshootingSessionState
} from '@/features/atlas2026/shared/contracts'
import { isCapabilityAllowedForRole } from '@/features/atlas2026/shared/roleCapabilityPolicy'
import { useScopedEnrolleeSelection } from '@/features/atlas2026/singlepane/hooks/useScopedEnrolleeSelection'

interface UseSinglePaneViewerStateInput {
  role: AtlasRole
  viewerRole: AtlasRole
  sessionEmail: string
  accountSettings: AccountSettings
  remoteSession: TroubleshootingSessionState | null
  accessMatrixDataset: AccessMatrixDataset | null
  adminPortalRegistry: AdminPortalRegistry | null
  demoTaggedEnrollmentIds: string[]
  enrollees: EnrolleeProfile[]
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  isPartnerStationView: boolean
  partnerLoad: DomainLoad | null
  partnerLoadBreakdown: DomainLoadBreakdown | null
  timelineConfig: TimelineConfig | null
  timelineConfigsByEnrolleeId: Record<string, TimelineConfig>
  intakeFormsByEnrolleeId: Record<string, EnrolleeIntakeRecord>
  logs: RouteLogEvent[]
}

/** Derives viewer policy, enrollment scope, and selected enrollee state in one hook. */
export function useSinglePaneViewerState(input: UseSinglePaneViewerStateInput) {
  const targetViewerEmail = (
    input.remoteSession?.isActive
      ? input.remoteSession.targetEmail
      : input.sessionEmail || input.accountSettings.email || ''
  )
    .trim()
    .toLowerCase()
  const viewerPolicyRecord = useMemo(() => {
    if (!input.adminPortalRegistry || !targetViewerEmail) return null
    return (
      input.adminPortalRegistry.people.find((person) => {
        const emails = [person.email, ...person.linkedEmails].map((value) => value.trim().toLowerCase())
        return emails.includes(targetViewerEmail)
      }) || null
    )
  }, [input.adminPortalRegistry, targetViewerEmail])
  const viewerFeaturePolicy = viewerPolicyRecord?.featurePolicy || {
    screenToggles: {},
    cardToggles: {},
    actionToggles: {}
  }
  const isViewerPolicyAllowed = (
    scope: 'screenToggles' | 'cardToggles' | 'actionToggles',
    key: string
  ) => isCapabilityAllowedForRole(input.viewerRole, scope, key, viewerFeaturePolicy[scope])

  const viewerPerson = useMemo(() => {
    if (!input.accessMatrixDataset) return null
    const candidates = new Set(
      [input.sessionEmail, input.accountSettings.email]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
    return input.accessMatrixDataset.people.find((person) => candidates.has(person.email.trim().toLowerCase())) || null
  }, [input.accessMatrixDataset, input.accountSettings.email, input.sessionEmail])

  const viewerCanViewNavigatorAssignmentNames =
    input.viewerRole === 'administrator' ||
    (Boolean(viewerPolicyRecord?.canViewNavigatorAssignmentNames) &&
      isViewerPolicyAllowed('actionToggles', 'assignmentBoard.viewNavigatorNames'))
  const viewerCanAccessAssignmentBoard = isViewerPolicyAllowed('screenToggles', 'assignmentBoard')
  const viewerCanUseAssignmentActions = isViewerPolicyAllowed('actionToggles', 'assignmentBoard.assignSelf')
  const viewerCanAddAssignmentBoardReferral = isViewerPolicyAllowed('actionToggles', 'assignmentBoard.addReferral')
  const viewerCanAccessAdminRegistryCards =
    isViewerPolicyAllowed('cardToggles', 'navigatorCoverageCard') &&
    isViewerPolicyAllowed('cardToggles', 'liveAccessMatrix') &&
    isViewerPolicyAllowed('actionToggles', 'admin.saveRegistry')

  const scopedEnrollmentIds = useMemo(() => {
    if (input.viewerRole === 'navigator' && input.role !== 'administrator' && !input.remoteSession?.isActive) {
      return null
    }
    if (!input.accessMatrixDataset) return null
    const scopedRole = input.remoteSession?.targetRole || input.role
    if (scopedRole === 'navigator') {
      const personId =
        input.remoteSession?.targetRole === 'navigator' ? input.remoteSession.targetPersonId : viewerPerson?.id
      if (!personId) return new Set<string>()
      return new Set(
        input.accessMatrixDataset.enrollmentAssignments
          .filter((assignment) => assignment.navigatorPersonIds.includes(personId))
          .map((assignment) => assignment.enrollmentId)
      )
    }
    if (scopedRole === 'supervisor') {
      const personId =
        input.remoteSession?.targetRole === 'supervisor' ? input.remoteSession.targetPersonId : viewerPerson?.id
      if (!personId) return new Set<string>()
      const navigatorIds = new Set(
        input.accessMatrixDataset.supervisorAssignments
          .filter((assignment) => assignment.supervisorPersonIds.includes(personId))
          .map((assignment) => assignment.navigatorPersonId)
      )
      return new Set(
        input.accessMatrixDataset.enrollmentAssignments
          .filter((assignment) => assignment.navigatorPersonIds.some((id) => navigatorIds.has(id)))
          .map((assignment) => assignment.enrollmentId)
      )
    }
    return scopedRole === 'partner' ? new Set(input.demoTaggedEnrollmentIds) : null
  }, [
    input.accessMatrixDataset,
    input.demoTaggedEnrollmentIds,
    input.remoteSession,
    input.role,
    input.viewerRole,
    viewerPerson?.id
  ])

  const selection = useScopedEnrolleeSelection({
    enrollees: input.enrollees,
    scopedEnrollmentIds,
    loads: input.loads,
    loadBreakdownsByEnrolleeId: input.loadBreakdownsByEnrolleeId,
    isPartnerStationView: input.isPartnerStationView,
    partnerLoad: input.partnerLoad,
    partnerLoadBreakdown: input.partnerLoadBreakdown,
    timelineConfig: input.timelineConfig,
    timelineConfigsByEnrolleeId: input.timelineConfigsByEnrolleeId,
    intakeFormsByEnrolleeId: input.intakeFormsByEnrolleeId,
    logs: input.logs
  })
  const navigatorAssignmentProfiles = useMemo(
    () =>
      input.enrollees.map((enrollee) => ({
        enrollmentId: enrollee.enrollmentId,
        enrolleeId: enrollee.id,
        fullName: enrollee.fullName,
        caseId: enrollee.caseId,
        assignedNavigator: enrollee.assignedNavigator,
        activeZCodeDetails: enrollee.activeZCodeDetails,
        zCodeTags: enrollee.zCodeTags
      })),
    [input.enrollees]
  )

  return {
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
    ...selection
  }
}
