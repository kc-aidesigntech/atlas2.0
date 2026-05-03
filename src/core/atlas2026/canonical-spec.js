// Canonical Atlas 2026 vocabulary shared by UI and decision services.
// Treat these exports as cross-system contracts, not presentation-only constants.
export const STABILIZATION_PHASES = ['Regulation', 'Readiness', 'Renewal']
export const RECIPROCITY_ETHOS = 'This community takes care of me - and I take care of it.'

// Canonical spec values are shared by routing, operations snapshots, and UI labels.
// Changing keys/ordering here is a cross-system contract migration, not a local refactor.
export const ATLAS_2026_PRINCIPLES = [
  'Navigation under pressure over exploratory analytics.',
  'System pressure modeling without person-level scoring.',
  'Safety and ethics encoded as hard constraints.',
  'Role-scoped interpretation through a centralized decision core.',
  'Collective memory built from verified milestones and blockers.',
  'Calm, actionable interfaces with urgency but no panic.',
  'Local sovereignty with federated learning from aggregate patterns.',
  'ATLAS as upstream interpretive infrastructure for partner systems.'
]

export const ONTOLOGY_PRIMITIVES = {
  participant: {
    description: 'A person navigating stabilization with role-preserving dignity.',
    keyAttributes: ['participantId', 'countyId', 'currentPhase', 'phaseReadiness', 'activeRouteId']
  },
  pressureVector: {
    description: 'Observed pressure and reversibility signal by life-production domain.',
    keyAttributes: ['domain', 'severity', 'trajectory', 'reversibility', 'confidence']
  },
  capacityNode: {
    description: 'Partner capacity unit with specialization, availability, and eligibility profile.',
    keyAttributes: ['partnerId', 'domainCoverage', 'capacitySlots', 'eligibilityTags', 'specializationScore']
  },
  routeCandidate: {
    description: 'Potential sequenced intervention path with dependency and interference metadata.',
    keyAttributes: ['routeId', 'steps', 'coverageScore', 'interferenceRisk', 'transferCost']
  },
  memoryEvent: {
    description: 'Evidence-gated progression marker shown on strip maps.',
    keyAttributes: ['eventId', 'type', 'phase', 'verifiedAt', 'verificationSource']
  }
}

export const PRESSURE_DOMAINS = [
  { id: 'habitat', label: 'Habitat Stability' },
  { id: 'socialNetworks', label: 'Social Networks' },
  { id: 'work', label: 'Work and Contribution' },
  { id: 'health', label: 'Behavioral and Physical Regulation' },
  { id: 'mobility', label: 'Mobility and Access' }
]

export const HARD_CONSTRAINTS = [
  'Never regress to a higher-risk phase transition.',
  'Enforce eligibility before route activation.',
  'Block unsafe route transitions with explicit rationale.',
  'Require dependency completion before dependent step starts.',
  'Suppress recommendations that increase net interference risk.'
]

export const ROUTE_SCORING_FACTORS = {
  coverageWeight: 0.3,
  phaseAlignmentWeight: 0.2,
  specializationWeight: 0.2,
  reversibilityWeight: 0.15,
  transferCostPenalty: 0.1,
  interferencePenalty: 0.05
}

export const MEMORY_EVIDENCE_RULES = [
  'Milestones require timestamp, actor role, and verification source.',
  'Blockers must include categorized cause and unblock proposal.',
  'Phase transitions require completion evidence for gate criteria.',
  'Unverified events remain hidden from shared collective memory.',
  'Events are immutable after verification; corrections append as new events.'
]

export const ENGINE_OF_ASCENT_OUTPUTS = [
  'moralClarity',
  'principledAction',
  'stewardship',
  'institutionalCoherence',
  'communityRegeneration'
]

export const SRIG_COORDINATION_AREAS = [
  'policyGovernance',
  'institutionalMaturation',
  'stabilizationPathways',
  'civicDiplomacy',
  'earlyInterventionRouting',
  'renewalStandards'
]

export const INSTITUTIONAL_ECOSYSTEM = [
  { id: 'lucidLiving', label: 'Lucid Living', function: 'field operations, direct service, contracts' },
  { id: 'srigInstitute', label: 'SRIG Institute', function: 'methodology, evaluation, governance standards, r&d' },
  { id: 'schoolOfSocialAid', label: 'School of Social Aid', function: 'training, credentialing, human infrastructure' },
  { id: 'atlas', label: 'ATLAS', function: 'computational cortex: risk intelligence, routing, dashboards' },
  { id: 'civicIconography', label: 'Civic Iconography', function: 'public art as psychosocial vessels' }
]

