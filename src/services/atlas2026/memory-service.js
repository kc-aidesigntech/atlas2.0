import { isWithinRecentWindow } from '@/services/atlas2026/snapshot-helpers'

export function toScope(event, participant, selectedRole) {
  // Leadership/funder roles always see regional scope to prevent accidental narrowing by participant context.
  if (selectedRole === 'regionalDirector' || selectedRole === 'readOnlyFunder') return 'regional'
  if (selectedRole === 'stationOperator') return 'station'
  if (event?.participantId === participant?.participantId) return 'participant'
  // Default to station scope for peer workflows when ownership is ambiguous.
  return 'station'
}

export function buildMemoryView({ events, participant, selectedRole }) {
  const scopedEvents = events
    .filter((event) => event.participantId === participant?.participantId)
    .map((event) => ({
      ...event,
      scope: toScope(event, participant, selectedRole)
    }))
    .sort((a, b) => (b?.createdAt?.seconds ?? 0) - (a?.createdAt?.seconds ?? 0))

  const totals = scopedEvents.reduce(
    (acc, event) => {
      if (event.verified) acc.verified += 1
      else acc.unverified += 1
      acc.byScope[event.scope] = (acc.byScope[event.scope] || 0) + 1
      return acc
    },
    { verified: 0, unverified: 0, byScope: {} }
  )

  const byType = scopedEvents.reduce((acc, event) => {
    const key = event.eventType || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const recentWindow = scopedEvents.filter((event) => {
    // Weekly pulse powers "recent activity" indicators; changing this window impacts trend comparability.
    return isWithinRecentWindow(event?.createdAt, 7)
  })

  return {
    events: scopedEvents,
    totals,
    byType,
    recentWindowCount: recentWindow.length
  }
}

