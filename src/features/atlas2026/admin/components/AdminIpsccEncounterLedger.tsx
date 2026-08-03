/**
 * Admin ledger of Intentional Peer Support Core Competencies (IPSCC) encounter
 * submissions. Admins can see every enrollee response (navigators cannot).
 * Highlights opinion improvement over time via mean-score trend.
 */
import React from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AtlasInsetCard, AtlasMetricPill } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { IpsccEncounterSubmissionRecord } from '@/features/atlas2026/shared/contracts'

interface AdminIpsccEncounterLedgerProps {
  submissions: IpsccEncounterSubmissionRecord[]
  formatDateLabel: (value?: string | null) => string
}

function meanItemScore(itemScores: number[]) {
  if (!itemScores.length) return null
  return Number((itemScores.reduce((sum, value) => sum + value, 0) / itemScores.length).toFixed(2))
}

export default function AdminIpsccEncounterLedger({
  submissions,
  formatDateLabel
}: AdminIpsccEncounterLedgerProps) {
  const chronological = submissions
    .slice()
    .sort((left, right) => new Date(left.submittedAtIso).getTime() - new Date(right.submittedAtIso).getTime())

  // Group by enrollee so the pilot 10-submission series is obvious as one story.
  const byEnrollee = chronological.reduce<
    Array<{
      enrolleeId: string
      enrolleeName: string
      navigatorName: string
      rows: Array<IpsccEncounterSubmissionRecord & { meanScore: number | null }>
    }>
  >((groups, record) => {
    const meanScore = meanItemScore(record.itemScores)
    const existing = groups.find(
      (group) => group.enrolleeId === record.enrolleeId && group.navigatorName === record.navigatorName
    )
    if (existing) {
      existing.rows.push({ ...record, meanScore })
      return groups
    }
    groups.push({
      enrolleeId: record.enrolleeId,
      enrolleeName: record.enrolleeName,
      navigatorName: record.navigatorName,
      rows: [{ ...record, meanScore }]
    })
    return groups
  }, [])

  const featured =
    byEnrollee.find((group) => group.rows.length >= 10) ||
    byEnrollee.slice().sort((left, right) => right.rows.length - left.rows.length)[0] ||
    null

  const firstMean = featured?.rows[0]?.meanScore ?? null
  const latestMean = featured?.rows[featured.rows.length - 1]?.meanScore ?? null
  const lift =
    typeof firstMean === 'number' && typeof latestMean === 'number'
      ? Number((latestMean - firstMean).toFixed(2))
      : null
  const chartData =
    featured?.rows.map((row, index) => ({
      label: `E${index + 1}`,
      date: formatDateLabel(row.submittedAtIso),
      mean: row.meanScore ?? 0
    })) || []

  return (
    <AtlasInsetCard className="rounded-[22px] px-5 py-5 xl:col-span-2">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
            enrollee IPSCC ledger
          </small>
          <div className="text-[22px] font-medium text-white">Encounter submissions (admin only)</div>
          <small className="mt-1 block text-[13px] text-[var(--foreground-secondary)]">
            Full Intentional Peer Support Core Competencies (IPSCC) responses from enrollees. Navigators only
            see privacy-gated averages — never these individual rows.
          </small>
        </div>
        <AtlasMetricPill
          label="total submissions"
          value={chronological.length}
          accentColor={SP_COLORS.deepGreen}
          className="rounded-[16px]"
        />
      </div>

      {!featured ? (
        <small className="text-[13px] text-[var(--foreground-secondary)]">
          No enrollee IPSCC encounter submissions yet.
        </small>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[15px] font-medium text-white">{featured.enrolleeName}</div>
              <small className="block text-[12px] text-[var(--foreground-secondary)]">
                Navigator: {featured.navigatorName} · {featured.rows.length} encounters
              </small>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <AtlasMetricPill
                  label="first mean"
                  value={firstMean == null ? '—' : firstMean.toFixed(2)}
                  accentColor={SP_COLORS.yellow}
                  className="rounded-[14px]"
                />
                <AtlasMetricPill
                  label="latest mean"
                  value={latestMean == null ? '—' : latestMean.toFixed(2)}
                  accentColor={SP_COLORS.deepGreen}
                  className="rounded-[14px]"
                />
                <AtlasMetricPill
                  label="opinion lift"
                  value={lift == null ? '—' : (lift >= 0 ? `+${lift.toFixed(2)}` : lift.toFixed(2))}
                  accentColor={lift != null && lift > 0 ? SP_COLORS.deepGreen : SP_COLORS.red}
                  className="rounded-[14px]"
                />
              </div>
              {lift != null && lift > 0 ? (
                <div className="mt-3 rounded-[12px] border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-[#d7e0e9]">
                  Enrollee opinion of the navigator improved over these encounters (mean IPSCC score rose from{' '}
                  {firstMean?.toFixed(2)} to {latestMean?.toFixed(2)}).
                </div>
              ) : null}
            </div>

            <div className="h-[200px] rounded-[18px] border border-white/10 bg-white/5 px-2 py-3">
              <small className="mb-1 block px-2 text-[11px] uppercase tracking-[0.1em] text-[var(--foreground-secondary)]">
                mean score over encounters
              </small>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={`${SP_COLORS.text}22`} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: SP_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[1, 5]} tick={{ fill: SP_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: '#0a0a0a',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 12,
                      fontSize: 12
                    }}
                    labelFormatter={(_, payload) => {
                      const point = payload?.[0]?.payload as { date?: string } | undefined
                      return point?.date || ''
                    }}
                    formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : value, 'mean']}
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    stroke={SP_COLORS.deepGreen}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: SP_COLORS.deepGreen, stroke: SP_COLORS.white, strokeWidth: 1 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {featured.rows.map((row, index) => {
              const mean = row.meanScore
              const prior = index > 0 ? featured.rows[index - 1].meanScore : null
              const stepLift =
                typeof mean === 'number' && typeof prior === 'number' ? Number((mean - prior).toFixed(2)) : null
              return (
                <div key={row.id} className="rounded-[16px] border border-white/10 bg-white/5 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-medium text-white">
                        Encounter {index + 1} · {formatDateLabel(row.submittedAtIso)}
                      </div>
                      <small className="block text-[11px] text-[var(--foreground-secondary)]">
                        {row.note || 'No note'} · submitted by {row.submittedBy}
                      </small>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-medium text-white">{mean == null ? '—' : mean.toFixed(2)}</div>
                      {stepLift != null ? (
                        <small
                          className="block text-[11px]"
                          style={{ color: stepLift >= 0 ? SP_COLORS.deepGreen : SP_COLORS.red }}
                        >
                          {stepLift >= 0 ? `+${stepLift.toFixed(2)}` : stepLift.toFixed(2)} vs prior
                        </small>
                      ) : (
                        <small className="block text-[11px] text-[var(--foreground-secondary)]">baseline</small>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${mean == null ? 0 : (mean / 5) * 100}%`,
                        background: SP_COLORS.deepGreen
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {byEnrollee.length > 1 ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <small className="block text-[12px] text-[var(--foreground-secondary)]">
            Other enrollee series:{' '}
            {byEnrollee
              .filter((group) => group !== featured)
              .map((group) => `${group.enrolleeName} (${group.rows.length})`)
              .join(' · ')}
          </small>
        </div>
      ) : null}
    </AtlasInsetCard>
  )
}
