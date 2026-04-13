import { useEffect, useState } from 'react'
import type { EnrolleeProfile, JourneyStationMarker, RouteCandidateRecord, RouteLogEvent } from '@/features/atlas2026/singlepane/types'
import { loadJourneyStationMarkers } from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'

export function useJourneyStationMarkers(
  selectedEnrollee: EnrolleeProfile | null,
  selectedLogs: RouteLogEvent[],
  routeCandidates: RouteCandidateRecord[]
) {
  const [journeyStationMarkers, setJourneyStationMarkers] = useState<JourneyStationMarker[]>([])

  useEffect(() => {
    let isMounted = true

    async function hydrateStationMarkers() {
      const markers = await loadJourneyStationMarkers(selectedEnrollee?.enrollmentId, selectedEnrollee?.id)
      if (!isMounted) return

      if (markers.length) {
        setJourneyStationMarkers(markers)
        return
      }

      const derived = selectedLogs
        .filter((log) => log.phase !== 'regulation')
        .map((log, index) => {
          const candidate = routeCandidates[index % Math.max(routeCandidates.length, 1)]
          return {
            id: `station-marker-${log.id}`,
            stationName: candidate?.stationName || 'partner station',
            assignedAtIso: log.timestampIso,
            phase: log.phase,
            iconSlug: log.stationIcon
          } as JourneyStationMarker
        })
      setJourneyStationMarkers(derived)
    }

    hydrateStationMarkers()
    return () => {
      isMounted = false
    }
  }, [routeCandidates, selectedEnrollee?.enrollmentId, selectedEnrollee?.id, selectedLogs])

  return {
    journeyStationMarkers,
    setJourneyStationMarkers
  }
}
