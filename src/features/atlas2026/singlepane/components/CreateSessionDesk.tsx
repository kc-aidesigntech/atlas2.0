/**
 * Connect, Recognize, Encourage, Acknowledge, Train, and Empower (C.R.E.A.T.E.)
 * session desk. Either person opens or joins a session, submits their side of
 * the form, and the supervisor closes it into both histories.
 */
import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { CreateSessionRecord } from '@/features/atlas2026/shared/contracts'
import { loadSupervisionEdges } from '@/features/atlas2026/singlepane/data-access/navigatorProfileRepository'
import { createRecordId, formatDateLabel, formatSupervisionMode } from './navigatorProfile/model'

interface CreateCounterpart {
  id: string
  name: string
}

interface CreateSessionDeskProps {
  role: 'navigator' | 'supervisor'
  selfName: string
  counterparts: CreateCounterpart[]
  sessions: CreateSessionRecord[]
  onSave: (record: CreateSessionRecord) => Promise<unknown> | unknown
}

function blankSession(input: {
  navigatorName: string
  supervisorName: string
  openedByRole: 'navigator' | 'supervisor'
  openedByName: string
}): CreateSessionRecord {
  const now = new Date().toISOString()
  return {
    id: createRecordId(),
    navigatorName: input.navigatorName,
    supervisorName: input.supervisorName,
    sessionAtIso: now,
    submittedAtIso: now,
    status: 'open',
    openedByRole: input.openedByRole,
    openedByName: input.openedByName,
    closedAtIso: null,
    closedByName: '',
    supervisionMode: 'in_person',
    sessionDurationMinutes: null,
    connectFocusedListening: false,
    recognizeNotes: '',
    encourageNotes: '',
    acknowledgeNotes: '',
    trainNotes: '',
    empowerNotes: '',
    createActionPlan: '',
    supervisorSubmission: '',
    superviseeSubmission: '',
    peerSpecialistSignature: '',
    peerSpecialistSignedAtIso: null,
    supervisorSignature: '',
    supervisorSignedAtIso: null
  }
}

