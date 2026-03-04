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
  viewSystemHeatmap: [ATLAS_ROLES.peerNavigator, ATLAS_ROLES.stationOperator, ATLAS_ROLES.regionalDirector, ATLAS_ROLES.readOnlyFunder],
  manageOntology: [ATLAS_ROLES.governanceAdmin]
}

export function canRolePerform(role, action) {
  return Boolean(POLICY_BOUNDARIES[action]?.includes(role))
}

export function enforcePolicy(role, action) {
  if (!canRolePerform(role, action)) {
    return {
      allowed: false,
      reason: `Role "${role}" cannot perform action "${action}".`
    }
  }
  return { allowed: true, reason: null }
}

