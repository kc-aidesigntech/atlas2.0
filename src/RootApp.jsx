/**
 * Web root shell that decides whether to render auth, standalone survey, or
 * the authenticated single-pane application based on route + session state.
 */
import React from 'react'
import { SupabaseAuthProvider, useSupabaseAuth } from '@/auth/SupabaseAuthProvider'
import { workspaceLoadMetrics } from '@/features/atlas2026/singlepane/workspaceLoadMetrics'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'

// Shared import factory so auth-wait prefetch and React.lazy hit the same module cache.
const loadSinglePaneApp = () => import('@/features/atlas2026/singlepane/SinglePaneApp')
const SinglePaneApp = React.lazy(loadSinglePaneApp)
const AtlasAuthScreen = React.lazy(() => import('@/auth/AtlasAuthScreen'))
const PublicAtlasLandingPage = React.lazy(() => import('@/features/atlas2026/public/PublicAtlasLandingPage'))
const PublicAtlasDemoPage = React.lazy(() => import('@/features/atlas2026/public/PublicAtlasDemoPage'))
const StandaloneZCodeSurveysPage = React.lazy(() => import('@/features/atlas2026/singlepane/StandaloneZCodeSurveysPage'))

function ShellFallback({ message }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-[14px] text-[#c7c7c7]">
      {message}
    </div>
  )
}

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

  // Start the workspace chunk download as soon as `/app` is known so it overlaps
  // with getSession instead of waiting behind the auth gate.
  React.useEffect(() => {
    if (!isWorkspaceRoute) return
    void loadSinglePaneApp().then(() => {
      workspaceLoadMetrics.markWorkspaceChunkReady()
    })
  }, [isWorkspaceRoute])

  React.useEffect(() => {
    if (!needsSupabaseSession || isLoading) return
    workspaceLoadMetrics.markAuthReady(Boolean(session))
  }, [needsSupabaseSession, isLoading, session])

  if (typeof window !== 'undefined' && (isLegacyServiceRoute || isLegacyDomainRoute)) {
    // Legacy survey URLs now converge on one page with explicit hash tabs so
    // shared links always land in the intended survey mode.
    const nextHash = isLegacyDomainRoute ? 'domain-spectrum' : 'service-capacity'
    const nextUrl = new URL('/z-code-surveys', window.location.origin)
    nextUrl.hash = nextHash
    window.location.replace(nextUrl.toString())
    return <ShellFallback message="Redirecting to z-code surveys…" />
  }

  if (isStandaloneZCodeSurveysRoute && needsSupabaseSession && isLoading) {
    return <ShellFallback message="Checking sign-in…" />
  }
  if (isStandaloneZCodeSurveysRoute && needsSupabaseSession && !session) {
    return (
      <React.Suspense fallback={<ShellFallback message="Loading sign-in…" />}>
        <AtlasAuthScreen />
      </React.Suspense>
    )
  }
  if (typeof window !== 'undefined' && isStandaloneZCodeSurveysPath(pathname)) {
    return (
      <React.Suspense fallback={<ShellFallback message="Loading surveys…" />}>
        <StandaloneZCodeSurveysPage />
      </React.Suspense>
    )
  }

  if (typeof window !== 'undefined' && isDemoPath(pathname)) {
    return (
      <React.Suspense fallback={<ShellFallback message="Loading demo…" />}>
        <PublicAtlasDemoPage />
      </React.Suspense>
    )
  }

  if (!isWorkspaceRoute) {
    return (
      <React.Suspense fallback={<ShellFallback message="Loading…" />}>
        <PublicAtlasLandingPage />
      </React.Suspense>
    )
  }

  if (needsSupabaseSession && isLoading) {
    return <ShellFallback message="Checking sign-in…" />
  }

  if (needsSupabaseSession && !session) {
    return (
      <React.Suspense fallback={<ShellFallback message="Loading sign-in…" />}>
        <AtlasAuthScreen />
      </React.Suspense>
    )
  }

  // At this point either auth is not required or we have a valid session.
  // The workspace chunk may already be warm from the prefetch effect above.
  return (
    <React.Suspense fallback={<ShellFallback message="Loading workspace shell…" />}>
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
