import type {
  AccountSettings,
  AtlasRole,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  RouteAssignmentRecord
} from '@/features/atlas2026/singlepane/types'

const ACCOUNT_SETTINGS_KEY = 'atlas2026.singlepane.account-settings.v1'
const ENROLLEE_INTAKES_KEY = 'atlas2026.singlepane.enrollee-intakes.v1'
const ROUTE_ASSIGNMENTS_KEY = 'atlas2026.singlepane.route-assignments.v1'

function getDefaultAccountSettings(): AccountSettings {
  return {
    fullName: 'atlas operator',
    email: 'operator@atlas.local',
    organization: 'atlas operations',
    enabledRoles: ['administrator', 'supervisor', 'partner', 'navigator']
  }
}

function loadAccountSettingsState(): AccountSettings {
  if (typeof window === 'undefined') return getDefaultAccountSettings()
  const raw = window.localStorage.getItem(ACCOUNT_SETTINGS_KEY)
  if (!raw) return getDefaultAccountSettings()
  try {
    const parsed = JSON.parse(raw) as Partial<AccountSettings>
    const enabledRoles = Array.isArray(parsed.enabledRoles)
      ? parsed.enabledRoles.filter((role): role is AtlasRole => ['navigator', 'partner', 'supervisor', 'administrator'].includes(String(role)))
      : getDefaultAccountSettings().enabledRoles
    return {
      fullName: parsed.fullName || getDefaultAccountSettings().fullName,
      email: parsed.email || getDefaultAccountSettings().email,
      organization: parsed.organization || getDefaultAccountSettings().organization,
      enabledRoles: enabledRoles.length ? enabledRoles : getDefaultAccountSettings().enabledRoles
    }
  } catch {
    return getDefaultAccountSettings()
  }
}

function persistAccountSettingsState(settings: AccountSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCOUNT_SETTINGS_KEY, JSON.stringify(settings))
}

function loadEnrolleeIntakeState(): Record<string, EnrolleeIntakeRecord> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(ENROLLEE_INTAKES_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, EnrolleeIntakeRecord>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persistEnrolleeIntakeState(intakes: Record<string, EnrolleeIntakeRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ENROLLEE_INTAKES_KEY, JSON.stringify(intakes))
}

function loadRouteAssignmentState(): Record<string, RouteAssignmentRecord> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(ROUTE_ASSIGNMENTS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, RouteAssignmentRecord>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persistRouteAssignmentState(assignments: Record<string, RouteAssignmentRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROUTE_ASSIGNMENTS_KEY, JSON.stringify(assignments))
}

export function applyIntakeOverrides(enrollees: EnrolleeProfile[], intakeOverrides: Record<string, EnrolleeIntakeRecord>) {
  return enrollees.map((enrollee) => {
    const intake = intakeOverrides[enrollee.id]
    if (!intake) return enrollee
    return {
      ...enrollee,
      fullName: intake.fullName,
      dob: intake.dob,
      caseId: intake.caseId,
      email: intake.email,
      assignedNavigator: intake.assignedNavigator,
      zCodeTags: intake.zCodeTags
    }
  })
}

export async function loadAccountSettings(): Promise<AccountSettings> {
  return loadAccountSettingsState()
}

export async function saveAccountSettings(settings: AccountSettings): Promise<AccountSettings> {
  persistAccountSettingsState(settings)
  return settings
}

export async function loadEnrolleeIntakes(): Promise<Record<string, EnrolleeIntakeRecord>> {
  return loadEnrolleeIntakeState()
}

export async function saveEnrolleeIntake(intake: EnrolleeIntakeRecord): Promise<EnrolleeIntakeRecord> {
  const nextState = {
    ...loadEnrolleeIntakeState(),
    [intake.enrolleeId]: intake
  }
  persistEnrolleeIntakeState(nextState)
  return intake
}

export async function loadRouteAssignments(): Promise<Record<string, RouteAssignmentRecord>> {
  return loadRouteAssignmentState()
}

export async function saveRouteAssignment(assignment: RouteAssignmentRecord): Promise<RouteAssignmentRecord> {
  const nextState = {
    ...loadRouteAssignmentState(),
    [assignment.enrolleeId]: assignment
  }
  persistRouteAssignmentState(nextState)
  return assignment
}
