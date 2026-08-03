import React from 'react'
import type { StabilizationPhase } from '../../types'
import { formatDateTimeLabel } from '../timelineDateUtils'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { formatTimelinePhaseLabel, truncateLabel } from './geometry'
import type { TimelineMarkerInspectorState } from './types'

export interface PartnerStageDotLayout {
  id: string
  x: number
  y: number
  fill: string
  textColor: string
  phase: StabilizationPhase
  occurredAtIso: string
  anonymousLabel: string
  enrolleeId?: string
  enrolleeName?: string
  sourceKinds: Array<'referred' | 'active'>
  zCode: string
  parentCode: string
  zCodeDescription: string
  zCodeShortLabel: string
  laneGroup: string
}

interface PartnerMarkersProps {
  baselineY: number
  dots: PartnerStageDotLayout[]
  laneStep: number
  onOpenInspector: (inspector: TimelineMarkerInspectorState) => void
  onOpenRecord?: (enrolleeId: string) => void
}

export function PartnerMarkers({ baselineY, dots, laneStep, onOpenInspector, onOpenRecord }: PartnerMarkersProps) {
  return (
    <>
      {dots.map((dot) => {
        const labelText = truncateLabel(dot.zCodeShortLabel || dot.zCodeDescription, 38)
        const stackIndex = Math.max(0, Math.round((baselineY - dot.y - 14) / Math.max(laneStep, 1)))
        const stemOffsetX = stackIndex === 0 ? 0 : stackIndex * 6
        const diagonalRun = 62
        const lineLift = 42 + (stackIndex % 2) * 22
        const labelX = stemOffsetX + diagonalRun
        const labelY = -lineLift - diagonalRun
        const openInspector = () =>
          onOpenInspector({
            id: `partner-stage:${dot.id}`,
            x: dot.x,
            y: dot.y,
            title: `${dot.zCode} · ${formatTimelinePhaseLabel(dot.phase)}`,
            subtitle: `${dot.parentCode} parent cluster`,
            details: [
              `enrollee: ${dot.enrolleeName || dot.anonymousLabel}`,
              `phase stage: ${formatTimelinePhaseLabel(dot.phase)}`,
              `z-code: ${dot.zCode}`,
              `definition: ${dot.zCodeDescription}`,
              `source lineage: ${dot.sourceKinds.join(' + ')}`,
              `date: ${formatDateTimeLabel(dot.occurredAtIso)}`,
              `record id: ${dot.id}`
            ],
            openRecordLabel: 'open enrollee record',
            onOpenRecord: dot.enrolleeId && onOpenRecord ? () => onOpenRecord(dot.enrolleeId as string) : undefined
          })
        return (
          <g key={dot.id} transform={`translate(${dot.x}, ${dot.y})`} style={{ cursor: 'pointer' }} onClick={openInspector}>
            <title>{`${dot.zCode} · ${formatTimelinePhaseLabel(dot.phase)} · ${dot.enrolleeName || dot.anonymousLabel}`}</title>
            <circle r="28" fill="transparent" style={{ cursor: 'pointer' }} />
            <line x1={stemOffsetX} y1="-17" x2={stemOffsetX} y2={-lineLift} stroke={dot.fill} strokeWidth="2.2" pointerEvents="none" />
            <line x1={stemOffsetX} y1={-lineLift} x2={labelX} y2={labelY} stroke={dot.fill} strokeWidth="2.2" pointerEvents="none" />
            <circle r="17" fill={dot.fill} stroke={dot.fill} strokeWidth="2" pointerEvents="none" />
            <text y="5" textAnchor="middle" fill={dot.textColor} fontFamily="Helvetica, Arial, sans-serif" fontSize="11" fontWeight={700} pointerEvents="none">
              {dot.zCode.replace(/^Z/i, '')}
            </text>
            <text
              x={labelX + 4}
              y={labelY - 2}
              transform={`rotate(-45 ${labelX + 4} ${labelY - 2})`}
              textAnchor="start"
              fill={SP_COLORS.white}
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize="15"
              pointerEvents="none"
            >
              {labelText}
            </text>
          </g>
        )
      })}
    </>
  )
}
