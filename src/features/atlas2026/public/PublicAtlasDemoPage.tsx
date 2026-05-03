import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSupabaseAuth } from '@/auth/SupabaseAuthProvider'

const DEMO_PASSCODE_SESSION_KEY = 'atlas2026.public.demo-passcode-verified.v1'

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

export default function PublicAtlasDemoPage() {
  const { session } = useSupabaseAuth()
  const [passcodeInput, setPasscodeInput] = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isUnlocked, setIsUnlocked] = React.useState(() => readDemoAccessState())

  const expectedPasscode = (import.meta.env.VITE_ATLAS_DEMO_PASSCODE || '').trim()
  const roleClaim = String(session?.user?.app_metadata?.atlas_role || '').toLowerCase()
  const isAdministrator = roleClaim === 'administrator'
  const hasConfiguredPasscode = expectedPasscode.length > 0

  React.useEffect(() => {
    if (isAdministrator && !isUnlocked) {
      // Administrators can always access demo preview without sharing passcodes.
      setIsUnlocked(true)
      persistDemoAccessState(true)
    }
  }, [isAdministrator, isUnlocked])

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
                className="px-3 py-1.5 text-[12px]"
                onClick={() => window.location.assign('/')}
                style={{ ['--button-border-color' as const]: '#ffffff45', color: '#ffffffd0' } as React.CSSProperties}
              >
                back
              </AtlasTextButton>
              <AtlasTextButton
                type="submit"
                className="px-3 py-1.5 text-[12px]"
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

        <section className="grid gap-5 lg:grid-cols-3">
          <article className="rounded-[24px] border border-white/20 bg-[#0d0d0d] px-5 py-5">
            <div className="text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">1. referral intake</div>
            <h2 className="mt-2 text-[21px] font-medium">How partners refer</h2>
            <p className="mt-2 text-[13px] text-[#c9c9c9]">
              Partner submits a referral through the public portal. Intake is timestamped and routed into navigator workflow without exposing protected production records in this demo.
            </p>
          </article>

          <article className="rounded-[24px] border border-white/20 bg-[#0d0d0d] px-5 py-5">
            <div className="text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">2. enrollee profile</div>
            <h2 className="mt-2 text-[21px] font-medium">What happens to the person</h2>
            <p className="mt-2 text-[13px] text-[#c9c9c9]">
              Sample enrollee profile shows active support domains, staged interventions, and competency-linked navigator stewardship across regulation, readiness, and renewal.
            </p>
            <div className="mt-3 rounded-2xl border border-white/15 px-3 py-2 text-[12px] text-[#d7d7d7]">
              sample case: <strong>morgan r.</strong> • phase: <strong>readiness</strong> • assigned navigator: <strong>taylor h.</strong>
            </div>
          </article>

          <article className="rounded-[24px] border border-white/20 bg-[#0d0d0d] px-5 py-5">
            <div className="text-[12px] uppercase tracking-[0.12em] text-[#bdbdbd]">3. station outcomes</div>
            <h2 className="mt-2 text-[21px] font-medium">What comes back to partner stations</h2>
            <p className="mt-2 text-[13px] text-[#c9c9c9]">
              Sample station summary shows referral progress updates, reduced unresolved burden categories, and predictable engagement loops for frontline teams.
            </p>
            <div className="mt-3 rounded-2xl border border-white/15 px-3 py-2 text-[12px] text-[#d7d7d7]">
              sample station: <strong>east county resource hub</strong> • active referrals: <strong>7</strong> • resolved this cycle: <strong>4</strong>
            </div>
          </article>
        </section>

        <section className="flex justify-end">
          <AtlasTextButton
            type="button"
            className="px-3 py-1.5 text-[12px]"
            onClick={() => window.location.assign('/')}
            style={{ ['--button-border-color' as const]: '#ffffff45', color: '#ffffffd0' } as React.CSSProperties}
          >
            return to public landing
          </AtlasTextButton>
        </section>
      </div>
    </div>
  )
}
