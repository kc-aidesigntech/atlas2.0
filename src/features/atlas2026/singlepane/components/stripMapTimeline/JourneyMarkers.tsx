import React from 'react'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import type {
  JourneyStationMarker,
  RegulationTestStripMarker,
  ResolvedZCodeStripMarker
} from '../../types'
import { formatDateLabel, formatDateTimeLabel } from '../timelineDateUtils'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { truncateLabel } from './geometry'
import type { ResolvedTooltipState, TimelineMarkerInspectorState } from './types'

export interface ResolvedMarkerLayout {
  marker: ResolvedZCodeStripMarker
  xRatio: number
  y: number
  fill: string
  textColor: string
  partnerLabel: string
  stemOffsetX: number
  stemStrokeWidth: number
  labelX: number
  labelY: number
  lineLift: number
}

interface AngledMarkerProps {
  color: string
  label: string
  needsLift: boolean
  onClick: () => void
  title: string
  verticalLift: number
  x: number
  y: number
  diagonalRun: number
}

function AngledMarker({ color, label, needsLift, onClick, title, verticalLift, x, y, diagonalRun }: AngledMarkerProps) {
  const verticalTopY = y - verticalLift
  const labelAnchorX = x + diagonalRun
  const labelAnchorY = verticalTopY - diagonalRun
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }} onClick={onClick}>
      <title>{title}</title>
      <circle r="7" fill="#000000" stroke={color} strokeWidth="1.8" />
      {needsLift ? <line x1="0" y1="-7" x2="0" y2={verticalTopY - y} stroke={color} strokeWidth="1.1" /> : null}
      <line x1="0" y1={needsLift ? verticalTopY - y : -7} x2={labelAnchorX - x} y2={labelAnchorY - y} stroke={color} strokeWidth="1.1" />
      <text
        x={labelAnchorX - x + 4}
        y={labelAnchorY - y - 2}
        transform={`rotate(-45 ${labelAnchorX - x + 4} ${labelAnchorY - y - 2})`}
        textAnchor="start"
        fill={color}
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize="16"
      >
        {label}
      </text>
    </g>
  )
}

interface JourneyMarkersProps {
  baselineY: number
  completedParentCodes: string[]
  highlightedStationName: string | null
  readinessSegment: { xStart: number; xEnd: number } | null
  regulationHistoryMarkers: RegulationTestStripMarker[]
  regulationSegment: { xStart: number; xEnd: number } | null
  resolvedMarkerLayouts: ResolvedMarkerLayout[]
  setResolvedTooltip: React.Dispatch<React.SetStateAction<ResolvedTooltipState | null>>
  suggestedMarkers: JourneyStationMarker[]
  onOpenInspector: (inspector: TimelineMarkerInspectorState) => void
}

