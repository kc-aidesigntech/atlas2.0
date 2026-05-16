/**
 * Partner referral intake panel that validates submissions and forwards clean
 * queue-ready records into navigator pickup workflows.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import AtlasImageUploadTile from '../../components/AtlasImageUploadTile'
import { AtlasCloseButton, AtlasInsetCard, AtlasPlusButton, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { PartnerReferralSubmissionInput, UnassignedEnrolleePickupRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import atlasLogoSrc from '../../../../../assets/ATLAS_LOGO_final_white_bkg.png'

interface PartnerReferralWorkflowPanelProps {
  defaultReferrerName: string
  defaultPartnerOrganizationName: string
  recentReferrals: UnassignedEnrolleePickupRecord[]
  onSubmit: (input: PartnerReferralSubmissionInput) => Promise<unknown> | unknown
  accentColor?: string
}

interface ReferralSourceOption {
  id: string
  label: string
  partnerOrganizationName: string
  partnerContactName: string
  partnerContactEmail: string
  partnerContactPhone: string
  existingPartner: boolean
}

const MAX_RECENT_ROWS = 5
const PARTICIPANT_PHONE_DIGIT_LIMIT = 10
const DEFAULT_PHONE_COUNTRY_CODE = '+1'
const PHONE_COUNTRY_CODE_OPTIONS = ['+1', '+44', '+52']

/**
 * Start every submission from caller-provided defaults so downstream consumers
 * receive the same shape whether this is first load or a post-submit reset.
 */
