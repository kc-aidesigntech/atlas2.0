export type AtlasRole = 'navigator' | 'partner' | 'administrator'

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
