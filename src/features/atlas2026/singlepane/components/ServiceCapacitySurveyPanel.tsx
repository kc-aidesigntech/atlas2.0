import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import {
  buildDefaultPartnerServiceCapacityAnswers,
  getScaleOption,
  SERVICE_CAPACITY_FORM_VERSION,
  SERVICE_CAPACITY_SCALE,
  SERVICE_CAPACITY_SURVEY_SECTIONS
} from '../data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '../theme'
import type {
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole,
  ZCodeSurveyPrompt
} from '../types'

const downArrowUrl = new URL('../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png', import.meta.url).toString()

interface ServiceCapacitySurveyPanelProps {
  savedSubmission: PartnerServiceCapacitySubmissionRecord | null
  defaultHeader: PartnerServiceCapacityHeader
  isSaving: boolean
  saveError: string | null
  onSubmit: (payload: PartnerServiceCapacitySubmissionInput) => Promise<PartnerServiceCapacitySubmissionRecord | void> | PartnerServiceCapacitySubmissionRecord | void
}

const ROLE_OPTIONS: Array<{ value: PartnerSurveyRespondentRole; label: string }> = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'direct_service_provider', label: 'Direct Service Provider' },
  { value: 'other', label: 'Other' }
]

const SERVICE_CAPACITY_DRAFT_STORAGE_KEY = 'atlas2026.service-capacity.active-draft.v1'

function createBlankHeader(): PartnerServiceCapacityHeader {
  return {
    firstName: '',
    lastName: '',
    organizationName: '',
    jobTitle: '',
    respondentRoles: [],
    otherRoleText: ''
  }
}

function createDraftKey() {
  return globalThis.crypto?.randomUUID?.() || `service-capacity-${Date.now().toString(36)}`
}

function hasMeaningfulDraftContent(header: PartnerServiceCapacityHeader, answers: DraftAnswer[]) {
  return (
    Boolean(header.firstName.trim()) ||
    Boolean(header.lastName.trim()) ||
    Boolean(header.organizationName.trim()) ||
    Boolean(header.jobTitle.trim()) ||
    header.respondentRoles.length > 0 ||
    Boolean(header.otherRoleText.trim()) ||
    answers.some((answer) => typeof answer.score === 'number')
  )
}

function loadPersistedSurveyDraft(): PersistedSurveyDraft | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SERVICE_CAPACITY_DRAFT_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedSurveyDraft
    if (!parsed || typeof parsed !== 'object' || !parsed.draftKey) return null
    return parsed
  } catch {
    return null
  }
}

