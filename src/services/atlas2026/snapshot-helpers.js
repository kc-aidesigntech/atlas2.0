// Firestore timestamps can arrive as plain objects or Timestamp instances.
// Normalizing here keeps snapshot math deterministic across local mocks and live data.
export function toMillis(timestamp) {
  if (!timestamp) return 0
  if (typeof timestamp?.toMillis === 'function') return timestamp.toMillis()
  return (timestamp?.seconds || 0) * 1000
}

const CIVIC_CONTRIBUTION_EVENT_PATTERN =
  /(mentor|community|policy|steward|volunteer|restorative|civic|contribute|care plan|impact)/i

// Renewal and operations views share this classifier so contribution counts stay aligned.
export function isCivicContributionEvent(event) {
  return CIVIC_CONTRIBUTION_EVENT_PATTERN.test(`${event?.label || ''} ${event?.eventType || ''}`)
}
