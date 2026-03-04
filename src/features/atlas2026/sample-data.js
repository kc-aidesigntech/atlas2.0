import { ATLAS_ROLES } from '@/core/atlas2026/policy'
import { createParticipantState } from '@/core/atlas2026/data-model'

export const DEMO_ROLES = Object.values(ATLAS_ROLES)

export const DEMO_PARTICIPANTS = [
  createParticipantState({
    participantId: 'pt-101',
    displayName: 'North District Participant',
    currentPhase: 'Regulation',
    phaseReadiness: 0.35,
    pressureVectors: [
      { domain: 'habitat', severity: 0.83, trajectory: 'up', reversibility: 0.38, confidence: 0.8 },
      { domain: 'socialNetworks', severity: 0.7, trajectory: 'flat', reversibility: 0.45, confidence: 0.76 },
      { domain: 'work', severity: 0.68, trajectory: 'up', reversibility: 0.41, confidence: 0.74 },
      { domain: 'health', severity: 0.64, trajectory: 'down', reversibility: 0.63, confidence: 0.71 },
      { domain: 'mobility', severity: 0.58, trajectory: 'flat', reversibility: 0.52, confidence: 0.69 }
    ]
  }),
  createParticipantState({
    participantId: 'pt-204',
    displayName: 'Harbor Corridor Participant',
    currentPhase: 'Readiness',
    phaseReadiness: 0.57,
    pressureVectors: [
      { domain: 'habitat', severity: 0.51, trajectory: 'down', reversibility: 0.62, confidence: 0.72 },
      { domain: 'socialNetworks', severity: 0.62, trajectory: 'flat', reversibility: 0.53, confidence: 0.73 },
      { domain: 'work', severity: 0.77, trajectory: 'up', reversibility: 0.37, confidence: 0.8 },
      { domain: 'health', severity: 0.44, trajectory: 'down', reversibility: 0.64, confidence: 0.67 },
      { domain: 'mobility', severity: 0.4, trajectory: 'flat', reversibility: 0.68, confidence: 0.69 }
    ]
  })
]

export const DEMO_CAPACITY_TOPOLOGY = [
  {
    partnerId: 'station-housing-01',
    label: 'Housing Stabilization Station',
    coverageScore: 0.84,
    phaseAlignment: 0.89,
    specializationScore: 0.82,
    reversibilitySupport: 0.78,
    transferCost: 0.22,
    interferenceRisk: 0.16,
    phaseIndex: 0
  },
  {
    partnerId: 'station-work-03',
    label: 'Work Restoration Station',
    coverageScore: 0.74,
    phaseAlignment: 0.75,
    specializationScore: 0.86,
    reversibilitySupport: 0.71,
    transferCost: 0.25,
    interferenceRisk: 0.2,
    phaseIndex: 1
  },
  {
    partnerId: 'station-network-02',
    label: 'Social Network Repair Station',
    coverageScore: 0.78,
    phaseAlignment: 0.8,
    specializationScore: 0.72,
    reversibilitySupport: 0.66,
    transferCost: 0.31,
    interferenceRisk: 0.27,
    phaseIndex: 1
  }
]

