import type React from 'react'
import type {
  AccessMatrixDataset,
  AdminDataQualityMetric,
  AdminPortalCustomEnrolleeRecord,
  AdminPortalOrganizationRecord,
  AdminPortalPersonRecord,
  AdminPortalPersonRole,
  AtlasRole,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  EnrollmentRequestRecord,
  IntervalAssessmentDueItem,
  IntervalAssessmentRule,
  NavigatorProgramState,
  RegulationReviewDueItem,
  RegulationReviewEnrolleeSetting,
  RegulationReviewSettings,
  SupervisorNavigatorCompetencySummary,
  ZCodeDomainSurveyHistorySummary
} from '@/features/atlas2026/singlepane/types'

// Shared admin-section contracts keep extracted components aligned with the parent's
// data model so refactors do not silently loosen type guarantees.
export type CombinedEnrolleeRow =
  | { kind: 'existing'; id: string; profile: EnrolleeProfile; intake: EnrolleeIntakeRecord }
  | { kind: 'custom'; id: string; record: AdminPortalCustomEnrolleeRecord }

export interface NavigatorCoverageOption {
  id: string
  label: string
  email: string
}

export interface RegulationReviewRosterRow {
  enrolleeId: string
  enrolleeName: string
}

export interface PermissionExceptionEntry {
  id: string
  label: string
  kind: 'allow' | 'block'
}

export interface PermissionExceptionRow {
  person: AdminPortalPersonRecord
  roles: AtlasRole[]
  entries: PermissionExceptionEntry[]
}

export type SetState<T> = React.Dispatch<React.SetStateAction<T>>

export type RecordTableComponentType = React.ComponentType<{
  columns: string[]
  rows: Array<{ id: string }>
  renderRow: (row: { id: string }, index: number) => React.ReactNode
}>

export type StatusPillComponentType = React.ComponentType<{ status: string }>

export type FieldComponentType = React.ComponentType<{
  label: string
  children: React.ReactNode
}>

export interface AdminOverviewSectionDataProps {
  metrics: AdminDataQualityMetric[]
  enrollmentRequests: EnrollmentRequestRecord[]
  selectedEnrollee: EnrolleeProfile | null
  supervisorNavigatorCompetency: SupervisorNavigatorCompetencySummary[]
  isSavingZCodeDomainSurveyNullification: boolean
  isLoadingZCodeDomainSurveyHistorySummary: boolean
  zCodeDomainSurveyHistoryError: string | null
  zCodeDomainSurveyHistorySummary: ZCodeDomainSurveyHistorySummary[]
  selectedDomainSurveySummary: ZCodeDomainSurveyHistorySummary | null
  setSelectedDomainSurveyZCode: (value: string) => void
  nullificationReasonByAnswerId: Record<string, string>
  setNullificationReasonByAnswerId: SetState<Record<string, string>>
  handleSetDomainSurveyNullification: (answerId: string, isNullified: boolean) => Promise<void>
  formatMetricLabel: (value: string) => string
  formatDateLabel: (value?: string | null) => string
}

export interface AdminDirectorySectionDataProps {
  setPersonDraft: SetState<AdminPortalPersonRecord | null>
  buildBlankPerson: () => AdminPortalPersonRecord
  combinedPeople: AdminPortalPersonRecord[]
  selectedPersonId: string | null
  setSelectedPersonId: (value: string | null) => void
  combinedOrganizations: Array<{ id: string; name: string }>
  personDraft: AdminPortalPersonRecord | null
  roleOptions: readonly AdminPortalPersonRole[]
  supervisors: AdminPortalPersonRecord[]
  isCapabilityAllowedForAnyRole: (
    roles: AtlasRole[],
    scope: 'screenToggles' | 'cardToggles' | 'actionToggles',
    key: string,
    overrides: Record<string, boolean> | undefined
  ) => boolean
  toAtlasRoles: (roles: AdminPortalPersonRole[]) => AtlasRole[]
  toggleCapabilityOverride: (
    overrides: Record<string, boolean>,
    roleDefaultsToAllowed: boolean,
    key: string
  ) => Record<string, boolean>
  adminPolicyScreenKeys: readonly string[]
  adminPolicyCardKeys: readonly string[]
  adminPolicyActionKeys: readonly string[]
  handleSavePersonDraft: () => Promise<void>
  handleDeletePerson: (person: AdminPortalPersonRecord) => Promise<void>
}

export interface AdminOrganizationsSectionDataProps {
  setOrganizationDraft: SetState<AdminPortalOrganizationRecord | null>
  buildBlankOrganization: () => AdminPortalOrganizationRecord
  combinedOrganizations: AdminPortalOrganizationRecord[]
  selectedOrganizationId: string | null
  setSelectedOrganizationId: (value: string | null) => void
  combinedPeople: AdminPortalPersonRecord[]
  organizationDraft: AdminPortalOrganizationRecord | null
  organizationTypeOptions: readonly string[]
  handleSaveOrganizationDraft: () => Promise<void>
  handleDeleteOrganization: (organization: AdminPortalOrganizationRecord) => Promise<void>
}

export interface AdminRelationshipsSectionDataProps {
  navigators: AdminPortalPersonRecord[]
  supervisors: AdminPortalPersonRecord[]
  handlePersonSupervisorAssignment: (navigatorId: string, supervisorId: string | null) => Promise<void>
  visibleEnrollees: CombinedEnrolleeRow[]
  accessMatrixDataset: AccessMatrixDataset | null
  navigatorCoverageOptions: NavigatorCoverageOption[]
  handleNavigatorCoverageSelection: (row: CombinedEnrolleeRow, navigatorIds: string[]) => Promise<void>
  handleNavigatorAssignment: (row: CombinedEnrolleeRow, navigatorLabel: string) => Promise<void>
  combinedPeople: AdminPortalPersonRecord[]
  combinedOrganizations: AdminPortalOrganizationRecord[]
  handlePersonOrganizationAssignment: (personId: string, organizationId: string | null) => Promise<void>
}

export interface AdminAssessmentsSectionDataProps {
  setIntervalRuleDraft: SetState<IntervalAssessmentRule | null>
  buildBlankIntervalAssessmentRule: () => IntervalAssessmentRule
  navigatorProgramState: NavigatorProgramState
  intervalRuleDraft: IntervalAssessmentRule | null
  handleSaveIntervalRule: () => Promise<void>
  handleSaveRegulationReviewSettings: () => Promise<void>
  regulationReviewDraft: RegulationReviewSettings | null
  isSavingRegulationReview: boolean
  regulationReviewError: string | null
  effectiveRegulationReview: RegulationReviewSettings
  setRegulationReviewDraft: SetState<RegulationReviewSettings | null>
  regulationReviewDueItems: RegulationReviewDueItem[]
  regulationReviewRoster: RegulationReviewRosterRow[]
  updateRegulationReviewEnrolleeSetting: (
    enrolleeId: string,
    enrolleeName: string,
    updates: Partial<Pick<RegulationReviewEnrolleeSetting, 'isActive' | 'cadence'>>
  ) => void
  navigatorIntervalDueItems: IntervalAssessmentDueItem[]
  supervisorNavigatorCompetency: SupervisorNavigatorCompetencySummary[]
  formatDateLabel: (value?: string | null) => string
}
