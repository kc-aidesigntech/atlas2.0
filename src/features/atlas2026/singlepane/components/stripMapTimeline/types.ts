import type React from 'react'
import type {
  JourneyStationMarker,
  PartnerStripAggregateDot,
  RegulationTestStripMarker,
  ResolvedZCodeStripMarker,
  RouteLogEvent,
  StabilizationPhase,
  TimelineConfig
} from '../../types'

export interface StripMapTimelineProps {
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
  onOpenPartnerAggregateRecord?: (enrolleeId: string) => void
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

export interface PositionedEvent {
  event: RouteLogEvent
  index: number
  x: number
  lane: number
}

export interface DateEditorState {
  kind: 'start' | 'event'
  anchorX: number
  anchorY: number
  label: string
  value: string
  logId?: string
  currentIso: string
}

export interface ResolvedTooltipState {
  markerId: string
  x: number
  y: number
  title: string
  description: string
  resolvedAtLabel: string
  partnerName: string | null
  pinned: boolean
}

export interface TimelineMarkerInspectorState {
  id: string
  x: number
  y: number
  title: string
  subtitle: string
  details: string[]
  eventRecord?: RouteLogEvent
  openRecordLabel?: string
  onOpenRecord?: () => void
}

export interface PhaseActionButton {
  key: StabilizationPhase
  label: string
  onClick: () => void
  centerX: number
  color: string
  textColor: string
  showArrowIcon?: boolean
  disabled?: boolean
}

export interface TimelinePointerHandlers {
  onPointerDown: (eventId: string, pointerEvent: React.PointerEvent<SVGCircleElement>) => void
  onOpenEvent: (eventRecord: RouteLogEvent, x: number, y: number, index: number) => void
  onEditEventDate: (eventRecord: RouteLogEvent, x: number, y: number) => void
}
