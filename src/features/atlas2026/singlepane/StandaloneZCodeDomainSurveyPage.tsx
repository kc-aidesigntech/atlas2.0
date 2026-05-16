/**
 * Standalone partner survey route for the 1-99 Z-code domain spectrum intake.
 */
import React from 'react'
import ServiceCapacitySurveyPanel from '@/features/atlas2026/singlepane/components/ServiceCapacitySurveyPanel'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

const SESSION_ROLE_KEY = 'atlas2026.singlepane.session.role'
const SESSION_ACTIVE_MENU_KEY = 'atlas2026.singlepane.session.active-menu'

export default function StandaloneZCodeDomainSurveyPage() {
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
    // This route hard-pins partner context so shared data hooks do not inherit
    // stale role state from previous single-pane sessions.
    if (role !== 'partner') {
      setRole('partner')
    }
  }, [role, setRole])

  React.useEffect(() => {
    const previousTitle = document.title
    document.title = 'ATLAS Z Code Domain Survey'
    return () => {
      document.title = previousTitle
    }
  }, [])

  function backToWorkspace() {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(SESSION_ROLE_KEY, 'partner')
    window.sessionStorage.setItem(SESSION_ACTIVE_MENU_KEY, 'my station')
    window.location.assign(new URL('/', window.location.origin).toString())
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
          surveyVariant="domainSpectrum"
        />
      </main>
    </div>
  )
}
