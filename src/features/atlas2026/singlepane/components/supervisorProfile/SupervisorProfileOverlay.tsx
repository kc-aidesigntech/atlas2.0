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
} from '../IpsCompetencySurvey'

export interface SupervisorNavigatorDirectoryEntry {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

export type SupervisorProfileOverlayKey =
  | 'section_1_weekly_ips'
  | 'section_2_assigned_navigators'
  | 'section_3_assessment_rollup'
  | 'section_4_create_reflections'

interface SupervisorProfileOverlayProps {
  activeOverlay: SupervisorProfileOverlayKey
  title: string
  currentSupervisorName: string
  navigatorDirectory: SupervisorNavigatorDirectoryEntry[]
  competencyByNavigator: SupervisorNavigatorCompetencySummary[]
  allSupervisorIpsAssessments: SupervisorIpsAssessmentRecord[]
  managedCreateReflections: NavigatorCreateReflectionRecord[]
  isSavingAssignments: boolean
  onClose: () => void
  onToggleManagedNavigator?: (navigatorPersonId: string, isManaged: boolean) => Promise<void> | void
  onSaveSupervisorIpsAssessment: (record: SupervisorIpsAssessmentRecord) => Promise<unknown> | unknown
  onSaveCreateReflectionOverride: (input: { navigatorName: string; reflectionText: string }) => Promise<unknown> | unknown
  onRestoreCreateReflectionGenerated: (navigatorName: string) => Promise<unknown> | unknown
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}

export default function SupervisorProfileOverlay({
  activeOverlay,
  title,
  currentSupervisorName,
  navigatorDirectory,
  competencyByNavigator,
  allSupervisorIpsAssessments,
  managedCreateReflections,
  isSavingAssignments,
  onClose,
  onToggleManagedNavigator,
  onSaveSupervisorIpsAssessment,
  onSaveCreateReflectionOverride,
  onRestoreCreateReflectionGenerated
}: SupervisorProfileOverlayProps) {
  const [selectedNavigatorName, setSelectedNavigatorName] = React.useState('')
  const [assessmentNote, setAssessmentNote] = React.useState('')
  const [draftScores, setDraftScores] = React.useState<IpsCompetencyScoreMap>({})
  const [reflectionDrafts, setReflectionDrafts] = React.useState<Record<string, string>>({})
  const [saveStates, setSaveStates] = React.useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})
  const [saveMessages, setSaveMessages] = React.useState<Record<string, string | null>>({})
  const managedNavigators = React.useMemo(
    () => navigatorDirectory.filter((row) => row.isManagedByCurrentSupervisor),
    [navigatorDirectory]
  )
  const reflectionByName = React.useMemo(
    () => new Map(managedCreateReflections.map((row) => [row.navigatorName.trim().toLowerCase(), row])),
    [managedCreateReflections]
  )

  React.useEffect(() => {
    if (!selectedNavigatorName && navigatorDirectory.length) setSelectedNavigatorName(navigatorDirectory[0].navigatorName)
  }, [navigatorDirectory, selectedNavigatorName])

  React.useEffect(() => {
    // Initialize only missing drafts so an incoming refresh cannot overwrite active supervisor edits.
    setReflectionDrafts((current) => {
      const next = { ...current }
      managedNavigators.forEach((row) => {
        if (!Object.prototype.hasOwnProperty.call(next, row.navigatorName)) {
          next[row.navigatorName] = reflectionByName.get(row.navigatorName.trim().toLowerCase())?.reflectionText || ''
        }
      })
      return next
    })
  }, [managedNavigators, reflectionByName])

  async function saveOverride(navigatorName: string) {
    setSaveStates((current) => ({ ...current, [navigatorName]: 'saving' }))
    setSaveMessages((current) => ({ ...current, [navigatorName]: null }))
    try {
      await onSaveCreateReflectionOverride({ navigatorName, reflectionText: (reflectionDrafts[navigatorName] || '').trim() })
      setSaveStates((current) => ({ ...current, [navigatorName]: 'saved' }))
      setSaveMessages((current) => ({ ...current, [navigatorName]: 'Supervisor override saved. Navigator profile will show this text.' }))
    } catch (error) {
      setSaveStates((current) => ({ ...current, [navigatorName]: 'error' }))
      setSaveMessages((current) => ({ ...current, [navigatorName]: error instanceof Error ? error.message : 'Unable to save reflection override.' }))
    }
  }

  async function restoreGenerated(navigatorName: string) {
    setSaveStates((current) => ({ ...current, [navigatorName]: 'saving' }))
    setSaveMessages((current) => ({ ...current, [navigatorName]: null }))
    try {
      const restored = (await onRestoreCreateReflectionGenerated(navigatorName)) as NavigatorCreateReflectionRecord | undefined
      if (restored?.reflectionText) setReflectionDrafts((current) => ({ ...current, [navigatorName]: restored.reflectionText }))
      setSaveStates((current) => ({ ...current, [navigatorName]: 'saved' }))
      setSaveMessages((current) => ({ ...current, [navigatorName]: 'Restored the last auto-generated reflection.' }))
    } catch (error) {
      setSaveStates((current) => ({ ...current, [navigatorName]: 'error' }))
      setSaveMessages((current) => ({ ...current, [navigatorName]: error instanceof Error ? error.message : 'Unable to restore generated reflection.' }))
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="atlas-surface-panel max-h-[90vh] w-full max-w-[980px] overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[18px] font-medium text-white">{title}</div>
          <AtlasTextButton onClick={onClose} className="px-3 py-1 text-[12px]">close</AtlasTextButton>
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
                  <select className="atlas-select mt-1 h-10 w-full bg-transparent text-white" value={selectedNavigatorName} onChange={(event) => setSelectedNavigatorName(event.target.value)}>
                    {navigatorDirectory.map((row) => <option key={row.navigatorPersonId} value={row.navigatorName} className="bg-black text-white">{row.navigatorName}</option>)}
                  </select>
                </label>
              }
              footerSlot={
                <div className="space-y-3">
                  <textarea className="atlas-textarea min-h-[90px] bg-transparent text-white" value={assessmentNote} onChange={(event) => setAssessmentNote(event.target.value)} placeholder="Weekly supervisor IPSCC assessment note..." />
                  <div className="flex justify-end">
                    <AtlasTextButton
                      disabled={!selectedNavigatorName.trim() || !isIpsCompetencySurveyComplete(draftScores)}
                      onClick={async () => {
                        if (!selectedNavigatorName.trim()) return
                        const now = new Date().toISOString()
                        await onSaveSupervisorIpsAssessment({
                          id: `supervisor-ips-${Date.now()}`, supervisorName: currentSupervisorName,
                          navigatorName: selectedNavigatorName, weekStartIso: now, submittedAtIso: now,
                          competencyScores: scoresMapToCompetencyRecord(draftScores), note: assessmentNote
                        })
                        setDraftScores({})
                        setAssessmentNote('')
                      }}
                      className="px-4 py-2 text-[12px]"
                    >save section 1 entry</AtlasTextButton>
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
                    <span className="text-[#9eacb9]">{record.navigatorName}</span>
                    <span className="truncate text-[#d7e0e9]">{record.note || 'no note'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeOverlay === 'section_2_assigned_navigators' ? (
          <div className="space-y-2">
            {navigatorDirectory.length ? navigatorDirectory.map((row) => (
              <label key={row.navigatorPersonId} className="atlas-surface-raised flex items-center justify-between px-3 py-2">
                <div><small className="block text-[12px] text-white">{row.navigatorName}</small><small className="text-[11px] text-[#cfcfcf]">{row.assignedEnrolleeCount} assigned enrollees</small></div>
                <input type="checkbox" checked={row.isManagedByCurrentSupervisor} onChange={() => onToggleManagedNavigator?.(row.navigatorPersonId, !row.isManagedByCurrentSupervisor)} className="h-4 w-4 accent-white" disabled={isSavingAssignments} />
              </label>
            )) : <small className="block text-[12px] text-[#cfcfcf]">No navigator identities are available yet.</small>}
          </div>
        ) : null}

        {activeOverlay === 'section_3_assessment_rollup' ? (
          <div className="space-y-2">
            {competencyByNavigator.length ? competencyByNavigator.map((row) => (
              <div key={row.navigatorName} className="atlas-surface-raised flex items-center justify-between px-3 py-2">
                <div><small className="block text-[12px] text-white">{row.navigatorName}</small><small className="text-[11px] text-[#cfcfcf]">{row.assessmentCount} assessments{row.lastAssessmentAtIso ? ` • last ${new Date(row.lastAssessmentAtIso).toLocaleDateString()}` : ''}</small></div>
                <small className="text-[12px] font-medium text-white">{row.weightedRollingAverage.toFixed(2)}</small>
              </div>
            )) : <small className="block text-[12px] text-[#cfcfcf]">No navigator assessments recorded yet.</small>}
          </div>
        ) : null}

        {activeOverlay === 'section_4_create_reflections' ? (
          <div className="space-y-3">
            <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
              <div className="font-medium">Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.) reflections</div>
              <div className="mt-1 text-[#9eacb9]">Review the auto-generated supervisor-to-navigator narrative for each managed navigator. Edit and save to override what appears on the navigator My Profile card.</div>
            </div>
            {managedNavigators.length ? managedNavigators.map((row) => {
              const reflection = reflectionByName.get(row.navigatorName.trim().toLowerCase())
              const draft = reflectionDrafts[row.navigatorName] ?? reflection?.reflectionText ?? ''
              const saveState = saveStates[row.navigatorName] || 'idle'
              const canRestore = Boolean(reflection?.generatedReflectionText?.trim()) && reflection?.generatedReflectionText.trim() !== draft.trim()
              return (
                <div key={row.navigatorPersonId} className="atlas-surface-raised space-y-2 px-3 py-3">
                  <div className="text-[14px] font-medium text-white">{row.navigatorName}</div>
                  <small className="atlas-meta block text-[#9eacb9]">{reflection ? `Updated ${formatDateLabel(reflection.generatedAtIso)}${reflection.supervisorOverriddenAtIso ? ` · overridden by ${reflection.supervisorOverriddenBy || 'supervisor'} on ${formatDateLabel(reflection.supervisorOverriddenAtIso)}` : reflection.usedFallback ? ' · offline summary' : ' · auto-generated'}` : 'No reflection generated yet for this navigator'}</small>
                  <textarea className="atlas-textarea min-h-[120px] w-full bg-transparent text-[13px] leading-relaxed text-white" value={draft} onChange={(event) => setReflectionDrafts((current) => ({ ...current, [row.navigatorName]: event.target.value }))} placeholder="No C.R.E.A.T.E. reflection yet. After a supervision session is saved, the generated text appears here for review and override." />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <small style={{ color: saveState === 'error' ? SP_COLORS.red : '#9eacb9' }}>{saveMessages[row.navigatorName] || (draft.trim() ? 'Edit freely, then save override to replace the navigator-facing text.' : 'Waiting for a generated reflection from a saved C.R.E.A.T.E. session.')}</small>
                    <div className="flex flex-wrap items-center gap-2">
                      {canRestore ? <AtlasTextButton disabled={saveState === 'saving'} onClick={() => void restoreGenerated(row.navigatorName)} className="px-3 py-1 text-[12px]">restore generated</AtlasTextButton> : null}
                      <AtlasTextButton disabled={saveState === 'saving' || !draft.trim()} onClick={() => void saveOverride(row.navigatorName)} className="px-3 py-1 text-[12px]">{saveState === 'saving' ? 'saving...' : 'save override'}</AtlasTextButton>
                    </div>
                  </div>
                </div>
              )
            }) : <div className="text-[12px] text-[#9eacb9]">Assign navigators in Section 2 first. Reflection review is limited to navigators you supervise.</div>}
          </div>
        ) : null}
      </div>
    </div>
  )
}
