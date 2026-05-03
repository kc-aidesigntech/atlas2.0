export function formatDateInputValue(timestampIso: string) {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return ''
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Shared date utility helpers for strip-map timeline rendering and edit flows.
 * Keeping these centralized ensures horizontal and vertical timelines apply the
 * same chronology and edit semantics.
 */
export function addMonths(date: Date, months: number) {
  const clone = new Date(date)
  clone.setMonth(clone.getMonth() + months)
  return clone
}

export function formatDateLabel(timestampIso: string, fallback = 'date pending') {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return fallback
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatDateLabelShort(timestampIso: string, fallback = 'pending') {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return fallback
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export function formatDateTimeLabel(timestampIso: string, fallback = 'date pending') {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return fallback
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export function formatPhaseRange(startIso: string, startOffset: number, endOffset: number) {
  const start = addMonths(new Date(startIso), startOffset || 0)
  const end = addMonths(new Date(startIso), endOffset || 0)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return ''
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
  return `${formatter.format(start)}-${formatter.format(end)}`
}

export function mergeDateInputWithTime(dateInput: string, currentIso: string) {
  // Preserve the original time-of-day so date edits do not re-order same-day milestones unexpectedly.
  const date = new Date(currentIso)
  const safeHours = Number.isFinite(date.getTime()) ? date.getUTCHours() : 9
  const safeMinutes = Number.isFinite(date.getTime()) ? date.getUTCMinutes() : 0
  const safeSeconds = Number.isFinite(date.getTime()) ? date.getUTCSeconds() : 0
  const safeMilliseconds = Number.isFinite(date.getTime()) ? date.getUTCMilliseconds() : 0
  const next = new Date(`${dateInput}T00:00:00.000Z`)
  next.setUTCHours(safeHours, safeMinutes, safeSeconds, safeMilliseconds)
  return next.toISOString()
}
