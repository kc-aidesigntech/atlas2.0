import React, { useEffect, useMemo, useState } from 'react'
import { AtlasPlusButton, AtlasTextButton } from '../../../components/AtlasPrimitives'
import AtlasArrowIcon from '../../../components/AtlasArrowIcon'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  PartnerIdentifierRecord,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacityScaleOption,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  ZCodeSurveySection
} from '../../types'
import type { PersistedSurveyDraft } from './draft'
import type { SurveyCardConfig } from './config'
import { BlockingSupportOverlay } from './SurveyChrome'
import { RespondentDetailsSection } from './RespondentDetailsSection'
import { SurveyExperience } from './SurveyExperience'
import { useServiceCapacitySurveyForm } from './useServiceCapacitySurveyForm'

interface ServiceCapacitySurveyFormProps {
  initialSubmission: PartnerServiceCapacitySubmissionRecord | null
  latestSavedSubmission: PartnerServiceCapacitySubmissionRecord | null
  persistedDraftOverride: PersistedSurveyDraft | null
  defaultHeader: PartnerServiceCapacityHeader
  isSaving: boolean
  saveError: string | null
  scale: PartnerServiceCapacityScaleOption[]
  scoreRange: { min: number; max: number; step?: number } | null
  sections: ZCodeSurveySection[]
  isLoadingCatalog: boolean
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
  onBackToRecords: () => void
  onCheckoutNewRecord: () => void
  onCompleted: (record: PartnerServiceCapacitySubmissionRecord | null) => void
}

function describeBlockingSaveIssue(message: string) {
  const normalizedMessage = message.toLowerCase()
  if (normalizedMessage.includes('42601') || normalizedMessage.includes('query has no destination for result data')) {
    return {
      title: 'Survey completion command is out of date',
      detail: 'This environment is still running an older partner service-capacity save function.',
      guidance: 'Draft autosave can continue, but completion may fail until the latest database migration is applied.'
    }
  }
  if (normalizedMessage.includes('supabase is required')) {
    return {
      title: 'Survey saving is not configured here',
      detail: 'This deployment does not have the Supabase connection needed to persist survey records.',
      guidance: 'You can continue reviewing the survey, but draft and submit actions will not be saved.'
    }
  }
  return {
    title: 'Unable to save this survey',
    detail: message,
    guidance: 'You can continue reviewing the page, but the most recent changes may not persist.'
  }
}

