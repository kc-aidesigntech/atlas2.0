/**
 * Atlas Scribe: standalone point-of-care listening subapp.
 * Press record, capture the conversation, and turn it into an editable
 * Subjective, Objective, Assessment, Plan (SOAP) draft note. Served from the
 * dedicated scribe hostname or the /scribe path (see RootApp.jsx).
 */
import React from 'react'
import { Mic, Square } from 'lucide-react'
import {
  AtlasBodyText,
  AtlasInsetCard,
  AtlasMetaText,
  AtlasOverline,
  AtlasPanel,
  AtlasStatusPill,
  AtlasTextButton
} from '@/features/atlas2026/components/AtlasPrimitives'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { generateSoapNote, type SoapNoteSections } from '@/services/atlas2026/generateSoapNoteService'
import {
  deleteScribeEncounter,
  loadScribeEncounters,
  saveScribeEncounter,
  type ScribeEncounterRecord,
  type ScribeEncounterStatus
} from './data-access/scribeEncountersRepository'
import { useScribeRecorder } from './useScribeRecorder'

type ScribePhase = 'idle' | 'recording' | 'generating' | 'editing'

const EMPTY_SECTIONS: SoapNoteSections = { subjective: '', objective: '', assessment: '', plan: '' }

const SOAP_SECTION_LABELS: Array<{ key: keyof SoapNoteSections; label: string }> = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective', label: 'Objective' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Plan' }
]

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatEncounterDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/**
 * Workspace URL for the back button. On the dedicated scribe hostname every
 * path renders scribe, so back must target the primary domain (drop the
 * leading "scribe." label); on the primary domain a plain /app path works.
 */
function getWorkspaceUrl(): string {
  if (typeof window === 'undefined') return '/app'
  const { hostname, protocol } = window.location
  if (hostname.toLowerCase().startsWith('scribe.')) {
    return `${protocol}//${hostname.slice('scribe.'.length)}/app`
  }
  return '/app'
}

