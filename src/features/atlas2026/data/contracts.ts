export type JourneyPhase = 'regulation' | 'readiness' | 'renewal'

export interface Participant {
  id: string
  name: string
  county: string
  currentPhase: JourneyPhase
  readinessScore: number
  activeJourneyId?: string
}

export interface InstructionBomItem {
  id: string
  title: string
  domain: string
  description: string
  required: boolean
  defaultDurationDays: number
}

export interface RoutingStep {
  id: string
  bomItemId: string
  label: string
  phase: JourneyPhase
  instruction: string
  ownerRole: string
  exitCriteria: string
  sequence: number
}

export interface RouteTemplate {
  id: string
  name: string
  description: string
  targetPhase: JourneyPhase
  bomItemIds: string[]
  stepIds: string[]
  isCore: boolean
}

export type JourneyStatus = 'draft' | 'active' | 'completed'

export interface JourneyAssignment {
  id: string
  participantId: string
  templateId: string
  stepIds: string[]
  status: JourneyStatus
  currentStepIndex: number
  startedAt: string
}

export interface AtlasJsonDataset {
  participants: Participant[]
  instructionBoms: InstructionBomItem[]
  routingSteps: RoutingStep[]
  routeTemplates: RouteTemplate[]
  journeyAssignments: JourneyAssignment[]
}
