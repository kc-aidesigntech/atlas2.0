/**
 * Web root shell that decides whether to render auth, standalone survey, or
 * the authenticated single-pane application based on route + session state.
 */
import React from 'react'
import AtlasAuthScreen from '@/auth/AtlasAuthScreen'
import { SupabaseAuthProvider, useSupabaseAuth } from '@/auth/SupabaseAuthProvider'
import PublicAtlasLandingPage from '@/features/atlas2026/public/PublicAtlasLandingPage'
import PublicAtlasDemoPage from '@/features/atlas2026/public/PublicAtlasDemoPage'
import StandaloneZCodeSurveysPage from '@/features/atlas2026/singlepane/StandaloneZCodeSurveysPage'
import { workspaceLoadMetrics } from '@/features/atlas2026/singlepane/workspaceLoadMetrics'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'

const SinglePaneApp = React.lazy(() => import('@/features/atlas2026/singlepane/SinglePaneApp'))

function normalizePathname(pathname) {
  if (!pathname) return '/'
  // Treat trailing slash variants as the same logical route so auth gating
  // cannot diverge between `/foo` and `/foo/`.
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

function isStandaloneZCodeSurveysPath(pathname) {
  const normalizedPath = normalizePathname(pathname)
  return normalizedPath === '/z-code-surveys' || normalizedPath.endsWith('/z-code-surveys')
}

function isLegacyServiceCapacityPath(pathname) {
  const normalizedPath = normalizePathname(pathname)
  return normalizedPath === '/service-capacity-survey' || normalizedPath.endsWith('/service-capacity-survey')
}

function isLegacyDomainSpectrumPath(pathname) {
  const normalizedPath = normalizePathname(pathname)
  return (
    normalizedPath === '/zcode-domain' ||
    normalizedPath.endsWith('/zcode-domain') ||
    normalizedPath === '/z-code-domain-survey' ||
    normalizedPath.endsWith('/z-code-domain-survey')
  )
}

function isWorkspacePath(pathname) {
  const normalizedPath = normalizePathname(pathname)
  return normalizedPath === '/app' || normalizedPath.startsWith('/app/')
}

function isDemoPath(pathname) {
  const normalizedPath = normalizePathname(pathname)
  return normalizedPath === '/demo' || normalizedPath.startsWith('/demo/')
}

function RootAppInner() {
  const { session, isLoading } = useSupabaseAuth()
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  const isLegacyServiceRoute = typeof window !== 'undefined' && isLegacyServiceCapacityPath(pathname)
  const isLegacyDomainRoute = typeof window !== 'undefined' && isLegacyDomainSpectrumPath(pathname)
  const isWorkspaceRoute = isWorkspacePath(pathname)
  const isStandaloneZCodeSurveysRoute = typeof window !== 'undefined' && isStandaloneZCodeSurveysPath(pathname)
  const needsSupabaseSession =
    typeof window !== 'undefined' &&
    hasSupabaseConfig &&
    Boolean(supabase) &&
    isSinglePaneSupabaseBootstrapEnabled &&
    (isWorkspaceRoute || isStandaloneZCodeSurveysRoute)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    // Route-open is the canonical start marker for workspace-load baselines.
    workspaceLoadMetrics.markRouteOpen(pathname)
  }, [pathname])

  if (typeof window !== 'undefined' && (isLegacyServiceRoute || isLegacyDomainRoute)) {
    // Legacy survey URLs now converge on one page with explicit hash tabs so
    // shared links always land in the intended survey mode.
    const nextHash = isLegacyDomainRoute ? 'domain-spectrum' : 'service-capacity'
    const nextUrl = new URL('/z-code-surveys', window.location.origin)
    nextUrl.hash = nextHash
    window.location.replace(nextUrl.toString())
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-[14px] text-[#c7c7c7]">
        Redirecting to z-code surveys…
      </div>
    )
  }

  if (isStandaloneZCodeSurveysRoute && needsSupabaseSession && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-[14px] text-[#c7c7c7]">
        Checking sign-in…
      </div>
    )
  }
  if (isStandaloneZCodeSurveysRoute && needsSupabaseSession && !session) {
    return <AtlasAuthScreen />
  }
  if (typeof window !== 'undefined' && isStandaloneZCodeSurveysPath(pathname)) {
    return <StandaloneZCodeSurveysPage />
  }

  if (typeof window !== 'undefined' && isDemoPath(pathname)) {
    return <PublicAtlasDemoPage />
  }

  if (!isWorkspaceRoute) {
    return <PublicAtlasLandingPage />
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

  // At this point either auth is not required or we have a valid session.
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-[14px] text-[#c7c7c7]">
          Loading workspace shell…
        </div>
      }
    >
      <SinglePaneApp />
    </React.Suspense>
  )
}

export default function RootApp() {
  return (
    <SupabaseAuthProvider>
      <RootAppInner />
    </SupabaseAuthProvider>
  )
}

