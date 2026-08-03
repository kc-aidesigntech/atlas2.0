import React from 'react'
import {
  AtlasInsetCard,
  AtlasPanel,
  AtlasPlusButton,
  AtlasTextButton
} from '@/features/atlas2026/components/AtlasPrimitives'
import {
  NOT_APPLICABLE_SENTINEL,
  isAssessmentPromptComplete,
  type AssessmentDefinition
} from '@/features/atlas2026/singlepane/data/assessmentCatalog'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { RegulationTestAnswer } from '@/features/atlas2026/shared/contracts'
import type { RenewalPromptEntry } from '../RegulationTestsOverlay'

interface RenewalAssessmentSurveyProps {
  definition: AssessmentDefinition
  visibleEntries: RenewalPromptEntry[]
  answersByPromptId: Map<string, RegulationTestAnswer>
  scoreSummary: {
    gateScoreLabel: string
    gateScore: number | null
    officialScoreLabel: string | null
    officialScore: number | null
    detailMetrics: Array<{
      id: string
      label: string
      answeredCount: number
      totalCount: number
      isApplicable: boolean
      isOfficiallyScored: boolean
      officialImpairmentScore: number | null
      appGateScore: number | null
    }>
  }
  isSaving: boolean
  saveError: string | null
  validationError: string | null
  currentPromptIndex: number
  onCurrentPromptIndexChange: (index: number) => void
  onAnswerChange: (promptId: string, responseValue: number | null) => void
  onBackToRecords: () => void
  onCheckoutNewRecord: () => void
  onSaveDraft: () => void
  onComplete: () => void
}

const formatMetric = (value: number | null) =>
  typeof value !== 'number' ? 'pending' : Number.isInteger(value) ? `${value}` : value.toFixed(2)

/**
 * Owns the branching renewal instrument presentation while the parent overlay retains
 * record selection and persistence orchestration.
 */
