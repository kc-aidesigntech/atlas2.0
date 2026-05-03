import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, SupabaseClient, UserIdentity } from '@supabase/supabase-js'
import type { AtlasDatabase } from '@atlas/shared'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

export type OAuthProviderId = 'google' | 'apple'

type SupabaseAuthContextValue = {
  supabaseClient: SupabaseClient<AtlasDatabase> | null
  session: Session | null
  isLoading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signInWithOAuth: (provider: OAuthProviderId) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshIdentities: () => Promise<UserIdentity[]>
  linkOAuthProvider: (provider: OAuthProviderId) => Promise<{ error: Error | null }>
}

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(null)

function authRedirectBaseUrl() {
  if (typeof window === 'undefined') return undefined
  const base = import.meta.env.BASE_URL || '/'
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base
  const path = normalized === '' ? '' : normalized
  return `${window.location.origin}${path}/`
}

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(supabase && hasSupabaseConfig))

  useEffect(() => {
    if (!supabase || !hasSupabaseConfig) {
      setSession(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setIsLoading(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!cancelled) {
        setSession(nextSession)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured') }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) return { error: new Error('Supabase is not configured') }
    const trimmed = fullName.trim()
    const parts = trimmed.split(/\s+/).filter(Boolean)
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : (parts[0] || 'Atlas')
    const lastName = parts.length > 1 ? (parts[parts.length - 1] || 'User') : 'User'
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: authRedirectBaseUrl(),
        data: {
          full_name: trimmed || `${firstName} ${lastName}`,
          first_name: firstName,
          last_name: lastName
        }
      }
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signInWithOAuth = useCallback(async (provider: OAuthProviderId) => {
    if (!supabase) return { error: new Error('Supabase is not configured') }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirectBaseUrl(),
        skipBrowserRedirect: false
      }
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const refreshIdentities = useCallback(async () => {
    if (!supabase) return []
    const { data, error } = await supabase.auth.getUserIdentities()
    if (error) return []
    return data?.identities ?? []
  }, [])

  const linkOAuthProvider = useCallback(async (provider: OAuthProviderId) => {
    if (!supabase) return { error: new Error('Supabase is not configured') }
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: authRedirectBaseUrl(),
        skipBrowserRedirect: false
      }
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const value = useMemo(
    () => ({
      supabaseClient: supabase && hasSupabaseConfig ? supabase : null,
      session,
      isLoading,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      signOut,
      refreshIdentities,
      linkOAuthProvider
    }),
    [
      session,
      isLoading,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      signOut,
      refreshIdentities,
      linkOAuthProvider
    ]
  )

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext)
  if (!ctx) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider')
  }
  return ctx
}
