/**
 * Compact competency dashboard for navigator My Profile.
 * Section 1: horizontal Intentional Peer Support Core Competencies (IPSCC)
 * thermometer gauges for enrollee weighted averages (privacy-gated).
 * Section 2 (self-awareness list) is hidden — dual radar on the rail covers strain.
 * Section 3 (C.R.E.A.T.E. reflection) renders above the assignment board.
 */
import React from 'react'
import type {
  IpsccCompetencyAggregate,
  IpsccEnrolleeFeedbackPrivacy
} from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'

/** IPSCC Likert scale bounds used to map averages onto thermometer fill height. */
const IPSCC_SCORE_MIN = 1
const IPSCC_SCORE_MAX = 5

interface NavigatorCompetencyDashboardProps {
  ipsccCompetencyAverages: IpsccCompetencyAggregate[]
  ipsccEnrolleeFeedbackPrivacy: IpsccEnrolleeFeedbackPrivacy
  onOpenSection?: (section: 'section_1_ipscc' | 'section_2_awareness' | 'section_3_create') => void
}

function formatScore(value: number | null | undefined) {
  return value == null ? '—' : value.toFixed(1)
}

/** Map 1–5 average into a bottom-up fill fraction for the thermometer tube. */
function scoreToFillRatio(score: number | null): number {
  if (score == null || !Number.isFinite(score)) return 0
  const clamped = Math.min(IPSCC_SCORE_MAX, Math.max(IPSCC_SCORE_MIN, score))
  return (clamped - IPSCC_SCORE_MIN) / (IPSCC_SCORE_MAX - IPSCC_SCORE_MIN)
}

/** Warmth rises with score so low averages read cool/caution and highs read healthy. */
function scoreToFillColor(score: number | null): string {
  if (score == null) return 'transparent'
  if (score < 2.5) return SP_COLORS.red
  if (score < 3.5) return SP_COLORS.yellow
  return SP_COLORS.green
}

function IpsccThermometerGauge({
  label,
  score,
  sampleSize,
  locked
}: {
  label: string
  score: number | null
  sampleSize: number
  locked: boolean
}) {
  const fillRatio = locked ? 0 : scoreToFillRatio(score)
  const fillColor = locked ? 'transparent' : scoreToFillColor(score)
  const displayScore = locked ? '·' : formatScore(score)

  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center"
      title={`${label}${locked ? ' (locked until privacy threshold)' : ` · avg ${formatScore(score)} · n=${sampleSize}`}`}
    >
      {/* Fixed tube band so every gauge shares one baseline regardless of label wrap. */}
      <div className="flex h-[96px] w-full flex-col items-center justify-end pb-1">
        <div
          className="relative flex h-[88px] w-[14px] flex-col justify-end overflow-hidden rounded-full border border-white/20 bg-black/35"
          role="img"
          aria-label={
            locked
              ? `${label}: average locked`
              : `${label}: enrollee average ${formatScore(score)} of ${IPSCC_SCORE_MAX}`
          }
        >
          {/* Bulb at the base keeps the classic thermometer silhouette without a new motif system. */}
          <div
            className="absolute bottom-0 left-1/2 z-[1] h-[16px] w-[16px] -translate-x-1/2 translate-y-[2px] rounded-full border border-white/25"
            style={{ background: fillRatio > 0.02 ? fillColor : 'rgba(0,0,0,0.35)' }}
          />
          <div
            className="w-full rounded-full transition-[height] duration-300 ease-out"
            style={{
              height: `${Math.max(fillRatio * 100, fillRatio > 0 ? 8 : 0)}%`,
              background: fillColor,
              minHeight: fillRatio > 0 ? 10 : 0
            }}
          />
        </div>
      </div>
      <div className="flex h-[18px] items-center tabular-nums text-[11px] font-medium text-white">
        {displayScore}
      </div>
      <div className="mt-1 flex h-[28px] w-full items-start justify-center px-0.5">
        <div className="line-clamp-2 max-w-[4.5rem] text-center text-[9px] leading-[14px] text-[#9eacb9]">
          {label}
        </div>
      </div>
    </div>
  )
}

export default function NavigatorCompetencyDashboard({
  ipsccCompetencyAverages,
  ipsccEnrolleeFeedbackPrivacy,
  onOpenSection
}: NavigatorCompetencyDashboardProps) {
  const totalIpsccSamples = ipsccEnrolleeFeedbackPrivacy.totalEncounterSubmissions
  const averagesRevealed = ipsccEnrolleeFeedbackPrivacy.averagesRevealed

  return (
    <section className="atlas-surface-panel space-y-3 p-4" aria-label="Competency dashboard">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <small className="atlas-overline block text-[#9eacb9]">section 1 · ratings / reviews</small>
          <div className="text-[18px] font-medium text-white">Enrollee IPSCC averages</div>
          <small className="atlas-meta mt-1 block text-[#9eacb9]">
            Intentional Peer Support Core Competencies (IPSCC) weighted averages across all ten
            competencies · scale {IPSCC_SCORE_MIN}–{IPSCC_SCORE_MAX}
          </small>
        </div>
        {onOpenSection ? (
          <AtlasTextButton onClick={() => onOpenSection('section_1_ipscc')} className="px-3 py-1 text-[12px]">
            pass tablet survey
          </AtlasTextButton>
        ) : null}
      </div>

      {!averagesRevealed ? (
        <div className="space-y-2">
          <div className="flex w-full items-start justify-between gap-1">
            {ipsccCompetencyAverages.map((row) => (
              <IpsccThermometerGauge
                key={row.key}
                label={row.label}
                score={null}
                sampleSize={row.sampleSize}
                locked
              />
            ))}
          </div>
          <div className="text-[12px] text-[#9eacb9]">
            Averages unlock after {ipsccEnrolleeFeedbackPrivacy.minEntriesToRevealAverages} enrollee encounter
            submissions ({totalIpsccSamples} so far). Individual enrollee responses are never shown to navigators.
          </div>
        </div>
      ) : ipsccCompetencyAverages.length ? (
        <div className="flex w-full items-start justify-between gap-1 overflow-x-auto pb-1">
          {ipsccCompetencyAverages.map((row) => (
            <IpsccThermometerGauge
              key={row.key}
              label={row.label}
              score={row.averageScore}
              sampleSize={row.sampleSize}
              locked={false}
            />
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-[#9eacb9]">No point-of-care IPSCC ratings from enrollees yet.</div>
      )}
    </section>
  )
}
