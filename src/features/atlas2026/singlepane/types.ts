import type {
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole
} from '@atlas/shared'

export type AtlasRole = 'navigator' | 'partner' | 'supervisor' | 'administrator'

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
}

export interface DomainLoad {
  enrolleeId: string
  habitat: number
  work: number
  socialNetworks: number
}

export type DomainLoadBucket = 'habitat' | 'work' | 'socialNetworks'
export type DomainLoadSourceKind = 'partnerSurvey' | 'enrolleeRecords'

export interface DomainLoadBreakdownRow {
  id: string
  zCodeGroup: string
  mappedDomain: DomainLoadBucket
  rawCount: number
  specializeCount?: number
  interfereCount?: number
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

export interface RouteCandidateRecord {
  stationId: string
  partnerId: string
  stationName: string
  score: number
  specializeHits: number
  conflictHits: number
  interfereHits: number
  matchedZCodes: string[]
}

export type { PartnerServiceCapacityAnswer, PartnerServiceCapacityHeader, PartnerServiceCapacitySubmissionInput, PartnerServiceCapacitySubmissionRecord, PartnerSurveyRespondentRole }

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

export interface JourneyStationMarker {
  id: string
  stationName: string
  assignedAtIso: string
  phase: StabilizationPhase
  iconSlug?: string
  markerType?: 'history' | 'suggested' | 'selected'
}

export interface AccountSettings {
  fullName: string
  email: string
  organization: string
  enabledRoles: AtlasRole[]
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
