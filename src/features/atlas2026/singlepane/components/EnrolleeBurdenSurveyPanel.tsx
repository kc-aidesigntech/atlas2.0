import React from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import { AtlasTextButton } from '../../components/AtlasPrimitives'
import {
  buildDefaultPartnerServiceCapacityAnswers,
  DEFAULT_SERVICE_CAPACITY_SCALE,
  DEFAULT_SERVICE_CAPACITY_SECTIONS,
  SERVICE_CAPACITY_FORM_VERSION,
  flattenSurveyPrompts
} from '../data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '../theme'
import {
  BurdenCard,
  SurveyProgressHeader,
  type SurveySectionProgressItem
} from './serviceCapacitySurvey/SurveyChrome'
import type {
  EnrolleeBurdenSurveyAnswer,
  EnrolleeBurdenSurveyRespondentRole,
  EnrolleeBurdenSurveySubmissionInput,
  EnrolleeBurdenSurveySubmissionRecord,
  EnrolleeProfile
} from '../types'

interface EnrolleeBurdenSurveyPanelProps {
  enrollee: EnrolleeProfile
  respondentName: string
  respondentRole: EnrolleeBurdenSurveyRespondentRole
  respondentPersonId?: string | null
  organizationName?: string
  canEdit: boolean
  submissionHistory: EnrolleeBurdenSurveySubmissionRecord[]
  isSaving: boolean
  saveError: string | null
  onSubmit: (payload: EnrolleeBurdenSurveySubmissionInput) => Promise<EnrolleeBurdenSurveySubmissionRecord | void> | EnrolleeBurdenSurveySubmissionRecord | void
  onDeleteDraft: (submissionId: string, enrollmentId: string) => Promise<unknown> | unknown
}

type PanelMode = 'history' | 'survey'

const SURVEY_SECTIONS = DEFAULT_SERVICE_CAPACITY_SECTIONS
const SURVEY_PROMPTS = flattenSurveyPrompts(SURVEY_SECTIONS)

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(parsed)
}

function buildDefaultAnswers(): EnrolleeBurdenSurveyAnswer[] {
  return buildDefaultPartnerServiceCapacityAnswers(SURVEY_PROMPTS).map((answer) => ({ ...answer }))
}

function mergeAnswers(record: EnrolleeBurdenSurveySubmissionRecord | null) {
  const defaults = buildDefaultAnswers()
  if (!record) return defaults
  const answersByPromptId = new Map(record.answers.map((answer) => [answer.promptId, answer]))
  return defaults.map((answer) => answersByPromptId.get(answer.promptId) || answer)
}

function isAnswerComplete(answer: EnrolleeBurdenSurveyAnswer | undefined) {
  return Boolean(answer && (answer.notEncountered || typeof answer.score === 'number'))
}

