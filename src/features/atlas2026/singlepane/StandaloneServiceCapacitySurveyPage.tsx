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
    savePartnerServiceCapacitySurvey,
    deletePartnerServiceCapacityDraft
  } = useSinglePaneData('partner')

  React.useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-2',hypothesisId:'H7',location:'StandaloneServiceCapacitySurveyPage.tsx:19',message:'standalone survey role guard',data:{role,historyCount:partnerServiceCapacitySurveyHistory.length,isSaving:isSavingPartnerServiceCapacitySurvey,saveError:partnerServiceCapacitySurveyError??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (role !== 'partner') {
      setRole('partner')
    }
  }, [isSavingPartnerServiceCapacitySurvey, partnerServiceCapacitySurveyError, partnerServiceCapacitySurveyHistory.length, role, setRole])

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
          submissionHistory={partnerServiceCapacitySurveyHistory}
          defaultHeader={partnerServiceCapacityDefaultHeader}
          isSaving={isSavingPartnerServiceCapacitySurvey}
          saveError={partnerServiceCapacitySurveyError}
          onSearchPartnerIdentifiers={searchPartnerIdentifierMatches}
          onSubmit={savePartnerServiceCapacitySurvey}
          onDeleteDraft={deletePartnerServiceCapacityDraft}
        />
      </main>
    </div>
  )
}
