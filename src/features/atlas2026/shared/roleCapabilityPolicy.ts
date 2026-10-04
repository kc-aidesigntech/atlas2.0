import type { AdminPortalFeaturePolicy, AdminRoleCapabilityPolicies, AtlasRole } from '@/features/atlas2026/shared/contracts'

export const ADMIN_POLICY_SCREEN_KEYS = [
  'overview',
  'enrollees',
  'directory',
  'organizations',
  'relationships',
  'assessments',
  'assignmentBoard'
] as const

export const ADMIN_POLICY_CARD_KEYS = ['navigatorCoverageCard', 'liveAccessMatrix', 'navigatorProfilePickupQueue'] as const

export const ADMIN_POLICY_ACTION_KEYS = [
  'assignmentBoard.viewNavigatorNames',
  'assignmentBoard.assignSelf',
  'assignmentBoard.addReferral',
  'admin.saveRegistry',
  'intake.write',
  'zcodes.write',
  'routeAssignment.write',
  'routeLogs.write',
  'timeline.write',
  'navigatorProgram.write',
  'regulationReview.write',
  'regulationTests.write',
  'partnerReferral.submit'
] as const

export type CapabilityScope = keyof AdminPortalFeaturePolicy

export type PersonCapabilityChoice = 'inherit' | 'allow' | 'block'

export const ATLAS_PERMISSION_ROLES: AtlasRole[] = ['administrator', 'supervisor', 'navigator', 'partner']

export const CAPABILITY_GROUPS: Array<{ scope: CapabilityScope; label: string; keys: readonly string[] }> = [
  { scope: 'screenToggles', label: 'Screens', keys: ADMIN_POLICY_SCREEN_KEYS },
  { scope: 'cardToggles', label: 'Cards', keys: ADMIN_POLICY_CARD_KEYS },
  { scope: 'actionToggles', label: 'Actions', keys: ADMIN_POLICY_ACTION_KEYS }
]

const CAPABILITY_LABELS: Record<string, string> = {
  overview: 'Overview',
  enrollees: 'Enrollees',
  directory: 'People and roles',
  organizations: 'Organizations',
  relationships: 'Assignments',
  assessments: 'Assessments',
  assignmentBoard: 'Assignment board',
  navigatorCoverageCard: 'Navigator coverage',
  liveAccessMatrix: 'Live access matrix',
  navigatorProfilePickupQueue: 'Navigator pickup queue',
  'assignmentBoard.viewNavigatorNames': 'View navigator names',
  'assignmentBoard.assignSelf': 'Assign self from the board',
  'assignmentBoard.addReferral': 'Add an enrollee from the board',
  'admin.saveRegistry': 'Save the admin registry',
  'intake.write': 'Write intake',
  'zcodes.write': 'Write Z-codes',
  'routeAssignment.write': 'Write route assignment',
  'routeLogs.write': 'Write route logs',
  'timeline.write': 'Write timeline',
  'navigatorProgram.write': 'Write navigator program',
  'regulationReview.write': 'Write regulation review',
  'regulationTests.write': 'Write regulation tests',
  'partnerReferral.submit': 'Submit a partner referral'
}

export function capabilityLabel(key: string) {
  return CAPABILITY_LABELS[key] || key
}

export interface PersonCapabilityRow {
  scope: CapabilityScope
  key: string
  label: string
  groupLabel: string
  effectiveAllowed: boolean
  roleAllowed: boolean
  isException: boolean
  roleDetail: string
}

export interface RoleCapabilityRow {
  scope: CapabilityScope
  key: string
  label: string
  groupLabel: string
  allowed: boolean
  isRoleChange: boolean
}

type RoleCapabilityMap = Record<CapabilityScope, Record<string, boolean>>

