import React from 'react'
import SinglePaneApp from '@/features/atlas2026/singlepane/SinglePaneApp'
import StandaloneServiceCapacitySurveyPage from '@/features/atlas2026/singlepane/StandaloneServiceCapacitySurveyPage'

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

export default function RootApp() {
  if (typeof window !== 'undefined' && isStandaloneServiceCapacityPath(window.location.pathname)) {
    return <StandaloneServiceCapacitySurveyPage />
  }
  return <SinglePaneApp />
}