export function ServiceCapacitySurveyForm(props: ServiceCapacitySurveyFormProps) {
  const {
    initialSubmission,
    latestSavedSubmission,
    persistedDraftOverride,
    defaultHeader,
    isSaving,
    saveError,
    scale,
    scoreRange,
    sections,
    isLoadingCatalog,
    surveyConfig,
    onSearchPartnerIdentifiers,
    onEnsurePartnerIdentifier,
    onSubmit,
    onBackToRecords,
    onCheckoutNewRecord,
    onCompleted
  } = props
  const controller = useServiceCapacitySurveyForm({
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
  })
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const effectiveError = controller.blockingSaveError ?? saveError
  const visibleError = effectiveError && dismissedError !== effectiveError ? effectiveError : null
  const blockingIssue = visibleError ? describeBlockingSaveIssue(visibleError) : null
  const sessionResumeMessage = useMemo(() => {
    if (persistedDraftOverride) return 'Restored your in-browser draft. The server copy updates as you answer.'
    if (initialSubmission?.status === 'draft') return 'Continuing this saved draft. Return to history anytime.'
    return null
  }, [initialSubmission?.status, persistedDraftOverride])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    requestAnimationFrame(() => {
      controller.firstNameInputRef.current?.focus()
      controller.firstNameInputRef.current?.select()
    })
  }, [])

  const scoreMin = scoreRange?.min ?? scale[0]?.value ?? 1
  const scoreMax = scoreRange?.max ?? scale[scale.length - 1]?.value ?? 9
  function getScaleGuideColor(value: number) {
    const ratio = scoreMax === scoreMin ? 0.5 : (value - scoreMin) / (scoreMax - scoreMin)
    if (ratio <= 0.33) return SP_COLORS.red
    if (ratio <= 0.66) return SP_COLORS.yellow
    return SP_COLORS.deepGreen
  }

  return (
    <div className="atlas-surface-panel relative w-full px-4 py-4 md:px-5 md:py-5" style={{ borderColor: '#ffffff40' }}>
      {visibleError && blockingIssue ? (
        <BlockingSupportOverlay
          message={visibleError}
          title={blockingIssue.title}
          detail={blockingIssue.detail}
          guidance={blockingIssue.guidance}
          supportEmail="support@transitionalcare.net"
          canDismiss
          onDismiss={() => setDismissedError(visibleError)}
        />
      ) : null}
      <div className="atlas-divider flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="max-w-[720px]">
          <small className="atlas-overline block md:text-[14px]" style={{ color: SP_COLORS.muted }}>z-code-survey</small>
          <h3 className="atlas-h3 mt-1 text-[28px] font-medium text-white md:text-[34px]">{surveyConfig.panelTitle}</h3>
          <small className="atlas-panel-copy block text-[#bdbdbd] md:text-[17px]">{surveyConfig.panelSubtitle}</small>
        </div>
        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap gap-2">
            <AtlasTextButton
              onClick={onBackToRecords}
              className="inline-flex items-center gap-2 px-[14px] py-[7px] text-[14px] md:text-[16px]"
              style={{ ['--button-border-color' as const]: '#ffffff32', color: SP_COLORS.white } as React.CSSProperties}
            >
              <AtlasArrowIcon decorative direction="left" className="h-[1.2rem] w-[1.2rem] opacity-90" />
              <span>back to list</span>
            </AtlasTextButton>
            <AtlasPlusButton onClick={onCheckoutNewRecord} label="Check out a new blank survey record" />
          </div>
          <small className="text-[12px]" style={{ color: SP_COLORS.muted }}>
            {controller.lastSavedLabel ? `Server draft last updated ${controller.lastSavedLabel}.` : 'No server draft yet.'}
          </small>
          {controller.currentRecordId ? <small className="font-mono text-[11px] text-white">record id {controller.currentRecordId}</small> : null}
        </div>
      </div>

      {[sessionResumeMessage, controller.saveContinuityMessage].filter(Boolean).map((message) => (
        <div
          key={message}
          className="mt-4 rounded-[12px] border px-4 py-3 text-[13px]"
          style={{ borderColor: `${SP_COLORS.yellow}55`, backgroundColor: `${SP_COLORS.yellow}10`, color: '#e8e8e8' }}
        >
          {message}
        </div>
      ))}

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <RespondentDetailsSection
          header={controller.draft.header}
          surveyConfig={surveyConfig}
          firstNameInputRef={controller.firstNameInputRef}
          partnerIdentifierMatches={controller.partnerIdentifierMatches}
          partnerIdentifierError={controller.partnerIdentifierError}
          isSearchingPartnerIdentifiers={controller.isSearchingPartnerIdentifiers}
          isEnsuringPartnerIdentifier={controller.isEnsuringPartnerIdentifier}
          selectedPartnerIdentifierId={controller.selectedPartnerIdentifierId}
          onUpdateHeader={controller.updateHeader}
          onApplyPartnerIdentifierMatch={controller.applyPartnerIdentifierMatch}
        />
        <section className="atlas-surface-raised p-4">
          <small className="atlas-overline mb-3 block text-[#bdbdbd] md:text-[14px]">scale guide</small>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {scale.map((option) => (
              <div key={option.value} className="rounded-[12px] border px-3 py-2" style={{ borderColor: '#ffffff18' }}>
                <div className="text-[13px] font-medium" style={{ color: getScaleGuideColor(option.value) }}>
                  {option.value} - {option.label}
                </div>
                <small className="block text-[12px] text-[#bdbdbd]">{option.description}</small>
              </div>
            ))}
            <small className="pt-2 text-[12px] sm:col-span-2 xl:col-span-3" style={{ color: SP_COLORS.muted }}>
              {controller.completedCount} of {controller.visiblePromptEntries.length} visible questions completed.
            </small>
          </div>
        </section>
      </div>

      {controller.validationMessage && !effectiveError ? (
        <div className="mt-4 rounded-[12px] border px-4 py-3 text-[13px]" style={{ borderColor: `${SP_COLORS.red}70`, color: SP_COLORS.red }}>
          {controller.validationMessage}
        </div>
      ) : null}
      {controller.currentPromptEntry ? (
        <SurveyExperience
          currentPromptEntry={controller.currentPromptEntry}
          currentPromptAnswer={controller.currentPromptAnswer}
          currentPromptIndex={controller.currentPromptIndex}
          totalCount={controller.visiblePromptEntries.length}
          completedCount={controller.completedCount}
          lastAnsweredPromptIndex={controller.lastAnsweredPromptIndex}
          sectionProgress={controller.sectionProgress}
          accentColor={controller.currentAccentColor}
          scale={scale}
          scoreRange={scoreRange}
          surveyConfig={surveyConfig}
          isSaving={isSaving}
          isSurveyComplete={controller.isSurveyComplete}
          onSetPromptIndex={controller.setCurrentPromptIndex}
          onUpdateAnswer={controller.updateAnswer}
          onComplete={controller.completeSurvey}
        />
      ) : (
        <div className="mt-5 rounded-[16px] border px-4 py-4 text-[13px]" style={{ borderColor: '#ffffff25', color: SP_COLORS.muted }}>
          {isLoadingCatalog ? 'Loading survey questions…' : 'No survey questions are currently available.'}
        </div>
      )}
    </div>
  )
}
