import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  CreateSessionRecord,
  EnrolleeProfile,
  IpsCompetencySelfAssessmentRecord,
  IpsccEnrolleeFeedbackPrivacy,
  IpsccEncounterSubmissionRecord,
  IpsccSelfAwarenessCorrelationRow,
  IpsccSelfAwarenessSummary,
  SupervisorIpsAssessmentRecord
} from '@/features/atlas2026/shared/contracts'
import IpsCompetencySurvey, {
  isIpsCompetencySurveyComplete,
  scoresMapToCompetencyRecord,
  scoresMapToItemArray,
  type IpsCompetencyScoreMap
} from '../IpsCompetencySurvey'
import {
  CREATE_HISTORY_FIELDS,
  createRecordId,
  formatDateLabel,
  formatSupervisionMode,
  getWeekStartIso,
  type OverlaySaveState
} from './model'

function SaveMessage({ state, message }: { state: OverlaySaveState; message: string | null }) {
  return message ? <small style={{ color: state === 'error' ? SP_COLORS.red : '#9eacb9' }}>{message}</small> : <span />
}

async function runSave(
  action: () => Promise<void>,
  successMessage: string,
  setState: React.Dispatch<React.SetStateAction<OverlaySaveState>>,
  setMessage: React.Dispatch<React.SetStateAction<string | null>>
) {
  setState('saving')
  setMessage(null)
  try {
    await action()
    setState('saved')
    setMessage(successMessage)
  } catch (error) {
    setState('error')
    setMessage(error instanceof Error ? error.message : 'Unable to save this entry.')
  }
}

export function NavigatorIpsccFeedbackSection({
  assignedEnrollees,
  currentNavigatorName,
  privacy,
  onSave
}: {
  assignedEnrollees: EnrolleeProfile[]
  currentNavigatorName: string
  privacy: IpsccEnrolleeFeedbackPrivacy
  onSave: (record: IpsccEncounterSubmissionRecord) => Promise<unknown> | unknown
}) {
  const [selectedId, setSelectedId] = React.useState(assignedEnrollees[0]?.id || '')
  const [handoffActive, setHandoffActive] = React.useState(false)
  const [scores, setScores] = React.useState<IpsCompetencyScoreMap>({})
  const [note, setNote] = React.useState('')
  const [saveState, setSaveState] = React.useState<OverlaySaveState>('idle')
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!selectedId && assignedEnrollees.length) setSelectedId(assignedEnrollees[0].id)
  }, [assignedEnrollees, selectedId])

  return (
    <IpsCompetencySurvey
      scores={scores}
      onChangeScore={(key, score) => setScores((current) => ({ ...current, [key]: score }))}
      assignmentLabel={handoffActive ? 'how did this encounter show the competency?' : 'rate how this encounter showed the competency'}
      accentColor={SP_COLORS.green}
      headerSlot={
        <div className="space-y-3">
          <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white">
            <div className="font-medium">{handoffActive ? 'Enrollee feedback — Intentional Peer Support Core Competencies (IPSCC)' : 'Pass-the-tablet IPSCC encounter survey'}</div>
            <div className="mt-1 text-[#9eacb9]">
              {handoffActive
                ? 'Tap a number for each competency. When finished, submit and hand the tablet back to your navigator. Your answers stay anonymous in group averages.'
                : `Select an enrollee, start handoff, then pass the tablet. Navigators see only accumulated averages after about ${privacy.minEntriesToRevealAverages} entries.`}
            </div>
          </div>
          {!handoffActive ? (
            <>
              <label className="block">
                <small className="atlas-overline block text-[#9eacb9]">Enrollee</small>
                <select className="atlas-select mt-1 h-10 w-full bg-transparent text-white" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!assignedEnrollees.length}>
                  {!assignedEnrollees.length ? <option value="" className="bg-black text-white">No assigned enrollees</option> : null}
                  {assignedEnrollees.map((enrollee) => <option key={enrollee.id} value={enrollee.id} className="bg-black text-white">{enrollee.fullName}</option>)}
                </select>
              </label>
              <AtlasTextButton disabled={!selectedId} onClick={() => setHandoffActive(true)} className="px-4 py-2 text-[12px]">hand tablet to enrollee</AtlasTextButton>
            </>
          ) : null}
        </div>
      }
      footerSlot={
        <div className="space-y-3">
          {!handoffActive ? <label className="block"><small className="atlas-overline block text-[#9eacb9]">Service user note (navigator only)</small><textarea className="atlas-textarea mt-1 min-h-[90px] bg-transparent text-white" value={note} onChange={(event) => setNote(event.target.value)} /></label> : null}
          <div className="flex items-center justify-between gap-3">
            <SaveMessage state={saveState} message={message} />
            <div className="flex flex-wrap items-center gap-2">
              {handoffActive ? <AtlasTextButton onClick={() => setHandoffActive(false)} className="px-4 py-2 text-[12px]">cancel handoff</AtlasTextButton> : null}
              <AtlasTextButton
                disabled={saveState === 'saving' || !assignedEnrollees.length || !isIpsCompetencySurveyComplete(scores) || (!handoffActive && !selectedId)}
                onClick={() => void runSave(async () => {
                  const enrollee = assignedEnrollees.find((item) => item.id === selectedId)
                  if (!enrollee) throw new Error('Select an enrollee before saving IPSCC feedback.')
                  await onSave({
                    id: createRecordId(), navigatorName: currentNavigatorName, enrolleeId: enrollee.id,
                    enrolleeName: enrollee.fullName, enrollmentId: enrollee.enrollmentId || null,
                    submittedAtIso: new Date().toISOString(), submittedBy: 'enrollee',
                    itemScores: scoresMapToItemArray(scores), note: handoffActive ? '' : note
                  })
                  setScores({})
                  setNote('')
                  setHandoffActive(false)
                }, handoffActive ? 'Thank you. Please hand the tablet back to your navigator.' : 'IPSCC encounter survey saved.', setSaveState, setMessage)}
                className="px-4 py-2 text-[12px]"
              >{saveState === 'saving' ? 'saving...' : handoffActive ? 'submit feedback' : 'save IPSCC survey'}</AtlasTextButton>
            </div>
          </div>
        </div>
      }
    />
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="atlas-surface-raised px-3 py-3"><small className="atlas-overline block text-[#9eacb9]">{label}</small><div className="mt-1 text-[18px] font-medium text-white">{value}</div></div>
}

