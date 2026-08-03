import { getZCodeParentColor, usesLightTextOnZCodeColor } from '@atlas/shared'
import type { PartnerStripAggregateDot, StabilizationPhase } from '../../types'
import { TIMELINE_PHASE_COLORS } from '../timelineVisualConfig'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { assignGroupedCollisionLanes, distributePhaseDots } from './geometry'
import type { PartnerStageDotLayout } from './PartnerMarkers'

interface BuildPartnerLayoutsInput {
  activeDots: PartnerStripAggregateDot[]
  baselineY: number
  laneStep: number
  marginX: number
  minSpacing: number
  phaseBounds: Map<StabilizationPhase, { xStart: number; xEnd: number }>
  referredDots: PartnerStripAggregateDot[]
  safePlanEnd: Date
  safePlanStart: Date
  width: number
}

export function buildPartnerStageLayouts({
  activeDots,
  baselineY,
  laneStep,
  marginX,
  minSpacing,
  phaseBounds,
  referredDots,
  safePlanEnd,
  safePlanStart,
  width
}: BuildPartnerLayoutsInput): PartnerStageDotLayout[] {
  // The same enrollee/code may arrive through both aggregate feeds; merge lineage
  // while retaining the earliest valid occurrence for stable timeline placement.
  const deduped = Array.from(
    [...referredDots, ...activeDots]
      .reduce(
        (acc, dot) => {
          const key = `${dot.enrolleeId || dot.id}:${dot.phase}:${dot.parentCode || 'NA'}:${dot.zCode || 'NA'}`
          const existing = acc.get(key)
          if (!existing) {
            acc.set(key, { ...dot, sourceKinds: [dot.source] as Array<'referred' | 'active'> })
            return acc
          }
          const existingTime = new Date(existing.occurredAtIso).getTime()
          const nextTime = new Date(dot.occurredAtIso).getTime()
          acc.set(key, {
            ...existing,
            sourceKinds: Array.from(new Set([...existing.sourceKinds, dot.source])) as Array<'referred' | 'active'>,
            occurredAtIso:
              Number.isFinite(existingTime) && Number.isFinite(nextTime)
                ? new Date(Math.min(existingTime, nextTime)).toISOString()
                : existing.occurredAtIso || dot.occurredAtIso,
            zCodeDescription: existing.zCodeDescription || dot.zCodeDescription,
            zCodeShortLabel: existing.zCodeShortLabel || dot.zCodeShortLabel
          })
          return acc
        },
        new Map<string, PartnerStripAggregateDot & { sourceKinds: Array<'referred' | 'active'> }>()
      )
      .values()
  )

  const rawDots = deduped
    .slice()
    .sort((left, right) => new Date(left.occurredAtIso).getTime() - new Date(right.occurredAtIso).getTime())
    .map((dot) => {
      const bounds = phaseBounds.get(dot.phase)
      if (!bounds) return null
      const dotTime = new Date(dot.occurredAtIso).getTime()
      const ratio = Number.isFinite(dotTime)
        ? Math.max(0, Math.min(1, (dotTime - safePlanStart.getTime()) / Math.max(safePlanEnd.getTime() - safePlanStart.getTime(), 1)))
        : 0.5
      const projectedX = marginX + (width - marginX * 2) * ratio
      const x = Math.max(bounds.xStart + 10, Math.min(bounds.xEnd - 10, projectedX))
      const zCode = (dot.zCode || 'ZXX.0').trim().toUpperCase()
      const parentCode = (dot.parentCode || 'ZXX').trim().toUpperCase()
      const fill = getZCodeParentColor(parentCode) || TIMELINE_PHASE_COLORS[dot.phase]
      return {
        id: dot.id,
        x,
        y: baselineY,
        fill,
        textColor: usesLightTextOnZCodeColor(fill) ? SP_COLORS.white : SP_COLORS.bg,
        phase: dot.phase,
        occurredAtIso: dot.occurredAtIso,
        anonymousLabel: dot.anonymousLabel,
        enrolleeId: dot.enrolleeId,
        enrolleeName: dot.enrolleeName,
        sourceKinds: dot.sourceKinds,
        zCode,
        parentCode,
        zCodeDescription: dot.zCodeDescription || dot.zCode || 'z-code marker',
        zCodeShortLabel: dot.zCodeShortLabel || dot.zCodeDescription || dot.zCode || zCode,
        laneGroup: `${dot.phase}:${parentCode}:${zCode}`
      }
    })
    .filter(Boolean) as PartnerStageDotLayout[]

  const balancedDots = distributePhaseDots(rawDots, phaseBounds)
  const laneById = assignGroupedCollisionLanes(balancedDots, minSpacing)
  return balancedDots.map((dot) => ({
    ...dot,
    y: baselineY - 14 - (laneById.get(dot.id) || 0) * laneStep
  }))
}
