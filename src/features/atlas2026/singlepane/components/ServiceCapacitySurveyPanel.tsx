import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import { AtlasPlusButton, AtlasTextButton } from '../../components/AtlasPrimitives'
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
import {
  BlockingSupportOverlay,
  BurdenCard,
  Field,
  Input,
  SurveyProgressHeader,
  type SurveySectionProgressItem
} from './serviceCapacitySurvey/SurveyChrome'
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
  onEnsurePartnerIdentifier: (header: {
    firstName: string
    lastName: string
    organizationName: string
    email?: string | null
  }) => Promise<PartnerIdentifierRecord>
  onSubmit: (payload: PartnerServiceCapacitySubmissionInput) => Promise<PartnerServiceCapacitySubmissionRecord | void> | PartnerServiceCapacitySubmissionRecord | void
  onDeleteDraft: (submissionId: string) => Promise<{ id: string; draftKey: string } | void> | { id: string; draftKey: string } | void
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
  onEnsurePartnerIdentifier: (header: {
    firstName: string
    lastName: string
    organizationName: string
    email?: string | null
  }) => Promise<PartnerIdentifierRecord>
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
const arrowIconUrl = new URL(
  '../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png',
  import.meta.url
).href
const SUPPORT_EMAIL = 'support@transitionalcare.net'
const SERVICE_CAPACITY_SAVE_ERROR = 'Unable to save service capacity survey.'

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

function getErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallbackMessage
}

function describeBlockingSaveIssue(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('supabase is required')) {
    return {
      title: 'Survey saving is not configured here',
      detail:
        'This deployment does not currently have the Supabase connection needed to persist partner service capacity survey records.',
      guidance:
        'You can ignore this for now and continue reviewing the survey, but any draft or submit action on this screen will not be saved.',
      canDismiss: true
    }
  }

  return {
    title: 'Unable to save this survey',
    detail: message,
    guidance: 'This save failed. You can continue reviewing the page, but the most recent changes may not persist.',
    canDismiss: true
  }
}