export default function CreateSessionDesk({ role, selfName, counterparts, sessions, onSave }: CreateSessionDeskProps) {
  const [edgeCounterparts, setEdgeCounterparts] = React.useState<CreateCounterpart[]>([])
  const [counterpartId, setCounterpartId] = React.useState(counterparts[0]?.id || '')
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<CreateSessionRecord | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const people = React.useMemo(() => {
    const merged = new Map<string, CreateCounterpart>()
    ;[...counterparts, ...edgeCounterparts].forEach((person) => {
      const name = person.name.trim()
      if (!name || name.toLowerCase() === selfName.trim().toLowerCase()) return
      merged.set(name.toLowerCase(), { id: person.id || name, name })
    })
    sessions.forEach((session) => {
      const name = (role === 'navigator' ? session.supervisorName : session.navigatorName).trim()
      if (!name || name.toLowerCase() === selfName.trim().toLowerCase()) return
      if (!merged.has(name.toLowerCase())) merged.set(name.toLowerCase(), { id: name, name })
    })
    return Array.from(merged.values())
  }, [counterparts, edgeCounterparts, role, selfName, sessions])
  const counterpart = people.find((item) => item.id === counterpartId) || null
  const pairSessions = sessions.filter((session) => {
    if (!counterpart) return false
    const other = role === 'navigator' ? session.supervisorName : session.navigatorName
    return other.trim().toLowerCase() === counterpart.name.trim().toLowerCase()
  })
  const openSessions = pairSessions.filter((session) => session.status === 'open')

  React.useEffect(() => {
    let cancelled = false
    // Assignment edges are the source of who this person may open a session with.
    void loadSupervisionEdges().then((edges) => {
      if (cancelled) return
      const self = selfName.trim().toLowerCase()
      const next = role === 'navigator'
        ? edges
            .filter((edge) => edge.navigatorName.trim().toLowerCase() === self && edge.supervisorName)
            .map((edge) => ({ id: edge.supervisorPersonId || edge.supervisorName, name: edge.supervisorName }))
        : edges
            .filter((edge) => edge.supervisorName.trim().toLowerCase() === self && edge.navigatorName)
            .map((edge) => ({ id: edge.navigatorPersonId || edge.navigatorName, name: edge.navigatorName }))
      setEdgeCounterparts(next)
    })
    return () => {
      cancelled = true
    }
  }, [role, selfName])

  React.useEffect(() => {
    if (!counterpartId && people[0]) setCounterpartId(people[0].id)
  }, [counterpartId, people])

  React.useEffect(() => {
    const selected = sessions.find((session) => session.id === selectedSessionId) || null
    setDraft(selected)
  }, [selectedSessionId, sessions])

  async function persist(next: CreateSessionRecord, success: string) {
    if (next.status === 'closed' && role !== 'supervisor') {
      setMessage('A closed session cannot be changed.')
      return
    }
    setIsSaving(true)
    setMessage(null)
    try {
      await onSave(next)
      setSelectedSessionId(next.id)
      setMessage(success)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this session.')
    } finally {
      setIsSaving(false)
    }
  }

  async function openSession() {
    if (!counterpart) {
      setMessage(role === 'navigator' ? 'Select a supervisor first.' : 'Select a navigator first.')
      return
    }
    const navigatorName = role === 'navigator' ? selfName : counterpart.name
    const supervisorName = role === 'supervisor' ? selfName : counterpart.name
    const opened = blankSession({
      navigatorName,
      supervisorName,
      openedByRole: role,
      openedByName: selfName
    })
    await persist(opened, 'Session opened. Add the C.R.E.A.T.E. record, then submit it.')
  }

  function updateDraft(patch: Partial<CreateSessionRecord>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const closed = draft?.status === 'closed'
  const callerIsNavigator = role === 'navigator'

  return (
    <div className="space-y-3">
      <div className="atlas-surface-raised space-y-3 px-3 py-3 text-[12px] text-white">
        <div className="font-medium">Open or join a session</div>
        <label className="block">
          <small className="atlas-overline block text-[#9eacb9]">{role === 'navigator' ? 'Supervisor' : 'Navigator'}</small>
          <select
            className="atlas-select mt-1 h-10 w-full bg-transparent text-white"
            value={counterpartId}
            onChange={(event) => {
              setCounterpartId(event.target.value)
              setSelectedSessionId(null)
            }}
          >
            {!people.length ? <option value="" className="bg-black text-white">No one is assigned yet</option> : null}
            {people.map((person) => (
              <option key={person.id} value={person.id} className="bg-black text-white">{person.name}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <AtlasTextButton disabled={isSaving || !counterpart} onClick={() => void openSession()} className="px-3 py-1 text-[12px]">
            open a session
          </AtlasTextButton>
          {openSessions.map((session) => (
            <AtlasTextButton
              key={session.id}
              onClick={() => setSelectedSessionId(session.id)}
              className="px-3 py-1 text-[12px]"
            >
              open session · {formatDateLabel(session.sessionAtIso)}
            </AtlasTextButton>
          ))}
        </div>
      </div>

      {draft ? (
        <div className="atlas-surface-raised space-y-3 px-3 py-3 text-[12px] text-white">
          <div className="font-medium">
            {closed ? 'Closed session' : 'C.R.E.A.T.E. record'} · {formatSupervisionMode(draft.supervisionMode)}
          </div>
          {closed ? (
            <small className="block text-[#9eacb9]">
              Closed {draft.closedAtIso ? formatDateLabel(draft.closedAtIso) : ''} by {draft.closedByName || 'supervisor'}. This record is in both histories.
            </small>
          ) : (
            <small className="block text-[#9eacb9]">
              {callerIsNavigator
                ? 'Submit your side of the form. Your supervisor closes the session.'
                : 'Submit your side, then close the session when the work is finished.'}
            </small>
          )}
          <label className="block">
            <small className="atlas-overline block text-[#9eacb9]">Mode</small>
            <select
              className="atlas-select mt-1 h-10 w-full bg-transparent text-white"
              value={draft.supervisionMode}
              disabled={closed}
              onChange={(event) => updateDraft({ supervisionMode: event.target.value as CreateSessionRecord['supervisionMode'] })}
            >
              <option value="in_person" className="bg-black text-white">in person</option>
              <option value="online" className="bg-black text-white">online</option>
              <option value="phone_call" className="bg-black text-white">phone call</option>
            </select>
          </label>
          {([
            ['recognizeNotes', 'Recognize'],
            ['encourageNotes', 'Encourage'],
            ['acknowledgeNotes', 'Acknowledge'],
            ['trainNotes', 'Train'],
            ['empowerNotes', 'Empower'],
            ['createActionPlan', 'Action plan']
          ] as const).map(([key, label]) => (
            <label key={key} className="block">
              <small className="atlas-overline block text-[#9eacb9]">{label}</small>
              <textarea
                className="atlas-textarea mt-1 min-h-[72px] w-full bg-transparent text-white"
                value={draft[key]}
                disabled={closed}
                onChange={(event) => updateDraft({ [key]: event.target.value })}
              />
            </label>
          ))}
          {callerIsNavigator ? (
            <label className="block">
              <small className="atlas-overline block text-[#9eacb9]">Your submission</small>
              <textarea
                className="atlas-textarea mt-1 min-h-[72px] w-full bg-transparent text-white"
                value={draft.superviseeSubmission}
                disabled={closed}
                onChange={(event) => updateDraft({ superviseeSubmission: event.target.value })}
              />
            </label>
          ) : (
            <label className="block">
              <small className="atlas-overline block text-[#9eacb9]">Your submission</small>
              <textarea
                className="atlas-textarea mt-1 min-h-[72px] w-full bg-transparent text-white"
                value={draft.supervisorSubmission}
                disabled={closed}
                onChange={(event) => updateDraft({ supervisorSubmission: event.target.value })}
              />
            </label>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <small className="text-[#9eacb9]">{message}</small>
            <div className="flex flex-wrap gap-2">
              <AtlasTextButton
                disabled={isSaving || closed}
                onClick={() => {
                  const now = new Date().toISOString()
                  const next = callerIsNavigator
                    ? {
                        ...draft,
                        submittedAtIso: now,
                        peerSpecialistSignature: draft.peerSpecialistSignature || selfName,
                        peerSpecialistSignedAtIso: draft.peerSpecialistSignedAtIso || now
                      }
                    : {
                        ...draft,
                        submittedAtIso: now,
                        supervisorSignature: draft.supervisorSignature || selfName,
                        supervisorSignedAtIso: draft.supervisorSignedAtIso || now
                      }
                  void persist(next, 'Record submitted to this session.')
                }}
                className="px-3 py-1 text-[12px]"
              >
                {isSaving ? 'saving...' : 'submit record'}
              </AtlasTextButton>
              {role === 'supervisor' && !closed ? (
                <AtlasTextButton
                  disabled={isSaving}
                  onClick={() => {
                    const now = new Date().toISOString()
                    void persist(
                      {
                        ...draft,
                        status: 'closed',
                        closedAtIso: now,
                        closedByName: selfName,
                        supervisorSignature: draft.supervisorSignature || selfName,
                        supervisorSignedAtIso: draft.supervisorSignedAtIso || now
                      },
                      'Session closed. It is now in both histories.'
                    )
                  }}
                  className="px-3 py-1 text-[12px]"
                >
                  close session
                </AtlasTextButton>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <small className="block text-[12px] text-[#9eacb9]">{message || 'Choose an open session, or open a new one.'}</small>
      )}
    </div>
  )
}
