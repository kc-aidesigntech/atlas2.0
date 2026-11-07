import React from 'react'
import { Field, RecordTable } from '@/features/atlas2026/admin/components/AdminControlPanelPrimitives'
import { AtlasMetricPill } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  LEAD_STAGES,
  listLeads,
  upsertLead,
  type LeadRecord,
  type LeadStage
} from '@/features/atlas2026/singlepane/data-access/tierFeatureRepository'
import {
  PersonSelect,
  StatusWordPill,
  TierFeatureActionButton,
  TierFeatureErrorLine,
  TierFeatureListNotice,
  TierFeatureNoAccess,
  TierFeaturePanel,
  dateTimeLabel,
  usePeopleDirectory,
  useTierFeatureList,
  useTierFeatureWrite
} from '@/features/atlas2026/singlepane/components/tierFeaturePanels/tierFeaturePanelShared'

interface LeadsPanelProps {
  canEngageLeads: boolean
}

interface LeadDraft {
  displayName: string
  phone: string
  email: string
  source: string
  stage: LeadStage
  notes: string
  ownerPersonId: string
}

const EMPTY_DRAFT: LeadDraft = { displayName: '', phone: '', email: '', source: '', stage: 'new', notes: '', ownerPersonId: '' }

/**
 * Leads pipeline for `leads.engage` holders: every `atlas.leads` row the
 * Row-Level Security (RLS) policy returns, grouped by stage, with a create
 * form and per-row stage, contact, and note edits. Every write is one
 * `fn_upsert_lead` call.
 */
