import React from 'react'
import { Group } from '@visx/group'
import { LinePath } from '@visx/shape'
import type { ScaleTime } from 'd3-scale'
import type { RouteLogEvent, TimelineConfig } from '../../types'
import type { PositionedEvent } from './types'
import { addMonths, formatDateLabel } from '../timelineDateUtils'
import { TIMELINE_PHASE_COLORS, TIMELINE_STATUS_COLORS } from '../timelineVisualConfig'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { truncateLabel } from './geometry'

interface TimelineLanesProps {
  baselinePoints: Array<{ x: number; y: number }>
  baselineY: number
  dragEventId?: string
  incrementMarkers: Array<{ dayOffset: number; dateIso: string; x: number }>
  isPartnerAggregateMode: boolean
  isPartnerAggregateView: boolean
  isStartDateEditable: boolean
  laneStep: number
  marginX: number
  normalizedTimelineConfig: TimelineConfig
  onEditStart: () => void
  onEventDateChange?: (logId: string, nextTimestampIso: string) => void
  onOpenPartnerHistory?: () => void
  onPointerDown: (eventId: string, event: React.PointerEvent<SVGCircleElement>) => void
  onOpenEvent: (event: RouteLogEvent, x: number, y: number, index: number) => void
  onEditEventDate: (event: RouteLogEvent, x: number, y: number) => void
  onRegulationTestsClick?: () => void
  onRenewalTestsClick?: () => void
  onRoutePlanningClick?: () => void
  phaseLabelY: number
  phaseSegments: Array<{ phase: 'regulation' | 'readiness' | 'renewal'; label: string; startOffset: number; endOffset: number }>
  phaseSeparatorPositions: Array<{ key: string; x: number }>
  positionedEvents: PositionedEvent[]
  showReadinessProgress: boolean
  showRoutePlanningQuickAction: boolean
  timeScale: ScaleTime<number, number>
  width: number
}

