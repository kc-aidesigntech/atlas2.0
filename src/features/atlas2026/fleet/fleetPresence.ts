/**
 * Pure fleet summaries. A phone counts as online when its last heartbeat is
 * inside the window below. The device posts about once a minute
 * (prayphone-device fleet loop), so three minutes allows two missed posts.
 */

export const FLEET_ONLINE_WINDOW_MS = 3 * 60 * 1000

export const FLEET_REPORT_DAY_COUNT = 14

export type FleetDevice = {
  id: string
  deviceId: string
  name: string
  status: string
  model: string
  appVersion: string
  otaChannel: string
  lastSeenIso: string
  locationAddress: string
  enabled: boolean
}

export type FleetNetworkSummary = {
  deviceId: string
  wifiUsername: string
  hasWifiPassword: boolean
  updatedAtIso: string
}

export type FleetSession = {
  id: string
  state: string
  fromAor: string
  createdAtIso: string
  startedAtIso: string
  answeredAtIso: string
  endedAtIso: string
  endReason: string
  error: string
}

export type FleetDeviceLog = {
  id: string
  deviceId: string
  apiSubject: string
  payload: Record<string, unknown>
  createdAtIso: string
}

export type FleetCollection = {
  id: string
  sessionId: string
  deviceId: string
  collectedAtIso: string
  keywordCount: number
}

export type FleetDayCount = {
  dayKey: string
  label: string
  count: number
}

const CLOSED_SESSION_STATES = new Set(['ended', 'failed', 'rejected'])

export function isDeviceOnline(lastSeenIso: string, nowMs = Date.now()): boolean {
  if (!lastSeenIso) return false
  const seen = Date.parse(lastSeenIso)
  if (Number.isNaN(seen)) return false
  return nowMs - seen >= 0 && nowMs - seen <= FLEET_ONLINE_WINDOW_MS
}

export function sortDevicesForFleet(devices: FleetDevice[], nowMs = Date.now()): FleetDevice[] {
  return [...devices].sort((left, right) => {
    const onlineDelta = Number(isDeviceOnline(right.lastSeenIso, nowMs)) - Number(isDeviceOnline(left.lastSeenIso, nowMs))
    if (onlineDelta !== 0) return onlineDelta
    return (left.name || left.deviceId).localeCompare(right.name || right.deviceId)
  })
}

/** Hook-to-hook logs carry the call id the kiosk created. That is the device link. */
export function sessionDeviceIdsFromLogs(logs: FleetDeviceLog[]): Map<string, string> {
  const links = new Map<string, string>()
  for (const log of logs) {
    if (log.apiSubject !== 'hook_session' || !log.deviceId) continue
    const sessionId = log.payload.call_session_id
    if (typeof sessionId === 'string' && sessionId.trim()) {
      links.set(sessionId.trim(), log.deviceId)
    }
  }
  return links
}

export function resolveSessionDeviceId(
  session: FleetSession,
  logLinks: Map<string, string>,
  collections: FleetCollection[],
  knownDeviceIds: Set<string>
): string {
  const fromLog = logLinks.get(session.id)
  if (fromLog) return fromLog
  const collection = collections.find((item) => item.sessionId === session.id && knownDeviceIds.has(item.deviceId))
  return collection?.deviceId || ''
}

export function sessionDurationMs(session: FleetSession): number | null {
  const end = Date.parse(session.endedAtIso)
  const start = Date.parse(session.answeredAtIso || session.startedAtIso || session.createdAtIso)
  if (Number.isNaN(end) || Number.isNaN(start) || end < start) return null
  return end - start
}

export function isClosedSession(session: FleetSession): boolean {
  return CLOSED_SESSION_STATES.has(session.state)
}

/** Unclosed rows older than this are leftovers, not a live call. */
const OPEN_SESSION_WINDOW_MS = 6 * 60 * 60 * 1000

export function isRecentlyOpenSession(session: FleetSession, nowMs = Date.now()): boolean {
  if (isClosedSession(session)) return false
  const created = Date.parse(session.createdAtIso)
  if (Number.isNaN(created)) return false
  return nowMs - created >= 0 && nowMs - created <= OPEN_SESSION_WINDOW_MS
}

export function averageClosedDurationMs(sessions: FleetSession[]): number | null {
  // Open calls have no end time, so they stay out of the average.
  const closed = sessions
    .filter(isClosedSession)
    .map(sessionDurationMs)
    .filter((value): value is number => value !== null)
  if (closed.length === 0) return null
  const total = closed.reduce((sum, value) => sum + value, 0)
  return Math.round(total / closed.length)
}

function localDayKey(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function sessionsInLastDays(sessions: FleetSession[], dayCount: number, nowMs = Date.now()): FleetSession[] {
  const cutoff = nowMs - dayCount * 24 * 60 * 60 * 1000
  return sessions.filter((session) => {
    const at = Date.parse(session.createdAtIso)
    return !Number.isNaN(at) && at >= cutoff
  })
}

export function sessionCountsByDay(sessions: FleetSession[], dayCount = FLEET_REPORT_DAY_COUNT, nowMs = Date.now()): FleetDayCount[] {
  const days: FleetDayCount[] = []
  const cursor = new Date(nowMs)
  cursor.setHours(0, 0, 0, 0)
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const day = new Date(cursor)
    day.setDate(cursor.getDate() - offset)
    const dayKey = localDayKey(day.getTime())
    days.push({
      dayKey,
      label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: 0
    })
  }
  const indexByDay = new Map(days.map((day, index) => [day.dayKey, index]))
  for (const session of sessions) {
    const at = Date.parse(session.createdAtIso)
    if (Number.isNaN(at)) continue
    const dayKey = localDayKey(at)
    const index = indexByDay.get(dayKey)
    if (index === undefined) continue
    days[index].count += 1
  }
  return days
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return '—'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

export function formatWhen(iso: string): string {
  if (!iso) return '—'
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return '—'
  return new Date(parsed).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** Short log line for the device history. Never includes a passphrase field. */
export function summarizeDeviceLog(log: FleetDeviceLog): string {
  const payload = log.payload || {}
  const parts: string[] = []
  if (payload.key !== undefined && payload.key !== null) parts.push(`key ${String(payload.key)}`)
  if (typeof payload.state === 'string' && payload.state) parts.push(payload.state.replace(/_/g, ' '))
  if (typeof payload.duration_seconds === 'number') parts.push(formatDuration(payload.duration_seconds * 1000))
  if (payload.ok === true && typeof payload.wifi_username === 'string' && payload.wifi_username) {
    parts.push(`joined ${payload.wifi_username}`)
  }
  if (payload.ok === false) parts.push(typeof payload.reason === 'string' && payload.reason ? payload.reason : 'not applied')
  return parts.join(' · ') || log.apiSubject.replace(/_/g, ' ')
}
