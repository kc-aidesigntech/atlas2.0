/**
 * Standalone partner survey route that renders service-capacity intake outside
 * the authenticated navigator shell.
 */
import React from 'react'
import ServiceCapacitySurveyPanel from '@/features/atlas2026/singlepane/components/ServiceCapacitySurveyPanel'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

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
          onSearchPartnerIdentifiers={searchPartnerIdentifierMatches}
          onEnsurePartnerIdentifier={ensurePartnerIdentifier}
          onSubmit={savePartnerServiceCapacitySurvey}
          onDeleteDraft={deletePartnerServiceCapacityDraft}
        />
      </main>
    </div>
  )
}