const ROLE_CAPABILITY_DEFAULTS: Record<AtlasRole, RoleCapabilityMap> = {
  administrator: {
    screenToggles: {
      assignmentBoard: true
    },
    cardToggles: {
      navigatorCoverageCard: true,
      liveAccessMatrix: true,
      navigatorProfilePickupQueue: true
    },
    actionToggles: {
      'assignmentBoard.viewNavigatorNames': true,
      'assignmentBoard.assignSelf': false,
      'assignmentBoard.addReferral': false,
      'admin.saveRegistry': true,
      'intake.write': true,
      'zcodes.write': true,
      'routeAssignment.write': true,
      'routeLogs.write': true,
      'timeline.write': true,
      'navigatorProgram.write': true,
      'regulationReview.write': true,
      'regulationTests.write': true,
      'partnerReferral.submit': true
    }
  },
  supervisor: {
    screenToggles: {
      assignmentBoard: true
    },
    cardToggles: {
      navigatorCoverageCard: false,
      liveAccessMatrix: false,
      navigatorProfilePickupQueue: true
    },
    actionToggles: {
      'assignmentBoard.viewNavigatorNames': false,
      'assignmentBoard.assignSelf': false,
      'assignmentBoard.addReferral': false,
      'admin.saveRegistry': false,
      'intake.write': false,
      'zcodes.write': false,
      'routeAssignment.write': false,
      'routeLogs.write': true,
      'timeline.write': false,
      'navigatorProgram.write': true,
      'regulationReview.write': false,
      'regulationTests.write': true,
      'partnerReferral.submit': true
    }
  },
  navigator: {
    screenToggles: {
      assignmentBoard: true
    },
    cardToggles: {
      navigatorCoverageCard: false,
      liveAccessMatrix: false,
      navigatorProfilePickupQueue: true
    },
    actionToggles: {
      'assignmentBoard.viewNavigatorNames': false,
      'assignmentBoard.assignSelf': true,
      'assignmentBoard.addReferral': false,
      'admin.saveRegistry': false,
      'intake.write': true,
      'zcodes.write': true,
      'routeAssignment.write': true,
      'routeLogs.write': true,
      'timeline.write': true,
      'navigatorProgram.write': true,
      'regulationReview.write': false,
      'regulationTests.write': true,
      'partnerReferral.submit': true
    }
  },
  partner: {
    screenToggles: {
      assignmentBoard: false
    },
    cardToggles: {
      navigatorCoverageCard: false,
      liveAccessMatrix: false,
      navigatorProfilePickupQueue: false
    },
    actionToggles: {
      'assignmentBoard.viewNavigatorNames': false,
      'assignmentBoard.assignSelf': false,
      'assignmentBoard.addReferral': false,
      'admin.saveRegistry': false,
      'intake.write': false,
      'zcodes.write': false,
      'routeAssignment.write': false,
      'routeLogs.write': false,
      'timeline.write': false,
      'navigatorProgram.write': false,
      'regulationReview.write': false,
      'regulationTests.write': false,
      'partnerReferral.submit': true
    }
  }
}

function emptyFeaturePolicy(): AdminPortalFeaturePolicy {
  return { screenToggles: {}, cardToggles: {}, actionToggles: {} }
}

function getRoleBaseline(role: AtlasRole, scope: CapabilityScope, key: string) {
  const roleDefaults = ROLE_CAPABILITY_DEFAULTS[role][scope]
  if (key in roleDefaults) return roleDefaults[key]
  // Unknown keys default to allow to preserve backwards compatibility with
  // pre-policy records while Role-Based Access Control (RBAC) contracts evolve.
  return true
}

function hasOwnBoolean(map: Record<string, boolean> | undefined, key: string) {
  return Boolean(map) && Object.prototype.hasOwnProperty.call(map, key)
}

// A stored role policy replaces the shipped baseline for that one capability.
// Everyone who inherits the role picks up the change unless they have an exception.
export function readRoleCapability(
  role: AtlasRole,
  scope: CapabilityScope,
  key: string,
  rolePolicies?: AdminRoleCapabilityPolicies
) {
  const overlay = rolePolicies?.[role]?.[scope]
  if (hasOwnBoolean(overlay, key)) return Boolean(overlay?.[key])
  return getRoleBaseline(role, scope, key)
}

export function isRoleCapabilityChanged(
  role: AtlasRole,
  scope: CapabilityScope,
  key: string,
  rolePolicies?: AdminRoleCapabilityPolicies
) {
  return hasOwnBoolean(rolePolicies?.[role]?.[scope], key)
}

function inheritedRoleDecision(roles: AtlasRole[], scope: CapabilityScope, key: string, rolePolicies?: AdminRoleCapabilityPolicies) {
  // No Atlas role falls back to the partner baseline, matching enforcement.
  const considered = roles.length ? roles : (['partner'] as AtlasRole[])
  const allowed = considered.some((role) => readRoleCapability(role, scope, key, rolePolicies))
  const detail = considered.map((role) => `${role} ${readRoleCapability(role, scope, key, rolePolicies) ? 'allows' : 'blocks'}`).join(' · ')
  return {
    allowed,
    detail: roles.length ? detail : `no atlas role · ${detail}`
  }
}

