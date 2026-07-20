import type { RouteCandidateRecord } from '@/features/atlas2026/shared/contracts'
import { DEFAULT_SERVICE_CAPACITY_SECTIONS } from './serviceCapacitySurveyCatalog'

/**
 * Contextual follow-up copy for Z-code resolution after a route-board handoff.
 *
 * Purpose:
 * - Keep resolve-note prompts tied to the matched service-line domains instead
 *   of a generic free-text note.
 * - Reuse the canonical service-capacity catalog themes so navigator language
 *   stays aligned with partner capacity surveys.
 */

export interface RouteResolveFollowUpContext {
  stationName: string
  matchedParentCodes: string[]
  matchedChildCodes: string[]
  themeLabels: string[]
  headline: string
  placeholder: string
  promptChips: string[]
}

function normalizeCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() || ''
}

function themeForParentCode(parentCode: string) {
  const normalized = normalizeCode(parentCode)
  return (
    DEFAULT_SERVICE_CAPACITY_SECTIONS.find((section) => normalizeCode(section.parentCode) === normalized)?.theme ||
    normalized
  )
}

/**
 * Builds follow-up note context from the route candidate that was just marked
 * done. Child codes take precedence for filtering; parent codes remain as the
 * domain language used in the prompt chips.
 */
export function buildRouteResolveFollowUpContext(candidate: RouteCandidateRecord): RouteResolveFollowUpContext {
  const matchedParentCodes = Array.from(
    new Set(
      [
        ...candidate.matchedParentSummaries.map((summary) => normalizeCode(summary.parentCode)),
        ...candidate.matchedZCodes.map((code) => normalizeCode(code.split('.')[0] || code))
      ].filter(Boolean)
    )
  ).sort()

  const matchedChildCodes = Array.from(
    new Set(
      candidate.matchedParentSummaries
        .flatMap((summary) => summary.matchedChildZCodes || [])
        .map((code) => normalizeCode(code))
        .filter(Boolean)
    )
  ).sort()

  const themeLabels = matchedParentCodes.map((parentCode) => themeForParentCode(parentCode))
  const stationName = candidate.stationName.trim() || 'selected station'
  const domainSummary = themeLabels.length
    ? themeLabels.slice(0, 2).join('; ')
    : 'the matched service domains'

  // Prompt chips are short follow-up stems the navigator can click into the note.
  const promptChips = matchedParentCodes.slice(0, 4).map((parentCode) => {
    const theme = themeForParentCode(parentCode)
    return `${parentCode}: confirmed follow-up for ${theme.toLowerCase()}`
  })

  return {
    stationName,
    matchedParentCodes,
    matchedChildCodes,
    themeLabels,
    headline: `Follow-up after routing to ${stationName}`,
    placeholder: `What was confirmed with ${stationName} about ${domainSummary}? Include next step, timing, or remaining barrier.`,
    promptChips
  }
}