export default function EnrolleeBurdenSurveyPanel({
  enrollee,
  respondentName,
  respondentRole,
  respondentPersonId = null,
  organizationName = '',
  canEdit,
  submissionHistory,
  isSaving,
  saveError,
  onSubmit,
  onDeleteDraft
}: EnrolleeBurdenSurveyPanelProps) {
  const sortedHistory = React.useMemo(
    () =>
      submissionHistory
        .slice()
        .sort((left, right) => new Date(right.updatedAtIso || right.submittedAtIso).getTime() - new Date(left.updatedAtIso || left.submittedAtIso).getTime()),
    [submissionHistory]
  )
  const latestCompletedRecord = sortedHistory.find((record) => record.status === 'completed') || null
  const latestDraftRecord = sortedHistory.find((record) => record.status === 'draft') || null
  const [mode, setMode] = React.useState<PanelMode>('history')
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [activeRecord, setActiveRecord] = React.useState<EnrolleeBurdenSurveySubmissionRecord | null>(null)
  const [answers, setAnswers] = React.useState<EnrolleeBurdenSurveyAnswer[]>(() => mergeAnswers(latestDraftRecord || latestCompletedRecord))
  const [localError, setLocalError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setMode('history')
    setCurrentIndex(0)
    setActiveRecord(null)
    setAnswers(mergeAnswers(latestDraftRecord || latestCompletedRecord))
    setLocalError(null)
  }, [enrollee.id, latestCompletedRecord, latestDraftRecord])

  const currentPrompt = SURVEY_PROMPTS[currentIndex] || SURVEY_PROMPTS[0]
  const currentAnswer = answers[currentIndex]
  const completedCount = React.useMemo(() => answers.filter((answer) => isAnswerComplete(answer)).length, [answers])
  const sectionProgress = React.useMemo<SurveySectionProgressItem[]>(
    () =>
      SURVEY_SECTIONS.map((section) => {
        const promptIds = new Set(section.prompts.map((prompt) => prompt.id))
        return {
          parentCode: section.parentCode,
          total: section.prompts.length,
          completed: answers.filter((answer) => promptIds.has(answer.promptId) && isAnswerComplete(answer)).length,
          accentColor: getZCodeParentColor(section.parentCode),
          isCurrent: section.parentCode === currentPrompt.parentCode
        }
      }),
    [answers, currentPrompt.parentCode]
  )

  function openSurvey(record: EnrolleeBurdenSurveySubmissionRecord | null) {
    setActiveRecord(record)
    setAnswers(mergeAnswers(record))
    setCurrentIndex(0)
    setLocalError(null)
    setMode('survey')
  }

  function updateAnswer(promptId: string, updater: (answer: EnrolleeBurdenSurveyAnswer) => EnrolleeBurdenSurveyAnswer) {
    setAnswers((current) => current.map((answer) => (answer.promptId === promptId ? updater(answer) : answer)))
  }

  async function persist(status: 'draft' | 'completed') {
    if (!canEdit) return
    setLocalError(null)
    if (status === 'completed' && answers.some((answer) => !isAnswerComplete(answer))) {
      setLocalError('Complete every Z-code burden prompt or mark it as not encountered before submitting.')
      return
    }

    const saved = await onSubmit({
      draftKey: activeRecord?.draftKey,
      status,
      completedAtIso: status === 'completed' ? new Date().toISOString() : null,
      formVersion: SERVICE_CAPACITY_FORM_VERSION,
      header: {
        enrolleeId: enrollee.id,
        enrollmentId: enrollee.enrollmentId || '',
        enrolleeName: enrollee.fullName,
        enrolleeCaseId: enrollee.caseId,
        respondentPersonId,
        respondentName,
        respondentRole,
        organizationName
      },
      answers
    })

    if (saved) {
      setActiveRecord(saved)
      setAnswers(mergeAnswers(saved))
    }

    if (status === 'completed') {
      setMode('history')
    }
  }

  const accentColor = getZCodeParentColor(currentPrompt.parentCode)
  const surveyError = localError || saveError

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[24px] border px-4 py-4" style={{ borderColor: '#ffffff24', backgroundColor: 'var(--surface-panel-soft)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <small className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: SP_COLORS.muted }}>
              enrollee burden survey
            </small>
            <div className="mt-1 text-[24px] font-medium text-white">{enrollee.fullName}</div>
            <div className="mt-1 flex flex-wrap gap-3 text-[12px]" style={{ color: '#aab6c3' }}>
              <span>C: {enrollee.caseId || 'pending'}</span>
              <span>DOB: {enrollee.dob || 'pending'}</span>
              <span>Navigator: {enrollee.assignedNavigator || 'pending'}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <>
                <AtlasTextButton
                  onClick={() => openSurvey(latestDraftRecord)}
                  className="px-[14px] py-[7px] text-[14px]"
                  style={{ backgroundColor: 'var(--atlas-signal-lucid-green)', color: SP_COLORS.bg } as React.CSSProperties}
                >
                  {latestDraftRecord ? 'resume draft' : 'start survey'}
                </AtlasTextButton>
                <AtlasTextButton
                  onClick={() => openSurvey(null)}
                  className="px-[14px] py-[7px] text-[14px]"
                >
                  new blank survey
                </AtlasTextButton>
              </>
            ) : latestCompletedRecord ? (
              <AtlasTextButton onClick={() => openSurvey(latestCompletedRecord)} className="px-[14px] py-[7px] text-[14px]">
                review latest
              </AtlasTextButton>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricChip label="latest completed" value={latestCompletedRecord ? formatDateLabel(latestCompletedRecord.completedAtIso || latestCompletedRecord.updatedAtIso) : 'none'} />
          <MetricChip label="drafts" value={String(sortedHistory.filter((record) => record.status === 'draft').length)} />
          <MetricChip label="review mode" value={canEdit ? 'navigator edits' : 'supervisor review'} />
        </div>
      </section>

      {mode === 'survey' ? (
        <section className="rounded-[24px] border px-4 py-4" style={{ borderColor: '#ffffff24', backgroundColor: 'var(--surface-panel-raised)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <small className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: SP_COLORS.muted }}>
                respondent
              </small>
              <div className="mt-1 text-[18px] font-medium text-white">{respondentName}</div>
              <div className="text-[12px]" style={{ color: '#aab6c3' }}>
                {respondentRole} {organizationName ? `· ${organizationName}` : ''}
              </div>
            </div>
            <AtlasTextButton onClick={() => setMode('history')} className="px-[14px] py-[7px] text-[14px]">
              back to records
            </AtlasTextButton>
          </div>

          <SurveyProgressHeader
            currentIndex={currentIndex}
            totalCount={SURVEY_PROMPTS.length}
            completedCount={completedCount}
            parentCode={currentPrompt.parentCode}
            parentTheme={currentPrompt.parentTheme}
            accentColor={accentColor}
            sectionProgress={sectionProgress}
            pinToViewport={false}
          />

          <div className="mt-4">
            <BurdenCard
              promptItem={currentPrompt}
              scale={DEFAULT_SERVICE_CAPACITY_SCALE}
              score={currentAnswer?.score ?? null}
              notEncountered={Boolean(currentAnswer?.notEncountered)}
              accentColor={accentColor}
              currentIndex={currentIndex}
              totalCount={SURVEY_PROMPTS.length}
              hasPrevious={currentIndex > 0}
              hasNext={currentIndex < SURVEY_PROMPTS.length - 1}
              canAdvance={isAnswerComplete(currentAnswer)}
              canResume={false}
              onPreviousNavigate={() => setCurrentIndex((current) => Math.max(0, current - 1))}
              onNextNavigate={() => setCurrentIndex((current) => Math.min(SURVEY_PROMPTS.length - 1, current + 1))}
              onResumeNavigate={() => undefined}
              onChange={(score) =>
                updateAnswer(currentPrompt.id, (answer) => ({
                  ...answer,
                  score,
                  notEncountered: false
                }))
              }
              onNotEncounteredChange={(value) =>
                updateAnswer(currentPrompt.id, (answer) => ({
                  ...answer,
                  notEncountered: value,
                  score: value ? null : answer.score
                }))
              }
            />
          </div>

          {surveyError ? (
            <div className="mt-4 rounded-[18px] border px-4 py-3 text-[12px]" style={{ borderColor: `${SP_COLORS.red}80`, color: SP_COLORS.red }}>
              {surveyError}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px]" style={{ color: '#aab6c3' }}>
              {completedCount} of {SURVEY_PROMPTS.length} prompts complete
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <>
                  <AtlasTextButton onClick={() => void persist('draft')} disabled={isSaving} className="px-[14px] py-[7px] text-[14px]">
                    save draft
                  </AtlasTextButton>
                  <AtlasTextButton
                    onClick={() => void persist('completed')}
                    disabled={isSaving}
                    className="px-[14px] py-[7px] text-[14px]"
                    style={{ backgroundColor: 'var(--atlas-signal-lucid-green)', color: SP_COLORS.bg } as React.CSSProperties}
                  >
                    submit completed
                  </AtlasTextButton>
                </>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[24px] border px-4 py-4" style={{ borderColor: '#ffffff24', backgroundColor: 'var(--surface-panel-raised)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <small className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: SP_COLORS.muted }}>
                records
              </small>
              <div className="mt-1 text-[22px] font-medium text-white">survey history</div>
            </div>
            <span className="rounded-full border px-3 py-1 text-[11px]" style={{ borderColor: '#ffffff24', color: '#d7e0e9' }}>
              {sortedHistory.length} records
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {sortedHistory.length ? (
              sortedHistory.map((record) => (
                <div key={record.id} className="rounded-[18px] border px-4 py-3" style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-soft)' }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-medium text-white">
                        {record.status === 'draft' ? 'Draft survey' : 'Completed survey'}
                      </div>
                      <div className="mt-1 text-[12px]" style={{ color: '#aab6c3' }}>
                        {formatDateLabel(record.updatedAtIso)} · {record.header.respondentRole}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AtlasTextButton onClick={() => openSurvey(record)} className="px-[14px] py-[7px] text-[14px]">
                        {record.status === 'draft' && canEdit ? 'edit' : 'view'}
                      </AtlasTextButton>
                      {record.status === 'draft' && canEdit ? (
                        <AtlasTextButton
                          onClick={() => void onDeleteDraft(record.id, enrollee.enrollmentId || '')}
                          className="px-[14px] py-[7px] text-[14px]"
                        >
                          delete draft
                        </AtlasTextButton>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[16px] border px-4 py-3 text-[13px]" style={{ borderColor: '#ffffff18', color: '#9eacb9' }}>
                No enrollee burden survey records yet for this person.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border px-3 py-3" style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}>
      <small className="block text-[10px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
        {label}
      </small>
      <div className="mt-1 text-[15px] font-medium text-white">{value}</div>
    </div>
  )
}