export function NavigatorSelfAwarenessSection({
  currentNavigatorName,
  assessments,
  supervisorAssessments,
  correlationRows,
  summary,
  privacy,
  onSave
}: {
  currentNavigatorName: string
  assessments: IpsCompetencySelfAssessmentRecord[]
  supervisorAssessments: SupervisorIpsAssessmentRecord[]
  correlationRows: IpsccSelfAwarenessCorrelationRow[]
  summary: IpsccSelfAwarenessSummary
  privacy: IpsccEnrolleeFeedbackPrivacy
  onSave: (record: IpsCompetencySelfAssessmentRecord) => Promise<unknown> | unknown
}) {
  const [scores, setScores] = React.useState<IpsCompetencyScoreMap>({})
  const [note, setNote] = React.useState('')
  const [saveState, setSaveState] = React.useState<OverlaySaveState>('idle')
  const [message, setMessage] = React.useState<string | null>(null)
  const history = [
    ...assessments.map((record) => ({ id: `self-${record.id}`, submittedAtIso: record.submittedAtIso, roleLabel: 'self', note: record.note })),
    ...supervisorAssessments.map((record) => ({ id: `supervisor-${record.id}`, submittedAtIso: record.submittedAtIso, roleLabel: 'supervisor', note: record.note }))
  ].sort((left, right) => new Date(right.submittedAtIso).getTime() - new Date(left.submittedAtIso).getTime()).slice(0, 12)

  return (
    <div className="space-y-3">
      <IpsCompetencySurvey
        scores={scores}
        onChangeScore={(key, score) => setScores((current) => ({ ...current, [key]: score }))}
        assignmentLabel="rate your practice on this competency"
        accentColor={SP_COLORS.yellow}
        headerSlot={<div className="atlas-surface-raised px-3 py-3 text-[12px] text-white"><div className="font-medium">Weekly Intentional Peer Support Core Competencies (IPSCC) self-assessment</div><div className="mt-1 text-[#9eacb9]">Complete all ten competencies. Correlation with point-of-care ratings appears beneath after save.</div></div>}
        footerSlot={
          <div className="space-y-3">
            <label className="block"><small className="atlas-overline block text-[#9eacb9]">Weekly self-assessment note</small><textarea className="atlas-textarea mt-1 min-h-[90px] bg-transparent text-white" value={note} onChange={(event) => setNote(event.target.value)} /></label>
            <div className="flex items-center justify-between gap-3">
              <SaveMessage state={saveState} message={message} />
              <AtlasTextButton disabled={saveState === 'saving' || !isIpsCompetencySurveyComplete(scores)} onClick={() => void runSave(async () => {
                const now = new Date().toISOString()
                await onSave({ id: createRecordId(), navigatorName: currentNavigatorName, weekStartIso: getWeekStartIso(new Date(now)), submittedAtIso: now, competencyScores: scoresMapToCompetencyRecord(scores), note })
                setScores({})
                setNote('')
              }, 'Weekly IPSCC self-assessment saved.', setSaveState, setMessage)} className="px-4 py-2 text-[12px]">{saveState === 'saving' ? 'saving...' : 'save weekly IPSCC'}</AtlasTextButton>
            </div>
          </div>
        }
      />
      <div className="atlas-surface-raised px-3 py-3">
        <div className="text-[13px] font-medium text-white">Historical IPSCC results</div>
        <div className="mt-2 space-y-2">{history.map((entry) => <div key={entry.id} className="atlas-surface-raised grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-[12px]"><span className="text-white">{formatDateLabel(entry.submittedAtIso)}</span><span className="text-[#9eacb9]">{entry.roleLabel}</span><span className="truncate text-[#d7e0e9]">{entry.note || 'no note'}</span></div>)}</div>
      </div>
      <div className="atlas-surface-raised px-3 py-3">
        <div className="text-[13px] font-medium text-white">Enrollee IPSCC vs self-assessment strain</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MetricCard label="compared" value={String(summary.comparedCompetencyCount)} />
          <MetricCard label="avg strain" value={summary.averageStrain == null ? '—' : summary.averageStrain.toFixed(2)} />
          <MetricCard label="alignment" value={summary.overallAlignmentScore == null ? '—' : summary.overallAlignmentScore.toFixed(2)} />
        </div>
        {!privacy.averagesRevealed ? <div className="mt-2 text-[12px] text-[#9eacb9]">Enrollee averages remain locked until {privacy.minEntriesToRevealAverages} encounter submissions protect anonymity.</div> : (
          <div className="mt-2 space-y-2">{correlationRows.map((row) => <div key={row.key} className="atlas-surface-raised grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 px-3 py-2 text-[12px]"><span className="text-white">{row.label}</span><span className="text-[var(--status-danger)]">Enrollee {row.ipsccAverage?.toFixed(2) || '—'}</span><span style={{ color: SP_COLORS.blue }}>Self {row.selfAverage?.toFixed(2) || '—'}</span><span className="text-[#d7e0e9]">Strain {row.strain?.toFixed(2) || '—'}</span></div>)}</div>
        )}
      </div>
    </div>
  )
}

