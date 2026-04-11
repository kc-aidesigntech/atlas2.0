import React, { useEffect, useMemo, useRef, useState } from 'react'
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

const SECTION_ACCENT_COLORS: Record<string, string> = {
  Z55: SP_COLORS.blue,
  Z56: SP_COLORS.orange,
  Z57: SP_COLORS.deepGreen,
  Z59: SP_COLORS.red,
  Z60: SP_COLORS.purple,
  Z62: SP_COLORS.brown,
  Z63: SP_COLORS.green,
  Z64: SP_COLORS.yellow,
  Z65: SP_COLORS.steel
}

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
  const numericInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const hasAutoFocusedFirstCard = useRef(false)

  useEffect(() => {
    const defaults = buildDefaultPartnerServiceCapacityAnswers()
    const answersByPromptId = new Map(savedSubmission?.answers.map((answer) => [answer.promptId, answer]) || [])
    setDraft({
      header: savedSubmission?.header || defaultHeader,
      answers: defaults.map((answer) => answersByPromptId.get(answer.promptId) || answer)
    })
  }, [defaultHeader, savedSubmission])

  const answersByPromptId = useMemo(() => new Map(draft.answers.map((answer) => [answer.promptId, answer])), [draft.answers])
  const orderedPromptIds = useMemo(
    () => SERVICE_CAPACITY_SURVEY_SECTIONS.flatMap((section) => section.prompts.map((promptItem) => promptItem.id)),
    []
  )
  const completedCount = draft.answers.filter((answer) => answer.score >= 1 && answer.score <= 9).length

  useEffect(() => {
    if (hasAutoFocusedFirstCard.current) return
    const firstPromptId = orderedPromptIds[0]
    const firstInput = firstPromptId ? numericInputRefs.current[firstPromptId] : null
    if (!firstInput) return

    hasAutoFocusedFirstCard.current = true
    requestAnimationFrame(() => {
      firstInput.focus()
      firstInput.select()
    })
  }, [orderedPromptIds, draft.answers])

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

  function focusAdjacentNumericInput(promptId: string, direction: 1 | -1) {
    const currentIndex = orderedPromptIds.indexOf(promptId)
    if (currentIndex === -1) return false

    const nextPromptId = orderedPromptIds[currentIndex + direction]
    if (!nextPromptId) return false

    const nextInput = numericInputRefs.current[nextPromptId]
    if (!nextInput) return false

    nextInput.focus()
    nextInput.select()
    return true
  }

  function scrollToAdjacentCard(promptId: string, direction: 1 | -1) {
    const currentIndex = orderedPromptIds.indexOf(promptId)
    if (currentIndex === -1) return false

    const nextPromptId = orderedPromptIds[currentIndex + direction]
    if (!nextPromptId) return false

    const nextCard = cardRefs.current[nextPromptId]
    if (!nextCard) return false

    const nextCardTop = window.scrollY + nextCard.getBoundingClientRect().top
    window.scrollTo({
      top: Math.max(0, nextCardTop - 20),
      behavior: 'smooth'
    })

    const nextInput = numericInputRefs.current[nextPromptId]
    if (nextInput) {
      window.setTimeout(() => {
        nextInput.focus()
        nextInput.select()
      }, 320)
    }

    return true
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
          <small className="block text-[12px] uppercase tracking-[0.16em] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
            partner service capacity
          </small>
          <h3 className="mt-1 text-[28px] font-medium text-white md:text-[34px]">Z-code burden survey</h3>
          <small className="block text-[14px] text-[#bdbdbd] md:text-[17px]">
            Capture how well your organization can handle each Z-code pressure area on a 1-9 burden scale.
          </small>
        </div>
        <div className="flex flex-col items-end gap-2">
          {lastSavedLabel ? (
            <small className="text-[12px] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
              last saved {lastSavedLabel}
            </small>
          ) : (
            <small className="text-[12px] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
              no saved survey yet
            </small>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="rounded-full border px-4 py-2 text-[12px] font-medium md:text-[13px]"
            style={{ borderColor: SP_COLORS.yellow, color: SP_COLORS.yellow, opacity: isSaving ? 0.6 : 1 }}
          >
            {isSaving ? 'saving survey...' : 'save survey'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff25' }}>
          <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd] md:text-[14px]">respondent details</small>
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
                      className="rounded-full border px-3 py-1.5 text-[12px] md:text-[13px]"
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
          <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd] md:text-[14px]">scale guide</small>
          <div className="grid gap-2">
            {SERVICE_CAPACITY_SCALE.map((option) => (
              <div key={option.value} className="rounded-[18px] border px-3 py-2" style={{ borderColor: '#ffffff18', backgroundColor: '#060606' }}>
                <div className="text-[13px] font-medium md:text-[15px]" style={{ color: option.value >= 7 ? SP_COLORS.deepGreen : option.value <= 3 ? SP_COLORS.red : SP_COLORS.yellow }}>
                  {option.value} - {option.label}
                </div>
                <small className="block text-[12px] text-[#bdbdbd] md:text-[13px]">{option.description}</small>
              </div>
            ))}
            <small className="pt-2 text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
              {completedCount} of {draft.answers.length} cards currently rated.
            </small>
          </div>
        </section>
      </div>

      {validationMessage || saveError ? (
        <div className="mt-4 rounded-[18px] border px-4 py-3 text-[13px] md:text-[14px]" style={{ borderColor: `${SP_COLORS.red}70`, color: SP_COLORS.red }}>
          {validationMessage || saveError}
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        {SERVICE_CAPACITY_SURVEY_SECTIONS.map((section) => (
          <section key={section.parentCode} className="rounded-[26px] border px-4 py-4 md:px-5" style={{ borderColor: '#ffffff25' }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b pb-3" style={{ borderColor: '#ffffff12' }}>
              <div>
                <small className="block text-[12px] uppercase tracking-[0.14em] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
                  {section.parentCode}
                </small>
                <div className="text-[19px] font-medium text-white md:text-[23px]">{section.theme}</div>
              </div>
              <small className="text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
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
                    accentColor={SECTION_ACCENT_COLORS[section.parentCode] || SP_COLORS.white}
                    cardRef={(element) => {
                      cardRefs.current[promptItem.id] = element
                    }}
                    inputRef={(element) => {
                      numericInputRefs.current[promptItem.id] = element
                    }}
                    onTabNavigate={(direction) => focusAdjacentNumericInput(promptItem.id, direction)}
                    onArrowNavigate={() => scrollToAdjacentCard(promptItem.id, 1)}
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
          className="rounded-full border px-5 py-2 text-[13px] font-medium md:text-[14px]"
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
  accentColor,
  cardRef,
  inputRef,
  onTabNavigate,
  onArrowNavigate,
  onChange
}: {
  promptItem: ZCodeSurveyPrompt
  score: number
  accentColor: string
  cardRef?: (element: HTMLDivElement | null) => void
  inputRef?: (element: HTMLInputElement | null) => void
  onTabNavigate: (direction: 1 | -1) => boolean
  onArrowNavigate: () => boolean
  onChange: (score: number) => void
}) {
  const scaleState = getScaleOption(score)
  const thumbPercent = ((score - 1) / 8) * 100
  const badgeTextColor = accentColor === SP_COLORS.yellow ? SP_COLORS.bg : SP_COLORS.white
  const tooltipHalfWidth = 110
  const thumbInset = 18
  const thumbOffsetPx = (0.5 - thumbPercent / 100) * thumbInset
  const tooltipLeft = `clamp(${tooltipHalfWidth}px, calc(${thumbPercent}% + ${thumbOffsetPx.toFixed(2)}px), calc(100% - ${tooltipHalfWidth}px))`

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
    <div
      ref={cardRef}
      className="relative scroll-mt-5 rounded-[22px] border px-4 pb-3 pt-3 md:px-5 md:pb-3.5 md:scroll-mt-6"
      style={{ borderColor: '#ffffff18', backgroundColor: '#050505' }}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 top-[33px] border-t"
        style={{ borderColor: '#ffffff22' }}
      />
      <div className="flex items-start gap-3 md:gap-4">
        <div className="relative z-10 w-[88px] shrink-0 pt-[14px] text-left md:w-[104px]">
          <div className="inline-flex rounded-full bg-[#050505] pr-3 text-[14px] font-medium text-white md:text-[16px]">
            {promptItem.zCode}
          </div>
        </div>

        <div className="min-w-0 flex-1 pt-[6px]">
          <div className="pr-2 text-[13px] text-[#d6d6d6] md:text-[15px]">{promptItem.description}</div>

          <div className="relative mt-3 pt-8 md:mt-3.5">
            <div
              className="pointer-events-none absolute top-0 z-10 w-[220px] max-w-[calc(100%-8px)] -translate-x-1/2 rounded-[16px] border px-3 py-2"
              style={{
                left: tooltipLeft,
                borderColor: '#ffffff25',
                backgroundColor: '#080808'
              }}
            >
              <small className="block text-[11px] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
                {scaleState.value} - {scaleState.label}
              </small>
              <small className="block text-[11px] text-white md:text-[13px]">{scaleState.description}</small>
            </div>

            <div className="rounded-[20px] border px-3 py-2.5 md:px-3.5 md:py-3" style={{ borderColor: '#ffffff12', backgroundColor: '#020202' }}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[220px] flex-1">
                  <input
                    type="range"
                    min={1}
                    max={9}
                    step={1}
                    value={score}
                    onChange={(event) => onChange(Number(event.target.value))}
                    tabIndex={-1}
                    className="w-full accent-white"
                  />
                  <div className="mt-1.5 grid grid-cols-9 text-center text-[10px] md:text-[11px]" style={{ color: SP_COLORS.muted }}>
                    {SERVICE_CAPACITY_SCALE.map((option) => (
                      <span key={option.value}>{option.value}</span>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 pt-0.5 text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
                  <span>value</span>
                  <input
                    ref={inputRef}
                    type="number"
                    min={1}
                    max={9}
                    step={1}
                    value={score}
                    onChange={(event) => handleNumberInputChange(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      if (event.key !== 'Tab') return
                      if (onTabNavigate(event.shiftKey ? -1 : 1)) {
                        event.preventDefault()
                      }
                    }}
                    inputMode="numeric"
                    className="w-[64px] rounded-xl border bg-black px-2 py-1 text-center text-[14px] text-white md:text-[15px]"
                    style={{ borderColor: '#ffffff30' }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 flex-col items-center gap-2 bg-[#050505] pl-2 pt-[2px]">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-medium md:h-11 md:w-11 md:text-[14px]"
            style={{
              backgroundColor: accentColor,
              color: badgeTextColor
            }}
          >
            {score}
          </div>
          <button
            type="button"
            onClick={onArrowNavigate}
            className="rounded-full p-1 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label={`Jump to next card after ${promptItem.zCode}`}
          >
            <img
              src={downArrowUrl}
              alt=""
              aria-hidden="true"
              className="h-16 w-7 rotate-180 object-contain opacity-70 md:h-20 md:w-8"
            />
          </button>
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
    <label className="block text-[12px] text-[#bcbcbc] md:text-[14px]">
      <span>{label}</span>
      {requiredHint ? <small className="mt-1 block text-[11px] text-[#8f8f8f] md:text-[13px]">{requiredHint}</small> : null}
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
      className="w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white md:text-[16px]"
      style={{ borderColor: '#ffffff30' }}
    />
  )
}
