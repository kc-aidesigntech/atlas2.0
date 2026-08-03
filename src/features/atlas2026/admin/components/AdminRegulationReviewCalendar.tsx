import React from 'react'
import {
  AtlasInsetCard,
  AtlasMetaText,
  AtlasStatusPill,
  AtlasTextButton
} from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { RegulationReviewDueItem } from '@/features/atlas2026/shared/contracts'

type CalendarCadenceFilter = 'weekly' | 'all'

type CalendarEventKind = 'due' | 'completed'

type CalendarEvent = {
  id: string
  dayKey: string
  kind: CalendarEventKind
  item: RegulationReviewDueItem
  isOverdue: boolean
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toLocalDayKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayKeyFromIso(iso: string | null | undefined) {
  if (!iso) return null
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  return toLocalDayKey(date)
}

function formatMonthTitle(monthAnchor: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(monthAnchor)
}

function formatInstrumentLabel(instrument: 'mh_sca' | 'svs') {
  return instrument === 'mh_sca' ? 'MH-SCA' : 'SVS'
}

function buildMonthCells(monthAnchor: Date) {
  const firstOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1)
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return {
      date,
      dayKey: toLocalDayKey(date),
      inMonth: date.getMonth() === monthAnchor.getMonth(),
      dayNumber: date.getDate()
    }
  })
}

/**
 * Place each active regulation review on its next due day, and surface the latest
 * completed cycle day when it falls in the visible month so admins can scan both
 * upcoming Mental Health Self-Care Agency (MH-SCA) / Stress Vulnerability Scale (SVS)
 * obligations and recent cycle clears.
 */
function buildCalendarEvents(
  items: RegulationReviewDueItem[],
  cadenceFilter: CalendarCadenceFilter,
  nowMs: number
): CalendarEvent[] {
  const todayKey = toLocalDayKey(new Date(nowMs))
  const events: CalendarEvent[] = []

  for (const item of items) {
    if (cadenceFilter === 'weekly' && item.cadence !== 'weekly') continue

    const dueDayKey = dayKeyFromIso(item.dueAtIso)
    if (dueDayKey) {
      events.push({
        id: `${item.id}:due`,
        dayKey: dueDayKey,
        kind: 'due',
        item,
        // Open reviews whose due day is before today remain visible as overdue debt.
        isOverdue: item.status === 'open' && dueDayKey < todayKey
      })
    }

    const completedDayKey = dayKeyFromIso(item.lastCompletedAtIso)
    if (completedDayKey && completedDayKey !== dueDayKey) {
      events.push({
        id: `${item.id}:completed`,
        dayKey: completedDayKey,
        kind: 'completed',
        item,
        isOverdue: false
      })
    }
  }

  return events.sort((left, right) => {
    if (left.dayKey !== right.dayKey) return left.dayKey.localeCompare(right.dayKey)
    if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1
    if (left.kind !== right.kind) return left.kind === 'due' ? -1 : 1
    return left.item.enrolleeName.localeCompare(right.item.enrolleeName)
  })
}

function eventAccent(event: CalendarEvent) {
  if (event.isOverdue) return SP_COLORS.red
  if (event.kind === 'completed' || event.item.status === 'completed') return SP_COLORS.deepGreen
  return SP_COLORS.yellow
}

function eventStatusLabel(event: CalendarEvent) {
  if (event.isOverdue) return 'overdue'
  if (event.kind === 'completed') return 'completed'
  return event.item.status === 'completed' ? 'on track' : 'due'
}

