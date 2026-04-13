import { fetchSinglePaneSurveyDefinition } from '@atlas/shared'
import { useEffect, useState } from 'react'
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
        setScale([])
        setSections([])
        setIsLoading(false)
        return
      }

      try {
        const definition = await withOptionalSupabaseFallback(
          'singlepane.serviceCapacitySurveyDefinition',
          () => fetchSinglePaneSurveyDefinition(supabase),
          { scale: [], sections: [] }
        )
        if (!isMounted) return
        setScale(definition.scale)
        setSections(definition.sections)
      } catch (error) {
        if (!isOptionalSupabaseDataError(error)) {
          console.warn('Failed to load service capacity survey definition.', error)
        }
        if (!isMounted) return
        setScale([])
        setSections([])
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
