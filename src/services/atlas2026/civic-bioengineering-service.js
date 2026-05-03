import {
  ENGINE_OF_ASCENT_OUTPUTS,
  INSTITUTIONAL_ECOSYSTEM,
  RECIPROCITY_ETHOS,
  SRIG_COORDINATION_AREAS
} from '@/core/atlas2026/canonical-spec'
import { ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'
import { isCivicContributionEvent, toMillis } from '@/services/atlas2026/snapshot-helpers'
import { STEP_STATUS } from '@/services/atlas2026/step-graph'

function average(values = []) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildAscentEngineSnapshot({ participant, routes = [], steps = [], pcfRefinementWeight = 0.6 }) {
  const vectors = participant?.pressureVectors || []
  const pressure = average(vectors.map((vector) => vector.severity || 0))
  const reversibility = average(vectors.map((vector) => vector.reversibility || 0))
  const readiness = participant?.phaseReadiness ?? 0
  const completedRouteRatio = routes.length
    ? routes.filter((route) => route.status === ROUTE_LIFECYCLE.completed).length / routes.length
    : 0
  const completedStepRatio = steps.length ? steps.filter((step) => step.status === STEP_STATUS.completed).length / steps.length : 0

  const rawEnergyScore =
    (1 - pressure) * 0.34 +
    reversibility * 0.22 +
    readiness * 0.24 +
    completedRouteRatio * 0.1 +
    completedStepRatio * 0.1
  const refinedEnergy = Math.max(0, Math.min(1, rawEnergyScore * (0.7 + pcfRefinementWeight * 0.3)))

  const outputMultipliers = {
    moralClarity: 1,
    principledAction: 0.95,
    stewardship: 0.9,
    institutionalCoherence: 0.85,
    communityRegeneration: 0.82
  }

  const outputs = ENGINE_OF_ASCENT_OUTPUTS.map((outputId) => ({
    id: outputId,
    score: Number((refinedEnergy * (outputMultipliers[outputId] || 0.8)).toFixed(3))
  }))

  return {
    tensionLoad: Number(pressure.toFixed(3)),
    refinedEnergy: Number(refinedEnergy.toFixed(3)),
    outputs
  }
}

export function buildRenewalSnapshot({
  participant,
  routes = [],
  steps = [],
  memoryEvents = [],
  reciprocityActivationThreshold = 0.6
}) {
  const completedRoutes = routes.filter((route) => route.status === ROUTE_LIFECYCLE.completed).length
  const completedSteps = steps.filter((step) => step.status === STEP_STATUS.completed).length
  const verifiedEvents = memoryEvents.filter((event) => event.verified)
  // Event-level classification must match operations dashboards so reciprocity metrics reconcile.
  const civicContributionEvents = verifiedEvents.filter(isCivicContributionEvent)
  const recentReceipts = [...civicContributionEvents]
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, 6)
    .map((event) => ({
      id: event.id,
      label: event.label || event.eventType || 'renewal receipt',
      phase: event.phase,
      verified: event.verified,
      createdAt: event.createdAt
    }))

  const readiness = participant?.phaseReadiness ?? 0
  const routeCompletionRatio = routes.length ? completedRoutes / routes.length : 0
  const contributionRatio = verifiedEvents.length ? civicContributionEvents.length / verifiedEvents.length : 0
  const reciprocityIndex = Number((readiness * 0.45 + routeCompletionRatio * 0.35 + contributionRatio * 0.2).toFixed(3))

  return {
    reciprocityEthos: RECIPROCITY_ETHOS,
    reciprocityIndex,
    threshold: reciprocityActivationThreshold,
    active: reciprocityIndex >= reciprocityActivationThreshold,
    receipts: recentReceipts,
    metrics: {
      completedRoutes,
      completedSteps,
      verifiedEvents: verifiedEvents.length,
      civicContributionEvents: civicContributionEvents.length
    }
  }
}

export function buildInstitutionalEcosystemSnapshot({ isLiveData }) {
  const status = isLiveData ? 'active' : 'standby'
  const ecosystem = INSTITUTIONAL_ECOSYSTEM.map((node) => ({
    ...node,
    status
  }))

  return {
    publicIdentity: 'an alliance of the willing',
    civicEthos: "we're neighbors collaborating to prevent people's lives from falling apart",
    srigCoordinationAreas: SRIG_COORDINATION_AREAS,
    ecosystem
  }
}

