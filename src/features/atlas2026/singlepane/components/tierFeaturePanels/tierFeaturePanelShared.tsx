/**
 * Pieces shared by the tier feature screens (leads, respite shifts, secondment
 * schedule, partners, cohorts, sponsorships, competency cards). The panels
 * compose the canonical `AtlasPanel`, `AtlasStatusPill`, `AtlasTextButton`,
 * admin `Field`, and the `atlas-admin-input` control class; nothing here adds
 * a new motif.
 */
import React from 'react'
import { AtlasPanel, AtlasStatusPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  listPeopleDirectory,
  type PersonDirectoryEntry,
  type TierFeatureList,
  type TierFeatureSource
} from '@/features/atlas2026/singlepane/data-access/tierFeatureRepository'
import { formatDateLabel, formatDateTimeLabel } from '@/features/atlas2026/singlepane/components/timelineDateUtils'

export interface TierFeatureListState<T> {
  rows: T[]
  source: TierFeatureSource
  isLoading: boolean
  error: string | null
  reload: () => Promise<void>
}

/** Runs `loader` on mount and on `reload`; the list stays `unavailable` until the first read answers. */
export function useTierFeatureList<T>(loader: () => Promise<TierFeatureList<T>>, deps: React.DependencyList = []): TierFeatureListState<T> {
  const [rows, setRows] = React.useState<T[]>([])
  const [source, setSource] = React.useState<TierFeatureSource>('unavailable')
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const loaderRef = React.useRef(loader)
  loaderRef.current = loader

  const reload = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await loaderRef.current()
      setRows(result.rows)
      setSource(result.source)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load.')
    } finally {
      setIsLoading(false)
    }
  }, deps)

  React.useEffect(() => {
    void reload()
  }, [reload])

  return { rows, source, isLoading, error, reload }
}

/** Runs one write, then `onDone`; the error message is kept for the panel to print. */
export function useTierFeatureWrite(onDone: () => Promise<void> | void) {
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const run = React.useCallback(
    async (key: string, write: () => Promise<unknown>) => {
      setBusyKey(key)
      setError(null)
      try {
        await write()
        await onDone()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to save.')
      } finally {
        setBusyKey(null)
      }
    },
    [onDone]
  )
  return { busyKey, error, run, clearError: () => setError(null) }
}

/** Loads `v_people_directory` once for pickers. */
export function usePeopleDirectory(): TierFeatureListState<PersonDirectoryEntry> {
  return useTierFeatureList(listPeopleDirectory)
}

export function TierFeaturePanel({
  kicker,
  title,
  description,
  actions,
  children
}: {
  kicker: string
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <AtlasPanel kicker={kicker} title={title} description={description} actions={actions} className="w-full">
      {children}
    </AtlasPanel>
  )
}

/** Shown when the viewer lacks the screen's permission key. */
export function TierFeatureNoAccess({ permissionKey, title }: { permissionKey: string; title: string }) {
  return (
    <TierFeaturePanel kicker={title} title="Not available on this tier" description={`This screen needs the ${permissionKey} permission.`}>
      <small className="atlas-caption block text-[var(--foreground-secondary)]">
        Ask a supervisor or coordinator for an access exception if you need it.
      </small>
    </TierFeaturePanel>
  )
}

/** One line under a list: loading, the read error, the unavailable table, or the empty state. */
export function TierFeatureListNotice<T>({
  state,
  emptyLabel,
  tableLabel
}: {
  state: Pick<TierFeatureListState<T>, 'rows' | 'source' | 'isLoading' | 'error'>
  emptyLabel: string
  tableLabel: string
}) {
  if (state.isLoading) return <small className="atlas-caption block text-[var(--foreground-secondary)]">loading…</small>
  if (state.error) return <small className="atlas-caption block" style={{ color: SP_COLORS.red }}>{state.error}</small>
  if (state.source === 'unavailable') {
    return (
      <small className="atlas-caption block text-[var(--foreground-secondary)]">
        {tableLabel} is not readable from this account yet.
      </small>
    )
  }
  if (!state.rows.length) return <small className="atlas-caption block text-[var(--foreground-secondary)]">{emptyLabel}</small>
  return null
}

export function TierFeatureErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <small className="atlas-caption block" style={{ color: SP_COLORS.red }}>
      {message}
    </small>
  )
}

/** Pill color by status word: ended/cancelled/withdrawn/blocked/closed red, planned/new/scheduled yellow, else green. */
export function statusPillColor(status: string): string {
  const normalized = status.toLowerCase()
  if (['ended', 'cancelled', 'withdrawn', 'blocked', 'closed'].includes(normalized)) return SP_COLORS.red
  if (['planned', 'new', 'scheduled', 'contacted'].includes(normalized)) return SP_COLORS.yellow
  return SP_COLORS.deepGreen
}

export function StatusWordPill({ status }: { status: string }) {
  return <AtlasStatusPill color={statusPillColor(status)}>{status}</AtlasStatusPill>
}

export function TierFeatureActionButton({
  children,
  onClick,
  disabled,
  accent = SP_COLORS.white
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  accent?: string
}) {
  return (
    <AtlasTextButton
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-[6px] text-[13px] font-medium md:text-[13px]"
      style={{ ['--button-border-color' as const]: accent, color: accent } as React.CSSProperties}
    >
      {children}
    </AtlasTextButton>
  )
}

/** Native select over `v_people_directory`; `excludeIds` hides people already on the list. */
export function PersonSelect({
  people,
  value,
  onChange,
  disabled,
  placeholder = 'choose a person',
  excludeIds = []
}: {
  people: PersonDirectoryEntry[]
  value: string
  onChange: (personId: string) => void
  disabled?: boolean
  placeholder?: string
  excludeIds?: string[]
}) {
  const excluded = new Set(excludeIds)
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="atlas-admin-input">
      <option value="">{placeholder}</option>
      {people
        .filter((person) => !excluded.has(person.id) || person.id === value)
        .map((person) => (
          <option key={person.id} value={person.id}>
            {person.displayName}
          </option>
        ))}
    </select>
  )
}

export function dateLabel(value: string | null | undefined, fallback = '—'): string {
  return value ? formatDateLabel(value, fallback) : fallback
}

export function dateTimeLabel(value: string | null | undefined, fallback = '—'): string {
  return value ? formatDateTimeLabel(value, fallback) : fallback
}

/** `HH:MM[:SS]` from Postgres `time` printed as `h:mm am/pm`. */
export function timeLabel(value: string): string {
  const [hoursText, minutesText] = value.split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  const date = new Date(2000, 0, 1, hours, minutes)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

/** The `<input type="datetime-local">` value for now, rounded to the next hour. */
export function nextHourLocalInput(offsetHours = 0): string {
  const date = new Date()
  date.setMinutes(0, 0, 0)
  date.setHours(date.getHours() + 1 + offsetHours)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `datetime-local` value to an ISO string; empty input returns null. */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}
