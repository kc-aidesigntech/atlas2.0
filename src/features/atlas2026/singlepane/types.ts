import type {
  EnrolleeBurdenSurveyAnswer,
  EnrolleeBurdenSurveyHeader,
  EnrolleeBurdenSurveySubmissionInput,
  EnrolleeBurdenSurveySubmissionRecord,
  EnrolleeBurdenSurveyRespondentRole,
  PartnerIdentifierRecord,
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole,
  ZCodeDomainSurveyAnswerLogRecord,
  ZCodeDomainSurveyHistorySummary
} from '@atlas/shared'

/**
 * Single-pane domain type contracts.
 *
 * Purpose:
 * - centralizes cross-feature interfaces shared by data-access, hooks, and User Interface (UI).
 * - preserves compatibility with shared package contracts via explicit re-exports.
 */

export type AtlasRole = 'navigator' | 'partner' | 'supervisor' | 'administrator'

// Per-Z-code readiness criteria captured in the readiness workflow.
// 'resolved' is the single value that drives the legacy isResolved semantics.
export type ZCodeReviewStatus = 'not_resolved' | 'partially_resolved' | 'resolved'
export type ZCodeConfidenceLevel = 'low' | 'medium' | 'high'

// Audit reasons recorded when a navigator unchecks an active Z-code in the
// streamlined override panel ("unchecked z-code coin log").
export type ZCodeUncheckReasonCode = 'restarting_readiness' | 'entry_error' | 'other'

export interface EnrolleeActiveZCode {
  enrolleeZCodeId: string
  parentCode: string
  zCode: string
  title: string
  description: string
  isResolved: boolean
  resolutionAt: string | null
  resolutionPartnerId?: string | null
  resolutionPartnerName?: string | null
  resolutionNote?: string | null
  codeReviewStatus?: ZCodeReviewStatus
  confidenceLevel?: ZCodeConfidenceLevel | null
}

export interface EnrolleeZCodeResolutionInput {
  partnerId?: string | null
  partnerName?: string | null
  resolutionNote?: string | null
  // When provided, the review status is the source of truth for resolution
  // state (isResolved is derived server-side from 'resolved').
  codeReviewStatus?: ZCodeReviewStatus | null
  confidenceLevel?: ZCodeConfidenceLevel | null
}

export interface EnrolleeZCodeUncheckReason {
  zCode: string
  reasonCode: ZCodeUncheckReasonCode
  reasonText?: string | null
}

// Payload for the binary Z-code override command Remote Procedure Call (RPC):
// the checked set becomes the enrollee's exact active Z-code set.
export interface EnrolleeZCodeOverrideInput {
  checkedZCodes: string[]
  uncheckReasons: EnrolleeZCodeUncheckReason[]
}

export interface EnrolleeZCodeOverrideResult {
  enrollmentId: string
  zCodeTags: string[]
  activeZCodeDetails: EnrolleeActiveZCode[]
}

export interface ResolvedZCodeStripMarker {
  id: string
  parentCode: string
  zCode: string
  description: string
  resolvedAtIso: string
  partnerName: string | null
  resolutionNote?: string | null
}

export interface EnrolleeProfile {
  id: string
  enrollmentId?: string
  fullName: string
  dob: string
  caseId: string
  email: string
  avatarUrl?: string
  assignedNavigator: string
  zCodeTags: string[]
  activeZCodeDetails: EnrolleeActiveZCode[]
  completedParentCodes: string[]
}

export interface DomainLoad {
  enrolleeId: string
  habitat: number
  work: number
  socialNetworks: number
}

export type DomainLoadBucket = 'habitat' | 'work' | 'socialNetworks'
export type DomainLoadSourceKind = 'partnerSurvey' | 'enrolleeRecords' | 'enrolleeSurvey'

export interface DomainLoadPartnerScoreTraceRow {
  partnerId: string | null
  partnerLabel: string
  score: number
}

