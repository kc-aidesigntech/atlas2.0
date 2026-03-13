import { useMemo, useState } from 'react'
import type { AtlasJsonDataset, InstructionBomItem, JourneyPhase, RouteTemplate } from '@/features/atlas2026/data/contracts'
import {
  assignTemplateToParticipant,
  buildStepsFromBomIds,
  createInstructionBomItem,
  loadDataset,
  saveDataset,
  saveRouteTemplate
} from '@/features/atlas2026/data/repository'

export function useRoutingBuilderData() {
  const [dataset, setDataset] = useState<AtlasJsonDataset>(() => loadDataset())
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(dataset.participants[0]?.id || '')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(dataset.routeTemplates[0]?.id || '')

  const selectedParticipant = useMemo(
    () => dataset.participants.find((item) => item.id === selectedParticipantId) || null,
    [dataset.participants, selectedParticipantId]
  )

  const selectedTemplate = useMemo(
    () => dataset.routeTemplates.find((item) => item.id === selectedTemplateId) || null,
    [dataset.routeTemplates, selectedTemplateId]
  )

  const selectedJourney = useMemo(() => {
    if (!selectedParticipant?.activeJourneyId) return null
    return dataset.journeyAssignments.find((item) => item.id === selectedParticipant.activeJourneyId) || null
  }, [dataset.journeyAssignments, selectedParticipant])

  const selectedJourneySteps = useMemo(() => {
    if (!selectedJourney) return []
    return selectedJourney.stepIds
      .map((stepId) => dataset.routingSteps.find((step) => step.id === stepId))
      .filter((step): step is NonNullable<typeof step> => Boolean(step))
  }, [dataset.routingSteps, selectedJourney])

  const metrics = useMemo(() => {
    const activeJourneys = dataset.journeyAssignments.filter((item) => item.status === 'active').length
    const averageReadiness =
      dataset.participants.length === 0
        ? 0
        : dataset.participants.reduce((sum, participant) => sum + participant.readinessScore, 0) / dataset.participants.length
    const renewalReady = dataset.participants.filter((item) => item.currentPhase === 'renewal').length
    return {
      activeJourneys,
      averageReadiness,
      renewalReady
    }
  }, [dataset])

  function updateDataset(next: AtlasJsonDataset) {
    const persisted = saveDataset(next)
    setDataset(persisted)
    return persisted
  }

  function addBomItem(payload: Omit<InstructionBomItem, 'id'>) {
    const next = createInstructionBomItem(dataset, payload)
    updateDataset(next)
  }

  function previewStepsForBomIds(bomItemIds: string[]) {
    return buildStepsFromBomIds(dataset, bomItemIds)
  }

  function createTemplate(payload: Omit<RouteTemplate, 'id'>) {
    const result = saveRouteTemplate(dataset, payload)
    const persisted = updateDataset(result.dataset)
    setSelectedTemplateId(result.template.id)
    return { ...result, dataset: persisted }
  }

  function assignTemplate(participantId: string, templateId: string) {
    const result = assignTemplateToParticipant(dataset, participantId, templateId)
    const persisted = updateDataset(result.dataset)
    return { ...result, dataset: persisted }
  }

  function buildTemplateFromBom(input: { name: string; description: string; targetPhase: JourneyPhase; bomItemIds: string[] }) {
    const stepIds = previewStepsForBomIds(input.bomItemIds).map((step) => step.id)
    return createTemplate({
      name: input.name,
      description: input.description,
      targetPhase: input.targetPhase,
      bomItemIds: input.bomItemIds,
      stepIds,
      isCore: false
    })
  }

  return {
    dataset,
    selectedParticipantId,
    setSelectedParticipantId,
    selectedParticipant,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedTemplate,
    selectedJourney,
    selectedJourneySteps,
    metrics,
    addBomItem,
    previewStepsForBomIds,
    buildTemplateFromBom,
    assignTemplate
  }
}
