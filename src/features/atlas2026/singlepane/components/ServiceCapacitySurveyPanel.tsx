import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import {
  SERVICE_CAPACITY_FORM_VERSION,
  SERVICE_CAPACITY_SCALE,
  SERVICE_CAPACITY_SURVEY_SECTIONS
} from '../data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '../theme'
import {
  buildDraftAnswers,
  createBlankHeader,
  createDraftKey,
  formatDateTimeLabel,
  getRecordSortTime,
  hasMeaningfulDraftContent,
  loadPersistedSurveyDraft,
  persistSurveyDraft,
  type DraftAnswer,
  type DraftState,
  type PersistedSurveyDraft
} from './serviceCapacitySurvey/draft'
import { RecordManagementView } from './serviceCapacitySurvey/RecordManagementView'
import { BurdenCard, Field, Input, SurveyProgressHeader } from './serviceCapacitySurvey/SurveyChrome'
import type {
  PartnerIdentifierRecord,
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole,
} from '../types'

const downArrowUrl = new URL('../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png', import.meta.url).toString()

interface ServiceCapacitySurveyPanelProps {
  submissionHistory: PartnerServiceCapacitySubmissionRecord[]
  defaultHeader: PartnerServiceCapacityHeader
  isSaving: boolean
  saveError: string | null
  onSearchPartnerIdentifiers: (firstName: string, lastName: string) => Promise<PartnerIdentifierRecord[]>
  onSubmit: (payload: PartnerServiceCapacitySubmissionInput) => Promise<PartnerServiceCapacitySubmissionRecord | void> | PartnerServiceCapacitySubmissionRecord | void
}

interface ServiceCapacitySurveyFormProps {
  initialSubmission: PartnerServiceCapacitySubmissionRecord | null
  latestSavedSubmission: PartnerServiceCapacitySubmissionRecord | null
  defaultHeader: PartnerServiceCapacityHeader
  isSaving: boolean
  saveError: string | null
  onSearchPartnerIdentifiers: (firstName: string, lastName: string) => Promise<PartnerIdentifierRecord[]>
  onSubmit: (payload: PartnerServiceCapacitySubmissionInput) => Promise<PartnerServiceCapacitySubmissionRecord | void> | PartnerServiceCapacitySubmissionRecord | void
  onBackToRecords: () => void
  onCheckoutNewRecord: () => void
}

const ROLE_OPTIONS: Array<{ value: PartnerSurveyRespondentRole; label: string }> = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'direct_service_provider', label: 'Direct Service Provider' },
  { value: 'other', label: 'Other' }
]
type PanelView = 'history' | 'survey'

interface SectionProgress {
  parentCode: string
  theme: string
  accentColor: string
  total: number
  completed: number
  ratio: number
}

const TOTAL_SURVEY_CARD_COUNT = SERVICE_CAPACITY_SURVEY_SECTIONS.reduce((count, section) => count + section.prompts.length, 0)

