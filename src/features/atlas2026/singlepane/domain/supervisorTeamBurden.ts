import type { EnrolleeProfile, ResolvedZCodeStripMarker, RouteLogEvent, TimelineConfig } from '@/features/atlas2026/shared/contracts'
import { buildResolvedZCodeStripMarkers } from '@/features/atlas2026/singlepane/domain/phaseAndZCodes'
import { buildDefaultTimelineGates, createDefaultTimelineConfig } from '@/features/atlas2026/singlepane/timelineConfigUtils'

export interface SupervisorTeamNavigator {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

export interface SupervisorTeamBurdenModel {
  navigators: SupervisorTeamNavigator[]
  enrollees: EnrolleeProfile[]
  logs: RouteLogEvent[]
  resolvedZCodeMarkers: ResolvedZCodeStripMarker[]
  completedParentCodes: string[]
  timelineConfig: TimelineConfig
}

const MONTH_MS = 1000 * 60 * 60 * 24 * 30

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

function monthsSpanned(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 6
  return Math.max(6, Math.ceil((end - start) / MONTH_MS) + 1)
}

/**
 * One strip for every enrollee on the supervisor's navigators. The shared
 * timeline starts at the earliest team entry so later people are not clipped
 * to whichever enrollee happened to be selected.
 */
export function buildSupervisorTeamBurdenModel(
  navigators: SupervisorTeamNavigator[],
  scopedEnrollees: EnrolleeProfile[],
  logs: RouteLogEvent[]
): SupervisorTeamBurdenModel {
  const managed = navigators.filter((row) => row.isManagedByCurrentSupervisor)
  const managedNames = new Set(managed.map((row) => normalizeName(row.navigatorName)))
  const namedMatches = scopedEnrollees.filter((enrollee) => managedNames.has(normalizeName(enrollee.assignedNavigator)))
  // Name match is preferred. When the roster names and enrollee labels differ,
  // the already supervisor-scoped enrollee list is still that team's caseload.
  const teamEnrollees = managedNames.size ? (namedMatches.length ? namedMatches : scopedEnrollees) : []
  const nameByEnrolleeId = new Map(teamEnrollees.map((enrollee) => [enrollee.id, enrollee.fullName.trim() || 'enrollee']))
  // The individual strip only plots completed entries. Keep that contract so the
  // team picture is every enrollee's recorded history, not draft or planned rows.
  const teamLogs = logs
    .filter((log) => log.status === 'completed' && nameByEnrolleeId.has(log.enrolleeId))
    .map((log) => ({
      ...log,
      label: `${nameByEnrolleeId.get(log.enrolleeId)} · ${log.label}`
    }))
    .sort((left, right) => new Date(left.timestampIso).getTime() - new Date(right.timestampIso).getTime())
  const resolvedZCodeMarkers = teamEnrollees.flatMap((enrollee) => {
    const enrolleeName = nameByEnrolleeId.get(enrollee.id) || 'enrollee'
    return buildResolvedZCodeStripMarkers(enrollee.activeZCodeDetails).map((marker) => ({
      ...marker,
      id: `${enrollee.id}:${marker.id}`,
      description: `${enrolleeName} · ${marker.description}`
    }))
  })
  const completedParentCodes = Array.from(
    new Set(teamEnrollees.flatMap((enrollee) => enrollee.completedParentCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)))
  ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  const timestamps = [
    ...teamLogs.map((log) => log.timestampIso),
    ...resolvedZCodeMarkers.map((marker) => marker.resolvedAtIso)
  ].filter(Boolean)
  const earliest = timestamps.slice().sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] || new Date().toISOString()
  const latest = timestamps.slice().sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || earliest
  const durationMonths = monthsSpanned(earliest, latest)
  const baseline = createDefaultTimelineConfig(earliest)
  return {
    navigators: managed,
    enrollees: teamEnrollees,
    logs: teamLogs,
    resolvedZCodeMarkers,
    completedParentCodes,
    timelineConfig: {
      ...baseline,
      planStartIso: earliest,
      durationMonths,
      maxDurationMonths: durationMonths,
      gates: buildDefaultTimelineGates(durationMonths)
    }
  }
}