export default function LeadsPanel({ canEngageLeads }: LeadsPanelProps) {
  const leads = useTierFeatureList(listLeads)
  const people = usePeopleDirectory()
  const write = useTierFeatureWrite(leads.reload)
  const [draft, setDraft] = React.useState<LeadDraft>(EMPTY_DRAFT)
  const [isComposerOpen, setIsComposerOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingNotes, setEditingNotes] = React.useState('')
  const [stageFilter, setStageFilter] = React.useState<LeadStage | 'all'>('all')

  if (!canEngageLeads) return <TierFeatureNoAccess permissionKey="leads.engage" title="leads" />

  const countsByStage = LEAD_STAGES.map((stage) => ({ stage, count: leads.rows.filter((lead) => lead.stage === stage).length }))
  const visibleLeads = stageFilter === 'all' ? leads.rows : leads.rows.filter((lead) => lead.stage === stageFilter)
  const isBusy = Boolean(write.busyKey)

  function submitDraft() {
    const displayName = draft.displayName.trim()
    if (!displayName) return
    void write.run('create', async () => {
      await upsertLead({
        displayName,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        source: draft.source.trim() || null,
        stage: draft.stage,
        notes: draft.notes.trim() || null,
        ownerPersonId: draft.ownerPersonId || undefined
      })
      setDraft(EMPTY_DRAFT)
      setIsComposerOpen(false)
    })
  }

  function setStage(lead: LeadRecord, stage: LeadStage) {
    if (stage === lead.stage) return
    void write.run(`stage:${lead.id}`, () => upsertLead({ id: lead.id, stage }))
  }

  function markContacted(lead: LeadRecord) {
    // A lead still at `new` moves to `contacted` with the timestamp.
    void write.run(`contact:${lead.id}`, () =>
      upsertLead({ id: lead.id, lastContactAtIso: new Date().toISOString(), stage: lead.stage === 'new' ? 'contacted' : undefined })
    )
  }

  function saveNotes(lead: LeadRecord) {
    void write.run(`notes:${lead.id}`, async () => {
      await upsertLead({ id: lead.id, notes: editingNotes.trim() || null })
      setEditingId(null)
    })
  }

  return (
    <TierFeaturePanel
      kicker="leads"
      title="Leads pipeline"
      description="People being engaged toward a referral or enrollment. New leads default to you as owner."
      actions={
        <TierFeatureActionButton onClick={() => setIsComposerOpen((open) => !open)} disabled={isBusy} accent={SP_COLORS.yellow}>
          {isComposerOpen ? 'close' : 'new lead'}
        </TierFeatureActionButton>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setStageFilter('all')} className="text-left" aria-pressed={stageFilter === 'all'}>
            <AtlasMetricPill label="all" value={leads.rows.length} accentColor={stageFilter === 'all' ? SP_COLORS.yellow : undefined} />
          </button>
          {countsByStage.map((entry) => (
            <button key={entry.stage} type="button" onClick={() => setStageFilter(entry.stage)} className="text-left" aria-pressed={stageFilter === entry.stage}>
              <AtlasMetricPill label={entry.stage} value={entry.count} accentColor={stageFilter === entry.stage ? SP_COLORS.yellow : undefined} />
            </button>
          ))}
        </div>

        {isComposerOpen ? (
          <div className="atlas-surface-raised grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2">
            <Field label="display name">
              <input value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="atlas-admin-input" />
            </Field>
            <Field label="stage">
              <select value={draft.stage} onChange={(event) => setDraft({ ...draft, stage: event.target.value as LeadStage })} className="atlas-admin-input">
                {LEAD_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="phone">
              <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="atlas-admin-input" />
            </Field>
            <Field label="email">
              <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className="atlas-admin-input" />
            </Field>
            <Field label="source">
              <input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} className="atlas-admin-input" placeholder="warm line, referral, event…" />
            </Field>
            <Field label="owner (defaults to you)">
              <PersonSelect people={people.rows} value={draft.ownerPersonId} onChange={(ownerPersonId) => setDraft({ ...draft, ownerPersonId })} placeholder="me" />
            </Field>
            <div className="md:col-span-2">
              <Field label="notes">
                <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="atlas-admin-input min-h-[80px] resize-y" />
              </Field>
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <TierFeatureActionButton onClick={submitDraft} disabled={isBusy || !draft.displayName.trim()} accent={SP_COLORS.deepGreen}>
                {write.busyKey === 'create' ? 'saving…' : 'save lead'}
              </TierFeatureActionButton>
            </div>
          </div>
        ) : null}

        <TierFeatureErrorLine message={write.error} />
        <TierFeatureListNotice state={leads} emptyLabel="No leads yet." tableLabel="The leads table" />

        {visibleLeads.length ? (
          <RecordTable
            columns={['lead', 'stage', 'owner', 'last contact', 'actions']}
            rows={visibleLeads}
            renderRow={(row) => {
              const lead = row as LeadRecord
              const isEditing = editingId === lead.id
              return (
                <div className="px-4 py-3">
                  <div className="grid items-center gap-3 text-[13px] text-white" style={{ gridTemplateColumns: '1.3fr repeat(4, minmax(0, 1fr))' }}>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{lead.displayName}</div>
                      <small className="block truncate text-[11px] text-[var(--foreground-secondary)]">
                        {[lead.phone, lead.email, lead.source].filter(Boolean).join(' · ') || 'no contact details'}
                      </small>
                    </div>
                    <div>
                      <select value={lead.stage} onChange={(event) => setStage(lead, event.target.value as LeadStage)} disabled={isBusy} className="atlas-admin-input" aria-label="Stage">
                        {LEAD_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="truncate text-[12px]">{lead.ownerName || 'unowned'}</div>
                    <div className="text-[12px]">{dateTimeLabel(lead.lastContactAtIso, 'never')}</div>
                    <div className="flex flex-wrap gap-2">
                      <TierFeatureActionButton onClick={() => markContacted(lead)} disabled={isBusy}>
                        {write.busyKey === `contact:${lead.id}` ? 'saving…' : 'contacted now'}
                      </TierFeatureActionButton>
                      <TierFeatureActionButton
                        onClick={() => {
                          setEditingId(isEditing ? null : lead.id)
                          setEditingNotes(lead.notes || '')
                        }}
                        disabled={isBusy}
                      >
                        {isEditing ? 'cancel' : 'notes'}
                      </TierFeatureActionButton>
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="mt-3 space-y-2">
                      <textarea value={editingNotes} onChange={(event) => setEditingNotes(event.target.value)} className="atlas-admin-input min-h-[72px] resize-y" />
                      <TierFeatureActionButton onClick={() => saveNotes(lead)} disabled={isBusy} accent={SP_COLORS.deepGreen}>
                        {write.busyKey === `notes:${lead.id}` ? 'saving…' : 'save notes'}
                      </TierFeatureActionButton>
                    </div>
                  ) : lead.notes ? (
                    <small className="mt-2 block text-[12px] text-[var(--foreground-secondary)]">{lead.notes}</small>
                  ) : null}
                  <div className="mt-2">
                    <StatusWordPill status={lead.stage} />
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
