import { useEffect, useState } from 'react'
import type { PartnerServiceCapacitySubmissionRecord } from '@/features/atlas2026/singlepane/types'
import { loadPartnerServiceCapacitySurveyHistory } from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'

export function usePartnerServiceCapacityHistory(role: string, organizationName: string | undefined) {
  const [partnerServiceCapacitySurveyHistory, setPartnerServiceCapacitySurveyHistory] = useState<PartnerServiceCapacitySubmissionRecord[]>([])
  const [partnerServiceCapacitySurveyError, setPartnerServiceCapacitySurveyError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const trimmedOrganizationName = organizationName?.trim() || ''

    // #region agent log
    fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-2',hypothesisId:'H6',location:'usePartnerServiceCapacityHistory.ts:12',message:'history hook triggered',data:{role,organizationName:trimmedOrganizationName,currentHistoryCount:partnerServiceCapacitySurveyHistory.length,currentError:partnerServiceCapacitySurveyError??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    async function hydratePartnerServiceCapacitySurvey() {
      if (role !== 'partner') {
        if (isMounted) {
          setPartnerServiceCapacitySurveyHistory([])
          setPartnerServiceCapacitySurveyError(null)
        }
        // #region agent log
        fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-2',hypothesisId:'H6',location:'usePartnerServiceCapacityHistory.ts:19',message:'history cleared due to role',data:{role,organizationName:trimmedOrganizationName},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return
      }

      if (!trimmedOrganizationName) {
        if (isMounted) setPartnerServiceCapacitySurveyHistory([])
        // #region agent log
        fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-2',hypothesisId:'H6',location:'usePartnerServiceCapacityHistory.ts:26',message:'history cleared due to missing organization',data:{role,organizationName:trimmedOrganizationName},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return
      }

      try {
        const savedSurveyHistory = await loadPartnerServiceCapacitySurveyHistory(trimmedOrganizationName)
        if (!isMounted) return
        setPartnerServiceCapacitySurveyHistory(savedSurveyHistory)
        setPartnerServiceCapacitySurveyError(null)
        // #region agent log
        fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-2',hypothesisId:'H6',location:'usePartnerServiceCapacityHistory.ts:35',message:'history loaded',data:{role,organizationName:trimmedOrganizationName,loadedCount:savedSurveyHistory.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      } catch (error) {
        if (!isMounted) return
        setPartnerServiceCapacitySurveyError(error instanceof Error ? error.message : 'Unable to load service capacity survey.')
        // #region agent log
        fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-2',hypothesisId:'H6',location:'usePartnerServiceCapacityHistory.ts:40',message:'history load failed',data:{role,organizationName:trimmedOrganizationName,error:error instanceof Error ? error.message : 'Unable to load service capacity survey.'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
    }

    hydratePartnerServiceCapacitySurvey()
    return () => {
      isMounted = false
    }
  }, [organizationName, role])

  return {
    partnerServiceCapacitySurveyHistory,
    partnerServiceCapacitySurveyError,
    setPartnerServiceCapacitySurveyHistory,
    setPartnerServiceCapacitySurveyError
  }
}
