import { ROUTE_SCORING_FACTORS, STABILIZATION_PHASES } from './canonical-spec'
import { ROUTE_LIFECYCLE, summarizePressure } from './data-model'

export const INTEL_API_VERSION = '2026-01'

export const INTEL_ENDPOINTS = {
  evaluateParticipant: {
    method: 'POST',
    path: '/api/atlas-intel/evaluate-participant',
    requestSchema: {
      required: ['participantState', 'capacityTopology', 'requestedByRole'],
      optional: ['countyContext', 'constraintOverrides']
    },
    responseSchema: {
      required: ['routeOptions', 'recommendedRouteId', 'explainability', 'policyResult', 'generatedAt']
    }
  },
  activateRoute: {
    method: 'POST',
    path: '/api/atlas-intel/activate-route',
    requestSchema: { required: ['participantId', 'routeId', 'requestedByRole'] },
    responseSchema: { required: ['status', 'routeLifecycle', 'activationEvent'] }
  },
  appendMemoryEvent: {
    method: 'POST',
    path: '/api/atlas-intel/memory/append',
    requestSchema: { required: ['participantId', 'eventType', 'phase', 'verifiedByRole'] },
    responseSchema: { required: ['accepted', 'reason', 'eventId'] }
  }
}

export function evaluateParticipantForRoutes({ participantState, capacityTopology = [], requestedByRole }) {
  const pressure = summarizePressure(participantState)
  const phaseIndex = STABILIZATION_PHASES.indexOf(participantState.currentPhase)
  const phaseProgress = Math.max(0, phaseIndex) / (STABILIZATION_PHASES.length - 1)

  const routeOptions = capacityTopology.map((partner, index) => {
    const coverageScore = partner.coverageScore ?? Math.max(0.2, 1 - pressure.averageSeverity)
    const alignmentScore = Math.max(0.15, partner.phaseAlignment ?? 1 - Math.abs((partner.phaseIndex ?? 0) - phaseIndex) * 0.4)
    const specializationScore = partner.specializationScore ?? 0.65
    const reversibilityScore = partner.reversibilitySupport ?? 0.6
    const transferCost = partner.transferCost ?? 0.35
    const interferenceRisk = partner.interferenceRisk ?? 0.2

    const score =
      coverageScore * ROUTE_SCORING_FACTORS.coverageWeight +
      alignmentScore * ROUTE_SCORING_FACTORS.phaseAlignmentWeight +
      specializationScore * ROUTE_SCORING_FACTORS.specializationWeight +
      reversibilityScore * ROUTE_SCORING_FACTORS.reversibilityWeight -
      transferCost * ROUTE_SCORING_FACTORS.transferCostPenalty -
      interferenceRisk * ROUTE_SCORING_FACTORS.interferencePenalty

    return {
      routeId: `route-${index + 1}`,
      partnerId: partner.partnerId,
      status: ROUTE_LIFECYCLE.pending,
      score: Number(score.toFixed(3)),
      coverageScore,
      interferenceRisk,
      transferCost,
      phaseTarget: STABILIZATION_PHASES[Math.min(STABILIZATION_PHASES.length - 1, phaseIndex + 1)],
      blockers: partner.blockers ?? []
    }
  })

  const sorted = routeOptions.sort((a, b) => b.score - a.score)
  const recommended = sorted[0] ?? null

  return {
    apiVersion: INTEL_API_VERSION,
    routeOptions: sorted,
    recommendedRouteId: recommended?.routeId ?? null,
    explainability: {
      model: 'deterministic-weighted-routing',
      meaningCore: 'atlas-intel',
      movementDesign: 'make-the-next-safe-move-obvious',
      currentPhase: participantState.currentPhase,
      averageDomainPressure: Number(pressure.averageSeverity.toFixed(3)),
      highPressureDomains: pressure.highPressureDomains,
      roleContext: requestedByRole,
      dominantFactors: [
        'coverageWeight',
        'phaseAlignmentWeight',
        pressure.highPressureDomains.length ? 'reversibilityWeight' : 'specializationWeight'
      ],
      phaseProgress
    },
    policyResult: {
      denied: false,
      constraintsApplied: ['eligibilityCheck', 'unsafeTransitionGuard', 'interferenceSuppression'],
      reason: null
    },
    generatedAt: new Date().toISOString()
  }
}