export interface DomainLoadBreakdownRow {
  id: string
  zCodeGroup: string
  parentCode?: string
  mappedDomain: DomainLoadBucket
  rawCount: number
  responseCount?: number
  specializeCount?: number
  interfereCount?: number
  partnerScoreTrace?: DomainLoadPartnerScoreTraceRow[]
  averagePartnerStrength?: number
}

export interface DomainLoadBreakdown {
  subjectId: string
  subjectLabel: string
  sourceKind: DomainLoadSourceKind
  sourceLabel: string
  habitatTotal: number
  workTotal: number
  socialNetworksTotal: number
  rows: DomainLoadBreakdownRow[]
}

export type StabilizationPhase = 'regulation' | 'readiness' | 'renewal'
export type ZDomain = 'housing' | 'health' | 'work' | 'social' | 'legal' | 'education'
export type RouteLogStatus = 'planned' | 'active' | 'completed' | 'blocked'
export type RouteMilestoneType = 'intervention' | 'verifiedMilestone' | 'sustainedChange'
export type StationIcon = 'housing' | 'health' | 'work' | 'social' | 'legal' | 'education' | 'check' | 'flag'

export interface RouteLogEvent {
  id: string
  enrolleeId: string
  label: string
  timestampIso: string
  status: RouteLogStatus
  phase: StabilizationPhase
  milestoneType: RouteMilestoneType
  domainsRelieved: ZDomain[]
  stationIcon?: StationIcon
  timelinePositionRatio?: number | null
}

// Navigation config defines role-level menu entitlements consumed by shell routing.
export interface RoleMenuConfig {
  role: AtlasRole
  topMenus: string[]
  actionMenus: string[]
}

export interface TimelineGate {
  id: string
  label: string
  phase: StabilizationPhase
  monthOffset: number
}

export interface TimelineConfig {
  planStartIso: string
  durationMonths: number
  maxDurationMonths: number
  gates: TimelineGate[]
}

export interface EnrollmentRequestRecord {
  id: string
  submittedAt: string
  status: 'pending' | 'accepted' | 'rejected' | 'assigned'
  prospectiveEnrollee: string
  email?: string
}

export interface NavigatorEnrollmentAssignmentRecord {
  enrollmentId: string
  enrolleeId: string
  enrolleeName: string
  caseId: string
  assignedNavigatorLabel: string
  navigatorAssignmentCount: number
  assignedNavigatorNames: string[]
  zCodeParentCodes: string[]
  isAssignedToAnyNavigator: boolean
  isAssignedToViewer: boolean
  isActionable?: boolean
  statusNote?: string
  pickupStatus?: NavigatorPickupQueueStatus
  pickupRecordId?: string
}

export interface RouteCandidateRecord {
  stationId: string
  partnerId: string
  stationName: string
  score: number
  matchedZCodeCount: number
  needUnitsMatched: number
  partnerBurdenTotal: number
  matchedZCodes: string[]
  matchedParentSummaries: RouteCandidateParentSummary[]
}

export interface RouteCandidateParentSummary {
  parentCode: string
  matchedChildCount: number
  avgBurdenScore: number
  matchedChildZCodes: string[]
}

export type {
  EnrolleeBurdenSurveyAnswer,
  EnrolleeBurdenSurveyHeader,
  EnrolleeBurdenSurveySubmissionInput,
  EnrolleeBurdenSurveySubmissionRecord,
  EnrolleeBurdenSurveyRespondentRole,
  PartnerIdentifierRecord,
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole,
  ZCodeDomainSurveyAnswerLogRecord,
  ZCodeDomainSurveyHistorySummary
}

export interface PartnerServiceCapacityScaleOption {
  value: number
  label: string
  description: string
}

export interface ZCodeSurveyPrompt {
  id: string
  parentCode: string
  parentTheme: string
  zCode: string
  normalizedZCode: string
  title: string
  description: string
}

export interface ZCodeSurveySection {
  parentCode: string
  theme: string
  prompts: ZCodeSurveyPrompt[]
}

