import React from 'react'
import AtlasAuthScreen from '@/auth/AtlasAuthScreen'
import { SupabaseAuthProvider, useSupabaseAuth } from '@/auth/SupabaseAuthProvider'
import SinglePaneApp from '@/features/atlas2026/singlepane/SinglePaneApp'
import StandaloneServiceCapacitySurveyPage from '@/features/atlas2026/singlepane/StandaloneServiceCapacitySurveyPage'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'

function normalizePathname(pathname) {
  if (!pathname) return '/'
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function isStandaloneServiceCapacityPath(pathname) {
  const normalizedPath = normalizePathname(pathname)
  return (
    normalizedPath === '/service-capacity-survey' ||
    normalizedPath === '/partner/service-capacity-survey' ||
    normalizedPath.endsWith('/service-capacity-survey')
  )
}

function RootAppInner() {
  const { session, isLoading } = useSupabaseAuth()
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  const needsSupabaseSession =
    typeof window !== 'undefined' &&
    hasSupabaseConfig &&
    Boolean(supabase) &&
    isSinglePaneSupabaseBootstrapEnabled &&
    !isStandaloneServiceCapacityPath(pathname)

  if (typeof window !== 'undefined' && isStandaloneServiceCapacityPath(pathname)) {
    return <StandaloneServiceCapacitySurveyPage />
  }

  if (needsSupabaseSession && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-[14px] text-[#c7c7c7]">
        Checking sign-in…
      </div>
    )
  }

  if (needsSupabaseSession && !session) {
    return <AtlasAuthScreen />
  }

  return <SinglePaneApp />
}

export default function RootApp() {
  return (
    <SupabaseAuthProvider>
      <RootAppInner />
    </SupabaseAuthProvider>
  )
}

