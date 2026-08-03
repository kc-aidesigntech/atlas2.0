import React from 'react'
import { AtlasCloseButton, AtlasInsetCard, AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import ZCodeCircle from '@/features/atlas2026/components/ZCodeCircle'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { buildReferralQueueUpdate } from '@/features/atlas2026/singlepane/referralWorkflowUtils'
import { enqueuePublicReferralQueueRecord, loadPublicReferralQueueRecords } from '@/features/atlas2026/singlepane/data-access/publicReferralRepository'
import type {
  DomainLoad,
  EnrolleeProfile,
  NavigatorProgramState,
  PartnerReferralSubmissionInput,
  UnassignedEnrolleePickupRecord
} from '@/features/atlas2026/shared/contracts'
import { useSupabaseAuth } from '@/auth/SupabaseAuthProvider'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

// Demo modals pull recharts / profile / referral panels only when opened so the
// shared entry graph for `/app` stays free of those heavy imports.
const PartnerReferralWorkflowPanel = React.lazy(
  () => import('@/features/atlas2026/singlepane/components/PartnerReferralWorkflowPanel')
)
const ProfilePanel = React.lazy(() => import('@/features/atlas2026/singlepane/components/ProfilePanel'))
const RadialLoadChart = React.lazy(() => import('@/features/atlas2026/singlepane/components/RadialLoadChart'))

const DEMO_PASSCODE_SESSION_KEY = 'atlas2026.public.demo-passcode-verified.v1'
const DEMO_STEP_COLORS = [SP_COLORS.red, SP_COLORS.yellow, SP_COLORS.deepGreen] as const
const SINGLE_PANE_ROLE_SESSION_KEY = 'atlas2026.singlepane.session.role'
const SINGLE_PANE_ACTIVE_MENU_SESSION_KEY = 'atlas2026.singlepane.session.active-menu'
const SINGLE_PANE_REMOTE_SESSION_KEY = 'atlas2026.singlepane.session.remote-session'
const EMPTY_PROGRAM_STATE: NavigatorProgramState = {
  pickupQueue: [],
  selfAssessments: [],
  supervisionSessions: [],
  intervalAssessmentRules: [],
  updatedAtIso: new Date().toISOString()
}
type DemoWorkspace = 'referral' | 'profile' | 'station'

// Curated sample profile for demo step 2 so reviewers see the narrative enrollee
// without embedding `/app` (which requires an authenticated session and often
// fails open as a blank assignment board or sign-in screen inside the modal).
const DEMO_SAMPLE_ENROLLEE: EnrolleeProfile = {
  id: 'demo-enrollee-morgan-r',
  enrollmentId: 'demo-enrollment-morgan-r',
  fullName: 'morgan r.',
  dob: '04/22/1996',
  caseId: 'DEMO-MR-02',
  email: 'morgan.r@demo.atlas',
  assignedNavigator: 'taylor h.',
  zCodeTags: ['z59.0', 'z60.4', 'z56.0'],
  activeZCodeDetails: [
    {
      enrolleeZCodeId: 'demo-zc-habitat',
      parentCode: 'z59',
      zCode: 'z59.0',
      title: 'Homelessness',
      description: 'Housing instability requiring stabilization support.',
      isResolved: false,
      resolutionAt: null,
      codeReviewStatus: 'partially_resolved',
      confidenceLevel: 'medium'
    },
    {
      enrolleeZCodeId: 'demo-zc-social',
      parentCode: 'z60',
      zCode: 'z60.4',
      title: 'Social exclusion and rejection',
      description: 'Support network gaps that elevate frontline burden.',
      isResolved: false,
      resolutionAt: null,
      codeReviewStatus: 'not_resolved',
      confidenceLevel: 'high'
    },
    {
      enrolleeZCodeId: 'demo-zc-work',
      parentCode: 'z56',
      zCode: 'z56.0',
      title: 'Unemployment',
      description: 'Work disruption addressed during readiness unburdening.',
      isResolved: true,
      resolutionAt: '2026-05-12T16:00:00.000Z',
      codeReviewStatus: 'resolved',
      confidenceLevel: 'medium',
      resolutionPartnerName: 'east county resource hub',
      resolutionNote: 'Stabilized schedule and reconnected to supported employment.'
    }
  ],
  completedParentCodes: ['z56'],
  currentPhase: 'readiness'
}

const DEMO_SAMPLE_LOAD: DomainLoad = {
  enrolleeId: DEMO_SAMPLE_ENROLLEE.id,
  habitat: 7,
  work: 4,
  socialNetworks: 6
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readDemoAccessState() {
  if (!canUseLocalStorage()) return false
  return window.localStorage.getItem(DEMO_PASSCODE_SESSION_KEY) === 'true'
}

function persistDemoAccessState(isUnlocked: boolean) {
  if (!canUseLocalStorage()) return
  if (isUnlocked) {
    window.localStorage.setItem(DEMO_PASSCODE_SESSION_KEY, 'true')
    return
  }
  window.localStorage.removeItem(DEMO_PASSCODE_SESSION_KEY)
}

async function logDemoAccessEvent(accessMode: 'passcode' | 'administrator_bypass', email: string | null) {
  if (!hasSupabaseConfig || !supabase) return
  await (supabase as any)
    .schema('atlas')
    .from('demo_access_events')
    .insert({
      access_mode: accessMode,
      session_email: email,
      metadata: {
        page: '/demo',
        client_time: new Date().toISOString()
      }
    })
}

export default function PublicAtlasDemoPage() {
  const { session } = useSupabaseAuth()
  const [passcodeInput, setPasscodeInput] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isUnlocked, setIsUnlocked] = React.useState(() => readDemoAccessState())
  const [activeWorkspace, setActiveWorkspace] = React.useState<DemoWorkspace | null>(null)
  const [recentPublicReferrals, setRecentPublicReferrals] = React.useState<UnassignedEnrolleePickupRecord[]>([])

  const expectedPasscode = (import.meta.env.VITE_ATLAS_DEMO_PASSCODE || '').trim()
  const roleClaim = String(session?.user?.app_metadata?.atlas_role || '').toLowerCase()
  const isAdministrator = roleClaim === 'administrator'
  const hasConfiguredPasscode = expectedPasscode.length > 0

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

  React.useEffect(() => {
    if (isAdministrator && !isUnlocked) {
      setIsUnlocked(true)
      persistDemoAccessState(true)
      void logDemoAccessEvent('administrator_bypass', session?.user?.email || null)
    }
  }, [isAdministrator, isUnlocked, session?.user?.email])

  function unlockDemo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    if (!hasConfiguredPasscode) {
      setErrorMessage('Demo access is unavailable until a shared passcode is configured.')
      return
    }
    if (passcodeInput.trim() !== expectedPasscode) {
      setErrorMessage('Passcode does not match.')
      return
    }
    setIsUnlocked(true)
    persistDemoAccessState(true)
    void logDemoAccessEvent('passcode', session?.user?.email || null)
  }

  function setSinglePaneRole(role: 'navigator' | 'partner') {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(SINGLE_PANE_ROLE_SESSION_KEY, role)
  }

  function setSinglePaneWorkspace(role: 'navigator' | 'partner', activeMenu: string) {
    if (typeof window === 'undefined') return
    // Keep demo modal launch deterministic so step workspaces always mirror the real app role/menu.
    window.sessionStorage.setItem(SINGLE_PANE_ROLE_SESSION_KEY, role)
    window.sessionStorage.setItem(SINGLE_PANE_ACTIVE_MENU_SESSION_KEY, activeMenu)
    window.sessionStorage.removeItem(SINGLE_PANE_REMOTE_SESSION_KEY)
  }

  function openWorkspace(workspace: DemoWorkspace) {
    // Step 2 renders an in-page sample profile; only step 3 still primes `/app`
    // session keys before launching the live partner station iframe.
    if (workspace === 'station') {
      setSinglePaneWorkspace('partner', 'my station')
    } else if (workspace === 'referral') {
      setSinglePaneRole('navigator')
    }
    setActiveWorkspace(workspace)
  }

  async function enqueueRecord(record: UnassignedEnrolleePickupRecord) {
    await enqueuePublicReferralQueueRecord(record)
    setRecentPublicReferrals((current) => [record, ...current.filter((item) => item.id !== record.id)])
  }

  async function submitPublicReferral(input: PartnerReferralSubmissionInput) {
    const { nextRecord } = buildReferralQueueUpdate(input, EMPTY_PROGRAM_STATE, {
      accountFullName: session?.user.user_metadata?.full_name || 'public referral intake',
      accountOrganization: 'atlas public demo',
      partnerStationOrganizationName: input.partnerOrganizationName.trim() || null,
      actorRoleLabel: session ? 'authenticated website user' : 'public website visitor',
      sourceLabel: 'public demo referral form'
    })
    await enqueueRecord(nextRecord)
    return nextRecord
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-black px-5 py-10 text-white" style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text }}>
        <div className="mx-auto w-full max-w-[720px] rounded-[28px] border border-white/20 bg-[#0d0d0d] px-6 py-6">
          <div className="text-[12px] uppercase tracking-[0.14em] text-[#bdbdbd]">atlas demo</div>
          <h1 className="mt-2 text-[30px] font-semibold">Protected preview</h1>
          <p className="mt-2 text-[14px] text-[#c9c9c9]">
            This experience is restricted to approved reviewers and administrators during first-stage launch preparation.
          </p>
          <form className="mt-5 space-y-3" onSubmit={unlockDemo}>
            <label className="block text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">
              shared demo passcode
              <input
                type="password"
                value={passcodeInput}
                onChange={(event) => setPasscodeInput(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/30 bg-black px-3 py-2 text-[14px] text-white"
                autoComplete="off"
              />
            </label>
            {errorMessage ? <p className="text-[13px]" style={{ color: SP_COLORS.red }}>{errorMessage}</p> : null}
            <div className="flex justify-end gap-2">
              <AtlasTextButton
                type="button"
                className="px-[14px] py-[7px] text-[14px]"
                onClick={() => window.location.assign('/')}
                style={{ ['--button-border-color' as const]: '#ffffff45', color: '#ffffffd0' } as React.CSSProperties}
              >
                back
              </AtlasTextButton>
              <AtlasTextButton
                type="submit"
                className="px-[14px] py-[7px] text-[14px]"
                style={{ ['--button-border-color' as const]: 'var(--atlas-signal-lucid-green)', color: '#111111' } as React.CSSProperties}
              >
                unlock demo
              </AtlasTextButton>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black px-5 py-6 text-white" style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text }}>
      <div className="mx-auto w-full max-w-[1040px] space-y-6">
        <section className="rounded-[24px] border border-white/20 bg-[#0d0d0d] px-6 py-5">
          <small className="block text-[12px] uppercase tracking-[0.14em] text-[#bdbdbd]">atlas demo</small>
          <h1 className="mt-1 text-[30px] font-semibold">Partner preview narrative</h1>
          <p className="mt-2 text-[14px] text-[#c9c9c9]">
            This demo shows the three launch promises for partners: how referrals are submitted, what a supported enrollee profile looks like, and what a partner station receives back as frontline burden decreases.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-3 lg:gap-x-12">
          <article
            className="relative rounded-[24px] border bg-[#0d0d0d] px-5 py-5"
            style={{ borderColor: DEMO_STEP_COLORS[0] }}
          >
            <div className="flex items-center gap-3">
              <ZCodeCircle value="1" fill={DEMO_STEP_COLORS[0]} />
              <div className="text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">referral intake</div>
            </div>
            <h2 className="mt-2 text-[21px] font-medium">How partners refer</h2>
            <p className="mt-2 text-[13px] text-[#c9c9c9]">
              Partner submits a referral through the public portal. Intake is timestamped and routed into navigator workflow without exposing protected production records in this demo.
            </p>
            <div className="mt-4 flex justify-end">
              <AtlasTextButton
                type="button"
                className="px-[14px] py-[7px] text-[13px]"
                onClick={() => openWorkspace('referral')}
                style={{ ['--button-border-color' as const]: DEMO_STEP_COLORS[0], color: SP_COLORS.white } as React.CSSProperties}
              >
                see more
              </AtlasTextButton>
            </div>
            <AtlasArrowIcon
              decorative
              direction="right"
              invert
              className="pointer-events-none absolute -right-[2.375rem] top-1/2 hidden h-7 w-7 -translate-y-1/2 opacity-95 lg:block"
            />
          </article>

          <article
            className="relative rounded-[24px] border bg-[#0d0d0d] px-5 py-5"
            style={{ borderColor: DEMO_STEP_COLORS[1] }}
          >
            <div className="flex items-center gap-3">
              <ZCodeCircle value="2" fill={DEMO_STEP_COLORS[1]} />
              <div className="text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">enrollee profile</div>
            </div>
            <h2 className="mt-2 text-[21px] font-medium">What happens to the person</h2>
            <p className="mt-2 text-[13px] text-[#c9c9c9]">
              Sample enrollee profile shows active support domains, staged interventions, and competency-linked navigator stewardship across regulation, readiness, and renewal.
            </p>
            <div
              className="mt-3 rounded-2xl border px-3 py-2 text-[12px] text-[#d7d7d7]"
              style={{ borderColor: DEMO_STEP_COLORS[1] }}
            >
              sample case: <strong>morgan r.</strong> • phase: <strong>readiness</strong> • assigned navigator: <strong>taylor h.</strong>
            </div>
            <div className="mt-4 flex justify-end">
              <AtlasTextButton
                type="button"
                className="px-[14px] py-[7px] text-[13px]"
                onClick={() => openWorkspace('profile')}
                style={{ ['--button-border-color' as const]: DEMO_STEP_COLORS[1], color: SP_COLORS.bg } as React.CSSProperties}
              >
                see more
              </AtlasTextButton>
            </div>
            <AtlasArrowIcon
              decorative
              direction="right"
              invert
              className="pointer-events-none absolute -right-[2.375rem] top-1/2 hidden h-7 w-7 -translate-y-1/2 opacity-95 lg:block"
            />
          </article>

          <article
            className="rounded-[24px] border bg-[#0d0d0d] px-5 py-5"
            style={{ borderColor: DEMO_STEP_COLORS[2] }}
          >
            <div className="flex items-center gap-3">
              <ZCodeCircle value="3" fill={DEMO_STEP_COLORS[2]} />
              <div className="text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">station outcomes</div>
            </div>
            <h2 className="mt-2 text-[21px] font-medium">What comes back to partner stations</h2>
            <p className="mt-2 text-[13px] text-[#c9c9c9]">
              Sample station summary shows referral progress updates, reduced unresolved burden categories, and predictable engagement loops for frontline teams.
            </p>
            <div
              className="mt-3 rounded-2xl border px-3 py-2 text-[12px] text-[#d7d7d7]"
              style={{ borderColor: DEMO_STEP_COLORS[2] }}
            >
              sample station: <strong>east county resource hub</strong> • active referrals: <strong>7</strong> • resolved this cycle: <strong>4</strong>
            </div>
            <div className="mt-4 flex justify-end">
              <AtlasTextButton
                type="button"
                className="px-[14px] py-[7px] text-[13px]"
                onClick={() => openWorkspace('station')}
                style={{ ['--button-border-color' as const]: DEMO_STEP_COLORS[2], color: SP_COLORS.white } as React.CSSProperties}
              >
                see more
              </AtlasTextButton>
            </div>
          </article>
        </section>

        <section className="flex justify-end">
          <AtlasTextButton
            type="button"
            className="px-[14px] py-[7px] text-[14px]"
            onClick={() => window.location.assign('/')}
            style={{ ['--button-border-color' as const]: '#ffffff45', color: '#ffffffd0' } as React.CSSProperties}
          >
            return to public landing
          </AtlasTextButton>
        </section>
      </div>

      {activeWorkspace === 'referral' ? (
        <LiveWorkspaceModal
          title="step 1 · live referral workspace"
          onClose={() => setActiveWorkspace(null)}
          scrollContent
        >
          <React.Suspense
            fallback={<div className="px-4 py-8 text-[14px] text-[#c9c9c9]">Loading referral workspace…</div>}
          >
            <PartnerReferralWorkflowPanel
              defaultReferrerName={session?.user.user_metadata?.full_name || ''}
              defaultPartnerOrganizationName=""
              recentReferrals={recentPublicReferrals}
              onSubmit={submitPublicReferral}
              accentColor="var(--atlas-signal-lucid-green)"
            />
          </React.Suspense>
        </LiveWorkspaceModal>
      ) : null}

      {activeWorkspace === 'profile' ? (
        <LiveWorkspaceModal
          title="step 2 · sample enrollee profile"
          onClose={() => setActiveWorkspace(null)}
          scrollContent
        >
          <DemoEnrolleeProfileWorkspace />
        </LiveWorkspaceModal>
      ) : null}

      {activeWorkspace === 'station' ? (
        <LiveWorkspaceModal
          title="step 3 · live partner station workspace"
          onClose={() => setActiveWorkspace(null)}
        >
          <iframe
            title="atlas partner workspace"
            src="/app#my-station"
            className="h-full w-full rounded-[20px] border border-white/10"
          />
        </LiveWorkspaceModal>
      ) : null}
    </div>
  )
}

function DemoEnrolleeProfileWorkspace() {
  return (
    <AtlasInsetCard className="atlas-surface-panel space-y-4 border-white/20 bg-[#0c0c0c] px-5 py-5">
      <div
        className="rounded-2xl border px-3 py-2 text-[12px] text-[#d7d7d7]"
        style={{ borderColor: DEMO_STEP_COLORS[1] }}
      >
        sample case: <strong>{DEMO_SAMPLE_ENROLLEE.fullName}</strong> • phase:{' '}
        <strong>{DEMO_SAMPLE_ENROLLEE.currentPhase}</strong> • assigned navigator:{' '}
        <strong>{DEMO_SAMPLE_ENROLLEE.assignedNavigator}</strong>
      </div>
      <div
        className="flex min-h-[282px] flex-wrap items-start gap-x-4 gap-y-5 border-b pb-[12px] lg:gap-x-8 xl:gap-x-12"
        style={{ borderColor: '#ffffff55', borderBottomWidth: '2px' }}
      >
        <div className="min-w-0 flex-1 basis-[520px]">
          {/* Reuse the canonical enrollee ProfilePanel so demo step 2 mirrors production
              header, Z-code badges, and navigator attribution without auth-gated `/app`. */}
          <React.Suspense fallback={<div className="text-[14px] text-[#c9c9c9]">Loading profile…</div>}>
            <ProfilePanel
              enrollee={DEMO_SAMPLE_ENROLLEE}
              enrollmentStartLabel="01/12/2026"
            />
          </React.Suspense>
        </div>
        <div className="flex w-full justify-center md:ml-auto md:w-auto md:flex-none md:justify-end md:pr-5 md:pl-2 lg:pr-8">
          <React.Suspense fallback={<div className="text-[14px] text-[#c9c9c9]">Loading chart…</div>}>
            <RadialLoadChart load={DEMO_SAMPLE_LOAD} />
          </React.Suspense>
        </div>
      </div>
      <small className="atlas-caption block text-[var(--foreground-secondary)]">
        This preview is a passcode-gated sample for partner narrative review. Live navigator data remains behind
        authenticated workspace sign-in.
      </small>
    </AtlasInsetCard>
  )
}

function LiveWorkspaceModal({
  title,
  onClose,
  children,
  scrollContent = false
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  scrollContent?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 px-4 py-5 backdrop-blur-sm">
      <div className="flex h-[94vh] w-full max-w-[1320px] flex-col rounded-[28px] border border-white/20 bg-[#0d0d0d] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <small className="text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">{title}</small>
          {/* Keep modal dismiss controls on the shared icon primitive so this demo workspace
              stays visually aligned with other square icon actions. */}
          <AtlasCloseButton
            type="button"
            onClick={onClose}
            style={{ ['--button-border-color' as const]: '#ffffff', color: '#111111' } as React.CSSProperties}
          />
        </div>
        <div className={`min-h-0 flex-1 ${scrollContent ? 'overflow-y-auto pr-1' : ''}`}>{children}</div>
      </div>
    </div>
  )
}
