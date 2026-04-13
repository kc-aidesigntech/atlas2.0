import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import {
  SERVICE_CAPACITY_FORM_VERSION,
  flattenSurveyPrompts
} from '../data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '../theme'
import {
  buildDraftAnswers,
  createBlankHeader,
  createDraftKey,
  formatDateTimeLabel,
  getRecordSortTime,
  hasMeaningfulDraftContent,
  persistSurveyDraft,
  type DraftAnswer,
  type DraftState,
  type PersistedSurveyDraft
} from './serviceCapacitySurvey/draft'
import { RecordManagementView } from './serviceCapacitySurvey/RecordManagementView'
import { BurdenCard, Field, Input, SurveyProgressHeader } from './serviceCapacitySurvey/SurveyChrome'
import { usePartnerServiceCapacityDraftResolver } from '../hooks/usePartnerServiceCapacityDraftResolver'
import { useServiceCapacitySurveyCatalog } from '../hooks/useServiceCapacitySurveyCatalog'
import type {
  PartnerIdentifierRecord,
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacityScaleOption,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole,
  ZCodeSurveyPrompt,
  ZCodeSurveySection,
} from '../types'

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
  persistedDraftOverride: PersistedSurveyDraft | null
  defaultHeader: PartnerServiceCapacityHeader
  isSaving: boolean
  saveError: string | null
  scale: PartnerServiceCapacityScaleOption[]
  sections: ZCodeSurveySection[]
  isLoadingCatalog: boolean
  onSearchPartnerIdentifiers: (firstName: string, lastName: string) => Promise<PartnerIdentifierRecord[]>
  onSubmit: (payload: PartnerServiceCapacitySubmissionInput) => Promise<PartnerServiceCapacitySubmissionRecord | void> | PartnerServiceCapacitySubmissionRecord | void
  onBackToRecords: () => void
  onCheckoutNewRecord: () => void
  onCompleted: (record: PartnerServiceCapacitySubmissionRecord | null) => void
}

const ROLE_OPTIONS: Array<{ value: PartnerSurveyRespondentRole; label: string }> = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'direct_service_provider', label: 'Direct Service Provider' },
  { value: 'other', label: 'Other' }
]
type PanelView = 'history' | 'survey'

interface VisiblePromptEntry {
  section: ZCodeSurveySection
  prompt: ZCodeSurveyPrompt
}

function getRespondentValidationMessage(header: PartnerServiceCapacityHeader) {
  const trimmedFirstName = header.firstName.trim()
  const trimmedLastName = header.lastName.trim()
  const trimmedOrganization = header.organizationName.trim()
  const selectedRoles = header.respondentRoles
  if (!trimmedFirstName || !trimmedLastName || !trimmedOrganization || !selectedRoles.length) {
    return 'Complete the required respondent details before submitting the survey.'
  }
  if (selectedRoles.includes('other') && !header.otherRoleText.trim()) {
    return 'Add the role description for “Other” before submitting the survey.'
  }
  return null
}

function isAnswerComplete(answer: DraftAnswer | PartnerServiceCapacityAnswer | undefined) {
  return Boolean(answer && (answer.notEncountered || typeof answer.score === 'number'))
}

