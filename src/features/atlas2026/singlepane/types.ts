export type AtlasRole = 'navigator' | 'partner' | 'administrator'

export interface EnrolleeProfile {
  id: string
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
