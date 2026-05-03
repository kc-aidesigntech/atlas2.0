import React from 'react'
import { Navigation } from 'lucide-react'
import type { JourneyAssignment, Participant, RoutingStep } from '@/features/atlas2026/data/contracts'
import { AtlasIconBadge, AtlasInsetCard, AtlasMetricPill, AtlasPanel } from '@/features/atlas2026/components/AtlasPrimitives'
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
  // Keep phase-to-color mapping centralized so badges and pills stay visually consistent.
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
  // If assignment metadata drifts, fall back to first step so the panel still presents
  // a safe "next move" instead of blanking out.
  const activeStep = selectedJourneySteps[selectedJourney?.currentStepIndex || 0] || selectedJourneySteps[0] || null

  return (
    <div className="space-y-6">
      <AtlasPanel kicker="participant context">
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
            <AtlasMetricPill label="county" value={selectedParticipant.county} />
            <AtlasMetricPill
              label="phase"
              value={selectedParticipant.currentPhase}
              accentColor={phaseTone(selectedParticipant.currentPhase).color}
            />
            <AtlasMetricPill label="readiness" value={`${Math.round(selectedParticipant.readinessScore * 100)}%`} />
          </div>
        )}
      </AtlasPanel>

      <AtlasPanel kicker="journey strip">
        <div className="mt-4 space-y-3">
          {selectedJourneySteps.length === 0 ? (
            <small style={{ color: SUBWAY_COLORS.yellow }}>no journey assigned yet. use route planner to assign a template.</small>
          ) : (
            selectedJourneySteps.map((step, index) => {
              const isCurrent = index === (selectedJourney?.currentStepIndex || 0)
              return (
                <AtlasInsetCard key={step.id} className="flex items-start gap-3">
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
                </AtlasInsetCard>
              )
            })
          )}
        </div>
      </AtlasPanel>

      <AtlasPanel kicker="next safe move">
        <AtlasInsetCard className="mt-3 flex items-center gap-3 p-4">
          <AtlasIconBadge color={SUBWAY_COLORS.orange}>
            <Navigation className="h-5 w-5" style={{ color: SUBWAY_COLORS.orange }} />
          </AtlasIconBadge>
          <div>
            <small className="block text-[#808183]">current instruction</small>
            <small className="block text-white">{activeStep?.label || 'assign template to generate first move'}</small>
          </div>
        </AtlasInsetCard>
      </AtlasPanel>
    </div>
  )
}
