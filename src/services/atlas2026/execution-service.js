import { STEP_STATUS } from '@/services/atlas2026/step-graph'

function toMillis(timestamp) {
  if (!timestamp) return 0
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  return (timestamp.seconds || 0) * 1000
}

export function buildExecutionSnapshot({ routes, steps, memoryEvents, participantId }) {
  const scopedRoutes = routes.filter((route) => route.participantId === participantId)
  const scopedSteps = steps.filter((step) => step.participantId === participantId)
  const scopedEvents = memoryEvents.filter((event) => event.participantId === participantId)

  const blockerQueue = scopedSteps
    .filter((step) => step.status === STEP_STATUS.blocked)
    .map((step) => ({
      id: step.id,
      stepId: step.stepId,
      label: step.label,
      routeId: step.routeId,
      dependencies: step.dependencies || []
    }))

  const timeline = [
    ...scopedRoutes.map((route) => ({
      id: route.id,
      type: 'route',
      label: `Route ${route.routeId} is ${route.status}`,
      at: toMillis(route.updatedAt || route.createdAt)
    })),
    ...scopedSteps.map((step) => ({
      id: step.id,
      type: 'step',
      label: `Step ${step.stepId} is ${step.status}`,
      at: toMillis(step.updatedAt || step.createdAt)
    })),
    ...scopedEvents.map((event) => ({
      id: event.id,
      type: 'memory',
      label: event.label || event.eventType || 'Memory event',
      at: toMillis(event.createdAt)
    }))
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 25)

  const stepCompletion = scopedSteps.length
    ? scopedSteps.filter((step) => step.status === STEP_STATUS.completed).length / scopedSteps.length
    : 0

  return {
    timeline,
    blockerQueue,
    progress: {
      routes: scopedRoutes.length,
      steps: scopedSteps.length,
      completionRatio: Number(stepCompletion.toFixed(3))
    }
  }
}

