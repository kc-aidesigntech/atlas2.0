import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { AtlasCloseButton, AtlasIconButton, AtlasInsetCard, AtlasPanel, AtlasPlusButton, AtlasStatusPill, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type {
  EnrolleeProfile,
  RegulationTestAnswer,
  RegulationTestPrompt,
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
  onClose: () => void
  onSave: (payload: RegulationTestSubmissionInput) => Promise<RegulationTestSubmissionRecord>
  onDeleteDraft: (submissionId: string) => Promise<void>
}

type PanelView = 'history' | 'survey'

const TEST_DEFS: Array<{ type: RegulationTestType; label: string; thresholdLabel: string; prompts: RegulationTestPrompt[] }> = [
  {
    type: 'mh_sca',
    label: 'MH-SCA',
    thresholdLabel: 'Pass threshold: 126+',
    prompts: [
      { id: 'mhsca-1', label: 'Emotional regulation baseline', description: 'Placeholder item until full instrument is supplied.' },
      { id: 'mhsca-2', label: 'Behavioral stability baseline', description: 'Placeholder item until full instrument is supplied.' },
      { id: 'mhsca-3', label: 'Social coping baseline', description: 'Placeholder item until full instrument is supplied.' }
    ]
  },
  {
    type: 'svs',
    label: 'Stress Vulnerability Scale (SVS)',
    thresholdLabel: 'Pass threshold: 60%+',
    prompts: [
      { id: 'svs-1', label: 'Current stress load', description: 'Placeholder item until full instrument is supplied.' },
      { id: 'svs-2', label: 'Protective supports', description: 'Placeholder item until full instrument is supplied.' },
      { id: 'svs-3', label: 'Recent vulnerability events', description: 'Placeholder item until full instrument is supplied.' }
    ]
  }
]

function formatLabel(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function buildInitialAnswers(testType: RegulationTestType, existing?: RegulationTestSubmissionRecord | null): RegulationTestAnswer[] {
  const prompts = TEST_DEFS.find((item) => item.type === testType)?.prompts || []
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

export default function RegulationTestsOverlay({
  isOpen,
  enrollee,
  isSaving,
  saveError,
  history,
  onClose,
  onSave,
  onDeleteDraft
}: RegulationTestsOverlayProps) {
  const [selectedTestType, setSelectedTestType] = React.useState<RegulationTestType>('mh_sca')
  const [panelView, setPanelView] = React.useState<PanelView>('history')
  const [activeRecord, setActiveRecord] = React.useState<RegulationTestSubmissionRecord | null>(null)
  const [answers, setAnswers] = React.useState<RegulationTestAnswer[]>(buildInitialAnswers('mh_sca'))
  const [validationError, setValidationError] = React.useState<string | null>(null)

  const testDef = TEST_DEFS.find((item) => item.type === selectedTestType) || TEST_DEFS[0]
  const scopedHistory = history
    .filter((record) => record.testType === selectedTestType)
    .slice()
    .sort((left, right) => new Date(right.updatedAtIso).getTime() - new Date(left.updatedAtIso).getTime())

  React.useEffect(() => {
    if (!isOpen) return
    setPanelView('history')
    setActiveRecord(null)
    setAnswers(buildInitialAnswers(selectedTestType))
    setValidationError(null)
  }, [isOpen, selectedTestType])

  if (!isOpen || !enrollee) return null

  function checkoutNewRecord() {
    setActiveRecord(null)
    setAnswers(buildInitialAnswers(selectedTestType))
    setValidationError(null)
    setPanelView('survey')
  }

  function openDraftRecord(record: RegulationTestSubmissionRecord) {
    setActiveRecord(record)
    setAnswers(buildInitialAnswers(selectedTestType, record))
    setValidationError(null)
    setPanelView('survey')
  }

  async function submit(status: 'draft' | 'completed') {
    if (!answers.length) return
    if (status === 'completed' && answers.some((answer) => typeof answer.responseValue !== 'number')) {
      setValidationError('Complete each placeholder item before completing this regulation test.')
      return
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
    if (status === 'completed' || saved.status === 'completed') {
      setPanelView('history')
      setActiveRecord(null)
      return
    }
    setActiveRecord(saved)
  }

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-black/70 px-5 py-6 backdrop-blur-[2px]">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-[1180px] overflow-y-auto rounded-[30px] border px-5 py-5" style={{ borderColor: SP_COLORS.white, backgroundColor: '#030303' }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
              regulation tests
            </small>
            <h3 className="text-[28px] font-medium text-white">{enrollee.fullName}</h3>
            <small className="text-[13px] text-[#cfcfcf]">{enrollee.caseId} · {enrollee.email || 'no email on file'}</small>
          </div>
          <AtlasCloseButton
            onClick={onClose}
            className="h-9 w-9"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {TEST_DEFS.map((def) => {
            const isActive = def.type === selectedTestType
            return (
              <AtlasTextButton
                key={def.type}
                onClick={() => setSelectedTestType(def.type)}
                className="px-4 py-2 text-[12px]"
                style={{ ['--button-border-color' as const]: isActive ? SP_COLORS.yellow : '#ffffff36', color: isActive ? SP_COLORS.yellow : SP_COLORS.white } as React.CSSProperties}
              >
                {def.label}
              </AtlasTextButton>
            )
          })}
        </div>

        {panelView === 'history' ? (
          <AtlasPanel
            kicker={testDef.label}
            title="Record management"
            description={`${testDef.thresholdLabel}. Drafts are editable; completed records are read-only.`}
            className="rounded-[22px] bg-[#070707]"
            actions={<AtlasPlusButton onClick={checkoutNewRecord} label={`new ${testDef.label} survey`} />}
          >
            <div className="space-y-3">
              {scopedHistory.length ? (
                scopedHistory.map((record) => (
                  <AtlasInsetCard key={record.id} className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
                          {formatLabel(record.updatedAtIso)}
                        </small>
                        <small className="block text-[13px] text-white">
                          score: {typeof record.score === 'number' ? record.score : 'pending'} / threshold {record.passThreshold}
                        </small>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.status === 'draft' ? (
                          <>
                            <AtlasIconButton
                              onClick={() => openDraftRecord(record)}
                              className="h-7 w-7 text-white"
                              style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </AtlasIconButton>
                            <AtlasIconButton
                              onClick={() => onDeleteDraft(record.id)}
                              className="h-7 w-7 text-white"
                              style={{ ['--button-border-color' as const]: '#ffffff40' } as React.CSSProperties}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </AtlasIconButton>
                          </>
                        ) : null}
                        <AtlasStatusPill color={record.status === 'completed' ? SP_COLORS.deepGreen : SP_COLORS.yellow}>{record.status}</AtlasStatusPill>
                        {record.passed !== null ? (
                          <AtlasStatusPill color={record.passed ? SP_COLORS.deepGreen : SP_COLORS.red}>{record.passed ? 'pass' : 'fail'}</AtlasStatusPill>
                        ) : null}
                      </div>
                    </div>
                  </AtlasInsetCard>
                ))
              ) : (
                <AtlasInsetCard className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-4">
                  <small className="text-[13px] text-[#cfcfcf]">No {testDef.label} records for this enrollee yet.</small>
                </AtlasInsetCard>
              )}
            </div>
          </AtlasPanel>
        ) : (
          <AtlasPanel
            kicker={testDef.label}
            title="Survey draft"
            description={`${testDef.thresholdLabel}. Placeholder questions will be replaced when you provide the full instruments.`}
            className="rounded-[22px] bg-[#070707]"
            actions={<AtlasPlusButton onClick={checkoutNewRecord} label={`new ${testDef.label} survey`} />}
          >
            <div className="space-y-3">
              {testDef.prompts.map((prompt, index) => (
                <AtlasInsetCard key={prompt.id} className="rounded-[16px] border-white/20 bg-[#0a0a0a] px-4 py-3">
                  <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>item {index + 1}</small>
                  <div className="mt-1 text-[14px] text-white">{prompt.label}</div>
                  <small className="block text-[12px] text-[#cfcfcf]">{prompt.description}</small>
                  <input
                    type="number"
                    value={answers[index]?.responseValue ?? ''}
                    onChange={(event) => {
                      const nextValue = event.target.value.trim()
                      const parsed = nextValue === '' ? null : Number(nextValue)
                      setAnswers((current) =>
                        current.map((answer) => (answer.promptId === prompt.id ? { ...answer, responseValue: Number.isFinite(parsed as number) ? parsed : null } : answer))
                      )
                    }}
                    className="mt-3 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
                    style={{ borderColor: '#ffffff2f' }}
                    placeholder={selectedTestType === 'mh_sca' ? 'Enter MH-SCA placeholder value' : 'Enter SVS placeholder value (%)'}
                  />
                </AtlasInsetCard>
              ))}
              {validationError ? (
                <div className="rounded-[12px] border px-3 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}>
                  {validationError}
                </div>
              ) : null}
              {saveError ? (
                <div className="rounded-[12px] border px-3 py-2 text-[12px]" style={{ borderColor: `${SP_COLORS.red}90`, color: SP_COLORS.red }}>
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