export default function StandaloneScribePage() {
  const recorder = useScribeRecorder()
  const [phase, setPhase] = React.useState<ScribePhase>('idle')
  const [encounterLabel, setEncounterLabel] = React.useState('')
  const [transcriptText, setTranscriptText] = React.useState('')
  const [noteSections, setNoteSections] = React.useState<SoapNoteSections>({ ...EMPTY_SECTIONS })
  const [noteModel, setNoteModel] = React.useState('')
  const [noteUsedFallback, setNoteUsedFallback] = React.useState(false)
  const [currentEncounterId, setCurrentEncounterId] = React.useState('')
  const [currentStatus, setCurrentStatus] = React.useState<ScribeEncounterStatus>('draft')
  const [encounters, setEncounters] = React.useState<ScribeEncounterRecord[]>([])
  const [listError, setListError] = React.useState('')
  const [saveMessage, setSaveMessage] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [isRegenerating, setIsRegenerating] = React.useState(false)

  React.useEffect(() => {
    const previousTitle = document.title
    document.title = 'ATLAS Scribe'
    return () => {
      document.title = previousTitle
    }
  }, [])

  const refreshEncounters = React.useCallback(async () => {
    try {
      setEncounters(await loadScribeEncounters())
      setListError('')
    } catch (error) {
      console.warn('Failed to load scribe encounters.', error)
      setListError('Could not load saved encounters. Check your connection and refresh.')
    }
  }, [])

  React.useEffect(() => {
    void refreshEncounters()
  }, [refreshEncounters])

  async function handleStartRecording() {
    setSaveMessage('')
    setCurrentEncounterId('')
    setCurrentStatus('draft')
    setTranscriptText('')
    setNoteSections({ ...EMPTY_SECTIONS })
    setNoteModel('')
    setNoteUsedFallback(false)
    await recorder.start()
    setPhase('recording')
  }

  async function handleStopRecording() {
    setPhase('generating')
    // stop() settles all in-flight chunk transcriptions before returning.
    const transcript = await recorder.stop()
    setTranscriptText(transcript)
    const note = await generateSoapNote(transcript, encounterLabel)
    setNoteSections({
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan
    })
    setNoteModel(note.model)
    setNoteUsedFallback(note.usedFallback)
    setPhase('editing')
  }

  async function handleRegenerate() {
    if (!transcriptText.trim()) return
    setIsRegenerating(true)
    try {
      const note = await generateSoapNote(transcriptText, encounterLabel)
      setNoteSections({
        subjective: note.subjective,
        objective: note.objective,
        assessment: note.assessment,
        plan: note.plan
      })
      setNoteModel(note.model)
      setNoteUsedFallback(note.usedFallback)
      setSaveMessage('')
    } finally {
      setIsRegenerating(false)
    }
  }

  async function handleSave(status: ScribeEncounterStatus) {
    setIsSaving(true)
    setSaveMessage('')
    try {
      const saved = await saveScribeEncounter({
        id: currentEncounterId || undefined,
        encounterLabel,
        transcriptText,
        noteSections,
        status,
        model: noteModel
      })
      setCurrentEncounterId(saved.id)
      setCurrentStatus(saved.status)
      setSaveMessage(status === 'final' ? 'Encounter saved and marked final.' : 'Encounter draft saved.')
      await refreshEncounters()
    } catch (error) {
      console.warn('Failed to save scribe encounter.', error)
      setSaveMessage('Save failed. Your text is still on screen; try again.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenEncounter(record: ScribeEncounterRecord) {
    setCurrentEncounterId(record.id)
    setEncounterLabel(record.encounterLabel)
    setTranscriptText(record.transcriptText)
    setNoteSections({ ...EMPTY_SECTIONS, ...record.noteSections })
    setNoteModel(record.model)
    setNoteUsedFallback(false)
    setCurrentStatus(record.status)
    setSaveMessage('')
    setPhase('editing')
  }

  async function handleDeleteEncounter(id: string) {
    try {
      await deleteScribeEncounter(id)
      if (id === currentEncounterId) {
        setCurrentEncounterId('')
        setPhase('idle')
      }
      await refreshEncounters()
    } catch (error) {
      console.warn('Failed to delete scribe encounter.', error)
      setListError('Delete failed. Try again.')
    }
  }

  function handleDiscard() {
    setPhase('idle')
    setCurrentEncounterId('')
    setEncounterLabel('')
    setTranscriptText('')
    setNoteSections({ ...EMPTY_SECTIONS })
    setSaveMessage('')
  }

  const failedSegmentCount = recorder.segments.filter((segment) => segment.failed).length
  const liveTranscript = recorder.segments
    .map((segment) => segment.text)
    .filter((text): text is string => Boolean(text))
    .join(' ')

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-black text-white"
      style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <header className="border-b bg-black" style={{ borderColor: '#ffffff70' }}>
        <div className="atlas-shell-edge-buffer flex h-[54px] items-center justify-between border-b" style={{ borderColor: '#ffffff45' }}>
          <a
            href={getWorkspaceUrl()}
            className="atlas-font-heading text-[17px] font-medium tracking-[0.08em] text-white"
            aria-label="Go to ATLAS workspace"
          >
            ATLAS
          </a>
          <AtlasOverline className="text-[#9eacb9]">scribe</AtlasOverline>
        </div>
        <div className="atlas-shell-edge-buffer flex min-h-[54px] items-center py-2">
          <AtlasTextButton
            onClick={() => window.location.assign(getWorkspaceUrl())}
            className="inline-flex items-center gap-2 px-[14px] py-[7px] text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: '#ffffff2f', color: SP_COLORS.white } as React.CSSProperties}
          >
            <AtlasArrowIcon decorative direction="left" className="h-[1.1rem] w-[1.1rem] opacity-90" />
            back to workspace
          </AtlasTextButton>
        </div>
      </header>

      <main className="atlas-shell-edge-buffer mx-auto w-full max-w-[1240px] space-y-4 py-6 md:py-8">
        <AtlasPanel
          kicker="point-of-care listening"
          title="Record an encounter"
          description="Press record, have the conversation, and Atlas drafts a Subjective, Objective, Assessment, Plan (SOAP) note for your review. Audio is transcribed in ~45 second chunks and never stored."
        >
          <div className="space-y-4">
            <label className="block max-w-[480px]">
              <small className="atlas-overline block text-[#9eacb9]">encounter label (optional, avoid identifying details)</small>
              <input
                value={encounterLabel}
                onChange={(event) => setEncounterLabel(event.target.value)}
                className="atlas-admin-input mt-1 w-full"
                placeholder="e.g. Wellness check follow-up"
                disabled={phase === 'recording' || phase === 'generating'}
              />
            </label>

            {phase === 'recording' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <AtlasTextButton
                    onClick={() => void handleStopRecording()}
                    className="inline-flex items-center gap-2 px-5 py-3 text-[15px] font-medium"
                    style={{ ['--button-border-color' as const]: SP_COLORS.red } as React.CSSProperties}
                  >
                    <Square className="h-4 w-4" />
                    stop and generate note
                  </AtlasTextButton>
                  <AtlasStatusPill color={SP_COLORS.red}>recording {formatElapsed(recorder.elapsedSeconds)}</AtlasStatusPill>
                  {recorder.pendingCount > 0 ? (
                    <AtlasMetaText className="text-[#9eacb9]">
                      transcribing {recorder.pendingCount} chunk{recorder.pendingCount === 1 ? '' : 's'}…
                    </AtlasMetaText>
                  ) : null}
                  {failedSegmentCount > 0 ? (
                    <AtlasStatusPill color={SP_COLORS.yellow}>
                      {failedSegmentCount} chunk{failedSegmentCount === 1 ? '' : 's'} failed — transcript may have gaps
                    </AtlasStatusPill>
                  ) : null}
                </div>
                <AtlasInsetCard>
                  <AtlasOverline className="text-[#9eacb9]">live transcript</AtlasOverline>
                  <AtlasBodyText className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">
                    {liveTranscript || 'Listening… transcript text appears here as each chunk is processed.'}
                  </AtlasBodyText>
                </AtlasInsetCard>
              </div>
            ) : phase === 'generating' ? (
              <AtlasInsetCard>
                <AtlasBodyText className="text-[14px]">
                  Finishing transcription and drafting the SOAP note… this can take up to a minute for long conversations.
                </AtlasBodyText>
              </AtlasInsetCard>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <AtlasTextButton
                  onClick={() => void handleStartRecording()}
                  className="inline-flex items-center gap-2 px-5 py-3 text-[15px] font-medium"
                  style={{ ['--button-border-color' as const]: SP_COLORS.red } as React.CSSProperties}
                >
                  <Mic className="h-4 w-4" />
                  {phase === 'editing' ? 'record new encounter' : 'start recording'}
                </AtlasTextButton>
                <AtlasMetaText className="text-[#9eacb9]">
                  Notes are drafts generated by Artificial Intelligence (AI) and always require clinician review before use.
                </AtlasMetaText>
              </div>
            )}
            {recorder.recorderError ? (
              <AtlasBodyText className="text-[13px]" >
                <span style={{ color: SP_COLORS.red }}>{recorder.recorderError}</span>
              </AtlasBodyText>
            ) : null}
          </div>
        </AtlasPanel>

        {phase === 'editing' ? (
          <AtlasPanel
            kicker="draft note"
            title={encounterLabel.trim() || 'Untitled encounter'}
            description={
              noteUsedFallback
                ? 'Automatic generation was unavailable; the transcript is preserved below for manual note writing.'
                : `Generated${noteModel ? ` by ${noteModel}` : ''}. Edit each section, then save.`
            }
            actions={
              <AtlasStatusPill color={currentStatus === 'final' ? SP_COLORS.deepGreen : SP_COLORS.yellow}>
                {currentStatus === 'final' ? 'final' : 'draft'}
              </AtlasStatusPill>
            }
          >
            <div className="space-y-4">
              {SOAP_SECTION_LABELS.map(({ key, label }) => (
                <label key={key} className="block">
                  <small className="atlas-overline block text-[#9eacb9]">{label}</small>
                  <textarea
                    value={noteSections[key]}
                    onChange={(event) =>
                      setNoteSections((current) => ({ ...current, [key]: event.target.value }))
                    }
                    className="atlas-textarea mt-1 min-h-[90px] w-full bg-transparent text-[14px] leading-relaxed text-white"
                  />
                </label>
              ))}
              <label className="block">
                <small className="atlas-overline block text-[#9eacb9]">conversation transcript</small>
                <textarea
                  value={transcriptText}
                  onChange={(event) => setTranscriptText(event.target.value)}
                  className="atlas-textarea mt-1 min-h-[140px] w-full bg-transparent text-[13px] leading-relaxed text-white"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <AtlasMetaText>
                  <span style={{ color: saveMessage.startsWith('Save failed') ? SP_COLORS.red : '#9eacb9' }}>
                    {saveMessage || 'AI drafts require review; nothing is shared until you save.'}
                  </span>
                </AtlasMetaText>
                <div className="flex flex-wrap items-center gap-2">
                  <AtlasTextButton
                    disabled={isRegenerating || !transcriptText.trim()}
                    onClick={() => void handleRegenerate()}
                    className="px-4 py-2 text-[13px]"
                  >
                    {isRegenerating ? 'regenerating…' : 'regenerate note'}
                  </AtlasTextButton>
                  <AtlasTextButton disabled={isSaving} onClick={handleDiscard} className="px-4 py-2 text-[13px]">
                    close
                  </AtlasTextButton>
                  <AtlasTextButton
                    disabled={isSaving}
                    onClick={() => void handleSave('draft')}
                    className="px-4 py-2 text-[13px]"
                  >
                    {isSaving ? 'saving…' : 'save draft'}
                  </AtlasTextButton>
                  <AtlasTextButton
                    disabled={isSaving}
                    onClick={() => void handleSave('final')}
                    className="px-4 py-2 text-[13px]"
                    style={{ ['--button-border-color' as const]: SP_COLORS.deepGreen } as React.CSSProperties}
                  >
                    save as final
                  </AtlasTextButton>
                </div>
              </div>
            </div>
          </AtlasPanel>
        ) : null}

        <AtlasPanel
          kicker="history"
          title="Saved encounters"
          description="Only you can see your encounters. Reopen a note to keep editing, or delete it permanently."
        >
          {listError ? (
            <AtlasBodyText className="text-[13px]">
              <span style={{ color: SP_COLORS.red }}>{listError}</span>
            </AtlasBodyText>
          ) : encounters.length === 0 ? (
            <AtlasMetaText className="text-[#9eacb9]">No saved encounters yet.</AtlasMetaText>
          ) : (
            <div className="space-y-2">
              {encounters.map((record) => (
                <AtlasInsetCard key={record.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <AtlasBodyText className="truncate text-[14px] font-medium">
                      {record.encounterLabel.trim() || 'Untitled encounter'}
                    </AtlasBodyText>
                    <AtlasMetaText className="text-[#9eacb9]">{formatEncounterDate(record.createdAtIso)}</AtlasMetaText>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AtlasStatusPill color={record.status === 'final' ? SP_COLORS.deepGreen : SP_COLORS.yellow}>
                      {record.status}
                    </AtlasStatusPill>
                    <AtlasTextButton onClick={() => handleOpenEncounter(record)} className="px-3 py-1 text-[12px]">
                      open
                    </AtlasTextButton>
                    <AtlasTextButton
                      onClick={() => void handleDeleteEncounter(record.id)}
                      className="px-3 py-1 text-[12px]"
                      style={{ ['--button-border-color' as const]: SP_COLORS.red } as React.CSSProperties}
                    >
                      delete
                    </AtlasTextButton>
                  </div>
                </AtlasInsetCard>
              ))}
            </div>
          )}
        </AtlasPanel>
      </main>
    </div>
  )
}
