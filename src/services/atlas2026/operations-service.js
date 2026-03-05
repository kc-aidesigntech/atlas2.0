import { ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'
import { STEP_STATUS } from '@/services/atlas2026/step-graph'

function countBy(items, keySelector) {
  return items.reduce((acc, item) => {
    const key = keySelector(item)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

export function buildOperationsSnapshot({ participants, routes, steps, memoryEvents }) {
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
    }
  }
}

export function buildCountyComparisonSnapshot({ participants, routes, steps, memoryEvents }) {
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
      averageReadiness: Number(readinessAvg.toFixed(3))
    }
  })
}

