import { useEffect, useState } from 'react'
import type { EnrolleeProfile, RouteCandidateRecord } from '@/features/atlas2026/singlepane/types'
import { loadRouteCandidates } from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'

export function useRouteCandidates(selectedEnrollee: EnrolleeProfile | null) {
  const [routeCandidates, setRouteCandidates] = useState<RouteCandidateRecord[]>([])

  useEffect(() => {
    let isMounted = true

    async function refreshRouteCandidates() {
      const candidates = await loadRouteCandidates(selectedEnrollee?.enrollmentId)
      if (!isMounted) return
      setRouteCandidates(candidates)
    }

    refreshRouteCandidates()
    return () => {
      isMounted = false
    }
  }, [selectedEnrollee])

  return routeCandidates
}