export default function ServiceCapacitySurveyPanel({
  submissionHistory,
  defaultHeader,
  isSaving,
  saveError,
  onSearchPartnerIdentifiers,
  onSubmit
}: ServiceCapacitySurveyPanelProps) {
  const sortedSubmissionHistory = useMemo(
    () => submissionHistory.slice().sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left)),
    [submissionHistory]
  )
  const [activeView, setActiveView] = useState<PanelView>('history')
  const [surveySessionKey, setSurveySessionKey] = useState(0)
  const [initialSubmission, setInitialSubmission] = useState<PartnerServiceCapacitySubmissionRecord | null>(null)
  const [latestSavedSubmission, setLatestSavedSubmission] = useState<PartnerServiceCapacitySubmissionRecord | null>(null)

  useEffect(() => {
    setLatestSavedSubmission((current) => {
      if (!current) return current
      return (
        sortedSubmissionHistory.find((record) => record.draftKey === current.draftKey || record.id === current.id) ||
        current
      )
    })
  }, [sortedSubmissionHistory])

  function handleCheckoutNewRecord() {
    persistSurveyDraft(null)
    setInitialSubmission(null)
    setLatestSavedSubmission(null)
    setSurveySessionKey((current) => current + 1)
    setActiveView('survey')
  }

  function handleEditDraftRecord(record: PartnerServiceCapacitySubmissionRecord) {
    persistSurveyDraft(null)
    setInitialSubmission(record)
    setLatestSavedSubmission(record)
    setSurveySessionKey((current) => current + 1)
    setActiveView('survey')
  }

  async function handleSubmit(payload: PartnerServiceCapacitySubmissionInput) {
    const savedRecord = await onSubmit(payload)
    if (savedRecord) {
      setLatestSavedSubmission(savedRecord)
    }
    return savedRecord
  }

  return activeView === 'history' ? (
    <RecordManagementView
      records={sortedSubmissionHistory}
      totalSurveyCardCount={TOTAL_SURVEY_CARD_COUNT}
      onCheckoutNewRecord={handleCheckoutNewRecord}
      onEditDraftRecord={handleEditDraftRecord}
    />
  ) : (
    <ServiceCapacitySurveyForm
      key={surveySessionKey}
      initialSubmission={initialSubmission}
      latestSavedSubmission={latestSavedSubmission}
      defaultHeader={defaultHeader}
      isSaving={isSaving}
      saveError={saveError}
      onSearchPartnerIdentifiers={onSearchPartnerIdentifiers}
      onSubmit={handleSubmit}
      onBackToRecords={() => setActiveView('history')}
      onCheckoutNewRecord={handleCheckoutNewRecord}
    />
  )
}

