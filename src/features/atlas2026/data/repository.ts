/**
 * Route-builder repository facade for feature code. It wraps shared Supabase
 * APIs and provides safe fallbacks when no client is configured.
 */
import {
  assignRouteBuilderTemplate,
  createRouteBuilderBomItem as createRouteBuilderBomItemRecord,
  createRouteBuilderTemplate as createRouteBuilderTemplateRecord,
  fetchRouteBuilderDataset,
} from '@atlas/shared'
import type { AtlasJsonDataset, InstructionBomItem, JourneyAssignment, RouteTemplate, RoutingStep } from '@/features/atlas2026/data/contracts'
import { supabase } from '@/lib/supabaseClient'

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Dataset loading always returns a complete contract shape so selectors and
// UIs can avoid null-check branching in disconnected environments.
export async function loadDataset(): Promise<AtlasJsonDataset> {
  if (!supabase) {
    return {
      participants: [],
      instructionBoms: [],
      routingSteps: [],
      routeTemplates: [],
      journeyAssignments: []
    }
  }
  return fetchRouteBuilderDataset(supabase)
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

export async function createInstructionBomItem(payload: Omit<InstructionBomItem, 'id'>): Promise<InstructionBomItem> {
  const next: InstructionBomItem = { id: createId('bom'), ...payload }
  if (!supabase) return next
  await createRouteBuilderBomItemRecord(supabase, next)
  return next
}

export function buildStepsFromBomIds(dataset: AtlasJsonDataset, bomItemIds: string[]): RoutingStep[] {
  return dataset.routingSteps
    .filter((step) => bomItemIds.includes(step.bomItemId))
    .sort((a, b) => a.sequence - b.sequence)
}

export async function saveRouteTemplate(
  payload: Omit<RouteTemplate, 'id'>
): Promise<RouteTemplate> {
  const template: RouteTemplate = { id: createId('template'), ...payload }
  if (!supabase) return template
  await createRouteBuilderTemplateRecord(supabase, template)
  return template
}

export async function assignTemplateToParticipant(
  dataset: AtlasJsonDataset,
  participantId: string,
  templateId: string
): Promise<JourneyAssignment | null> {
  // Template lookup is the invariant guard; callers only get assignments when
  // the chosen template still exists in current dataset state.
  const template = dataset.routeTemplates.find((item) => item.id === templateId)
  if (!template) return null

  const assignment: JourneyAssignment = {
    id: createId('journey'),
    participantId,
    templateId,
    stepIds: template.stepIds,
    status: 'active',
    currentStepIndex: 0,
    startedAt: new Date().toISOString()
  }

  if (supabase) {
    await assignRouteBuilderTemplate(supabase, assignment)
  }

  return assignment
}
