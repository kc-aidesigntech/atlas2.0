import React, { useMemo, useState } from 'react'
import { AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { PartnerReferralSubmissionInput, UnassignedEnrolleePickupRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface PartnerReferralWorkflowPanelProps {
  defaultReferrerName: string
  defaultPartnerOrganizationName: string
  recentReferrals: UnassignedEnrolleePickupRecord[]
  onSubmit: (input: PartnerReferralSubmissionInput) => Promise<unknown> | unknown
}

const MAX_RECENT_ROWS = 5

function buildInitialDraft(defaultReferrerName: string, defaultPartnerOrganizationName: string): PartnerReferralSubmissionInput {
  return {
    referredParticipantName: '',
    participantEmail: '',
    participantPhone: '',
    referralReason: '',
    selfReferring: false,
    referrerName: defaultReferrerName,
    existingPartner: Boolean(defaultPartnerOrganizationName.trim()),
    partnerOrganizationName: defaultPartnerOrganizationName,
    partnerContactName: '',
    partnerContactEmail: '',
    partnerContactPhone: ''
  }
}

export default function PartnerReferralWorkflowPanel({
  defaultReferrerName,
  defaultPartnerOrganizationName,
  recentReferrals,
  onSubmit
}: PartnerReferralWorkflowPanelProps) {
  const [draft, setDraft] = useState<PartnerReferralSubmissionInput>(() =>
    buildInitialDraft(defaultReferrerName, defaultPartnerOrganizationName)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recentRows = useMemo(
    () =>
      recentReferrals
        .filter((item) => item.status !== 'archived')
        .slice()
        .sort((left, right) => new Date(right.referredAtIso).getTime() - new Date(left.referredAtIso).getTime())
        .slice(0, MAX_RECENT_ROWS),
    [recentReferrals]
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setError(null)
    const normalizedName = draft.referredParticipantName.trim()
    const normalizedReason = draft.referralReason.trim()
    const normalizedEmail = draft.participantEmail.trim()
    const normalizedPhone = draft.participantPhone.trim()
    const normalizedReferrer = draft.referrerName.trim()
    const normalizedPartnerOrg = draft.partnerOrganizationName.trim()
    const normalizedPartnerContact = draft.partnerContactName.trim()
    const normalizedPartnerContactEmail = draft.partnerContactEmail.trim()
    const normalizedPartnerContactPhone = draft.partnerContactPhone.trim()

    if (!normalizedName) {
      setError('add who is being referred.')
      return
    }
    if (!normalizedReason) {
      setError('add why they are being referred.')
      return
    }
    if (!normalizedEmail && !normalizedPhone) {
      setError('add at least one way to contact the participant.')
      return
    }
    if (!draft.selfReferring && !normalizedReferrer) {
      setError('add who is making this referral.')
      return
    }
    if (!normalizedPartnerOrg) {
      setError('add the partner organization name.')
      return
    }
    if (!draft.existingPartner && !normalizedPartnerContact && !normalizedPartnerContactEmail && !normalizedPartnerContactPhone) {
      setError('for new partners, include at least one contact detail.')
      return
    }

    setIsSubmitting(true)
    try {
      await Promise.resolve(
        onSubmit({
          ...draft,
          referredParticipantName: normalizedName,
          referralReason: normalizedReason,
          participantEmail: normalizedEmail,
          participantPhone: normalizedPhone,
          referrerName: normalizedReferrer,
          partnerOrganizationName: normalizedPartnerOrg,
          partnerContactName: normalizedPartnerContact,
          partnerContactEmail: normalizedPartnerContactEmail,
          partnerContactPhone: normalizedPartnerContactPhone
        })
      )
      setFeedback('referral submitted to navigator queue.')
      setDraft(buildInitialDraft(defaultReferrerName, normalizedPartnerOrg || defaultPartnerOrganizationName))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'unable to submit referral right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AtlasInsetCard className="space-y-4 rounded-[24px] border-white/20 bg-[#0c0c0c] px-5 py-5">
      <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
        <div className="mx-auto flex w-[150px] shrink-0 flex-col items-start sm:mx-0">
          <div
            className="h-[150px] w-[150px] overflow-hidden rounded-[38px] border bg-white"
            style={{ borderColor: SP_COLORS.white, borderWidth: '2.5px' }}
          >
            <img
              src={createReferralPlaceholderImage()}
              alt="referral placeholder"
              className="h-full w-full object-cover"
            />
          </div>
          <small className="mt-2 block text-[11px]" style={{ color: SP_COLORS.muted }}>
            referral image placeholder
          </small>
        </div>
        <div className="min-w-[220px] flex-1 space-y-1 pt-[2px] text-white">
          <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
            referral portal
          </small>
          <div className="text-[24px] font-medium text-white">submit referral</div>
          <small className="block text-[13px] text-[var(--foreground-secondary)]">
            capture who is being referred, why support is needed, and contact information in one pass.
          </small>
          <small className="block text-[13px] text-white">Partner org: {draft.partnerOrganizationName || 'not provided'}</small>
          <small className="block text-[13px] text-white">Referrer: {draft.referrerName || 'self referral'}</small>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="who is being referred">
            <input
              value={draft.referredParticipantName}
              onChange={(event) => setDraft((current) => ({ ...current, referredParticipantName: event.target.value }))}
              className="atlas-admin-input"
              placeholder="participant full name"
            />
          </Field>
          <Field label="why are they being referred">
            <input
              value={draft.referralReason}
              onChange={(event) => setDraft((current) => ({ ...current, referralReason: event.target.value }))}
              className="atlas-admin-input"
              placeholder="brief reason for referral"
            />
          </Field>
          <Field label="participant email">
            <input
              value={draft.participantEmail}
              onChange={(event) => setDraft((current) => ({ ...current, participantEmail: event.target.value }))}
              className="atlas-admin-input"
              placeholder="name@example.com"
            />
          </Field>
          <Field label="participant phone">
            <input
              value={draft.participantPhone}
              onChange={(event) => setDraft((current) => ({ ...current, participantPhone: event.target.value }))}
              className="atlas-admin-input"
              placeholder="(555) 555-5555"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-white">
          <input
            type="checkbox"
            checked={draft.selfReferring}
            onChange={(event) => setDraft((current) => ({ ...current, selfReferring: event.target.checked }))}
          />
          self-referral
        </label>

        {!draft.selfReferring ? (
          <Field label="referred by">
            <input
              value={draft.referrerName}
              onChange={(event) => setDraft((current) => ({ ...current, referrerName: event.target.value }))}
              className="atlas-admin-input"
              placeholder="referrer name"
            />
          </Field>
        ) : null}

        <div className="rounded-[16px] border border-white/10 bg-white/5 p-4">
          <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">partner details</small>
          <div className="mt-2 flex flex-wrap gap-2">
            <AtlasTextButton
              onClick={() => setDraft((current) => ({ ...current, existingPartner: true }))}
              className="px-3 py-1.5 text-[12px]"
              style={
                {
                  ['--button-border-color' as const]: draft.existingPartner ? SP_COLORS.yellow : '#ffffff40',
                  color: draft.existingPartner ? SP_COLORS.yellow : SP_COLORS.white
                } as React.CSSProperties
              }
            >
              existing partner
            </AtlasTextButton>
            <AtlasTextButton
              onClick={() => setDraft((current) => ({ ...current, existingPartner: false }))}
              className="px-3 py-1.5 text-[12px]"
              style={
                {
                  ['--button-border-color' as const]: !draft.existingPartner ? SP_COLORS.yellow : '#ffffff40',
                  color: !draft.existingPartner ? SP_COLORS.yellow : SP_COLORS.white
                } as React.CSSProperties
              }
            >
              new partner
            </AtlasTextButton>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="partner organization">
              <input
                value={draft.partnerOrganizationName}
                onChange={(event) => setDraft((current) => ({ ...current, partnerOrganizationName: event.target.value }))}
                className="atlas-admin-input"
                placeholder="organization name"
              />
            </Field>
            {!draft.existingPartner ? (
              <Field label="partner contact name">
                <input
                  value={draft.partnerContactName}
                  onChange={(event) => setDraft((current) => ({ ...current, partnerContactName: event.target.value }))}
                  className="atlas-admin-input"
                  placeholder="contact name"
                />
              </Field>
            ) : null}
            {!draft.existingPartner ? (
              <Field label="partner contact email">
                <input
                  value={draft.partnerContactEmail}
                  onChange={(event) => setDraft((current) => ({ ...current, partnerContactEmail: event.target.value }))}
                  className="atlas-admin-input"
                  placeholder="partner@email.com"
                />
              </Field>
            ) : null}
            {!draft.existingPartner ? (
              <Field label="partner contact phone">
                <input
                  value={draft.partnerContactPhone}
                  onChange={(event) => setDraft((current) => ({ ...current, partnerContactPhone: event.target.value }))}
                  className="atlas-admin-input"
                  placeholder="(555) 555-5555"
                />
              </Field>
            ) : null}
          </div>
        </div>

        {error ? <small className="block text-[13px]" style={{ color: SP_COLORS.red }}>{error}</small> : null}
        {feedback ? <small className="block text-[13px]" style={{ color: SP_COLORS.deepGreen }}>{feedback}</small> : null}

        <div className="flex justify-end">
          <AtlasTextButton
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
          >
            {isSubmitting ? 'submitting...' : 'submit referral'}
          </AtlasTextButton>
        </div>
      </form>

      <div className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
        <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">recent referrals</small>
        <div className="mt-2 space-y-2">
          {recentRows.length ? (
            recentRows.map((row) => (
              <div key={row.id} className="rounded-[12px] border border-white/10 bg-black/30 px-3 py-2">
                <div className="text-[13px] font-medium text-white">{row.fullName}</div>
                <small className="block text-[12px] text-[var(--foreground-secondary)]">
                  {row.referrerOrganization} · {new Date(row.referredAtIso).toLocaleDateString()}
                </small>
              </div>
            ))
          ) : (
            <small className="block text-[12px] text-[var(--foreground-secondary)]">
              no referrals submitted from this workspace yet.
            </small>
          )}
        </div>
      </div>
    </AtlasInsetCard>
  )
}

function createReferralPlaceholderImage() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="300" height="300" rx="56" fill="#111111" />
      <circle cx="150" cy="150" r="114" fill="#1d1d1d" stroke="#ffffff" stroke-width="6" />
      <text x="150" y="170" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="82" font-weight="700" fill="#ffffff">R</text>
    </svg>
  `.trim()
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] text-[var(--foreground-secondary)]">
      <span className="mb-1.5 block uppercase tracking-[0.12em]">{label}</span>
      {children}
    </label>
  )
}
