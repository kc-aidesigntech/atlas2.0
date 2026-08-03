/**
 * Compact competency dashboard for navigator My Profile.
 * Sits beneath the profile chrome divider (photo + assignment board) so
 * supervision signals stay visible without opening section overlays.
 *
 * Exactly three sections:
 * 1) Enrollee IPSCC averages (privacy-gated)
 * 2) Self-awareness: enrollee IPSCC vs weekly self-assessment
 * 3) Qualitative C.R.E.A.T.E. supervisor reflection
 */
import React from 'react'
import type {
  IpsccCompetencyAggregate,
  IpsccEnrolleeFeedbackPrivacy,
  IpsccSelfAwarenessCorrelationRow,
  IpsccSelfAwarenessSummary,
  NavigatorCreateReflectionRecord
} from '@/features/atlas2026/shared/contracts'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'

interface NavigatorCompetencyDashboardProps {
  ipsccCompetencyAverages: IpsccCompetencyAggregate[]
  ipsccEnrolleeFeedbackPrivacy: IpsccEnrolleeFeedbackPrivacy
  selfAwarenessCorrelationRows: IpsccSelfAwarenessCorrelationRow[]
  selfAwarenessSummary: IpsccSelfAwarenessSummary
  createReflection: NavigatorCreateReflectionRecord | null
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
  ipsccEnrolleeFeedbackPrivacy,
  selfAwarenessCorrelationRows,
  selfAwarenessSummary,
  createReflection,
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
  const totalIpsccSamples = ipsccEnrolleeFeedbackPrivacy.totalEncounterSubmissions
  // Surface the largest absolute strain first so coaching focus is obvious in a compact column.
  const topCorrelationRows = selfAwarenessCorrelationRows
    .filter((row) => row.strain != null)
    .slice()
    .sort((left, right) => (right.strain || 0) - (left.strain || 0))
    .slice(0, 4)
  const averagesRevealed = ipsccEnrolleeFeedbackPrivacy.averagesRevealed
  const reflectionSessionCount = createReflection?.sourceSessionIds?.length || 0
  const reflectionText = createReflection?.reflectionText?.trim() || ''

  return (
    <section className="atlas-surface-panel space-y-3 p-4" aria-label="Competency dashboard">
      <div>
        <small className="atlas-overline block text-[#9eacb9]">competency dashboard</small>
        <div className="text-[18px] font-medium text-white">supervision signals</div>
        <small className="atlas-meta mt-1 block text-[#9eacb9]">
          Intentional Peer Support Core Competencies (IPSCC) enrollee feedback, self-awareness strain, and
          Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.) supervision reflection
        </small>
      </div>

      {/* Section 1 — enrollee IPSCC averages per competency (never individual submissions) */}
      <div className="atlas-surface-raised space-y-2 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <small className="atlas-overline block text-[#9eacb9]">section 1 · ratings / reviews</small>
            <div className="text-[14px] font-medium text-white">Enrollee IPSCC averages by competency</div>
          </div>
          {onOpenSection ? (
            <AtlasTextButton onClick={() => onOpenSection('section_1_ipscc')} className="px-3 py-1 text-[12px]">
              pass tablet survey
            </AtlasTextButton>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DashboardMetric
            label="overall avg"
            value={averagesRevealed ? formatScore(overallIpsccAverage) : 'locked'}
          />
          <DashboardMetric label="competencies rated" value={String(ratedCompetencies.length)} />
          <DashboardMetric label="encounters" value={String(totalIpsccSamples)} />
        </div>
        {!averagesRevealed ? (
          <div className="text-[12px] text-[#9eacb9]">
            Averages unlock after {ipsccEnrolleeFeedbackPrivacy.minEntriesToRevealAverages} enrollee encounter
            submissions ({totalIpsccSamples} so far). Individual enrollee responses are never shown to navigators.
          </div>
        ) : ipsccCompetencyAverages.length ? (
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
          <div className="text-[12px] text-[#9eacb9]">No point-of-care IPSCC ratings from enrollees yet.</div>
        )}
      </div>

      {/* Section 2 — correlation between enrollee IPSCC and weekly pre-supervision self-assessments */}
      <div className="atlas-surface-raised space-y-2 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <small className="atlas-overline block text-[#9eacb9]">section 2 · level of self-awareness</small>
            <div className="text-[14px] font-medium text-white">Enrollee IPSCC vs weekly self-assessment</div>
          </div>
          {onOpenSection ? (
            <AtlasTextButton onClick={() => onOpenSection('section_2_awareness')} className="px-3 py-1 text-[12px]">
              open reflection
            </AtlasTextButton>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DashboardMetric label="compared" value={String(selfAwarenessSummary.comparedCompetencyCount)} />
          <DashboardMetric label="avg strain" value={formatScore(selfAwarenessSummary.averageStrain)} />
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
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] border border-white/10 px-2.5 py-1.5 text-[12px]"
              >
                <span className="truncate text-white">{row.label}</span>
                <span className="tabular-nums text-[#d7e0e9]">
                  strain {formatScore(row.strain)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[#9eacb9]">
            Strain appears once enrollee IPSCC averages unlock and a weekly Intentional Peer Support Core
            Competencies (IPSCC) self-assessment exists for the same competencies. Dual radar on the right
            encodes tip risk.
          </div>
        )}
      </div>

      {/* Section 3 — one supervisor→navigator C.R.E.A.T.E. reflection (not raw pillar dumps) */}
      <div className="atlas-surface-raised space-y-2 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <small className="atlas-overline block text-[#9eacb9]">section 3 · what is being workshopped</small>
            <div className="text-[14px] font-medium text-white">C.R.E.A.T.E. supervision reflection</div>
          </div>
          {onOpenSection ? (
            <AtlasTextButton onClick={() => onOpenSection('section_3_create')} className="px-3 py-1 text-[12px]">
              open C.R.E.A.T.E.
            </AtlasTextButton>
          ) : null}
        </div>
        {reflectionText ? (
          <div className="rounded-[10px] border border-white/10 px-2.5 py-2 text-[12px]">
            <p className="whitespace-pre-wrap leading-relaxed text-[#d7e0e9]">{reflectionText}</p>
            <small className="atlas-meta mt-2 block text-[#9eacb9]">
              Updated after latest C.R.E.A.T.E. · based on last {reflectionSessionCount || 1} session
              {reflectionSessionCount === 1 ? '' : 's'}
              {createReflection?.usedFallback ? ' · offline summary' : ''}
            </small>
          </div>
        ) : (
          <div className="text-[12px] text-[#9eacb9]">
            No C.R.E.A.T.E. reflection yet. A 3–4 sentence supervisor reflection appears here after the first
            saved supervision session on this navigator profile.
          </div>
        )}
      </div>
    </section>
  )
}
