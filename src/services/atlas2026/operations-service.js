import { ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'
import { STEP_STATUS } from '@/services/atlas2026/step-graph'

function countBy(items, keySelector) {
  return items.reduce((acc, item) => {
    const key = keySelector(item)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

export function buildOperationsSnapshot({ participants, routes, steps, memoryEvents, slaThresholdHours = 48 }) {
  const participantByPhase = countBy(participants, (item) => item.currentPhase || 'Unknown')
  const routesByStatus = countBy(routes, (item) => item.status || ROUTE_LIFECYCLE.pending)
  const stepsByStatus = countBy(steps, (item) => item.status || STEP_STATUS.pending)

  const blockedRoutes = routes.filter((route) => route.status === ROUTE_LIFECYCLE.blocked).length
  const completedRoutes = routes.filter((route) => route.status === ROUTE_LIFECYCLE.completed).length

  const now = Date.now()
  const weeklyEvents = memoryEvents.filter((event) => {
    const seconds = event?.createdAt?.seconds
    if (!seconds) return false
    return now - seconds * 1000 <= 1000 * 60 * 60 * 24 * 7
  }).length

  const readinessAvg = participants.length
    ? participants.reduce((sum, participant) => sum + (participant.phaseReadiness || 0), 0) / participants.length
    : 0

  const stepAges = steps.map((step) => {
    const millis =
      typeof step?.updatedAt?.toMillis === 'function'
        ? step.updatedAt.toMillis()
        : (step?.updatedAt?.seconds || step?.createdAt?.seconds || 0) * 1000
    const ageHours = millis ? (now - millis) / (1000 * 60 * 60) : 0
    return { ...step, ageHours }
  })
  const overdueSteps = stepAges.filter(
    (step) =>
      [STEP_STATUS.pending, STEP_STATUS.inProgress, STEP_STATUS.blocked].includes(step.status) &&
      step.ageHours >= slaThresholdHours
  )
  const avgStepAgeHours = stepAges.length ? stepAges.reduce((sum, step) => sum + step.ageHours, 0) / stepAges.length : 0

  return {
    totals: {
      participants: participants.length,
      routes: routes.length,
      steps: steps.length,
      memoryEvents: memoryEvents.length
    },
    participantByPhase,
    routesByStatus,
    stepsByStatus,
    risk: {
      blockedRoutes,
      completedRoutes,
      blockedRate: routes.length ? Number((blockedRoutes / routes.length).toFixed(3)) : 0
    },
    activity: {
      weeklyEvents,
      averageReadiness: Number(readinessAvg.toFixed(3))
    },
    sla: {
      thresholdHours: slaThresholdHours,
      overdueSteps: overdueSteps.length,
      averageStepAgeHours: Number(avgStepAgeHours.toFixed(1))
    }
  }
}

export function buildCountyComparisonSnapshot({ participants, routes, steps, memoryEvents, slaThresholdHours = 48 }) {
  const counties = [...new Set(participants.map((participant) => participant.countyId).filter(Boolean))]

  return counties.map((countyId) => {
    const scopedParticipants = participants.filter((participant) => participant.countyId === countyId)
    const participantIds = new Set(scopedParticipants.map((participant) => participant.participantId))
    const scopedRoutes = routes.filter((route) => participantIds.has(route.participantId))
    const scopedSteps = steps.filter((step) => participantIds.has(step.participantId))
    const scopedEvents = memoryEvents.filter((event) => participantIds.has(event.participantId))

    const blockedRoutes = scopedRoutes.filter((route) => route.status === ROUTE_LIFECYCLE.blocked).length
    const completedRoutes = scopedRoutes.filter((route) => route.status === ROUTE_LIFECYCLE.completed).length
    const completedSteps = scopedSteps.filter((step) => step.status === STEP_STATUS.completed).length
    const overdueSteps = scopedSteps.filter((step) => {
      const millis =
        typeof step?.updatedAt?.toMillis === 'function'
          ? step.updatedAt.toMillis()
          : (step?.updatedAt?.seconds || step?.createdAt?.seconds || 0) * 1000
      const ageHours = millis ? (Date.now() - millis) / (1000 * 60 * 60) : 0
      return (
        [STEP_STATUS.pending, STEP_STATUS.inProgress, STEP_STATUS.blocked].includes(step.status) &&
        ageHours >= slaThresholdHours
      )
    }).length

    const readinessAvg = scopedParticipants.length
      ? scopedParticipants.reduce((sum, participant) => sum + (participant.phaseReadiness || 0), 0) / scopedParticipants.length
      : 0

    return {
      countyId,
      participants: scopedParticipants.length,
      routes: scopedRoutes.length,
      steps: scopedSteps.length,
      memoryEvents: scopedEvents.length,
      blockedRoutes,
      completedRoutes,
      completedSteps,
      overdueSteps,
      averageReadiness: Number(readinessAvg.toFixed(3))
    }
  })
}

