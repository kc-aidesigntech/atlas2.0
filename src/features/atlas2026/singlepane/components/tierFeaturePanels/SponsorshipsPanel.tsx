import React from 'react'
import { Field, RecordTable } from '@/features/atlas2026/admin/components/AdminControlPanelPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  createSponsorship,
  endSponsorship,
  listSponsorships,
  resolveViewerPersonId,
  type SponsorshipRecord
} from '@/features/atlas2026/singlepane/data-access/tierFeatureRepository'
import {
  PersonSelect,
  StatusWordPill,
  TierFeatureActionButton,
  TierFeatureErrorLine,
  TierFeatureListNotice,
  TierFeatureNoAccess,
  TierFeaturePanel,
  dateLabel,
  usePeopleDirectory,
  useTierFeatureList,
  useTierFeatureWrite
} from '@/features/atlas2026/singlepane/components/tierFeaturePanels/tierFeaturePanelShared'

interface SponsorshipsPanelProps {
  /** `sponsorship.give`: create and end sponsorships where the viewer is the sponsor. */
  canGiveSponsorship: boolean
  /** `sponsorship.receive`: read the viewer's own received sponsorships. */
  canReceiveSponsorship: boolean
}

/**
 * Sponsorships. A `sponsorship.give` holder sees every row Row-Level Security
 * (RLS) returns, creates one through `fn_create_sponsorship` naming themself
 * as sponsor, and ends their own. A `sponsorship.receive` holder sees the rows
 * where they are the sponsored person.
 */
export default function SponsorshipsPanel({ canGiveSponsorship, canReceiveSponsorship }: SponsorshipsPanelProps) {
  const sponsorships = useTierFeatureList(listSponsorships)
  const people = usePeopleDirectory()
  const write = useTierFeatureWrite(sponsorships.reload)
  const [viewerPersonId, setViewerPersonId] = React.useState<string | null>(null)
  const [sponsoredPersonId, setSponsoredPersonId] = React.useState('')

  React.useEffect(() => {
    let isMounted = true
    void resolveViewerPersonId().then((personId) => {
      if (isMounted) setViewerPersonId(personId)
    })
    return () => {
      isMounted = false
    }
  }, [])

  if (!canGiveSponsorship && !canReceiveSponsorship) {
    return <TierFeatureNoAccess permissionKey="sponsorship.give or sponsorship.receive" title="sponsorships" />
  }

  const isBusy = Boolean(write.busyKey)
  const given = sponsorships.rows.filter((row) => row.sponsorPersonId === viewerPersonId)
  const received = sponsorships.rows.filter((row) => row.sponsoredPersonId === viewerPersonId)
  const others = sponsorships.rows.filter((row) => row.sponsorPersonId !== viewerPersonId && row.sponsoredPersonId !== viewerPersonId)
  const activeSponsoredIds = given.filter((row) => row.status === 'active').map((row) => row.sponsoredPersonId)

  function submitSponsorship() {
    if (!viewerPersonId || !sponsoredPersonId) return
    void write.run('create', async () => {
      await createSponsorship(viewerPersonId, sponsoredPersonId)
      setSponsoredPersonId('')
    })
  }

  function renderRow(row: { id: string }) {
    const sponsorship = row as SponsorshipRecord
    const isMineToEnd = canGiveSponsorship && sponsorship.sponsorPersonId === viewerPersonId && sponsorship.status === 'active'
    return (
      <div className="grid items-center gap-3 px-4 py-3 text-[13px] text-white" style={{ gridTemplateColumns: '1.3fr repeat(4, minmax(0, 1fr))' }}>
        <div className="truncate font-medium">{sponsorship.sponsoredPersonId === viewerPersonId ? 'you' : sponsorship.sponsoredName}</div>
        <div className="truncate text-[12px]">{sponsorship.sponsorPersonId === viewerPersonId ? 'you' : sponsorship.sponsorName}</div>
        <div className="text-[12px]">
          <div>{dateLabel(sponsorship.startedAtIso)}</div>
          {sponsorship.endedAtIso ? <small className="block text-[11px] text-[var(--foreground-secondary)]">ended {dateLabel(sponsorship.endedAtIso)}</small> : null}
        </div>
        <div>
          <StatusWordPill status={sponsorship.status} />
        </div>
        <div>
          {isMineToEnd ? (
            <TierFeatureActionButton onClick={() => void write.run(`end:${sponsorship.id}`, () => endSponsorship(sponsorship.id))} disabled={isBusy} accent={SP_COLORS.red}>
              {write.busyKey === `end:${sponsorship.id}` ? 'ending…' : 'end'}
            </TierFeatureActionButton>
          ) : null}
        </div>
      </div>
    )
  }

  const columns = ['sponsored', 'sponsor', 'started', 'status', 'actions']

  return (
    <TierFeaturePanel
      kicker="sponsorships"
      title="Sponsorships"
      description={
        canGiveSponsorship
          ? 'Sponsor a Candidate or Apprentice into the practice. One active sponsorship per pair.'
          : 'The people sponsoring you into the practice.'
      }
    >
      <div className="space-y-5">
        {canGiveSponsorship ? (
          <div className="atlas-surface-raised grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <Field label="sponsor a person">
              <PersonSelect
                people={people.rows}
                value={sponsoredPersonId}
                onChange={setSponsoredPersonId}
                disabled={isBusy || !viewerPersonId}
                excludeIds={[...activeSponsoredIds, ...(viewerPersonId ? [viewerPersonId] : [])]}
              />
            </Field>
            <TierFeatureActionButton onClick={submitSponsorship} disabled={isBusy || !viewerPersonId || !sponsoredPersonId} accent={SP_COLORS.deepGreen}>
              {write.busyKey === 'create' ? 'saving…' : 'start sponsorship'}
            </TierFeatureActionButton>
            {!viewerPersonId ? (
              <small className="atlas-caption block text-[var(--foreground-secondary)] md:col-span-2">
                Your account has no person row yet, so you cannot be named as sponsor.
              </small>
            ) : null}
          </div>
        ) : null}

        <TierFeatureErrorLine message={write.error} />
        <TierFeatureListNotice state={sponsorships} emptyLabel="No sponsorships on record." tableLabel="The sponsorships table" />

        {received.length ? (
          <section className="space-y-2">
            <small className="atlas-overline block">sponsoring you</small>
            <RecordTable columns={columns} rows={received} renderRow={renderRow} />
          </section>
        ) : null}
        {given.length ? (
          <section className="space-y-2">
            <small className="atlas-overline block">you sponsor</small>
            <RecordTable columns={columns} rows={given} renderRow={renderRow} />
          </section>
        ) : null}
        {canGiveSponsorship && others.length ? (
          <section className="space-y-2">
            <small className="atlas-overline block">other sponsorships</small>
            <RecordTable columns={columns} rows={others} renderRow={renderRow} />
          </section>
        ) : null}
      </div>
    </TierFeaturePanel>
  )
}
