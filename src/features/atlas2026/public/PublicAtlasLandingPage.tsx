import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import PartnerReferralWorkflowPanel from '@/features/atlas2026/singlepane/components/PartnerReferralWorkflowPanel'
import { enqueuePublicReferralQueueRecord, loadPublicReferralQueueRecords } from '@/features/atlas2026/singlepane/data-access/publicReferralRepository'
import { buildReferralQueueUpdate } from '@/features/atlas2026/singlepane/referralWorkflowUtils'
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

  React.useEffect(() => {
    let isMounted = true
    void loadPublicReferralQueueRecords().then((records) => {
      if (!isMounted) return
      setRecentPublicReferrals(records)
    })
    return () => {
      isMounted = false
    }
  }, [])

  async function enqueueRecord(record: UnassignedEnrolleePickupRecord) {
    await enqueuePublicReferralQueueRecord(record)
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
    await enqueueRecord(nextRecord)
    return nextRecord
  }

  return (
    <div className="min-h-screen bg-black text-white" style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text }}>
      <header className="border-b border-white/20">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-3">
          <div>
            <div className="atlas-overline text-[#bdbdbd]">atlas x lucid living</div>
            <div className="atlas-h4 text-[20px] font-semibold">Community Navigation Platform</div>
          </div>
          <div className="flex items-center gap-2">
            <AtlasTextButton
              className="px-[14px] py-[7px] text-[14px]"
              onClick={() => {
                window.location.assign('/demo')
              }}
              style={{ ['--button-border-color' as const]: '#ffffff45', color: '#ffffffd0' } as React.CSSProperties}
            >
              demo
            </AtlasTextButton>
            <AtlasTextButton
              className="px-[14px] py-[7px] text-[14px]"
              onClick={() => {
                window.location.assign('/app')
              }}
              style={{ ['--button-border-color' as const]: 'var(--atlas-signal-lucid-green)', color: '#111111' } as React.CSSProperties}
            >
              {session ? 'open workspace' : 'log in'}
            </AtlasTextButton>
            {session ? (
              <AtlasTextButton
                className="px-[14px] py-[7px] text-[14px]"
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
        <section className="atlas-surface-panel bg-[#0d0d0d] px-6 py-5">
          <div className="atlas-h3 text-[30px] font-semibold">Referral Portal</div>
          <p className="atlas-panel-copy mt-2 max-w-[880px] text-[14px] text-[#c9c9c9]">
            Submit referrals directly from the public website. Every submission enters the same in-system intake queue used by Atlas navigators and supervisors for follow-up.
          </p>
        </section>

        <section>
          <PartnerReferralWorkflowPanel
            defaultReferrerName={session?.user.user_metadata?.full_name || ''}
            defaultPartnerOrganizationName=""
            recentReferrals={recentPublicReferrals}
            onSubmit={submitPublicReferral}
            accentColor="var(--atlas-signal-lucid-green)"
          />
        </section>

        <section className="atlas-surface-panel bg-[#0d0d0d] px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="atlas-h4 text-[22px] font-semibold">Z Code Domain Survey</div>
              <p className="atlas-panel-copy mt-2 max-w-[860px] text-[14px] text-[#c9c9c9]">
                Sign in with your Atlas account to submit domain-spectrum scores for each Z-code. Responses are logged and reviewed in the administrator portal.
              </p>
            </div>
            <AtlasTextButton
              className="px-[16px] py-[8px] text-[14px]"
              onClick={() => {
                window.location.assign('/z-code-surveys')
              }}
              style={{ ['--button-border-color' as const]: 'var(--atlas-signal-lucid-green)', color: '#111111' } as React.CSSProperties}
            >
              open survey
            </AtlasTextButton>
          </div>
        </section>
      </main>
    </div>
  )
}

