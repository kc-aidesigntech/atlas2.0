import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  NavigatorCreateReflectionRecord,
  SupervisorIpsAssessmentRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/shared/contracts'
import IpsCompetencySurvey, {
  isIpsCompetencySurveyComplete,
  scoresMapToCompetencyRecord,
  type IpsCompetencyScoreMap
} from './IpsCompetencySurvey'
import ProfileNavigationCard from './ProfileNavigationCard'

interface SupervisorNavigatorDirectoryEntry {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

interface SupervisorMyProfilePanelProps {
  currentSupervisorName: string
  navigatorDirectory: SupervisorNavigatorDirectoryEntry[]
  competencyByNavigator: SupervisorNavigatorCompetencySummary[]
  allSupervisorIpsAssessments: SupervisorIpsAssessmentRecord[]
  managedCreateReflections: NavigatorCreateReflectionRecord[]
  isSavingAssignments?: boolean
  onToggleManagedNavigator?: (navigatorPersonId: string, isManaged: boolean) => Promise<void> | void
  onSaveSupervisorIpsAssessment: (record: SupervisorIpsAssessmentRecord) => Promise<unknown> | unknown
  onSaveCreateReflectionOverride: (input: {
    navigatorName: string
    reflectionText: string
  }) => Promise<unknown> | unknown
  onRestoreCreateReflectionGenerated: (navigatorName: string) => Promise<unknown> | unknown
}

type OverlayKey =
  | 'section_1_weekly_ips'
  | 'section_2_assigned_navigators'
  | 'section_3_assessment_rollup'
  | 'section_4_create_reflections'

const CARD_DEFS: Array<{
  // overlayId (not "key") avoids gitleaks generic-api-key false positives on section ids.
  overlayId: OverlayKey
  title: string
  cardTitle: string
  cardSubtitle: string
  actionLabel: string
  variant: 'green' | 'blue'
  illustration: 'feedback' | 'reflection' | 'create'
}> = [
  { overlayId: 'section_1_weekly_ips', title: 'Section 1: Weekly IPSCC assessment by supervisor', cardTitle: 'weekly review', cardSubtitle: 'ipscc', actionLabel: 'start reflection', variant: 'blue', illustration: 'reflection' },
  { overlayId: 'section_2_assigned_navigators', title: 'Section 2: Assigned navigators', cardTitle: 'navigator roster', cardSubtitle: 'assignments', actionLabel: 'view feedback', variant: 'green', illustration: 'feedback' },
  { overlayId: 'section_3_assessment_rollup', title: 'Section 3: Navigator assessment rollup', cardTitle: 'assessment rollup', cardSubtitle: 'competency', actionLabel: 'create & share', variant: 'green', illustration: 'create' },
  { overlayId: 'section_4_create_reflections', title: 'Section 4: C.R.E.A.T.E. reflection review', cardTitle: 'c.r.e.a.t.e.', cardSubtitle: 'review & override', actionLabel: 'review reflections', variant: 'blue', illustration: 'reflection' }
]

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}

