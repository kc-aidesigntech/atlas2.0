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
  APPLICABILITY_YES,
  ASSESSMENT_DEFINITIONS,
  computeAssessmentScoreSummary,
  flattenAssessmentPrompts,
  getAssessmentDefinition,
  isAssessmentPromptComplete,
  type AssessmentDefinition,
  type AssessmentPromptDefinition,
  type AssessmentSectionDefinition,
  type AssessmentStage
} from '@/features/atlas2026/singlepane/data/assessmentCatalog'
import RenewalAssessmentSurvey from '@/features/atlas2026/singlepane/components/regulationTestsOverlay/RenewalAssessmentSurvey'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  EnrolleeProfile,
  RegulationTestAnswer,
  RegulationTestSubmissionInput,
  RegulationTestSubmissionRecord,
  RegulationTestType
} from '@/features/atlas2026/shared/contracts'

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

export interface RenewalPromptEntry {
  section: AssessmentSectionDefinition
  prompt: AssessmentPromptDefinition
}

type PanelView = 'history' | 'survey'
const STAGE_ORDER: AssessmentStage[] = ['regulation', 'renewal']
const getStageTests = (stage: AssessmentStage) => ASSESSMENT_DEFINITIONS.filter((item) => item.stage === stage)
const isRenewalDefinition = (definition: AssessmentDefinition) => definition.stage === 'renewal'

function buildInitialAnswers(testType: RegulationTestType, existing?: RegulationTestSubmissionRecord | null) {
  const definition = getAssessmentDefinition(testType)
  const existingByPromptId = new Map((existing?.answers || []).map((answer) => [answer.promptId, answer]))
  return (definition ? flattenAssessmentPrompts(definition) : []).map((prompt) => ({
    promptId: prompt.id,
    promptLabel: prompt.label,
    responseValue: existingByPromptId.get(prompt.id)?.responseValue ?? null
  }))
}

function getVisibleRenewalEntries(
  definition: AssessmentDefinition,
  answersByPromptId: Map<string, RegulationTestAnswer>
): RenewalPromptEntry[] {
  // Hidden branch prompts do not participate in completion gating.
  return definition.sections.flatMap((section) => {
    const applicability = section.applicabilityPromptId
      ? answersByPromptId.get(section.applicabilityPromptId)?.responseValue ?? null
      : APPLICABILITY_YES
    return section.prompts.flatMap((prompt) =>
      prompt.kind === 'applicability' || !section.applicabilityPromptId || applicability === APPLICABILITY_YES
        ? [{ section, prompt }]
        : []
    )
  })
}

