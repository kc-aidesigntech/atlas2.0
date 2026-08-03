import type {
  EnrolleeActiveZCode,
  RegulationTestSubmissionRecord,
  ResolvedZCodeStripMarker,
  StabilizationPhase
} from '@/features/atlas2026/shared/contracts'

export function nextPhase(current?: StabilizationPhase): StabilizationPhase {
  if (current === 'regulation') return 'readiness'
  if (current === 'readiness') return 'renewal'
  return 'renewal'
}

export function getRegulationTestLabel(testType: RegulationTestSubmissionRecord['testType']) {
  // Short labels for timeline markers; full instrument names live in assessmentCatalog.
  if (testType === 'mh_sca') return 'MH-SCA'
  if (testType === 'svs') return 'SVS'
  if (testType === 'ipf') return 'IPF'
  return 'B-IPF'
}

export function buildCompletedParentCodes(activeZCodeDetails: EnrolleeActiveZCode[]) {
  const grouped = new Map<string, boolean[]>()
  for (const detail of activeZCodeDetails) {
    const parentCode = detail.parentCode.trim().toUpperCase()
    const current = grouped.get(parentCode) || []
    current.push(detail.isResolved)
    grouped.set(parentCode, current)
  }
  return Array.from(grouped.entries())
    .filter(([, values]) => values.length > 0 && values.every(Boolean))
    .map(([parentCode]) => parentCode)
}

export function buildResolvedZCodeStripMarkers(activeZCodeDetails: EnrolleeActiveZCode[]) {
  return activeZCodeDetails
    .filter((detail) => detail.isResolved && detail.resolutionAt)
    .slice()
    .sort((left, right) => new Date(left.resolutionAt || 0).getTime() - new Date(right.resolutionAt || 0).getTime())
    .map((detail) => ({
      id: detail.enrolleeZCodeId,
      parentCode: detail.parentCode.trim().toUpperCase(),
      zCode: detail.zCode.trim().toUpperCase(),
      description: detail.description || detail.title || detail.zCode,
      resolvedAtIso: detail.resolutionAt || new Date().toISOString(),
      partnerName: detail.resolutionPartnerName?.trim() || null,
      resolutionNote: detail.resolutionNote?.trim() || null
    })) satisfies ResolvedZCodeStripMarker[]
}
export function derivePickupQueueParentCodes(zCodeTags: string[]) {
  const parentCodes = zCodeTags
    .map((tag) => {
      const match = String(tag || '')
        .trim()
        .toUpperCase()
        .match(/^Z(\d{2})/)
      return match ? `Z${match[1]}` : ''
    })
    .filter((value) => /^Z\d{2}$/.test(value))
  return Array.from(new Set(parentCodes)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}