export default function ServiceCapacitySurveyPanel({
  submissionHistory,
  defaultHeader,
  isSaving,
  saveError,
  onSearchPartnerIdentifiers,
  onSubmit
}: ServiceCapacitySurveyPanelProps) {
  const { scale, sections, isLoading: isLoadingCatalog } = useServiceCapacitySurveyCatalog()
  const totalSurveyCardCount = useMemo(() => sections.reduce((count, section) => count + section.prompts.length, 0), [sections])
  const sortedSubmissionHistory = useMemo(
    () => submissionHistory.slice().sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left)),
    [submissionHistory]
  )
  const [activeView, setActiveView] = useState<PanelView>('history')
  const [surveySessionKey, setSurveySessionKey] = useState(0)
  const [initialSubmission, setInitialSubmission] = useState<PartnerServiceCapacitySubmissionRecord | null>(null)
  const [persistedDraftOverride, setPersistedDraftOverride] = useState<PersistedSurveyDraft | null>(null)
  const [latestSavedSubmission, setLatestSavedSubmission] = useState<PartnerServiceCapacitySubmissionRecord | null>(null)
  const [draftResolutionKey, setDraftResolutionKey] = useState(0)
  const {
    persistedDraft,
    resumeDraftRecord,
    isResolvingResumeDraft,
    resumeDraftError,
    resumeDraftUpdatedAtIso
  } = usePartnerServiceCapacityDraftResolver(defaultHeader.organizationName, sortedSubmissionHistory, draftResolutionKey)

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
    setPersistedDraftOverride(null)
    setLatestSavedSubmission(null)
    setSurveySessionKey((current) => current + 1)
    setDraftResolutionKey((current) => current + 1)
    setActiveView('survey')
  }

  function handleEditDraftRecord(record: PartnerServiceCapacitySubmissionRecord) {
    persistSurveyDraft(null)
    setInitialSubmission(record)
    setPersistedDraftOverride(null)
    setLatestSavedSubmission(record)
    setSurveySessionKey((current) => current + 1)
    setDraftResolutionKey((current) => current + 1)
    setActiveView('survey')
  }

  function handleResumeDraft() {
    if (!persistedDraft && !resumeDraftRecord) return
    setInitialSubmission(resumeDraftRecord)
    setPersistedDraftOverride(persistedDraft)
    setLatestSavedSubmission(resumeDraftRecord)
    setSurveySessionKey((current) => current + 1)
    setActiveView('survey')
  }

  function handleReturnToHistory() {
    setInitialSubmission(null)
    setPersistedDraftOverride(null)
    setActiveView('history')
    setDraftResolutionKey((current) => current + 1)
  }

  function handleCompletedSubmission(record: PartnerServiceCapacitySubmissionRecord | null) {
    if (record) {
      setLatestSavedSubmission(record)
    }
    handleReturnToHistory()
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
      totalSurveyCardCount={totalSurveyCardCount}
      resumeDraftRecord={resumeDraftRecord}
      resumeDraftPersistedAtLabel={formatDateTimeLabel(resumeDraftUpdatedAtIso)}
      hasPersistedDraft={Boolean(persistedDraft)}
      isResolvingResumeDraft={isResolvingResumeDraft}
      resumeDraftError={resumeDraftError}
      onCheckoutNewRecord={handleCheckoutNewRecord}
      onResumeDraft={handleResumeDraft}
      onEditDraftRecord={handleEditDraftRecord}
    />
  ) : (
    <ServiceCapacitySurveyForm
      key={surveySessionKey}
      initialSubmission={initialSubmission}
      latestSavedSubmission={latestSavedSubmission}
      persistedDraftOverride={persistedDraftOverride}
      defaultHeader={defaultHeader}
      isSaving={isSaving}
      saveError={saveError}
      scale={scale}
      sections={sections}
      isLoadingCatalog={isLoadingCatalog}
      onSearchPartnerIdentifiers={onSearchPartnerIdentifiers}
      onSubmit={handleSubmit}
      onBackToRecords={handleReturnToHistory}
      onCheckoutNewRecord={handleCheckoutNewRecord}
      onCompleted={handleCompletedSubmission}
    />
  )
}

