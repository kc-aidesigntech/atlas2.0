import { ROUTE_SCORING_FACTORS, STABILIZATION_PHASES } from '@/core/atlas2026/canonical-spec'

function scoreRoute(route, participantPhaseIndex, civicDiplomacyBoost = 0.08) {
  const phaseDelta = Math.abs((route.phaseIndex ?? 0) - participantPhaseIndex)
  const phaseAlignment = Math.max(0, 1 - phaseDelta * 0.5)
  const coverage = route.coverageScore ?? 0.6
  const specialization = route.specializationScore ?? 0.65
  const reversibility = route.reversibilitySupport ?? 0.6
  const transferCost = route.transferCost ?? 0.25
  const interference = route.interferenceRisk ?? 0.2
  // Civic diplomacy is a strategic tie-breaker, not a replacement for safety constraints.
  const diplomacyBonus = route.routeClass === 'civicDiplomacy' ? civicDiplomacyBoost : 0

  const composite =
    coverage * ROUTE_SCORING_FACTORS.coverageWeight +
    phaseAlignment * ROUTE_SCORING_FACTORS.phaseAlignmentWeight +
    specialization * ROUTE_SCORING_FACTORS.specializationWeight +
    reversibility * ROUTE_SCORING_FACTORS.reversibilityWeight -
    transferCost * ROUTE_SCORING_FACTORS.transferCostPenalty -
    interference * ROUTE_SCORING_FACTORS.interferencePenalty +
    diplomacyBonus

  return {
    score: Number(composite.toFixed(3)),
    phaseAlignment: Number(phaseAlignment.toFixed(3))
  }
}

export function validatePhaseGate(participant, route) {
  const currentIdx = STABILIZATION_PHASES.indexOf(participant.currentPhase)
  const targetIdx = route.phaseIndex ?? 0

  if (currentIdx < 0) {
    return { pass: false, reason: 'Participant phase is not recognized.' }
  }
  if (targetIdx < currentIdx) {
    return { pass: false, reason: 'Route would regress participant phase.' }
  }

  const readiness = participant.phaseReadiness ?? 0
  if (targetIdx > currentIdx && readiness < 0.45) {
    return { pass: false, reason: 'Participant readiness below transition threshold.' }
  }
  return { pass: true, reason: null }
}

export function validateDependencies(route, completedStepIds = []) {
  const dependencies = Array.isArray(route.dependencies) ? route.dependencies : []
  const missing = dependencies.filter((dep) => !completedStepIds.includes(dep))
  if (missing.length) {
    return { pass: false, reason: `Missing dependencies: ${missing.join(', ')}`, missing }
  }
  return { pass: true, reason: null, missing: [] }
}

export function diagnoseInterference(route, activeRoutes = [], thresholds = {}) {
  const mediumThreshold = thresholds.medium ?? 0.35
  const highThreshold = thresholds.high ?? 0.6
  const conflicting = activeRoutes.filter((active) => active.partnerId === route.partnerId && active.status === 'active')
  if (conflicting.length > 0) {
    return {
      risk: 'high',
      reason: 'Partner already handling active route for participant context.',
      conflicts: conflicting.map((item) => item.routeId)
    }
  }
  if ((route.interferenceRisk ?? 0) >= highThreshold) {
    return { risk: 'high', reason: 'Route interference exceeds high-risk governance threshold.', conflicts: [] }
  }
  if ((route.interferenceRisk ?? 0) >= mediumThreshold) {
    return { risk: 'medium', reason: 'Route has elevated modeled interference risk.', conflicts: [] }
  }
  return { risk: 'low', reason: 'No meaningful interference detected.', conflicts: [] }
}

export function generateRoutePlan({
  participant,
  capacityTopology,
  activeRoutes = [],
  completedStepIds = [],
  interferenceThresholds,
  civicDiplomacyBoost = 0.08
}) {
  const participantPhaseIndex = STABILIZATION_PHASES.indexOf(participant.currentPhase)

  const enriched = capacityTopology.map((candidate, index) => {
    const candidatePhaseIndex = candidate.phaseIndex ?? participantPhaseIndex
    const route = {
      routeId: candidate.routeId ?? `route-plan-${index + 1}`,
      partnerId: candidate.partnerId,
      phaseIndex: candidatePhaseIndex,
      dependencies: candidate.dependencies ?? [],
      routeClass: candidate.routeClass ?? (candidatePhaseIndex >= 2 ? 'civicDiplomacy' : 'stabilization'),
      ...candidate
    }

    const phaseGate = validatePhaseGate(participant, route)
    const dependencyGate = validateDependencies(route, completedStepIds)
    const interference = diagnoseInterference(route, activeRoutes, interferenceThresholds)
    const { score, phaseAlignment } = scoreRoute(route, participantPhaseIndex, civicDiplomacyBoost)

    // A route is blocked when any hard gate fails; scoring still runs so analysts can inspect near-misses.
    const blocked = !phaseGate.pass || !dependencyGate.pass || interference.risk === 'high'

    return {
      ...route,
      score,
      phaseAlignment,
      blocked,
      blockReasons: [phaseGate.reason, dependencyGate.reason, interference.risk === 'high' ? interference.reason : null].filter(Boolean),
      diagnostics: {
        phaseGate,
        dependencyGate,
        interference
      }
    }
  })

  const sorted = enriched.sort((a, b) => b.score - a.score)
  const recommended = sorted.find((route) => !route.blocked) ?? null

  return {
    routes: sorted,
    recommendedRouteId: recommended?.routeId ?? null
  }
}

export function getInterferenceMitigations(route) {
  const mitigations = []
  const risk = route?.diagnostics?.interference?.risk || 'low'

  if (risk === 'high') {
    mitigations.push('Reassign to alternate partner to avoid active capacity conflict.')
    mitigations.push('Delay activation until current partner workload deconflicts.')
  } else if (risk === 'medium') {
    mitigations.push('Add coordination checkpoint before activation.')
    mitigations.push('Prefer route handoff with lower transfer complexity.')
  }

  if (route?.diagnostics?.dependencyGate && !route.diagnostics.dependencyGate.pass) {
    mitigations.push('Complete prerequisite steps before progressing this route.')
  }
  if (route?.diagnostics?.phaseGate && !route.diagnostics.phaseGate.pass) {
    mitigations.push('Stabilize phase readiness before phase transition route.')
  }

  return mitigations
}