export interface PartnerZCodeBurdenRecord {
  id: string
  partnerId: string | null
  submissionId: string | null
  zCode: string
  normalizedZCode: string
  score: number
  derivedRelationType: 'specialize' | 'interfere' | null
  strength: number
  updatedAtIso: string
}

export interface CountyHeatPoint {
  countyId: string
  countyName: string
  zGroup: number
  activeCaseCount: number
}

export interface AdminDataQualityMetric {
  metric: string
  countValue: number
}

export type AdminPortalPersonRole = AtlasRole | 'enrollee'
export type AdminPortalPersonStatus = 'active' | 'invited' | 'inactive'
export type AdminPortalAccessApprovalState = 'pending' | 'approved'
export type AdminPortalOrganizationType = 'partner' | 'internal' | 'public_agency' | 'community'
export type AdminPortalOrganizationStatus = 'active' | 'draft' | 'inactive'
export type AdminPortalCustomEnrolleeStatus = 'active' | 'draft' | 'archived'

export interface AdminPortalFeaturePolicy {
  // These maps store admin-curated exception overrides against role defaults.
  // Missing keys inherit role capability policy and keep role behavior uniform.
  screenToggles: Record<string, boolean>
  cardToggles: Record<string, boolean>
  actionToggles: Record<string, boolean>
}

export interface AdminPortalPersonRecord {
  id: string
  fullName: string
  email: string
  title: string
  roles: AdminPortalPersonRole[]
  canViewNavigatorAssignmentNames: boolean
  approvalState: AdminPortalAccessApprovalState
  identityGroupId: string
  linkedEmails: string[]
  featurePolicy: AdminPortalFeaturePolicy
  organizationId: string | null
  reportsToPersonId: string | null
  linkedEnrolleeId: string | null
  status: AdminPortalPersonStatus
  notes: string
}

export interface AdminPortalOrganizationRecord {
  id: string
  name: string
  type: AdminPortalOrganizationType
  countyName: string
  primaryContactPersonId: string | null
  status: AdminPortalOrganizationStatus
  notes: string
}

export interface AdminPortalCustomEnrolleeRecord extends EnrolleeIntakeRecord {
  status: AdminPortalCustomEnrolleeStatus
  notes: string
}

export interface AdminPortalRegistry {
  people: AdminPortalPersonRecord[]
  organizations: AdminPortalOrganizationRecord[]
  customEnrollees: AdminPortalCustomEnrolleeRecord[]
  archivedPersonIds: string[]
  archivedOrganizationIds: string[]
  archivedEnrolleeIds: string[]
  updatedAtIso: string
}

export interface AccessMatrixPersonRecord {
  id: string
  fullName: string
  email: string
  roleKeys: AdminPortalPersonRole[]
}

export interface AccessMatrixEnrollmentRecord {
  enrollmentId: string
  enrolleeId: string
  enrolleeName: string
  caseId: string
  navigatorPersonIds: string[]
}

export interface AccessMatrixSupervisorRecord {
  navigatorPersonId: string
  supervisorPersonIds: string[]
}

export interface AccessMatrixPartnerRecord {
  partnerId: string
  organizationName: string
  primaryContactPersonIds: string[]
  primaryContactEmails: string[]
}

export interface AccessMatrixDataset {
  people: AccessMatrixPersonRecord[]
  roleKeys: AdminPortalPersonRole[]
  enrollmentAssignments: AccessMatrixEnrollmentRecord[]
  supervisorAssignments: AccessMatrixSupervisorRecord[]
  partnerAssignments: AccessMatrixPartnerRecord[]
  updatedAtIso: string
}

export interface PartnerTroubleshootingGrant {
  partnerId: string
  organizationName: string
  allowedMenus: string[]
  allowWrite: boolean
  updatedAtIso: string
}

export interface TroubleshootingSessionState {
  isActive: boolean
  targetPersonId: string
  targetRole: AtlasRole
  targetDisplayName: string
  targetEmail: string
  targetOrganizationName: string | null
  startedAtIso: string
  partnerGrant: PartnerTroubleshootingGrant | null
}

