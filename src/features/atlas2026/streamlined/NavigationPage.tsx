import React from 'react'
import { Navigation } from 'lucide-react'
import type { JourneyAssignment, Participant, RoutingStep } from '@/features/atlas2026/data/contracts'
import { SUBWAY_COLORS } from '@/features/atlas2026/streamlined/theme'

interface NavigationPageProps {
  participants: Participant[]
  selectedParticipantId: string
  onSelectParticipant: (participantId: string) => void
  selectedParticipant: Participant | null
  selectedJourney: JourneyAssignment | null
  selectedJourneySteps: RoutingStep[]
}

function phaseTone(phase?: string) {
  if (phase === 'renewal') return { color: SUBWAY_COLORS.deepGreen }
  if (phase === 'readiness') return { color: SUBWAY_COLORS.blue }
  return { color: SUBWAY_COLORS.yellow }
}

export default function NavigationPage({
  participants,
  selectedParticipantId,
  onSelectParticipant,
  selectedParticipant,
  selectedJourney,
  selectedJourneySteps
}: NavigationPageProps) {
  const activeStep = selectedJourneySteps[selectedJourney?.currentStepIndex || 0] || selectedJourneySteps[0] || null

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">participant context</small>
        <div className="mt-3 max-w-lg">
          <select
            className="w-full rounded-xl border bg-black px-4 py-3 text-sm text-white"
            style={{ borderColor: SUBWAY_COLORS.border }}
            value={selectedParticipantId}
            onChange={(event) => onSelectParticipant(event.target.value)}
          >
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
        </div>
        {selectedParticipant && (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <small className="rounded-xl border bg-black px-3 py-2 text-[#a7a9ac]" style={{ borderColor: SUBWAY_COLORS.border }}>
              county: <span className="text-white">{selectedParticipant.county}</span>
            </small>
            <small className="rounded-xl border bg-black px-3 py-2 text-[#a7a9ac]" style={{ borderColor: SUBWAY_COLORS.border }}>
              phase: <span style={phaseTone(selectedParticipant.currentPhase)}>{selectedParticipant.currentPhase}</span>
            </small>
            <small className="rounded-xl border bg-black px-3 py-2 text-[#a7a9ac]" style={{ borderColor: SUBWAY_COLORS.border }}>
              readiness: <span className="text-white">{Math.round(selectedParticipant.readinessScore * 100)}%</span>
            </small>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">journey strip</small>
        <div className="mt-4 space-y-3">
          {selectedJourneySteps.length === 0 ? (
            <small style={{ color: SUBWAY_COLORS.yellow }}>no journey assigned yet. use route planner to assign a template.</small>
          ) : (
            selectedJourneySteps.map((step, index) => {
              const isCurrent = index === (selectedJourney?.currentStepIndex || 0)
              return (
                <div key={step.id} className="flex items-start gap-3 rounded-xl border bg-black p-3" style={{ borderColor: SUBWAY_COLORS.border }}>
                  <span
                    className={`mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
                      isCurrent ? 'text-black' : 'text-[#a7a9ac]'
                    }`}
                    style={{
                      backgroundColor: isCurrent ? SUBWAY_COLORS.white : SUBWAY_COLORS.surface,
                      border: `1px solid ${isCurrent ? SUBWAY_COLORS.white : SUBWAY_COLORS.border}`
                    }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <small className="block text-white">{step.label}</small>
                    <small className="block text-[#a7a9ac]">{step.instruction}</small>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-[#0d0d0d] p-6" style={{ borderColor: SUBWAY_COLORS.border }}>
        <small className="block text-xs font-black tracking-[0.12em] text-[#a7a9ac]">next safe move</small>
        <div className="mt-3 flex items-center gap-3 rounded-xl border bg-black p-4" style={{ borderColor: SUBWAY_COLORS.border }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-black" style={{ borderColor: SUBWAY_COLORS.border }}>
            <Navigation className="h-5 w-5" style={{ color: SUBWAY_COLORS.orange }} />
          </div>
          <div>
            <small className="block text-[#808183]">current instruction</small>
            <small className="block text-white">{activeStep?.label || 'assign template to generate first move'}</small>
          </div>
        </div>
      </section>
    </div>
  )
}
