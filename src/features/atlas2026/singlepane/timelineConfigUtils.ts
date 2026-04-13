import type { StabilizationPhase, TimelineConfig, TimelineGate } from './types'

export const DEFAULT_TIMELINE_DURATION_MONTHS = 6
export const DEFAULT_TIMELINE_MAX_DURATION_MONTHS = 12

const PHASE_ORDER: StabilizationPhase[] = ['regulation', 'readiness', 'renewal']

const DEFAULT_PHASE_START_OFFSETS: Record<StabilizationPhase, number> = {
  regulation: 0,
  readiness: 2,
  renewal: 4
}

export interface TimelinePhaseSegment {
  phase: StabilizationPhase
  label: string
  startOffset: number
  endOffset: number
}

export type TimelinePhaseLengths = Record<StabilizationPhase, number>

export function getSafeTimelineDurationMonths(config: Pick<TimelineConfig, 'durationMonths' | 'maxDurationMonths' | 'gates'>) {
  const maxDurationMonths = Math.max(DEFAULT_TIMELINE_DURATION_MONTHS, config.maxDurationMonths || DEFAULT_TIMELINE_MAX_DURATION_MONTHS)
  const preferredDuration =
    config.gates?.length && Number.isFinite(config.durationMonths)
      ? config.durationMonths
      : DEFAULT_TIMELINE_DURATION_MONTHS
  return Math.min(maxDurationMonths, Math.max(1, preferredDuration || DEFAULT_TIMELINE_DURATION_MONTHS))
}

export function buildDefaultTimelineGates(durationMonths = DEFAULT_TIMELINE_DURATION_MONTHS): TimelineGate[] {
  return [
    { id: 'gate-regulation-start', label: 'regulation', phase: 'regulation', monthOffset: DEFAULT_PHASE_START_OFFSETS.regulation },
    { id: 'gate-readiness-start', label: 'readiness', phase: 'readiness', monthOffset: DEFAULT_PHASE_START_OFFSETS.readiness },
    { id: 'gate-renewal-start', label: 'renewal', phase: 'renewal', monthOffset: DEFAULT_PHASE_START_OFFSETS.renewal },
    { id: 'gate-plan-end', label: 'plan end', phase: 'renewal', monthOffset: durationMonths }
  ]
}

export function buildTimelinePhaseSegments(config: TimelineConfig): TimelinePhaseSegment[] {
  const safeDurationMonths = getSafeTimelineDurationMonths(config)
  return PHASE_ORDER.map((phase, index) => {
    const configuredGate = config.gates.find((gate) => gate.phase === phase)
    const nextPhase = PHASE_ORDER[index + 1]
    const nextConfiguredGate = nextPhase ? config.gates.find((gate) => gate.phase === nextPhase) : null
    return {
      phase,
      label: configuredGate?.label || phase,
      startOffset: configuredGate?.monthOffset ?? DEFAULT_PHASE_START_OFFSETS[phase],
      endOffset: nextConfiguredGate?.monthOffset ?? safeDurationMonths
    }
  })
}

export function normalizeTimelineConfig(config: TimelineConfig): TimelineConfig {
  const safeDurationMonths = getSafeTimelineDurationMonths(config)
  const safeMaxDurationMonths = Math.max(safeDurationMonths, config.maxDurationMonths || DEFAULT_TIMELINE_MAX_DURATION_MONTHS)
  const segments = buildTimelinePhaseSegments({ ...config, durationMonths: safeDurationMonths, maxDurationMonths: safeMaxDurationMonths })
  const phaseLabels = Object.fromEntries(segments.map((segment) => [segment.phase, segment.label])) as Record<StabilizationPhase, string>
  return {
    ...config,
    durationMonths: safeDurationMonths,
    maxDurationMonths: safeMaxDurationMonths,
    gates: buildDefaultTimelineGates(safeDurationMonths).map((gate) => {
      if (gate.id === 'gate-plan-end') {
        const existingPlanEndGate = config.gates.find((candidate) => candidate.id === gate.id)
        return {
          ...gate,
          label: existingPlanEndGate?.label || gate.label
        }
      }
      return {
        ...gate,
        label: phaseLabels[gate.phase],
        monthOffset: segments.find((segment) => segment.phase === gate.phase)?.startOffset ?? gate.monthOffset
      }
    })
  }
}

