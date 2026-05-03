import React from 'react'
import type { JourneyAssignment, Participant, RouteTemplate } from '@/features/atlas2026/data/contracts'
import { AtlasInsetCard, AtlasMetricPill, AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
import { SUBWAY_COLORS } from '@/features/atlas2026/streamlined/theme'

interface IntelligencePageProps {
  participants: Participant[]
  templates: RouteTemplate[]
  journeys: JourneyAssignment[]
  metrics: {
    activeJourneys: number
    averageReadiness: number
    renewalReady: number
  }
}

export default function IntelligencePage({ participants, templates, journeys, metrics }: IntelligencePageProps) {
  // Build a lightweight distribution map once per render for phase cards.
  const byPhase = participants.reduce<Record<string, number>>((accumulator, participant) => {
    accumulator[participant.currentPhase] = (accumulator[participant.currentPhase] || 0) + 1
    return accumulator
  }, {})

  // Completion is reported as a ratio to keep the metric comparable across cohorts.
  const completionRatio = journeys.length === 0 ? 0 : journeys.filter((journey) => journey.status === 'completed').length / journeys.length

  return (
    <div className="space-y-6">
      <AtlasPanel kicker="regional intelligence">
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <AtlasMetricPill label="active journeys" value={metrics.activeJourneys} />
          <AtlasMetricPill label="avg readiness" value={`${Math.round(metrics.averageReadiness * 100)}%`} accentColor={SUBWAY_COLORS.blue} />
          <AtlasMetricPill label="renewal ready" value={metrics.renewalReady} accentColor={SUBWAY_COLORS.deepGreen} />
          <AtlasMetricPill label="journey completion" value={`${Math.round(completionRatio * 100)}%`} accentColor={SUBWAY_COLORS.orange} />
        </div>
      </AtlasPanel>

      <AtlasPanel kicker="phase distribution">
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {['regulation', 'readiness', 'renewal'].map((phase) => (
            <AtlasInsetCard key={phase} className="p-4">
              <small className="block text-[#808183]">{phase}</small>
              <small
                className="text-lg font-black"
                style={{
                  color:
                    phase === 'regulation'
                      ? SUBWAY_COLORS.yellow
                      : phase === 'readiness'
                        ? SUBWAY_COLORS.blue
                        : SUBWAY_COLORS.deepGreen
                }}
              >
                {byPhase[phase] || 0}
              </small>
            </AtlasInsetCard>
          ))}
        </div>
      </AtlasPanel>

      <AtlasPanel kicker="template readiness board">
        <div className="mt-3 space-y-2">
          {templates.map((template) => {
            const usage = journeys.filter((journey) => journey.templateId === template.id).length
            return (
              <AtlasInsetCard key={template.id}>
                <small className="block text-white">{template.name}</small>
                <small className="block text-[#a7a9ac]">
                  target: {template.targetPhase} | steps: {template.stepIds.length} | assigned: {usage}
                </small>
              </AtlasInsetCard>
            )
          })}
        </div>
      </AtlasPanel>
    </div>
  )
}
