import type React from 'react'
import type {
  AdminDeletableServiceCapacitySubmissionRecord,
  AccessMatrixDataset,
  AdminDataQualityMetric,
  AdminPortalCustomEnrolleeRecord,
  AdminPortalOrganizationRecord,
  AdminPortalPersonRecord,
  AdminPortalPersonRole,
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
  PartnerServiceCapacityDeletionReasonCode,
  ZCodeDomainSurveyHistorySummary
} from '@/features/atlas2026/shared/contracts'

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
  deletableServiceCapacitySubmissions: AdminDeletableServiceCapacitySubmissionRecord[]
  isLoadingDeletableServiceCapacitySubmissions: boolean
  deletingServiceCapacitySubmissionId: string | null
  serviceCapacityDeletionError: string | null
  selectedDomainSurveySummary: ZCodeDomainSurveyHistorySummary | null
  setSelectedDomainSurveyZCode: (value: string) => void
  nullificationReasonByAnswerId: Record<string, string>
  setNullificationReasonByAnswerId: SetState<Record<string, string>>
  handleSetDomainSurveyNullification: (answerId: string, isNullified: boolean) => Promise<void>
  handleDeleteServiceCapacitySubmission: (input: {
    submissionId: string
    reasonCode: PartnerServiceCapacityDeletionReasonCode
    reasonOtherText?: string | null
  }) => Promise<void>
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
  onOpenPerson: (personId: string) => void
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
  onOpenPerson: (personId: string) => void
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
  onOpenPerson: (personId: string) => void
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