export default function AdminRegulationReviewCalendar({
  regulationReviewDueItems,
  formatDateLabel
}: {
  regulationReviewDueItems: RegulationReviewDueItem[]
  formatDateLabel: (timestampIso: string) => string
}) {
  const nowMs = Date.now()
  const todayKey = toLocalDayKey(new Date(nowMs))
  const [monthAnchor, setMonthAnchor] = React.useState(() => startOfLocalDay(new Date(nowMs)))
  const [cadenceFilter, setCadenceFilter] = React.useState<CalendarCadenceFilter>('weekly')
  const [selectedDayKey, setSelectedDayKey] = React.useState<string | null>(todayKey)

  const events = React.useMemo(
    () => buildCalendarEvents(regulationReviewDueItems, cadenceFilter, nowMs),
    [cadenceFilter, nowMs, regulationReviewDueItems]
  )

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const bucket = map.get(event.dayKey) || []
      bucket.push(event)
      map.set(event.dayKey, bucket)
    }
    return map
  }, [events])

  const monthCells = React.useMemo(() => buildMonthCells(monthAnchor), [monthAnchor])
  const selectedEvents = selectedDayKey ? eventsByDay.get(selectedDayKey) || [] : []

  const visibleMonthKeys = new Set(monthCells.filter((cell) => cell.inMonth).map((cell) => cell.dayKey))
  const monthDueCount = events.filter(
    (event) => event.kind === 'due' && visibleMonthKeys.has(event.dayKey)
  ).length
  const monthOverdueCount = events.filter(
    (event) => event.isOverdue && visibleMonthKeys.has(event.dayKey)
  ).length

  function shiftMonth(delta: number) {
    setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function goToToday() {
    const today = startOfLocalDay(new Date())
    setMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDayKey(toLocalDayKey(today))
  }

  return (
    <AtlasInsetCard className="rounded-[22px] px-5 py-5 xl:col-span-2">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[22px] font-medium text-white">Weekly regulation review calendar</div>
          <AtlasMetaText className="mt-1 block max-w-[64ch] text-[13px]">
            Month view of active Mental Health Self-Care Agency (MH-SCA) and Stress Vulnerability Scale (SVS)
            regulation reviews. Each enrollee appears on their next due day; completed cycles also mark the day
            both instruments last cleared.
          </AtlasMetaText>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={cadenceFilter}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              setCadenceFilter(event.target.value as CalendarCadenceFilter)
            }
            className="atlas-admin-input"
            aria-label="Cadence filter"
          >
            <option value="weekly">weekly only</option>
            <option value="all">all cadences</option>
          </select>
          <AtlasTextButton
            onClick={goToToday}
            className="px-3 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: SP_COLORS.blue, color: SP_COLORS.blue } as React.CSSProperties}
          >
            today
          </AtlasTextButton>
          <AtlasTextButton
            onClick={() => shiftMonth(-1)}
            className="px-3 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: 'rgba(255,255,255,0.35)', color: '#fff' } as React.CSSProperties}
          >
            prev
          </AtlasTextButton>
          <AtlasTextButton
            onClick={() => shiftMonth(1)}
            className="px-3 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: 'rgba(255,255,255,0.35)', color: '#fff' } as React.CSSProperties}
          >
            next
          </AtlasTextButton>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-[18px] font-medium text-white">{formatMonthTitle(monthAnchor)}</div>
        <AtlasStatusPill color={SP_COLORS.yellow}>{monthDueCount} due this month</AtlasStatusPill>
        <AtlasStatusPill color={SP_COLORS.red}>{monthOverdueCount} overdue</AtlasStatusPill>
        <AtlasStatusPill color={SP_COLORS.deepGreen}>
          {regulationReviewDueItems.filter((item) => item.status === 'completed').length} cycle clear
        </AtlasStatusPill>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <div>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-1 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-secondary)]"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((cell) => {
              const dayEvents = eventsByDay.get(cell.dayKey) || []
              const isSelected = selectedDayKey === cell.dayKey
              const isToday = cell.dayKey === todayKey
              const previewEvents = dayEvents.slice(0, 3)
              const overflowCount = Math.max(0, dayEvents.length - previewEvents.length)

              return (
                <button
                  key={cell.dayKey}
                  type="button"
                  onClick={() => setSelectedDayKey(cell.dayKey)}
                  className="min-h-[104px] rounded-[14px] border px-1.5 py-1.5 text-left transition hover:bg-white/10"
                  style={{
                    borderColor: isSelected
                      ? SP_COLORS.yellow
                      : isToday
                        ? `${SP_COLORS.blue}90`
                        : 'rgba(255,255,255,0.1)',
                    background: isSelected ? 'rgba(252,192,26,0.08)' : 'rgba(255,255,255,0.03)',
                    opacity: cell.inMonth ? 1 : 0.45
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span
                      className="text-[12px] font-semibold"
                      style={{ color: isToday ? SP_COLORS.blue : '#fff' }}
                    >
                      {cell.dayNumber}
                    </span>
                    {dayEvents.some((event) => event.isOverdue) ? (
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: SP_COLORS.red }} />
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {previewEvents.map((event) => (
                      <div
                        key={event.id}
                        className="truncate rounded-[8px] px-1.5 py-0.5 text-[10px] font-medium leading-tight text-black"
                        style={{ background: eventAccent(event) }}
                        title={`${event.item.enrolleeName} · ${eventStatusLabel(event)}`}
                      >
                        {event.item.enrolleeName}
                      </div>
                    ))}
                    {overflowCount ? (
                      <div className="px-1 text-[10px] text-[var(--foreground-secondary)]">
                        +{overflowCount} more
                      </div>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <AtlasInsetCard className="rounded-[18px] px-4 py-4">
          <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
            day detail
          </small>
          <div className="mt-1 text-[18px] font-medium text-white">
            {selectedDayKey
              ? formatDateLabel(`${selectedDayKey}T12:00:00`)
              : 'Select a day'}
          </div>
          <div className="mt-3 space-y-2">
            {selectedEvents.map((event) => {
              const missingLabel = (event.item.missingInstruments || [])
                .map(formatInstrumentLabel)
                .join(' + ')
              return (
                <div
                  key={event.id}
                  className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-medium text-white">{event.item.enrolleeName}</div>
                      <AtlasMetaText className="mt-0.5 block text-[12px]">
                        {event.item.navigatorName || 'unassigned navigator'} · {event.item.cadence}
                      </AtlasMetaText>
                    </div>
                    <AtlasStatusPill color={eventAccent(event)}>{eventStatusLabel(event)}</AtlasStatusPill>
                  </div>
                  <AtlasMetaText className="mt-2 block text-[12px]">
                    {event.kind === 'completed'
                      ? `Cycle cleared ${formatDateLabel(event.item.lastCompletedAtIso || event.item.dueAtIso)}`
                      : `Next due ${formatDateLabel(event.item.dueAtIso)}`}
                    {missingLabel ? ` · missing ${missingLabel}` : ''}
                  </AtlasMetaText>
                </div>
              )
            })}
            {!selectedEvents.length ? (
              <AtlasMetaText className="block text-[13px]">
                No MH-SCA / SVS regulation reviews scheduled for this day.
              </AtlasMetaText>
            ) : null}
          </div>
        </AtlasInsetCard>
      </div>
    </AtlasInsetCard>
  )
}