export default function ServiceCapacitySurveyPanel({
  submissionHistory,
  defaultHeader,
  isSaving,
  saveError,
  onSearchPartnerIdentifiers,
  onEnsurePartnerIdentifier,
  onSubmit,
  onDeleteDraft
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

  function openSurveyWithSeed({
    nextInitialSubmission,
    nextPersistedDraftOverride,
    nextLatestSavedSubmission
  }: {
    nextInitialSubmission: PartnerServiceCapacitySubmissionRecord | null
    nextPersistedDraftOverride: PersistedSurveyDraft | null
    nextLatestSavedSubmission: PartnerServiceCapacitySubmissionRecord | null
  }) {
    setInitialSubmission(nextInitialSubmission)
    setPersistedDraftOverride(nextPersistedDraftOverride)
    setLatestSavedSubmission(nextLatestSavedSubmission)
    // Force a fresh form instance so refs/autosave timers do not leak across distinct survey sessions.
    setSurveySessionKey((current) => current + 1)
    setActiveView('survey')
  }

  function handleCheckoutNewRecord() {
    persistSurveyDraft(null)
    openSurveyWithSeed({
      nextInitialSubmission: null,
      nextPersistedDraftOverride: null,
      nextLatestSavedSubmission: null
    })
    setDraftResolutionKey((current) => current + 1)
  }

  function handleEditDraftRecord(record: PartnerServiceCapacitySubmissionRecord) {
    persistSurveyDraft(null)
    openSurveyWithSeed({
      nextInitialSubmission: record,
      nextPersistedDraftOverride: null,
      nextLatestSavedSubmission: record
    })
    setDraftResolutionKey((current) => current + 1)
  }

  function handleResumeDraft() {
    if (!persistedDraft && !resumeDraftRecord) return
    openSurveyWithSeed({
      nextInitialSubmission: resumeDraftRecord,
      nextPersistedDraftOverride: persistedDraft,
      nextLatestSavedSubmission: resumeDraftRecord
    })
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

  async function handleDeleteDraftRecord(record: PartnerServiceCapacitySubmissionRecord) {
    const confirmed = window.confirm(`Delete draft record for ${record.header.organizationName || 'this survey'}?`)
    if (!confirmed) return
    await onDeleteDraft(record.id)
    if (persistedDraft && (persistedDraft.draftKey === record.draftKey || persistedDraft.draftKey === record.id)) {
      persistSurveyDraft(null)
      setDraftResolutionKey((current) => current + 1)
    }
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
      onDeleteDraftRecord={handleDeleteDraftRecord}
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
      onEnsurePartnerIdentifier={onEnsurePartnerIdentifier}
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
  onEnsurePartnerIdentifier,
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
  const [isEnsuringPartnerIdentifier, setIsEnsuringPartnerIdentifier] = useState(false)
  const [selectedPartnerIdentifierId, setSelectedPartnerIdentifierId] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [blockingSaveError, setBlockingSaveError] = useState<string | null>(saveError)
  const [dismissedBlockingSaveError, setDismissedBlockingSaveError] = useState<string | null>(null)
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(initialSubmission?.id ?? null)
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [isSurveyImmersed, setIsSurveyImmersed] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const firstNameInputRef = useRef<HTMLInputElement | null>(null)
  const hasAutoFocusedFirstName = useRef(false)
  const autosaveTimeoutRef = useRef<number | null>(null)
  const lastAutosavedSnapshotRef = useRef<string>('')
  const hasPendingAutosaveRef = useRef(false)
  const onSubmitRef = useRef(onSubmit)
  const surveyExperienceRef = useRef<HTMLDivElement | null>(null)
  const shouldScrollSurveyIntoViewRef = useRef(false)
  const completeSubmissionButtonRef = useRef<HTMLButtonElement | null>(null)
  const wasSurveyCompleteRef = useRef(false)

  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => {
    setBlockingSaveError(saveError)
  }, [saveError])

  useEffect(() => {
    if (!saveError) {
      setDismissedBlockingSaveError(null)
    }
  }, [saveError])

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

    // Guard async identity lookups so stale responses cannot overwrite newer header edits.
    let isActive = true
    const timeoutId = window.setTimeout(() => {
      setIsSearchingPartnerIdentifiers(true)
      onSearchPartnerIdentifiers(trimmedFirstName, trimmedLastName)
        .then(async (matches) => {
          if (!isActive) return
          if (matches.length) {
            setPartnerIdentifierMatches(matches)
            setPartnerIdentifierError(null)
            return
          }

          const trimmedOrganizationName = draft.header.organizationName.trim()
          if (!trimmedOrganizationName) {
            setPartnerIdentifierMatches([])
            setPartnerIdentifierError(null)
            return
          }

          setIsEnsuringPartnerIdentifier(true)
          const createdIdentifier = await onEnsurePartnerIdentifier({
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            organizationName: trimmedOrganizationName,
            email: draft.header.email.trim() || null
          })
          if (!isActive) return
          setPartnerIdentifierMatches([createdIdentifier])
          setSelectedPartnerIdentifierId(createdIdentifier.partnerId)
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
          setIsEnsuringPartnerIdentifier(false)
        })
    }, 250)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [
    draft.header.email,
    draft.header.firstName,
    draft.header.lastName,
    draft.header.organizationName,
    onEnsurePartnerIdentifier,
    onSearchPartnerIdentifiers,
    selectedPartnerIdentifierId
  ])

  const answersByPromptId = useMemo(() => new Map(draft.answers.map((answer) => [answer.promptId, answer])), [draft.answers])
  const visiblePromptEntries = useMemo<VisiblePromptEntry[]>(() => {
    const homelessnessAnswer = sections
      .flatMap((section) => section.prompts)
      .find((promptItem) => promptItem.normalizedZCode === 'Z59.0')
    const hasRatedHomelessness =
      typeof (homelessnessAnswer ? answersByPromptId.get(homelessnessAnswer.id)?.score : null) === 'number'

    return sections.flatMap((section) =>
      section.prompts.flatMap((promptItem) => {
        // Z59.01/Z59.02 remain hidden until Z59.0 is rated to preserve intended parent-first branching.
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
  const isSurveyComplete = visiblePromptEntries.length > 0 && completedCount === visiblePromptEntries.length
  const respondentValidationMessage = getRespondentValidationMessage(draft.header)
  const currentPromptEntry = visiblePromptEntries[currentPromptIndex] || null
  const currentPromptAnswer = currentPromptEntry ? answersByPromptId.get(currentPromptEntry.prompt.id) : null
  const currentAccentColor = currentPromptEntry ? getZCodeParentColor(currentPromptEntry.section.parentCode) || SP_COLORS.white : SP_COLORS.white
  const sectionProgress = useMemo<SurveySectionProgressItem[]>(
    () =>
      sections.map((section) => ({
        parentCode: section.parentCode,
        total: section.prompts.length,
        completed: section.prompts.reduce((count, promptItem) => count + (isAnswerComplete(answersByPromptId.get(promptItem.id)) ? 1 : 0), 0),
        accentColor: getZCodeParentColor(section.parentCode) || SP_COLORS.white,
        isCurrent: currentPromptEntry?.section.parentCode === section.parentCode
      })),
    [answersByPromptId, currentPromptEntry?.section.parentCode, sections]
  )
  const canAdvanceCurrentPrompt = isAnswerComplete(currentPromptAnswer || undefined)
  const lastAnsweredPromptIndex = useMemo(
    () =>
      visiblePromptEntries.reduce((lastIndex, entry, index) => (
        isAnswerComplete(answersByPromptId.get(entry.prompt.id)) ? index : lastIndex
      ), -1),
    [answersByPromptId, visiblePromptEntries]
  )
  const canResumePrompt = lastAnsweredPromptIndex >= 0 && lastAnsweredPromptIndex !== currentPromptIndex

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

  useEffect(() => {
    function updateSurveyImmersion() {
      const element = surveyExperienceRef.current
      if (!element) return
      setIsSurveyImmersed(element.getBoundingClientRect().top <= 20)
    }

    updateSurveyImmersion()
    window.addEventListener('scroll', updateSurveyImmersion, { passive: true })
    window.addEventListener('resize', updateSurveyImmersion)
    return () => {
      window.removeEventListener('scroll', updateSurveyImmersion)
      window.removeEventListener('resize', updateSurveyImmersion)
    }
  }, [])

  useEffect(() => {
    function updateViewportMode() {
      setIsMobileViewport(window.innerWidth < 768)
    }

    updateViewportMode()
    window.addEventListener('resize', updateViewportMode)
    return () => {
      window.removeEventListener('resize', updateViewportMode)
    }
  }, [])

  useEffect(() => {
    if (!shouldScrollSurveyIntoViewRef.current) return
    const element = surveyExperienceRef.current
    if (!element) return
    shouldScrollSurveyIntoViewRef.current = false
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [currentPromptIndex])

  useEffect(() => {
    if (!isSurveyComplete || wasSurveyCompleteRef.current) {
      wasSurveyCompleteRef.current = isSurveyComplete
      return
    }

    wasSurveyCompleteRef.current = true
    requestAnimationFrame(() => {
      completeSubmissionButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [isSurveyComplete])

  const useImmersiveSurveyLayout = isSurveyImmersed && !isMobileViewport

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

    // Debounce server writes so rapid slider/key edits collapse into a single draft save.
    autosaveTimeoutRef.current = window.setTimeout(() => {
      setAutosaveState('saving')
      setBlockingSaveError(null)
      Promise.resolve(onSubmitRef.current(payload))
        .then((savedRecord) => {
          if (savedRecord?.id) {
            setCurrentRecordId(savedRecord.id)
            if (savedRecord.draftKey) setDraftKey(savedRecord.draftKey)
          }
          lastAutosavedSnapshotRef.current = snapshot
          hasPendingAutosaveRef.current = false
          setAutosaveState('saved')
          setBlockingSaveError(null)
        })
        .catch((error) => {
          setAutosaveState('error')
          setBlockingSaveError(getErrorMessage(error, SERVICE_CAPACITY_SAVE_ERROR))
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
    setBlockingSaveError(null)
    let completedRecord: PartnerServiceCapacitySubmissionRecord | void
    try {
      completedRecord = await onSubmit({
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
    } catch (error) {
      setAutosaveState('error')
      setBlockingSaveError(getErrorMessage(error, SERVICE_CAPACITY_SAVE_ERROR))
      return
    }
    if (completedRecord?.id) setCurrentRecordId(completedRecord.id)
    persistSurveyDraft(null)
    setAutosaveState('saved')
    setBlockingSaveError(null)
    onCompleted(completedRecord || null)
  }

  function goToPreviousPrompt() {
    setCurrentPromptIndex((current) => Math.max(0, current - 1))
  }

  function goToNextPrompt() {
    setCurrentPromptIndex((current) => Math.min(visiblePromptEntries.length - 1, current + 1))
  }

  function goToLastAnsweredPrompt() {
    if (lastAnsweredPromptIndex < 0) return
    setCurrentPromptIndex(lastAnsweredPromptIndex)
    shouldScrollSurveyIntoViewRef.current = true
  }

  const lastSavedLabel = formatDateTimeLabel(latestSavedSubmission?.updatedAtIso || latestSavedSubmission?.submittedAtIso)
  const sessionResumeMessage = useMemo(() => {
    if (persistedDraftOverride) {
      return 'Restored your in-browser draft. The server copy updates as you answer each question.'
    }
    if (initialSubmission?.status === 'draft' && initialSubmission.id) {
      return 'Continuing this saved draft. Return to the history screen anytime; use “Resume draft” if you leave mid-survey.'
    }
    return null
  }, [persistedDraftOverride, initialSubmission?.id, initialSubmission?.status])
  const autosaveStatusLine = useMemo(() => {
    if (autosaveState === 'saving') {
      return 'Saving draft to the server…'
    }
    if (autosaveState === 'error') {
      return 'Draft did not save. You can keep working here; try again when the connection is stable.'
    }
    if (autosaveState === 'saved') {
      return lastSavedLabel
        ? `Draft saved ${lastSavedLabel}. Safe to leave—open “Resume draft” on the history screen to pick up.`
        : 'Draft saved. Safe to leave—use “Resume draft” on the history screen when you return.'
    }
    return 'Answers autosave as you go. Leave anytime and resume from the survey history screen.'
  }, [autosaveState, lastSavedLabel])
  const effectiveBlockingSaveError = blockingSaveError ?? saveError
  const blockingIssue = effectiveBlockingSaveError ? describeBlockingSaveIssue(effectiveBlockingSaveError) : null
  const visibleBlockingSaveError =
    effectiveBlockingSaveError && dismissedBlockingSaveError !== effectiveBlockingSaveError ? effectiveBlockingSaveError : null

  return (
    <div className="relative w-full rounded-[21px] border px-4 py-4 md:px-5 md:py-5" style={{ borderColor: '#ffffff40', backgroundColor: 'var(--surface-panel-soft)' }}>
      {visibleBlockingSaveError && blockingIssue ? (
        <BlockingSupportOverlay
          message={visibleBlockingSaveError}
          title={blockingIssue.title}
          detail={blockingIssue.detail}
          guidance={blockingIssue.guidance}
          supportEmail={SUPPORT_EMAIL}
          canDismiss={blockingIssue.canDismiss}
          onDismiss={() => setDismissedBlockingSaveError(visibleBlockingSaveError)}
        />
      ) : null}
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
        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
            <AtlasTextButton
              onClick={onBackToRecords}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[12px] md:text-[13px]"
              style={{ ['--button-border-color' as const]: '#ffffff32', color: SP_COLORS.white } as React.CSSProperties}
            >
              <img src={arrowIconUrl} alt="" aria-hidden="true" className="h-[1.2rem] w-[1.2rem] -rotate-90 opacity-90" />
              <span>back to list</span>
            </AtlasTextButton>
            <AtlasPlusButton
              onClick={onCheckoutNewRecord}
              label="Check out a new blank survey record"
            />
          </div>
          <small className="text-[12px] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            {lastSavedLabel ? `Server draft last updated ${lastSavedLabel}.` : 'No server draft yet—answers create one automatically.'}
          </small>
          <small className="max-w-[320px] text-right text-[12px] leading-snug md:text-[13px]" style={{ color: autosaveState === 'error' ? SP_COLORS.red : SP_COLORS.muted }}>
            {autosaveStatusLine}
          </small>
          {currentRecordId ? (
            <small className="font-mono text-[11px] lowercase text-white md:text-[12px]">
              record id {currentRecordId}
            </small>
          ) : null}
        </div>
      </div>

      {sessionResumeMessage ? (
        <div
          className="mt-4 rounded-[12px] border px-4 py-3 text-[13px] leading-snug md:text-[14px]"
          style={{ borderColor: `${SP_COLORS.yellow}55`, backgroundColor: `${SP_COLORS.yellow}10`, color: '#e8e8e8' }}
        >
          {sessionResumeMessage}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <section className="rounded-[16px] border p-4" style={{ borderColor: '#ffffff25' }}>
            <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd] md:text-[14px]">your details</small>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="lg:col-span-2">
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
                  <div className="mt-3 rounded-[12px] border px-3 py-3" style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <small className="text-[11px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
                        checking our system
                      </small>
                      <small className="text-[11px]" style={{ color: SP_COLORS.muted }}>
                        {isSearchingPartnerIdentifiers || isEnsuringPartnerIdentifier
                          ? 'checking...'
                          : selectedPartnerIdentifierId
                            ? 'linked'
                            : `${partnerIdentifierMatches.length} found`}
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
                          <AtlasTextButton
                            key={match.partnerId}
                            onClick={() => applyPartnerIdentifierMatch(match)}
                            className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-[border-color,background-color] duration-150 ease-out hover:border-white/40 hover:bg-white/5"
                            style={{ ['--button-border-color' as const]: '#ffffff20' } as React.CSSProperties}
                          >
                            <div>
                              <div className="text-[13px] text-white md:text-[14px]">
                                {match.firstName} {match.lastName}
                              </div>
                              <small className="block text-[12px] text-[#bdbdbd]">{match.organizationName}</small>
                            </div>
                            <small className="max-w-[220px] text-right text-[11px] text-[#9f9f9f] md:text-[12px]">{match.email || 'no email on file'}</small>
                          </AtlasTextButton>
                        ))}
                      </div>
                    ) : selectedPartnerIdentifierId ? (
                      <small className="mt-2 block text-[12px] text-[#bdbdbd]">
                        Existing partner identifier selected. Editing the name, email, or organization will clear the match.
                      </small>
                    ) : !isSearchingPartnerIdentifiers && !isEnsuringPartnerIdentifier ? (
                      <small className="mt-2 block text-[12px] text-[#8f8f8f]">
                        No match found. This person has been added to the system when organization info is present.
                      </small>
                    ) : null}
                  </div>
                ) : null}
                </Field>
              </div>
              <Field label="The Name of Your Organization*" requiredHint="This field is required.">
                <Input
                  value={draft.header.organizationName}
                  placeholder="organization name"
                  onChange={(value) => updateHeader('organizationName', value)}
                />
              </Field>
              <Field label="Your Email Address">
                <Input value={draft.header.email} placeholder="email address" onChange={(value) => updateHeader('email', value)} />
              </Field>
              <Field label="Your Job Title">
                <Input value={draft.header.jobTitle} placeholder="job title" onChange={(value) => updateHeader('jobTitle', value)} />
              </Field>
              <div className="lg:col-span-2">
                <Field label="Please select the option/s that apply to you*" requiredHint="This field is required.">
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((option) => {
                    const isSelected = draft.header.respondentRoles.includes(option.value)
                    return (
                      <AtlasTextButton
                        key={option.value}
                        onClick={() => toggleRole(option.value)}
                        className="px-3 py-1.5 text-[12px] md:text-[13px]"
                        style={{
                          ['--button-border-color' as const]: isSelected ? SP_COLORS.yellow : '#ffffff30',
                          color: isSelected ? SP_COLORS.yellow : SP_COLORS.white
                        } as React.CSSProperties}
                      >
                        {option.label}
                      </AtlasTextButton>
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
            </div>
            <small className="mt-4 block text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
              Fill in who is responding, then scroll to the questions—one card at a time, like a short Google Form. Required fields are enforced when you submit.
            </small>
          </section>
        </div>

        <section className="rounded-[16px] border p-4" style={{ borderColor: '#ffffff25' }}>
          <small className="mb-3 block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd] md:text-[14px]">scale guide</small>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {scale.map((option) => (
              <div key={option.value} className="rounded-[12px] border px-3 py-2" style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}>
                <div className="text-[13px] font-medium md:text-[15px]" style={{ color: option.value >= 7 ? SP_COLORS.deepGreen : option.value <= 3 ? SP_COLORS.red : SP_COLORS.yellow }}>
                  {option.value} - {option.label}
                </div>
                <small className="block text-[12px] text-[#bdbdbd] md:text-[13px]">{option.description}</small>
              </div>
            ))}
            <small className="pt-2 text-[12px] sm:col-span-2 xl:col-span-3 md:text-[14px]" style={{ color: SP_COLORS.muted }}>
              {completedCount} of {visiblePromptEntries.length} visible questions completed.
            </small>
            {isLoadingCatalog ? (
              <small className="text-[12px] sm:col-span-2 xl:col-span-3 md:text-[14px]" style={{ color: SP_COLORS.muted }}>
                loading survey definition from supabase...
              </small>
            ) : null}
          </div>
        </section>
      </div>

      {validationMessage && !effectiveBlockingSaveError ? (
        <div className="mt-4 rounded-[12px] border px-4 py-3 text-[13px] md:text-[14px]" style={{ borderColor: `${SP_COLORS.red}70`, color: SP_COLORS.red }}>
          {validationMessage}
        </div>
      ) : null}

      {!visiblePromptEntries.length && !isLoadingCatalog ? (
        <div className="mt-5 rounded-[16px] border px-4 py-4 text-[13px] md:px-5 md:text-[14px]" style={{ borderColor: `${SP_COLORS.red}70`, color: SP_COLORS.red }}>
          No survey questions are currently available.
        </div>
      ) : null}

      {currentPromptEntry ? (
        <div
          ref={surveyExperienceRef}
          className={`${useImmersiveSurveyLayout ? 'sticky top-0 z-20' : 'relative'} mt-5 transition-[transform] duration-500 ease-out`}
          style={{ scrollMarginTop: '0px' }}
        >
          <div
            className={`transition-[height,padding,border-radius,box-shadow,background-color] duration-500 ease-out ${
              useImmersiveSurveyLayout ? 'rounded-[16px] border border-white/10 bg-[#030303]/96 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-sm md:rounded-[20px] md:p-4' : ''
            }`}
            style={useImmersiveSurveyLayout ? { height: '100svh' } : undefined}
          >
            <div className={useImmersiveSurveyLayout ? 'grid h-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 overflow-hidden' : ''}>
              <SurveyProgressHeader
                currentIndex={currentPromptIndex}
                totalCount={visiblePromptEntries.length}
                completedCount={completedCount}
                parentCode={currentPromptEntry.section.parentCode}
                parentTheme={currentPromptEntry.section.theme}
                accentColor={currentAccentColor}
                sectionProgress={sectionProgress}
                pinToViewport={!useImmersiveSurveyLayout}
                className={useImmersiveSurveyLayout ? 'mt-0 shrink-0 px-3 py-2.5 md:px-4' : ''}
              />

              <div className={`${useImmersiveSurveyLayout ? 'min-h-0' : 'mt-5'}`}>
                <div
                  className={`rounded-[14px] border transition-[padding,margin,font-size] duration-500 ease-out ${
                    useImmersiveSurveyLayout ? 'px-3 py-2.5 md:px-4' : 'px-4 py-3 md:px-5'
                  }`}
                  style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}
                >
                  <small className="block text-[11px] uppercase tracking-[0.12em] md:text-[12px]" style={{ color: SP_COLORS.muted }}>
                    z-code burden questions
                  </small>
                  <div className={`mt-1 font-medium leading-snug text-white ${useImmersiveSurveyLayout ? 'text-[16px] md:text-[19px]' : 'text-[18px] md:text-[22px]'}`}>
                    Is this handled as a core specialty or is it a burden to have to handle it?
                  </div>
                </div>
              </div>
              <div className={useImmersiveSurveyLayout ? 'min-h-0 overflow-hidden' : ''}>
                <div className={useImmersiveSurveyLayout ? 'h-full' : ''}>
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
                    canResume={canResumePrompt}
                    compact={useImmersiveSurveyLayout}
                    onPreviousNavigate={goToPreviousPrompt}
                    onNextNavigate={goToNextPrompt}
                    onResumeNavigate={goToLastAnsweredPrompt}
                    onChange={(score) => updateAnswer(currentPromptEntry.prompt.id, { score, notEncountered: false })}
                    onNotEncounteredChange={(value) => updateAnswer(currentPromptEntry.prompt.id, { notEncountered: value, score: null })}
                  />
                </div>
              </div>
              {useImmersiveSurveyLayout && isSurveyComplete ? (
                <div className="flex shrink-0 justify-end border-t border-white/10 pt-3">
                  <AtlasTextButton
                    ref={completeSubmissionButtonRef}
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="px-5 py-2 text-[13px] font-medium md:text-[14px]"
                    style={{
                      ['--button-border-color' as const]: SP_COLORS.yellow,
                      color: SP_COLORS.yellow,
                      opacity: isSaving ? 0.6 : 1
                    } as React.CSSProperties}
                  >
                    {isSaving ? 'completing submission...' : 'complete submission'}
                  </AtlasTextButton>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : visiblePromptEntries.length > 0 ? (
        <div className="mt-5 rounded-[16px] border px-4 py-5 text-[13px] md:px-5 md:text-[14px]" style={{ borderColor: `${SP_COLORS.red}70`, color: SP_COLORS.red }}>
          Unable to load survey questions.
        </div>
      ) : isLoadingCatalog ? (
        <div className="mt-5 rounded-[16px] border px-4 py-4 text-[13px] md:px-5 md:text-[14px]" style={{ borderColor: '#ffffff25', color: SP_COLORS.muted }}>
          Loading survey questions…
        </div>
      ) : null}

      {!useImmersiveSurveyLayout && isSurveyComplete ? (
        <div className="mt-5 flex justify-end">
          <AtlasTextButton
            ref={completeSubmissionButtonRef}
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2 text-[13px] font-medium md:text-[14px]"
            style={{
              ['--button-border-color' as const]: SP_COLORS.yellow,
              color: SP_COLORS.yellow,
              opacity: isSaving ? 0.6 : 1
            } as React.CSSProperties}
          >
            {isSaving ? 'completing submission...' : 'complete submission'}
          </AtlasTextButton>
        </div>
      ) : null}
    </div>
  )
}
