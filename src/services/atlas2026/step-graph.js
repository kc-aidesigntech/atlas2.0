import { ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'

export const STEP_STATUS = {
  pending: 'pending',
  inProgress: 'inProgress',
  completed: 'completed',
  blocked: 'blocked'
}

export function buildRouteSteps(route) {
  const prefix = route.routeId || 'route'
  // This three-step scaffold defines the minimum orchestration contract expected by timeline and SLA views.
  return [
    {
      stepId: `${prefix}-intake`,
      label: 'Eligibility and intake confirmation',
      status: STEP_STATUS.pending,
      dependencies: [],
      domain: route.phaseTarget || 'Regulation'
    },
    {
      stepId: `${prefix}-coordination`,
      label: 'Partner coordination and scheduling',
      status: STEP_STATUS.pending,
      dependencies: [`${prefix}-intake`],
      domain: route.phaseTarget || 'Readiness'
    },
    {
      stepId: `${prefix}-verification`,
      label: 'Outcome verification and memory update',
      status: STEP_STATUS.pending,
      dependencies: [`${prefix}-coordination`],
      domain: route.phaseTarget || 'Renewal'
    }
  ]
}

export function canTransitionStep(step, nextStatus, steps) {
  if (!step) return { allowed: false, reason: 'Step not found.' }
  if (!Object.values(STEP_STATUS).includes(nextStatus)) {
    return { allowed: false, reason: `Invalid step status: ${nextStatus}` }
  }
  if (step.status === nextStatus) {
    return { allowed: false, reason: 'Step already in this status.' }
  }

  if (nextStatus === STEP_STATUS.inProgress || nextStatus === STEP_STATUS.completed) {
    // Dependencies are checked by stepId so persisted documents can carry independent Firestore ids.
    const dependencySteps = steps.filter((candidate) => step.dependencies.includes(candidate.stepId))
    const hasIncompleteDependency = dependencySteps.some((candidate) => candidate.status !== STEP_STATUS.completed)
    if (hasIncompleteDependency) {
      return { allowed: false, reason: 'Dependencies are not completed.' }
    }
  }

  if (nextStatus === STEP_STATUS.completed && step.status !== STEP_STATUS.inProgress) {
    return { allowed: false, reason: 'Step must be in progress before completion.' }
  }

  return { allowed: true, reason: null }
}

export function deriveRouteLifecycleFromSteps(steps) {
  if (steps.some((step) => step.status === STEP_STATUS.blocked)) return ROUTE_LIFECYCLE.blocked
  if (steps.length > 0 && steps.every((step) => step.status === STEP_STATUS.completed)) return ROUTE_LIFECYCLE.completed
  if (steps.some((step) => step.status === STEP_STATUS.inProgress || step.status === STEP_STATUS.completed)) return ROUTE_LIFECYCLE.active
  return ROUTE_LIFECYCLE.pending
}

