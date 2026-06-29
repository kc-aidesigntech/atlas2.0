/**
 * Standalone partner survey route that renders service-capacity intake outside
 * the authenticated navigator shell.
 */
import React from 'react'
import ServiceCapacitySurveyPanel from '@/features/atlas2026/singlepane/components/ServiceCapacitySurveyPanel'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

const SESSION_ROLE_KEY = 'atlas2026.singlepane.session.role'
const SESSION_ACTIVE_MENU_KEY = 'atlas2026.singlepane.session.active-menu'
const SURVEY_RETURN_ROLE_KEY = 'atlas2026.surveys.return.role'
const SURVEY_RETURN_MENU_KEY = 'atlas2026.surveys.return.menu'

export default function StandaloneServiceCapacitySurveyPage() {
  const {
    role,
    setRole,
    partnerServiceCapacitySurveyHistory,
    partnerServiceCapacityDefaultHeader,
    isSavingPartnerServiceCapacitySurvey,
    partnerServiceCapacitySurveyError,
    searchPartnerIdentifierMatches,
    ensurePartnerIdentifier,
    savePartnerServiceCapacitySurvey,
    deletePartnerServiceCapacityDraft
  } = useSinglePaneData('partner')

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const currentRole = window.sessionStorage.getItem(SESSION_ROLE_KEY)
    const currentMenu = window.sessionStorage.getItem(SESSION_ACTIVE_MENU_KEY)
    // Capture pre-survey shell context once per entry so Back can restore role/menu continuity.
    if (currentRole) window.sessionStorage.setItem(SURVEY_RETURN_ROLE_KEY, currentRole)
    if (currentMenu) window.sessionStorage.setItem(SURVEY_RETURN_MENU_KEY, currentMenu)
  }, [])

  React.useEffect(() => {
    // This route hard-pins partner context so shared data hooks do not inherit
    // stale role state from previous single-pane sessions.
    if (role !== 'partner') {
      setRole('partner')
    }
  }, [role, setRole])

  React.useEffect(() => {
    const previousTitle = document.title
    document.title = 'ATLAS Service Capacity Survey'
    return () => {
      document.title = previousTitle
    }
  }, [])

  function backToWorkspace() {
    if (typeof window === 'undefined') return
    const returnRole = window.sessionStorage.getItem(SURVEY_RETURN_ROLE_KEY)
    const returnMenu = window.sessionStorage.getItem(SURVEY_RETURN_MENU_KEY)
    if (returnRole) window.sessionStorage.setItem(SESSION_ROLE_KEY, returnRole)
    if (returnMenu) window.sessionStorage.setItem(SESSION_ACTIVE_MENU_KEY, returnMenu)
    window.sessionStorage.removeItem(SURVEY_RETURN_ROLE_KEY)
    window.sessionStorage.removeItem(SURVEY_RETURN_MENU_KEY)
    let hasSameOriginReferrer = false
    try {
      hasSameOriginReferrer = Boolean(window.document.referrer) && new URL(window.document.referrer).origin === window.location.origin
    } catch {
      hasSameOriginReferrer = false
    }
    if (hasSameOriginReferrer || window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.assign(new URL('/app', window.location.origin).toString())
  }

  return (
    <div
      className="atlas-shell-edge-buffer min-h-screen overflow-x-hidden bg-black py-6 text-white md:py-8"
      style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <main className="mx-auto w-full max-w-[1240px]">
        <ServiceCapacitySurveyPanel
          submissionHistory={partnerServiceCapacitySurveyHistory}
          defaultHeader={partnerServiceCapacityDefaultHeader}
          isSaving={isSavingPartnerServiceCapacitySurvey}
          saveError={partnerServiceCapacitySurveyError}
          onBackToWorkspace={backToWorkspace}
          onSearchPartnerIdentifiers={searchPartnerIdentifierMatches}
          onEnsurePartnerIdentifier={ensurePartnerIdentifier}
          onSubmit={savePartnerServiceCapacitySurvey}
          onDeleteDraft={deletePartnerServiceCapacityDraft}
        />
      </main>
    </div>
  )
}
