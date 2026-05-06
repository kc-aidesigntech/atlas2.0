import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  AtlasCloseButton,
  AtlasIconButton,
  AtlasInsetCard,
  AtlasPanel,
  AtlasPlusButton,
  AtlasStatusPill,
  AtlasTextButton
} from '@/features/atlas2026/components/AtlasPrimitives'
import {
  APPLICABILITY_NO,
  APPLICABILITY_YES,
  ASSESSMENT_DEFINITIONS,
  NOT_APPLICABLE_SENTINEL,
  computeAssessmentScoreSummary,
  flattenAssessmentPrompts,
  getAssessmentDefinition,
  isAssessmentPromptComplete,
  type AssessmentDefinition,
  type AssessmentPromptDefinition,
  type AssessmentSectionDefinition,
  type AssessmentStage
} from '@/features/atlas2026/singlepane/data/assessmentCatalog'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type {
  EnrolleeProfile,
  RegulationTestAnswer,
  RegulationTestSubmissionInput,
  RegulationTestSubmissionRecord,
  RegulationTestType
} from '@/features/atlas2026/singlepane/types'

interface RegulationTestsOverlayProps {
  isOpen: boolean
  enrollee: EnrolleeProfile | null
  isSaving: boolean
  saveError: string | null
  history: RegulationTestSubmissionRecord[]
  initialTestType?: RegulationTestType | null
  onClose: () => void
  onSave: (payload: RegulationTestSubmissionInput) => Promise<RegulationTestSubmissionRecord>
  onDeleteDraft: (submissionId: string) => Promise<void>
}

interface RenewalPromptEntry {
  section: AssessmentSectionDefinition
  prompt: AssessmentPromptDefinition
}

type PanelView = 'history' | 'survey'

const STAGE_ORDER: AssessmentStage[] = ['regulation', 'renewal']

