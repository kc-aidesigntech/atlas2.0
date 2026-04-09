import React from 'react'
import ServiceCapacitySurveyPanel from '@/features/atlas2026/singlepane/components/ServiceCapacitySurveyPanel'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

export default function StandaloneServiceCapacitySurveyPage() {
  const {
    role,
    setRole,
    partnerServiceCapacitySurvey,
    partnerServiceCapacityDefaultHeader,
    isSavingPartnerServiceCapacitySurvey,
    partnerServiceCapacitySurveyError,
    savePartnerServiceCapacitySurvey
  } = useSinglePaneData()

  React.useEffect(() => {
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
      className="min-h-screen overflow-x-hidden bg-black px-4 py-6 text-white md:px-6 md:py-8"
      style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <main className="mx-auto w-full max-w-[1240px]">
        <ServiceCapacitySurveyPanel
          savedSubmission={partnerServiceCapacitySurvey}
          defaultHeader={partnerServiceCapacityDefaultHeader}
          isSaving={isSavingPartnerServiceCapacitySurvey}
          saveError={partnerServiceCapacitySurveyError}
          onSubmit={savePartnerServiceCapacitySurvey}
        />
      </main>
    </div>
  )
}
