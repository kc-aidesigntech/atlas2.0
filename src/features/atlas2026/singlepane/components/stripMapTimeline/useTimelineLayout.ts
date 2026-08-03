import { useMemo } from 'react'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import { scaleTime } from 'd3-scale'
import type {
  PartnerStripAggregateDot,
  RegulationTestStripMarker,
  ResolvedZCodeStripMarker,
  RouteLogEvent,
  StabilizationPhase,
  TimelineConfig
} from '../../types'
import { buildTimelinePhaseSegments, normalizeTimelineConfig } from '../../timelineConfigUtils'
import { addMonths } from '../timelineDateUtils'
import { TIMELINE_PHASE_COLORS } from '../timelineVisualConfig'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  addDays,
  assignCollisionLanes,
  groupResolvedMarkersByWeek,
  sortByTimestamp,
  truncateLabel
} from './geometry'
import { buildPartnerStageLayouts } from './partnerLayout'
import type { PhaseActionButton, PositionedEvent } from './types'

interface UseTimelineLayoutInput {
  baselineY: number
  collisionThreshold: number
  dragState: { eventId: string; ratio: number; hasMoved: boolean } | null
  events: RouteLogEvent[]
  isPartnerAggregateView: boolean
  marginX: number
  onRegulationTestsClick?: () => void
  onRenewalTestsClick?: () => void
  onRoutePlanningClick?: () => void
  partnerActiveDots: PartnerStripAggregateDot[]
  partnerCollisionThreshold: number
  partnerLaneStep: number
  partnerReferredDots: PartnerStripAggregateDot[]
  regulationTestMarkers: RegulationTestStripMarker[]
  resolvedZCodeMarkers: ResolvedZCodeStripMarker[]
  showReadinessProgress: boolean
  showRoutePlanningQuickAction: boolean
  timelineConfig: TimelineConfig
  width: number
}

