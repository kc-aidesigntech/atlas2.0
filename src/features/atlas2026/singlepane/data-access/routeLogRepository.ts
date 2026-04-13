import type { RouteLogEvent } from '@/features/atlas2026/singlepane/types'

const STORAGE_KEY = 'atlas2026.singlepane.logs.v3'

interface PersistedRouteLogState {
  appendedLogs: RouteLogEvent[]
  overrides: Record<string, RouteLogEvent>
}

function normalizeLog(log: RouteLogEvent): RouteLogEvent {
  return {
    ...log,
    phase: log.phase || 'regulation',
    milestoneType: log.milestoneType || 'intervention',
    domainsRelieved: Array.isArray(log.domainsRelieved) ? log.domainsRelieved : ['social'],
    stationIcon: log.stationIcon || 'check',
    timelinePositionRatio:
      typeof log.timelinePositionRatio === 'number' && Number.isFinite(log.timelinePositionRatio)
        ? Math.max(0, Math.min(1, log.timelinePositionRatio))
        : null
  }
}

function areLogsEqual(left: RouteLogEvent, right: RouteLogEvent) {
  return (
    left.id === right.id &&
    left.enrolleeId === right.enrolleeId &&
    left.label === right.label &&
    left.timestampIso === right.timestampIso &&
    left.status === right.status &&
    left.phase === right.phase &&
    left.milestoneType === right.milestoneType &&
    left.stationIcon === right.stationIcon &&
    left.timelinePositionRatio === right.timelinePositionRatio &&
    left.domainsRelieved.join('|') === right.domainsRelieved.join('|')
  )
}

function loadPersistedRouteLogState(): PersistedRouteLogState {
  if (typeof window === 'undefined') return { appendedLogs: [], overrides: {} }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return { appendedLogs: [], overrides: {} }
  try {
    const parsed = JSON.parse(raw) as PersistedRouteLogState
    return {
      appendedLogs: Array.isArray(parsed?.appendedLogs) ? parsed.appendedLogs.map(normalizeLog) : [],
      overrides:
        parsed?.overrides && typeof parsed.overrides === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.overrides).map(([key, value]) => [key, normalizeLog(value as RouteLogEvent)])
            )
          : {}
    }
  } catch {
    return { appendedLogs: [], overrides: {} }
  }
}

export function loadLocalLogs(): RouteLogEvent[] {
  const { appendedLogs, overrides } = loadPersistedRouteLogState()
  return [...appendedLogs.map((log) => normalizeLog(overrides[log.id] ? { ...log, ...overrides[log.id] } : log))]
}

function persistLocalLogs(logs: RouteLogEvent[]) {
  if (typeof window === 'undefined') return
  const overrides: Record<string, RouteLogEvent> = {}
  const appendedLogs: RouteLogEvent[] = []

  for (const log of logs.map(normalizeLog)) {
    appendedLogs.push(log)
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ appendedLogs, overrides } satisfies PersistedRouteLogState))
}

export async function appendRouteLog(logs: RouteLogEvent[], nextLog: RouteLogEvent) {
  const finalLogs = [...logs, nextLog].map(normalizeLog)
  persistLocalLogs(finalLogs)
  return finalLogs
}

export async function saveRouteLogs(logs: RouteLogEvent[]) {
  const finalLogs = logs.map(normalizeLog)
  persistLocalLogs(finalLogs)
  return finalLogs
}
