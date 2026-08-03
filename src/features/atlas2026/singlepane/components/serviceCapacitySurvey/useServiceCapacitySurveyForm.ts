import { useEffect, useMemo, useRef, useState } from 'react'
import { getZCodeParentColor } from '@atlas/shared'
import { flattenSurveyPrompts } from '../../data/serviceCapacitySurveyCatalog'
import { toSupabaseErrorMessage } from '../../data-access/supabaseOptionalData'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  PartnerIdentifierRecord,
  PartnerServiceCapacityAnswer,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  ZCodeSurveySection
} from '../../types'
import {
  buildDraftAnswers,
  createBlankHeader,
  createDraftKey,
  formatDateTimeLabel,
  hasMeaningfulDraftContent,
  persistSurveyDraft,
  type DraftAnswer,
  type DraftState,
  type PersistedSurveyDraft
} from './draft'
import { getRespondentValidationMessage, type SurveyCardConfig } from './config'
import type { SurveySectionProgressItem } from './SurveyChrome'

const AUTOSAVE_RETRY_DELAY_MS = 2500
const AUTOSAVE_MAX_RETRY_ATTEMPTS = 3
const SAVE_ERROR = 'Unable to save service capacity survey.'

interface FormControllerOptions {
  initialSubmission: PartnerServiceCapacitySubmissionRecord | null
  latestSavedSubmission: PartnerServiceCapacitySubmissionRecord | null
  persistedDraftOverride: PersistedSurveyDraft | null
  defaultHeader: PartnerServiceCapacityHeader
  sections: ZCodeSurveySection[]
  surveyConfig: SurveyCardConfig
  onSearchPartnerIdentifiers: (firstName: string, lastName: string) => Promise<PartnerIdentifierRecord[]>
  onEnsurePartnerIdentifier: (header: {
    firstName: string
    lastName: string
    organizationName: string
    email?: string | null
  }) => Promise<PartnerIdentifierRecord>
  onSubmit: (
    payload: PartnerServiceCapacitySubmissionInput
  ) => Promise<PartnerServiceCapacitySubmissionRecord | void> | PartnerServiceCapacitySubmissionRecord | void
  onCompleted: (record: PartnerServiceCapacitySubmissionRecord | null) => void
}

function isSubmissionRecord(
  value: PartnerServiceCapacitySubmissionRecord | void
): value is PartnerServiceCapacitySubmissionRecord {
  return Boolean(value && typeof value === 'object' && 'id' in value)
}

function isAnswerComplete(answer: DraftAnswer | PartnerServiceCapacityAnswer | undefined) {
  return Boolean(answer && (answer.notEncountered || typeof answer.score === 'number'))
}

