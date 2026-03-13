import React from 'react'
import type { JourneyAssignment, Participant, RouteTemplate } from '@/features/atlas2026/data/contracts'
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
  const byPhase = participants.reduce<Record<string, number>>((accumulator, participant) => {
    accumulator[participant.currentPhase] = (accumulator[participant.currentPhase] || 0) + 1
    return accumulator
  }, {})

  const completionRatio = journeys.length === 0 ? 0 : journeys.filter((journey) => journey.status === 'completed').length / journeys.length

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">regional intelligence</small>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border bg-black p-4" style={{ borderColor: SUBWAY_COLORS.border }}>
            <small className="block text-[#808183]">active journeys</small>
            <small className="text-xl font-black text-white">{metrics.activeJourneys}</small>
          </div>
          <div className="rounded-xl border bg-black p-4" style={{ borderColor: SUBWAY_COLORS.border }}>
            <small className="block text-[#808183]">avg readiness</small>
            <small className="text-xl font-black" style={{ color: SUBWAY_COLORS.blue }}>
              {Math.round(metrics.averageReadiness * 100)}%
            </small>
          </div>
          <div className="rounded-xl border bg-black p-4" style={{ borderColor: SUBWAY_COLORS.border }}>
            <small className="block text-[#808183]">renewal ready</small>
            <small className="text-xl font-black" style={{ color: SUBWAY_COLORS.deepGreen }}>
              {metrics.renewalReady}
            </small>
          </div>
          <div className="rounded-xl border bg-black p-4" style={{ borderColor: SUBWAY_COLORS.border }}>
            <small className="block text-[#808183]">journey completion</small>
            <small className="text-xl font-black" style={{ color: SUBWAY_COLORS.orange }}>
              {Math.round(completionRatio * 100)}%
            </small>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">phase distribution</small>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {['regulation', 'readiness', 'renewal'].map((phase) => (
            <div key={phase} className="rounded-xl border bg-black p-4" style={{ borderColor: SUBWAY_COLORS.border }}>
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
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">template readiness board</small>
        <div className="mt-3 space-y-2">
          {templates.map((template) => {
            const usage = journeys.filter((journey) => journey.templateId === template.id).length
            return (
              <div key={template.id} className="rounded-xl border bg-black p-3" style={{ borderColor: SUBWAY_COLORS.border }}>
                <small className="block text-white">{template.name}</small>
                <small className="block text-[#a7a9ac]">
                  target: {template.targetPhase} | steps: {template.stepIds.length} | assigned: {usage}
                </small>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