function ServiceCapacitySurveyForm({
  initialSubmission,
  latestSavedSubmission,
  defaultHeader,
  isSaving,
  saveError,
  onSearchPartnerIdentifiers,
  onSubmit,
  onBackToRecords,
  onCheckoutNewRecord
}: ServiceCapacitySurveyFormProps) {
  const persistedLocalDraft = useMemo(() => loadPersistedSurveyDraft(), [])
  const [draft, setDraft] = useState<DraftState>(() => ({
    header: persistedLocalDraft?.header || initialSubmission?.header || { ...createBlankHeader(), ...defaultHeader },
    answers: persistedLocalDraft?.answers || buildDraftAnswers(initialSubmission)
  }))
  const [draftKey, setDraftKey] = useState(() => persistedLocalDraft?.draftKey || initialSubmission?.draftKey || createDraftKey())
  const [isSurveyStarted, setIsSurveyStarted] = useState(() => persistedLocalDraft?.isSurveyStarted || Boolean(initialSubmission))
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [partnerIdentifierMatches, setPartnerIdentifierMatches] = useState<PartnerIdentifierRecord[]>([])
  const [partnerIdentifierError, setPartnerIdentifierError] = useState<string | null>(null)
  const [isSearchingPartnerIdentifiers, setIsSearchingPartnerIdentifiers] = useState(false)
  const [selectedPartnerIdentifierId, setSelectedPartnerIdentifierId] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(initialSubmission?.id || null)
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
    const trimmedFirstName = draft.header.firstName.trim()
    const trimmedLastName = draft.header.lastName.trim()
    if (!trimmedFirstName || !trimmedLastName || selectedPartnerIdentifierId) {
      setPartnerIdentifierMatches([])
      setPartnerIdentifierError(null)
      setIsSearchingPartnerIdentifiers(false)
      return
    }

    let isActive = true
    const timeoutId = window.setTimeout(() => {
      setIsSearchingPartnerIdentifiers(true)
      onSearchPartnerIdentifiers(trimmedFirstName, trimmedLastName)
        .then((matches) => {
          if (!isActive) return
          setPartnerIdentifierMatches(matches)
          setPartnerIdentifierError(null)
        })
        .catch((error) => {
          if (!isActive) return
          setPartnerIdentifierMatches([])
          setPartnerIdentifierError(error instanceof Error ? error.message : 'Unable to search partner identifiers.')
        })
        .finally(() => {
          if (!isActive) return
          setIsSearchingPartnerIdentifiers(false)
        })
    }, 250)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [draft.header.firstName, draft.header.lastName, onSearchPartnerIdentifiers, selectedPartnerIdentifierId])

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
    if (key === 'firstName' || key === 'lastName' || key === 'email' || key === 'organizationName') {
      setSelectedPartnerIdentifierId(null)
    }
    setDraft((current) => ({
      ...current,
      header: {
        ...current.header,
        [key]: value
      }
    }))
    setValidationMessage(null)
  }

  function applyPartnerIdentifierMatch(match: PartnerIdentifierRecord) {
    hasPendingAutosaveRef.current = true
    setSelectedPartnerIdentifierId(match.partnerId)
    setPartnerIdentifierMatches([])
    setPartnerIdentifierError(null)
    setDraft((current) => ({
      ...current,
      header: {
        ...current.header,
        firstName: match.firstName,
        lastName: match.lastName,
        email: match.email,
        organizationName: match.organizationName
      }
    }))
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
    const completedAnswers = draft.answers.filter(
      (answer): answer is DraftAnswer & PartnerServiceCapacityAnswer => typeof answer.score === 'number'
    )
    const completedRecord = await onSubmit({
      draftKey,
      status: 'completed',
      completedAtIso: new Date().toISOString(),
      header: {
        ...draft.header,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: draft.header.email.trim(),
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

  const lastSavedLabel = formatDateTimeLabel(latestSavedSubmission?.updatedAtIso || latestSavedSubmission?.submittedAtIso)

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
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onBackToRecords}
              className="rounded-full border px-3 py-1.5 text-[12px] md:text-[13px]"
              style={{ borderColor: '#ffffff32', color: SP_COLORS.white }}
            >
              record history
            </button>
            <button
              type="button"
              onClick={onCheckoutNewRecord}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-[24px] font-light"
              style={{ borderColor: SP_COLORS.yellow, color: SP_COLORS.yellow }}
              aria-label="Check out a new blank survey record"
              title="Check out a new blank survey record"
            >
              +
            </button>
          </div>
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
                {draft.header.firstName.trim() && draft.header.lastName.trim() ? (
                  <div className="mt-3 rounded-[18px] border px-3 py-3" style={{ borderColor: '#ffffff18', backgroundColor: '#050505' }}>
                    <div className="flex items-center justify-between gap-3">
                      <small className="text-[11px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
                        existing identifier records
                      </small>
                      <small className="text-[11px]" style={{ color: SP_COLORS.muted }}>
                        {isSearchingPartnerIdentifiers ? 'searching...' : selectedPartnerIdentifierId ? 'linked' : `${partnerIdentifierMatches.length} found`}
                      </small>
                    </div>
                    {partnerIdentifierError ? (
                      <small className="mt-2 block text-[12px]" style={{ color: SP_COLORS.red }}>
                        {partnerIdentifierError}
                      </small>
                    ) : null}
                    {!selectedPartnerIdentifierId && partnerIdentifierMatches.length ? (
                      <div className="mt-3 space-y-2">
                        <small className="block text-[12px] text-[#bdbdbd]">
                          Choose an existing partner identifier if this person already exists in the partners tab.
                        </small>
                        {partnerIdentifierMatches.map((match) => (
                          <button
                            key={match.partnerId}
                            type="button"
                            onClick={() => applyPartnerIdentifierMatch(match)}
                            className="flex w-full items-start justify-between gap-3 rounded-[16px] border px-3 py-2 text-left transition-[border-color,background-color] duration-150 ease-out hover:border-white/40 hover:bg-white/5"
                            style={{ borderColor: '#ffffff20' }}
                          >
                            <div>
                              <div className="text-[13px] text-white md:text-[14px]">
                                {match.firstName} {match.lastName}
                              </div>
                              <small className="block text-[12px] text-[#bdbdbd]">{match.organizationName}</small>
                            </div>
                            <small className="max-w-[220px] text-right text-[11px] text-[#9f9f9f] md:text-[12px]">{match.email || 'no email on file'}</small>
                          </button>
                        ))}
                      </div>
                    ) : selectedPartnerIdentifierId ? (
                      <small className="mt-2 block text-[12px] text-[#bdbdbd]">
                        Existing partner identifier selected. Editing the name, email, or organization will clear the match.
                      </small>
                    ) : !isSearchingPartnerIdentifiers ? (
                      <small className="mt-2 block text-[12px] text-[#8f8f8f]">
                        No existing identifier records match this name.
                      </small>
                    ) : null}
                  </div>
                ) : null}
              </Field>
              <Field label="Your Email Address">
                <Input value={draft.header.email} placeholder="email address" onChange={(value) => updateHeader('email', value)} />
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
