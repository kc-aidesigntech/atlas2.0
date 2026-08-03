import React, { useEffect, useRef, useState } from 'react'
import { AtlasTextButton } from '../../../components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  PartnerServiceCapacityScaleOption,
  ZCodeSurveyPrompt,
  ZCodeSurveySection
} from '../../types'
import type { DraftAnswer } from './draft'
import type { SurveyCardConfig } from './config'
import { BurdenCard, SurveyProgressHeader, type SurveySectionProgressItem } from './SurveyChrome'

interface PromptEntry {
  section: ZCodeSurveySection
  prompt: ZCodeSurveyPrompt
}

interface SurveyExperienceProps {
  currentPromptEntry: PromptEntry
  currentPromptAnswer: DraftAnswer | null | undefined
  currentPromptIndex: number
  totalCount: number
  completedCount: number
  lastAnsweredPromptIndex: number
  sectionProgress: SurveySectionProgressItem[]
  accentColor: string
  scale: PartnerServiceCapacityScaleOption[]
  scoreRange: { min: number; max: number; step?: number } | null
  surveyConfig: SurveyCardConfig
  isSaving: boolean
  isSurveyComplete: boolean
  onSetPromptIndex: React.Dispatch<React.SetStateAction<number>>
  onUpdateAnswer: (promptId: string, updates: Partial<DraftAnswer>) => void
  onComplete: () => void
}

