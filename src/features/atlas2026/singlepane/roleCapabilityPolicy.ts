import type { AdminPortalFeaturePolicy, AtlasRole } from '@/features/atlas2026/singlepane/types'

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
  'admin.saveRegistry'
] as const

type CapabilityScope = keyof AdminPortalFeaturePolicy

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
      'admin.saveRegistry': true
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
      'admin.saveRegistry': false
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
      'admin.saveRegistry': false
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
      'admin.saveRegistry': false
    }
  }
}

function getRoleBaseline(role: AtlasRole, scope: CapabilityScope, key: string) {
  const roleDefaults = ROLE_CAPABILITY_DEFAULTS[role][scope]
  if (key in roleDefaults) return roleDefaults[key]
  // Unknown keys default to allow to preserve backwards compatibility with
  // pre-policy records while Role-Based Access Control (RBAC) contracts evolve.
  return true
}

export function isCapabilityAllowedForRole(
  role: AtlasRole,
  scope: CapabilityScope,
  key: string,
  overrides: Record<string, boolean> | undefined
) {
  if (overrides && key in overrides) {
    return overrides[key]
  }
  return getRoleBaseline(role, scope, key)
}

export function isCapabilityAllowedForAnyRole(
  roles: AtlasRole[],
  scope: CapabilityScope,
  key: string,
  overrides: Record<string, boolean> | undefined
) {
  if (overrides && key in overrides) {
    return overrides[key]
  }
  if (!roles.length) {
    return getRoleBaseline('partner', scope, key)
  }
  return roles.some((role) => getRoleBaseline(role, scope, key))
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
