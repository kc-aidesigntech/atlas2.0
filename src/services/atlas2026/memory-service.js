export function toScope(event, participant, selectedRole) {
  if (selectedRole === 'regionalDirector' || selectedRole === 'readOnlyFunder') return 'regional'
  if (selectedRole === 'stationOperator') return 'station'
  if (event?.participantId === participant?.participantId) return 'participant'
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

  return {
    events: scopedEvents,
    totals
  }
}