export function SurveyExperience({
  currentPromptEntry,
  currentPromptAnswer,
  currentPromptIndex,
  totalCount,
  completedCount,
  lastAnsweredPromptIndex,
  sectionProgress,
  accentColor,
  scale,
  scoreRange,
  surveyConfig,
  isSaving,
  isSurveyComplete,
  onSetPromptIndex,
  onUpdateAnswer,
  onComplete
}: SurveyExperienceProps) {
  const [isSurveyImmersed, setIsSurveyImmersed] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const surveyExperienceRef = useRef<HTMLDivElement | null>(null)
  const completeSubmissionButtonRef = useRef<HTMLButtonElement | null>(null)
  const wasSurveyCompleteRef = useRef(false)
  const canAdvance = Boolean(
    currentPromptAnswer &&
    (currentPromptAnswer.notEncountered || typeof currentPromptAnswer.score === 'number')
  )
  const canResume = lastAnsweredPromptIndex >= 0 && lastAnsweredPromptIndex !== currentPromptIndex
  // Knob input needs more vertical space than the compact sticky shell, so only
  // the burden slider enters the desktop immersive survey treatment.
  const useImmersiveLayout = isSurveyImmersed && !isMobileViewport && surveyConfig.inputControl !== 'knob'

  useEffect(() => {
    function updateViewportState() {
      setIsMobileViewport(window.innerWidth < 768)
      setIsSurveyImmersed((surveyExperienceRef.current?.getBoundingClientRect().top ?? 21) <= 20)
    }
    updateViewportState()
    window.addEventListener('scroll', updateViewportState, { passive: true })
    window.addEventListener('resize', updateViewportState)
    return () => {
      window.removeEventListener('scroll', updateViewportState)
      window.removeEventListener('resize', updateViewportState)
    }
  }, [])

  useEffect(() => {
    if (!isSurveyComplete || wasSurveyCompleteRef.current) {
      wasSurveyCompleteRef.current = isSurveyComplete
      return
    }
    wasSurveyCompleteRef.current = true
    requestAnimationFrame(() => {
      completeSubmissionButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [isSurveyComplete])

  return (
    <>
      <div
        ref={surveyExperienceRef}
        className={`${useImmersiveLayout ? 'sticky top-0 z-20' : 'relative'} mt-5 transition-[transform] duration-500 ease-out`}
      >
        <div
          className={`transition-[height,padding,border-radius,box-shadow,background-color] duration-500 ease-out ${
            useImmersiveLayout
              ? 'rounded-[16px] border border-white/10 bg-[#030303]/96 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-sm md:rounded-[20px] md:p-4'
              : ''
          }`}
          style={useImmersiveLayout ? { height: '100svh' } : undefined}
        >
          <div className={useImmersiveLayout ? 'grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 overflow-hidden' : ''}>
        <SurveyProgressHeader
          currentIndex={currentPromptIndex}
          totalCount={totalCount}
          completedCount={completedCount}
          parentCode={currentPromptEntry.section.parentCode}
          parentTheme={currentPromptEntry.section.theme}
          accentColor={accentColor}
          sectionProgress={sectionProgress}
          pinToViewport={!useImmersiveLayout}
          className={useImmersiveLayout ? 'mt-0 shrink-0 px-3 py-2.5 md:px-4' : ''}
        />
        <div
          className={`${useImmersiveLayout ? 'px-3 py-2.5 md:px-4' : 'mt-5 px-4 py-3 md:px-5'} rounded-[14px] border`}
          style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}
        >
          <small className="block text-[11px] uppercase tracking-[0.12em] md:text-[12px]" style={{ color: SP_COLORS.muted }}>
            z-code survey questions
          </small>
          <div className="mt-1 text-[18px] font-medium leading-snug text-white md:text-[22px]">
            {surveyConfig.promptQuestion}
          </div>
        </div>
        <div className={useImmersiveLayout ? 'min-h-0 overflow-hidden' : 'mt-4'}>
          <BurdenCard
            promptItem={currentPromptEntry.prompt}
            scale={scale}
            score={currentPromptAnswer?.score ?? null}
            notEncountered={currentPromptAnswer?.notEncountered ?? false}
            accentColor={accentColor}
            currentIndex={currentPromptIndex}
            totalCount={totalCount}
            hasPrevious={currentPromptIndex > 0}
            hasNext={currentPromptIndex < totalCount - 1}
            canAdvance={canAdvance}
            canResume={canResume}
            compact={useImmersiveLayout}
            onPreviousNavigate={() => onSetPromptIndex((current) => Math.max(0, current - 1))}
            onNextNavigate={() => onSetPromptIndex((current) => Math.min(totalCount - 1, current + 1))}
            onResumeNavigate={() => onSetPromptIndex(lastAnsweredPromptIndex)}
            onChange={(score) => onUpdateAnswer(currentPromptEntry.prompt.id, { score, notEncountered: false })}
            onNotEncounteredChange={(value) => onUpdateAnswer(currentPromptEntry.prompt.id, {
              notEncountered: value,
              score: null
            })}
            scoreRange={scoreRange || undefined}
            describeScore={surveyConfig.describeScore}
            assignmentLabel={surveyConfig.assignmentLabel}
            unansweredHint={surveyConfig.unansweredHint}
            inputControl={surveyConfig.inputControl}
          />
        </div>
        {useImmersiveLayout && isSurveyComplete ? (
          <div className="flex shrink-0 justify-end border-t border-white/10 pt-3">
            <CompleteButton
              buttonRef={completeSubmissionButtonRef}
              isSaving={isSaving}
              onComplete={onComplete}
            />
          </div>
        ) : null}
          </div>
        </div>
      </div>
      {!useImmersiveLayout && isSurveyComplete ? (
        <div className="mt-5 flex justify-end">
          <CompleteButton buttonRef={completeSubmissionButtonRef} isSaving={isSaving} onComplete={onComplete} />
        </div>
      ) : null}
    </>
  )
}

function CompleteButton({
  buttonRef,
  isSaving,
  onComplete
}: {
  buttonRef: React.Ref<HTMLButtonElement>
  isSaving: boolean
  onComplete: () => void
}) {
  return (
    <AtlasTextButton
      ref={buttonRef}
      onClick={onComplete}
      disabled={isSaving}
      className="px-5 py-2 text-[13px] font-medium md:text-[14px]"
      style={{
        ['--button-border-color' as const]: SP_COLORS.yellow,
        color: SP_COLORS.yellow,
        opacity: isSaving ? 0.6 : 1
      } as React.CSSProperties}
    >
      {isSaving ? 'completing submission...' : 'complete submission'}
    </AtlasTextButton>
  )
}