export default function RenewalAssessmentSurvey(props: RenewalAssessmentSurveyProps) {
  const {
    definition, visibleEntries, answersByPromptId, scoreSummary, isSaving,
    saveError, validationError, currentPromptIndex, onCurrentPromptIndexChange,
    onAnswerChange, onBackToRecords, onCheckoutNewRecord, onSaveDraft, onComplete
  } = props
  const completedCount = visibleEntries.reduce((count, entry) => {
    const responseValue = answersByPromptId.get(entry.prompt.id)?.responseValue
    return count + (isAssessmentPromptComplete(entry.prompt, responseValue) ? 1 : 0)
  }, 0)
  const currentEntry = visibleEntries[currentPromptIndex] || null
  const currentAnswer = currentEntry ? answersByPromptId.get(currentEntry.prompt.id) : null
  const isSurveyComplete = visibleEntries.length > 0 && completedCount === visibleEntries.length

  function renderPromptCard(entry: RenewalPromptEntry) {
    const { prompt, section } = entry
    const currentValue = currentAnswer?.responseValue ?? null
    if (prompt.kind === 'applicability') {
      // Applicability answers decide whether the remaining section prompts participate.
      return (
        <AtlasInsetCard className="rounded-[20px] border-white/20 bg-[#0a0a0a] px-5 py-5">
          <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>applicability check</small>
          <div className="mt-2 text-[24px] font-medium leading-tight text-white">{prompt.label}</div>
          <small className="mt-2 block text-[13px] text-[#cfcfcf]">{prompt.description}</small>
          <div className="mt-6 flex flex-wrap gap-3">
            {definition.applicabilityScale?.map((option) => {
              const isSelected = currentValue === option.value
              return (
                <AtlasTextButton
                  key={option.value}
                  onClick={() => onAnswerChange(prompt.id, option.value)}
                  className="px-5 py-2 text-[14px] font-medium"
                  style={{
                    ['--button-border-color' as const]: isSelected ? SP_COLORS.yellow : '#ffffff30',
                    color: isSelected ? SP_COLORS.yellow : SP_COLORS.white,
                    backgroundColor: isSelected ? 'rgba(252,192,26,0.08)' : 'transparent'
                  } as React.CSSProperties}
                >
                  {option.label}
                </AtlasTextButton>
              )
            })}
          </div>
          <small className="mt-4 block text-[12px] text-[#bdbdbd]">{section.description}</small>
        </AtlasInsetCard>
      )
    }

    const selectedScaleOption = definition.answerScale.find((option) => option.value === currentValue) || null
    const isMarkedNotApplicable = prompt.allowsNotApplicable && currentValue === NOT_APPLICABLE_SENTINEL
    return (
      <AtlasInsetCard className="rounded-[20px] border-white/20 bg-[#0a0a0a] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>{section.title}</small>
            <div className="mt-2 text-[22px] font-medium leading-tight text-white">{prompt.label}</div>
            <small className="mt-2 block text-[13px] text-[#cfcfcf]">{prompt.description}</small>
          </div>
          <div
            className="flex min-w-[72px] items-center justify-center rounded-full border px-4 py-2 text-[20px] font-semibold"
            style={{
              borderColor: isMarkedNotApplicable ? SP_COLORS.deepGreen : '#ffffff24',
              color: isMarkedNotApplicable ? SP_COLORS.deepGreen : SP_COLORS.white
            }}
          >
            {isMarkedNotApplicable ? 'N/A' : typeof currentValue === 'number' ? currentValue : '--'}
          </div>
        </div>
        {prompt.allowsNotApplicable ? (
          <div className="mt-4">
            <AtlasTextButton
              onClick={() => onAnswerChange(prompt.id, isMarkedNotApplicable ? null : NOT_APPLICABLE_SENTINEL)}
              className="px-4 py-1.5 text-[12px]"
              style={{
                ['--button-border-color' as const]: isMarkedNotApplicable ? SP_COLORS.deepGreen : '#ffffff30',
                color: isMarkedNotApplicable ? SP_COLORS.deepGreen : SP_COLORS.white
              } as React.CSSProperties}
            >
              mark N/A for this domain
            </AtlasTextButton>
          </div>
        ) : null}
        <div className={`mt-5 grid gap-2 ${definition.answerScale.length > 4 ? 'sm:grid-cols-4 lg:grid-cols-7' : 'sm:grid-cols-3'}`}>
          {definition.answerScale.map((option) => {
            const isSelected = currentValue === option.value
            return (
              <AtlasTextButton
                key={option.value}
                disabled={isMarkedNotApplicable}
                onClick={() => onAnswerChange(prompt.id, option.value)}
                className="px-3 py-3 text-left"
                style={{
                  ['--button-border-color' as const]: isSelected ? SP_COLORS.yellow : '#ffffff22',
                  color: isSelected ? SP_COLORS.yellow : SP_COLORS.white,
                  opacity: isMarkedNotApplicable ? 0.45 : 1,
                  backgroundColor: isSelected ? 'rgba(252,192,26,0.08)' : 'transparent'
                } as React.CSSProperties}
              >
                <div className="text-[16px] font-semibold">{option.value}</div>
                <small className="mt-1 block text-[11px] text-[#cfcfcf]">{option.label}</small>
              </AtlasTextButton>
            )
          })}
        </div>
        <small className="mt-4 block text-[12px] text-[#bdbdbd]">
          {isMarkedNotApplicable
            ? 'This item will be excluded from official B-IPF scoring and from the ATLAS app gate.'
            : selectedScaleOption
              ? `${selectedScaleOption.value} - ${selectedScaleOption.label}: ${selectedScaleOption.description}`
              : 'Select a value to record this item.'}
        </small>
      </AtlasInsetCard>
    )
  }

  return (
    <AtlasPanel
      kicker={definition.label}
      title="Survey draft"
      description={`${definition.passThresholdLabel}. Official PTSD scoring remains separate and visible throughout the survey.`}
      className="rounded-[22px] bg-[#070707]"
      actions={<AtlasPlusButton onClick={onCheckoutNewRecord} label={`new ${definition.shortLabel} survey`} />}
    >
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <AtlasInsetCard className="rounded-[18px] border-white/20 bg-[#0a0a0a] px-4 py-4">
            <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>scoring rules</small>
            <div className="mt-3 space-y-2">
              {definition.officialRules.map((rule) => <small key={rule} className="block text-[12px] leading-snug text-[#d4d4d4]">{rule}</small>)}
            </div>
          </AtlasInsetCard>
          <AtlasInsetCard className="rounded-[18px] border-white/20 bg-[#0a0a0a] px-4 py-4">
            <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>score preview</small>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ScorePreview label={scoreSummary.gateScoreLabel} value={scoreSummary.gateScore} detail={`Threshold ${definition.passThreshold}`} />
              <ScorePreview label={scoreSummary.officialScoreLabel || 'Official score'} value={scoreSummary.officialScore} detail="Higher official scores mean greater impairment." />
            </div>
          </AtlasInsetCard>
          {scoreSummary.detailMetrics.length ? (
            <AtlasInsetCard className="rounded-[18px] border-white/20 bg-[#0a0a0a] px-4 py-4">
              <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>section detail</small>
              <div className="mt-3 space-y-2">
                {scoreSummary.detailMetrics.map((metric) => (
                  <div key={metric.id} className="rounded-[14px] border px-3 py-3" style={{ borderColor: '#ffffff1c' }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-medium text-white">{metric.label}</div>
                        <small className="block text-[11px] text-[#bdbdbd]">
                          {metric.answeredCount}/{metric.totalCount} answered
                          {metric.isApplicable ? '' : ' · not applicable'}
                          {metric.isApplicable && !metric.isOfficiallyScored ? ' · below official completeness rule' : ''}
                        </small>
                      </div>
                      {metric.isOfficiallyScored ? (
                        <div className="text-right">
                          <small className="block text-[11px] text-[#cfcfcf]">official {formatMetric(metric.officialImpairmentScore)}</small>
                          <small className="block text-[11px] text-[#cfcfcf]">gate {formatMetric(metric.appGateScore)}</small>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </AtlasInsetCard>
          ) : null}
        </div>
        <div className="space-y-4">
          <AtlasInsetCard className="rounded-[18px] border-white/20 bg-[#0a0a0a] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>survey progress</small>
                <div className="mt-1 text-[14px] text-white">{Math.min(currentPromptIndex + 1, visibleEntries.length || 1)} of {visibleEntries.length} visible prompts</div>
              </div>
              <small className="text-[12px] text-[#cfcfcf]">{completedCount} completed</small>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${visibleEntries.length ? (completedCount / visibleEntries.length) * 100 : 0}%`, backgroundColor: SP_COLORS.yellow }} />
            </div>
          </AtlasInsetCard>
          {currentEntry ? renderPromptCard(currentEntry) : null}
          {validationError ? <ErrorBanner message={validationError} /> : null}
          {saveError ? <ErrorBanner message={saveError} /> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AtlasTextButton onClick={onBackToRecords} className="px-4 py-2 text-[12px] text-white" style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}>back to records</AtlasTextButton>
            <div className="flex flex-wrap items-center gap-2">
              <AtlasTextButton onClick={() => onCurrentPromptIndexChange(Math.max(0, currentPromptIndex - 1))} disabled={currentPromptIndex === 0} className="px-4 py-2 text-[12px] text-white" style={{ ['--button-border-color' as const]: '#ffffff40', opacity: currentPromptIndex === 0 ? 0.4 : 1 } as React.CSSProperties}>previous</AtlasTextButton>
              <AtlasTextButton
                onClick={() => onCurrentPromptIndexChange(Math.min(visibleEntries.length - 1, currentPromptIndex + 1))}
                disabled={!currentEntry || !isAssessmentPromptComplete(currentEntry.prompt, currentAnswer?.responseValue) || currentPromptIndex >= visibleEntries.length - 1}
                className="px-4 py-2 text-[12px]"
                style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
              >next</AtlasTextButton>
              <AtlasTextButton onClick={onSaveDraft} disabled={isSaving} className="px-4 py-2 text-[12px] text-white" style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}>{isSaving ? 'saving...' : 'save draft'}</AtlasTextButton>
              <AtlasTextButton onClick={onComplete} disabled={isSaving || !isSurveyComplete} className="px-4 py-2 text-[12px]" style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow, opacity: isSaving || !isSurveyComplete ? 0.45 : 1 } as React.CSSProperties}>{isSaving ? 'submitting...' : 'complete survey'}</AtlasTextButton>
            </div>
          </div>
        </div>
      </div>
      <small className="mt-4 block text-[12px] text-[#a9a9a9]">
        Hidden prompts are skipped when a section is marked not applicable. B-IPF prompts marked N/A are excluded from the official denominator.
      </small>
    </AtlasPanel>
  )
}

function ScorePreview({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <div className="rounded-[16px] border px-4 py-3" style={{ borderColor: '#ffffff20' }}>
      <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>{label}</small>
      <div className="mt-1 text-[24px] font-semibold text-white">{formatMetric(value)}</div>
      <small className="block text-[12px] text-[#cfcfcf]">{detail}</small>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="rounded-[12px] border px-3 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}>{message}</div>
}
