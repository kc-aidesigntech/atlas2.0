import React, { useMemo } from 'react'
import LocalDateInputBox from './LocalDateInputBox'
import type { JourneyStationMarker, RouteLogEvent, RouteLogStatus, StabilizationPhase, TimelineConfig, ZDomain } from '../types'
import { SP_COLORS } from '../theme'

interface VerticalStripMapTimelineProps {
  events: RouteLogEvent[]
  timelineConfig: TimelineConfig
  stationMarkers?: JourneyStationMarker[]
  highlightedStationName?: string | null
  onStartDateChange?: (nextStartIso: string) => void
  onEventDateChange?: (logId: string, nextTimestampIso: string) => void
}

const STATUS_COLORS: Record<RouteLogStatus, string> = {
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

const DOMAIN_LABELS: Record<ZDomain, string> = {
  housing: 'housing',
  health: 'health',
  work: 'work',
  social: 'social',
  legal: 'legal',
  education: 'education'
}

function addMonths(date: Date, months: number) {
  const clone = new Date(date)
  clone.setMonth(clone.getMonth() + months)
  return clone
}

function formatDateLabel(timestampIso: string) {
  const date = new Date(timestampIso)
  if (!Number.isFinite(date.getTime())) return 'date pending'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatPhaseRange(startIso: string, startOffset: number, endOffset: number) {
  const start = addMonths(new Date(startIso), startOffset || 0)
  const end = addMonths(new Date(startIso), endOffset || 0)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return ''
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short' })
  return `${formatter.format(start)}-${formatter.format(end)}`
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

export default function VerticalStripMapTimeline({
  events,
  timelineConfig,
  stationMarkers = [],
  highlightedStationName = null,
  onStartDateChange,
  onEventDateChange
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
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.timestampIso).getTime() - new Date(b.timestampIso).getTime()),
    [events]
  )
  const suggestedMarkers = useMemo(() => stationMarkers.filter((marker) => marker.markerType === 'suggested'), [stationMarkers])

  function handleStartDateClick() {
    if (!onStartDateChange) return
    setDateEditor({
      kind: 'start',
      value: formatDateInputValue(timelineConfig.planStartIso),
      label: 'timeline start date',
      currentIso: timelineConfig.planStartIso
    })
    setDateEditorError(null)
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
          {timelineConfig.durationMonths}-month plan
        </small>
      </div>

      <button
        type="button"
        onClick={handleStartDateClick}
        className="mt-3 inline-flex rounded-full border px-3 py-1 text-[11px]"
        style={{ borderColor: `${SP_COLORS.yellow}80`, color: SP_COLORS.yellow }}
      >
        start: {formatDateLabel(timelineConfig.planStartIso)}
      </button>

      {dateEditor?.kind === 'start' ? (
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
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {timelineConfig.gates.slice(0, -1).map((gate, index) => {
          const nextGate = timelineConfig.gates[index + 1]
          if (!nextGate) return null
          return (
            <div
              key={gate.id}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
              style={{ borderColor: '#ffffff35', color: SP_COLORS.white }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PHASE_COLORS[gate.phase] }} />
              <span>{gate.label}</span>
              <span style={{ color: SP_COLORS.muted }}>
                {formatPhaseRange(timelineConfig.planStartIso, gate.monthOffset, nextGate.monthOffset)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="relative mt-5 pl-8">
        <div className="absolute bottom-3 left-[11px] top-2 w-[3px] rounded-full bg-white/20" />
        {sortedEvents.map((event, index) => {
          const statusColor = STATUS_COLORS[event.status]
          const phaseColor = PHASE_COLORS[event.phase]
          return (
            <div key={event.id} className="relative pb-5 last:pb-0">
              <div className="absolute left-[-4px] top-1 flex h-8 w-8 items-center justify-center rounded-full border bg-black" style={{ borderColor: SP_COLORS.white }}>
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: statusColor }} />
              </div>

              <div className="rounded-[24px] border px-4 py-3" style={{ borderColor: '#ffffff3a', backgroundColor: '#050505' }}>
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

      {suggestedMarkers.length > 0 ? (
        <div className="mt-4 rounded-[22px] border px-4 py-3" style={{ borderColor: `${SP_COLORS.yellow}70`, backgroundColor: '#080808' }}>
          <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.yellow }}>
            ranked station suggestions
          </small>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestedMarkers.map((marker, index) => (
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
    </div>
  )
}