export function useServiceCapacitySurveyForm(options: FormControllerOptions) {
  const {
    initialSubmission,
    latestSavedSubmission,
    persistedDraftOverride,
    defaultHeader,
    sections,
    surveyConfig,
    onSearchPartnerIdentifiers,
    onEnsurePartnerIdentifier,
    onSubmit,
    onCompleted
  } = options
  const prompts = useMemo(() => flattenSurveyPrompts(sections), [sections])
  const [draft, setDraft] = useState<DraftState>(() => ({
    header: persistedDraftOverride?.header || initialSubmission?.header || { ...createBlankHeader(), ...defaultHeader },
    answers: persistedDraftOverride?.answers || buildDraftAnswers(initialSubmission, prompts)
  }))
  const [draftKey, setDraftKey] = useState(
    () => persistedDraftOverride?.draftKey || initialSubmission?.draftKey || createDraftKey()
  )
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [partnerIdentifierMatches, setPartnerIdentifierMatches] = useState<PartnerIdentifierRecord[]>([])
  const [partnerIdentifierError, setPartnerIdentifierError] = useState<string | null>(null)
  const [isSearchingPartnerIdentifiers, setIsSearchingPartnerIdentifiers] = useState(false)
  const [isEnsuringPartnerIdentifier, setIsEnsuringPartnerIdentifier] = useState(false)
  const [selectedPartnerIdentifierId, setSelectedPartnerIdentifierId] = useState<string | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [autosaveRetryTick, setAutosaveRetryTick] = useState(0)
  const [saveContinuityMessage, setSaveContinuityMessage] = useState<string | null>(null)
  const [blockingSaveError, setBlockingSaveError] = useState<string | null>(null)
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(initialSubmission?.id ?? null)
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const firstNameInputRef = useRef<HTMLInputElement | null>(null)
  const autosaveTimeoutRef = useRef<number | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)
  const retryAttemptsRef = useRef(0)
  const lastSnapshotRef = useRef('')
  const hasPendingAutosaveRef = useRef(false)
  const onSubmitRef = useRef(onSubmit)

  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  useEffect(() => () => {
    if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (!prompts.length) return
    setDraft((current) => current.answers.length ? current : {
      ...current,
      answers: buildDraftAnswers(initialSubmission, prompts)
    })
  }, [initialSubmission, prompts])

  useEffect(() => {
    const firstName = draft.header.firstName.trim()
    const lastName = draft.header.lastName.trim()
    if (!surveyConfig.enablePartnerIdentifierLookup || !firstName || !lastName || selectedPartnerIdentifierId) {
      setPartnerIdentifierMatches([])
      setPartnerIdentifierError(null)
      return
    }
    // Cancel stale identity lookups so older responses cannot overwrite newer respondent edits.
    let isActive = true
    const timeoutId = window.setTimeout(() => {
      setIsSearchingPartnerIdentifiers(true)
      onSearchPartnerIdentifiers(firstName, lastName)
        .then(async (matches) => {
          if (!isActive) return
          if (matches.length) {
            setPartnerIdentifierMatches(matches)
            return
          }
          const organizationName = draft.header.organizationName.trim()
          if (!organizationName) {
            setPartnerIdentifierMatches([])
            return
          }
          setIsEnsuringPartnerIdentifier(true)
          const created = await onEnsurePartnerIdentifier({
            firstName,
            lastName,
            organizationName,
            email: draft.header.email.trim() || null
          })
          if (!isActive) return
          setPartnerIdentifierMatches([created])
          setSelectedPartnerIdentifierId(created.partnerId)
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
    selectedPartnerIdentifierId,
    surveyConfig.enablePartnerIdentifierLookup
  ])

  const answersByPromptId = useMemo(
    () => new Map(draft.answers.map((answer) => [answer.promptId, answer])),
    [draft.answers]
  )
  const visiblePromptEntries = useMemo(() => {
    const homelessnessPrompt = sections.flatMap((section) => section.prompts)
      .find((prompt) => prompt.normalizedZCode === 'Z59.0')
    const hasRatedHomelessness =
      typeof (homelessnessPrompt ? answersByPromptId.get(homelessnessPrompt.id)?.score : null) === 'number'
    return sections.flatMap((section) => section.prompts.flatMap((prompt) => {
      // Child homelessness codes remain hidden until their parent rating establishes branch context.
      if ((prompt.normalizedZCode === 'Z59.01' || prompt.normalizedZCode === 'Z59.02') && !hasRatedHomelessness) {
        return []
      }
      return [{ section, prompt }]
    }))
  }, [answersByPromptId, sections])
  const completedCount = visiblePromptEntries.reduce(
    (count, entry) => count + (isAnswerComplete(answersByPromptId.get(entry.prompt.id)) ? 1 : 0),
    0
  )
  const currentPromptEntry = visiblePromptEntries[currentPromptIndex] || null
  const currentPromptAnswer = currentPromptEntry ? answersByPromptId.get(currentPromptEntry.prompt.id) : null
  const isSurveyComplete = visiblePromptEntries.length > 0 && completedCount === visiblePromptEntries.length
  const lastAnsweredPromptIndex = visiblePromptEntries.reduce(
    (lastIndex, entry, index) => isAnswerComplete(answersByPromptId.get(entry.prompt.id)) ? index : lastIndex,
    -1
  )
  const sectionProgress: SurveySectionProgressItem[] = sections.map((section) => ({
    parentCode: section.parentCode,
    total: section.prompts.length,
    completed: section.prompts.reduce(
      (count, prompt) => count + (isAnswerComplete(answersByPromptId.get(prompt.id)) ? 1 : 0),
      0
    ),
    accentColor: getZCodeParentColor(section.parentCode) || SP_COLORS.white,
    isCurrent: currentPromptEntry?.section.parentCode === section.parentCode
  }))

  useEffect(() => {
    setCurrentPromptIndex((current) => Math.max(0, Math.min(current, visiblePromptEntries.length - 1)))
  }, [visiblePromptEntries.length])

  function updateHeader<K extends keyof PartnerServiceCapacityHeader>(key: K, value: PartnerServiceCapacityHeader[K]) {
    hasPendingAutosaveRef.current = true
    setSaveContinuityMessage(null)
    if (key === 'firstName' || key === 'lastName' || key === 'email' || key === 'organizationName') {
      setSelectedPartnerIdentifierId(null)
    }
    setDraft((current) => ({ ...current, header: { ...current.header, [key]: value } }))
    setValidationMessage(null)
  }

  function applyPartnerIdentifierMatch(match: PartnerIdentifierRecord) {
    hasPendingAutosaveRef.current = true
    setSelectedPartnerIdentifierId(match.partnerId)
    setPartnerIdentifierMatches([])
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

  function updateAnswer(promptId: string, updates: Partial<DraftAnswer>) {
    hasPendingAutosaveRef.current = true
    setSaveContinuityMessage(null)
    setDraft((current) => ({
      ...current,
      answers: current.answers.map((answer) => {
        if (answer.promptId === promptId) return { ...answer, ...updates }
        if (
          promptId === 'z59-0' &&
          (answer.promptId === 'z59-01' || answer.promptId === 'z59-02') &&
          (updates.notEncountered === true || ('score' in updates && typeof updates.score !== 'number'))
        ) return { ...answer, score: null, notEncountered: false }
        return answer
      })
    }))
  }

  useEffect(() => {
    const hasContent = hasMeaningfulDraftContent(draft.header, draft.answers)
    persistSurveyDraft(hasContent ? { draftKey, isSurveyStarted: true, ...draft } : null)
    if (!hasContent || !draftKey || !hasPendingAutosaveRef.current) return
    const payload: PartnerServiceCapacitySubmissionInput = {
      draftKey,
      status: 'draft',
      completedAtIso: null,
      header: draft.header,
      answers: draft.answers.filter(isAnswerComplete),
      formVersion: surveyConfig.formVersion
    }
    const snapshot = JSON.stringify(payload)
    if (snapshot === lastSnapshotRef.current) return
    if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current)
    // Debounce server writes so rapid score changes collapse into one draft save.
    autosaveTimeoutRef.current = window.setTimeout(() => {
      setAutosaveState('saving')
      Promise.resolve(onSubmitRef.current(payload))
        .then((record) => {
          if (isSubmissionRecord(record)) {
            setCurrentRecordId(record.id)
            if (record.draftKey) setDraftKey(record.draftKey)
          }
          lastSnapshotRef.current = snapshot
          hasPendingAutosaveRef.current = false
          retryAttemptsRef.current = 0
          setAutosaveState('saved')
          setBlockingSaveError(null)
        })
        .catch((error) => {
          setAutosaveState('error')
          hasPendingAutosaveRef.current = true
          setBlockingSaveError(toSupabaseErrorMessage(error, SAVE_ERROR))
          if (retryAttemptsRef.current >= AUTOSAVE_MAX_RETRY_ATTEMPTS) return
          retryAttemptsRef.current += 1
          retryTimeoutRef.current = window.setTimeout(
            () => setAutosaveRetryTick((current) => current + 1),
            AUTOSAVE_RETRY_DELAY_MS
          )
        })
    }, 500)
    return () => {
      if (autosaveTimeoutRef.current) window.clearTimeout(autosaveTimeoutRef.current)
    }
  }, [autosaveRetryTick, draft, draftKey, surveyConfig.formVersion])

  async function completeSurvey() {
    const respondentError = getRespondentValidationMessage(draft.header, surveyConfig)
    if (respondentError || visiblePromptEntries.some((entry) => !isAnswerComplete(answersByPromptId.get(entry.prompt.id)))) {
      setValidationMessage(respondentError || 'Complete each visible question or mark it as not encountered before saving the survey.')
      return
    }
    const header = Object.fromEntries(
      Object.entries(draft.header).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    ) as unknown as PartnerServiceCapacityHeader
    const completedAnswers = draft.answers.filter(isAnswerComplete)
    try {
      const record = await onSubmit({
        draftKey,
        status: 'completed',
        completedAtIso: new Date().toISOString(),
        header,
        answers: completedAnswers,
        formVersion: surveyConfig.formVersion
      })
      persistSurveyDraft(null)
      setAutosaveState('saved')
      onCompleted(isSubmissionRecord(record) ? record : null)
    } catch (error) {
      const message = toSupabaseErrorMessage(error, SAVE_ERROR)
      setBlockingSaveError(message)
      try {
        // Preserve the latest work as a draft when the completion command fails.
        const record = await onSubmit({
          draftKey,
          status: 'draft',
          completedAtIso: null,
          header,
          answers: completedAnswers,
          formVersion: surveyConfig.formVersion
        })
        if (isSubmissionRecord(record)) setCurrentRecordId(record.id)
        setAutosaveState('saved')
        setBlockingSaveError(null)
        setSaveContinuityMessage('Completion failed, but your latest answers were saved as a draft.')
      } catch {
        setAutosaveState('error')
      }
    }
  }

  return {
    draft,
    firstNameInputRef,
    validationMessage,
    partnerIdentifierMatches,
    partnerIdentifierError,
    isSearchingPartnerIdentifiers,
    isEnsuringPartnerIdentifier,
    selectedPartnerIdentifierId,
    autosaveState,
    saveContinuityMessage,
    blockingSaveError,
    setBlockingSaveError,
    currentRecordId,
    currentPromptIndex,
    setCurrentPromptIndex,
    visiblePromptEntries,
    currentPromptEntry,
    currentPromptAnswer,
    completedCount,
    isSurveyComplete,
    lastAnsweredPromptIndex,
    sectionProgress,
    currentAccentColor: currentPromptEntry
      ? getZCodeParentColor(currentPromptEntry.section.parentCode) || SP_COLORS.white
      : SP_COLORS.white,
    lastSavedLabel: formatDateTimeLabel(latestSavedSubmission?.updatedAtIso || latestSavedSubmission?.submittedAtIso),
    updateHeader,
    applyPartnerIdentifierMatch,
    updateAnswer,
    completeSurvey
  }
}
