import React from 'react'
import { AtlasInsetCard } from '@/features/atlas2026/components/AtlasPrimitives'
import { listSecondments, type SecondmentRecord } from '@/features/atlas2026/singlepane/data-access/tierFeatureRepository'
import {
  StatusWordPill,
  TierFeatureListNotice,
  TierFeatureNoAccess,
  TierFeaturePanel,
  dateLabel,
  timeLabel,
  useTierFeatureList
} from '@/features/atlas2026/singlepane/components/tierFeaturePanels/tierFeaturePanelShared'

interface SecondmentSchedulePanelProps {
  canViewSchedule: boolean
}

const DAY_LABELS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/**
 * Read-only weekly schedule for `secondment_schedule.view` holders. Each
 * `atlas.secondments` row Row-Level Security (RLS) returns is printed with
 * its `atlas.secondment_schedule` rows laid out Sunday through Saturday.
 */
export default function SecondmentSchedulePanel({ canViewSchedule }: SecondmentSchedulePanelProps) {
  const secondments = useTierFeatureList(listSecondments)

  if (!canViewSchedule) return <TierFeatureNoAccess permissionKey="secondment_schedule.view" title="secondment schedule" />

  return (
    <TierFeaturePanel
      kicker="secondment schedule"
      title="Weekly schedule"
      description="Where a Travel Peer is placed each week. Supervisors keep these rows; this screen reads them."
    >
      <div className="space-y-4">
        <TierFeatureListNotice state={secondments} emptyLabel="No secondments on record." tableLabel="The secondments table" />
        {secondments.rows.map((secondment) => (
          <SecondmentWeek key={secondment.id} secondment={secondment} />
        ))}
      </div>
    </TierFeaturePanel>
  )
}

function SecondmentWeek({ secondment }: { secondment: SecondmentRecord }) {
  const byDay = React.useMemo(() => {
    const grouped = new Map<number, SecondmentRecord['schedule']>()
    for (const row of secondment.schedule) {
      const current = grouped.get(row.dayOfWeek) || []
      current.push(row)
      grouped.set(row.dayOfWeek, current)
    }
    return grouped
  }, [secondment.schedule])

  return (
    <AtlasInsetCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-white">{secondment.hostOrganization}</div>
          <small className="block text-[12px] text-[var(--foreground-secondary)]">
            {secondment.personName} · {dateLabel(secondment.startsOn)} – {secondment.endsOn ? dateLabel(secondment.endsOn) : 'open'}
          </small>
        </div>
        <StatusWordPill status={secondment.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DAY_LABELS.map((label, dayOfWeek) => {
          const rows = byDay.get(dayOfWeek) || []
          return (
            <div key={label} className="rounded-[12px] border border-white/10 px-2 py-2">
              <small className="atlas-overline block text-[var(--foreground-secondary)]">{label}</small>
              {rows.length ? (
                rows.map((row) => (
                  <div key={row.id} className="mt-1 text-[12px] text-white">
                    <div>
                      {timeLabel(row.startsTime)} – {timeLabel(row.endsTime)}
                    </div>
                    {row.location ? <small className="block text-[11px] text-[var(--foreground-secondary)]">{row.location}</small> : null}
                  </div>
                ))
              ) : (
                <small className="mt-1 block text-[11px] text-[var(--foreground-secondary)]">—</small>
              )}
            </div>
          )
        })}
      </div>
    </AtlasInsetCard>
  )
}
