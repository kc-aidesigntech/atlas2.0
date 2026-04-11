import React, { useEffect, useMemo, useState } from 'react'
import {
  buildDefaultPartnerServiceCapacityAnswers,
  getScaleOption,
  SERVICE_CAPACITY_FORM_VERSION,
  SERVICE_CAPACITY_SCALE,
  SERVICE_CAPACITY_SURVEY_SECTIONS
} from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import downArrowUrl from '../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png'
import type {
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole,
  ZCodeSurveyPrompt
} from '@/features/atlas2026/singlepane/types'

interface ServiceCapacitySurveyPanelProps {
  savedSubmission: PartnerServiceCapacitySubmissionRecord | null
  defaultHeader: PartnerServiceCapacityHeader
  isSaving: boolean
  saveError: string | null
  onSubmit: (payload: PartnerServiceCapacitySubmissionInput) => Promise<void> | void
}

const ROLE_OPTIONS: Array<{ value: PartnerSurveyRespondentRole; label: string }> = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'direct_service_provider', label: 'Direct Service Provider' },
  { value: 'other', label: 'Other' }
]

interface DraftState {
  header: PartnerServiceCapacityHeader
  answers: PartnerServiceCapacityAnswer[]
}

export default function ServiceCapacitySurveyPanel({
  savedSubmission,
  defaultHeader,
  isSaving,
  saveError,
  onSubmit
}: ServiceCapacitySurveyPanelProps) {
  const [draft, setDraft] = useState<DraftState>(() => ({
    header: defaultHeader,
    answers: buildDefaultPartnerServiceCapacityAnswers()
  }))
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  useEffect(() => {
    const defaults = buildDefaultPartnerServiceCapacityAnswers()
    const answersByPromptId = new Map(savedSubmission?.answers.map((answer) => [answer.promptId, answer]) || [])
    setDraft({
      header: savedSubmission?.header || defaultHeader,
      answers: defaults.map((answer) => answersByPromptId.get(answer.promptId) || answer)
    })
  }, [defaultHeader, savedSubmission])

  const answersByPromptId = useMemo(() => new Map(draft.answers.map((answer) => [answer.promptId, answer])), [draft.answers])
  const completedCount = draft.answers.filter((answer) => answer.score >= 1 && answer.score <= 9).length

  function updateHeader<K extends keyof PartnerServiceCapacityHeader>(key: K, value: PartnerServiceCapacityHeader[K]) {
    setDraft((current) => ({
      ...current,
      header: {
        ...current.header,
        [key]: value
      }
    }))
    setValidationMessage(null)
  }

  function toggleRole(role: PartnerSurveyRespondentRole) {
    const currentRoles = draft.header.respondentRoles
    const nextRoles = currentRoles.includes(role) ? currentRoles.filter((item) => item !== role) : [...currentRoles, role]
    updateHeader('respondentRoles', nextRoles)
    if (role !== 'other' || nextRoles.includes('other')) return
    updateHeader('otherRoleText', '')
  }

  function updateAnswer(promptId: string, score: number) {
    setDraft((current) => ({
      ...current,
      answers: current.answers.map((answer) => (answer.promptId === promptId ? { ...answer, score } : answer))
    }))
  }

  async function handleSubmit() {
    const trimmedFirstName = draft.header.firstName.trim()
    const trimmedLastName = draft.header.lastName.trim()
    const trimmedOrganization = draft.header.organizationName.trim()
    const selectedRoles = draft.header.respondentRoles
    const needsOtherRole = selectedRoles.includes('other')
    if (!trimmedFirstName || !trimmedLastName || !trimmedOrganization || !selectedRoles.length) {
      setValidationMessage('Complete the required header fields before saving the survey.')
      return
    }
    if (needsOtherRole && !draft.header.otherRoleText.trim()) {
      setValidationMessage('Add the role description for “Other” before saving the survey.')
      return
    }

    setValidationMessage(null)
    await onSubmit({
      header: {
        ...draft.header,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        organizationName: trimmedOrganization,
        jobTitle: draft.header.jobTitle.trim(),
        otherRoleText: draft.header.otherRoleText.trim()
      },
      answers: draft.answers,
      formVersion: SERVICE_CAPACITY_FORM_VERSION
    })
  }

  const lastSavedLabel = savedSubmission?.submittedAtIso
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(savedSubmission.submittedAtIso))
    : null

  return (
    <div className="w-full rounded-[30px] border px-4 py-4 md:px-5 md:py-5" style={{ borderColor: '#ffffff40', backgroundColor: '#020202' }}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4" style={{ borderColor: '#ffffff20' }}>
        <div className="max-w-[720px]">
          <small className="block text-[12px] uppercase tracking-[0.16em]" style={{ color: SP_COLORS.muted }}>
            partner service capacity
          </small>
          <h3 className="mt-1 text-[26px] font-medium text-white">Z-code burden survey</h3>
          <small className="block text-[13px] text-[#bdbdbd]">
            Capture how well your organization can handle each Z-code pressure area on a 1-9 burden scale.
          </small>
        </div>
        <div className="flex flex-col items-end gap-2">
          {lastSavedLabel ? (
            <small className="text-[12px]" style={{ color: SP_COLORS.muted }}>
              last saved {lastSavedLabel}
            </small>
          ) : (
            <small className="text-[12px]" style={{ color: SP_COLORS.muted }}>
              no saved survey yet
            </small>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-full border px-4 py-2 text-[12px] font-medium"
            style={{ borderColor: SP_COLORS.yellow, color: SP_COLORS.yellow, opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaving ? 'saving survey...' : 'save survey'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff25' }}>
          <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">respondent details</small>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Your Name*" requiredHint="This field is required.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={draft.header.firstName}
                  placeholder="first name"
                  onChange={(value) => updateHeader('firstName', value)}
                />
                <Input
                  value={draft.header.lastName}
                  placeholder="last name"
                  onChange={(value) => updateHeader('lastName', value)}
                />
              </div>
            </Field>
            <Field label="The Name of Your Organization*" requiredHint="This field is required.">
              <Input
                value={draft.header.organizationName}
                placeholder="organization name"
                onChange={(value) => updateHeader('organizationName', value)}
              />
            </Field>
            <Field label="Your Job Title">
              <Input value={draft.header.jobTitle} placeholder="job title" onChange={(value) => updateHeader('jobTitle', value)} />
            </Field>
            <Field label="Please select the option/s that apply to you*" requiredHint="This field is required.">
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((option) => {
                  const isSelected = draft.header.respondentRoles.includes(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleRole(option.value)}
                      className="rounded-full border px-3 py-1.5 text-[12px]"
                      style={{
                        borderColor: isSelected ? SP_COLORS.yellow : '#ffffff30',
                        color: isSelected ? SP_COLORS.yellow : SP_COLORS.white
                      }}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {draft.header.respondentRoles.includes('other') ? (
                <div className="mt-3">
                  <Input
                    value={draft.header.otherRoleText}
                    placeholder="tell us your role"
                    onChange={(value) => updateHeader('otherRoleText', value)}
                  />
                </div>
              ) : null}
            </Field>
          </div>
        </section>

        <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff25' }}>
          <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">scale guide</small>
          <div className="grid gap-2">
            {SERVICE_CAPACITY_SCALE.map((option) => (
              <div key={option.value} className="rounded-[18px] border px-3 py-2" style={{ borderColor: '#ffffff18', backgroundColor: '#060606' }}>
                <div className="text-[12px] font-medium" style={{ color: option.value >= 7 ? SP_COLORS.deepGreen : option.value <= 3 ? SP_COLORS.red : SP_COLORS.yellow }}>
                  {option.value} - {option.label}
                </div>
                <small className="block text-[11px] text-[#bdbdbd]">{option.description}</small>
              </div>
            ))}
            <small className="pt-2 text-[12px]" style={{ color: SP_COLORS.muted }}>
              {completedCount} of {draft.answers.length} cards currently rated.
            </small>
          </div>
        </section>
      </div>

      {validationMessage || saveError ? (
        <div className="mt-4 rounded-[18px] border px-4 py-3 text-[13px]" style={{ borderColor: `${SP_COLORS.red}70`, color: SP_COLORS.red }}>
          {validationMessage || saveError}
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        {SERVICE_CAPACITY_SURVEY_SECTIONS.map((section) => (
          <section key={section.parentCode} className="rounded-[26px] border px-4 py-4 md:px-5" style={{ borderColor: '#ffffff25' }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b pb-3" style={{ borderColor: '#ffffff12' }}>
              <div>
                <small className="block text-[12px] uppercase tracking-[0.14em]" style={{ color: SP_COLORS.muted }}>
                  {section.parentCode}
                </small>
                <div className="text-[18px] font-medium text-white">{section.theme}</div>
              </div>
              <small className="text-[12px]" style={{ color: SP_COLORS.muted }}>
                {section.prompts.length} cards
              </small>
            </div>
            <div className="grid gap-3">
              {section.prompts.map((promptItem) => {
                const answer = answersByPromptId.get(promptItem.id)
                if (!answer) return null
                return (
                  <BurdenCard
                    key={promptItem.id}
                    promptItem={promptItem}
                    score={answer.score}
                    onChange={(score) => updateAnswer(promptItem.id, score)}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded-full border px-5 py-2 text-[13px] font-medium"
          style={{ borderColor: SP_COLORS.yellow, color: SP_COLORS.yellow, opacity: isSaving ? 0.6 : 1 }}
        >
          {isSaving ? 'saving survey...' : 'save partner burden survey'}
        </button>
      </div>
    </div>
  )
}

function BurdenCard({
  promptItem,
  score,
  onChange
}: {
  promptItem: ZCodeSurveyPrompt
  score: number
  onChange: (score: number) => void
}) {
  const scaleState = getScaleOption(score)
  const thumbPercent = ((score - 1) / 8) * 100

  function handleNumberInputChange(nextValue: string) {
    if (!nextValue) {
      onChange(1)
      return
    }
    const parsed = Number(nextValue)
    if (!Number.isFinite(parsed)) return
    onChange(Math.max(1, Math.min(9, Math.round(parsed))))
  }

  return (
    <div className="rounded-[22px] border px-4 py-4" style={{ borderColor: '#ffffff18', backgroundColor: '#050505' }}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium text-white">{promptItem.zCode}</div>
          <small className="mt-1 block text-[12px] text-[#bdbdbd]">{promptItem.description}</small>

          <div className="relative mt-5 pt-9">
            <div
              className="pointer-events-none absolute top-0 z-10 w-[220px] max-w-[calc(100%-8px)] -translate-x-1/2 rounded-[16px] border px-3 py-2"
              style={{
                left: `clamp(110px, ${thumbPercent}%, calc(100% - 110px))`,
                borderColor: '#ffffff25',
                backgroundColor: '#080808'
              }}
            >
              <small className="block text-[11px]" style={{ color: SP_COLORS.muted }}>
                {scaleState.value} - {scaleState.label}
              </small>
              <small className="block text-[11px] text-white">{scaleState.description}</small>
            </div>

            <div className="rounded-[20px] border px-3 py-3" style={{ borderColor: '#ffffff12', backgroundColor: '#020202' }}>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={9}
                  step={1}
                  value={score}
                  onChange={(event) => onChange(Number(event.target.value))}
                  className="min-w-[220px] flex-1 accent-white"
                />
                <label className="flex items-center gap-2 text-[12px]" style={{ color: SP_COLORS.muted }}>
                  <span>value</span>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    step={1}
                    value={score}
                    onChange={(event) => handleNumberInputChange(event.target.value)}
                    className="w-[64px] rounded-xl border bg-black px-2 py-1 text-center text-[14px] text-white"
                    style={{ borderColor: '#ffffff30' }}
                  />
                </label>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px]" style={{ color: SP_COLORS.muted }}>
                {SERVICE_CAPACITY_SCALE.map((option) => (
                  <span key={option.value}>{option.value}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3 pt-1">
          <div
            className="rounded-full border px-3 py-1 text-[12px]"
            style={{
              borderColor: score >= 7 ? `${SP_COLORS.deepGreen}90` : score <= 3 ? `${SP_COLORS.red}90` : `${SP_COLORS.yellow}90`,
              color: score >= 7 ? SP_COLORS.deepGreen : score <= 3 ? SP_COLORS.red : SP_COLORS.yellow
            }}
          >
            {score}
          </div>
          <img
            src={downArrowUrl}
            alt=""
            aria-hidden="true"
            className="h-20 w-8 rotate-180 object-contain opacity-70"
          />
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  requiredHint
}: {
  label: string
  children: React.ReactNode
  requiredHint?: string
}) {
  return (
    <label className="block text-[12px] text-[#bcbcbc]">
      <span>{label}</span>
      {requiredHint ? <small className="mt-1 block text-[11px] text-[#8f8f8f]">{requiredHint}</small> : null}
      <div className="mt-2">{children}</div>
    </label>
  )
}

function Input({
  value,
  placeholder,
  onChange
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
      style={{ borderColor: '#ffffff30' }}
    />
  )
}
