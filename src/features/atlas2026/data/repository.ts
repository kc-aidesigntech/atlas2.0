import participantsSeed from '@/features/atlas2026/data/participants.json'
import instructionBomsSeed from '@/features/atlas2026/data/instruction-boms.json'
import routingStepsSeed from '@/features/atlas2026/data/routing-steps.json'
import routeTemplatesSeed from '@/features/atlas2026/data/route-templates.json'
import journeyAssignmentsSeed from '@/features/atlas2026/data/journey-assignments.json'
import type {
  AtlasJsonDataset,
  InstructionBomItem,
  JourneyAssignment,
  Participant,
  RouteTemplate,
  RoutingStep
} from '@/features/atlas2026/data/contracts'

const STORAGE_KEY = 'atlas2026.streamlined.dataset.v1'

const seededDataset: AtlasJsonDataset = {
  participants: participantsSeed as Participant[],
  instructionBoms: instructionBomsSeed as InstructionBomItem[],
  routingSteps: routingStepsSeed as RoutingStep[],
  routeTemplates: routeTemplatesSeed as RouteTemplate[],
  journeyAssignments: journeyAssignmentsSeed as JourneyAssignment[]
}

function cloneSeededDataset(): AtlasJsonDataset {
  return JSON.parse(JSON.stringify(seededDataset))
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readPersistedDataset(): AtlasJsonDataset | null {
  if (!canUseStorage()) return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AtlasJsonDataset
    return parsed
  } catch {
    return null
  }
}

function writePersistedDataset(dataset: AtlasJsonDataset) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset))
}

export function loadDataset(): AtlasJsonDataset {
  const persisted = readPersistedDataset()
  if (persisted) return persisted
  const seeded = cloneSeededDataset()
  writePersistedDataset(seeded)
  return seeded
}

export function resetDataset(): AtlasJsonDataset {
  const seeded = cloneSeededDataset()
  writePersistedDataset(seeded)
  return seeded
}

export function saveDataset(dataset: AtlasJsonDataset): AtlasJsonDataset {
  writePersistedDataset(dataset)
  return dataset
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function listParticipants(dataset: AtlasJsonDataset) {
  return dataset.participants
}

export function listInstructionBoms(dataset: AtlasJsonDataset) {
  return dataset.instructionBoms
}

export function listRoutingSteps(dataset: AtlasJsonDataset) {
  return dataset.routingSteps
}

export function listRouteTemplates(dataset: AtlasJsonDataset) {
  return dataset.routeTemplates
}

export function listJourneyAssignments(dataset: AtlasJsonDataset) {
  return dataset.journeyAssignments
}

export function createInstructionBomItem(
  dataset: AtlasJsonDataset,
  payload: Omit<InstructionBomItem, 'id'>
): AtlasJsonDataset {
  const next: InstructionBomItem = { id: createId('bom'), ...payload }
  return { ...dataset, instructionBoms: [...dataset.instructionBoms, next] }
}

export function buildStepsFromBomIds(dataset: AtlasJsonDataset, bomItemIds: string[]): RoutingStep[] {
  return dataset.routingSteps
    .filter((step) => bomItemIds.includes(step.bomItemId))
    .sort((a, b) => a.sequence - b.sequence)
}

export function saveRouteTemplate(
  dataset: AtlasJsonDataset,
  payload: Omit<RouteTemplate, 'id'>
): { dataset: AtlasJsonDataset; template: RouteTemplate } {
  const template: RouteTemplate = { id: createId('template'), ...payload }
  return {
    template,
    dataset: { ...dataset, routeTemplates: [...dataset.routeTemplates, template] }
  }
}

export function assignTemplateToParticipant(
  dataset: AtlasJsonDataset,
  participantId: string,
  templateId: string
): { dataset: AtlasJsonDataset; assignment: JourneyAssignment | null } {
  const template = dataset.routeTemplates.find((item) => item.id === templateId)
  if (!template) return { dataset, assignment: null }

  const assignment: JourneyAssignment = {
    id: createId('journey'),
    participantId,
    templateId,
    stepIds: template.stepIds,
    status: 'active',
    currentStepIndex: 0,
    startedAt: new Date().toISOString()
  }

  const updatedParticipants = dataset.participants.map((participant) =>
    participant.id === participantId ? { ...participant, activeJourneyId: assignment.id } : participant
  )

  return {
    assignment,
    dataset: {
      ...dataset,
      participants: updatedParticipants,
      journeyAssignments: [assignment, ...dataset.journeyAssignments]
    }
  }
}
