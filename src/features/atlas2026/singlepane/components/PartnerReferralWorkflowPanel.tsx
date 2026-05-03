/**
 * Partner referral intake panel that validates submissions and forwards clean
 * queue-ready records into navigator pickup workflows.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import AtlasImageUploadTile from '../../components/AtlasImageUploadTile'
import { AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { DEFAULT_SERVICE_CAPACITY_SECTIONS } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import type { PartnerReferralSubmissionInput, UnassignedEnrolleePickupRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import atlasLogoSrc from '../../../../../assets/ATLAS_LOGO_simple_lucidGreenBlue4.png'

interface PartnerReferralWorkflowPanelProps {
  defaultReferrerName: string
  defaultPartnerOrganizationName: string
  recentReferrals: UnassignedEnrolleePickupRecord[]
  onSubmit: (input: PartnerReferralSubmissionInput) => Promise<unknown> | unknown
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
const OTHER_SITUATION_CATEGORY = 'Other'
const SITUATION_CATEGORY_OPTIONS = [
  ...DEFAULT_SERVICE_CAPACITY_SECTIONS.map((section) => section.theme.trim()),
  OTHER_SITUATION_CATEGORY
]

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
  const [isSituationDropdownOpen, setIsSituationDropdownOpen] = useState(false)
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
      .filter((value): value is ReferralSourceOption => Boolean(value))
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
    const normalizedSituationCategories = Array.from(new Set(draft.situationCategories.map((value) => value.trim()).filter(Boolean)))
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
    if (!normalizedSituationCategories.length) {
      setError("add this person's situation.")
      return
    }
    if (!normalizedBackgroundNotes) {
      setError("explain this person's situation as well as possible.")
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
      setIsSituationDropdownOpen(false)
      setIsReferralSourceDropdownOpen(false)
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

        {!draft.selfReferring ? (
          <Field label="referral source">
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReferralSourceDropdownOpen((current) => !current)}
                  className="atlas-admin-input flex min-h-[44px] flex-1 items-center justify-between text-left"
                >
                  <span className={selectedReferralSourceLabel ? 'text-white' : 'text-[var(--foreground-secondary)]'}>
                    {selectedReferralSourceLabel || 'choose a prior referral source or add a new partner'}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                    {isReferralSourceDropdownOpen ? 'close' : 'choose'}
                  </span>
                </button>
                <AtlasTextButton
                  type="button"
                  onClick={() => setIsAddReferralSourceOverlayOpen(true)}
                  className="px-3 py-2 text-[16px] font-medium"
                  style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
                >
                  +
                </AtlasTextButton>
              </div>
              {isReferralSourceDropdownOpen ? (
                <div className="rounded-[18px] border border-white/10 bg-[#0b0b0b] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
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
                              borderColor: selected ? SP_COLORS.yellow : '#ffffff18',
                              backgroundColor: selected ? '#1a1606' : '#101010',
                              color: selected ? SP_COLORS.yellow : '#f5f5f5'
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
          <Field label="Share this person&apos;s situation">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSituationDropdownOpen((current) => !current)}
                className="atlas-admin-input flex min-h-[44px] w-full items-center justify-between text-left"
              >
                <span className={draft.situationCategories.length ? 'text-white' : 'text-[var(--foreground-secondary)]'}>
                  {draft.situationCategories.length ? draft.situationCategories.join(', ') : 'select one or more categories'}
                </span>
                <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">
                  {isSituationDropdownOpen ? 'close' : 'choose'}
                </span>
              </button>
              {isSituationDropdownOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-[260px] overflow-y-auto rounded-[18px] border border-white/10 bg-[#0b0b0b] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                  <div className="grid gap-1.5">
                    {SITUATION_CATEGORY_OPTIONS.map((option) => {
                      const selected = draft.situationCategories.includes(option)
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              situationCategories: selected
                                ? current.situationCategories.filter((value) => value !== option)
                                : [...current.situationCategories, option]
                            }))
                          }
                          className="flex items-center justify-between rounded-[14px] border px-3 py-2 text-left text-[13px] transition-colors"
                          style={{
                            borderColor: selected ? SP_COLORS.yellow : '#ffffff18',
                            backgroundColor: selected ? '#1a1606' : '#101010',
                            color: selected ? SP_COLORS.yellow : '#f5f5f5'
                          }}
                        >
                          <span>{option}</span>
                          <span className="text-[11px] uppercase tracking-[0.12em]">
                            {selected ? 'selected' : 'select'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </Field>
          <div className="md:col-span-2">
            <Field label="explain this person&apos;s situation as well as possible*">
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
            <input
              value={draft.participantPhone}
              onChange={(event) => setDraft((current) => ({ ...current, participantPhone: event.target.value }))}
              className="atlas-admin-input"
              placeholder="(555) 555-5555"
            />
          </Field>
        </div>

        {draft.selfReferring ? (
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
        ) : null}

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

      {isAddReferralSourceOverlayOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 py-6 backdrop-blur-[2px]">
          <div className="w-full max-w-[560px] rounded-[24px] border border-white/15 bg-[#080808] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <small className="block text-[12px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">new referral source</small>
                <div className="mt-1 text-[22px] font-medium text-white">Add referral source</div>
                <small className="block text-[12px] text-[var(--foreground-secondary)]">
                  None of these fields are required. Saving will add the partner to the selectable source list and auto-select it.
                </small>
              </div>
              <AtlasTextButton
                type="button"
                onClick={() => setIsAddReferralSourceOverlayOpen(false)}
                className="px-4 py-2 text-[12px]"
                style={{ ['--button-border-color' as const]: '#ffffff30', color: '#f1f1f1' } as React.CSSProperties}
              >
                close
              </AtlasTextButton>
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
                className="px-4 py-2 text-[12px]"
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
                className="px-4 py-2 text-[12px]"
                style={{ ['--button-border-color' as const]: SP_COLORS.yellow, color: SP_COLORS.yellow } as React.CSSProperties}
              >
                add referral source
              </AtlasTextButton>
            </div>
          </div>
        </div>
      ) : null}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12px] text-[var(--foreground-secondary)]">
      <span className="mb-1.5 block uppercase tracking-[0.12em]">{label}</span>
      {children}
    </label>
  )
}
