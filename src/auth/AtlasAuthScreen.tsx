import React, { useState } from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSupabaseAuth } from '@/auth/SupabaseAuthProvider'

const MIN_PASSWORD_LEN = 12

type Mode = 'sign_in' | 'sign_up'

export default function AtlasAuthScreen() {
  const { isLoading, signInWithPassword, signUpWithPassword, searchPartnerOrganizations, signInWithOAuth } = useSupabaseAuth()
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
  const [partnerOptions, setPartnerOptions] = useState<Array<{ id: string; organizationName: string }>>([])
  const [isPartnerLookupLoading, setIsPartnerLookupLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleOrganizationLookup(nextValue: string) {
    setOrganizationName(nextValue)
    setSelectedPartnerId(null)
    const trimmed = nextValue.trim()
    if (mode !== 'sign_up' || trimmed.length < 2) {
      setPartnerOptions([])
      setIsPartnerLookupLoading(false)
      return
    }
    setIsPartnerLookupLoading(true)
    const options = await searchPartnerOrganizations(trimmed)
    setPartnerOptions(options)
    setIsPartnerLookupLoading(false)
  }

  async function onEmailAuthSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setMessage('Enter email and password.')
      return
    }
    if (mode === 'sign_up') {
      if (password.length < MIN_PASSWORD_LEN) {
        setMessage(`Use at least ${MIN_PASSWORD_LEN} characters for the password.`)
        return
      }
      if (!fullName.trim()) {
        setMessage('Enter your full name.')
        return
      }
      if (!phoneNumber.trim()) {
        setMessage('Enter your phone number.')
        return
      }
      if (!organizationName.trim()) {
        setMessage('Enter your organization.')
        return
      }
    }

    setBusy(true)
    try {
      if (mode === 'sign_in') {
        const { error } = await signInWithPassword(trimmedEmail, password)
        if (error) setMessage(error.message)
      } else {
        // Sign-up switches back to sign-in so confirmation-email flows do not leave users on a dead-end form.
        const { error } = await signUpWithPassword({
          email: trimmedEmail,
          password,
          fullName,
          phoneNumber,
          organizationName,
          partnerId: selectedPartnerId
        })
        if (error) {
          setMessage(error.message)
        } else {
          setMessage('Check your email to confirm the account. New signups default to partner access.')
          setMode('sign_in')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  async function onOAuth(provider: 'google' | 'apple') {
    setMessage(null)
    setBusy(true)
    try {
      // Supabase links verified provider identities by email, preserving a single authorization profile.
      const { error } = await signInWithOAuth(provider)
      if (error) setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-[14px] text-[#c7c7c7]">
        Loading session…
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 py-10 text-white">
      <div className="w-full max-w-[420px] space-y-6 rounded-[28px] border p-8" style={{ borderColor: '#ffffff30' }}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9f9f9f]">Atlas access</p>
          <h1 className="mt-1 text-[26px] font-medium">Sign in</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#bcbcbc]">
            Use your work email. If you started with a password and later use Google or Apple with the same verified
            email, Supabase keeps one user so permissions stay aligned.
          </p>
        </div>

        <div className="flex gap-2 rounded-2xl border p-1" style={{ borderColor: '#ffffff20' }}>
          <button
            type="button"
            onClick={() => {
              setMode('sign_in')
              setMessage(null)
            }}
            className="flex-1 rounded-xl py-2 text-[13px] font-medium"
            style={{
              backgroundColor: mode === 'sign_in' ? '#ffffff18' : 'transparent',
              color: mode === 'sign_in' ? '#fff' : '#9f9f9f'
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('sign_up')
              setMessage(null)
            }}
            className="flex-1 rounded-xl py-2 text-[13px] font-medium"
            style={{
              backgroundColor: mode === 'sign_up' ? '#ffffff18' : 'transparent',
              color: mode === 'sign_up' ? '#fff' : '#9f9f9f'
            }}
          >
            Create account
          </button>
        </div>

        <form className="space-y-3" onSubmit={onEmailAuthSubmit}>
          {mode === 'sign_up' ? (
            <div className="space-y-3">
              <label className="block text-[12px] text-[#bcbcbc]">
                Full name
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
                  style={{ borderColor: '#ffffff30' }}
                />
              </label>
              <label className="block text-[12px] text-[#bcbcbc]">
                Phone number
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  autoComplete="tel"
                  className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
                  style={{ borderColor: '#ffffff30' }}
                />
              </label>
              <label className="block text-[12px] text-[#bcbcbc]">
                Organization
                <input
                  value={organizationName}
                  onChange={(e) => void handleOrganizationLookup(e.target.value)}
                  autoComplete="organization"
                  className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
                  style={{ borderColor: '#ffffff30' }}
                />
                {isPartnerLookupLoading ? (
                  <small className="mt-1 block text-[11px] text-[#8a8a8a]">Searching partner organizations...</small>
                ) : null}
                {!isPartnerLookupLoading && partnerOptions.length ? (
                  <div className="mt-2 max-h-[180px] space-y-1 overflow-y-auto rounded-xl border border-white/20 bg-[#0a0a0a] p-1">
                    {partnerOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setOrganizationName(option.organizationName)
                          setSelectedPartnerId(option.id)
                          setPartnerOptions([])
                        }}
                        className="w-full rounded-lg border border-transparent px-3 py-2 text-left text-[12px] text-white transition-colors hover:border-white/25 hover:bg-white/10"
                      >
                        {option.organizationName}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>
            </div>
          ) : null}
          <label className="block text-[12px] text-[#bcbcbc]">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
              style={{ borderColor: '#ffffff30' }}
            />
          </label>
          <label className="block text-[12px] text-[#bcbcbc]">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
              className="mt-2 w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white"
              style={{ borderColor: '#ffffff30' }}
            />
          </label>
          {mode === 'sign_up' ? (
            <p className="text-[11px] text-[#8a8a8a]">
              Minimum {MIN_PASSWORD_LEN} characters. New accounts are created as partner profiles; administrators can
              grant additional roles later.
            </p>
          ) : null}
          <AtlasTextButton
            type="submit"
            disabled={busy}
            className="mt-2 w-full px-4 py-2 text-[14px] font-medium text-white"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          >
            {mode === 'sign_in' ? 'Sign in with email' : 'Create account'}
          </AtlasTextButton>
        </form>

        <div className="relative py-2 text-center text-[11px] uppercase tracking-[0.16em] text-[#7a7a7a]">
          <span className="relative z-10 bg-black px-2">or continue with</span>
          <div className="absolute left-0 right-0 top-1/2 z-0 h-px bg-[#ffffff18]" />
        </div>

        <div className="flex flex-col gap-2">
          <AtlasTextButton
            type="button"
            disabled={busy}
            onClick={() => void onOAuth('google')}
            className="w-full px-4 py-2 text-[13px] font-medium text-white"
            style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
          >
            Google
          </AtlasTextButton>
          <AtlasTextButton
            type="button"
            disabled={busy}
            onClick={() => void onOAuth('apple')}
            className="w-full px-4 py-2 text-[13px] font-medium text-white"
            style={{ ['--button-border-color' as const]: '#ffffff30' } as React.CSSProperties}
          >
            Apple
          </AtlasTextButton>
        </div>

        {message ? <p className="text-center text-[13px] text-amber-200/90">{message}</p> : null}
      </div>
    </div>
  )
}