export function useTimelineLayout({
  baselineY,
  collisionThreshold,
  dragState,
  events,
  isPartnerAggregateView,
  marginX,
  onRegulationTestsClick,
  onRenewalTestsClick,
  onRoutePlanningClick,
  partnerActiveDots,
  partnerCollisionThreshold,
  partnerLaneStep,
  partnerReferredDots,
  regulationTestMarkers,
  resolvedZCodeMarkers,
  showReadinessProgress,
  showRoutePlanningQuickAction,
  timelineConfig,
  width
}: UseTimelineLayoutInput) {
  const sortedEvents = useMemo(
    () => sortByTimestamp(events, (event) => event.timestampIso),
    [events]
  )
  const normalizedTimelineConfig = useMemo(() => normalizeTimelineConfig(timelineConfig), [timelineConfig])
  const safePlanStart = useMemo(() => {
    const parsed = new Date(timelineConfig.planStartIso)
    return Number.isFinite(parsed.getTime()) ? parsed : new Date()
  }, [timelineConfig.planStartIso])
  const safePlanEnd = useMemo(
    () => addMonths(safePlanStart, normalizedTimelineConfig.durationMonths),
    [normalizedTimelineConfig.durationMonths, safePlanStart]
  )
  const timeScale = useMemo(
    () => scaleTime().domain([safePlanStart, safePlanEnd]).range([marginX, width - marginX]),
    [marginX, safePlanEnd, safePlanStart, width]
  )
  const phaseSegments = useMemo(() => buildTimelinePhaseSegments(normalizedTimelineConfig), [normalizedTimelineConfig])
  const phaseBoundsByPhase = useMemo(() => {
    const bounds = new Map<StabilizationPhase, { xStart: number; xEnd: number }>()
    phaseSegments.forEach((segment) => {
      bounds.set(segment.phase, {
        xStart: Number(timeScale(addMonths(safePlanStart, segment.startOffset || 0))),
        xEnd: Number(timeScale(addMonths(safePlanStart, segment.endOffset || 0)))
      })
    })
    return bounds
  }, [phaseSegments, safePlanStart, timeScale])
  const readinessSegment = phaseBoundsByPhase.get('readiness') || null
  const regulationSegment = phaseBoundsByPhase.get('regulation') || null
  const baselinePoints = useMemo(
    () => [{ x: marginX, y: baselineY }, { x: width - marginX, y: baselineY }],
    [baselineY, marginX, width]
  )
  const visibleResolvedZCodeMarkers = useMemo(
    () =>
      showReadinessProgress
        ? sortByTimestamp(resolvedZCodeMarkers, (marker) => marker.resolvedAtIso)
        : [],
    [resolvedZCodeMarkers, showReadinessProgress]
  )
  const resolvedMarkerGroups = useMemo(
    () => groupResolvedMarkersByWeek(visibleResolvedZCodeMarkers),
    [visibleResolvedZCodeMarkers]
  )
  const resolvedMarkerLayouts = useMemo(
    () =>
      resolvedMarkerGroups.flatMap((group, groupIndex) => {
        const xRatio = (groupIndex + 1) / (resolvedMarkerGroups.length + 1)
        const priorCount = resolvedMarkerGroups.slice(0, groupIndex).reduce((count, prior) => count + prior.length, 0)
        return group.map((marker, stackIndex) => {
          const markerIndex = priorCount + stackIndex
          const fill = getZCodeParentColor(marker.parentCode) || SP_COLORS.yellow
          const stemOffsetX = stackIndex === 0 ? 0 : stackIndex * 6
          const lineLift = 42 + (markerIndex % 2) * 22
          const labelX = stemOffsetX + 62
          return {
            marker,
            xRatio,
            y: baselineY + stackIndex * 40,
            fill,
            textColor: usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg,
            partnerLabel: truncateLabel(marker.partnerName || 'resolved partner', 36),
            stemOffsetX,
            stemStrokeWidth: 2.2,
            labelX,
            labelY: -lineLift - 62,
            lineLift
          }
        })
      }),
    [baselineY, resolvedMarkerGroups]
  )
  const partnerStageDotLayouts = useMemo(
    () =>
      buildPartnerStageLayouts({
        activeDots: partnerActiveDots,
        baselineY,
        laneStep: partnerLaneStep,
        marginX,
        minSpacing: partnerCollisionThreshold,
        phaseBounds: phaseBoundsByPhase,
        referredDots: partnerReferredDots,
        safePlanEnd,
        safePlanStart,
        width
      }),
    [
      baselineY,
      marginX,
      partnerActiveDots,
      partnerCollisionThreshold,
      partnerLaneStep,
      partnerReferredDots,
      phaseBoundsByPhase,
      safePlanEnd,
      safePlanStart,
      width
    ]
  )
  const positionedEvents = useMemo<PositionedEvent[]>(() => {
    const raw = sortedEvents.map((event, index) => {
      const override = dragState?.eventId === event.id ? dragState.ratio : null
      const storedRatio = typeof event.timelinePositionRatio === 'number' && Number.isFinite(event.timelinePositionRatio)
        ? event.timelinePositionRatio
        : null
      const timestamp = new Date(event.timestampIso).getTime()
      const fallbackX = marginX + ((width - marginX * 2) * index) / Math.max(sortedEvents.length - 1, 1)
      const scaledX = Number.isFinite(timestamp) ? Number(timeScale(new Date(timestamp))) : fallbackX
      const ratio = typeof override === 'number' ? override : storedRatio
      const x = typeof ratio === 'number'
        ? marginX + (width - marginX * 2) * Math.max(0, Math.min(1, ratio))
        : Number.isFinite(scaledX) ? scaledX : fallbackX
      return { event, index, x, id: event.id }
    })
    const laneById = assignCollisionLanes(raw, collisionThreshold)
    return raw.map(({ id, ...item }) => ({ ...item, lane: laneById.get(id) || 0 }))
  }, [collisionThreshold, dragState, marginX, sortedEvents, timeScale, width])
  const regulationHistoryMarkers = useMemo(
    () => sortByTimestamp(regulationTestMarkers, (marker) => marker.attemptedAtIso),
    [regulationTestMarkers]
  )
  const phaseSeparatorPositions = useMemo(
    () =>
      phaseSegments.slice(0, -1).map((segment) => ({
        key: `${segment.phase}-separator`,
        x: Number(timeScale(addMonths(safePlanStart, segment.endOffset || 0)))
      })),
    [phaseSegments, safePlanStart, timeScale]
  )
  const phaseActionButtons = useMemo(
    () =>
      phaseSegments.flatMap((segment): PhaseActionButton[] => {
        const bounds = phaseBoundsByPhase.get(segment.phase)
        if (!bounds) return []
        const common = {
          key: segment.phase,
          centerX: (bounds.xStart + bounds.xEnd) / 2,
          color: TIMELINE_PHASE_COLORS[segment.phase]
        }
        if (isPartnerAggregateView && segment.phase === 'regulation') {
          return [{ ...common, label: 'regulation', onClick: () => {}, textColor: SP_COLORS.white }]
        }
        if (segment.phase === 'regulation' && onRegulationTestsClick) {
          return [{ ...common, label: 'regulation', onClick: onRegulationTestsClick, textColor: SP_COLORS.white }]
        }
        if (isPartnerAggregateView && segment.phase === 'readiness') {
          return [{ ...common, label: 'readiness', onClick: () => {}, textColor: SP_COLORS.bg }]
        }
        if (segment.phase === 'readiness' && onRoutePlanningClick && showRoutePlanningQuickAction) {
          return [{
            ...common,
            label: 'plan route',
            onClick: onRoutePlanningClick,
            textColor: SP_COLORS.bg,
            showArrowIcon: true
          }]
        }
        if (segment.phase === 'renewal' && onRenewalTestsClick) {
          return [{ ...common, label: 'renewal', onClick: onRenewalTestsClick, textColor: SP_COLORS.white }]
        }
        return []
      }),
    [
      isPartnerAggregateView,
      onRegulationTestsClick,
      onRenewalTestsClick,
      onRoutePlanningClick,
      phaseBoundsByPhase,
      phaseSegments,
      showRoutePlanningQuickAction
    ]
  )
  const incrementMarkers = useMemo(
    () => (normalizedTimelineConfig.durationMonths > 6 ? [60, 120, 180, 240, 300, 360] : [60, 120, 180])
      .map((dayOffset) => {
        const date = addDays(safePlanStart, dayOffset)
        return { dayOffset, dateIso: date.toISOString(), x: Number(timeScale(date)), incrementDate: date }
      })
      .filter((marker) => marker.incrementDate.getTime() < safePlanEnd.getTime()),
    [normalizedTimelineConfig.durationMonths, safePlanEnd, safePlanStart, timeScale]
  )
  return {
    baselinePoints,
    incrementMarkers,
    normalizedTimelineConfig,
    partnerStageDotLayouts,
    phaseActionButtons,
    phaseSegments,
    phaseSeparatorPositions,
    positionedEvents,
    readinessSegment,
    regulationHistoryMarkers,
    regulationSegment,
    resolvedMarkerGroups,
    resolvedMarkerLayouts,
    timeScale
  }
}
