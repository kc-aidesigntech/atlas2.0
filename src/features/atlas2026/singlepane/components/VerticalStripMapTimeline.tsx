import React, { useMemo } from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import LocalDateInputBox from './LocalDateInputBox'
import StripMapControlOverlay from './StripMapControlOverlay'
import type {
  JourneyStationMarker,
  RegulationTestStripMarker,
  ResolvedZCodeStripMarker,
  RouteLogEvent,
  RouteLogStatus,
  StabilizationPhase,
  TimelineConfig,
  ZDomain
} from '../types'
import { buildTimelinePhaseSegments, normalizeTimelineConfig } from '../timelineConfigUtils'
import { SP_COLORS } from '../theme'
import {
  addMonths,
  formatDateInputValue,
  formatDateLabel,
  formatDateTimeLabel,
  formatPhaseRange,
  mergeDateInputWithTime
} from './timelineDateUtils'
import { TIMELINE_PHASE_COLORS, TIMELINE_STATUS_COLORS } from './timelineVisualConfig'

interface VerticalStripMapTimelineProps {
  events: RouteLogEvent[]
  timelineConfig: TimelineConfig
  completedParentCodes?: string[]
  resolvedZCodeMarkers?: ResolvedZCodeStripMarker[]
  stationMarkers?: JourneyStationMarker[]
  highlightedStationName?: string | null
  regulationTestMarkers?: RegulationTestStripMarker[]
  isRegulationCleared?: boolean
  showReadinessProgress?: boolean
  showRoutePlanningQuickAction?: boolean
  onRoutePlanningClick?: () => void
  onRegulationTestsClick?: () => void
  onRenewalTestsClick?: () => void
  onEventDelete?: (logId: string) => void
  onStartDateChange?: (nextStartIso: string) => void
  onEventDateChange?: (logId: string, nextTimestampIso: string) => void
  onExtendPhaseDuration?: (phase: StabilizationPhase) => void
  onTimelineConfigChange?: (nextConfig: TimelineConfig) => void
}

const DOMAIN_LABELS: Record<ZDomain, string> = {
  housing: 'housing',
  health: 'health',
  work: 'work',
  social: 'social',
  legal: 'legal',
  education: 'education'
}