export interface JourneyStationMarker {
  id: string
  stationName: string
  assignedAtIso: string
  phase: StabilizationPhase
  iconSlug?: string
  markerType?: 'history' | 'suggested' | 'selected'
}

// Partner strip map uses anonymized aggregate dots grouped by source and phase.
export type PartnerStripDotSource = 'referred' | 'active'

export interface PartnerStripAggregateDot {
  id: string
  source: PartnerStripDotSource
  phase: StabilizationPhase
  occurredAtIso: string
  anonymousLabel: string
}

export interface PartnerStripHistoryRecord {
  id: string
  source: PartnerStripDotSource
  reachedRenewalAtIso: string
  outcomeLabel: string
  anonymousLabel: string
}

export interface AccountSettings {
  fullName: string
  email: string
  organization: string
  avatarUrl?: string | null
  enabledRoles: AtlasRole[]
}

export interface PartnerStationProfile {
  partnerId: string
  organizationName: string
  stationId: string | null
  stationName: string | null
  countyName: string | null
  primaryContactFirstName: string | null
  primaryContactLastName: string | null
  primaryContactEmail: string | null
  capacityTotal: number | null
  capacityAvailable: number | null
}

export interface PartnerStationSpecialtyZCode {
  promptId: string
  zCode: string
  normalizedZCode: string
  title: string
  description: string
  score: number
}

export interface PartnerStationSpecialtyGroup {
  parentCode: string
  childCodes: string[]
  zCodes: PartnerStationSpecialtyZCode[]
  strengthCount: number
  totalCount: number
}

export interface EnrolleeIntakeRecord {
  enrolleeId: string
  fullName: string
  dob: string
  caseId: string
  email: string
  assignedNavigator: string
  enrollmentStartIso: string
  zCodeTags: string[]
}

export interface RouteAssignmentRecord {
  enrolleeId: string
  stationId: string
  stationName: string
  assignedAtIso: string
  phase: StabilizationPhase
  matchedZCodes: string[]
}

export interface NavigatorCompetencyAssessmentAnswer {
  parentCode: string
  theme: string
  score: number
}

export interface NavigatorCompetencyAssessmentRecord {
  id: string
  navigatorName: string
  supervisorName: string
  submittedAtIso: string
  formVersion: string
  answers: NavigatorCompetencyAssessmentAnswer[]
}

export interface SupervisorNavigatorCompetencySummary {
  navigatorName: string
  assessmentCount: number
  weightedRollingAverage: number
  lastAssessmentAtIso: string | null
}

export type NavigatorPickupQueueStatus = 'available' | 'accepted' | 'claimed' | 'archived'

export interface UnassignedEnrolleePickupRecord {
  id: string
  fullName: string
  dob: string
  caseId: string
  email: string
  phone: string
  demographicsSummary: string
  referredAtIso: string
  referrerName: string
  referrerOrganization: string
  backgroundNotes: string
  referrerMessage: string
  zCodeTags: string[]
  status: NavigatorPickupQueueStatus
  claimedByNavigatorName: string | null
  claimedAtIso: string | null
}

export interface PartnerReferralSubmissionInput {
  referredParticipantName: string
  participantEmail: string
  participantPhone: string
  situationCategories: string[]
  backgroundNotes: string
  selfReferring: boolean
  referrerName: string
  existingPartner: boolean
  partnerOrganizationName: string
  partnerContactName: string
  partnerContactEmail: string
  partnerContactPhone: string
}

export interface NavigatorSelfAssessmentRecord {
  id: string
  navigatorName: string
  weekStartIso: string
  submittedAtIso: string
  stressLoadScore: number
  confidenceScore: number
  supportScore: number
  note: string
}

export interface NavigatorSelfAssessmentSummary {
  responseCount: number
  averageStressLoad: number
  averageConfidence: number
  averageSupport: number
  averageComposite: number
  latestSubmittedAtIso: string | null
}

export type SupervisionSessionStatus = 'scheduled' | 'completed'

