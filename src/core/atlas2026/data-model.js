import { PRESSURE_DOMAINS, STABILIZATION_PHASES } from './canonical-spec'

export const ROUTE_LIFECYCLE = {
  pending: 'pending',
  active: 'active',
  completed: 'completed',
  blocked: 'blocked'
}

export const MEMORY_EVENT_TYPES = {
  phaseGateSatisfied: 'phaseGateSatisfied',
  routeActivated: 'routeActivated',
  milestoneVerified: 'milestoneVerified',
  blockerDetected: 'blockerDetected',
  blockerResolved: 'blockerResolved'
}

export const ENTITY_SCHEMAS = {
  participantState: {
    required: ['participantId', 'countyId', 'displayName', 'currentPhase', 'phaseReadiness', 'pressureVectors'],
    enum: { currentPhase: STABILIZATION_PHASES }
  },
  routePlan: {
    required: ['routeId', 'participantId', 'status', 'steps', 'coverageScore', 'interferenceRisk'],
    enum: { status: Object.values(ROUTE_LIFECYCLE) }
  },
  routeStep: {
    required: ['stepId', 'domain', 'partnerId', 'eligibilityTags', 'dependencies'],
    enum: { domain: PRESSURE_DOMAINS.map((item) => item.id) }
  },
  memoryEvent: {
    required: ['eventId', 'participantId', 'eventType', 'phase', 'verified', 'createdAt'],
    enum: { eventType: Object.values(MEMORY_EVENT_TYPES), phase: STABILIZATION_PHASES }
  }
}

export function createParticipantState(seed = {}) {
  return {
    participantId: seed.participantId ?? 'p-001',
    countyId: seed.countyId ?? 'county-commons-01',
    displayName: seed.displayName ?? 'Participant One',
    currentPhase: seed.currentPhase ?? STABILIZATION_PHASES[0],
    phaseReadiness: seed.phaseReadiness ?? 0.32,
    pressureVectors: seed.pressureVectors ?? PRESSURE_DOMAINS.map((domain) => ({
      domain: domain.id,
      severity: 0.5,
      trajectory: 'flat',
      reversibility: 0.5,
      confidence: 0.7
    })),
    constraintFlags: seed.constraintFlags ?? [],
    activeRouteId: seed.activeRouteId ?? null
  }
}

export function isValidPhaseTransition(fromPhase, toPhase) {
  const fromIndex = STABILIZATION_PHASES.indexOf(fromPhase)
  const toIndex = STABILIZATION_PHASES.indexOf(toPhase)
  if (fromIndex < 0 || toIndex < 0) return false
  return toIndex >= fromIndex
}

export function summarizePressure(participantState) {
  const vectors = participantState?.pressureVectors ?? []
  const totalSeverity = vectors.reduce((acc, item) => acc + (item.severity || 0), 0)
  const averageSeverity = vectors.length ? totalSeverity / vectors.length : 0
  return {
    averageSeverity,
    highPressureDomains: vectors.filter((item) => item.severity >= 0.65).map((item) => item.domain)
  }
}

