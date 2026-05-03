import { PRESSURE_DOMAINS } from '@/core/atlas2026/canonical-spec'
import { average, toPhaseReadinessAlert, toRoundedNumber } from '@/services/atlas2026/snapshot-helpers'

export function buildSituationalOverlay({ participants, capacityTopology, phaseReadinessAlertThreshold = 0.45 }) {
  // Domain pressure and capacity use the same ontology keys so corridor gaps remain comparable.
  const domainPressure = PRESSURE_DOMAINS.map((domain) => {
    const all = participants
      .map((participant) => participant.pressureVectors?.find((vector) => vector.domain === domain.id)?.severity ?? 0)
      .filter((value) => Number.isFinite(value))
    return {
      domain: domain.id,
      label: domain.label,
      pressure: toRoundedNumber(average(all), 3)
    }
  })

  const capacityByDomain = PRESSURE_DOMAINS.map((domain) => {
    const matching = capacityTopology.filter(
      (node) =>
        node.domain === domain.id ||
        node.primaryDomain === domain.id ||
        Array.isArray(node.domainCoverage) && node.domainCoverage.includes(domain.id)
    )
    const capacity = average(matching.map((node) => node.coverageScore ?? 0.5))
    return { domain: domain.id, capacity: toRoundedNumber(capacity, 3) }
  })

  const corridorPriorities = domainPressure
    .map((entry) => {
      const capacity = capacityByDomain.find((node) => node.domain === entry.domain)?.capacity ?? 0.5
      const gap = toRoundedNumber(entry.pressure - capacity, 3)
      return {
        domain: entry.domain,
        label: entry.label,
        pressure: entry.pressure,
        capacity,
        gap,
        priority: gap > 0.2 ? 'critical' : gap > 0.05 ? 'watch' : 'stable'
      }
    })
    .sort((a, b) => b.gap - a.gap)

  const hotspotMarkers = corridorPriorities.slice(0, 5).map((corridor, index) => ({
    id: `hotspot-${corridor.domain}`,
    label: corridor.label,
    priority: corridor.priority,
    pressure: corridor.pressure,
    capacity: corridor.capacity,
    // Coordinates are deterministic placeholders for User Interface (UI) rendering until Geographic Information System (GIS) integration is live.
    lat: toRoundedNumber(34.05 + index * 0.08, 3),
    lng: toRoundedNumber(-118.25 + index * 0.06, 3)
  }))

  const phaseReadinessAlerts = participants
    .filter((participant) => (participant.phaseReadiness ?? 1) < phaseReadinessAlertThreshold)
    .sort((a, b) => (a.phaseReadiness ?? 1) - (b.phaseReadiness ?? 1))
    .slice(0, 8)
    // Shared alert shaper keeps operations and situational overlays contract-identical.
    .map(toPhaseReadinessAlert)

  return {
    domainPressure,
    capacityByDomain,
    corridorPriorities,
    hotspotMarkers,
    phaseReadinessAlerts
  }
}

