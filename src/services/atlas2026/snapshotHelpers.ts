// Snapshot helpers centralize shared normalization and metric rules across Atlas decision services.
export interface TimestampLike {
  seconds?: number
  toMillis?: () => number
}

export interface ParticipantSnapshot {
  participantId?: string
  countyId?: string
  currentPhase?: string
  phaseReadiness?: number
  pressureVectors?: Array<{
    domain?: string
    severity?: number
    reversibility?: number
  }>
  [key: string]: unknown
}

export interface MemoryEventSnapshot {
  id?: string
  participantId?: string
  eventType?: string
  label?: string
  phase?: string
  verified?: boolean
  createdAt?: TimestampLike
  [key: string]: unknown
}

// Firestore timestamps can arrive as plain objects or Timestamp instances.
// Normalizing here keeps snapshot math deterministic across local mocks and live data.
export function toMillis(timestamp?: TimestampLike | null): number {
  if (!timestamp) return 0
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis()
  return (timestamp.seconds || 0) * 1000
}

export function average(values: number[] = []): number {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function toRoundedNumber(value: number, decimals = 3): number {
  return Number(value.toFixed(decimals))
}

// Keep this formula centralized so renewal/operations reciprocity signals never drift.
export function computeReciprocityIndex({
  readiness = 0,
  routeCompletionRatio = 0,
  contributionRatio = 0
}: {
  readiness?: number
  routeCompletionRatio?: number
  contributionRatio?: number
}): number {
  return toRoundedNumber(readiness * 0.45 + routeCompletionRatio * 0.35 + contributionRatio * 0.2, 3)
}

export function isWithinRecentWindow(timestamp?: TimestampLike | null, windowDays = 7, now = Date.now()): boolean {
  const millis = toMillis(timestamp)
  if (!millis) return false
  return now - millis <= 1000 * 60 * 60 * 24 * windowDays
}

export function toPhaseReadinessAlert(participant: ParticipantSnapshot) {
  return {
    participantId: participant.participantId,
    countyId: participant.countyId || 'unknown',
    currentPhase: participant.currentPhase,
    phaseReadiness: toRoundedNumber(participant.phaseReadiness ?? 0, 3)
  }
}

const CIVIC_CONTRIBUTION_EVENT_PATTERN =
  /(mentor|community|policy|steward|volunteer|restorative|civic|contribute|care plan|impact)/i

// Renewal and operations views share this classifier so contribution counts stay aligned.
export function isCivicContributionEvent(event: MemoryEventSnapshot): boolean {
  return CIVIC_CONTRIBUTION_EVENT_PATTERN.test(`${event?.label || ''} ${event?.eventType || ''}`)
}
