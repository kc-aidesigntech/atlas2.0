/**
 * Partner referral intake panel that validates submissions and forwards clean
 * queue-ready records into navigator pickup workflows.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import AtlasImageUploadTile from '../../components/AtlasImageUploadTile'
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

/**
 * Start every submission from caller-provided defaults so downstream consumers
 * receive the same shape whether this is first load or a post-submit reset.
 */
function buildInitialDraft(defaultReferrerName: string, defaultPartnerOrganizationName: string): PartnerReferralSubmissionInput {
  return {
    referredParticipantName: '',
    participantEmail: '',
    participantPhone: '',
    referralReason: '',
    backgroundNotes: '',
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
  const [referralImageSrc, setReferralImageSrc] = useState(() => createReferralPlaceholderImage())
  const imageObjectUrlRef = useRef<string | null>(null)

  // Recent list intentionally excludes archived rows and caps to a small slice
  // so this panel remains scannable in constrained single-pane layouts.
  const recentRows = useMemo(
    () =>
      recentReferrals
        .filter((item) => item.status !== 'archived')
        .slice()
        .sort((left, right) => new Date(right.referredAtIso).getTime() - new Date(left.referredAtIso).getTime())
        .slice(0, MAX_RECENT_ROWS),
    [recentReferrals]
  )

  useEffect(() => {
    return () => {
      // Revoke blob Uniform Resource Locator (URL) created from local uploads to prevent memory leaks
      // when this panel unmounts.
      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current)
      }
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setError(null)
    const normalizedName = draft.referredParticipantName.trim()
    const normalizedReason = draft.referralReason.trim()
    const normalizedBackgroundNotes = draft.backgroundNotes.trim()
    const normalizedEmail = draft.participantEmail.trim()
    const normalizedPhone = draft.participantPhone.trim()
    const normalizedReferrer = draft.referrerName.trim()
    const normalizedPartnerOrg = draft.partnerOrganizationName.trim()
    const normalizedPartnerContact = draft.partnerContactName.trim()
    const normalizedPartnerContactEmail = draft.partnerContactEmail.trim()
    const normalizedPartnerContactPhone = draft.partnerContactPhone.trim()

    // Keep validation messages tightly aligned with form wording so
    // partner users can resolve issues without guesswork.
    if (!normalizedName) {
      setError("add the participant's name.")
      return
    }
    if (!normalizedReason) {
      setError("add this person's situation.")
      return
    }
    if (!normalizedReferrer) {
      setError('add the name of the person entering this referral.')
      return
    }
    if (!normalizedEmail && !normalizedPhone) {
      setError('add at least one way to contact the participant.')
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
      // Submit only normalized values so queue records are consistent even when
      // form fields include leading/trailing whitespace.
      await Promise.resolve(
        onSubmit({
          ...draft,
          referredParticipantName: normalizedName,
          referralReason: normalizedReason,
          backgroundNotes: normalizedBackgroundNotes,
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
      // Preserve the resolved partner org on reset to support rapid repeat
      // referrals for the same organization without retyping.
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
        <AtlasImageUploadTile
          imageSrc={referralImageSrc}
          alt="referral placeholder"
          onSelectFile={(file) => {
            // Referral image stays local-only for now. This preserves
            // a consistent User Experience (UX) with profile upload while we define storage.
            if (!file.type.startsWith('image/')) {
              setError('choose an image file for the referral placeholder.')
              return
            }
            setError(null)
            const objectUrl = URL.createObjectURL(file)
            if (imageObjectUrlRef.current) {
              URL.revokeObjectURL(imageObjectUrlRef.current)
            }
            imageObjectUrlRef.current = objectUrl
            setReferralImageSrc(objectUrl)
          }}
          buttonTitle="replace referral image"
          idleStatusText="referral image placeholder"
        />
        <div className="min-w-[220px] flex-1 space-y-1 pt-[2px] text-white">
          <small className="block text-[12px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
            referral portal
          </small>
          <div className="text-[24px] font-medium text-white">referral form</div>
          <small className="block text-[13px] text-[var(--foreground-secondary)]">
            Thank you for initiating this referral form. Please provide any contact information and details about the
            situation that you are able to share.
          </small>
          <small className="block text-[13px] text-white">Partner org: {draft.partnerOrganizationName || 'not provided'}</small>
          <small className="block text-[13px] text-white">
            Source: {draft.selfReferring ? "Self - I'm Referring the Participant" : 'Someone/something else is the source of referral'}
          </small>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Name of Person Entering*">
          <input
            value={draft.referrerName}
            onChange={(event) => setDraft((current) => ({ ...current, referrerName: event.target.value }))}
            className="atlas-admin-input"
            placeholder="name of person entering"
          />
        </Field>

        <div className="space-y-2">
          <span className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
            Are you referring the participant? Or Did Someone Else?*
          </span>
          <AtlasTextButton
            type="button"
            onClick={() => setDraft((current) => ({ ...current, selfReferring: true }))}
            className="w-full px-3 py-2 text-[14px]"
            style={
              {
                ['--button-border-color' as const]: draft.selfReferring ? SP_COLORS.yellow : '#ffffff40',
                color: draft.selfReferring ? SP_COLORS.yellow : SP_COLORS.white
              } as React.CSSProperties
            }
          >
            Self - I&apos;m Referring the Participant
          </AtlasTextButton>
          <AtlasTextButton
            type="button"
            onClick={() => setDraft((current) => ({ ...current, selfReferring: false }))}
            className="w-full px-3 py-2 text-[14px]"
            style={
              {
                ['--button-border-color' as const]: !draft.selfReferring ? SP_COLORS.yellow : '#ffffff40',
                color: !draft.selfReferring ? SP_COLORS.yellow : SP_COLORS.white
              } as React.CSSProperties
            }
          >
            Someone/something else is the source of referral
          </AtlasTextButton>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Participant&apos;s Name*">
            <input
              value={draft.referredParticipantName}
              onChange={(event) => setDraft((current) => ({ ...current, referredParticipantName: event.target.value }))}
              className="atlas-admin-input"
              placeholder="participant full name"
            />
          </Field>
          <Field label="Share this person&apos;s situation">
            <input
              value={draft.referralReason}
              onChange={(event) => setDraft((current) => ({ ...current, referralReason: event.target.value }))}
              className="atlas-admin-input"
              placeholder="brief situation details"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="additional context (optional)">
              <textarea
                value={draft.backgroundNotes}
                onChange={(event) => setDraft((current) => ({ ...current, backgroundNotes: event.target.value }))}
                className="atlas-admin-input min-h-[140px] py-2"
                placeholder="Add any additional context, risks, history, needs, or related details."
              />
            </Field>
          </div>
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
          {/* New partners must provide a contact path; existing partners skip
              these fields to keep the workflow short for known organizations. */}
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
        <div className="rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-[13px] text-[#cfcfcf]">
          If you need assistance with this form, call (360) 539-8899
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
  // Data-URI placeholder keeps this panel self-contained until referral images
  // are persisted server-side.
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
