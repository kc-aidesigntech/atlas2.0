import type {
  AdminDataQualityMetric,
  CountyHeatPoint,
  JourneyStationMarker,
  RouteCandidateRecord
} from '@/features/atlas2026/shared/contracts'
import {
  fetchEnrollmentStationMarkers,
  fetchSinglePaneAdminMetrics,
  fetchSinglePaneCountyHeatmap,
  fetchSinglePaneRouteCandidates
} from '@atlas/shared'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

// Cache per enrollment to prevent duplicate route reads while timeline views mount concurrently.
const routeCandidatesCache = new Map<string, RouteCandidateRecord[]>()
const routeCandidatesInFlight = new Map<string, Promise<RouteCandidateRecord[]>>()
const journeyStationMarkersCache = new Map<string, JourneyStationMarker[]>()
const journeyStationMarkersInFlight = new Map<string, Promise<JourneyStationMarker[]>>()

export async function loadRouteCandidates(enrollmentId?: string): Promise<RouteCandidateRecord[]> {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return []
  const cached = routeCandidatesCache.get(enrollmentId)
  if (cached) return cached
  const existingRequest = routeCandidatesInFlight.get(enrollmentId)
  if (existingRequest) return existingRequest

  const request = withOptionalSupabaseFallback(
    `singlepane.routeCandidates:${enrollmentId}`,
    () => fetchSinglePaneRouteCandidates(supabase, enrollmentId),
    []
  )
    .then((rows) => {
      const mapped = rows.map((row) => ({
        stationId: row.stationId,
        partnerId: row.partnerId,
        stationName: row.stationName,
        score: row.score,
        matchedZCodeCount: row.matchedZCodeCount,
        needUnitsMatched: row.needUnitsMatched,
        partnerBurdenTotal: row.partnerBurdenTotal,
        matchedZCodes: row.matchedZCodes,
        matchedParentSummaries: row.matchedParentSummaries
      }))
      routeCandidatesCache.set(enrollmentId, mapped)
      return mapped
    })
    .finally(() => {
      routeCandidatesInFlight.delete(enrollmentId)
    })

  routeCandidatesInFlight.set(enrollmentId, request)
  return request
}

export async function prefetchRouteCandidatesForEnrollments(enrollmentIds: string[]) {
  const uniqueEnrollmentIds = Array.from(new Set(enrollmentIds.map((value) => value.trim()).filter(Boolean)))
  await Promise.all(uniqueEnrollmentIds.map((enrollmentId) => loadRouteCandidates(enrollmentId).catch(() => [])))
}

export function invalidateRouteCandidatesCache(enrollmentId?: string | null) {
  const normalizedEnrollmentId = (enrollmentId || '').trim()
  if (!normalizedEnrollmentId) {
    routeCandidatesCache.clear()
    routeCandidatesInFlight.clear()
    return
  }
  routeCandidatesCache.delete(normalizedEnrollmentId)
  routeCandidatesInFlight.delete(normalizedEnrollmentId)
}

export async function loadCountyHeatmap(): Promise<CountyHeatPoint[]> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []
  const rows = await withOptionalSupabaseFallback('singlepane.countyHeatmap', () => fetchSinglePaneCountyHeatmap(supabase), [])
  return rows.map((row) => ({
    countyId: row.countyId,
    countyName: row.countyName,
    zGroup: row.zGroup,
    activeCaseCount: row.activeCaseCount
  }))
}

export async function loadAdminDataQuality(): Promise<AdminDataQualityMetric[]> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []
  return withOptionalSupabaseFallback('singlepane.adminMetrics', () => fetchSinglePaneAdminMetrics(supabase), [])
}

export async function loadJourneyStationMarkers(enrollmentId?: string, enrolleeId?: string): Promise<JourneyStationMarker[]> {
  if (!enrollmentId) return []
  const cached = journeyStationMarkersCache.get(enrollmentId)
  if (cached) return cached
  const existingRequest = journeyStationMarkersInFlight.get(enrollmentId)
  if (existingRequest) return existingRequest

  const request = (hasSupabaseConfig && supabase
    ? withOptionalSupabaseFallback(
        `singlepane.stationMarkers:${enrollmentId}`,
        () => fetchEnrollmentStationMarkers(supabase, enrollmentId),
        []
      ).then((rows) =>
        rows
          .filter((marker) => marker.status === 'completed')
          .map((marker) => ({
            id: marker.routePlanStopId,
            stationName: marker.stationName,
            assignedAtIso: marker.assignedAt,
            phase: 'renewal',
            iconSlug: marker.iconSlug || undefined,
            markerType: 'history' as const
          }))
      )
    : Promise.resolve([]))
    .then((markers) => {
      journeyStationMarkersCache.set(enrollmentId, markers)
      return markers
    })
    .finally(() => {
      journeyStationMarkersInFlight.delete(enrollmentId)
    })

  journeyStationMarkersInFlight.set(enrollmentId, request)
  return request
}

export async function prefetchJourneyStationMarkersForEnrollments(
  enrollments: Array<{ enrollmentId?: string; enrolleeId?: string }>
) {
  await Promise.all(
    enrollments.map((entry) =>
      loadJourneyStationMarkers(entry.enrollmentId, entry.enrolleeId).catch(() => [])
    )
  )
}

export function invalidateJourneyStationMarkersCache(enrollmentId?: string | null) {
  const normalizedEnrollmentId = (enrollmentId || '').trim()
  if (!normalizedEnrollmentId) {
    journeyStationMarkersCache.clear()
    journeyStationMarkersInFlight.clear()
    return
  }
  journeyStationMarkersCache.delete(normalizedEnrollmentId)
  journeyStationMarkersInFlight.delete(normalizedEnrollmentId)
}
