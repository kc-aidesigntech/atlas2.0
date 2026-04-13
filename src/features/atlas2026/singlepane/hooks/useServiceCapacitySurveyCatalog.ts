import { fetchSinglePaneSurveyDefinition } from '@atlas/shared'
import { useEffect, useState } from 'react'
import { DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import type { PartnerServiceCapacityScaleOption, ZCodeSurveySection } from '@/features/atlas2026/singlepane/types'
import { isOptionalSupabaseDataError, withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

export function useServiceCapacitySurveyCatalog() {
  const [scale, setScale] = useState<PartnerServiceCapacityScaleOption[]>([])
  const [sections, setSections] = useState<ZCodeSurveySection[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function hydrate() {
      if (!hasSupabaseConfig || !supabase) {
        if (!isMounted) return
        setScale(DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION.scale)
        setSections(DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION.sections)
        setIsLoading(false)
        return
      }

      try {
        const definition = await withOptionalSupabaseFallback(
          'singlepane.serviceCapacitySurveyDefinition',
          () => fetchSinglePaneSurveyDefinition(supabase),
          DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION
        )
        if (!isMounted) return
        setScale(definition.scale.length ? definition.scale : DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION.scale)
        setSections(definition.sections.length ? definition.sections : DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION.sections)
      } catch (error) {
        if (!isOptionalSupabaseDataError(error)) {
          console.warn('Failed to load service capacity survey definition.', error)
        }
        if (!isMounted) return
        setScale(DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION.scale)
        setSections(DEFAULT_SERVICE_CAPACITY_SURVEY_DEFINITION.sections)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    hydrate()
    return () => {
      isMounted = false
    }
  }, [])

  return { scale, sections, isLoading }
}