export function NavigatorCreateHistorySection({ sessions }: { sessions: CreateSessionRecord[] }) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  return (
    <div className="space-y-3">
      <div className="atlas-surface-raised px-3 py-3 text-[12px] text-white"><div className="font-medium">Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.) session history</div><div className="mt-1 text-[#9eacb9]">Read-only view of supervision entries recorded with your supervisor.</div></div>
      {sessions.length ? sessions.slice().sort((left, right) => new Date(right.sessionAtIso).getTime() - new Date(left.sessionAtIso).getTime()).map((session) => {
        const expanded = expandedId === session.id
        return <div key={session.id} className="atlas-surface-raised space-y-2 px-3 py-3 text-[12px]">
          <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpandedId((current) => current === session.id ? null : session.id)} aria-expanded={expanded}>
            <div><div className="font-medium text-white">{formatDateLabel(session.sessionAtIso)} · {session.supervisorName}</div><small className="atlas-meta text-[#9eacb9]">{formatSupervisionMode(session.supervisionMode)}{session.sessionDurationMinutes != null ? ` · ${session.sessionDurationMinutes} min` : ''}{session.connectFocusedListening ? ' · focused listening' : ''}</small></div>
            <small className="shrink-0 text-[#9eacb9]">{expanded ? 'click to collapse' : 'click to expand'}</small>
          </button>
          {expanded ? <div className="space-y-2 border-t border-white/10 pt-2">{CREATE_HISTORY_FIELDS.map((field) => {
            const value = String(session[field.key] || '').trim()
            return value ? <div key={field.key}><small className="atlas-overline block text-[#9eacb9]">{field.label}</small><p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-[#d7e0e9]">{value}</p></div> : null
          })}<small className="atlas-meta block text-[#9eacb9]">Signed: {session.peerSpecialistSignature || 'navigator'}{session.peerSpecialistSignedAtIso ? ` (${formatDateLabel(session.peerSpecialistSignedAtIso)})` : ''} · {session.supervisorSignature || 'supervisor'}{session.supervisorSignedAtIso ? ` (${formatDateLabel(session.supervisorSignedAtIso)})` : ''}</small></div> : null}
        </div>
      }) : <div className="text-[12px] text-[#9eacb9]">No C.R.E.A.T.E. supervision sessions are on record for this navigator yet.</div>}
    </div>
  )
}
