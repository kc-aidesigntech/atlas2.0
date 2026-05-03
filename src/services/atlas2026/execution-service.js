import { STEP_STATUS } from '@/services/atlas2026/step-graph'
import { toMillis } from '@/services/atlas2026/snapshot-helpers'

export function buildExecutionSnapshot({
  routes,
  steps,
  memoryEvents,
  participantId,
  slaThresholdHours = 48,
  selectedParticipant,
  phaseReadinessAlertThreshold = 0.45
}) {
  // All downstream queues/timelines are participant-scoped; cross-participant bleed here would
  // create false blockers and incorrect SLA pressure in operator workflows.
  const scopedRoutes = routes.filter((route) => route.participantId === participantId)
  const scopedSteps = steps.filter((step) => step.participantId === participantId)
  const scopedEvents = memoryEvents.filter((event) => event.participantId === participantId)

  const now = Date.now()
  const blockerQueue = scopedSteps
    .filter((step) => step.status === STEP_STATUS.blocked)
    .map((step) => ({
      id: step.id,
      stepId: step.stepId,
      label: step.label,
      routeId: step.routeId,
      dependencies: step.dependencies || [],
      ageHours: Number((((now - toMillis(step.updatedAt || step.createdAt)) || 0) / (1000 * 60 * 60)).toFixed(1)),
      recommendedAction:
        (step.dependencies || []).length > 0
          ? 'Complete prerequisite steps, then move this step to pending.'
          : 'Move to pending and assign immediate operator checkpoint.'
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

  const stepAgeHours = scopedSteps.map((step) => {
    const base = toMillis(step.updatedAt || step.createdAt)
    const ageHours = base ? (now - base) / (1000 * 60 * 60) : 0
    return { ...step, ageHours: Number(ageHours.toFixed(1)) }
  })
  const overdueSteps = stepAgeHours.filter(
    (step) =>
      [STEP_STATUS.pending, STEP_STATUS.inProgress, STEP_STATUS.blocked].includes(step.status) &&
      step.ageHours >= slaThresholdHours
  )
  const averageAgeHours = stepAgeHours.length
    ? stepAgeHours.reduce((sum, step) => sum + step.ageHours, 0) / stepAgeHours.length
    : 0

  return {
    timeline,
    blockerQueue,
    progress: {
      routes: scopedRoutes.length,
      steps: scopedSteps.length,
      completionRatio: Number(stepCompletion.toFixed(3))
    },
    sla: {
      thresholdHours: slaThresholdHours,
      overdueCount: overdueSteps.length,
      averageAgeHours: Number(averageAgeHours.toFixed(1)),
      overdueSteps
    },
    readinessAlert:
      selectedParticipant && (selectedParticipant.phaseReadiness ?? 1) < phaseReadinessAlertThreshold
        ? {
            participantId,
            currentPhase: selectedParticipant.currentPhase,
            phaseReadiness: selectedParticipant.phaseReadiness,
            reason: 'Phase readiness is below the transition safety threshold.'
          }
        : null
  }
}

