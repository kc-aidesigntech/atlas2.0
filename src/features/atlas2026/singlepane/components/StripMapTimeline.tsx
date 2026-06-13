/**
 * Interactive strip-map timeline for Atlas (ATLAS) journey execution, including phase
 * gates, draggable events, and resolution/station marker overlays.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { Group } from '@visx/group'
import { LinePath } from '@visx/shape'
import { scaleTime } from 'd3-scale'
import LocalDateInputBox from './LocalDateInputBox'
import StripMapControlOverlay from './StripMapControlOverlay'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import type {
  JourneyStationMarker,
  PartnerStripAggregateDot,
  RegulationTestStripMarker,
  ResolvedZCodeStripMarker,
  RouteLogEvent,
  StabilizationPhase,
  TimelineConfig
} from '../types'
import { buildTimelinePhaseSegments, normalizeTimelineConfig } from '../timelineConfigUtils'
import {
  addMonths,
  formatDateInputValue,
  formatDateLabel,
  formatDateTimeLabel,
  mergeDateInputWithTime
} from './timelineDateUtils'
import { TIMELINE_PHASE_COLORS, TIMELINE_STATUS_COLORS } from './timelineVisualConfig'
import { SP_COLORS } from '../theme'
import milestoneArrowIcon from '../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png'

interface StripMapTimelineProps {
  events: RouteLogEvent[]
  timelineConfig: TimelineConfig
  completedParentCodes?: string[]
  resolvedZCodeMarkers?: ResolvedZCodeStripMarker[]
  stationMarkers?: JourneyStationMarker[]
  highlightedStationName?: string | null
  regulationTestMarkers?: RegulationTestStripMarker[]
  isRegulationCleared?: boolean
  showReadinessProgress?: boolean
  isPartnerAggregateView?: boolean
  partnerAggregateReferredDots?: PartnerStripAggregateDot[]
  partnerAggregateActiveDots?: PartnerStripAggregateDot[]
  onPartnerHistoryClick?: () => void
  showRoutePlanningQuickAction?: boolean
  onRoutePlanningClick?: () => void
  onRegulationTestsClick?: () => void
  onRenewalTestsClick?: () => void
  onEventDelete?: (logId: string) => void
  onEventPositionChange?: (logId: string, timelinePositionRatio: number | null) => void
  onEventDateChange?: (logId: string, nextTimestampIso: string) => void
  onStartDateChange?: (nextStartIso: string) => void
  onExtendPhaseDuration?: (phase: StabilizationPhase) => void
  onTimelineConfigChange?: (nextConfig: TimelineConfig) => void
}

interface PositionedEvent {
  event: RouteLogEvent
  index: number
  x: number
  lane: number
}

interface DateEditorState {
  kind: 'start' | 'event'
  anchorX: number
  anchorY: number
  label: string
  value: string
  logId?: string
  currentIso: string
}

interface ResolvedTooltipState {
  markerId: string
  x: number
  y: number
  title: string
  description: string
  resolvedAtLabel: string
  partnerName: string | null
  pinned: boolean
}

function addDays(date: Date, days: number) {
  const clone = new Date(date)
  clone.setDate(clone.getDate() + days)
  return clone
}

function wrapLabel(label: string, maxCharsPerLine: number) {
  const safeMax = Math.max(6, maxCharsPerLine)
  const words = label.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let current = words[0]
  for (let index = 1; index < words.length; index += 1) {
    const next = words[index]
    if (`${current} ${next}`.length <= safeMax) {
      current = `${current} ${next}`
    } else {
      lines.push(current)
      current = next
    }
  }
  lines.push(current)
  return lines
}

function truncateLabel(label: string, visibleChars: number) {
  const normalized = label.trim()
  if (normalized.length <= visibleChars) return normalized
  return `${normalized.slice(0, Math.max(visibleChars, 1)).trimEnd()}...`
}

const RESOLVED_STACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// Nearby resolved markers are grouped into weekly windows so dense activity is
// legible without overlapping stems and labels.
function groupResolvedMarkersByWeek(markers: ResolvedZCodeStripMarker[]) {
  return markers.reduce<ResolvedZCodeStripMarker[][]>((groups, marker) => {
    const markerTime = new Date(marker.resolvedAtIso).getTime()
    const currentGroup = groups[groups.length - 1]
    const groupAnchorMarker = currentGroup?.[0]
    const groupAnchorTime = groupAnchorMarker ? new Date(groupAnchorMarker.resolvedAtIso).getTime() : Number.NaN
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

export default function StripMapTimeline({
  events,
  timelineConfig,
  completedParentCodes = [],
  resolvedZCodeMarkers = [],
  stationMarkers = [],
  highlightedStationName = null,
  regulationTestMarkers = [],
  isRegulationCleared = false,
  showReadinessProgress = true,
  isPartnerAggregateView = false,
  partnerAggregateReferredDots = [],
  partnerAggregateActiveDots = [],
  onPartnerHistoryClick,
  showRoutePlanningQuickAction = false,
  onRoutePlanningClick,
  onRegulationTestsClick,
  onRenewalTestsClick,
  onEventDelete,
  onEventPositionChange,
  onEventDateChange,
  onStartDateChange,
  onExtendPhaseDuration,
  onTimelineConfigChange
}: StripMapTimelineProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const suppressClickRef = useRef(false)
  const [width, setWidth] = useState(920)
  const [dragState, setDragState] = useState<{ eventId: string; ratio: number; hasMoved: boolean } | null>(null)
  const [dateEditor, setDateEditor] = useState<DateEditorState | null>(null)
  const [dateEditorError, setDateEditorError] = useState<string | null>(null)
  const [isControlOverlayOpen, setIsControlOverlayOpen] = useState(false)
  const [resolvedTooltip, setResolvedTooltip] = useState<ResolvedTooltipState | null>(null)
  const height = 540
  const baselineY = 292
  const marginX = 90
  const laneStep = 82
  const collisionThreshold = 32
  const editorWidth = 220
  const editorHeight = 148
  const editorOffsetX = 20
  const editorOffsetY = 14
  const phaseLabelY = baselineY + 76

  useEffect(() => {
    const node = wrapperRef.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setWidth(Math.max(640, entry.contentRect.width))
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()),
    [events]
  )

  const safePlanStart = useMemo(() => {
    const parsed = new Date(timelineConfig.planStartIso)
    return Number.isFinite(parsed.getTime()) ? parsed : new Date()
  }, [timelineConfig.planStartIso])

  const normalizedTimelineConfig = useMemo(() => normalizeTimelineConfig(timelineConfig), [timelineConfig])

  const safePlanEnd = useMemo(() => {
    const safeDuration = normalizedTimelineConfig.durationMonths
    return addMonths(safePlanStart, safeDuration)
  }, [normalizedTimelineConfig.durationMonths, safePlanStart])

  const timeScale = useMemo(() => {
    return scaleTime().domain([safePlanStart, safePlanEnd]).range([marginX, width - marginX])
  }, [marginX, safePlanEnd, safePlanStart, width])

  const baselinePoints = useMemo(
    () => [
      { x: marginX, y: baselineY },
      { x: width - marginX, y: baselineY }
    ],
    [baselineY, marginX, width]
  )

  const suggestedMarkers = useMemo(() => stationMarkers.filter((marker) => marker.markerType === 'suggested'), [stationMarkers])
  const visibleSuggestedMarkers = showReadinessProgress ? suggestedMarkers : []

  const readinessSegment = useMemo(() => {
    const readinessIndex = normalizedTimelineConfig.gates.findIndex((gate) => gate.phase === 'readiness')
    const readinessGate = readinessIndex >= 0 ? normalizedTimelineConfig.gates[readinessIndex] : null
    const nextGate = readinessIndex >= 0 ? normalizedTimelineConfig.gates[readinessIndex + 1] : null
    if (!readinessGate || !nextGate) return null
    return {
      xStart: Number(timeScale(addMonths(safePlanStart, readinessGate.monthOffset || 0))),
      xEnd: Number(timeScale(addMonths(safePlanStart, nextGate.monthOffset || 0)))
    }
  }, [normalizedTimelineConfig.gates, safePlanStart, timeScale])

  const regulationSegment = useMemo(() => {
    const regulationIndex = normalizedTimelineConfig.gates.findIndex((gate) => gate.phase === 'regulation')
    const regulationGate = regulationIndex >= 0 ? normalizedTimelineConfig.gates[regulationIndex] : null
    const nextGate = regulationIndex >= 0 ? normalizedTimelineConfig.gates[regulationIndex + 1] : null
    if (!regulationGate || !nextGate) return null
    return {
      xStart: Number(timeScale(addMonths(safePlanStart, regulationGate.monthOffset || 0))),
      xEnd: Number(timeScale(addMonths(safePlanStart, nextGate.monthOffset || 0)))
    }
  }, [normalizedTimelineConfig.gates, safePlanStart, timeScale])

  const regulationHistoryMarkers = useMemo(
    () =>
      [...regulationTestMarkers].sort(
        (left, right) => new Date(left.attemptedAtIso).getTime() - new Date(right.attemptedAtIso).getTime()
      ),
    [regulationTestMarkers]
  )

  const visibleResolvedZCodeMarkers = useMemo(
    () =>
      showReadinessProgress
        ? [...resolvedZCodeMarkers].sort(
            (left, right) => new Date(left.resolvedAtIso).getTime() - new Date(right.resolvedAtIso).getTime()
          )
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
        const ratio = (groupIndex + 1) / (resolvedMarkerGroups.length + 1)
        const x = ratio
        const groupStartIndex = resolvedMarkerGroups
          .slice(0, groupIndex)
          .reduce((count, priorGroup) => count + priorGroup.length, 0)
        return group.map((marker, stackIndex) => {
          const markerIndex = groupStartIndex + stackIndex
          const y = baselineY + stackIndex * 40
          const fill = getZCodeParentColor(marker.parentCode) || SP_COLORS.yellow
          const textColor = usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg
          const partnerLabel = truncateLabel(marker.partnerName || 'resolved partner', 36)
          const stemOffsetX = stackIndex === 0 ? 0 : stackIndex * 6
          const stemStrokeWidth = 2.2
          const diagonalRun = 62
          const lineLift = 42 + (markerIndex % 2) * 22
          const labelX = stemOffsetX + diagonalRun
          const labelY = -lineLift - diagonalRun
          return {
            marker,
            xRatio: x,
            y,
            fill,
            textColor,
            partnerLabel,
            stemOffsetX,
            stemStrokeWidth,
            labelX,
            labelY,
            lineLift
          }
        })
      }),
    [baselineY, resolvedMarkerGroups]
  )
  const maxResolvedStackDepth = useMemo(
    () => resolvedMarkerGroups.reduce((maxDepth, group) => Math.max(maxDepth, group.length), 0),
    [resolvedMarkerGroups]
  )

  const phaseSegments = useMemo(() => {
    return buildTimelinePhaseSegments(normalizedTimelineConfig)
  }, [normalizedTimelineConfig])
  const isPartnerAggregateMode = isPartnerAggregateView && (partnerAggregateReferredDots.length > 0 || partnerAggregateActiveDots.length > 0)
  const phaseBoundsByPhase = useMemo(() => {
    const next = new Map<StabilizationPhase, { xStart: number; xEnd: number }>()
    phaseSegments.forEach((segment) => {
      const startDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.startOffset || 0)
      const endDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.endOffset || 0)
      next.set(segment.phase, {
        xStart: Number(timeScale(startDate)),
        xEnd: Number(timeScale(endDate))
      })
    })
    return next
  }, [normalizedTimelineConfig.planStartIso, phaseSegments, timeScale])
  const partnerReferredDotLayouts = useMemo(() => {
    const stackDepthByKey = new Map<string, number>()
    return partnerAggregateReferredDots
      .slice()
      .sort((left, right) => new Date(left.occurredAtIso).getTime() - new Date(right.occurredAtIso).getTime())
      .map((dot) => {
        const bounds = phaseBoundsByPhase.get(dot.phase)
        if (!bounds) return null
        const dotDate = new Date(dot.occurredAtIso)
        const monthStart = Number.isFinite(dotDate.getTime())
          ? Date.UTC(dotDate.getUTCFullYear(), dotDate.getUTCMonth(), 1)
          : Date.UTC(safePlanStart.getUTCFullYear(), safePlanStart.getUTCMonth(), 1)
        const key = `${dot.phase}:${monthStart}`
        const stackIndex = stackDepthByKey.get(key) || 0
        stackDepthByKey.set(key, stackIndex + 1)
        const clampedRatio = Number.isFinite(dotDate.getTime())
          ? Math.max(0, Math.min(1, (dotDate.getTime() - safePlanStart.getTime()) / Math.max(safePlanEnd.getTime() - safePlanStart.getTime(), 1)))
          : 0.5
        const projectedX = marginX + (width - marginX * 2) * clampedRatio
        const x = Math.max(bounds.xStart + 10, Math.min(bounds.xEnd - 10, projectedX))
        return {
          id: dot.id,
          x,
          y: baselineY - 18 - stackIndex * 14,
          fill: TIMELINE_PHASE_COLORS[dot.phase],
          phase: dot.phase,
          occurredAtIso: dot.occurredAtIso
        }
      })
      .filter(Boolean) as Array<{ id: string; x: number; y: number; fill: string; phase: StabilizationPhase; occurredAtIso: string }>
  }, [baselineY, marginX, partnerAggregateReferredDots, phaseBoundsByPhase, safePlanEnd, safePlanStart, width])
  const partnerActiveDotLayouts = useMemo(() => {
    const stackDepthByKey = new Map<string, number>()
    return partnerAggregateActiveDots
      .slice()
      .sort((left, right) => new Date(left.occurredAtIso).getTime() - new Date(right.occurredAtIso).getTime())
      .map((dot) => {
        const bounds = phaseBoundsByPhase.get(dot.phase)
        if (!bounds) return null
        const dotDate = new Date(dot.occurredAtIso)
        const monthStart = Number.isFinite(dotDate.getTime())
          ? Date.UTC(dotDate.getUTCFullYear(), dotDate.getUTCMonth(), 1)
          : Date.UTC(safePlanStart.getUTCFullYear(), safePlanStart.getUTCMonth(), 1)
        const key = `${dot.phase}:${monthStart}`
        const stackIndex = stackDepthByKey.get(key) || 0
        stackDepthByKey.set(key, stackIndex + 1)
        const clampedRatio = Number.isFinite(dotDate.getTime())
          ? Math.max(0, Math.min(1, (dotDate.getTime() - safePlanStart.getTime()) / Math.max(safePlanEnd.getTime() - safePlanStart.getTime(), 1)))
          : 0.5
        const projectedX = marginX + (width - marginX * 2) * clampedRatio
        const x = Math.max(bounds.xStart + 10, Math.min(bounds.xEnd - 10, projectedX))
        return {
          id: dot.id,
          x,
          y: baselineY + 18 + stackIndex * 14,
          fill: TIMELINE_STATUS_COLORS.active,
          phase: dot.phase,
          occurredAtIso: dot.occurredAtIso
        }
      })
      .filter(Boolean) as Array<{ id: string; x: number; y: number; fill: string; phase: StabilizationPhase; occurredAtIso: string }>
  }, [baselineY, marginX, partnerAggregateActiveDots, phaseBoundsByPhase, safePlanEnd, safePlanStart, width])
  const phaseSeparatorPositions = useMemo(
    () =>
      phaseSegments.slice(0, -1).map((segment) => {
        const endDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.endOffset || 0)
        return {
          key: `${segment.phase}-separator`,
          x: Number(timeScale(endDate))
        }
      }),
    [normalizedTimelineConfig.planStartIso, phaseSegments, timeScale]
  )

  const phaseActionButtons = useMemo(() => {
    return phaseSegments
      .map((segment) => {
        const startDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.startOffset || 0)
        const endDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.endOffset || 0)
        const xStart = Number(timeScale(startDate))
        const xEnd = Number(timeScale(endDate))
        const centerX = (xStart + xEnd) / 2

        if (isPartnerAggregateView && segment.phase === 'regulation') {
          return {
            key: segment.phase,
            label: 'regulation',
            onClick: () => {},
            centerX,
            color: TIMELINE_PHASE_COLORS.regulation,
            textColor: SP_COLORS.white
          }
        }

        if (segment.phase === 'regulation' && onRegulationTestsClick) {
          return {
            key: segment.phase,
            label: 'regulation',
            onClick: onRegulationTestsClick,
            centerX,
            color: TIMELINE_PHASE_COLORS.regulation,
            textColor: SP_COLORS.white
          }
        }

        if (isPartnerAggregateView && segment.phase === 'readiness') {
          return {
            key: segment.phase,
            label: 'readiness',
            onClick: () => {},
            centerX,
            color: TIMELINE_PHASE_COLORS.readiness,
            textColor: SP_COLORS.bg
          }
        }

        if (segment.phase === 'readiness' && onRoutePlanningClick && showRoutePlanningQuickAction) {
          return {
            key: segment.phase,
            label: 'plan route',
            onClick: onRoutePlanningClick,
            centerX,
            color: TIMELINE_PHASE_COLORS.readiness,
            textColor: SP_COLORS.bg,
            iconHref: milestoneArrowIcon
          }
        }

        if (segment.phase === 'renewal' && onRenewalTestsClick) {
          return {
            key: segment.phase,
            label: 'renewal',
            onClick: onRenewalTestsClick,
            centerX,
            color: TIMELINE_PHASE_COLORS.renewal,
            textColor: SP_COLORS.white
          }
        }

        return null
      })
      .filter(Boolean) as Array<{
      key: StabilizationPhase
      label: string
      onClick: () => void
      centerX: number
      color: string
      textColor: string
      iconHref?: string
      disabled?: boolean
    }>
  }, [
    isPartnerAggregateView,
    normalizedTimelineConfig.planStartIso,
    onRegulationTestsClick,
    // onRenewalTestsClick must invalidate this memo: its presence is what flips the
    // renewal slot from passive green lettering to the actionable button.
    onRenewalTestsClick,
    onRoutePlanningClick,
    phaseSegments,
    showRoutePlanningQuickAction,
    timeScale
  ])

  const incrementMarkers = useMemo(() => {
    const configuredMilestones = normalizedTimelineConfig.durationMonths > 6 ? [60, 120, 180, 240, 300, 360] : [60, 120, 180]
    return configuredMilestones
      .map((dayOffset) => {
        const incrementDate = addDays(safePlanStart, dayOffset)
        return {
          dayOffset,
          dateIso: incrementDate.toISOString(),
          x: Number(timeScale(incrementDate)),
          incrementDate
        }
      })
      .filter((marker) => marker.incrementDate.getTime() < safePlanEnd.getTime())
  }, [normalizedTimelineConfig.durationMonths, safePlanEnd, safePlanStart, timeScale])
  const deepestResolvedMarkerBottom = maxResolvedStackDepth ? baselineY + (maxResolvedStackDepth - 1) * 40 + 18 : baselineY
  const deepestPartnerActiveBottom = partnerActiveDotLayouts.length
    ? Math.max(...partnerActiveDotLayouts.map((layout) => layout.y)) + 10
    : baselineY
  const incrementLabelBottom = incrementMarkers.length ? baselineY + 34 : baselineY
  const phaseButtonsTop = Math.max(deepestResolvedMarkerBottom, deepestPartnerActiveBottom, incrementLabelBottom) + 42
  const focusedStationTop = phaseButtonsTop + 64
  const containerHeight = highlightedStationName ? Math.max(height, focusedStationTop + 72) : Math.max(height, phaseButtonsTop + 64)

  function getEventX(event: RouteLogEvent, index: number) {
    if (typeof event.timelinePositionRatio === 'number' && Number.isFinite(event.timelinePositionRatio)) {
      return marginX + (width - marginX * 2) * Math.max(0, Math.min(1, event.timelinePositionRatio))
    }
    const timestamp = new Date(event.timestampIso).getTime()
    const denominator = Math.max(sortedEvents.length - 1, 1)
    const fallbackX = marginX + ((width - marginX * 2) * index) / denominator
    if (Number.isFinite(timestamp)) {
      const scaledX = Number(timeScale(new Date(timestamp)))
      return Number.isFinite(scaledX) ? scaledX : fallbackX
    }
    return fallbackX
  }

  const positionedEvents = useMemo<PositionedEvent[]>(() => {
    const rawPositions = sortedEvents.map((event, index) => {
      const dragOverride = dragState?.eventId === event.id ? dragState.ratio : null
      const x =
        typeof dragOverride === 'number'
          ? marginX + (width - marginX * 2) * Math.max(0, Math.min(1, dragOverride))
          : getEventX(event, index)

      return { event, index, x }
    })

    const laneLastX: number[] = []
    const laneByEventId = new Map<string, number>()
    rawPositions
      .slice()
      .sort((left, right) => left.x - right.x)
      .forEach((item) => {
        let lane = 0
        while (laneLastX[lane] !== undefined && item.x - laneLastX[lane] < collisionThreshold) {
          lane += 1
        }
        laneLastX[lane] = item.x
        laneByEventId.set(item.event.id, lane)
      })

    return rawPositions.map((item) => ({
      ...item,
      lane: laneByEventId.get(item.event.id) || 0
    }))
  }, [collisionThreshold, dragState, marginX, sortedEvents, width])

  function getRatioFromClientX(clientX: number) {
    const svgNode = svgRef.current
    if (!svgNode) return 0
    const bounds = svgNode.getBoundingClientRect()
    if (!bounds.width) return 0
    const localX = ((clientX - bounds.left) / bounds.width) * width
    return Math.max(0, Math.min(1, (localX - marginX) / Math.max(width - marginX * 2, 1)))
  }

  function handlePointerDown(eventId: string, pointerEvent: React.PointerEvent<SVGCircleElement>) {
    pointerEvent.preventDefault()
    pointerEvent.stopPropagation()
    const ratio = getRatioFromClientX(pointerEvent.clientX)
    setDragState({ eventId, ratio, hasMoved: false })
  }

  function openStartDateEditor() {
    if (!onTimelineConfigChange && !onStartDateChange) return
    setIsControlOverlayOpen(true)
  }

  function openEventDateEditor(eventRecord: RouteLogEvent, x: number, y: number) {
    if (!onEventDateChange) return
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setDateEditorError(null)
    setDateEditor({
      kind: 'event',
      anchorX: x,
      anchorY: y + 28,
      label: eventRecord.label,
      value: formatDateInputValue(eventRecord.timestampIso),
      logId: eventRecord.id,
      currentIso: eventRecord.timestampIso
    })
  }

  function commitDateEditor() {
    if (!dateEditor) return
    const parsed = new Date(`${dateEditor.value}T00:00:00.000Z`)
    if (!dateEditor.value || !Number.isFinite(parsed.getTime())) {
      setDateEditorError('Use a valid date in YYYY-MM-DD format.')
      return
    }
    if (dateEditor.kind === 'start') {
      onStartDateChange?.(parsed.toISOString())
    } else if (dateEditor.logId) {
      onEventDateChange?.(dateEditor.logId, mergeDateInputWithTime(dateEditor.value, dateEditor.currentIso))
    }
    setDateEditor(null)
    setDateEditorError(null)
  }

  useEffect(() => {
    if (!dragState) return undefined

    function handlePointerMove(event: PointerEvent) {
      const ratio = getRatioFromClientX(event.clientX)
      setDragState((current) =>
        current
          ? {
              ...current,
              ratio,
              hasMoved: current.hasMoved || Math.abs(ratio - current.ratio) > 0.003
            }
          : current
      )
    }

    function handlePointerUp(event: PointerEvent) {
      const ratio = getRatioFromClientX(event.clientX)
      onEventPositionChange?.(dragState.eventId, ratio)
      suppressClickRef.current = dragState.hasMoved
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState, onEventPositionChange, width])

  useEffect(() => {
    if (!resolvedTooltip?.pinned) return undefined

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-resolved-zcode-marker="true"]')) return
      setResolvedTooltip(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [resolvedTooltip?.pinned])

  return (
    <div ref={wrapperRef} className="relative w-full overflow-visible" style={{ height: containerHeight }}>
      {dateEditor ? (
        <div
          className="absolute z-20"
          style={{
            left: Math.max(8, Math.min(width - editorWidth - 8, dateEditor.anchorX + editorOffsetX)),
            top: Math.max(8, Math.min(height - editorHeight - 8, dateEditor.anchorY - editorHeight - editorOffsetY))
          }}
        >
          <LocalDateInputBox
            label={dateEditor.label}
            value={dateEditor.value}
            error={dateEditorError}
            onChange={(nextValue) => {
              setDateEditor((current) => (current ? { ...current, value: nextValue } : current))
              setDateEditorError(null)
            }}
            onSave={commitDateEditor}
            onCancel={() => {
              setDateEditor(null)
              setDateEditorError(null)
            }}
            onDelete={
              dateEditor.kind === 'event' && typeof dateEditor.logId === 'string' && onEventDelete
                ? () => {
                    onEventDelete(dateEditor.logId)
                    setDateEditor(null)
                    setDateEditorError(null)
                  }
                : null
            }
            deleteLabel="delete entry"
          />
        </div>
      ) : null}
      <StripMapControlOverlay
        isOpen={isControlOverlayOpen}
        timelineConfig={normalizedTimelineConfig}
        onClose={() => setIsControlOverlayOpen(false)}
        onSave={(nextConfig) => {
          onTimelineConfigChange?.(nextConfig)
          if (!onTimelineConfigChange && onStartDateChange && nextConfig.planStartIso !== normalizedTimelineConfig.planStartIso) {
            onStartDateChange(nextConfig.planStartIso)
          }
          setIsControlOverlayOpen(false)
        }}
      />
      {phaseActionButtons.map((button) => (
        <div
          key={button.key}
          className="absolute z-20"
          style={{
            left: button.centerX,
            top: phaseButtonsTop,
            transform: 'translateX(-50%)'
          }}
        >
          <AtlasTextButton
            type="button"
            onClick={button.onClick}
            disabled={button.disabled}
            className="inline-flex items-center gap-2 px-5 py-1.5 text-[22px] font-medium"
            style={{
              ['--button-border-color' as const]: button.color,
              ['--button-line-color' as const]: button.textColor,
              color: button.textColor,
              backgroundColor: button.color
            } as React.CSSProperties}
          >
            {button.label}
            {button.iconHref ? (
              <img
                src={button.iconHref}
                alt=""
                aria-hidden="true"
                className="h-[1.1rem] w-[1.1rem] rotate-90"
                style={button.textColor === SP_COLORS.bg ? { filter: 'brightness(0) saturate(100%)' } : undefined}
              />
            ) : null}
          </AtlasTextButton>
        </div>
      ))}
      <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Group>
          <LinePath data={baselinePoints} x={(point) => point.x} y={(point) => point.y} stroke={SP_COLORS.white} strokeWidth={5} />

          {/* phase corridor segments driven by dynamic gates. Segment labels fall back
              to passive lettering whenever the segment has no actionable button.
              Renewal intentionally mirrors readiness' first-entry presentation: until
              readiness completes (parent withholds onRenewalTestsClick), "renewal"
              renders as plain green lettering, then transitions to the button state. */}
          {phaseSegments.map((segment) => {
            const startDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.startOffset || 0)
            const endDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.endOffset || 0)
            const xStart = Number(timeScale(startDate))
            const xEnd = Number(timeScale(endDate))
            const isHiddenReadinessSegment = !showReadinessProgress && segment.phase !== 'regulation'
            return (
              <g key={segment.phase}>
                <line
                  x1={xStart}
                  y1={baselineY}
                  x2={xEnd}
                  y2={baselineY}
                  stroke={TIMELINE_PHASE_COLORS[segment.phase]}
                  strokeWidth={6}
                  strokeOpacity={isHiddenReadinessSegment ? 0.18 : 0.8}
                />
                {segment.phase === 'regulation' && (onRegulationTestsClick || isPartnerAggregateView)
                  ? null
                  : segment.phase === 'readiness' && ((onRoutePlanningClick && showRoutePlanningQuickAction) || isPartnerAggregateView)
                    ? null
                    : segment.phase === 'renewal' && (onRenewalTestsClick || isPartnerAggregateView)
                      ? null
                      : (
                  <text
                    x={(xStart + xEnd) / 2}
                    y={phaseLabelY}
                    textAnchor="middle"
                    fill={TIMELINE_PHASE_COLORS[segment.phase]}
                    fontFamily="Helvetica, Arial, sans-serif"
                    fontSize="22"
                  >
                    {segment.label}
                  </text>
                    )}
              </g>
            )
          })}

          {phaseSeparatorPositions.map((separator) => (
            <g key={separator.key} transform={`translate(${separator.x}, ${baselineY})`} aria-hidden="true">
              <line x1="-24" y1="0" x2="24" y2="0" stroke="#000000" strokeWidth="10" strokeLinecap="round" />
              <image href={milestoneArrowIcon} x={-17} y={-17} width={34} height={34} transform="rotate(90 0 0)" opacity={1} />
            </g>
          ))}

          <g
            transform={`translate(${marginX}, ${baselineY})`}
            style={{ cursor: onStartDateChange ? 'pointer' : 'default' }}
            onClick={openStartDateEditor}
          >
            <title>{`${formatDateLabel(normalizedTimelineConfig.planStartIso)}${onStartDateChange ? ' - click to edit' : ''}`}</title>
            <circle r="10.5" fill="#000000" stroke={SP_COLORS.white} strokeWidth="2.2" />
            <text x="-10" y="36" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight={700}>
              start
            </text>
            <text x="-10" y="58" fill={SP_COLORS.yellow} fontFamily="Helvetica, Arial, sans-serif" fontSize="18">
              {formatDateLabel(normalizedTimelineConfig.planStartIso)}
            </text>
          </g>

          {incrementMarkers.map((marker) => {
            return (
              <g key={marker.dayOffset} transform={`translate(${marker.x}, ${baselineY})`}>
                <title>{`${marker.dayOffset} days from start · ${formatDateLabel(marker.dateIso)}`}</title>
                <text
                  y="34"
                  textAnchor="middle"
                  fill={SP_COLORS.muted}
                  fontFamily="Helvetica, Arial, sans-serif"
                  fontSize="16"
                >
                  {marker.dayOffset}d
                </text>
              </g>
            )
          })}

          <g
            transform={`translate(${width - marginX}, ${baselineY})`}
            style={{ cursor: isPartnerAggregateMode && onPartnerHistoryClick ? 'pointer' : 'default' }}
            onClick={() => {
              if (!isPartnerAggregateMode) return
              onPartnerHistoryClick?.()
            }}
          >
            <title>
              {isPartnerAggregateMode && onPartnerHistoryClick
                ? 'Open partner renewal history'
                : 'Timeline endpoint'}
            </title>
            <circle
              r="10.5"
              fill="#000000"
              stroke={isPartnerAggregateMode ? TIMELINE_PHASE_COLORS.renewal : SP_COLORS.white}
              strokeWidth="2.2"
            />
          </g>

          {!isPartnerAggregateMode
            ? positionedEvents.map(({ event, index, x, lane }) => {
            const color = TIMELINE_STATUS_COLORS[event.status]
            const y = baselineY - lane * laneStep
            const isDragging = dragState?.eventId === event.id
            const angledLabel = truncateLabel(event.label, 30)
            return (
              <g key={event.id} transform={`translate(${x}, ${y})`}>
                <circle
                  r="22"
                  fill="transparent"
                  style={{ cursor: 'grab', touchAction: 'none' }}
                  onPointerDown={(pointerEvent) => handlePointerDown(event.id, pointerEvent)}
                />
                <circle
                  r="14"
                  fill={color}
                  stroke={SP_COLORS.white}
                  strokeWidth="2.2"
                  fillOpacity="0.95"
                  style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                  onPointerDown={(pointerEvent) => handlePointerDown(event.id, pointerEvent)}
                  onClick={() => openEventDateEditor(event, x, y)}
                />
                <title>{`${event.label} · ${formatDateLabel(event.timestampIso)}${onEventDateChange ? ' - click to edit date' : ''}`}</title>
                <text y={-30} textAnchor="middle" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="16">
                  {index + 1}
                </text>
                <text
                  x="20"
                  y="-34"
                  transform="rotate(-45 20 -34)"
                  textAnchor="start"
                  fill={SP_COLORS.white}
                  fontFamily="Helvetica, Arial, sans-serif"
                  fontSize="19"
                >
                  {angledLabel}
                </text>
              </g>
            )
            })
            : null}

          {isPartnerAggregateMode
            ? partnerReferredDotLayouts.map((dot) => (
                <g key={dot.id} transform={`translate(${dot.x}, ${dot.y})`}>
                  <title>{`referred · ${dot.phase} · ${formatDateLabel(dot.occurredAtIso)}`}</title>
                  <circle r="6.5" fill={dot.fill} stroke={SP_COLORS.white} strokeWidth="1.2" />
                </g>
              ))
            : null}

          {isPartnerAggregateMode
            ? partnerActiveDotLayouts.map((dot) => (
                <g key={dot.id} transform={`translate(${dot.x}, ${dot.y})`}>
                  <title>{`active assignment · ${dot.phase} · ${formatDateLabel(dot.occurredAtIso)}`}</title>
                  <circle r="6.5" fill={dot.fill} stroke={TIMELINE_PHASE_COLORS[dot.phase]} strokeWidth="1.2" />
                </g>
              ))
            : null}

          {!isPartnerAggregateMode && readinessSegment && visibleSuggestedMarkers.map((marker, index) => {
            const segmentWidth = readinessSegment.xEnd - readinessSegment.xStart
            const slotWidth = segmentWidth / Math.max(visibleSuggestedMarkers.length + 1, 1)
            const ratio = (index + 1) / (visibleSuggestedMarkers.length + 1)
            const x = readinessSegment.xStart + (readinessSegment.xEnd - readinessSegment.xStart) * ratio
            const circleY = baselineY
            const isHighlighted = highlightedStationName === marker.stationName
            const visibleChars = Math.max(40, Math.floor(slotWidth / 4.2))
            const labelText = truncateLabel(`${index + 1}. ${marker.stationName}`, visibleChars)
            const needsLift = visibleSuggestedMarkers.length >= 4 || slotWidth < 120
            const verticalLift = needsLift ? 34 + (index % 2) * 22 : 0
            const verticalTopY = circleY - verticalLift
            const diagonalRun = Math.max(42, Math.min(88, slotWidth * 0.34))
            const labelAnchorX = x + diagonalRun
            const labelAnchorY = verticalTopY - diagonalRun
            return (
              <g key={marker.id} transform={`translate(${x}, ${circleY})`}>
                <title>{`rank ${index + 1} · ${marker.stationName}`}</title>
                <circle r="7" fill="#000000" stroke={isHighlighted ? SP_COLORS.yellow : SP_COLORS.white} strokeWidth="1.8" />
                {needsLift ? (
                  <line
                    x1="0"
                    y1="-7"
                    x2="0"
                    y2={verticalTopY - circleY}
                    stroke={isHighlighted ? SP_COLORS.yellow : SP_COLORS.white}
                    strokeWidth="1.1"
                  />
                ) : null}
                <line
                  x1="0"
                  y1={needsLift ? verticalTopY - circleY : -7}
                  x2={labelAnchorX - x}
                  y2={labelAnchorY - circleY}
                  stroke={isHighlighted ? SP_COLORS.yellow : SP_COLORS.white}
                  strokeWidth="1.1"
                />
                <text
                  x={labelAnchorX - x + 4}
                  y={labelAnchorY - circleY - 2}
                  transform={`rotate(-45 ${labelAnchorX - x + 4} ${labelAnchorY - circleY - 2})`}
                  textAnchor="start"
                  fill={isHighlighted ? SP_COLORS.yellow : SP_COLORS.white}
                  fontFamily="Helvetica, Arial, sans-serif"
                  fontSize="16"
                >
                  {labelText}
                </text>
              </g>
            )
          })}

          {!isPartnerAggregateMode && readinessSegment &&
            (visibleResolvedZCodeMarkers.length
              ? [
                  ...resolvedMarkerLayouts.map(({ marker, xRatio, y, fill, stemOffsetX, stemStrokeWidth, labelX, labelY, lineLift }) => {
                    const x = readinessSegment.xStart + (readinessSegment.xEnd - readinessSegment.xStart) * xRatio
                    return (
                      <g key={`${marker.id}-stems`} transform={`translate(${x}, ${y})`} aria-hidden="true">
                        <line x1={stemOffsetX} y1="-17" x2={stemOffsetX} y2={-lineLift} stroke={fill} strokeWidth={stemStrokeWidth} />
                        <line x1={stemOffsetX} y1={-lineLift} x2={labelX} y2={labelY} stroke={fill} strokeWidth={stemStrokeWidth} />
                      </g>
                    )
                  }),
                  ...resolvedMarkerLayouts.map(({ marker, xRatio, y, fill, textColor, partnerLabel, labelX, labelY }) => {
                    const x = readinessSegment.xStart + (readinessSegment.xEnd - readinessSegment.xStart) * xRatio
                    return (
                      <g
                        key={marker.id}
                        data-resolved-zcode-marker="true"
                        transform={`translate(${x}, ${y})`}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() =>
                          setResolvedTooltip({
                            markerId: marker.id,
                            x,
                            y,
                            title: marker.zCode,
                            description: marker.description,
                            resolvedAtLabel: formatDateTimeLabel(marker.resolvedAtIso),
                            partnerName: marker.partnerName || null,
                            pinned: false
                          })
                        }
                        onMouseLeave={() => setResolvedTooltip((current) => (current?.pinned ? current : null))}
                        onClick={(event) => {
                          event.stopPropagation()
                          setResolvedTooltip((current) =>
                            current?.markerId === marker.id && current.pinned
                              ? null
                              : {
                                  markerId: marker.id,
                                  x,
                                  y,
                                  title: marker.zCode,
                                  description: marker.description,
                                  resolvedAtLabel: formatDateTimeLabel(marker.resolvedAtIso),
                                  partnerName: marker.partnerName || null,
                                  pinned: true
                                }
                          )
                        }}
                      >
                        <title>{`${marker.zCode} resolved\n${marker.description}\n${formatDateTimeLabel(marker.resolvedAtIso)}`}</title>
                        <circle r="17" fill={fill} stroke={fill} strokeWidth="2" />
                        <text
                          y="5"
                          textAnchor="middle"
                          fill={textColor}
                          fontFamily="Helvetica, Arial, sans-serif"
                          fontSize="11"
                          fontWeight={700}
                        >
                          {marker.zCode.replace(/^Z/i, '')}
                        </text>
                        <circle cx="12" cy="-13" r="7.5" fill={SP_COLORS.deepGreen} stroke={SP_COLORS.white} strokeWidth="1.3" />
                        <text
                          x="12"
                          y="-10.1"
                          textAnchor="middle"
                          fill={SP_COLORS.white}
                          fontFamily="Helvetica, Arial, sans-serif"
                          fontSize="9"
                          fontWeight={700}
                        >
                          ✓
                        </text>
                        <text
                          x={labelX + 4}
                          y={labelY - 2}
                          transform={`rotate(-45 ${labelX + 4} ${labelY - 2})`}
                          textAnchor="start"
                          fill={SP_COLORS.white}
                          fontFamily="Helvetica, Arial, sans-serif"
                          fontSize="15"
                        >
                          {partnerLabel}
                        </text>
                      </g>
                    )
                  })
                ]
              : completedParentCodes.map((parentCode, index) => {
                  const normalized = parentCode.trim().toUpperCase()
                  const ratio = (index + 1) / (completedParentCodes.length + 1)
                  const x = readinessSegment.xStart + (readinessSegment.xEnd - readinessSegment.xStart) * ratio
                  const fill = getZCodeParentColor(normalized) || SP_COLORS.yellow
                  const textColor = usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg
                  return (
                    <g key={`resolved-${normalized}`} transform={`translate(${x}, ${baselineY})`}>
                      <title>{`${normalized} resolved`}</title>
                      <circle r="16" fill={fill} stroke={fill} strokeWidth="2" />
                      <text
                        y="5"
                        textAnchor="middle"
                        fill={textColor}
                        fontFamily="Helvetica, Arial, sans-serif"
                        fontSize="14"
                        fontWeight={700}
                      >
                        {normalized.replace(/^Z/, '')}
                      </text>
                      <circle cx="11" cy="-12" r="7.5" fill={SP_COLORS.deepGreen} stroke={SP_COLORS.white} strokeWidth="1.3" />
                      <text
                        x="11"
                        y="-9.4"
                        textAnchor="middle"
                        fill={SP_COLORS.white}
                        fontFamily="Helvetica, Arial, sans-serif"
                        fontSize="9"
                        fontWeight={700}
                      >
                        ✓
                      </text>
                    </g>
                  )
                }))}

          {!isPartnerAggregateMode && regulationSegment && regulationHistoryMarkers.map((marker, index) => {
            const segmentWidth = regulationSegment.xEnd - regulationSegment.xStart
            const slotWidth = segmentWidth / Math.max(regulationHistoryMarkers.length + 1, 1)
            const ratio = (index + 1) / (regulationHistoryMarkers.length + 1)
            const x = regulationSegment.xStart + (regulationSegment.xEnd - regulationSegment.xStart) * ratio
            const circleY = baselineY
            const color = marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red
            const markerLabel = `${marker.label.toLowerCase()} · ${marker.passed ? 'pass' : 'fail'}`
            const visibleChars = Math.max(34, Math.floor(slotWidth / 4.4))
            const labelText = truncateLabel(markerLabel, visibleChars)
            const needsLift = regulationHistoryMarkers.length >= 3 || slotWidth < 140
            const verticalLift = needsLift ? 34 + (index % 2) * 22 : 0
            const verticalTopY = circleY - verticalLift
            const diagonalRun = Math.max(42, Math.min(88, slotWidth * 0.34))
            const labelAnchorX = x + diagonalRun
            const labelAnchorY = verticalTopY - diagonalRun
            return (
              <g key={marker.id} transform={`translate(${x}, ${circleY})`}>
                <title>{`${marker.label} · ${marker.passed ? 'pass' : 'fail'} · ${formatDateLabel(marker.attemptedAtIso)}`}</title>
                <circle r="7" fill="#000000" stroke={color} strokeWidth="1.8" />
                {marker.isLatestCompleted ? (
                  <circle r="11" fill="transparent" stroke={SP_COLORS.white} strokeWidth="1" strokeDasharray="3 3" />
                ) : null}
                {needsLift ? (
                  <line
                    x1="0"
                    y1="-7"
                    x2="0"
                    y2={verticalTopY - circleY}
                    stroke={color}
                    strokeWidth="1.1"
                  />
                ) : null}
                <line
                  x1="0"
                  y1={needsLift ? verticalTopY - circleY : -7}
                  x2={labelAnchorX - x}
                  y2={labelAnchorY - circleY}
                  stroke={color}
                  strokeWidth="1.1"
                />
                <text
                  x={labelAnchorX - x + 4}
                  y={labelAnchorY - circleY - 2}
                  transform={`rotate(-45 ${labelAnchorX - x + 4} ${labelAnchorY - circleY - 2})`}
                  textAnchor="start"
                  fill={color}
                  fontFamily="Helvetica, Arial, sans-serif"
                  fontSize="16"
                >
                  {labelText}
                </text>
              </g>
            )
          })}
        </Group>
      </svg>
      {phaseActionButtons
        .filter((button) => button.key === 'regulation' && isRegulationCleared)
        .map((button) => (
          <div
            key={`${button.key}-gate`}
            className="absolute z-20"
            style={{
              left: button.centerX,
              top: 64,
              transform: 'translateX(-50%)'
            }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border text-[18px]"
              style={{ borderColor: SP_COLORS.white, color: SP_COLORS.white, backgroundColor: '#000000' }}
            >
              ✓
            </div>
          </div>
        ))}
      {!showReadinessProgress ? (
        <div
          className="absolute bottom-16 right-5 rounded-[18px] border px-4 py-2 text-[12px]"
          style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red, backgroundColor: 'rgba(0,0,0,0.78)' }}
        >
          readiness hidden pending regulation clearance
        </div>
      ) : null}
      {resolvedTooltip ? (
        <div
          className="absolute z-30 w-[260px] rounded-[18px] border px-4 py-3"
          style={{
            left: Math.max(12, Math.min(width - 272, resolvedTooltip.x + 18)),
            top: Math.max(90, resolvedTooltip.y - 6),
            borderColor: '#ffffff24',
            backgroundColor: 'rgba(6,6,6,0.96)'
          }}
        >
          <small className="block text-[10px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
            resolved z-code
          </small>
          <div className="mt-1 text-[16px] font-medium text-white">{resolvedTooltip.title}</div>
          <small className="mt-1 block text-[12px] leading-[1.45]" style={{ color: '#d7e0e9' }}>
            {resolvedTooltip.description}
          </small>
          {resolvedTooltip.partnerName ? (
            <small className="mt-2 block text-[11px] leading-[1.45]" style={{ color: '#a6d5b2' }}>
              partner: {resolvedTooltip.partnerName}
            </small>
          ) : null}
          <small className="mt-1 block text-[11px] leading-[1.45]" style={{ color: '#c5ced8' }}>
            resolved: {resolvedTooltip.resolvedAtLabel}
          </small>
        </div>
      ) : null}
      {highlightedStationName ? (
        <div
          className="absolute z-20 max-w-[320px] rounded-[20px] border px-4 py-2 text-center"
          style={{
            left: readinessSegment ? readinessSegment.xStart + (readinessSegment.xEnd - readinessSegment.xStart) / 2 : width / 2,
            top: focusedStationTop,
            transform: 'translateX(-50%)',
            borderColor: `${SP_COLORS.yellow}88`,
            backgroundColor: 'var(--surface-panel-raised)'
          }}
        >
          <small className="block text-[10px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.yellow }}>
            next station
          </small>
          <div className="mt-1 text-[16px] leading-tight text-white">{highlightedStationName}</div>
        </div>
      ) : null}
    </div>
  )
}
