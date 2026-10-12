/**
 * Enrollee point-of-care Intentional Peer Support Core Competencies (IPSCC) scale.
 * Ten agreement items, separate from the navigator self-assessment catalog.
 */
import React from 'react'
import type { ZCodeSurveyPrompt } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { AtlasMetaText, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { BurdenCard } from '@/features/atlas2026/singlepane/components/serviceCapacitySurvey/SurveyChrome'
import {
  IPSCC_AGREEMENT_LABELS,
  IPSCC_POINT_OF_CARE_ITEMS
} from '@/features/atlas2026/singlepane/data/intentionalPeerSupportCatalog'

export type PointOfCareScoreList = Array<number | null>

interface IpsPointOfCareSurveyProps {
  scores: PointOfCareScoreList
  onChangeScore: (index: number, score: number | null) => void
  headerSlot?: React.ReactNode
  footerSlot?: React.ReactNode
}

const AGREEMENT_SCALE = IPSCC_AGREEMENT_LABELS.map((label, index) => ({
  value: index + 1,
  label,
  description: label
}))

function promptForItem(number: number, prompt: string): ZCodeSurveyPrompt {
  return {
    id: `ips-poc-${number}`,
    parentCode: 'IPSCC',
    parentTheme: 'IPS Competency Scale',
    zCode: `I${number}`,
    normalizedZCode: `I${number}`,
    title: prompt,
    description: prompt
  }
}

function describeAgreementScore(score: number) {
  const level = Math.round(score)
  const label = IPSCC_AGREEMENT_LABELS[level - 1]
  if (!label) return null
  return { value: level, label, description: label }
}

export function emptyPointOfCareScores(): PointOfCareScoreList {
  return IPSCC_POINT_OF_CARE_ITEMS.map(() => null)
}

export function isPointOfCareSurveyComplete(scores: PointOfCareScoreList) {
  return IPSCC_POINT_OF_CARE_ITEMS.every((_, index) => {
    const value = scores[index]
    return typeof value === 'number' && value >= 1 && value <= 5
  })
}

export function pointOfCareScoresToItemArray(scores: PointOfCareScoreList) {
  return IPSCC_POINT_OF_CARE_ITEMS.map((_, index) => {
    const value = scores[index]
    return typeof value === 'number' && value >= 1 && value <= 5 ? Math.round(value) : 3
  })
}

export default function IpsPointOfCareSurvey({
  scores,
  onChangeScore,
  headerSlot,
  footerSlot
}: IpsPointOfCareSurveyProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const totalCount = IPSCC_POINT_OF_CARE_ITEMS.length
  const item = IPSCC_POINT_OF_CARE_ITEMS[currentIndex]
  const score = scores[currentIndex] ?? null
  const hasAnswered = typeof score === 'number' && score >= 1 && score <= 5
  const answeredCount = scores.filter((value) => typeof value === 'number' && value >= 1 && value <= 5).length

  function goToIndex(nextIndex: number) {
    setCurrentIndex(Math.max(0, Math.min(totalCount - 1, nextIndex)))
  }

  function goToFirstUnanswered() {
    const firstOpen = scores.findIndex((value) => !(typeof value === 'number' && value >= 1 && value <= 5))
    goToIndex(firstOpen >= 0 ? firstOpen : currentIndex)
  }

  return (
    <div className="space-y-3">
      {headerSlot}
      <div className="atlas-surface-raised flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <AtlasMetaText className="text-[12px]">
          Intentional Peer Support (IPS) Competency Scale · {answeredCount}/{totalCount} scored
        </AtlasMetaText>
        <div className="flex flex-wrap gap-1">
          {IPSCC_POINT_OF_CARE_ITEMS.map((entry, index) => {
            const value = scores[index]
            const isScored = typeof value === 'number' && value >= 1 && value <= 5
            const isCurrent = index === currentIndex
            return (
              <button
                key={entry.number}
                type="button"
                onClick={() => goToIndex(index)}
                className="h-7 min-w-7 rounded-[8px] border px-1.5 text-[11px] font-semibold"
                style={{
                  borderColor: isCurrent ? SP_COLORS.green : 'rgba(255,255,255,0.18)',
                  background: isScored ? `${SP_COLORS.green}22` : 'transparent',
                  color: isCurrent ? SP_COLORS.green : '#d7e0e9'
                }}
                title={entry.prompt}
              >
                {entry.number}
              </button>
            )
          })}
        </div>
      </div>
      <BurdenCard
        promptItem={promptForItem(item.number, item.prompt)}
        scale={AGREEMENT_SCALE}
        score={hasAnswered ? score : null}
        notEncountered={false}
        accentColor={SP_COLORS.green}
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
        onChange={(nextScore) => onChangeScore(currentIndex, nextScore)}
        onNotEncounteredChange={() => undefined}
        scoreRange={{ min: 1, max: 5, step: 1 }}
        describeScore={describeAgreementScore}
        assignmentLabel="how much do you agree?"
        unansweredHint="1 strongly disagree · 2 disagree · 3 unsure · 4 agree · 5 strongly agree"
        inputControl="slider"
        showNotEncountered={false}
        showResume={answeredCount < totalCount && answeredCount > 0}
      />
      {footerSlot ? <div className="pt-1">{footerSlot}</div> : null}
      {answeredCount === totalCount ? (
        <div className="flex justify-end">
          <AtlasTextButton onClick={() => goToIndex(0)} className="px-3 py-1.5 text-[12px]">
            review from start
          </AtlasTextButton>
        </div>
      ) : null}
    </div>
  )
}
