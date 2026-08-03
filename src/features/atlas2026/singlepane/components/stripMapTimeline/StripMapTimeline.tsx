/**
 * Horizontal strip-map timeline orchestrator. Rendering is decomposed into
 * lanes, marker layers, chrome, and pure geometry in this feature folder.
 */
import React, { useEffect, useRef, useState } from 'react'
import type { RouteLogEvent } from '../../types'
import { formatDateInputValue, formatDateTimeLabel, mergeDateInputWithTime } from '../timelineDateUtils'
import { TimelineChrome } from './TimelineChrome'
import { TimelineLanes } from './TimelineLanes'
import { JourneyMarkers } from './JourneyMarkers'
import { PartnerMarkers } from './PartnerMarkers'
import { useTimelineLayout } from './useTimelineLayout'
import type {
  DateEditorState,
  ResolvedTooltipState,
  StripMapTimelineProps,
  TimelineMarkerInspectorState
} from './types'

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
  onOpenPartnerAggregateRecord,
  showRoutePlanningQuickAction = false,
  onRoutePlanningClick,
  onRegulationTestsClick,
  onRenewalTestsClick,
  onEventDelete,
  onEventPositionChange,
  onEventDateChange,
  onStartDateChange,
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
  const [markerInspector, setMarkerInspector] = useState<TimelineMarkerInspectorState | null>(null)
  const [isPartnerPolicyOpen, setIsPartnerPolicyOpen] = useState(false)

  const height = 540
  const baselineY = 292
  const marginX = 90
  const laneStep = 82
  const partnerLaneStep = 34
  const editorWidth = 220
  const editorHeight = 148

  useEffect(() => {
    const node = wrapperRef.current
    if (!node) return
    // ResizeObserver keeps scalable vector graphics (SVG) coordinates aligned with responsive width.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(Math.max(640, entry.contentRect.width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const layout = useTimelineLayout({
    baselineY,
    collisionThreshold: 32,
    dragState,
    events,
    isPartnerAggregateView,
    marginX,
    onRegulationTestsClick,
    onRenewalTestsClick,
    onRoutePlanningClick,
    partnerActiveDots: partnerAggregateActiveDots,
    partnerCollisionThreshold: 26,
    partnerLaneStep,
    partnerReferredDots: partnerAggregateReferredDots,
    regulationTestMarkers,
    resolvedZCodeMarkers,
    showReadinessProgress,
    showRoutePlanningQuickAction,
    timelineConfig,
    width
  })
  const isPartnerAggregateMode =
    isPartnerAggregateView && (partnerAggregateReferredDots.length > 0 || partnerAggregateActiveDots.length > 0)
  const visibleSuggestedMarkers = showReadinessProgress
    ? stationMarkers.filter((marker) => marker.markerType === 'suggested')
    : []
  const deepestResolvedBottom = layout.resolvedMarkerGroups.length
    ? baselineY + (Math.max(...layout.resolvedMarkerGroups.map((group) => group.length)) - 1) * 40 + 18
    : baselineY
  const deepestPartnerBottom = layout.partnerStageDotLayouts.length
    ? Math.max(...layout.partnerStageDotLayouts.map((dot) => dot.y)) + 10
    : baselineY
  const incrementBottom = layout.incrementMarkers.length ? baselineY + 34 : baselineY
  const phaseButtonsTop = Math.max(deepestResolvedBottom, deepestPartnerBottom, incrementBottom) + 42
  const phaseLabelY = phaseButtonsTop + 28
  const focusedStationTop = phaseButtonsTop + 64
  const containerHeight = highlightedStationName
    ? Math.max(height, focusedStationTop + 72)
    : Math.max(height, phaseButtonsTop + 64)

  function getRatioFromClientX(clientX: number) {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds?.width) return 0
    const localX = ((clientX - bounds.left) / bounds.width) * width
    return Math.max(0, Math.min(1, (localX - marginX) / Math.max(width - marginX * 2, 1)))
  }

  function handlePointerDown(eventId: string, pointerEvent: React.PointerEvent<SVGCircleElement>) {
    pointerEvent.preventDefault()
    pointerEvent.stopPropagation()
    setDragState({ eventId, ratio: getRatioFromClientX(pointerEvent.clientX), hasMoved: false })
  }

  useEffect(() => {
    if (!dragState) return undefined
    // Window-level listeners preserve dragging when the pointer leaves the marker or SVG.
    function handlePointerMove(event: PointerEvent) {
      const ratio = getRatioFromClientX(event.clientX)
      setDragState((current) =>
        current ? { ...current, ratio, hasMoved: current.hasMoved || Math.abs(ratio - current.ratio) > 0.003 } : current
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
      if (!target?.closest('[data-resolved-zcode-marker="true"]')) setResolvedTooltip(null)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [resolvedTooltip?.pinned])

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

  function openEventInspector(eventRecord: RouteLogEvent, x: number, y: number, index: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    // Every plotted marker exposes its backing record so unlabeled circles remain auditable.
    setMarkerInspector({
      id: `event:${eventRecord.id}`,
      x,
      y,
      title: eventRecord.label,
      subtitle: `milestone ${index + 1} · ${eventRecord.phase} · ${eventRecord.status}`,
      details: [
        `timestamp: ${formatDateTimeLabel(eventRecord.timestampIso)}`,
        `domains relieved: ${eventRecord.domainsRelieved.length ? eventRecord.domainsRelieved.join(', ') : 'none'}`,
        `record id: ${eventRecord.id}`
      ],
      eventRecord
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

  return (
    <div ref={wrapperRef} className="relative w-full overflow-visible" style={{ height: containerHeight }}>
      <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <TimelineLanes
          baselinePoints={layout.baselinePoints}
          baselineY={baselineY}
          dragEventId={dragState?.eventId}
          incrementMarkers={layout.incrementMarkers}
          isPartnerAggregateMode={isPartnerAggregateMode}
          isPartnerAggregateView={isPartnerAggregateView}
          isStartDateEditable={Boolean(onStartDateChange)}
          laneStep={laneStep}
          marginX={marginX}
          normalizedTimelineConfig={layout.normalizedTimelineConfig}
          onEditStart={() => (onTimelineConfigChange || onStartDateChange) && setIsControlOverlayOpen(true)}
          onEventDateChange={onEventDateChange}
          onOpenPartnerHistory={onPartnerHistoryClick}
          onPointerDown={handlePointerDown}
          onOpenEvent={openEventInspector}
          onEditEventDate={openEventDateEditor}
          onRegulationTestsClick={onRegulationTestsClick}
          onRenewalTestsClick={onRenewalTestsClick}
          onRoutePlanningClick={onRoutePlanningClick}
          phaseLabelY={phaseLabelY}
          phaseSegments={layout.phaseSegments}
          phaseSeparatorPositions={layout.phaseSeparatorPositions}
          positionedEvents={layout.positionedEvents}
          showReadinessProgress={showReadinessProgress}
          showRoutePlanningQuickAction={showRoutePlanningQuickAction}
          timeScale={layout.timeScale}
          width={width}
        />
        {isPartnerAggregateMode ? (
          <PartnerMarkers
            baselineY={baselineY}
            dots={layout.partnerStageDotLayouts}
            laneStep={partnerLaneStep}
            onOpenInspector={setMarkerInspector}
            onOpenRecord={onOpenPartnerAggregateRecord}
          />
        ) : (
          <JourneyMarkers
            baselineY={baselineY}
            completedParentCodes={completedParentCodes}
            highlightedStationName={highlightedStationName}
            readinessSegment={layout.readinessSegment}
            regulationHistoryMarkers={layout.regulationHistoryMarkers}
            regulationSegment={layout.regulationSegment}
            resolvedMarkerLayouts={layout.resolvedMarkerLayouts}
            setResolvedTooltip={setResolvedTooltip}
            suggestedMarkers={visibleSuggestedMarkers}
            onOpenInspector={setMarkerInspector}
          />
        )}
      </svg>
      <TimelineChrome
        dateEditor={dateEditor}
        dateEditorError={dateEditorError}
        editorPosition={{
          left: Math.max(8, Math.min(width - editorWidth - 8, (dateEditor?.anchorX || 0) + 20)),
          top: Math.max(8, Math.min(height - editorHeight - 8, (dateEditor?.anchorY || 0) - editorHeight - 14))
        }}
        focusedStationTop={focusedStationTop}
        highlightedStationName={highlightedStationName}
        isControlOverlayOpen={isControlOverlayOpen}
        isPartnerAggregateMode={isPartnerAggregateMode}
        isPartnerPolicyOpen={isPartnerPolicyOpen}
        isRegulationCleared={isRegulationCleared}
        markerInspector={markerInspector}
        normalizedTimelineConfig={layout.normalizedTimelineConfig}
        onCloseControlOverlay={() => setIsControlOverlayOpen(false)}
        onCommitDateEditor={commitDateEditor}
        onDeleteEvent={onEventDelete}
        onEditEventDate={openEventDateEditor}
        onEventDateChange={onEventDateChange}
        onSaveTimelineConfig={(nextConfig) => {
          onTimelineConfigChange?.(nextConfig)
          if (!onTimelineConfigChange && onStartDateChange && nextConfig.planStartIso !== layout.normalizedTimelineConfig.planStartIso) {
            onStartDateChange(nextConfig.planStartIso)
          }
          setIsControlOverlayOpen(false)
        }}
        onSetDateEditor={setDateEditor}
        onSetDateEditorError={setDateEditorError}
        onSetMarkerInspector={setMarkerInspector}
        onTogglePartnerPolicy={() => setIsPartnerPolicyOpen((current) => !current)}
        phaseActionButtons={layout.phaseActionButtons}
        phaseButtonsTop={phaseButtonsTop}
        readinessCenterX={layout.readinessSegment ? (layout.readinessSegment.xStart + layout.readinessSegment.xEnd) / 2 : width / 2}
        resolvedTooltip={resolvedTooltip}
        showReadinessProgress={showReadinessProgress}
        width={width}
      />
    </div>
  )
}
