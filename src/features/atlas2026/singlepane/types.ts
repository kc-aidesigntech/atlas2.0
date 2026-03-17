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

export type RouteLogStatus = 'planned' | 'active' | 'completed' | 'blocked'

export interface RouteLogEvent {
  id: string
  enrolleeId: string
  label: string
  timestampIso: string
  status: RouteLogStatus
}

export interface RoleMenuConfig {
  role: AtlasRole
  topMenus: string[]
  actionMenus: string[]
}
