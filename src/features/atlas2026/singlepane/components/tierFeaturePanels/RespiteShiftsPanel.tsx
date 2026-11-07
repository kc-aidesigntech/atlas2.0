import React from 'react'
import { Field, RecordTable } from '@/features/atlas2026/admin/components/AdminControlPanelPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  claimRespiteShift,
  createRespiteShift,
  listRespiteShifts,
  resolveViewerPersonId,
  setRespiteShiftStatus,
  type RespiteShiftRecord
} from '@/features/atlas2026/singlepane/data-access/tierFeatureRepository'
import {
  StatusWordPill,
  TierFeatureActionButton,
  TierFeatureErrorLine,
  TierFeatureListNotice,
  TierFeatureNoAccess,
  TierFeaturePanel,
  dateTimeLabel,
  localInputToIso,
  nextHourLocalInput,
  useTierFeatureList,
  useTierFeatureWrite
} from '@/features/atlas2026/singlepane/components/tierFeaturePanels/tierFeaturePanelShared'

interface RespiteShiftsPanelProps {
  canTakeShifts: boolean
}

/**
 * Respite shifts for `respite_shifts.take` holders. Lists every
 * `atlas.respite_shifts` row Row-Level Security (RLS) returns; the viewer
 * claims a cancelled shift onto their own person id, releases (cancels) or
 * completes their own shifts, and schedules a new shift for themself.
 */
export default function RespiteShiftsPanel({ canTakeShifts }: RespiteShiftsPanelProps) {
  const shifts = useTierFeatureList(listRespiteShifts)
  const write = useTierFeatureWrite(shifts.reload)
  const [viewerPersonId, setViewerPersonId] = React.useState<string | null>(null)
  const [isComposerOpen, setIsComposerOpen] = React.useState(false)
  const [site, setSite] = React.useState('')
  const [startsAtLocal, setStartsAtLocal] = React.useState(() => nextHourLocalInput())
  const [endsAtLocal, setEndsAtLocal] = React.useState(() => nextHourLocalInput(4))
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    let isMounted = true
    void resolveViewerPersonId().then((personId) => {
      if (isMounted) setViewerPersonId(personId)
    })
    return () => {
      isMounted = false
    }
  }, [])

  if (!canTakeShifts) return <TierFeatureNoAccess permissionKey="respite_shifts.take" title="respite shifts" />

  const isBusy = Boolean(write.busyKey)
  const startsAtIso = localInputToIso(startsAtLocal)
  const endsAtIso = localInputToIso(endsAtLocal)
  const canSubmit = Boolean(viewerPersonId && site.trim() && startsAtIso && endsAtIso && endsAtIso > startsAtIso)

  function submitShift() {
    if (!viewerPersonId || !startsAtIso || !endsAtIso) return
    void write.run('create', async () => {
      await createRespiteShift({ personId: viewerPersonId, site, startsAtIso, endsAtIso, note: note.trim() || null })
      setSite('')
      setNote('')
      setIsComposerOpen(false)
    })
  }

  return (
    <TierFeaturePanel
      kicker="respite shifts"
      title="Respite shifts"
      description="Shifts you hold at a respite site. Claim a released shift, release one you cannot make, or schedule a new one."
      actions={
        <TierFeatureActionButton onClick={() => setIsComposerOpen((open) => !open)} disabled={isBusy || !viewerPersonId} accent={SP_COLORS.yellow}>
          {isComposerOpen ? 'close' : 'schedule shift'}
        </TierFeatureActionButton>
      }
    >
      <div className="space-y-4">
        {!viewerPersonId ? (
          <small className="atlas-caption block text-[var(--foreground-secondary)]">
            Your account has no person row yet, so shifts cannot be claimed from here.
          </small>
        ) : null}

        {isComposerOpen ? (
          <div className="atlas-surface-raised grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2">
            <Field label="site">
              <input value={site} onChange={(event) => setSite(event.target.value)} className="atlas-admin-input" />
            </Field>
            <Field label="note">
              <input value={note} onChange={(event) => setNote(event.target.value)} className="atlas-admin-input" />
            </Field>
            <Field label="starts">
              <input type="datetime-local" value={startsAtLocal} onChange={(event) => setStartsAtLocal(event.target.value)} className="atlas-admin-input" />
            </Field>
            <Field label="ends">
              <input type="datetime-local" value={endsAtLocal} onChange={(event) => setEndsAtLocal(event.target.value)} className="atlas-admin-input" />
            </Field>
            <div className="md:col-span-2">
              <TierFeatureActionButton onClick={submitShift} disabled={isBusy || !canSubmit} accent={SP_COLORS.deepGreen}>
                {write.busyKey === 'create' ? 'saving…' : 'save shift'}
              </TierFeatureActionButton>
            </div>
          </div>
        ) : null}

        <TierFeatureErrorLine message={write.error} />
        <TierFeatureListNotice state={shifts} emptyLabel="No respite shifts on the board." tableLabel="The respite shifts table" />

        {shifts.rows.length ? (
          <RecordTable
            columns={['site', 'when', 'holder', 'status', 'actions']}
            rows={shifts.rows}
            renderRow={(row) => {
              const shift = row as RespiteShiftRecord
              const isMine = Boolean(viewerPersonId) && shift.personId === viewerPersonId
              // A cancelled shift is open for anyone with the key; a scheduled one belongs to its holder.
              const canClaim = Boolean(viewerPersonId) && !isMine && shift.status === 'cancelled'
              return (
                <div className="grid items-center gap-3 px-4 py-3 text-[13px] text-white" style={{ gridTemplateColumns: '1.3fr repeat(4, minmax(0, 1fr))' }}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{shift.site}</div>
                    {shift.note ? <small className="block truncate text-[11px] text-[var(--foreground-secondary)]">{shift.note}</small> : null}
                  </div>
                  <div className="text-[12px]">
                    <div>{dateTimeLabel(shift.startsAtIso)}</div>
                    <small className="block text-[11px] text-[var(--foreground-secondary)]">to {dateTimeLabel(shift.endsAtIso)}</small>
                  </div>
                  <div className="truncate text-[12px]">{isMine ? 'you' : shift.personName}</div>
                  <div>
                    <StatusWordPill status={shift.status} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canClaim ? (
                      <TierFeatureActionButton onClick={() => void write.run(`claim:${shift.id}`, () => claimRespiteShift(shift.id, viewerPersonId as string))} disabled={isBusy} accent={SP_COLORS.deepGreen}>
                        {write.busyKey === `claim:${shift.id}` ? 'claiming…' : 'claim'}
                      </TierFeatureActionButton>
                    ) : null}
                    {isMine && shift.status === 'scheduled' ? (
                      <>
                        <TierFeatureActionButton onClick={() => void write.run(`complete:${shift.id}`, () => setRespiteShiftStatus(shift.id, 'completed'))} disabled={isBusy}>
                          {write.busyKey === `complete:${shift.id}` ? 'saving…' : 'complete'}
                        </TierFeatureActionButton>
                        <TierFeatureActionButton onClick={() => void write.run(`release:${shift.id}`, () => setRespiteShiftStatus(shift.id, 'cancelled'))} disabled={isBusy} accent={SP_COLORS.red}>
                          {write.busyKey === `release:${shift.id}` ? 'saving…' : 'release'}
                        </TierFeatureActionButton>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            }}
          />
        ) : null}
      </div>
    </TierFeaturePanel>
  )
}