function buildInitialDraft(defaultReferrerName: string, defaultPartnerOrganizationName: string): PartnerReferralSubmissionInput {
  return {
    referredParticipantName: '',
    participantEmail: '',
    participantPhone: '',
    situationCategories: [],
    backgroundNotes: '',
    selfReferring: true,
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
  onSubmit,
  accentColor = SP_COLORS.yellow
}: PartnerReferralWorkflowPanelProps) {
  const [draft, setDraft] = useState<PartnerReferralSubmissionInput>(() =>
    buildInitialDraft(defaultReferrerName, defaultPartnerOrganizationName)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [participantPhoneCountryCode, setParticipantPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE)
  const [isReferralSourceDropdownOpen, setIsReferralSourceDropdownOpen] = useState(false)
  const [isAddReferralSourceOverlayOpen, setIsAddReferralSourceOverlayOpen] = useState(false)
  const [customReferralSources, setCustomReferralSources] = useState<ReferralSourceOption[]>([])
  const [newReferralSourceDraft, setNewReferralSourceDraft] = useState({
    partnerOrganizationName: '',
    partnerContactName: '',
    partnerContactEmail: '',
    partnerContactPhone: ''
  })
  const [referralImageSrc, setReferralImageSrc] = useState(atlasLogoSrc)
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
  const referralSourceOptions = useMemo<ReferralSourceOption[]>(() => {
    const seen = new Set<string>()
    const historical = recentReferrals
      .map((item, index) => {
        const organizationName = item.referrerOrganization.trim()
        const contactName = item.referrerName.trim()
        const dedupeKey = `${organizationName.toLowerCase()}::${contactName.toLowerCase()}`
        if (!organizationName && !contactName) return null
        if (seen.has(dedupeKey)) return null
        seen.add(dedupeKey)
        return {
          id: `history-${index}`,
          label: organizationName || contactName || 'previous referral source',
          partnerOrganizationName: organizationName,
          partnerContactName: contactName,
          partnerContactEmail: '',
          partnerContactPhone: '',
          existingPartner: true
        } satisfies ReferralSourceOption
      })
      .filter(Boolean) as ReferralSourceOption[]
    return [...historical, ...customReferralSources]
  }, [customReferralSources, recentReferrals])
  const selectedReferralSourceLabel = useMemo(() => {
    const match = referralSourceOptions.find(
      (option) =>
        option.partnerOrganizationName === draft.partnerOrganizationName &&
        option.partnerContactName === draft.partnerContactName &&
        option.partnerContactEmail === draft.partnerContactEmail &&
        option.partnerContactPhone === draft.partnerContactPhone
    )
    return match?.label || draft.partnerOrganizationName || draft.partnerContactName || ''
  }, [draft.partnerContactEmail, draft.partnerContactName, draft.partnerContactPhone, draft.partnerOrganizationName, referralSourceOptions])
  const existingPartnerOrganizationOptions = useMemo(() => {
    // Build a clean organization list from known referral sources so existing-partner submissions
    // stay constrained to previously observed partner organizations.
    const options = new Set<string>()
    for (const option of referralSourceOptions) {
      const organizationName = option.partnerOrganizationName.trim()
      if (organizationName) options.add(organizationName)
    }
    const currentDraftOrganization = draft.partnerOrganizationName.trim()
    if (currentDraftOrganization) options.add(currentDraftOrganization)
    const defaultOrganization = defaultPartnerOrganizationName.trim()
    if (defaultOrganization) options.add(defaultOrganization)
    return Array.from(options).sort((left, right) => left.localeCompare(right))
  }, [defaultPartnerOrganizationName, draft.partnerOrganizationName, referralSourceOptions])
  const accentTextColor = isLucidGreenAccent(accentColor) ? '#111111' : accentColor
  const accentSelectedBackground = isLucidGreenAccent(accentColor)
    ? 'color-mix(in srgb, var(--atlas-signal-lucid-green) 24%, #101010)'
    : 'color-mix(in srgb, currentColor 18%, #101010)'

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
    const normalizedSituationCategories: string[] = []
    const normalizedBackgroundNotes = draft.backgroundNotes.trim()
    const normalizedEmail = draft.participantEmail.trim()
    const normalizedPhoneDigits = draft.participantPhone.trim()
    const normalizedPhone = buildPhoneToE164(participantPhoneCountryCode, normalizedPhoneDigits)
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
    if (!normalizedBackgroundNotes) {
      setError("share this person's situation.")
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
    if (normalizedPhoneDigits && normalizedPhoneDigits.length !== PARTICIPANT_PHONE_DIGIT_LIMIT) {
      setError(`participant phone must be exactly ${PARTICIPANT_PHONE_DIGIT_LIMIT} digits.`)
      return
    }
    if (draft.selfReferring && !normalizedPartnerOrg) {
      setError('add the partner organization name.')
      return
    }
    if (draft.selfReferring && !draft.existingPartner && !normalizedPartnerContact && !normalizedPartnerContactEmail && !normalizedPartnerContactPhone) {
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
          situationCategories: normalizedSituationCategories,
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
      setIsReferralSourceDropdownOpen(false)
      setParticipantPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE)
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
    <AtlasInsetCard className="atlas-surface-panel space-y-4 border-white/20 bg-[#0c0c0c] px-5 py-5">
      <div className="flex flex-wrap items-start gap-3 pt-0.5 sm:flex-nowrap">
        <AtlasImageUploadTile
          imageSrc={referralImageSrc}
          alt="atlas logo"
          onSelectFile={(file) => {
            // Referral image stays local-only for now. This preserves
            // a consistent User Experience (UX) with profile upload while we define storage.
            if (!file.type.startsWith('image/')) {
              setError('choose an image file for the logo.')
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
          idleStatusText="add your logo here"
        />
        <div className="min-w-[220px] flex-1 space-y-1 pt-[2px] text-white">
          <small className="atlas-overline block" style={{ color: SP_COLORS.muted }}>
            referral portal
          </small>
          <div className="atlas-h4 text-[24px] font-medium text-white">referral form</div>
          <small className="atlas-caption block text-[var(--foreground-secondary)]">
            Thank you for initiating this referral form. Please provide any contact information and details about the
            situation that you are able to share.
          </small>
          <small className="atlas-meta block text-white">Partner org: {draft.partnerOrganizationName || 'not provided'}</small>
          <small className="atlas-meta block text-white">
            Source: {draft.selfReferring ? "self - i'm referring the participant" : 'on behalf of someone else'}
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
            are you referring the enrollee, or are you submitting on behalf of someone else?*
          </span>
          <AtlasTextButton
            type="button"
            onClick={() => setDraft((current) => ({ ...current, selfReferring: true }))}
            className="w-full px-3 py-2 text-[14px]"
            style={
              {
                ['--button-border-color' as const]: draft.selfReferring ? accentColor : '#ffffff40',
                color: draft.selfReferring ? accentTextColor : SP_COLORS.white
              } as React.CSSProperties
            }
          >
            self - i&apos;m referring the participant
          </AtlasTextButton>
          <AtlasTextButton
            type="button"
            onClick={() => setDraft((current) => ({ ...current, selfReferring: false }))}
            className="w-full px-3 py-2 text-[14px]"
            style={
              {
                ['--button-border-color' as const]: !draft.selfReferring ? accentColor : '#ffffff40',
                color: !draft.selfReferring ? accentTextColor : SP_COLORS.white
              } as React.CSSProperties
            }
          >
            on behalf of someone else
          </AtlasTextButton>
        </div>

        {!draft.selfReferring ? (
          <Field label="referral source">
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReferralSourceDropdownOpen((current) => !current)}
                  className="atlas-input flex min-h-[44px] flex-1 items-center justify-between text-left"
                >
                  <span className={selectedReferralSourceLabel ? 'text-white' : 'text-[var(--foreground-secondary)]'}>
                    {selectedReferralSourceLabel || 'choose a prior referral source or add a new partner'}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                    {isReferralSourceDropdownOpen ? 'close' : 'choose'}
                  </span>
                </button>
                {/* Keep icon-only controls on shared square primitives so referral workspace actions
                    match the rest of the shell and avoid one-off button variants. */}
                <AtlasPlusButton
                  onClick={() => setIsAddReferralSourceOverlayOpen(true)}
                  label="add referral source"
                  title="add referral source"
                />
              </div>
              {isReferralSourceDropdownOpen ? (
                <div className="atlas-surface-raised rounded-[18px] bg-[#0b0b0b] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                  <div className="grid gap-1.5">
                    {referralSourceOptions.length ? (
                      referralSourceOptions.map((option) => {
                        const selected = selectedReferralSourceLabel === option.label
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setDraft((current) => ({
                                ...current,
                                partnerOrganizationName: option.partnerOrganizationName,
                                partnerContactName: option.partnerContactName,
                                partnerContactEmail: option.partnerContactEmail,
                                partnerContactPhone: option.partnerContactPhone,
                                existingPartner: option.existingPartner
                              }))
                              setIsReferralSourceDropdownOpen(false)
                            }}
                            className="flex items-center justify-between rounded-[14px] border px-3 py-2 text-left text-[13px] transition-colors"
                            style={{
                              borderColor: selected ? accentColor : '#ffffff18',
                              backgroundColor: selected ? accentSelectedBackground : '#101010',
                              color: selected ? accentTextColor : '#f5f5f5'
                            }}
                          >
                            <span>{option.label}</span>
                            <span className="text-[11px] uppercase tracking-[0.12em]">
                              {selected ? 'selected' : 'select'}
                            </span>
                          </button>
                        )
                      })
                    ) : (
                      <div className="rounded-[14px] border border-white/10 px-3 py-3 text-[12px] text-[var(--foreground-secondary)]">
                        No previous referral sources yet. Use `+` to add one.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </Field>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Participant&apos;s Name*">
            <input
              value={draft.referredParticipantName}
              onChange={(event) => setDraft((current) => ({ ...current, referredParticipantName: event.target.value }))}
              className="atlas-admin-input"
              placeholder="participant full name"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="share this person&apos;s situation*">
              <textarea
                value={draft.backgroundNotes}
                onChange={(event) => setDraft((current) => ({ ...current, backgroundNotes: event.target.value }))}
                className="atlas-admin-input min-h-[140px] py-2"
                placeholder="Describe this person's situation, risks, history, needs, and any other context that would help someone understand what is going on."
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
            <div className="flex items-center gap-2">
              <select
                value={participantPhoneCountryCode}
                onChange={(event) => setParticipantPhoneCountryCode(event.target.value)}
                className="atlas-admin-input w-[96px] min-w-[96px]"
                aria-label="participant phone country code"
              >
                {PHONE_COUNTRY_CODE_OPTIONS.map((countryCode) => (
                  <option key={countryCode} value={countryCode}>
                    {countryCode}
                  </option>
                ))}
              </select>
              <input
                value={draft.participantPhone}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    participantPhone: sanitizePhoneDigits(event.target.value, PARTICIPANT_PHONE_DIGIT_LIMIT)
                  }))
                }
                className="atlas-admin-input"
                placeholder="1234567890"
                inputMode="numeric"
                maxLength={PARTICIPANT_PHONE_DIGIT_LIMIT}
              />
            </div>
            <small className="mt-1 block text-[11px] text-[var(--foreground-secondary)]">
              Enter {PARTICIPANT_PHONE_DIGIT_LIMIT} digits. Saved as E.164 (International Telecommunication Union (ITU-T) E.164).
            </small>
          </Field>
        </div>

        {draft.selfReferring ? (
          <div className="atlas-surface-raised bg-white/5 p-4">
          <small className="atlas-overline block text-[var(--foreground-secondary)]">partner details</small>
          <div className="mt-2 flex flex-wrap gap-2">
            <AtlasTextButton
              onClick={() => setDraft((current) => ({ ...current, existingPartner: true }))}
              className="px-[14px] py-[7px] text-[14px]"
              style={
                {
                  ['--button-border-color' as const]: draft.existingPartner ? accentColor : '#ffffff40',
                  color: draft.existingPartner ? accentTextColor : SP_COLORS.white
                } as React.CSSProperties
              }
            >
              existing partner
            </AtlasTextButton>
            <AtlasTextButton
              onClick={() => setDraft((current) => ({ ...current, existingPartner: false }))}
              className="px-[14px] py-[7px] text-[14px]"
              style={
                {
                  ['--button-border-color' as const]: !draft.existingPartner ? accentColor : '#ffffff40',
                  color: !draft.existingPartner ? accentTextColor : SP_COLORS.white
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
              {draft.existingPartner ? (
                <select
                  value={draft.partnerOrganizationName}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      partnerOrganizationName: event.target.value
                    }))
                  }
                  className="atlas-admin-input"
                >
                  <option value="">select partner organization</option>
                  {existingPartnerOrganizationOptions.map((organizationName) => (
                    <option key={organizationName} value={organizationName}>
                      {organizationName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={draft.partnerOrganizationName}
                  onChange={(event) => setDraft((current) => ({ ...current, partnerOrganizationName: event.target.value }))}
                  className="atlas-admin-input"
                  placeholder="organization name"
                />
              )}
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
        ) : null}

        {error ? <small className="block text-[13px]" style={{ color: SP_COLORS.red }}>{error}</small> : null}
        {feedback ? <small className="block text-[13px]" style={{ color: SP_COLORS.deepGreen }}>{feedback}</small> : null}

        <div className="flex justify-end">
          <AtlasTextButton
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-[13px] font-medium"
            style={{ ['--button-border-color' as const]: accentColor, color: accentTextColor } as React.CSSProperties}
          >
            {isSubmitting ? 'submitting...' : 'submit referral'}
          </AtlasTextButton>
        </div>
        <div className="atlas-surface-raised bg-black/30 px-3 py-2 text-[13px] text-[#cfcfcf]">
          If you need assistance with this form, call (360) 539-8899
        </div>
      </form>

      {isAddReferralSourceOverlayOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-[2px]">
          <div className="atlas-surface-panel w-full max-w-[560px] bg-[#080808] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <small className="atlas-overline block text-[var(--foreground-secondary)]">new referral source</small>
                <div className="atlas-h4 mt-1 text-[22px] font-medium text-white">Add referral source</div>
                <small className="atlas-caption block text-[var(--foreground-secondary)]">
                  None of these fields are required. Saving will add the partner to the selectable source list and auto-select it.
                </small>
              </div>
              <AtlasCloseButton
                type="button"
                onClick={() => setIsAddReferralSourceOverlayOpen(false)}
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="company name">
                <input
                  value={newReferralSourceDraft.partnerOrganizationName}
                  onChange={(event) => setNewReferralSourceDraft((current) => ({ ...current, partnerOrganizationName: event.target.value }))}
                  className="atlas-admin-input"
                />
              </Field>
              <Field label="point of contact">
                <input
                  value={newReferralSourceDraft.partnerContactName}
                  onChange={(event) => setNewReferralSourceDraft((current) => ({ ...current, partnerContactName: event.target.value }))}
                  className="atlas-admin-input"
                />
              </Field>
              <Field label="phone">
                <input
                  value={newReferralSourceDraft.partnerContactPhone}
                  onChange={(event) => setNewReferralSourceDraft((current) => ({ ...current, partnerContactPhone: event.target.value }))}
                  className="atlas-admin-input"
                />
              </Field>
              <Field label="email">
                <input
                  value={newReferralSourceDraft.partnerContactEmail}
                  onChange={(event) => setNewReferralSourceDraft((current) => ({ ...current, partnerContactEmail: event.target.value }))}
                  className="atlas-admin-input"
                />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <AtlasTextButton
                type="button"
                onClick={() => setIsAddReferralSourceOverlayOpen(false)}
                className="px-[19px] py-[10px] text-[14px]"
                style={{ ['--button-border-color' as const]: '#ffffff30', color: '#f1f1f1' } as React.CSSProperties}
              >
                cancel
              </AtlasTextButton>
              <AtlasTextButton
                type="button"
                onClick={() => {
                  const nextOption: ReferralSourceOption = {
                    id: `custom-${Date.now().toString(36)}`,
                    label:
                      newReferralSourceDraft.partnerOrganizationName.trim() ||
                      newReferralSourceDraft.partnerContactName.trim() ||
                      'new partner',
                    partnerOrganizationName: newReferralSourceDraft.partnerOrganizationName.trim(),
                    partnerContactName: newReferralSourceDraft.partnerContactName.trim(),
                    partnerContactEmail: newReferralSourceDraft.partnerContactEmail.trim(),
                    partnerContactPhone: newReferralSourceDraft.partnerContactPhone.trim(),
                    existingPartner: false
                  }
                  setCustomReferralSources((current) => [...current, nextOption])
                  setDraft((current) => ({
                    ...current,
                    partnerOrganizationName: nextOption.partnerOrganizationName,
                    partnerContactName: nextOption.partnerContactName,
                    partnerContactEmail: nextOption.partnerContactEmail,
                    partnerContactPhone: nextOption.partnerContactPhone,
                    existingPartner: false
                  }))
                  setNewReferralSourceDraft({
                    partnerOrganizationName: '',
                    partnerContactName: '',
                    partnerContactEmail: '',
                    partnerContactPhone: ''
                  })
                  setIsAddReferralSourceOverlayOpen(false)
                  setIsReferralSourceDropdownOpen(false)
                }}
                className="px-[19px] py-[10px] text-[14px]"
                style={{ ['--button-border-color' as const]: accentColor, color: accentTextColor } as React.CSSProperties}
              >
                add referral source
              </AtlasTextButton>
            </div>
          </div>
        </div>
      ) : null}

      <div className="atlas-surface-raised bg-white/5 px-4 py-3">
        <small className="atlas-overline block text-[var(--foreground-secondary)]">recent referrals</small>
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

function sanitizePhoneDigits(value: string, maxDigits: number) {
  return value.replace(/\D/g, '').slice(0, maxDigits)
}

function buildPhoneToE164(countryCode: string, localDigits: string) {
  const normalizedCode = countryCode.replace(/[^\d+]/g, '')
  const normalizedDigits = localDigits.replace(/\D/g, '')
  if (!normalizedCode.startsWith('+') || !normalizedDigits) return ''
  return `${normalizedCode}${normalizedDigits}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] text-[var(--foreground-secondary)]">
      <span className="mb-1.5 block uppercase tracking-[0.12em]">{label}</span>
      {children}
    </label>
  )
}

function isLucidGreenAccent(color: string) {
  const normalized = color.trim().toLowerCase()
  return normalized.includes('atlas-signal-lucid-green') || normalized === '#81bc36' || normalized === 'rgb(129 188 54)'
}
