import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { Group } from '@visx/group'
import { LinePath } from '@visx/shape'
import { scaleTime } from 'd3-scale'
import LocalDateInputBox from './LocalDateInputBox'
import StripMapControlOverlay from './StripMapControlOverlay'
import type { JourneyStationMarker, RegulationTestStripMarker, RouteLogEvent, StabilizationPhase, TimelineConfig } from '../types'
import { buildTimelinePhaseSegments, normalizeTimelineConfig } from '../timelineConfigUtils'
import { SP_COLORS } from '../theme'
import milestoneArrowIcon from '../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png'

interface StripMapTimelineProps {
  events: RouteLogEvent[]
  timelineConfig: TimelineConfig
  stationMarkers?: JourneyStationMarker[]
  highlightedStationName?: string | null
  regulationTestMarkers?: RegulationTestStripMarker[]
  isRegulationCleared?: boolean
  showReadinessProgress?: boolean
  showRoutePlanningQuickAction?: boolean
  onRoutePlanningClick?: () => void
  onRegulationTestsClick?: () => void
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

const STATUS_COLORS = {
  planned: SP_COLORS.steel,
  active: SP_COLORS.orange,
  completed: SP_COLORS.deepGreen,
  blocked: SP_COLORS.red
}

const PHASE_COLORS: Record<StabilizationPhase, string> = {
  regulation: SP_COLORS.red,
  readiness: SP_COLORS.yellow,
  renewal: SP_COLORS.deepGreen
}

function addMonths(date: Date, months: number) {
  const clone = new Date(date)
  clone.setMonth(clone.getMonth() + months)
  return clone
}

function addDays(date: Date, days: number) {
  const clone = new Date(date)
  clone.setDate(clone.getDate() + days)
  return clone
}

function formatDateLabel(timestampIso: string) {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return 'date pending'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatDateInputValue(timestampIso: string) {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return ''
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mergeDateInputWithTime(dateInput: string, currentIso: string) {
  const date = new Date(currentIso)
  const safeHours = Number.isFinite(date.getTime()) ? date.getUTCHours() : 9
  const safeMinutes = Number.isFinite(date.getTime()) ? date.getUTCMinutes() : 0
  const safeSeconds = Number.isFinite(date.getTime()) ? date.getUTCSeconds() : 0
  const safeMilliseconds = Number.isFinite(date.getTime()) ? date.getUTCMilliseconds() : 0
  const next = new Date(`${dateInput}T00:00:00.000Z`)
  next.setUTCHours(safeHours, safeMinutes, safeSeconds, safeMilliseconds)
  return next.toISOString()
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

export default function StripMapTimeline({
  events,
  timelineConfig,
  stationMarkers = [],
  highlightedStationName = null,
  regulationTestMarkers = [],
  isRegulationCleared = false,
  showReadinessProgress = true,
  showRoutePlanningQuickAction = false,
  onRoutePlanningClick,
  onRegulationTestsClick,
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

  const phaseSegments = useMemo(() => {
    return buildTimelinePhaseSegments(normalizedTimelineConfig)
  }, [normalizedTimelineConfig])

  const phaseActionButtons = useMemo(() => {
    return phaseSegments
      .map((segment) => {
        const startDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.startOffset || 0)
        const endDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.endOffset || 0)
        const xStart = Number(timeScale(startDate))
        const xEnd = Number(timeScale(endDate))
        const centerX = (xStart + xEnd) / 2

        if (segment.phase === 'regulation' && onRegulationTestsClick) {
          return {
            key: segment.phase,
            label: 'regulation',
            onClick: onRegulationTestsClick,
            centerX,
            color: PHASE_COLORS.regulation,
            textColor: SP_COLORS.white
          }
        }

        if (segment.phase === 'readiness' && onRoutePlanningClick && showRoutePlanningQuickAction) {
          return {
            key: segment.phase,
            label: 'readiness',
            onClick: onRoutePlanningClick,
            centerX,
            color: PHASE_COLORS.readiness,
            textColor: SP_COLORS.bg
          }
        }

        if (segment.phase === 'renewal') {
          return {
            key: segment.phase,
            label: 'renewal',
            onClick: () => undefined,
            centerX,
            color: PHASE_COLORS.renewal,
            textColor: SP_COLORS.white,
            disabled: true
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
      disabled?: boolean
    }>
  }, [normalizedTimelineConfig.planStartIso, onRegulationTestsClick, onRoutePlanningClick, phaseSegments, showRoutePlanningQuickAction, timeScale])

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

  return (
    <div ref={wrapperRef} className="relative h-[580px] w-full overflow-visible">
      {highlightedStationName ? (
        <div
          className="absolute left-4 top-4 z-10 max-w-[360px] rounded-[24px] border px-4 py-3"
          style={{ borderColor: `${SP_COLORS.yellow}88`, backgroundColor: 'var(--surface-panel-raised)' }}
        >
          <small
            className="block text-[11px] uppercase tracking-[0.08em]"
            style={{ color: SP_COLORS.yellow }}
          >
            focused station
          </small>
          <div className="mt-1 text-[18px] leading-tight text-white">{highlightedStationName}</div>
        </div>
      ) : null}
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
            top: 6,
            transform: 'translateX(-50%)'
          }}
        >
          <AtlasTextButton
            onClick={button.onClick}
            disabled={button.disabled}
            className="px-5 py-1.5 text-[22px] font-medium"
            style={{
              ['--button-border-color' as const]: button.color,
              ['--button-line-color' as const]: button.textColor,
              color: button.textColor,
              backgroundColor: button.color
            } as React.CSSProperties}
          >
            {button.label}
          </AtlasTextButton>
        </div>
      ))}
      <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Group>
          <LinePath data={baselinePoints} x={(point) => point.x} y={(point) => point.y} stroke={SP_COLORS.white} strokeWidth={5} />

          {/* phase corridor segments driven by dynamic gates */}
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
                  stroke={PHASE_COLORS[segment.phase]}
                  strokeWidth={6}
                  strokeOpacity={isHiddenReadinessSegment ? 0.18 : 0.8}
                />
                {segment.phase === 'regulation' && onRegulationTestsClick
                  ? null
                  : segment.phase === 'readiness' && onRoutePlanningClick && showRoutePlanningQuickAction
                    ? null
                    : segment.phase === 'renewal'
                      ? null
                      : (
                  <text
                    x={(xStart + xEnd) / 2}
                    y={phaseLabelY}
                    textAnchor="middle"
                    fill={PHASE_COLORS[segment.phase]}
                    fontFamily="Helvetica, Arial, sans-serif"
                    fontSize="22"
                  >
                    {segment.label}
                  </text>
                    )}
              </g>
            )
          })}

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
                <image
                  href={milestoneArrowIcon}
                  x={-11}
                  y={68}
                  width={22}
                  height={22}
                  transform="rotate(90 0 79)"
                  opacity={0.72}
                />
                <text
                  y="112"
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

          {positionedEvents.map(({ event, index, x, lane }) => {
            const color = STATUS_COLORS[event.status]
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
          })}

          {readinessSegment && visibleSuggestedMarkers.map((marker, index) => {
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

          {phaseSegments
            .filter((segment) => segment.phase === 'regulation')
            .map((segment) => {
              const startDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.startOffset || 0)
              const endDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.endOffset || 0)
              const xStart = Number(timeScale(startDate))
              const xEnd = Number(timeScale(endDate))
              const segmentWidth = Math.max(xEnd - xStart, 1)
              return regulationTestMarkers.map((marker, index) => {
                const ratio = (index + 1) / Math.max(regulationTestMarkers.length + 1, 1)
                const x = xStart + segmentWidth * ratio
                const y = baselineY - 118 - (index % 2) * 42
                const color = marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red
                return (
                  <g key={marker.id} transform={`translate(${x}, ${y})`}>
                    <title>{`${marker.label} · ${marker.passed ? 'pass' : 'fail'} · ${formatDateLabel(marker.attemptedAtIso)}`}</title>
                    <circle r="12" fill={color} stroke={SP_COLORS.white} strokeWidth="2" />
                    <text y="-20" textAnchor="middle" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="11" fontWeight={700}>
                      {marker.label}
                    </text>
                    {marker.isLatestCompleted ? (
                      <circle r="18" fill="transparent" stroke={SP_COLORS.white} strokeWidth="1" strokeDasharray="3 3" />
                    ) : null}
                  </g>
                )
              })
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
    </div>
  )
}
