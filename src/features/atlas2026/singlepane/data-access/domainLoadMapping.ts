import type { DomainLoad, DomainLoadBreakdown } from '@/features/atlas2026/singlepane/types'

/**
 * Domain load mapping helpers shared by repositories/hooks.
 *
 * Purpose:
 * - centralize raw domain aggregation from breakdown totals.
 * - keep radial-chart values aligned to the same mapped-domain rows used in overlays.
 */
export function toNormalizedRadialDomainLoad(breakdown: DomainLoadBreakdown | null): DomainLoad | null {
  if (!breakdown) return null
  return {
    enrolleeId: breakdown.subjectId,
    habitat: breakdown.habitatTotal,
    work: breakdown.workTotal,
    socialNetworks: breakdown.socialNetworksTotal
  }
}
