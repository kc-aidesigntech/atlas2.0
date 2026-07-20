/**
 * Compact competency dashboard for navigator My Profile.
 * Sits beneath the profile header and above the assignment / navigation strip so
 * supervision signals stay visible without opening section overlays.
 */
import React from 'react'
import type {
  CreateInsightRow,
  IpsccCompetencyAggregate,
  IpsccSelfAwarenessCorrelationRow,
  IpsccSelfAwarenessSummary
} from '@/features/atlas2026/shared/contracts'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'

interface NavigatorCompetencyDashboardProps {
  ipsccCompetencyAverages: IpsccCompetencyAggregate[]
  selfAwarenessCorrelationRows: IpsccSelfAwarenessCorrelationRow[]
  selfAwarenessSummary: IpsccSelfAwarenessSummary
  createInsights: CreateInsightRow[]
  onOpenSection?: (section: 'section_1_ipscc' | 'section_2_awareness' | 'section_3_create') => void
}

function formatScore(value: number | null | undefined) {
  return value == null ? '—' : value.toFixed(2)
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="atlas-surface-raised px-3 py-2">
      <small className="atlas-overline block text-[#9eacb9]">{label}</small>
      <div className="mt-0.5 text-[16px] font-medium text-white">{value}</div>
    </div>
  )
}

export default function NavigatorCompetencyDashboard({
  ipsccCompetencyAverages,
  selfAwarenessCorrelationRows,
  selfAwarenessSummary,
  createInsights,
  onOpenSection
}: NavigatorCompetencyDashboardProps) {
  const ratedCompetencies = ipsccCompetencyAverages.filter((row) => row.averageScore != null)
  const overallIpsccAverage = ratedCompetencies.length
    ? Number(
        (
          ratedCompetencies.reduce((sum, row) => sum + (row.averageScore || 0), 0) / ratedCompetencies.length
        ).toFixed(2)
      )
    : null
  const totalIpsccSamples = ipsccCompetencyAverages.reduce((sum, row) => sum + row.sampleSize, 0)
  // Surface the largest absolute gaps first so coaching focus is obvious in a compact column.
  const topCorrelationRows = selfAwarenessCorrelationRows
    .filter((row) => row.gap != null)
    .slice()
    .sort((left, right) => Math.abs(right.gap || 0) - Math.abs(left.gap || 0))
    .slice(0, 4)
  const workshopInsights = createInsights.filter((insight) => insight.latestSummary && !insight.latestSummary.startsWith('No notes'))

  return (
    <section className="atlas-surface-panel space-y-3 p-4" aria-label="Competency dashboard">
      <div>
        <small className="atlas-overline block text-[#9eacb9]">competency dashboard</small>
        <div className="text-[18px] font-medium text-white">supervision signals</div>
        <small className="atlas-meta mt-1 block text-[#9eacb9]">
          Individual Placement and Support Core Competencies (IPSCC) and Connect, Recognize, Encourage,
          Acknowledge, Train, and Empower (C.R.E.A.T.E.) at a glance
        </small>
      </div>

      {/* Section 1 — service-user IPSCC averages per competency */}
      <div className="atlas-surface-raised space-y-2 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <small className="atlas-overline block text-[#9eacb9]">section 1 · ratings / reviews</small>
            <div className="text-[14px] font-medium text-white">IPSCC averages by competency</div>
          </div>
          {onOpenSection ? (
            <AtlasTextButton onClick={() => onOpenSection('section_1_ipscc')} className="px-3 py-1 text-[12px]">
              open feedback
            </AtlasTextButton>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DashboardMetric label="overall avg" value={formatScore(overallIpsccAverage)} />
          <DashboardMetric label="competencies rated" value={String(ratedCompetencies.length)} />
          <DashboardMetric label="encounters" value={String(totalIpsccSamples)} />
        </div>
        {ipsccCompetencyAverages.length ? (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {ipsccCompetencyAverages.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 px-2.5 py-1.5 text-[12px]"
              >
                <span className="truncate text-white">{row.label}</span>
                <span className="shrink-0 tabular-nums text-[#d7e0e9]">
                  {formatScore(row.averageScore)}
                  <span className="ml-1 text-[#9eacb9]">n={row.sampleSize}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[#9eacb9]">No point-of-care IPSCC ratings recorded yet.</div>
        )}
      </div>

      {/* Section 2 — correlation between point-of-care IPSCC and weekly IPS self-assessments */}
      <div className="atlas-surface-raised space-y-2 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <small className="atlas-overline block text-[#9eacb9]">section 2 · level of self-awareness</small>
            <div className="text-[14px] font-medium text-white">IPSCC vs weekly self-assessment</div>
          </div>
          {onOpenSection ? (
            <AtlasTextButton onClick={() => onOpenSection('section_2_awareness')} className="px-3 py-1 text-[12px]">
              open reflection
            </AtlasTextButton>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DashboardMetric label="compared" value={String(selfAwarenessSummary.comparedCompetencyCount)} />
          <DashboardMetric label="avg gap" value={formatScore(selfAwarenessSummary.averageGap)} />
          <DashboardMetric
            label="alignment"
            value={formatScore(selfAwarenessSummary.overallAlignmentScore)}
          />
        </div>
        {topCorrelationRows.length ? (
          <div className="space-y-1.5">
            {topCorrelationRows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 rounded-[10px] border border-white/10 px-2.5 py-1.5 text-[12px]"
              >
                <span className="truncate text-white">{row.label}</span>
                <span className="tabular-nums text-[#9eacb9]">IPSCC {formatScore(row.ipsccAverage)}</span>
                <span className="tabular-nums text-[#9eacb9]">Self {formatScore(row.selfAverage)}</span>
                <span className="tabular-nums text-[#d7e0e9]">Gap {formatScore(row.gap)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[#9eacb9]">
            Correlation appears once both point-of-care IPSCC scores and weekly Individual Placement and Support
            (IPS) self-assessments exist for the same competencies.
          </div>
        )}
      </div>

      {/* Section 3 — qualitative workshop focus from C.R.E.A.T.E. supervision notes */}
      <div className="atlas-surface-raised space-y-2 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <small className="atlas-overline block text-[#9eacb9]">section 3 · what is being workshopped</small>
            <div className="text-[14px] font-medium text-white">C.R.E.A.T.E. supervision insights</div>
          </div>
          {onOpenSection ? (
            <AtlasTextButton onClick={() => onOpenSection('section_3_create')} className="px-3 py-1 text-[12px]">
              open C.R.E.A.T.E.
            </AtlasTextButton>
          ) : null}
        </div>
        {workshopInsights.length ? (
          <div className="space-y-1.5">
            {workshopInsights.map((insight) => (
              <div key={insight.pillar} className="rounded-[10px] border border-white/10 px-2.5 py-1.5 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">{insight.label}</span>
                  <span className="text-[#9eacb9]">n={insight.sessionCount}</span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[#d7e0e9]">{insight.latestSummary}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[#9eacb9]">
            No C.R.E.A.T.E. supervision notes yet. Workshop focus will summarize Recognize, Encourage, Acknowledge,
            Train, and Empower themes after the first saved session.
          </div>
        )}
      </div>
    </section>
  )
}
