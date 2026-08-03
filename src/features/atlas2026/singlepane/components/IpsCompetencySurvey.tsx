/**
 * Intentional Peer Support Core Competencies (IPSCC) survey shell.
 * Reuses BurdenCard so the experience matches the Z-code survey: one competency
 * at a time, score buttons 1–5, and the PDF rating-scale text under the selection.
 */
import React from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bird,
  BookOpen,
  Clock,
  Compass,
  Ear,
  Eye,
  Footprints,
  Globe2,
  Handshake,
  Heart,
  HelpCircle,
  Infinity as InfinityIcon,
  Lightbulb,
  Link2,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Scale,
  ScanEye,
  Shield,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Users,
  Waypoints
} from 'lucide-react'
import type { IpsccCompetencyKey } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { AtlasMetaText, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { BurdenCard } from '@/features/atlas2026/singlepane/components/serviceCapacitySurvey/SurveyChrome'
import {
  IPSCC_COMPETENCY_CATALOG,
  buildIpsccScaleOptions,
  buildIpsccSurveyPrompt,
  describeIpsccScore,
  type IpsccCompetencyCatalogEntry,
  type IpsccCompetencyMarker,
  type IpsccMarkerIconId,
  type IpsccScaleLevel
} from '@/features/atlas2026/singlepane/data/intentionalPeerSupportCatalog'

export type IpsCompetencyScoreMap = Partial<Record<IpsccCompetencyKey, number | null>>

interface IpsCompetencySurveyProps {
  scores: IpsCompetencyScoreMap
  onChangeScore: (key: IpsccCompetencyKey, score: number | null) => void
  assignmentLabel?: string
  accentColor?: string
  headerSlot?: React.ReactNode
  footerSlot?: React.ReactNode
}

const SIMPLE_MARKER_ICONS: Partial<Record<IpsccMarkerIconId, LucideIcon>> = {
  clock: Clock,
  'trending-up': TrendingUp,
  handshake: Handshake,
  globe: Globe2,
  'link-2': Link2,
  eye: Eye,
  'refresh-cw': RefreshCw,
  sparkles: Sparkles,
  ear: Ear,
  compass: Compass,
  shield: Shield,
  'message-circle': MessageCircle,
  heart: Heart,
  target: Target,
  lightbulb: Lightbulb,
  scale: Scale,
  mirror: ScanEye,
  users: Users,
  'book-open': BookOpen,
  waypoints: Waypoints,
  sun: Sun,
  footprints: Footprints,
  megaphone: Megaphone,
  'scan-eye': ScanEye
}

function UsersQuestionIcon({ size = 18 }: { size?: number }) {
  return (
    <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center text-white" aria-hidden>
      <Users size={size - 2} strokeWidth={2} />
      <HelpCircle size={10} strokeWidth={2.5} className="absolute -right-0.5 -top-1 bg-[#1a1a1a]" />
    </span>
  )
}

function DoveInfinityIcon({ size = 18 }: { size?: number }) {
  return (
    <span className="relative inline-flex h-[18px] w-[18px] items-center justify-center text-white" aria-hidden>
      <Bird size={size - 4} strokeWidth={2} className="absolute top-0" />
      <InfinityIcon size={size - 4} strokeWidth={2} className="absolute bottom-0" />
    </span>
  )
}

function MarkerIcon({ iconId }: { iconId: IpsccMarkerIconId }) {
  if (iconId === 'users-question') return <UsersQuestionIcon />
  if (iconId === 'dove-infinity') return <DoveInfinityIcon />
  const Icon = SIMPLE_MARKER_ICONS[iconId] || Lightbulb
  return <Icon size={18} strokeWidth={2} className="text-white" aria-hidden />
}

function formatMarkerText(marker: IpsccCompetencyMarker) {
  const terms = marker.emphasizeTerms || []
  if (!terms.length) return marker.text
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = marker.text.split(pattern)
  return parts.map((part, index) => {
    const isEmphasized = terms.some((term) => term.toLowerCase() === part.toLowerCase())
    return isEmphasized ? (
      <strong key={`${part}-${index}`} className="font-semibold text-white">
        {part}
      </strong>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  })
}

function exampleForScore(entry: IpsccCompetencyCatalogEntry, score: number | null) {
  if (score == null || score < 1 || score > 5) return null
  return entry.examples[Math.round(score) as IpsccScaleLevel]
}

/** Three-column marker grid with icon tiles matching the IPSCC survey reference layout. */
function CompetencyBulletTable({ markers }: { markers: IpsccCompetencyMarker[] }) {
  if (!markers.length) return null
  return (
    <div className="atlas-surface-panel rounded-[14px] px-3 py-3">
      <small className="atlas-overline mb-2 block text-[#9eacb9]">competency markers</small>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {markers.map((marker) => (
          <div
            key={`${marker.icon}-${marker.text}`}
            className="flex items-start gap-2.5 rounded-[12px] border border-white/10 bg-white/[0.03] px-2.5 py-2.5"
          >
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-[#1a1a1a]"
              aria-hidden
            >
              <MarkerIcon iconId={marker.icon} />
            </span>
            <div className="min-w-0 pt-0.5 text-[12px] leading-snug text-[#d7e0e9]">{formatMarkerText(marker)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function IpsCompetencySurvey({
  scores,
  onChangeScore,
  assignmentLabel = 'rate this competency',
  accentColor = SP_COLORS.blue,
  headerSlot,
  footerSlot
}: IpsCompetencySurveyProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const totalCount = IPSCC_COMPETENCY_CATALOG.length
  const entry = IPSCC_COMPETENCY_CATALOG[currentIndex]
  const score = scores[entry.key] ?? null
  const hasAnswered = typeof score === 'number' && score >= 1 && score <= 5
  const answeredCount = IPSCC_COMPETENCY_CATALOG.filter((item) => {
    const value = scores[item.key]
    return typeof value === 'number' && value >= 1 && value <= 5
  }).length
  const example = exampleForScore(entry, score)
  const promptItem = buildIpsccSurveyPrompt(entry)
  const scale = buildIpsccScaleOptions(entry)

  function goToIndex(nextIndex: number) {
    setCurrentIndex(Math.max(0, Math.min(totalCount - 1, nextIndex)))
  }

  function goToFirstUnanswered() {
    const firstOpen = IPSCC_COMPETENCY_CATALOG.findIndex((item) => {
      const value = scores[item.key]
      return !(typeof value === 'number' && value >= 1 && value <= 5)
    })
    goToIndex(firstOpen >= 0 ? firstOpen : currentIndex)
  }

  return (
    <div className="space-y-3">
      {headerSlot}
      <div className="atlas-surface-raised flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <AtlasMetaText className="text-[12px]">
          Intentional Peer Support Core Competencies (IPSCC) · {answeredCount}/{totalCount} scored
        </AtlasMetaText>
        <div className="flex flex-wrap gap-1">
          {IPSCC_COMPETENCY_CATALOG.map((item, index) => {
            const value = scores[item.key]
            const isScored = typeof value === 'number' && value >= 1 && value <= 5
            const isCurrent = index === currentIndex
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => goToIndex(index)}
                className="h-7 min-w-7 rounded-[8px] border px-1.5 text-[11px] font-semibold"
                style={{
                  borderColor: isCurrent ? accentColor : 'rgba(255,255,255,0.18)',
                  background: isScored ? `${accentColor}22` : 'transparent',
                  color: isCurrent ? accentColor : '#d7e0e9'
                }}
                title={item.shortLabel}
              >
                {item.number}
              </button>
            )
          })}
        </div>
      </div>

      <BurdenCard
        promptItem={promptItem}
        scale={scale}
        score={hasAnswered ? score : null}
        notEncountered={false}
        accentColor={accentColor}
        currentIndex={currentIndex}
        totalCount={totalCount}
        hasPrevious={currentIndex > 0}
        hasNext={currentIndex < totalCount - 1}
        canAdvance={hasAnswered}
        canResume={answeredCount < totalCount}
        compact
        onPreviousNavigate={() => goToIndex(currentIndex - 1)}
        onNextNavigate={() => goToIndex(currentIndex + 1)}
        onResumeNavigate={goToFirstUnanswered}
        onChange={(nextScore) => onChangeScore(entry.key, nextScore)}
        onNotEncounteredChange={() => undefined}
        scoreRange={{ min: 1, max: 5, step: 1 }}
        describeScore={(nextScore) => describeIpsccScore(entry, nextScore)}
        assignmentLabel={assignmentLabel}
        unansweredHint="Select 1–5. The rating-scale wording under each number comes from the IPSCC self-assessment tool."
        inputControl="slider"
        showNotEncountered={false}
        showResume={answeredCount < totalCount && answeredCount > 0}
        promptExtras={<CompetencyBulletTable markers={entry.markers} />}
      />

      {example ? (
        <div className="atlas-surface-raised px-3 py-3">
          <small className="atlas-overline block text-[#9eacb9]">example at this score</small>
          <AtlasMetaText className="mt-1 block text-[13px] text-white">{example}</AtlasMetaText>
        </div>
      ) : null}

      {footerSlot ? <div className="pt-1">{footerSlot}</div> : null}

      {answeredCount === totalCount ? (
        <div className="flex justify-end">
          <AtlasTextButton
            onClick={() => goToIndex(0)}
            className="px-3 py-1.5 text-[12px]"
            style={{ ['--button-border-color' as const]: '#ffffff35', color: '#d7e0e9' } as React.CSSProperties}
          >
            review from start
          </AtlasTextButton>
        </div>
      ) : null}
    </div>
  )
}

export function scoresMapToItemArray(scores: IpsCompetencyScoreMap): number[] {
  return IPSCC_COMPETENCY_CATALOG.map((entry) => {
    const value = scores[entry.key]
    return typeof value === 'number' && value >= 1 && value <= 5 ? Math.round(value) : 3
  })
}

export function itemArrayToScoresMap(itemScores: number[]): IpsCompetencyScoreMap {
  return Object.fromEntries(
    IPSCC_COMPETENCY_CATALOG.map((entry, index) => {
      const value = itemScores[index]
      return [entry.key, typeof value === 'number' ? value : null]
    })
  ) as IpsCompetencyScoreMap
}

export function scoresMapToCompetencyRecord(
  scores: IpsCompetencyScoreMap
): Partial<Record<IpsccCompetencyKey, number>> {
  return Object.fromEntries(
    IPSCC_COMPETENCY_CATALOG.flatMap((entry) => {
      const value = scores[entry.key]
      if (typeof value !== 'number' || value < 1 || value > 5) return []
      return [[entry.key, Math.round(value)]]
    })
  )
}

export function isIpsCompetencySurveyComplete(scores: IpsCompetencyScoreMap) {
  return IPSCC_COMPETENCY_CATALOG.every((entry) => {
    const value = scores[entry.key]
    return typeof value === 'number' && value >= 1 && value <= 5
  })
}