export function TimelineLanes({
  baselinePoints,
  baselineY,
  dragEventId,
  incrementMarkers,
  isPartnerAggregateMode,
  isPartnerAggregateView,
  isStartDateEditable,
  laneStep,
  marginX,
  normalizedTimelineConfig,
  onEditStart,
  onEventDateChange,
  onOpenPartnerHistory,
  onPointerDown,
  onOpenEvent,
  onEditEventDate,
  onRegulationTestsClick,
  onRenewalTestsClick,
  onRoutePlanningClick,
  phaseLabelY,
  phaseSegments,
  phaseSeparatorPositions,
  positionedEvents,
  showReadinessProgress,
  showRoutePlanningQuickAction,
  timeScale,
  width
}: TimelineLanesProps) {
  return (
    <Group>
      <LinePath data={baselinePoints} x={(point) => point.x} y={(point) => point.y} stroke={SP_COLORS.white} strokeWidth={5} />
      {/* Phase labels remain passive until their corresponding workflow action is available. */}
      {phaseSegments.map((segment) => {
        const startDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.startOffset || 0)
        const endDate = addMonths(new Date(normalizedTimelineConfig.planStartIso), segment.endOffset || 0)
        const xStart = Number(timeScale(startDate))
        const xEnd = Number(timeScale(endDate))
        const isHiddenReadinessSegment = !showReadinessProgress && segment.phase !== 'regulation'
        const hidesPassiveLabel =
          (segment.phase === 'regulation' && (onRegulationTestsClick || isPartnerAggregateView)) ||
          (segment.phase === 'readiness' && ((onRoutePlanningClick && showRoutePlanningQuickAction) || isPartnerAggregateView)) ||
          (segment.phase === 'renewal' && (onRenewalTestsClick || isPartnerAggregateView))
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
            {hidesPassiveLabel ? null : (
              <text x={(xStart + xEnd) / 2} y={phaseLabelY} textAnchor="middle" fill={TIMELINE_PHASE_COLORS[segment.phase]} fontFamily="Helvetica, Arial, sans-serif" fontSize="22">
                {segment.label}
              </text>
            )}
          </g>
        )
      })}
      {phaseSeparatorPositions.map((separator) => (
        <g key={separator.key} transform={`translate(${separator.x}, ${baselineY})`} aria-hidden="true">
          <line x1="-24" y1="0" x2="24" y2="0" stroke="#000000" strokeWidth="10" strokeLinecap="round" />
          {/* Inline vector arrows avoid an external asset dependency in exported timelines. */}
          <polyline points="-8,-10 8,0 -8,10" fill="none" stroke={SP_COLORS.white} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      <g transform={`translate(${marginX}, ${baselineY})`} style={{ cursor: isStartDateEditable ? 'pointer' : 'default' }} onClick={onEditStart}>
        <title>{`${formatDateLabel(normalizedTimelineConfig.planStartIso)}${isStartDateEditable ? ' - click to edit' : ''}`}</title>
        <circle r="10.5" fill="#000000" stroke={SP_COLORS.white} strokeWidth="2.2" />
        <text x="-10" y="36" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight={700}>start</text>
        <text x="-10" y="58" fill={SP_COLORS.yellow} fontFamily="Helvetica, Arial, sans-serif" fontSize="18">
          {formatDateLabel(normalizedTimelineConfig.planStartIso)}
        </text>
      </g>
      {incrementMarkers.map((marker) => (
        <g key={marker.dayOffset} transform={`translate(${marker.x}, ${baselineY})`}>
          <title>{`${marker.dayOffset} days from start · ${formatDateLabel(marker.dateIso)}`}</title>
          <text y="34" textAnchor="middle" fill={SP_COLORS.muted} fontFamily="Helvetica, Arial, sans-serif" fontSize="16">{marker.dayOffset}d</text>
        </g>
      ))}
      <g
        transform={`translate(${width - marginX}, ${baselineY})`}
        style={{ cursor: isPartnerAggregateMode && onOpenPartnerHistory ? 'pointer' : 'default' }}
        onClick={() => isPartnerAggregateMode && onOpenPartnerHistory?.()}
      >
        <title>{isPartnerAggregateMode && onOpenPartnerHistory ? 'Open partner renewal history' : 'Timeline endpoint'}</title>
        <circle r="10.5" fill="#000000" stroke={isPartnerAggregateMode ? TIMELINE_PHASE_COLORS.renewal : SP_COLORS.white} strokeWidth="2.2" />
      </g>
      {!isPartnerAggregateMode
        ? positionedEvents.map(({ event, index, x, lane }) => {
            const y = baselineY - lane * laneStep
            const isDragging = dragEventId === event.id
            return (
              <g key={event.id} transform={`translate(${x}, ${y})`}>
                <circle r="22" fill="transparent" style={{ cursor: 'grab', touchAction: 'none' }} onPointerDown={(pointerEvent) => onPointerDown(event.id, pointerEvent)} />
                <circle
                  r="14"
                  fill={TIMELINE_STATUS_COLORS[event.status]}
                  stroke={SP_COLORS.white}
                  strokeWidth="2.2"
                  fillOpacity="0.95"
                  style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                  onPointerDown={(pointerEvent) => onPointerDown(event.id, pointerEvent)}
                  onClick={() => onOpenEvent(event, x, y, index)}
                  onDoubleClick={() => onEditEventDate(event, x, y)}
                />
                <title>{`${event.label} · ${formatDateLabel(event.timestampIso)}${onEventDateChange ? ' - click to edit date' : ''}`}</title>
                <text y={-30} textAnchor="middle" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="16">{index + 1}</text>
                <text x="20" y="-34" transform="rotate(-45 20 -34)" textAnchor="start" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="19">
                  {truncateLabel(event.label, 30)}
                </text>
              </g>
            )
          })
        : null}
    </Group>
  )
}