export function isCapabilityAllowedForRole(
  role: AtlasRole,
  scope: CapabilityScope,
  key: string,
  overrides: Record<string, boolean> | undefined,
  rolePolicies?: AdminRoleCapabilityPolicies
) {
  if (hasOwnBoolean(overrides, key)) return Boolean(overrides?.[key])
  return readRoleCapability(role, scope, key, rolePolicies)
}

export function isCapabilityAllowedForAnyRole(
  roles: AtlasRole[],
  scope: CapabilityScope,
  key: string,
  overrides: Record<string, boolean> | undefined,
  rolePolicies?: AdminRoleCapabilityPolicies
) {
  if (hasOwnBoolean(overrides, key)) return Boolean(overrides?.[key])
  return inheritedRoleDecision(roles, scope, key, rolePolicies).allowed
}

export function listPersonCapabilityRows(
  roles: AtlasRole[],
  policy: AdminPortalFeaturePolicy,
  rolePolicies?: AdminRoleCapabilityPolicies
): PersonCapabilityRow[] {
  return CAPABILITY_GROUPS.flatMap((group) =>
    group.keys.map((key) => {
      const inherited = inheritedRoleDecision(roles, group.scope, key, rolePolicies)
      const overrides = policy[group.scope]
      const isException = hasOwnBoolean(overrides, key)
      return {
        scope: group.scope,
        key,
        label: capabilityLabel(key),
        groupLabel: group.label,
        effectiveAllowed: isException ? Boolean(overrides[key]) : inherited.allowed,
        roleAllowed: inherited.allowed,
        isException,
        roleDetail: inherited.detail
      }
    })
  )
}

export function listRoleCapabilityRows(role: AtlasRole, rolePolicies?: AdminRoleCapabilityPolicies): RoleCapabilityRow[] {
  return CAPABILITY_GROUPS.flatMap((group) =>
    group.keys.map((key) => ({
      scope: group.scope,
      key,
      label: capabilityLabel(key),
      groupLabel: group.label,
      allowed: readRoleCapability(role, group.scope, key, rolePolicies),
      isRoleChange: isRoleCapabilityChanged(role, group.scope, key, rolePolicies)
    }))
  )
}

export function countPersonExceptions(roles: AtlasRole[], policy: AdminPortalFeaturePolicy, rolePolicies?: AdminRoleCapabilityPolicies) {
  return listPersonCapabilityRows(roles, policy, rolePolicies).filter((row) => row.isException).length
}

export function countRoleChanges(role: AtlasRole, rolePolicies?: AdminRoleCapabilityPolicies) {
  return listRoleCapabilityRows(role, rolePolicies).filter((row) => row.isRoleChange).length
}

// Matching the role on purpose is not an exception. Only a real difference is stored.
export function applyPersonCapabilityChoice(
  overrides: Record<string, boolean>,
  key: string,
  choice: PersonCapabilityChoice,
  roleAllows: boolean
) {
  const next = { ...overrides }
  const matchesRole = choice !== 'inherit' && (choice === 'allow') === roleAllows
  if (choice === 'inherit' || matchesRole) {
    delete next[key]
    return next
  }
  next[key] = choice === 'allow'
  return next
}

export function applyRoleCapabilitySetting(
  rolePolicies: AdminRoleCapabilityPolicies,
  role: AtlasRole,
  scope: CapabilityScope,
  key: string,
  allowed: boolean
): AdminRoleCapabilityPolicies {
  const existing = rolePolicies[role] || emptyFeaturePolicy()
  const scopeMap = { ...existing[scope] }
  if (allowed === getRoleBaseline(role, scope, key)) delete scopeMap[key]
  else scopeMap[key] = allowed
  return {
    ...rolePolicies,
    [role]: {
      screenToggles: existing.screenToggles,
      cardToggles: existing.cardToggles,
      actionToggles: existing.actionToggles,
      [scope]: scopeMap
    }
  }
}

export function toggleCapabilityOverride(
  overrides: Record<string, boolean>,
  roleDefaultsToAllowed: boolean,
  key: string
) {
  if (key in overrides) {
    const next = { ...overrides }
    delete next[key]
    return next
  }
  return {
    ...overrides,
    [key]: !roleDefaultsToAllowed
  }
}
