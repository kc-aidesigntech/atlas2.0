import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import PartnerReferralWorkflowPanel from '@/features/atlas2026/singlepane/components/PartnerReferralWorkflowPanel'
import { enqueuePublicReferralQueueRecord, loadPublicReferralQueueRecords } from '@/features/atlas2026/singlepane/data-access/publicReferralRepository'
import { buildPartnerInquiryQueueUpdate, buildReferralQueueUpdate } from '@/features/atlas2026/singlepane/referralWorkflowUtils'
import type { NavigatorProgramState, PartnerReferralSubmissionInput, UnassignedEnrolleePickupRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSupabaseAuth } from '@/auth/SupabaseAuthProvider'

const EMPTY_PROGRAM_STATE: NavigatorProgramState = {
  pickupQueue: [],
  selfAssessments: [],
  supervisionSessions: [],
  intervalAssessmentRules: [],
  updatedAtIso: new Date().toISOString()
}

export default function PublicAtlasLandingPage() {
  const { session, signOut } = useSupabaseAuth()
  const [recentPublicReferrals, setRecentPublicReferrals] = React.useState<UnassignedEnrolleePickupRecord[]>([])
  const [isSubmittingInquiry, setIsSubmittingInquiry] = React.useState(false)
  const [inquiryError, setInquiryError] = React.useState<string | null>(null)
  const [inquirySuccess, setInquirySuccess] = React.useState<string | null>(null)
  const [inquiryDraft, setInquiryDraft] = React.useState({
    contactName: '',
    organizationName: '',
    contactEmail: '',
    contactPhone: '',
    backgroundNotes: ''
  })

  React.useEffect(() => {
    setRecentPublicReferrals(loadPublicReferralQueueRecords())
  }, [])

  function enqueueRecord(record: UnassignedEnrolleePickupRecord) {
    enqueuePublicReferralQueueRecord(record)
    setRecentPublicReferrals((current) => [record, ...current.filter((item) => item.id !== record.id)])
  }

  async function submitPublicReferral(input: PartnerReferralSubmissionInput) {
    const { nextRecord } = buildReferralQueueUpdate(input, EMPTY_PROGRAM_STATE, {
      accountFullName: session?.user.user_metadata?.full_name || 'public referral intake',
      accountOrganization: 'atlas public portal',
      partnerStationOrganizationName: input.partnerOrganizationName.trim() || null,
      actorRoleLabel: session ? 'authenticated website user' : 'public website visitor',
      sourceLabel: 'public website referral form'
    })
    enqueueRecord(nextRecord)
    return nextRecord
  }

  async function submitPartnerInquiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInquiryError(null)
    setInquirySuccess(null)
    const trimmedName = inquiryDraft.contactName.trim()
    const trimmedOrganization = inquiryDraft.organizationName.trim()
    const trimmedEmail = inquiryDraft.contactEmail.trim()
    const trimmedPhone = inquiryDraft.contactPhone.trim()
    const trimmedBackgroundNotes = inquiryDraft.backgroundNotes.trim()
    if (!trimmedName) {
      setInquiryError('Please include your name.')
      return
    }
    if (!trimmedOrganization) {
      setInquiryError('Please include your organization.')
      return
    }
    if (!trimmedEmail && !trimmedPhone) {
      setInquiryError('Please include at least one contact method.')
      return
    }
    if (!trimmedBackgroundNotes) {
      setInquiryError('Please include background notes.')
      return
    }
    setIsSubmittingInquiry(true)
    try {
      const { nextRecord } = buildPartnerInquiryQueueUpdate(
        {
          contactName: trimmedName,
          organizationName: trimmedOrganization,
          contactEmail: trimmedEmail,
          contactPhone: trimmedPhone,
          backgroundNotes: trimmedBackgroundNotes
        },
        EMPTY_PROGRAM_STATE,
        {
          accountFullName: session?.user.user_metadata?.full_name || 'public partner inquiry',
          accountOrganization: 'atlas public portal',
          partnerStationOrganizationName: trimmedOrganization,
          actorRoleLabel: session ? 'authenticated website user' : 'public website visitor',
          sourceLabel: 'public website partner inquiry'
        }
      )
      enqueueRecord(nextRecord)
      setInquirySuccess('Partner inquiry submitted. Atlas management has been queued for follow-up.')
      setInquiryDraft({
        contactName: '',
        organizationName: trimmedOrganization,
        contactEmail: '',
        contactPhone: '',
        backgroundNotes: ''
      })
    } catch (error) {
      setInquiryError(error instanceof Error ? error.message : 'Unable to submit inquiry right now.')
    } finally {
      setIsSubmittingInquiry(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white" style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text }}>
      <header className="border-b border-white/20">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-3">
          <div>
            <div className="text-[13px] uppercase tracking-[0.16em] text-[#bdbdbd]">atlas x lucid living</div>
            <div className="text-[20px] font-semibold">Community Navigation Platform</div>
          </div>
          <div className="flex items-center gap-2">
            <AtlasTextButton
              className="px-3 py-1.5 text-[12px]"
              onClick={() => {
                window.location.assign('/app')
              }}
              style={{ ['--button-border-color' as const]: 'var(--atlas-signal-lucid-green)', color: '#111111' } as React.CSSProperties}
            >
              {session ? 'open workspace' : 'log in'}
            </AtlasTextButton>
            {session ? (
              <AtlasTextButton
                className="px-3 py-1.5 text-[12px]"
                onClick={() => void signOut()}
                style={{ ['--button-border-color' as const]: '#ffffff45', color: '#ffffffd0' } as React.CSSProperties}
              >
                sign out
              </AtlasTextButton>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] space-y-6 px-5 py-6">
        <section className="rounded-[24px] border border-white/20 bg-[#0d0d0d] px-6 py-5">
          <div className="text-[30px] font-semibold">Referral and Partner Intake</div>
          <p className="mt-2 max-w-[880px] text-[14px] text-[#c9c9c9]">
            Submit referrals and partner inquiries directly from the public website. Every submission enters the same in-system intake queue used by Atlas navigators and supervisors for management follow-up.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <PartnerReferralWorkflowPanel
            defaultReferrerName={session?.user.user_metadata?.full_name || ''}
            defaultPartnerOrganizationName=""
            recentReferrals={recentPublicReferrals}
            onSubmit={submitPublicReferral}
            accentColor="var(--atlas-signal-lucid-green)"
          />

          <div className="rounded-[24px] border border-white/20 bg-[#0d0d0d] px-5 py-5">
            <small className="block text-[12px] uppercase tracking-[0.14em] text-[#bdbdbd]">partner inquiry</small>
            <div className="mt-1 text-[24px] font-medium">Request Atlas outreach</div>
            <p className="mt-1 text-[13px] text-[#c9c9c9]">
              New and prospective partners can submit a basic inquiry for navigator or supervisor follow-up.
            </p>
            <form className="mt-4 space-y-3" onSubmit={submitPartnerInquiry}>
              <Field label="contact name">
                <input
                  value={inquiryDraft.contactName}
                  onChange={(event) => setInquiryDraft((current) => ({ ...current, contactName: event.target.value }))}
                  className="atlas-admin-input"
                  placeholder="full name"
                />
              </Field>
              <Field label="organization name">
                <input
                  value={inquiryDraft.organizationName}
                  onChange={(event) => setInquiryDraft((current) => ({ ...current, organizationName: event.target.value }))}
                  className="atlas-admin-input"
                  placeholder="organization"
                />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="email">
                  <input
                    value={inquiryDraft.contactEmail}
                    onChange={(event) => setInquiryDraft((current) => ({ ...current, contactEmail: event.target.value }))}
                    className="atlas-admin-input"
                    placeholder="name@example.com"
                  />
                </Field>
                <Field label="phone">
                  <input
                    value={inquiryDraft.contactPhone}
                    onChange={(event) => setInquiryDraft((current) => ({ ...current, contactPhone: event.target.value }))}
                    className="atlas-admin-input"
                    placeholder="(555) 555-5555"
                  />
                </Field>
              </div>
              <Field label="background notes">
                <textarea
                  value={inquiryDraft.backgroundNotes}
                  onChange={(event) => setInquiryDraft((current) => ({ ...current, backgroundNotes: event.target.value }))}
                  className="atlas-admin-input min-h-[120px] py-2"
                  placeholder="Add the substantive context, needs, current barriers, and the reason Atlas should follow up."
                />
              </Field>
              {inquiryError ? <p className="text-[13px]" style={{ color: SP_COLORS.red }}>{inquiryError}</p> : null}
              {inquirySuccess ? <p className="text-[13px]" style={{ color: SP_COLORS.deepGreen }}>{inquirySuccess}</p> : null}
              <div className="flex justify-end">
                <AtlasTextButton
                  type="submit"
                  className="px-4 py-2 text-[13px]"
                  disabled={isSubmittingInquiry}
                  style={{ ['--button-border-color' as const]: 'var(--atlas-signal-lucid-green)', color: '#111111' } as React.CSSProperties}
                >
                  {isSubmittingInquiry ? 'submitting...' : 'submit partner inquiry'}
                </AtlasTextButton>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
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

