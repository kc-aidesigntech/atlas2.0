/**
 * Aggregated Pray Phone call report. Sessions are the conferencer rows.
 * A row is tied to a kiosk when that kiosk's hook-to-hook log names the call.
 */
import {
  AtlasBodyText,
  AtlasInsetCard,
  AtlasMetaText,
  AtlasMetricPill,
  AtlasPanel,
  AtlasStatusPill
} from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  formatDuration,
  formatWhen,
  isClosedSession,
  sessionDurationMs,
  type FleetDayCount,
  type FleetSession
} from '@/features/atlas2026/fleet/fleetPresence'

function stateColor(state: string): string {
  if (state === 'ended') return SP_COLORS.green
  if (state === 'failed' || state === 'rejected') return SP_COLORS.red
  if (state === 'joined' || state === 'ringing') return SP_COLORS.yellow
  return SP_COLORS.steel
}

export type FleetSessionRow = FleetSession & {
  deviceLabel: string
  keywordCount: number
}

export default function FleetSessionsPanel({
  rows,
  dayCounts,
  weekCount,
  openCount,
  averageLabel
}: {
  rows: FleetSessionRow[]
  dayCounts: FleetDayCount[]
  weekCount: number
  openCount: number
  averageLabel: string
}) {
  const peak = Math.max(1, ...dayCounts.map((day) => day.count))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <AtlasMetricPill label="calls, last 7 days" value={weekCount} />
        <AtlasMetricPill label="open right now" value={openCount} accentColor={openCount > 0 ? SP_COLORS.yellow : undefined} />
        <AtlasMetricPill label="average completed length" value={averageLabel} />
      </div>

      <AtlasPanel kicker="volume" title="Calls by day" description="Counts use the time the call was created, for the last 14 days.">
        <div className="grid grid-cols-7 gap-2">
          {dayCounts.map((day) => (
            <div key={day.dayKey} className="min-w-0">
              <div className="flex h-24 items-end">
                <div
                  className="w-full rounded-sm bg-white/80"
                  style={{ height: `${Math.max(4, Math.round((day.count / peak) * 96))}%` }}
                  title={`${day.label}: ${day.count}`}
                />
              </div>
              <AtlasMetaText className="mt-1 block truncate text-[#9eacb9]">{day.label}</AtlasMetaText>
              <div className="text-[13px] text-white">{day.count}</div>
            </div>
          ))}
        </div>
      </AtlasPanel>

      <AtlasPanel
        kicker="log"
        title="Session history"
        description="Keyword totals come from the post-call collection. Unassigned means no phone log named that call."
      >
        {rows.length === 0 ? (
          <AtlasBodyText>No call sessions are stored yet.</AtlasBodyText>
        ) : (
          <div className="space-y-2">
            {rows.slice(0, 80).map((row) => (
              <AtlasInsetCard key={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] text-white">{row.deviceLabel}</div>
                    <AtlasMetaText className="mt-1 block text-[#9eacb9]">
                      {formatWhen(row.createdAtIso)}
                      {' · '}
                      {isClosedSession(row) ? formatDuration(sessionDurationMs(row)) : 'still open'}
                      {row.keywordCount > 0 ? ` · ${row.keywordCount} keyword${row.keywordCount === 1 ? '' : 's'}` : ''}
                      {row.endReason ? ` · ${row.endReason}` : ''}
                    </AtlasMetaText>
                  </div>
                  <AtlasStatusPill color={stateColor(row.state)}>{row.state || 'unknown'}</AtlasStatusPill>
                </div>
              </AtlasInsetCard>
            ))}
          </div>
        )}
      </AtlasPanel>
    </div>
  )
}
