import { useEffect, useState } from 'react'
import type { PartnerServiceCapacitySubmissionRecord } from '@/features/atlas2026/singlepane/types'
import { loadPartnerServiceCapacitySurveyHistory } from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'

export function usePartnerServiceCapacityHistory(role: string, organizationName: string | undefined) {
  const [partnerServiceCapacitySurveyHistory, setPartnerServiceCapacitySurveyHistory] = useState<PartnerServiceCapacitySubmissionRecord[]>([])
  const [partnerServiceCapacitySurveyError, setPartnerServiceCapacitySurveyError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const trimmedOrganizationName = organizationName?.trim() || ''

    async function hydratePartnerServiceCapacitySurvey() {
      if (role !== 'partner') {
        if (isMounted) {
          setPartnerServiceCapacitySurveyHistory([])
          setPartnerServiceCapacitySurveyError(null)
        }
        return
      }

      if (!trimmedOrganizationName) {
        if (isMounted) setPartnerServiceCapacitySurveyHistory([])
        return
      }

      try {
        const savedSurveyHistory = await loadPartnerServiceCapacitySurveyHistory(trimmedOrganizationName)
        if (!isMounted) return
        setPartnerServiceCapacitySurveyHistory(savedSurveyHistory)
        setPartnerServiceCapacitySurveyError(null)
      } catch (error) {
        if (!isMounted) return
        setPartnerServiceCapacitySurveyError(error instanceof Error ? error.message : 'Unable to load service capacity survey.')
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
