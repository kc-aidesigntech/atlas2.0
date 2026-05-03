// Role policy boundaries are a hard authorization contract shared by UI affordances
// and service-side enforcement. Keep action keys stable across both layers.
export const ATLAS_ROLES = {
  peerNavigator: 'peerNavigator',
  stationOperator: 'stationOperator',
  regionalDirector: 'regionalDirector',
  governanceAdmin: 'governanceAdmin',
  readOnlyFunder: 'readOnlyFunder'
}

export const POLICY_BOUNDARIES = {
  evaluateParticipant: [ATLAS_ROLES.peerNavigator, ATLAS_ROLES.stationOperator, ATLAS_ROLES.regionalDirector],
  activateRoute: [ATLAS_ROLES.peerNavigator, ATLAS_ROLES.stationOperator],
  transitionRoute: [ATLAS_ROLES.peerNavigator, ATLAS_ROLES.stationOperator],
  appendMemoryEvent: [ATLAS_ROLES.peerNavigator, ATLAS_ROLES.stationOperator, ATLAS_ROLES.regionalDirector],
  assignRenewalRole: [
    ATLAS_ROLES.peerNavigator,
    ATLAS_ROLES.stationOperator,
    ATLAS_ROLES.regionalDirector,
    ATLAS_ROLES.governanceAdmin
  ],
  viewSystemHeatmap: [ATLAS_ROLES.peerNavigator, ATLAS_ROLES.stationOperator, ATLAS_ROLES.regionalDirector, ATLAS_ROLES.readOnlyFunder],
  manageOntology: [ATLAS_ROLES.governanceAdmin]
}

export function canRolePerform(role, action) {
  // Unknown actions default to deny-by-default because policy map is the explicit allowlist.
  return Boolean(POLICY_BOUNDARIES[action]?.includes(role))
}

export function enforcePolicy(role, action) {
  if (!canRolePerform(role, action)) {
    // Return a structured denial payload so callers can log/audit the same shape.
    return {
      allowed: false,
      reason: `Role "${role}" cannot perform action "${action}".`
    }
  }
  return { allowed: true, reason: null }
}