export interface SupervisionSessionRecord {
  id: string
  navigatorName: string
  supervisorName: string
  sessionAtIso: string
  status: SupervisionSessionStatus
  supervisorNote: string
  navigatorNote: string
  actionItems: string
}

export type IntervalAssessmentType = 'navigator_self_assessment' | 'navigator_competency_review' | 'supervision_session'
export type IntervalCadence = 'weekly' | 'monthly' | 'quarterly'

export interface IntervalAssessmentRule {
  id: string
  title: string
  assessmentType: IntervalAssessmentType
  assigneeRole: 'navigator' | 'supervisor'
  navigatorName: string | null
  cadence: IntervalCadence
  startsAtIso: string
  weekday: number | null
  isActive: boolean
  instructions: string
  lastGeneratedAtIso: string | null
}

export interface NavigatorProgramState {
  pickupQueue: UnassignedEnrolleePickupRecord[]
  selfAssessments: NavigatorSelfAssessmentRecord[]
  supervisionSessions: SupervisionSessionRecord[]
  intervalAssessmentRules: IntervalAssessmentRule[]
  updatedAtIso: string
}

export interface IntervalAssessmentDueItem {
  id: string
  ruleId: string
  title: string
  assessmentType: IntervalAssessmentType
  navigatorName: string | null
  dueAtIso: string
  cadence: IntervalCadence
  status: 'open' | 'completed'
}

// Forced regulation review scheduling.
// Administrator-level cadence policy with per-enrollee enable/disable overrides, persisted
// as a single JSON config document in atlas.app_config_documents (no dedicated table).
export interface RegulationReviewEnrolleeSetting {
  enrolleeId: string
  enrolleeName: string
  isActive: boolean
  // null inherits the admin default cadence; a concrete value pins a custom cadence
  // for this enrollee only.
  cadence: IntervalCadence | null
  updatedAtIso: string
}

export interface RegulationReviewSettings {
  // Cadence applied to every enrollee without an explicit per-enrollee cadence override.
  defaultCadence: IntervalCadence
  // When true (client-mandated default), enrollees without an explicit entry are treated
  // as having the review active, so newly added enrollees are covered immediately.
  isActiveForNewEnrollees: boolean
  enrolleeSettings: Record<string, RegulationReviewEnrolleeSetting>
  updatedAtIso: string
}

// Computed (not persisted) due item: one per owned enrollee whose regulation review is
// active and governed by the cadence window since the last completed regulation test.
export interface RegulationReviewDueItem {
  id: string
  enrolleeId: string
  enrolleeName: string
  navigatorName: string | null
  cadence: IntervalCadence
  dueAtIso: string
  lastCompletedAtIso: string | null
  status: 'open' | 'completed'
}

export type RegulationTestType = 'mh_sca' | 'svs' | 'ipf' | 'b_ipf'
export type RegulationTestSubmissionStatus = 'draft' | 'completed'

export interface RegulationTestPrompt {
  id: string
  label: string
  description: string
}

export interface RegulationTestAnswer {
  promptId: string
  promptLabel: string
  responseValue: number | null
}

export interface RegulationTestSubmissionRecord {
  id: string
  draftKey: string
  enrolleeId: string
  enrollmentId: string | null
  testType: RegulationTestType
  status: RegulationTestSubmissionStatus
  submittedAtIso: string
  updatedAtIso: string
  enrolleeName: string
  enrolleeCaseId: string
  enrolleeEmail: string
  score: number | null
  passThreshold: number
  passed: boolean | null
  answers: RegulationTestAnswer[]
}

export interface RegulationTestSubmissionInput {
  draftKey?: string
  enrolleeId: string
  enrollmentId?: string | null
  testType: RegulationTestType
  status: RegulationTestSubmissionStatus
  enrolleeName: string
  enrolleeCaseId: string
  enrolleeEmail: string
  answers: RegulationTestAnswer[]
}

export interface RegulationTestStripMarker {
  id: string
  label: string
  testType: RegulationTestType
  attemptedAtIso: string
  passed: boolean
  isLatestCompleted: boolean
}