export default function VerticalStripMapTimeline({
  events,
  timelineConfig,
  completedParentCodes = [],
  resolvedZCodeMarkers = [],
  stationMarkers = [],
  highlightedStationName = null,
  regulationTestMarkers = [],
  isRegulationCleared = false,
  showReadinessProgress = true,
  showRoutePlanningQuickAction = false,
  onRoutePlanningClick,
  onRegulationTestsClick,
  onRenewalTestsClick,
  onEventDelete,
  onStartDateChange,
  onEventDateChange,
  onExtendPhaseDuration,
  onTimelineConfigChange
}: VerticalStripMapTimelineProps) {
  const [dateEditor, setDateEditor] = React.useState<
    | {
        kind: 'start' | 'event'
        value: string
        label: string
        logId?: string
        currentIso: string
      }
    | null
  >(null)
  const [dateEditorError, setDateEditorError] = React.useState<string | null>(null)
  const [isControlOverlayOpen, setIsControlOverlayOpen] = React.useState(false)
  const [activeResolvedMarkerId, setActiveResolvedMarkerId] = React.useState<string | null>(null)
  const sortedEvents = useMemo(
    // Timeline visuals rely on strict chronological rendering, regardless of upstream order.
    () => [...events].sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()),
    [events]
  )
  const suggestedMarkers = useMemo(() => stationMarkers.filter((marker) => marker.markerType === 'suggested'), [stationMarkers])
  const visibleSuggestedMarkers = showReadinessProgress ? suggestedMarkers : []
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
  const normalizedTimelineConfig = useMemo(() => normalizeTimelineConfig(timelineConfig), [timelineConfig])
  const phaseSegments = useMemo(() => {
    return buildTimelinePhaseSegments(normalizedTimelineConfig)
  }, [normalizedTimelineConfig])

  function handleStartDateClick() {
    if (!onTimelineConfigChange && !onStartDateChange) return
    setIsControlOverlayOpen(true)
  }

  function handleEventDateClick(event: RouteLogEvent) {
    if (!onEventDateChange) return
    setDateEditor({
      kind: 'event',
      value: formatDateInputValue(event.timestampIso),
      label: event.label,
      logId: event.id,
      currentIso: event.timestampIso
    })
    setDateEditorError(null)
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
    <div className="w-full rounded-[28px] border px-4 py-4" style={{ borderColor: '#ffffff40' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <small className="block text-[13px] text-white">route timeline</small>
          <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
            earliest milestone first
          </small>
        </div>
        <small className="text-[11px]" style={{ color: SP_COLORS.muted }}>
          {normalizedTimelineConfig.durationMonths * 30}-day plan
        </small>
      </div>

      <AtlasTextButton
        onClick={handleStartDateClick}
        className="mt-3 inline-flex px-3 py-1 text-[11px]"
        style={{ ['--button-border-color' as const]: `${SP_COLORS.yellow}80`, color: SP_COLORS.yellow } as React.CSSProperties}
      >
        start: {formatDateLabel(normalizedTimelineConfig.planStartIso)}
      </AtlasTextButton>
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

      <div className="mt-4 flex flex-wrap gap-2">
        {phaseSegments.map((segment) => {
          const isRegulationAction = segment.phase === 'regulation' && Boolean(onRegulationTestsClick)
          const isReadinessAction = segment.phase === 'readiness' && Boolean(onRoutePlanningClick) && showRoutePlanningQuickAction
          const isRenewalButton = segment.phase === 'renewal' && Boolean(onRenewalTestsClick)
          return (
            <div
              key={segment.phase}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
              style={{
                borderColor: '#ffffff35',
                color: SP_COLORS.white,
                opacity: !showReadinessProgress && segment.phase !== 'regulation' ? 0.42 : 1
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIMELINE_PHASE_COLORS[segment.phase] }} />
              {isRegulationAction ? (
                <>
                  <AtlasTextButton
                    onClick={onRegulationTestsClick}
                    className="px-[14px] py-[6px] text-[13px] font-medium"
                    style={{
                      ['--button-border-color' as const]: TIMELINE_PHASE_COLORS.regulation,
                      ['--button-line-color' as const]: SP_COLORS.white,
                      color: SP_COLORS.white,
                      backgroundColor: TIMELINE_PHASE_COLORS.regulation
                    } as React.CSSProperties}
                  >
                    regulation
                  </AtlasTextButton>
                  {isRegulationCleared ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px]" style={{ borderColor: SP_COLORS.white, color: SP_COLORS.white }}>
                      ✓
                    </span>
                  ) : null}
                </>
              ) : isReadinessAction ? (
                <AtlasTextButton
                  onClick={onRoutePlanningClick}
                  className="inline-flex items-center gap-2 px-[14px] py-[6px] text-[13px] font-medium"
                  style={{
                    ['--button-border-color' as const]: TIMELINE_PHASE_COLORS.readiness,
                    ['--button-line-color' as const]: SP_COLORS.bg,
                    color: SP_COLORS.bg,
                    backgroundColor: TIMELINE_PHASE_COLORS.readiness
                  } as React.CSSProperties}
                >
                  <span>plan route</span>
                  <AtlasArrowIcon decorative direction="right" className="h-[0.9rem] w-[0.9rem] brightness-0" />
                </AtlasTextButton>
              ) : isRenewalButton ? (
                <AtlasTextButton
                  onClick={onRenewalTestsClick}
                  className="px-[14px] py-[6px] text-[13px] font-medium"
                  style={{
                    ['--button-border-color' as const]: TIMELINE_PHASE_COLORS.renewal,
                    ['--button-line-color' as const]: SP_COLORS.white,
                    color: SP_COLORS.white,
                    backgroundColor: TIMELINE_PHASE_COLORS.renewal
                  } as React.CSSProperties}
                >
                  renewal
                </AtlasTextButton>
              ) : (
                <span style={{ color: TIMELINE_PHASE_COLORS[segment.phase] }}>{segment.label}</span>
              )}
              <span style={{ color: SP_COLORS.muted }}>
                {formatPhaseRange(normalizedTimelineConfig.planStartIso, segment.startOffset, segment.endOffset)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="relative mt-5 pl-8">
        <div className="absolute bottom-3 left-[11px] top-2 w-[3px] rounded-full bg-white/20" />
        {regulationHistoryMarkers.length ? (
          <div className="mb-5 rounded-[22px] border px-4 py-3" style={{ borderColor: `${SP_COLORS.red}70`, backgroundColor: 'var(--surface-panel-soft)' }}>
            <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.red }}>
              regulation test history
            </small>
            <div className="mt-2 flex flex-wrap gap-2">
              {regulationHistoryMarkers.map((marker) => (
                <span
                  key={marker.id}
                  className="inline-flex rounded-full border px-2.5 py-1 text-[11px]"
                  style={{
                    borderColor: marker.passed ? `${SP_COLORS.deepGreen}90` : `${SP_COLORS.red}90`,
                    color: marker.passed ? SP_COLORS.deepGreen : SP_COLORS.red
                  }}
                >
                  {marker.label.toLowerCase()} · {marker.passed ? 'pass' : 'fail'} · {formatDateLabel(marker.attemptedAtIso)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {sortedEvents.map((event, index) => {
          const statusColor = TIMELINE_STATUS_COLORS[event.status]
          const phaseColor = TIMELINE_PHASE_COLORS[event.phase]
          return (
            <div key={event.id} className="relative pb-5 last:pb-0">
              <div className="absolute left-[-4px] top-1 flex h-8 w-8 items-center justify-center rounded-full border bg-[var(--surface-panel-raised)]" style={{ borderColor: SP_COLORS.white }}>
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: statusColor }} />
              </div>

              <div className="rounded-[24px] border px-4 py-3" style={{ borderColor: '#ffffff3a', backgroundColor: 'var(--surface-panel-raised)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
                      milestone {index + 1}
                    </small>
                    <div className="text-[15px] leading-tight text-white">{event.label}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEventDateClick(event)}
                    className="shrink-0 text-[11px]"
                    style={{ color: SP_COLORS.muted }}
                  >
                    {formatDateLabel(event.timestampIso)}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className="inline-flex rounded-full border px-2.5 py-1 text-[11px] text-white"
                    style={{ borderColor: `${phaseColor}90`, color: phaseColor }}
                  >
                    {event.phase}
                  </span>
                  <span
                    className="inline-flex rounded-full border px-2.5 py-1 text-[11px] capitalize text-white"
                    style={{ borderColor: `${statusColor}90`, color: statusColor }}
                  >
                    {event.status}
                  </span>
                </div>

                {dateEditor?.kind === 'event' && dateEditor.logId === event.id ? (
                  <div className="mt-3">
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
                        typeof dateEditor.logId === 'string' && onEventDelete
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

                {event.domainsRelieved.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.domainsRelieved.slice(0, 3).map((domain) => (
                      <span
                        key={`${event.id}-${domain}`}
                        className="inline-flex rounded-full border px-2.5 py-1 text-[11px] text-white"
                        style={{ borderColor: '#ffffff30' }}
                      >
                        {DOMAIN_LABELS[domain]}
                      </span>
                    ))}
                  </div>
                ) : null}

                {stationMarkers.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stationMarkers
                      .filter((marker) => marker.phase === event.phase && marker.assignedAtIso === event.timestampIso)
                      .map((marker) => (
                        <span
                          key={marker.id}
                          className="inline-flex rounded-full border px-2.5 py-1 text-[11px] text-white"
                          style={{
                            borderColor:
                              marker.stationName === highlightedStationName || marker.markerType === 'suggested'
                                ? `${SP_COLORS.yellow}aa`
                                : '#ffffff45',
                            color:
                              marker.stationName === highlightedStationName || marker.markerType === 'suggested'
                                ? SP_COLORS.yellow
                                : SP_COLORS.white
                          }}
                        >
                          {marker.markerType === 'suggested' ? 'suggested stop' : 'station'}: {marker.stationName}
                        </span>
                      ))}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {visibleSuggestedMarkers.length > 0 ? (
        <div className="mt-4 rounded-[22px] border px-4 py-3" style={{ borderColor: `${SP_COLORS.yellow}70`, backgroundColor: 'var(--surface-panel-soft)' }}>
          <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.yellow }}>
            ranked station suggestions
          </small>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleSuggestedMarkers.map((marker, index) => (
              <span
                key={marker.id}
                className="inline-flex rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: `${SP_COLORS.yellow}90`, color: SP_COLORS.yellow }}
              >
                {index + 1}. {marker.stationName}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {visibleResolvedZCodeMarkers.length ? (
        <div className="mt-4 rounded-[22px] border px-4 py-3" style={{ borderColor: `${SP_COLORS.deepGreen}70`, backgroundColor: 'var(--surface-panel-soft)' }}>
          <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.deepGreen }}>
            resolved z-codes
          </small>
          <div className="mt-2 grid gap-2">
            {visibleResolvedZCodeMarkers.map((marker) => {
              const isOpen = activeResolvedMarkerId === marker.id
              return (
                <button
                  key={marker.id}
                  type="button"
                  onClick={() => setActiveResolvedMarkerId((current) => (current === marker.id ? null : marker.id))}
                  className="rounded-[16px] border px-3 py-2 text-left"
                  style={{ borderColor: '#ffffff22', color: SP_COLORS.white, backgroundColor: 'rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-medium text-white">
                      {marker.zCode} · {marker.partnerName || 'resolved partner'}
                    </span>
                    <span className="text-[11px]" style={{ color: SP_COLORS.deepGreen }}>
                      resolved
                    </span>
                  </div>
                  {isOpen ? (
                    <div className="mt-2">
                      <small className="block text-[11px] leading-[1.45]" style={{ color: '#d7e0e9' }}>
                        {marker.description}
                      </small>
                      <small className="mt-1 block text-[11px] leading-[1.45]" style={{ color: '#c5ced8' }}>
                        {formatDateTimeLabel(marker.resolvedAtIso)}
                      </small>
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      {!showReadinessProgress ? (
        <div className="mt-4 rounded-[18px] border px-4 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}>
          readiness hidden pending regulation clearance
        </div>
      ) : null}
    </div>
  )
}