export function JourneyMarkers({
  baselineY,
  completedParentCodes,
  highlightedStationName,
  readinessSegment,
  regulationHistoryMarkers,
  regulationSegment,
  resolvedMarkerLayouts,
  setResolvedTooltip,
  suggestedMarkers,
  onOpenInspector
}: JourneyMarkersProps) {
  return (
    <>
      {readinessSegment
        ? suggestedMarkers.map((marker, index) => {
            const segmentWidth = readinessSegment.xEnd - readinessSegment.xStart
            const slotWidth = segmentWidth / Math.max(suggestedMarkers.length + 1, 1)
            const x = readinessSegment.xStart + segmentWidth * ((index + 1) / (suggestedMarkers.length + 1))
            const needsLift = suggestedMarkers.length >= 4 || slotWidth < 120
            const color = highlightedStationName === marker.stationName ? SP_COLORS.yellow : SP_COLORS.white
            return (
              <AngledMarker
                key={marker.id}
                color={color}
                label={truncateLabel(`${index + 1}. ${marker.stationName}`, Math.max(40, Math.floor(slotWidth / 4.2)))}
                needsLift={needsLift}
                verticalLift={needsLift ? 34 + (index % 2) * 22 : 0}
                diagonalRun={Math.max(42, Math.min(88, slotWidth * 0.34))}
                x={x}
                y={baselineY}
                title={`rank ${index + 1} · ${marker.stationName}`}
                onClick={() =>
                  onOpenInspector({
                    id: `suggested:${marker.id}`,
                    x,
                    y: baselineY,
                    title: marker.stationName,
                    subtitle: `rank ${index + 1} suggested station`,
                    details: [`phase: ${marker.phase}`, `assigned at: ${formatDateTimeLabel(marker.assignedAtIso)}`, `marker id: ${marker.id}`]
                  })
                }
              />
            )
          })
        : null}
      {readinessSegment && resolvedMarkerLayouts.length
        ? resolvedMarkerLayouts.map((layout) => {
            const { marker, xRatio, y, fill, textColor, partnerLabel, stemOffsetX, stemStrokeWidth, labelX, labelY, lineLift } = layout
            const x = readinessSegment.xStart + (readinessSegment.xEnd - readinessSegment.xStart) * xRatio
            const tooltip = (pinned: boolean): ResolvedTooltipState => ({
              markerId: marker.id,
              x,
              y,
              title: marker.zCode,
              description: marker.description,
              resolvedAtLabel: formatDateTimeLabel(marker.resolvedAtIso),
              partnerName: marker.partnerName || null,
              pinned
            })
            return (
              <g key={marker.id}>
                <g transform={`translate(${x}, ${y})`} aria-hidden="true">
                  <line x1={stemOffsetX} y1="-17" x2={stemOffsetX} y2={-lineLift} stroke={fill} strokeWidth={stemStrokeWidth} />
                  <line x1={stemOffsetX} y1={-lineLift} x2={labelX} y2={labelY} stroke={fill} strokeWidth={stemStrokeWidth} />
                </g>
                <g
                  data-resolved-zcode-marker="true"
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setResolvedTooltip(tooltip(false))}
                  onMouseLeave={() => setResolvedTooltip((current) => (current?.pinned ? current : null))}
                  onClick={(event) => {
                    event.stopPropagation()
                    setResolvedTooltip((current) => (current?.markerId === marker.id && current.pinned ? null : tooltip(true)))
                  }}
                >
                  <title>{`${marker.zCode} resolved\n${marker.description}\n${formatDateTimeLabel(marker.resolvedAtIso)}`}</title>
                  <circle r="17" fill={fill} stroke={fill} strokeWidth="2" />
                  <text y="5" textAnchor="middle" fill={textColor} fontFamily="Helvetica, Arial, sans-serif" fontSize="11" fontWeight={700}>
                    {marker.zCode.replace(/^Z/i, '')}
                  </text>
                  <circle cx="12" cy="-13" r="7.5" fill={SP_COLORS.deepGreen} stroke={SP_COLORS.white} strokeWidth="1.3" />
                  <text x="12" y="-10.1" textAnchor="middle" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="9" fontWeight={700}>✓</text>
                  <text x={labelX + 4} y={labelY - 2} transform={`rotate(-45 ${labelX + 4} ${labelY - 2})`} textAnchor="start" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="15">
                    {partnerLabel}
                  </text>
                </g>
              </g>
            )
          })
        : readinessSegment
          ? completedParentCodes.map((parentCode, index) => {
              const normalized = parentCode.trim().toUpperCase()
              const x = readinessSegment.xStart + (readinessSegment.xEnd - readinessSegment.xStart) * ((index + 1) / (completedParentCodes.length + 1))
              const fill = getZCodeParentColor(normalized) || SP_COLORS.yellow
              const textColor = usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg
              return (
                <g key={`resolved-${normalized}`} transform={`translate(${x}, ${baselineY})`}>
                  <title>{`${normalized} resolved`}</title>
                  <circle r="16" fill={fill} stroke={fill} strokeWidth="2" />
                  <text y="5" textAnchor="middle" fill={textColor} fontFamily="Helvetica, Arial, sans-serif" fontSize="14" fontWeight={700}>{normalized.replace(/^Z/, '')}</text>
                  <circle cx="11" cy="-12" r="7.5" fill={SP_COLORS.deepGreen} stroke={SP_COLORS.white} strokeWidth="1.3" />
                  <text x="11" y="-9.4" textAnchor="middle" fill={SP_COLORS.white} fontFamily="Helvetica, Arial, sans-serif" fontSize="9" fontWeight={700}>✓</text>
                </g>
              )
            })
          : null}
      {regulationSegment
        ? regulationHistoryMarkers.map((marker, index) => {
            const segmentWidth = regulationSegment.xEnd - regulationSegment.xStart
            const slotWidth = segmentWidth / Math.max(regulationHistoryMarkers.length + 1, 1)
            const x = regulationSegment.xStart + segmentWidth * ((index + 1) / (regulationHistoryMarkers.length + 1))
            const color = marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red
            const needsLift = regulationHistoryMarkers.length >= 3 || slotWidth < 140
            return (
              <g key={marker.id}>
                <AngledMarker
                  color={color}
                  label={truncateLabel(`${marker.label.toLowerCase()} · ${marker.passed ? 'pass' : 'fail'}`, Math.max(34, Math.floor(slotWidth / 4.4)))}
                  needsLift={needsLift}
                  verticalLift={needsLift ? 34 + (index % 2) * 22 : 0}
                  diagonalRun={Math.max(42, Math.min(88, slotWidth * 0.34))}
                  x={x}
                  y={baselineY}
                  title={`${marker.label} · ${marker.passed ? 'pass' : 'fail'} · ${formatDateLabel(marker.attemptedAtIso)}`}
                  onClick={() =>
                    onOpenInspector({
                      id: `regulation-test:${marker.id}`,
                      x,
                      y: baselineY,
                      title: marker.label,
                      subtitle: marker.passed ? 'pass' : 'fail',
                      details: [`attempted: ${formatDateTimeLabel(marker.attemptedAtIso)}`, `test type: ${marker.testType}`, `marker id: ${marker.id}`]
                    })
                  }
                />
                {marker.isLatestCompleted ? <circle cx={x} cy={baselineY} r="11" fill="transparent" stroke={SP_COLORS.white} strokeWidth="1" strokeDasharray="3 3" /> : null}
              </g>
            )
          })
        : null}
    </>
  )
}