function ServiceCapacitySurveyForm({
  initialSubmission,
  latestSavedSubmission,
  persistedDraftOverride,
  defaultHeader,
  isSaving,
  saveError,
  scale,
  sections,
  isLoadingCatalog,
  onSearchPartnerIdentifiers,
  onSubmit,
  onBackToRecords,
  onCheckoutNewRecord,
  onCompleted
}: ServiceCapacitySurveyFormProps) {
  const prompts = useMemo(() => flattenSurveyPrompts(sections), [sections])
  const [draft, setDraft] = useState<DraftState>(() => ({
    header: persistedDraftOverride?.header || initialSubmission?.header || { ...createBlankHeader(), ...defaultHeader },
    answers: persistedDraftOverride?.answers || buildDraftAnswers(initialSubmission, prompts)
  }))
  const [draftKey, setDraftKey] = useState(() => persistedDraftOverride?.draftKey || initialSubmission?.draftKey || createDraftKey())
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [partnerIdentifierMatches, setPartnerIdentifierMatches] = useState<PartnerIdentifierRecord[]>([])
  const [partnerIdentifierError, setPartnerIdentifierError] = useState<string | null>(null)
  const [isSearchingPartnerIdentifiers, setIsSearchingPartnerIdentifiers] = useState(false)
  const [selectedPartnerIdentifierId, setSelectedPartnerIdentifierId] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(initialSubmission?.id || null)
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const firstNameInputRef = useRef<HTMLInputElement | null>(null)
  const hasAutoFocusedFirstName = useRef(false)
  const autosaveTimeoutRef = useRef<number | null>(null)
  const lastAutosavedSnapshotRef = useRef<string>('')
  const hasPendingAutosaveRef = useRef(false)
  const onSubmitRef = useRef(onSubmit)

  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    if (!prompts.length) return
    setDraft((current) => {
      if (current.answers.length) return current
      return {
        ...current,
        answers: buildDraftAnswers(initialSubmission, prompts)
      }
    })
  }, [initialSubmission, prompts])

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
  const visiblePromptEntries = useMemo<VisiblePromptEntry[]>(() => {
    const homelessnessAnswer = sections
      .flatMap((section) => section.prompts)
      .find((promptItem) => promptItem.normalizedZCode === 'Z59.0')
    const hasRatedHomelessness =
      typeof (homelessnessAnswer ? answersByPromptId.get(homelessnessAnswer.id)?.score : null) === 'number'

    return sections.flatMap((section) =>
      section.prompts.flatMap((promptItem) => {
        if ((promptItem.normalizedZCode === 'Z59.01' || promptItem.normalizedZCode === 'Z59.02') && !hasRatedHomelessness) {
          return []
        }
        return [{ section, prompt: promptItem }]
      })
    )
  }, [answersByPromptId, sections])
  const completedCount = useMemo(
    () => visiblePromptEntries.reduce((count, entry) => count + (isAnswerComplete(answersByPromptId.get(entry.prompt.id)) ? 1 : 0), 0),
    [answersByPromptId, visiblePromptEntries]
  )
  const respondentValidationMessage = getRespondentValidationMessage(draft.header)
  const currentPromptEntry = visiblePromptEntries[currentPromptIndex] || null
  const currentPromptAnswer = currentPromptEntry ? answersByPromptId.get(currentPromptEntry.prompt.id) : null
  const currentAccentColor = currentPromptEntry ? getZCodeParentColor(currentPromptEntry.section.parentCode) || SP_COLORS.white : SP_COLORS.white
  const canAdvanceCurrentPrompt = isAnswerComplete(currentPromptAnswer || undefined)

  useEffect(() => {
    if (!respondentValidationMessage || hasAutoFocusedFirstName.current) return
    const firstInput = firstNameInputRef.current
    if (!firstInput) return

    hasAutoFocusedFirstName.current = true
    requestAnimationFrame(() => {
      firstInput.focus()
      firstInput.select()
    })
  }, [draft.header.firstName, respondentValidationMessage])

  useEffect(() => {
    setCurrentPromptIndex((current) => {
      if (!visiblePromptEntries.length) return 0
      return Math.max(0, Math.min(current, visiblePromptEntries.length - 1))
    })
  }, [visiblePromptEntries])

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

  function updateAnswer(promptId: string, updates: Partial<DraftAnswer>) {
    hasPendingAutosaveRef.current = true
    setDraft((current) => ({
      ...current,
      answers: current.answers.map((answer) => {
        if (answer.promptId === promptId) {
          return { ...answer, ...updates }
        }
        if (
          promptId === 'z59-0' &&
          (answer.promptId === 'z59-01' || answer.promptId === 'z59-02') &&
          (updates.notEncountered === true || ('score' in updates && typeof updates.score !== 'number'))
        ) {
          return { ...answer, score: null, notEncountered: false }
        }
        return answer
      })
    }))
  }

  useEffect(() => {
    const localDraft: PersistedSurveyDraft = {
      draftKey,
      isSurveyStarted: true,
      header: draft.header,
      answers: draft.answers
    }
    persistSurveyDraft(hasMeaningfulDraftContent(draft.header, draft.answers) ? localDraft : null)

    if (!hasMeaningfulDraftContent(draft.header, draft.answers) || !draftKey) {
      setAutosaveState('idle')
      return
    }
    if (!hasPendingAutosaveRef.current) return

    const answeredAnswers = draft.answers.filter((answer) => answer.notEncountered || typeof answer.score === 'number')
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
  }, [draft, draftKey])

  async function handleSubmit() {
    const trimmedFirstName = draft.header.firstName.trim()
    const trimmedLastName = draft.header.lastName.trim()
    const trimmedOrganization = draft.header.organizationName.trim()
    if (respondentValidationMessage) {
      setValidationMessage(respondentValidationMessage)
      return
    }
    if (visiblePromptEntries.some((entry) => !isAnswerComplete(answersByPromptId.get(entry.prompt.id)))) {
      setValidationMessage('Complete each visible question or mark it as not encountered before saving the survey.')
      return
    }

    setValidationMessage(null)
    const completedAnswers = draft.answers.filter((answer) => answer.notEncountered || typeof answer.score === 'number')
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
    onCompleted(completedRecord || null)
  }

  function goToPreviousPrompt() {
    setCurrentPromptIndex((current) => Math.max(0, current - 1))
  }

  function goToNextPrompt() {
    setCurrentPromptIndex((current) => Math.min(visiblePromptEntries.length - 1, current + 1))
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
          {currentRecordId ? (
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
            <small className="mt-4 block text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
              Complete the respondent details and move through the survey one question at a time. Drafts save automatically as you go.
            </small>
          </section>
        </div>

        <section className="rounded-[24px] border p-4" style={{ borderColor: '#ffffff25' }}>
          <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd] md:text-[14px]">scale guide</small>
          <div className="grid gap-2">
            {scale.map((option) => (
              <div key={option.value} className="rounded-[18px] border px-3 py-2" style={{ borderColor: '#ffffff18', backgroundColor: '#060606' }}>
                <div className="text-[13px] font-medium md:text-[15px]" style={{ color: option.value >= 7 ? SP_COLORS.deepGreen : option.value <= 3 ? SP_COLORS.red : SP_COLORS.yellow }}>
                  {option.value} - {option.label}
                </div>
                <small className="block text-[12px] text-[#bdbdbd] md:text-[13px]">{option.description}</small>
              </div>
            ))}
            <small className="pt-2 text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
              {completedCount} of {visiblePromptEntries.length} visible questions completed.
            </small>
            {isLoadingCatalog ? (
              <small className="text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
                loading survey definition from supabase...
              </small>
            ) : null}
          </div>
        </section>
      </div>

      {validationMessage || saveError ? (
        <div className="mt-4 rounded-[18px] border px-4 py-3 text-[13px] md:text-[14px]" style={{ borderColor: `${SP_COLORS.red}70`, color: SP_COLORS.red }}>
          {validationMessage || saveError}
        </div>
      ) : null}

      {currentPromptEntry ? (
        <>
          <SurveyProgressHeader
            currentIndex={currentPromptIndex}
            totalCount={visiblePromptEntries.length}
            completedCount={completedCount}
            parentCode={currentPromptEntry.section.parentCode}
            parentTheme={currentPromptEntry.section.theme}
            accentColor={currentAccentColor}
          />

          <div className="mt-5">
            <BurdenCard
              promptItem={currentPromptEntry.prompt}
              scale={scale}
              score={currentPromptAnswer?.score ?? null}
              notEncountered={currentPromptAnswer?.notEncountered ?? false}
              accentColor={currentAccentColor}
              currentIndex={currentPromptIndex}
              totalCount={visiblePromptEntries.length}
              hasPrevious={currentPromptIndex > 0}
              hasNext={currentPromptIndex < visiblePromptEntries.length - 1}
              canAdvance={canAdvanceCurrentPrompt}
              onPreviousNavigate={goToPreviousPrompt}
              onNextNavigate={goToNextPrompt}
              onChange={(score) => updateAnswer(currentPromptEntry.prompt.id, { score, notEncountered: false })}
              onNotEncounteredChange={(value) => updateAnswer(currentPromptEntry.prompt.id, { notEncountered: value, score: value ? null : currentPromptAnswer?.score ?? null })}
            />
          </div>
        </>
      ) : null}

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
    </div>
  )
}