function formatLabel(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function formatMetric(value: number | null) {
  if (typeof value !== 'number') return 'pending'
  return Number.isInteger(value) ? `${value}` : value.toFixed(2)
}

function buildInitialAnswers(testType: RegulationTestType, existing?: RegulationTestSubmissionRecord | null): RegulationTestAnswer[] {
  const definition = getAssessmentDefinition(testType)
  const prompts = definition ? flattenAssessmentPrompts(definition) : []
  const existingByPromptId = new Map((existing?.answers || []).map((answer) => [answer.promptId, answer]))
  return prompts.map((prompt) => {
    const existingAnswer = existingByPromptId.get(prompt.id)
    return {
      promptId: prompt.id,
      promptLabel: prompt.label,
      responseValue: existingAnswer?.responseValue ?? null
    }
  })
}

function getStageTests(stage: AssessmentStage) {
  return ASSESSMENT_DEFINITIONS.filter((definition) => definition.stage === stage)
}

function getVisibleRenewalEntries(
  definition: AssessmentDefinition,
  answersByPromptId: Map<string, RegulationTestAnswer>
): RenewalPromptEntry[] {
  // Applicability controls dynamic visibility; hidden prompts are intentionally excluded from completion gating.
  return definition.sections.flatMap((section) => {
    const applicabilityValue = section.applicabilityPromptId
      ? answersByPromptId.get(section.applicabilityPromptId)?.responseValue ?? null
      : APPLICABILITY_YES

    return section.prompts.flatMap((prompt) => {
      if (prompt.kind === 'applicability') {
        return [{ section, prompt }]
      }
      if (section.applicabilityPromptId && applicabilityValue !== APPLICABILITY_YES) {
        return []
      }
      return [{ section, prompt }]
    })
  })
}

function isRenewalDefinition(definition: AssessmentDefinition) {
  return definition.stage === 'renewal'
}

export default function RegulationTestsOverlay({
  isOpen,
  enrollee,
  isSaving,
  saveError,
  history,
  initialTestType = null,
  onClose,
  onSave,
  onDeleteDraft
}: RegulationTestsOverlayProps) {
  const defaultTestType = initialTestType || 'mh_sca'
  const [selectedTestType, setSelectedTestType] = React.useState<RegulationTestType>(defaultTestType)
  const [panelView, setPanelView] = React.useState<PanelView>('history')
  const [activeRecord, setActiveRecord] = React.useState<RegulationTestSubmissionRecord | null>(null)
  const [answers, setAnswers] = React.useState<RegulationTestAnswer[]>(buildInitialAnswers(defaultTestType))
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [currentPromptIndex, setCurrentPromptIndex] = React.useState(0)

  const definition = getAssessmentDefinition(selectedTestType) || ASSESSMENT_DEFINITIONS[0]
  const selectedStage = definition.stage
  const stageTests = getStageTests(selectedStage)
  const scopedHistory = history
    .filter((record) => record.testType === selectedTestType)
    .slice()
    .sort((left, right) => new Date(right.updatedAtIso).getTime() - new Date(left.updatedAtIso).getTime())
  const answersByPromptId = React.useMemo(
    () => new Map(answers.map((answer) => [answer.promptId, answer])),
    [answers]
  )
  const visibleRenewalEntries = React.useMemo(
    () => (isRenewalDefinition(definition) ? getVisibleRenewalEntries(definition, answersByPromptId) : []),
    [answersByPromptId, definition]
  )
  const scoreSummary = React.useMemo(
    () => computeAssessmentScoreSummary(selectedTestType, answers),
    [answers, selectedTestType]
  )

  React.useEffect(() => {
    if (!isOpen) return
    const nextTestType = initialTestType || selectedTestType
    setSelectedTestType(nextTestType)
    setPanelView('history')
    setActiveRecord(null)
    setAnswers(buildInitialAnswers(nextTestType))
    setValidationError(null)
    setCurrentPromptIndex(0)
  }, [initialTestType, isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    setPanelView('history')
    setActiveRecord(null)
    setAnswers(buildInitialAnswers(selectedTestType))
    setValidationError(null)
    setCurrentPromptIndex(0)
  }, [isOpen, selectedTestType])

  React.useEffect(() => {
    setCurrentPromptIndex((current) => {
      if (!visibleRenewalEntries.length) return 0
      return Math.max(0, Math.min(current, visibleRenewalEntries.length - 1))
    })
  }, [visibleRenewalEntries])

  if (!isOpen || !enrollee) return null

  function selectStage(stage: AssessmentStage) {
    const tests = getStageTests(stage)
    if (!tests.length) return
    setSelectedTestType(tests[0].type)
  }

  function updateAnswer(promptId: string, responseValue: number | null) {
    setAnswers((current) =>
      current.map((answer) => (answer.promptId === promptId ? { ...answer, responseValue } : answer))
    )
    setValidationError(null)
  }

  function checkoutNewRecord() {
    setActiveRecord(null)
    setAnswers(buildInitialAnswers(selectedTestType))
    setValidationError(null)
    setCurrentPromptIndex(0)
    setPanelView('survey')
  }

  function openDraftRecord(record: RegulationTestSubmissionRecord) {
    setActiveRecord(record)
    setAnswers(buildInitialAnswers(selectedTestType, record))
    setValidationError(null)
    setCurrentPromptIndex(0)
    setPanelView('survey')
  }

  function validateCompletedSubmission() {
    if (isRenewalDefinition(definition)) {
      const hasIncompleteVisiblePrompt = visibleRenewalEntries.some((entry) => {
        const currentAnswer = answersByPromptId.get(entry.prompt.id)
        return !isAssessmentPromptComplete(entry.prompt, currentAnswer?.responseValue)
      })
      if (hasIncompleteVisiblePrompt) {
        return 'Complete each visible prompt before finishing this renewal assessment.'
      }
      return null
    }

    const hasIncompleteAnswer = answers.some((answer) => typeof answer.responseValue !== 'number')
    if (hasIncompleteAnswer) {
      return 'Complete each placeholder item before completing this regulation test.'
    }
    return null
  }

  async function submit(status: 'draft' | 'completed') {
    if (!answers.length) return
    if (status === 'completed') {
      const nextValidationError = validateCompletedSubmission()
      if (nextValidationError) {
        setValidationError(nextValidationError)
        return
      }
    }

    setValidationError(null)
    const saved = await onSave({
      draftKey: activeRecord?.draftKey,
      enrolleeId: enrollee.id,
      enrollmentId: enrollee.enrollmentId || null,
      testType: selectedTestType,
      status,
      enrolleeName: enrollee.fullName,
      enrolleeCaseId: enrollee.caseId,
      enrolleeEmail: enrollee.email,
      answers
    })

    // Completed submissions always return to history to enforce read-only review flow for finalized records.
    if (status === 'completed' || saved.status === 'completed') {
      setPanelView('history')
      setActiveRecord(null)
      setAnswers(buildInitialAnswers(selectedTestType))
      setCurrentPromptIndex(0)
      return
    }

    setActiveRecord(saved)
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/70 px-5 py-6 backdrop-blur-[2px]">
      <div
        className="max-h-[calc(100vh-72px)] w-full max-w-[1220px] overflow-y-auto rounded-[30px] border px-5 py-5"
        style={{ borderColor: SP_COLORS.white, backgroundColor: '#030303' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
              navigator assessments
            </small>
            <h3 className="text-[28px] font-medium text-white">{enrollee.fullName}</h3>
            <small className="text-[13px] text-[#cfcfcf]">
              {enrollee.caseId} · {enrollee.email || 'no email on file'}
            </small>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {STAGE_ORDER.map((stage) => {
            const isActive = stage === selectedStage
            return (
              <AtlasTextButton
                key={stage}
                onClick={() => selectStage(stage)}
                className="px-4 py-1.5 text-[12px] uppercase tracking-[0.08em]"
                style={{
                  ['--button-border-color' as const]: isActive ? SP_COLORS.yellow : '#ffffff36',
                  color: isActive ? SP_COLORS.yellow : SP_COLORS.white
                } as React.CSSProperties}
              >
                {stage}
              </AtlasTextButton>
            )
          })}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {stageTests.map((stageTest) => {
            const isActive = stageTest.type === selectedTestType
            return (
              <AtlasTextButton
                key={stageTest.type}
                onClick={() => setSelectedTestType(stageTest.type)}
                className="px-4 py-2 text-[12px]"
                style={{
                  ['--button-border-color' as const]: isActive ? SP_COLORS.yellow : '#ffffff36',
                  color: isActive ? SP_COLORS.yellow : SP_COLORS.white
                } as React.CSSProperties}
              >
                {stageTest.label}
              </AtlasTextButton>
            )
          })}
        </div>

        {panelView === 'history' ? (
          <AtlasPanel
            kicker={definition.label}
            title="Record management"
            description={`${definition.passThresholdLabel}. Drafts are editable; completed records are read-only.`}
            className="rounded-[22px] bg-[#070707]"
            actions={<AtlasPlusButton onClick={checkoutNewRecord} label={`new ${definition.shortLabel} survey`} />}
          >
            <div className="space-y-3">
              <AtlasInsetCard className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-4">
                <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>
                  scoring model
                </small>
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  <small className="text-[12px] text-[#d4d4d4]">{definition.passScoreLabel} drives ATLAS pass/fail.</small>
                  <small className="text-[12px] text-[#d4d4d4]">
                    {definition.officialScoreLabel
                      ? `${definition.officialScoreLabel} is preserved separately for the PTSD standard.`
                      : 'This instrument currently uses the internal ATLAS threshold only.'}
                  </small>
                </div>
              </AtlasInsetCard>
              {scopedHistory.length ? (
                scopedHistory.map((record) => {
                  const derivedSummary = computeAssessmentScoreSummary(record.testType, record.answers)
                  const displayedGateScore = typeof record.score === 'number' ? record.score : derivedSummary.gateScore
                  return (
                    <AtlasInsetCard key={record.id} className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
                            {formatLabel(record.updatedAtIso)}
                          </small>
                          <small className="mt-1 block text-[13px] text-white">
                            {derivedSummary.gateScoreLabel}: {formatMetric(displayedGateScore)} / threshold {record.passThreshold}
                          </small>
                          {derivedSummary.officialScoreLabel ? (
                            <small className="block text-[12px] text-[#cfcfcf]">
                              {derivedSummary.officialScoreLabel}: {formatMetric(derivedSummary.officialScore)}
                            </small>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {record.status === 'draft' ? (
                            <>
                              <AtlasIconButton
                                onClick={() => openDraftRecord(record)}
                                className="h-9 w-9 text-white"
                                style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </AtlasIconButton>
                              <AtlasIconButton
                                onClick={() => onDeleteDraft(record.id)}
                                className="h-9 w-9 text-white"
                                style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </AtlasIconButton>
                            </>
                          ) : null}
                          <AtlasStatusPill color={record.status === 'completed' ? SP_COLORS.deepGreen : SP_COLORS.yellow}>
                            {record.status}
                          </AtlasStatusPill>
                          {record.passed !== null ? (
                            <AtlasStatusPill color={record.passed ? SP_COLORS.deepGreen : SP_COLORS.red}>
                              {record.passed ? 'pass' : 'fail'}
                            </AtlasStatusPill>
                          ) : null}
                        </div>
                      </div>
                    </AtlasInsetCard>
                  )
                })
              ) : (
                <AtlasInsetCard className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-4">
                  <small className="text-[13px] text-[#cfcfcf]">No {definition.label} records for this enrollee yet.</small>
                </AtlasInsetCard>
              )}
            </div>
          </AtlasPanel>
        ) : isRenewalDefinition(definition) ? (
          <RenewalAssessmentSurvey
            definition={definition}
            visibleEntries={visibleRenewalEntries}
            answersByPromptId={answersByPromptId}
            scoreSummary={scoreSummary}
            isSaving={isSaving}
            saveError={saveError}
            validationError={validationError}
            currentPromptIndex={currentPromptIndex}
            onCurrentPromptIndexChange={setCurrentPromptIndex}
            onAnswerChange={updateAnswer}
            onBackToRecords={() => setPanelView('history')}
            onCheckoutNewRecord={checkoutNewRecord}
            onSaveDraft={() => submit('draft')}
            onComplete={() => submit('completed')}
          />
        ) : (
          <AtlasPanel
            kicker={definition.label}
            title="Survey draft"
            description={`${definition.passThresholdLabel}. Placeholder questions will be replaced when you provide the full instruments.`}
            className="rounded-[22px] bg-[#070707]"
            actions={<AtlasPlusButton onClick={checkoutNewRecord} label={`new ${definition.shortLabel} survey`} />}
          >
            <div className="space-y-3">
              {flattenAssessmentPrompts(definition).map((prompt, index) => (
                <AtlasInsetCard key={prompt.id} className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-3">
                  <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
                    item {index + 1}
                  </small>
                  <div className="mt-1 text-[14px] text-white">{prompt.label}</div>
                  <small className="block text-[12px] text-[#cfcfcf]">{prompt.description}</small>
                  <input
                    type="number"
                    value={answersByPromptId.get(prompt.id)?.responseValue ?? ''}
                    onChange={(event) => {
                      const nextValue = event.target.value.trim()
                      const parsed = nextValue === '' ? null : Number(nextValue)
                      updateAnswer(prompt.id, typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null)
                    }}
                    className="mt-3 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
                    style={{ borderColor: '#ffffff2f' }}
                    placeholder={selectedTestType === 'mh_sca' ? 'Enter MH-SCA placeholder value' : 'Enter SVS placeholder value (%)'}
                  />
                </AtlasInsetCard>
              ))}
              {validationError ? (
                <div
                  className="rounded-[12px] border px-3 py-2 text-[12px]"
                  style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}
                >
                  {validationError}
                </div>
              ) : null}
              {saveError ? (
                <div
                  className="rounded-[12px] border px-3 py-2 text-[12px]"
                  style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}
                >
                  {saveError}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <AtlasTextButton
                  onClick={() => setPanelView('history')}
                  className="px-4 py-2 text-[12px] text-white"
                  style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}
                >
                  back to records
                </AtlasTextButton>
                <div className="flex items-center gap-2">
                  <AtlasTextButton
                    onClick={() => submit('draft')}
                    disabled={isSaving}
                    className="px-4 py-2 text-[12px] text-white"
                    style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}
                  >
                    {isSaving ? 'saving...' : 'save draft'}
                  </AtlasTextButton>
                  <AtlasTextButton
                    onClick={() => submit('completed')}
                    disabled={isSaving}
                    className="px-4 py-2 text-[12px]"
                    style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                  >
                    {isSaving ? 'submitting...' : 'complete survey'}
                  </AtlasTextButton>
                </div>
              </div>
            </div>
          </AtlasPanel>
        )}
      </div>
    </div>
  )
}

function RenewalAssessmentSurvey({
  definition,
  visibleEntries,
  answersByPromptId,
  scoreSummary,
  isSaving,
  saveError,
  validationError,
  currentPromptIndex,
  onCurrentPromptIndexChange,
  onAnswerChange,
  onBackToRecords,
  onCheckoutNewRecord,
  onSaveDraft,
  onComplete
}: {
  definition: AssessmentDefinition
  visibleEntries: RenewalPromptEntry[]
  answersByPromptId: Map<string, RegulationTestAnswer>
  scoreSummary: ReturnType<typeof computeAssessmentScoreSummary>
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
}) {
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
      // Applicability cards act as branch points: they decide whether later prompts in the section are shown at all.
      return (
        <AtlasInsetCard className="rounded-[20px] border-white/20 bg-[#0a0a0a] px-5 py-5">
          <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
            applicability check
          </small>
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
          <small className="mt-4 block text-[12px] text-[#bdbdbd]">
            {section.description}
          </small>
        </AtlasInsetCard>
      )
    }

    const selectedScaleOption = definition.answerScale.find((option) => option.value === currentValue) || null
    const isMarkedNotApplicable = prompt.allowsNotApplicable && currentValue === NOT_APPLICABLE_SENTINEL

    return (
      <AtlasInsetCard className="rounded-[20px] border-white/20 bg-[#0a0a0a] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
              {section.title}
            </small>
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
              onClick={() =>
                onAnswerChange(prompt.id, isMarkedNotApplicable ? null : NOT_APPLICABLE_SENTINEL)
              }
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
                <small className="mt-1 block text-[11px] text-[#cfcfcf]">
                  {option.label}
                </small>
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
            <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>
              scoring rules
            </small>
            <div className="mt-3 space-y-2">
              {definition.officialRules.map((rule) => (
                <small key={rule} className="block text-[12px] leading-snug text-[#d4d4d4]">
                  {rule}
                </small>
              ))}
            </div>
          </AtlasInsetCard>

          <AtlasInsetCard className="rounded-[18px] border-white/20 bg-[#0a0a0a] px-4 py-4">
            <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>
              score preview
            </small>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-[16px] border px-4 py-3" style={{ borderColor: '#ffffff20' }}>
                <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>
                  {scoreSummary.gateScoreLabel}
                </small>
                <div className="mt-1 text-[24px] font-semibold text-white">{formatMetric(scoreSummary.gateScore)}</div>
                <small className="block text-[12px] text-[#cfcfcf]">Threshold {definition.passThreshold}</small>
              </div>
              <div className="rounded-[16px] border px-4 py-3" style={{ borderColor: '#ffffff20' }}>
                <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>
                  {scoreSummary.officialScoreLabel || 'Official score'}
                </small>
                <div className="mt-1 text-[24px] font-semibold text-white">{formatMetric(scoreSummary.officialScore)}</div>
                <small className="block text-[12px] text-[#cfcfcf]">Higher official scores mean greater impairment.</small>
              </div>
            </div>
          </AtlasInsetCard>

          {scoreSummary.detailMetrics.length ? (
            <AtlasInsetCard className="rounded-[18px] border-white/20 bg-[#0a0a0a] px-4 py-4">
              <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>
                section detail
              </small>
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
                <small className="block text-[11px] uppercase tracking-[0.08em]" style={{ color: SP_COLORS.muted }}>
                  survey progress
                </small>
                <div className="mt-1 text-[14px] text-white">
                  {Math.min(currentPromptIndex + 1, visibleEntries.length || 1)} of {visibleEntries.length} visible prompts
                </div>
              </div>
              <small className="text-[12px] text-[#cfcfcf]">{completedCount} completed</small>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${visibleEntries.length ? (completedCount / visibleEntries.length) * 100 : 0}%`,
                  backgroundColor: SP_COLORS.yellow
                }}
              />
            </div>
          </AtlasInsetCard>

          {currentEntry ? renderPromptCard(currentEntry) : null}

          {validationError ? (
            <div
              className="rounded-[12px] border px-3 py-2 text-[12px]"
              style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}
            >
              {validationError}
            </div>
          ) : null}
          {saveError ? (
            <div
              className="rounded-[12px] border px-3 py-2 text-[12px]"
              style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}
            >
              {saveError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <AtlasTextButton
              onClick={onBackToRecords}
              className="px-4 py-2 text-[12px] text-white"
              style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}
            >
              back to records
            </AtlasTextButton>
            <div className="flex flex-wrap items-center gap-2">
              <AtlasTextButton
                onClick={() => onCurrentPromptIndexChange(Math.max(0, currentPromptIndex - 1))}
                disabled={currentPromptIndex === 0}
                className="px-4 py-2 text-[12px] text-white"
                style={{ ['--button-border-color' as const]: '#ffffff40', opacity: currentPromptIndex === 0 ? 0.4 : 1 } as React.CSSProperties}
              >
                previous
              </AtlasTextButton>
              <AtlasTextButton
                onClick={() => onCurrentPromptIndexChange(Math.min(visibleEntries.length - 1, currentPromptIndex + 1))}
                disabled={!currentEntry || !isAssessmentPromptComplete(currentEntry.prompt, currentAnswer?.responseValue) || currentPromptIndex >= visibleEntries.length - 1}
                className="px-4 py-2 text-[12px]"
                style={{
                  ['--button-border-color' as const]: SP_COLORS.yellow,
                  color: SP_COLORS.yellow,
                  opacity:
                    !currentEntry ||
                    !isAssessmentPromptComplete(currentEntry.prompt, currentAnswer?.responseValue) ||
                    currentPromptIndex >= visibleEntries.length - 1
                      ? 0.45
                      : 1
                } as React.CSSProperties}
              >
                next
              </AtlasTextButton>
              <AtlasTextButton
                onClick={onSaveDraft}
                disabled={isSaving}
                className="px-4 py-2 text-[12px] text-white"
                style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}
              >
                {isSaving ? 'saving...' : 'save draft'}
              </AtlasTextButton>
              <AtlasTextButton
                onClick={onComplete}
                disabled={isSaving || !isSurveyComplete}
                className="px-4 py-2 text-[12px]"
                style={{
                  ['--button-border-color' as const]: SP_COLORS.yellow,
                  color: SP_COLORS.yellow,
                  opacity: isSaving || !isSurveyComplete ? 0.45 : 1
                } as React.CSSProperties}
              >
                {isSaving ? 'submitting...' : 'complete survey'}
              </AtlasTextButton>
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