function persistSurveyDraft(draft: PersistedSurveyDraft | null) {
  if (typeof window === 'undefined') return
  if (!draft) {
    window.localStorage.removeItem(SERVICE_CAPACITY_DRAFT_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(SERVICE_CAPACITY_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

interface DraftState {
  header: PartnerServiceCapacityHeader
  answers: DraftAnswer[]
}

type DraftAnswer = Omit<PartnerServiceCapacityAnswer, 'score'> & { score: number | null }

interface SectionProgress {
  parentCode: string
  theme: string
  accentColor: string
  total: number
  completed: number
  ratio: number
}

interface PersistedSurveyDraft {
  draftKey: string
  isSurveyStarted: boolean
  header: PartnerServiceCapacityHeader
  answers: DraftAnswer[]
}

export default function ServiceCapacitySurveyPanel({
  savedSubmission,
  defaultHeader,
  isSaving,
  saveError,
  onSubmit
}: ServiceCapacitySurveyPanelProps) {
  const blankHeader = useMemo(createBlankHeader, [])
  const persistedLocalDraft = useMemo(() => loadPersistedSurveyDraft(), [])
  const [draft, setDraft] = useState<DraftState>(() => ({
    header: persistedLocalDraft?.header || blankHeader,
    answers: persistedLocalDraft?.answers || buildDefaultPartnerServiceCapacityAnswers().map((answer) => ({ ...answer, score: null }))
  }))
  const [draftKey, setDraftKey] = useState(() => persistedLocalDraft?.draftKey || createDraftKey())
  const [isSurveyStarted, setIsSurveyStarted] = useState(() => persistedLocalDraft?.isSurveyStarted || false)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(savedSubmission?.id || null)
  const numericInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const firstNameInputRef = useRef<HTMLInputElement | null>(null)
  const hasAutoFocusedFirstName = useRef(false)
  const hasAutoFocusedFirstCard = useRef(false)
  const autosaveTimeoutRef = useRef<number | null>(null)
  const lastAutosavedSnapshotRef = useRef<string>('')
  const hasPendingAutosaveRef = useRef(false)
  const onSubmitRef = useRef(onSubmit)

  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    const defaults = buildDefaultPartnerServiceCapacityAnswers().map((answer) => ({ ...answer, score: null as number | null }))
    const answersByPromptId = new Map(savedSubmission?.answers.map((answer) => [answer.promptId, answer]) || [])
    hasAutoFocusedFirstName.current = false
    hasAutoFocusedFirstCard.current = false
    const localDraft = loadPersistedSurveyDraft()
    const nextHeader = localDraft?.header || savedSubmission?.header || blankHeader
    const nextAnswers = localDraft?.answers || defaults.map((answer) => answersByPromptId.get(answer.promptId) || answer)
    const nextDraftKey = localDraft?.draftKey || savedSubmission?.draftKey || createDraftKey()
    const nextStarted = localDraft?.isSurveyStarted || false
    setDraftKey(nextDraftKey)
    setIsSurveyStarted(nextStarted)
    setCurrentRecordId(savedSubmission?.id || null)
    setDraft({
      header: nextHeader,
      answers: nextAnswers
    })
    lastAutosavedSnapshotRef.current = ''
    hasPendingAutosaveRef.current = false
  }, [blankHeader, savedSubmission])

  const answersByPromptId = useMemo(() => new Map(draft.answers.map((answer) => [answer.promptId, answer])), [draft.answers])
  const orderedPromptIds = useMemo(
    () => SERVICE_CAPACITY_SURVEY_SECTIONS.flatMap((section) => section.prompts.map((promptItem) => promptItem.id)),
    []
  )
  const sectionProgress = useMemo<SectionProgress[]>(
    () =>
      SERVICE_CAPACITY_SURVEY_SECTIONS.map((section) => {
        const completed = section.prompts.reduce((count, promptItem) => {
          const answer = answersByPromptId.get(promptItem.id)
          return typeof answer?.score === 'number' ? count + 1 : count
        }, 0)
        const total = section.prompts.length
        return {
          parentCode: section.parentCode,
          theme: section.theme,
          accentColor: getZCodeParentColor(section.parentCode) || SP_COLORS.white,
          total,
          completed,
          ratio: total ? completed / total : 0
        }
      }),
    [answersByPromptId]
  )
  const completedCount = draft.answers.filter((answer) => typeof answer.score === 'number' && answer.score >= 1 && answer.score <= 9).length

  useEffect(() => {
    if (!isSurveyStarted || hasAutoFocusedFirstCard.current) return
    const firstPromptId = orderedPromptIds[0]
    const firstInput = firstPromptId ? numericInputRefs.current[firstPromptId] : null
    if (!firstInput) return

    hasAutoFocusedFirstCard.current = true
    requestAnimationFrame(() => {
      firstInput.focus()
      firstInput.select()
    })
  }, [isSurveyStarted, orderedPromptIds, draft.answers])

  useEffect(() => {
    if (isSurveyStarted || hasAutoFocusedFirstName.current) return
    const firstInput = firstNameInputRef.current
    if (!firstInput) return

    hasAutoFocusedFirstName.current = true
    requestAnimationFrame(() => {
      firstInput.focus()
      firstInput.select()
    })
  }, [isSurveyStarted, draft.header.firstName])

  function updateHeader<K extends keyof PartnerServiceCapacityHeader>(key: K, value: PartnerServiceCapacityHeader[K]) {
    hasPendingAutosaveRef.current = true
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

  function updateAnswer(promptId: string, score: number | null) {
    hasPendingAutosaveRef.current = true
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

  function scrollToSection(parentCode: string) {
    const nextSection = sectionRefs.current[parentCode]
    if (!nextSection) return

    const sectionTop = window.scrollY + nextSection.getBoundingClientRect().top
    window.scrollTo({
      top: Math.max(0, sectionTop - 96),
      behavior: 'smooth'
    })
  }

  function validateRespondentDetails() {
    const trimmedFirstName = draft.header.firstName.trim()
    const trimmedLastName = draft.header.lastName.trim()
    const trimmedOrganization = draft.header.organizationName.trim()
    const selectedRoles = draft.header.respondentRoles
    if (!trimmedFirstName || !trimmedLastName || !trimmedOrganization || !selectedRoles.length) {
      return 'Complete all respondent details before starting the survey.'
    }
    if (selectedRoles.includes('other') && !draft.header.otherRoleText.trim()) {
      return 'Add the role description for “Other” before starting the survey.'
    }
    return null
  }

  function handleStartSurvey() {
    const validationError = validateRespondentDetails()
    if (validationError) {
      setValidationMessage(validationError)
      return
    }
    hasPendingAutosaveRef.current = true
    setIsSurveyStarted(true)
    setValidationMessage(null)
    hasAutoFocusedFirstCard.current = false
    const firstSectionCode = SERVICE_CAPACITY_SURVEY_SECTIONS[0]?.parentCode
    if (!firstSectionCode) return
    window.setTimeout(() => {
      scrollToSection(firstSectionCode)
    }, 40)
  }

  useEffect(() => {
    const localDraft: PersistedSurveyDraft = {
      draftKey,
      isSurveyStarted,
      header: draft.header,
      answers: draft.answers
    }
    persistSurveyDraft(hasMeaningfulDraftContent(draft.header, draft.answers) || isSurveyStarted ? localDraft : null)

    if (!hasMeaningfulDraftContent(draft.header, draft.answers) || !draftKey) {
      setAutosaveState('idle')
      return
    }
    if (!hasPendingAutosaveRef.current) return

    const answeredAnswers = draft.answers.filter((answer): answer is PartnerServiceCapacityAnswer => typeof answer.score === 'number')
    const payload: PartnerServiceCapacitySubmissionInput = {
      draftKey,
      status: 'draft',
      completedAtIso: null,
      header: draft.header,
      answers: answeredAnswers,
      formVersion: SERVICE_CAPACITY_FORM_VERSION
    }
    const snapshot = JSON.stringify(payload)
    if (snapshot === lastAutosavedSnapshotRef.current) return

    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current)
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      setAutosaveState('saving')
      Promise.resolve(onSubmitRef.current(payload))
        .then((savedRecord) => {
          if (savedRecord?.id) {
            setCurrentRecordId(savedRecord.id)
            if (savedRecord.draftKey) setDraftKey(savedRecord.draftKey)
          }
          lastAutosavedSnapshotRef.current = snapshot
          hasPendingAutosaveRef.current = false
          setAutosaveState('saved')
        })
        .catch(() => {
          setAutosaveState('error')
        })
    }, 500)

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [draft, draftKey, isSurveyStarted])

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
    if (draft.answers.some((answer) => typeof answer.score !== 'number')) {
      setValidationMessage('Complete every card rating before saving the survey.')
      return
    }

    setValidationMessage(null)
    const completedAnswers = draft.answers.map((answer) => ({ ...answer, score: answer.score as number }))
    const completedRecord = await onSubmit({
      draftKey,
      status: 'completed',
      completedAtIso: new Date().toISOString(),
      header: {
        ...draft.header,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        organizationName: trimmedOrganization,
        jobTitle: draft.header.jobTitle.trim(),
        otherRoleText: draft.header.otherRoleText.trim()
      },
      answers: completedAnswers,
      formVersion: SERVICE_CAPACITY_FORM_VERSION
    })
    if (completedRecord?.id) setCurrentRecordId(completedRecord.id)
    persistSurveyDraft(null)
    setAutosaveState('saved')
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
          <small className="text-[12px] md:text-[13px]" style={{ color: autosaveState === 'error' ? SP_COLORS.red : SP_COLORS.muted }}>
            {autosaveState === 'saving'
              ? 'saving draft...'
              : autosaveState === 'saved'
                ? 'draft saved'
                : autosaveState === 'error'
                  ? 'draft save failed'
                  : 'draft autosaves as you go'}
          </small>
          {isSurveyStarted ? (
            <small className="font-mono text-[11px] lowercase md:text-[12px]" style={{ color: currentRecordId ? SP_COLORS.white : SP_COLORS.muted }}>
              record id {currentRecordId || 'pending first save'}
            </small>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff25' }}>
            <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd] md:text-[14px]">respondent details</small>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Your Name*" requiredHint="This field is required.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={draft.header.firstName}
                    placeholder="first name"
                    onChange={(value) => updateHeader('firstName', value)}
                    inputRef={firstNameInputRef}
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

          <button
            type="button"
            onClick={handleStartSurvey}
            className="inline-flex items-center gap-3 rounded-full border px-4 py-2 text-[13px] font-medium transition-[box-shadow,border-color] duration-150 ease-out hover:border-white/50 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_18px_rgba(255,255,255,0.1)] md:text-[14px]"
            style={{ borderColor: '#ffffff38', color: SP_COLORS.white }}
          >
            <span>start survey</span>
            <img src={downArrowUrl} alt="" aria-hidden="true" className="h-5 w-5 rotate-90 object-contain opacity-80" />
          </button>
        </div>

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

      {isSurveyStarted ? (
        <>
          <SurveyProgressHeader sectionProgress={sectionProgress} onSelectSection={scrollToSection} />

          <div className="mt-5 space-y-5">
            {SERVICE_CAPACITY_SURVEY_SECTIONS.map((section) => (
              <section
                key={section.parentCode}
                ref={(element) => {
                  sectionRefs.current[section.parentCode] = element
                }}
                className="scroll-mt-28 rounded-[26px] border px-4 py-4 md:px-5"
                style={{ borderColor: '#ffffff25' }}
              >
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
                        accentColor={getZCodeParentColor(section.parentCode) || SP_COLORS.white}
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
              {isSaving ? 'completing submission...' : 'complete submission'}
            </button>
          </div>
        </>
      ) : null}
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
  score: number | null
  accentColor: string
  cardRef?: (element: HTMLDivElement | null) => void
  inputRef?: (element: HTMLInputElement | null) => void
  onTabNavigate: (direction: 1 | -1) => boolean
  onArrowNavigate: () => boolean
  onChange: (score: number | null) => void
}) {
  const effectiveScore = score ?? 5
  const scaleState = getScaleOption(effectiveScore)
  const thumbPercent = ((effectiveScore - 1) / 8) * 100
  const badgeTextColor =
    accentColor === SP_COLORS.yellow || accentColor === SP_COLORS.green ? SP_COLORS.bg : SP_COLORS.white
  const tooltipHalfWidth = 110
  const tooltipLeft = `clamp(${tooltipHalfWidth}px, ${thumbPercent}%, calc(100% - ${tooltipHalfWidth}px))`
  const sliderScaleColors = SERVICE_CAPACITY_SCALE.map((option) =>
    option.value <= 3 ? SP_COLORS.red : option.value <= 6 ? SP_COLORS.yellow : SP_COLORS.deepGreen
  )
  const localInputRef = useRef<HTMLInputElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const tooltipReservedHeight = score == null ? 0 : Math.max(tooltipHeight, 62)

  const setNumericInputRef = React.useCallback(
    (element: HTMLInputElement | null) => {
      localInputRef.current = element
      inputRef?.(element)
    },
    [inputRef]
  )

  function focusNumericInput() {
    const target = localInputRef.current
    if (!target) return
    target.focus()
    target.select()
  }

  function handleNumberInputChange(nextValue: string) {
    if (!nextValue) {
      onChange(null)
      return
    }
    const parsed = Number(nextValue)
    if (!Number.isFinite(parsed)) return
    onChange(Math.max(1, Math.min(9, Math.round(parsed))))
  }

  function handleCardClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      focusNumericInput()
      return
    }

    if (target.closest('button, input, label')) return
    focusNumericInput()
  }

  useEffect(() => {
    if (score == null) {
      setTooltipHeight(0)
      return
    }

    const tooltip = tooltipRef.current
    if (!tooltip) return

    const updateHeight = () => {
      setTooltipHeight(tooltip.offsetHeight)
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateHeight)
    observer.observe(tooltip)
    return () => observer.disconnect()
  }, [score, scaleState.label, scaleState.description])

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className="relative scroll-mt-5 rounded-[22px] border px-4 pb-3 pt-3 transition-[box-shadow,border-color] duration-150 ease-out hover:border-white/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_24px_rgba(255,255,255,0.08)] focus-within:border-white/50 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_28px_rgba(255,255,255,0.1)] active:border-white/45 active:shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_26px_rgba(255,255,255,0.09)] md:px-5 md:pb-3.5 md:scroll-mt-6"
      style={{ borderColor: '#ffffff30', borderWidth: '1.5px', backgroundColor: '#050505' }}
    >
      <div
        className="flex items-start justify-between gap-3 border-b pb-3 md:gap-4 md:pb-3.5"
        style={{ borderColor: '#ffffff40', borderBottomWidth: '1.5px' }}
      >
        <div className="min-w-0 flex flex-1 items-baseline gap-3 md:gap-4">
          <div className="w-[88px] shrink-0 text-[14px] font-medium leading-none text-white md:w-[104px] md:text-[16px]">
            {promptItem.zCode}
          </div>
          <div className="min-w-0 flex-1 pr-2 text-[13px] leading-tight text-[#d6d6d6] md:text-[15px]">
            {promptItem.description}
          </div>
        </div>
        <div className="flex shrink-0 items-start">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-[24px] font-bold leading-none md:h-11 md:w-11 md:text-[30px]"
            style={{
              backgroundColor: accentColor,
              color: badgeTextColor,
              opacity: score == null ? 0.35 : 1
            }}
          >
            {score ?? ''}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-start md:gap-4 md:pt-3.5">
        <div className="hidden w-[88px] shrink-0 sm:block md:w-[104px]" />
        <div className="min-w-0 flex-1">
          <div
            className="relative transition-[padding-top] duration-200 ease-out md:duration-300"
            style={{ paddingTop: score == null ? 0 : tooltipReservedHeight + 8 }}
          >
            {score == null ? null : (
              <div
                ref={tooltipRef}
                className="pointer-events-none absolute top-0 z-10 w-[220px] max-w-[calc(100%-8px)] -translate-x-1/2 rounded-[16px] border px-3 py-2 transition-[left,opacity] duration-200 ease-out md:duration-300"
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
            )}

            <div
              className="rounded-[20px] border px-3 py-2.5 md:px-3.5 md:py-3"
              style={{ borderColor: '#ffffff26', borderWidth: '1.5px', backgroundColor: '#020202' }}
            >
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className={`relative h-6 overflow-visible ${score == null ? 'opacity-55' : ''}`}>
                    <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-white/50" />
                    <div
                      className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${thumbPercent}%`,
                        backgroundColor: '#f3f4f6',
                        border: '1.5px solid rgba(255,255,255,0.85)',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.18)'
                      }}
                    />
                    <input
                      type="range"
                      min={1}
                      max={9}
                      step={1}
                      value={effectiveScore}
                      onChange={(event) => onChange(Number(event.target.value))}
                      tabIndex={-1}
                      className="absolute inset-0 h-6 w-full cursor-pointer opacity-0"
                    />
                  </div>
                  <div className="relative mt-1.5 h-4 overflow-visible text-[10px] md:h-[18px] md:text-[11px]">
                    {SERVICE_CAPACITY_SCALE.map((option, index) => (
                      <span
                        key={option.value}
                        className="absolute top-0 leading-none"
                        style={{
                          left: `${((option.value - 1) / 8) * 100}%`,
                          transform: 'translateX(-50%)',
                          color: sliderScaleColors[index]
                        }}
                      >
                        {option.value}
                      </span>
                    ))}
                  </div>
                </div>
                <label className="ml-2 flex items-center gap-2 text-[12px] sm:ml-3 sm:pt-0.5 md:text-[14px]" style={{ color: SP_COLORS.muted }}>
                  <span>value</span>
                  <input
                    ref={setNumericInputRef}
                    type="number"
                    min={1}
                    max={9}
                    step={1}
                    value={score ?? ''}
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

        <div className="relative z-10 flex shrink-0 self-end flex-col items-center gap-2 pt-1 sm:self-start sm:pl-2">
          <button
            type="button"
            onClick={onArrowNavigate}
            className="rounded-full p-1 transition-[box-shadow,opacity,background-color] duration-150 ease-out hover:bg-white/5 hover:opacity-100 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_18px_rgba(255,255,255,0.12)] focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/5 focus:shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_18px_rgba(255,255,255,0.12)] active:bg-white/5 active:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_16px_rgba(255,255,255,0.1)]"
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

function SurveyProgressHeader({
  sectionProgress,
  onSelectSection
}: {
  sectionProgress: SectionProgress[]
  onSelectSection: (parentCode: string) => void
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const headerHeightClass = 'h-[86px] sm:h-[92px]'

  useEffect(() => {
    function updatePinnedState() {
      const sentinel = sentinelRef.current
      if (!sentinel) return
      setIsPinned(sentinel.getBoundingClientRect().top <= 0)
    }

    updatePinnedState()
    window.addEventListener('scroll', updatePinnedState, { passive: true })
    window.addEventListener('resize', updatePinnedState)

    return () => {
      window.removeEventListener('scroll', updatePinnedState)
      window.removeEventListener('resize', updatePinnedState)
    }
  }, [])

  return (
    <>
      <div ref={sentinelRef} className="mt-6" aria-hidden="true" />
      <div className={isPinned ? headerHeightClass : ''} aria-hidden="true" />
      <div className={isPinned ? 'fixed left-0 right-0 top-0 z-[70]' : 'relative z-30'}>
        <div
          className={`w-full border-b bg-black/95 backdrop-blur-sm ${headerHeightClass}`}
          style={{ borderColor: '#ffffff24' }}
        >
          <div className="mx-auto flex h-full w-full max-w-[1320px] items-center px-2 sm:px-3 md:px-6">
            <div className="grid w-full grid-cols-9 items-start justify-items-center gap-1.5 sm:gap-2 md:gap-3">
              {sectionProgress.map((section) => (
                <button
                  key={section.parentCode}
                  type="button"
                  onClick={() => onSelectSection(section.parentCode)}
                  className="flex min-w-0 w-full flex-col items-center gap-1 rounded-[18px] px-0.5 py-1 transition-[box-shadow,background-color] duration-150 ease-out hover:bg-white/5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14)]"
                >
                  <ProgressCircle
                    label={section.parentCode.replace(/^Z/i, '')}
                    accentColor={section.accentColor}
                    ratio={section.ratio}
                    isComplete={section.completed === section.total}
                  />
                  <small className="text-[clamp(8px,1.9vw,11px)] tracking-[0.04em]" style={{ color: SP_COLORS.muted }}>
                    {section.completed}/{section.total}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function ProgressCircle({
  label,
  accentColor,
  ratio,
  isComplete
}: {
  label: string
  accentColor: string
  ratio: number
  isComplete: boolean
}) {
  const size = 54
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, ratio)))
  const useLightText = usesLightTextOnZCodeColor(accentColor)

  return (
    <div className="relative h-[clamp(34px,6.1vw,54px)] w-[clamp(34px,6.1vw,54px)]">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div
        className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[clamp(14px,3vw,22px)] font-bold leading-none ${
          isComplete ? (useLightText ? 'text-white' : 'text-black') : ''
        }`}
        style={{
          width: 'calc(100% - 10px)',
          height: 'calc(100% - 10px)',
          backgroundColor: isComplete ? accentColor : '#050505',
          color: isComplete ? (useLightText ? SP_COLORS.white : SP_COLORS.bg) : accentColor,
          border: `1.5px solid ${isComplete ? accentColor : '#ffffff26'}`
        }}
      >
        {label}
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
  onChange,
  inputRef
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <input
      ref={inputRef}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white md:text-[16px]"
      style={{ borderColor: '#ffffff30' }}
    />
  )
}