export default function SupervisorMyProfilePanel({
  currentSupervisorName,
  navigatorDirectory,
  competencyByNavigator,
  allSupervisorIpsAssessments,
  managedCreateReflections,
  isSavingAssignments = false,
  onToggleManagedNavigator,
  onSaveSupervisorIpsAssessment,
  onSaveCreateReflectionOverride,
  onRestoreCreateReflectionGenerated
}: SupervisorMyProfilePanelProps) {
  const [activeOverlay, setActiveOverlay] = React.useState<OverlayKey | null>(null)
  const [selectedNavigatorName, setSelectedNavigatorName] = React.useState('')
  const [assessmentNote, setAssessmentNote] = React.useState('')
  const [draftScores, setDraftScores] = React.useState<IpsCompetencyScoreMap>({})
  const [reflectionDraftsByNavigator, setReflectionDraftsByNavigator] = React.useState<Record<string, string>>({})
  const [reflectionSaveStateByNavigator, setReflectionSaveStateByNavigator] = React.useState<
    Record<string, 'idle' | 'saving' | 'saved' | 'error'>
  >({})
  const [reflectionSaveMessageByNavigator, setReflectionSaveMessageByNavigator] = React.useState<
    Record<string, string | null>
  >({})

  const managedNavigators = React.useMemo(
    () => navigatorDirectory.filter((row) => row.isManagedByCurrentSupervisor),
    [navigatorDirectory]
  )

  const reflectionByNavigatorName = React.useMemo(() => {
    const map = new Map<string, NavigatorCreateReflectionRecord>()
    managedCreateReflections.forEach((row) => {
      map.set(row.navigatorName.trim().toLowerCase(), row)
    })
    return map
  }, [managedCreateReflections])

  React.useEffect(() => {
    if (!selectedNavigatorName && navigatorDirectory.length) {
      setSelectedNavigatorName(navigatorDirectory[0].navigatorName)
    }
  }, [navigatorDirectory, selectedNavigatorName])

  // Keep editable drafts aligned with persisted reflections when the supervisor opens review.
  React.useEffect(() => {
    setReflectionDraftsByNavigator((current) => {
      const next = { ...current }
      managedNavigators.forEach((row) => {
        const key = row.navigatorName
        if (Object.prototype.hasOwnProperty.call(next, key)) return
        const existing = reflectionByNavigatorName.get(key.trim().toLowerCase())
        next[key] = existing?.reflectionText || ''
      })
      return next
    })
  }, [managedNavigators, reflectionByNavigatorName])

  async function saveReflectionOverride(navigatorName: string) {
    const draft = (reflectionDraftsByNavigator[navigatorName] || '').trim()
    setReflectionSaveStateByNavigator((current) => ({ ...current, [navigatorName]: 'saving' }))
    setReflectionSaveMessageByNavigator((current) => ({ ...current, [navigatorName]: null }))
    try {
      await onSaveCreateReflectionOverride({ navigatorName, reflectionText: draft })
      setReflectionSaveStateByNavigator((current) => ({ ...current, [navigatorName]: 'saved' }))
      setReflectionSaveMessageByNavigator((current) => ({
        ...current,
        [navigatorName]: 'Supervisor override saved. Navigator profile will show this text.'
      }))
    } catch (error) {
      setReflectionSaveStateByNavigator((current) => ({ ...current, [navigatorName]: 'error' }))
      setReflectionSaveMessageByNavigator((current) => ({
        ...current,
        [navigatorName]: error instanceof Error ? error.message : 'Unable to save reflection override.'
      }))
    }
  }

  async function restoreGeneratedReflection(navigatorName: string) {
    setReflectionSaveStateByNavigator((current) => ({ ...current, [navigatorName]: 'saving' }))
    setReflectionSaveMessageByNavigator((current) => ({ ...current, [navigatorName]: null }))
    try {
      const restored = (await onRestoreCreateReflectionGenerated(navigatorName)) as
        | NavigatorCreateReflectionRecord
        | undefined
      if (restored?.reflectionText) {
        setReflectionDraftsByNavigator((current) => ({
          ...current,
          [navigatorName]: restored.reflectionText
        }))
      }
      setReflectionSaveStateByNavigator((current) => ({ ...current, [navigatorName]: 'saved' }))
      setReflectionSaveMessageByNavigator((current) => ({
        ...current,
        [navigatorName]: 'Restored the last auto-generated reflection.'
      }))
    } catch (error) {
      setReflectionSaveStateByNavigator((current) => ({ ...current, [navigatorName]: 'error' }))
      setReflectionSaveMessageByNavigator((current) => ({
        ...current,
        [navigatorName]: error instanceof Error ? error.message : 'Unable to restore generated reflection.'
      }))
    }
  }

  return (
    <div className="relative flex flex-col gap-4">
      <div className="atlas-surface-panel px-5 py-4">
        <div className="atlas-h4 text-[24px] font-medium text-white">supervisor my profile</div>
        <small className="mt-1 block text-[#9eacb9]">{currentSupervisorName}</small>
      </div>
      <div className="atlas-profile-nav-grid">
        {CARD_DEFS.map((card) => (
          <ProfileNavigationCard
            key={card.overlayId}
            sequenceNumber={Number(card.overlayId.replace('section_', '').split('_')[0])}
            title={card.cardTitle}
            subtitle={card.cardSubtitle}
            actionLabel={card.actionLabel}
            variant={card.variant}
            illustration={card.illustration}
            onClick={() => setActiveOverlay(card.overlayId)}
          />
        ))}
      </div>

      {activeOverlay ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="atlas-surface-panel max-h-[90vh] w-full max-w-[980px] overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[18px] font-medium text-white">{CARD_DEFS.find((card) => card.overlayId === activeOverlay)?.title}</div>
              <AtlasTextButton onClick={() => setActiveOverlay(null)} className="px-3 py-1 text-[12px]">close</AtlasTextButton>
            </div>

            {activeOverlay === 'section_1_weekly_ips' ? (
              <div className="space-y-3">
                <IpsCompetencySurvey
                  scores={draftScores}
                  onChangeScore={(key, score) => setDraftScores((current) => ({ ...current, [key]: score }))}
                  assignmentLabel="rate this navigator on the competency"
                  accentColor={SP_COLORS.blue}
                  headerSlot={
                    <label className="block">
                      <small className="atlas-overline block text-[#9eacb9]">Navigator being assessed</small>
                      <select
                        className="atlas-select mt-1 h-10 w-full bg-transparent text-white"
                        value={selectedNavigatorName}
                        onChange={(event) => setSelectedNavigatorName(event.target.value)}
                      >
                        {navigatorDirectory.map((row) => (
                          <option key={row.navigatorPersonId} value={row.navigatorName} className="bg-black text-white">
                            {row.navigatorName}
                          </option>
                        ))}
                      </select>
                    </label>
                  }
                  footerSlot={
                    <div className="space-y-3">
                      <textarea
                        className="atlas-textarea min-h-[90px] bg-transparent text-white"
                        value={assessmentNote}
                        onChange={(event) => setAssessmentNote(event.target.value)}
                        placeholder="Weekly supervisor IPSCC assessment note..."
                      />
                      <div className="flex justify-end">
                        <AtlasTextButton
                          disabled={!selectedNavigatorName.trim() || !isIpsCompetencySurveyComplete(draftScores)}
                          onClick={async () => {
                            if (!selectedNavigatorName.trim()) return
                            const now = new Date().toISOString()
                            await onSaveSupervisorIpsAssessment({
                              id: `supervisor-ips-${Date.now()}`,
                              supervisorName: currentSupervisorName,
                              navigatorName: selectedNavigatorName,
                              weekStartIso: now,
                              submittedAtIso: now,
                              competencyScores: scoresMapToCompetencyRecord(draftScores),
                              note: assessmentNote
                            })
                            setDraftScores({})
                            setAssessmentNote('')
                          }}
                          className="px-4 py-2 text-[12px]"
                        >
                          save section 1 entry
                        </AtlasTextButton>
                      </div>
                    </div>
                  }
                />
                <div className="atlas-surface-raised px-3 py-3">
                  <div className="text-[13px] font-medium text-white">Historical supervisor assessments</div>
                  <div className="mt-2 space-y-2">
                    {allSupervisorIpsAssessments.slice(0, 14).map((record) => (
                      <div key={record.id} className="atlas-surface-raised grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-[12px]">
                        <span className="text-white">{formatDateLabel(record.submittedAtIso)}</span>
                        <span style={{ color: '#9eacb9' }}>{record.navigatorName}</span>
                        <span className="truncate" style={{ color: '#d7e0e9' }}>{record.note || 'no note'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeOverlay === 'section_2_assigned_navigators' ? (
              <div className="space-y-2">
                {navigatorDirectory.length ? navigatorDirectory.map((row) => (
                  <label
                    key={row.navigatorPersonId}
                    className="atlas-surface-raised flex items-center justify-between px-3 py-2"
                  >
                    <div>
                      <small className="block text-[12px] text-white">{row.navigatorName}</small>
                      <small className="text-[11px] text-[#cfcfcf]">{row.assignedEnrolleeCount} assigned enrollees</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={row.isManagedByCurrentSupervisor}
                      onChange={() => onToggleManagedNavigator?.(row.navigatorPersonId, !row.isManagedByCurrentSupervisor)}
                      className="h-4 w-4 accent-white"
                      disabled={isSavingAssignments}
                    />
                  </label>
                )) : (
                  <small className="block text-[12px] text-[#cfcfcf]">No navigator identities are available yet.</small>
                )}
              </div>
            ) : null}

            {activeOverlay === 'section_3_assessment_rollup' ? (
              <div className="space-y-2">
                {competencyByNavigator.length ? competencyByNavigator.map((row) => (
                  <div key={row.navigatorName} className="atlas-surface-raised flex items-center justify-between px-3 py-2">
                    <div>
                      <small className="block text-[12px] text-white">{row.navigatorName}</small>
                      <small className="text-[11px] text-[#cfcfcf]">
                        {row.assessmentCount} assessments
                        {row.lastAssessmentAtIso ? ` • last ${new Date(row.lastAssessmentAtIso).toLocaleDateString()}` : ''}
                      </small>
                    </div>
                    <small className="text-[12px] font-medium text-white">{row.weightedRollingAverage.toFixed(2)}</small>
                  </div>
                )) : (
                  <small className="block text-[12px] text-[#cfcfcf]">No navigator assessments recorded yet.</small>
                )}
              </div>
            ) : null}

            {activeOverlay === 'section_4_create_reflections' ? (
              <div className="space-y-3">
                <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
                  <div className="font-medium">
                    Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.) reflections
                  </div>
                  <div className="mt-1 text-[#9eacb9]">
                    Review the auto-generated supervisor-to-navigator narrative for each managed navigator. Edit and
                    save to override what appears on the navigator My Profile card.
                  </div>
                </div>
                {managedNavigators.length ? (
                  managedNavigators.map((row) => {
                    const reflection = reflectionByNavigatorName.get(row.navigatorName.trim().toLowerCase())
                    const draft = reflectionDraftsByNavigator[row.navigatorName] ?? reflection?.reflectionText ?? ''
                    const saveState = reflectionSaveStateByNavigator[row.navigatorName] || 'idle'
                    const saveMessage = reflectionSaveMessageByNavigator[row.navigatorName]
                    const isOverridden = Boolean(reflection?.supervisorOverriddenAtIso)
                    const canRestore =
                      Boolean(reflection?.generatedReflectionText?.trim()) &&
                      reflection!.generatedReflectionText.trim() !== draft.trim()

                    return (
                      <div key={row.navigatorPersonId} className="atlas-surface-raised space-y-2 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-[14px] font-medium text-white">{row.navigatorName}</div>
                            <small className="atlas-meta block text-[#9eacb9]">
                              {reflection
                                ? `Updated ${formatDateLabel(reflection.generatedAtIso)}${
                                    isOverridden
                                      ? ` · overridden by ${reflection.supervisorOverriddenBy || 'supervisor'} on ${formatDateLabel(reflection.supervisorOverriddenAtIso)}`
                                      : reflection.usedFallback
                                        ? ' · offline summary'
                                        : ' · auto-generated'
                                  }`
                                : 'No reflection generated yet for this navigator'}
                            </small>
                          </div>
                        </div>
                        <textarea
                          className="atlas-textarea min-h-[120px] w-full bg-transparent text-[13px] leading-relaxed text-white"
                          value={draft}
                          onChange={(event) =>
                            setReflectionDraftsByNavigator((current) => ({
                              ...current,
                              [row.navigatorName]: event.target.value
                            }))
                          }
                          placeholder="No C.R.E.A.T.E. reflection yet. After a supervision session is saved, the generated text appears here for review and override."
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <small
                            style={{
                              color: saveState === 'error' ? SP_COLORS.red : '#9eacb9'
                            }}
                          >
                            {saveMessage ||
                              (draft.trim()
                                ? 'Edit freely, then save override to replace the navigator-facing text.'
                                : 'Waiting for a generated reflection from a saved C.R.E.A.T.E. session.')}
                          </small>
                          <div className="flex flex-wrap items-center gap-2">
                            {canRestore ? (
                              <AtlasTextButton
                                disabled={saveState === 'saving'}
                                onClick={() => void restoreGeneratedReflection(row.navigatorName)}
                                className="px-3 py-1 text-[12px]"
                              >
                                restore generated
                              </AtlasTextButton>
                            ) : null}
                            <AtlasTextButton
                              disabled={saveState === 'saving' || !draft.trim()}
                              onClick={() => void saveReflectionOverride(row.navigatorName)}
                              className="px-3 py-1 text-[12px]"
                            >
                              {saveState === 'saving' ? 'saving...' : 'save override'}
                            </AtlasTextButton>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-[12px] text-[#9eacb9]">
                    Assign navigators in Section 2 first. Reflection review is limited to navigators you supervise.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
