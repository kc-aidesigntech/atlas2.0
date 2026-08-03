import { useEffect, useMemo, useState } from 'react'
import { usePartnerServiceCapacityDraftResolver } from '../../hooks/usePartnerServiceCapacityDraftResolver'
import { useServiceCapacitySurveyCatalog } from '../../hooks/useServiceCapacitySurveyCatalog'
import type {
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord
} from '../../types'
import {
  formatDateTimeLabel,
  getRecordSortTime,
  persistSurveyDraft,
  type PersistedSurveyDraft
} from './draft'
import { getSurveyCardConfig, type ServiceCapacitySurveyPanelProps } from './config'
import { RecordManagementView } from './RecordManagementView'
import { ServiceCapacitySurveyForm } from './ServiceCapacitySurveyForm'

type PanelView = 'history' | 'survey'

export default function ServiceCapacitySurveyPanel({
  submissionHistory,
  defaultHeader,
  isSaving,
  saveError,
  onBackToWorkspace,
  onSearchPartnerIdentifiers,
  onEnsurePartnerIdentifier,
  onSubmit,
  onDeleteDraft,
  surveyVariant = 'burden',
  myStationDebutRequirements = null,
  canDebutMyStation = true
}: ServiceCapacitySurveyPanelProps) {
  const { scale, sections, isLoading: isLoadingCatalog } = useServiceCapacitySurveyCatalog()
  const surveyConfig = getSurveyCardConfig(surveyVariant)
  const effectiveScale = surveyConfig.scale || scale
  const totalSurveyCardCount = useMemo(
    () => sections.reduce((count, section) => count + section.prompts.length, 0),
    [sections]
  )
  // Keep each survey mode's history isolated so burden and domain-spectrum
  // records sharing backend tables cannot be confused in the user interface.
  const sortedSubmissionHistory = useMemo(
    () =>
      submissionHistory
        .filter((record) => record.formVersion === surveyConfig.formVersion)
        .slice()
        .sort((left, right) => getRecordSortTime(right) - getRecordSortTime(left)),
    [submissionHistory, surveyConfig.formVersion]
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
      return sortedSubmissionHistory.find(
        (record) => record.draftKey === current.draftKey || record.id === current.id
      ) || current
    })
  }, [sortedSubmissionHistory])

  function openSurvey(
    nextInitialSubmission: PartnerServiceCapacitySubmissionRecord | null,
    nextPersistedDraft: PersistedSurveyDraft | null,
    nextLatestSavedSubmission: PartnerServiceCapacitySubmissionRecord | null
  ) {
    setInitialSubmission(nextInitialSubmission)
    setPersistedDraftOverride(nextPersistedDraft)
    setLatestSavedSubmission(nextLatestSavedSubmission)
    // Force a fresh form instance so refs and autosave timers cannot cross survey sessions.
    setSurveySessionKey((current) => current + 1)
    setActiveView('survey')
  }

  function handleCheckoutNewRecord() {
    persistSurveyDraft(null)
    openSurvey(null, null, null)
    setDraftResolutionKey((current) => current + 1)
  }

  function handleEditDraftRecord(record: PartnerServiceCapacitySubmissionRecord) {
    persistSurveyDraft(null)
    openSurvey(record, null, record)
    setDraftResolutionKey((current) => current + 1)
  }

  function handleResumeDraft() {
    if (!persistedDraft && !resumeDraftRecord) return
    openSurvey(resumeDraftRecord, persistedDraft, resumeDraftRecord)
  }

  function handleReturnToHistory() {
    setInitialSubmission(null)
    setPersistedDraftOverride(null)
    setActiveView('history')
    setDraftResolutionKey((current) => current + 1)
  }

  async function handleSubmit(payload: PartnerServiceCapacitySubmissionInput) {
    const savedRecord = await onSubmit(payload)
    if (savedRecord) setLatestSavedSubmission(savedRecord)
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

  if (activeView === 'history') {
    return (
      <RecordManagementView
        surveyKicker={surveyConfig.historyKicker}
        historyTitle={surveyConfig.historyTitle}
        historyDescription={surveyConfig.historyDescription}
        startButtonLabel={surveyConfig.historyStartButtonLabel}
        records={sortedSubmissionHistory}
        totalSurveyCardCount={totalSurveyCardCount}
        resumeDraftRecord={resumeDraftRecord}
        resumeDraftPersistedAtLabel={formatDateTimeLabel(resumeDraftUpdatedAtIso)}
        hasPersistedDraft={Boolean(persistedDraft)}
        isResolvingResumeDraft={isResolvingResumeDraft}
        resumeDraftError={resumeDraftError}
        myStationDebutRequirements={surveyVariant === 'burden' ? myStationDebutRequirements : null}
        canDebutMyStation={canDebutMyStation}
        onBackToWorkspace={onBackToWorkspace}
        onCheckoutNewRecord={handleCheckoutNewRecord}
        onResumeDraft={handleResumeDraft}
        onEditDraftRecord={handleEditDraftRecord}
        onDeleteDraftRecord={handleDeleteDraftRecord}
      />
    )
  }

  return (
    <ServiceCapacitySurveyForm
      key={surveySessionKey}
      initialSubmission={initialSubmission}
      latestSavedSubmission={latestSavedSubmission}
      persistedDraftOverride={persistedDraftOverride}
      defaultHeader={defaultHeader}
      isSaving={isSaving}
      saveError={saveError}
      scale={effectiveScale}
      scoreRange={surveyConfig.scoreRange}
      sections={sections}
      isLoadingCatalog={isLoadingCatalog}
      surveyConfig={surveyConfig}
      onSearchPartnerIdentifiers={onSearchPartnerIdentifiers}
      onEnsurePartnerIdentifier={onEnsurePartnerIdentifier}
      onSubmit={handleSubmit}
      onBackToRecords={handleReturnToHistory}
      onCheckoutNewRecord={handleCheckoutNewRecord}
      onCompleted={(record) => {
        if (record) setLatestSavedSubmission(record)
        handleReturnToHistory()
      }}
    />
  )
}
