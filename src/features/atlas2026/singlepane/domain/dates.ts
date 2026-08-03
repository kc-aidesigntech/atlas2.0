export function toMidnightIso(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString()
}

export function getWeekStartIso(dateIso: string) {
  const date = new Date(dateIso)
  if (!Number.isFinite(date.getTime())) return toMidnightIso(new Date())
  const day = date.getUTCDay()
  const diff = (day + 6) % 7
  date.setUTCDate(date.getUTCDate() - diff)
  return toMidnightIso(date)
}

export function normalizeOrganizationKey(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
