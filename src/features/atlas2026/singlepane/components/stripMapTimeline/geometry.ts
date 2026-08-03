import type { ResolvedZCodeStripMarker, StabilizationPhase } from '../../types'

export function sortByTimestamp<T>(items: T[], getTimestamp: (item: T) => string) {
  // Copy before sorting so timeline rendering never mutates repository-owned arrays.
  return items.slice().sort(
    (left, right) => new Date(getTimestamp(left)).getTime() - new Date(getTimestamp(right)).getTime()
  )
}

export function addDays(date: Date, days: number) {
  const clone = new Date(date)
  clone.setDate(clone.getDate() + days)
  return clone
}

export function truncateLabel(label: string, visibleChars: number) {
  const normalized = label.trim()
  if (normalized.length <= visibleChars) return normalized
  return `${normalized.slice(0, Math.max(visibleChars, 1)).trimEnd()}...`
}

export function assignCollisionLanes<T extends { id: string; x: number }>(items: T[], minSpacing: number) {
  const laneLastX: number[] = []
  const laneById = new Map<string, number>()
  items
    .slice()
    .sort((left, right) => left.x - right.x)
    .forEach((item) => {
      let lane = 0
      while (laneLastX[lane] !== undefined && item.x - laneLastX[lane] < minSpacing) {
        lane += 1
      }
      laneLastX[lane] = item.x
      laneById.set(item.id, lane)
    })
  return laneById
}

export function assignGroupedCollisionLanes<T extends { id: string; x: number; laneGroup: string }>(
  items: T[],
  minSpacing: number
) {
  const laneById = new Map<string, number>()
  const laneStateByGroup = new Map<string, number[]>()
  items
    .slice()
    .sort((left, right) => left.x - right.x)
    .forEach((item) => {
      const lanes = laneStateByGroup.get(item.laneGroup) || []
      let lane = 0
      while (lanes[lane] !== undefined && item.x - lanes[lane] < minSpacing) {
        lane += 1
      }
      lanes[lane] = item.x
      laneStateByGroup.set(item.laneGroup, lanes)
      laneById.set(item.id, lane)
    })
  return laneById
}

export function distributePhaseDots<T extends { phase: StabilizationPhase; x: number }>(
  dots: T[],
  phaseBoundsByPhase: Map<StabilizationPhase, { xStart: number; xEnd: number }>
) {
  const next = dots.slice()
  const byPhase = new Map<StabilizationPhase, number[]>()
  next.forEach((dot, index) => {
    const current = byPhase.get(dot.phase) || []
    current.push(index)
    byPhase.set(dot.phase, current)
  })
  // Re-space edge-pinned or dense clusters while preserving sparse, meaningful dates.
  byPhase.forEach((indices, phase) => {
    const bounds = phaseBoundsByPhase.get(phase)
    if (!bounds || indices.length === 0) return
    const minInset = 22
    const xStart = bounds.xStart + minInset
    const xEnd = bounds.xEnd - minInset
    const span = Math.max(xEnd - xStart, 1)
    const original = indices.map((index) => next[index]).sort((left, right) => left.x - right.x)
    const minX = original[0]?.x ?? xStart
    const maxX = original[original.length - 1]?.x ?? xEnd
    const pinnedToEdge = minX <= xStart + 6 || maxX >= xEnd - 6
    const tightCluster = maxX - minX < Math.max(16, indices.length * 10)
    if (!pinnedToEdge && !tightCluster && indices.length <= 2) return
    original.forEach((dot, slotIndex) => {
      const slotX = xStart + span * ((slotIndex + 1) / (original.length + 1))
      const targetIndex = next.findIndex((candidate) => candidate === dot)
      if (targetIndex >= 0) next[targetIndex] = { ...next[targetIndex], x: slotX }
    })
  })
  return next
}

export function formatTimelinePhaseLabel(phase: StabilizationPhase) {
  if (phase === 'regulation') return 'regulation'
  if (phase === 'readiness') return 'plan route'
  return 'renewal'
}

const RESOLVED_STACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Weekly grouping keeps dense resolved-marker activity legible without overlapping callouts.
export function groupResolvedMarkersByWeek(markers: ResolvedZCodeStripMarker[]) {
  return markers.reduce<ResolvedZCodeStripMarker[][]>((groups, marker) => {
    const markerTime = new Date(marker.resolvedAtIso).getTime()
    const currentGroup = groups[groups.length - 1]
    const groupAnchorTime = currentGroup?.[0] ? new Date(currentGroup[0].resolvedAtIso).getTime() : Number.NaN
    if (
      !currentGroup ||
      !Number.isFinite(markerTime) ||
      !Number.isFinite(groupAnchorTime) ||
      markerTime - groupAnchorTime > RESOLVED_STACK_WINDOW_MS
    ) {
      groups.push([marker])
    } else {
      currentGroup.push(marker)
    }
    return groups
  }, [])
}
