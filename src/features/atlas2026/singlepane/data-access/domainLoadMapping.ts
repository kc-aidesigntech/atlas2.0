import type { DomainLoad, DomainLoadBreakdown } from '@/features/atlas2026/singlepane/types'

/**
 * Domain load mapping helpers shared by repositories/hooks.
 *
 * Purpose:
 * - centralize percentage normalization from breakdown totals.
 * - keep partner radial-chart scaling consistent across call sites.
 */
export function toNormalizedRadialDomainLoad(breakdown: DomainLoadBreakdown | null): DomainLoad | null {
  if (!breakdown) return null
  const maxTotal = Math.max(breakdown.habitatTotal, breakdown.workTotal, breakdown.socialNetworksTotal, 1)
  return {
    enrolleeId: breakdown.subjectId,
    habitat: Math.round((breakdown.habitatTotal / maxTotal) * 100),
    work: Math.round((breakdown.workTotal / maxTotal) * 100),
    socialNetworks: Math.round((breakdown.socialNetworksTotal / maxTotal) * 100)
  }
}