export default function RegulationTestsOverlay(props: RegulationTestsOverlayProps) {
  const { isOpen, enrollee, isSaving, saveError, history, initialTestType = null, onClose, onSave, onDeleteDraft } = props
  const defaultTestType = initialTestType || 'mh_sca'
  const [selectedTestType, setSelectedTestType] = React.useState<RegulationTestType>(defaultTestType)
  const [panelView, setPanelView] = React.useState<PanelView>('history')
  const [activeRecord, setActiveRecord] = React.useState<RegulationTestSubmissionRecord | null>(null)
  const [answers, setAnswers] = React.useState<RegulationTestAnswer[]>(buildInitialAnswers(defaultTestType))
  const [validationError, setValidationError] = React.useState<string | null>(null)
  const [currentPromptIndex, setCurrentPromptIndex] = React.useState(0)
  const definition = getAssessmentDefinition(selectedTestType) || ASSESSMENT_DEFINITIONS[0]
  const stageTests = getStageTests(definition.stage)
  const scopedHistory = history
    .filter((record) => record.testType === selectedTestType)
    .slice()
    .sort((left, right) => new Date(right.updatedAtIso).getTime() - new Date(left.updatedAtIso).getTime())
  const answersByPromptId = React.useMemo(() => new Map(answers.map((answer) => [answer.promptId, answer])), [answers])
  const visibleRenewalEntries = React.useMemo(
    () => isRenewalDefinition(definition) ? getVisibleRenewalEntries(definition, answersByPromptId) : [],
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
    resetEditor(nextTestType)
  }, [initialTestType, isOpen])

  React.useEffect(() => {
    if (isOpen) resetEditor(selectedTestType)
  }, [isOpen, selectedTestType])

  React.useEffect(() => {
    setCurrentPromptIndex((current) =>
      visibleRenewalEntries.length ? Math.max(0, Math.min(current, visibleRenewalEntries.length - 1)) : 0
    )
  }, [visibleRenewalEntries])

  if (!isOpen || !enrollee) return null

  function resetEditor(testType: RegulationTestType) {
    setPanelView('history')
    setActiveRecord(null)
    setAnswers(buildInitialAnswers(testType))
    setValidationError(null)
    setCurrentPromptIndex(0)
  }

  function checkoutRecord(record: RegulationTestSubmissionRecord | null = null) {
    setActiveRecord(record)
    setAnswers(buildInitialAnswers(selectedTestType, record))
    setValidationError(null)
    setCurrentPromptIndex(0)
    setPanelView('survey')
  }

  function updateAnswer(promptId: string, responseValue: number | null) {
    setAnswers((current) => current.map((answer) => answer.promptId === promptId ? { ...answer, responseValue } : answer))
    setValidationError(null)
  }

  async function submit(status: 'draft' | 'completed') {
    if (!answers.length) return
    if (status === 'completed') {
      const incomplete = isRenewalDefinition(definition)
        ? visibleRenewalEntries.some(({ prompt }) => !isAssessmentPromptComplete(prompt, answersByPromptId.get(prompt.id)?.responseValue))
        : answers.some((answer) => typeof answer.responseValue !== 'number')
      if (incomplete) {
        setValidationError(isRenewalDefinition(definition)
          ? 'Complete each visible prompt before finishing this renewal assessment.'
          : 'Complete each placeholder item before completing this regulation test.')
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
    if (status === 'completed' || saved.status === 'completed') resetEditor(selectedTestType)
    else setActiveRecord(saved)
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/70 px-5 py-6 backdrop-blur-[2px]">
      <div className="atlas-surface-shell max-h-[calc(100vh-72px)] w-full max-w-[1220px] overflow-y-auto px-5 py-5" style={{ borderColor: SP_COLORS.white, backgroundColor: '#030303' }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>navigator assessments</small>
            <h3 className="atlas-h3 text-[28px] font-medium text-white">{enrollee.fullName}</h3>
            <small className="atlas-meta text-[#cfcfcf]">{enrollee.caseId} · {enrollee.email || 'no email on file'}</small>
          </div>
          <AtlasCloseButton onClick={onClose} style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties} />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {STAGE_ORDER.map((stage) => (
            <ChoiceButton key={stage} active={stage === definition.stage} onClick={() => {
              const tests = getStageTests(stage)
              if (tests[0]) setSelectedTestType(tests[0].type)
            }}>{stage}</ChoiceButton>
          ))}
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {stageTests.map((test) => <ChoiceButton key={test.type} active={test.type === selectedTestType} onClick={() => setSelectedTestType(test.type)}>{test.label}</ChoiceButton>)}
        </div>
        {panelView === 'history' ? (
          <HistoryPanel definition={definition} records={scopedHistory} onNew={() => checkoutRecord()} onEdit={checkoutRecord} onDelete={onDeleteDraft} />
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
            onCheckoutNewRecord={() => checkoutRecord()}
            onSaveDraft={() => submit('draft')}
            onComplete={() => submit('completed')}
          />
        ) : (
          <BasicSurvey
            definition={definition}
            testType={selectedTestType}
            answersByPromptId={answersByPromptId}
            isSaving={isSaving}
            saveError={saveError}
            validationError={validationError}
            onAnswerChange={updateAnswer}
            onBack={() => setPanelView('history')}
            onNew={() => checkoutRecord()}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  )
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <AtlasTextButton
      onClick={onClick}
      className="px-4 py-2 text-[12px]"
      style={{ ['--button-border-color' as const]: active ? SP_COLORS.yellow : '#ffffff36', color: active ? SP_COLORS.yellow : SP_COLORS.white } as React.CSSProperties}
    >{children}</AtlasTextButton>
  )
}

function HistoryPanel({ definition, records, onNew, onEdit, onDelete }: {
  definition: AssessmentDefinition
  records: RegulationTestSubmissionRecord[]
  onNew: () => void
  onEdit: (record: RegulationTestSubmissionRecord) => void
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <AtlasPanel kicker={definition.label} title="Record management" description={`${definition.passThresholdLabel}. Drafts are editable; completed records are read-only.`} className="rounded-[22px] bg-[#070707]" actions={<AtlasPlusButton onClick={onNew} label={`new ${definition.shortLabel} survey`} />}>
      <AtlasInsetCard className="mb-3 rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-4">
        <small className="text-[12px] text-[#d4d4d4]">{definition.passScoreLabel} drives ATLAS pass/fail. {definition.officialScoreLabel ? `${definition.officialScoreLabel} is preserved separately for the PTSD standard.` : 'This instrument currently uses the internal ATLAS threshold only.'}</small>
      </AtlasInsetCard>
      <div className="space-y-3">
        {records.length ? records.map((record) => {
          const summary = computeAssessmentScoreSummary(record.testType, record.answers)
          const score = typeof record.score === 'number' ? record.score : summary.gateScore
          return (
            <AtlasInsetCard key={record.id} className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>{new Date(record.updatedAtIso).toLocaleString()}</small>
                  <small className="mt-1 block text-[13px] text-white">{summary.gateScoreLabel}: {score ?? 'pending'} / threshold {record.passThreshold}</small>
                </div>
                <div className="flex items-center gap-2">
                  {record.status === 'draft' ? <>
                    <AtlasIconButton onClick={() => onEdit(record)} className="h-9 w-9 text-white"><Pencil className="h-3.5 w-3.5" /></AtlasIconButton>
                    <AtlasIconButton onClick={() => onDelete(record.id)} className="h-9 w-9 text-white"><Trash2 className="h-3.5 w-3.5" /></AtlasIconButton>
                  </> : null}
                  <AtlasStatusPill color={record.status === 'completed' ? SP_COLORS.deepGreen : SP_COLORS.yellow}>{record.status}</AtlasStatusPill>
                  {record.passed !== null ? <AtlasStatusPill color={record.passed ? SP_COLORS.deepGreen : SP_COLORS.red}>{record.passed ? 'pass' : 'fail'}</AtlasStatusPill> : null}
                </div>
              </div>
            </AtlasInsetCard>
          )
        }) : <AtlasInsetCard className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-4"><small className="text-[13px] text-[#cfcfcf]">No {definition.label} records for this enrollee yet.</small></AtlasInsetCard>}
      </div>
    </AtlasPanel>
  )
}

function BasicSurvey({ definition, testType, answersByPromptId, isSaving, saveError, validationError, onAnswerChange, onBack, onNew, onSubmit }: {
  definition: AssessmentDefinition
  testType: RegulationTestType
  answersByPromptId: Map<string, RegulationTestAnswer>
  isSaving: boolean
  saveError: string | null
  validationError: string | null
  onAnswerChange: (id: string, value: number | null) => void
  onBack: () => void
  onNew: () => void
  onSubmit: (status: 'draft' | 'completed') => Promise<void>
}) {
  return (
    <AtlasPanel kicker={definition.label} title="Survey draft" description={`${definition.passThresholdLabel}. Placeholder questions will be replaced when you provide the full instruments.`} className="rounded-[22px] bg-[#070707]" actions={<AtlasPlusButton onClick={onNew} label={`new ${definition.shortLabel} survey`} />}>
      <div className="space-y-3">
        {flattenAssessmentPrompts(definition).map((prompt, index) => (
          <AtlasInsetCard key={prompt.id} className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-3">
            <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>item {index + 1}</small>
            <div className="mt-1 text-[14px] text-white">{prompt.label}</div>
            <small className="block text-[12px] text-[#cfcfcf]">{prompt.description}</small>
            <input type="number" value={answersByPromptId.get(prompt.id)?.responseValue ?? ''} onChange={(event) => {
              const parsed = event.target.value.trim() === '' ? null : Number(event.target.value)
              onAnswerChange(prompt.id, typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null)
            }} className="atlas-input mt-3 bg-black text-[13px] text-white" placeholder={testType === 'mh_sca' ? 'Enter MH-SCA placeholder value' : 'Enter SVS placeholder value (%)'} />
          </AtlasInsetCard>
        ))}
        {[validationError, saveError].filter(Boolean).map((message) => <div key={message} className="rounded-[12px] border px-3 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}>{message}</div>)}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <AtlasTextButton onClick={onBack} className="px-4 py-2 text-[12px] text-white">back to records</AtlasTextButton>
          <div className="flex items-center gap-2">
            <AtlasTextButton onClick={() => onSubmit('draft')} disabled={isSaving} className="px-4 py-2 text-[12px] text-white">{isSaving ? 'saving...' : 'save draft'}</AtlasTextButton>
            <AtlasTextButton onClick={() => onSubmit('completed')} disabled={isSaving} className="px-4 py-2 text-[12px]" style={{ color: SP_COLORS.yellow }}>{isSaving ? 'submitting...' : 'complete survey'}</AtlasTextButton>
          </div>
        </div>
      </div>
    </AtlasPanel>
  )
}