export function getTimelinePhaseLengths(config: TimelineConfig): TimelinePhaseLengths {
  const normalizedConfig = normalizeTimelineConfig(config)
  const segments = buildTimelinePhaseSegments(normalizedConfig)
  return {
    regulation: Math.max(1, segments[0].endOffset - segments[0].startOffset),
    readiness: Math.max(1, segments[1].endOffset - segments[1].startOffset),
    renewal: Math.max(1, segments[2].endOffset - segments[2].startOffset)
  }
}

export function buildTimelineConfigFromPhaseLengths(
  config: TimelineConfig,
  phaseLengths: TimelinePhaseLengths,
  overrides: Partial<Pick<TimelineConfig, 'planStartIso' | 'maxDurationMonths'>> = {}
): TimelineConfig {
  const normalizedConfig = normalizeTimelineConfig(config)
  const safeMaxDurationMonths = Math.max(
    DEFAULT_TIMELINE_DURATION_MONTHS,
    overrides.maxDurationMonths || normalizedConfig.maxDurationMonths || DEFAULT_TIMELINE_MAX_DURATION_MONTHS
  )
  const safePhaseLengths: TimelinePhaseLengths = {
    regulation: Math.max(1, phaseLengths.regulation),
    readiness: Math.max(1, phaseLengths.readiness),
    renewal: Math.max(1, phaseLengths.renewal)
  }
  const nextDurationMonths = safePhaseLengths.regulation + safePhaseLengths.readiness + safePhaseLengths.renewal
  if (nextDurationMonths > safeMaxDurationMonths) return normalizedConfig

  const segments = [
    { phase: 'regulation' as const, startOffset: 0 },
    { phase: 'readiness' as const, startOffset: safePhaseLengths.regulation },
    { phase: 'renewal' as const, startOffset: safePhaseLengths.regulation + safePhaseLengths.readiness }
  ]
  const labelByPhase = Object.fromEntries(
    buildTimelinePhaseSegments(normalizedConfig).map((segment) => [segment.phase, segment.label])
  ) as Record<StabilizationPhase, string>

  return normalizeTimelineConfig({
    ...normalizedConfig,
    planStartIso: overrides.planStartIso || normalizedConfig.planStartIso,
    maxDurationMonths: safeMaxDurationMonths,
    durationMonths: nextDurationMonths,
    gates: [
      ...segments.map((segment) => ({
        id: `gate-${segment.phase}-start`,
        label: labelByPhase[segment.phase],
        phase: segment.phase,
        monthOffset: segment.startOffset
      })),
      {
        id: 'gate-plan-end',
        label: normalizedConfig.gates.find((gate) => gate.id === 'gate-plan-end')?.label || 'plan end',
        phase: 'renewal' as const,
        monthOffset: nextDurationMonths
      }
    ]
  })
}

export function adjustTimelinePhaseLength(config: TimelineConfig, phase: StabilizationPhase, deltaMonths: number): TimelineConfig {
  const normalizedConfig = normalizeTimelineConfig(config)
  if (!deltaMonths) return normalizedConfig
  const phaseLengths = getTimelinePhaseLengths(normalizedConfig)
  const nextPhaseLengths = {
    ...phaseLengths,
    [phase]: phaseLengths[phase] + deltaMonths
  }
  if (nextPhaseLengths[phase] < 1) return normalizedConfig
  return buildTimelineConfigFromPhaseLengths(normalizedConfig, nextPhaseLengths)
}

export function adjustTimelineDuration(config: TimelineConfig, deltaMonths: number): TimelineConfig {
  return adjustTimelinePhaseLength(config, 'renewal', deltaMonths)
}

export function extendTimelinePhaseByMonth(config: TimelineConfig, phase: StabilizationPhase): TimelineConfig {
  return adjustTimelinePhaseLength(config, phase, 1)
}
