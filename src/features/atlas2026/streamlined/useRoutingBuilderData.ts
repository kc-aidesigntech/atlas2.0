import { useEffect, useMemo, useState } from 'react'
import type { AtlasJsonDataset, InstructionBomItem, JourneyPhase, RouteTemplate } from '@/features/atlas2026/data/contracts'
import {
  assignTemplateToParticipant,
  buildStepsFromBomIds,
  createInstructionBomItem,
  loadDataset,
  saveRouteTemplate
} from '@/features/atlas2026/data/repository'

export function useRoutingBuilderData() {
  const [dataset, setDataset] = useState<AtlasJsonDataset>({
    participants: [],
    instructionBoms: [],
    routingSteps: [],
    routeTemplates: [],
    journeyAssignments: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(dataset.participants[0]?.id || '')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(dataset.routeTemplates[0]?.id || '')

  useEffect(() => {
    let isMounted = true

    async function hydrate() {
      setIsLoading(true)
      const nextDataset = await loadDataset()
      if (!isMounted) return
      setDataset(nextDataset)
      setSelectedParticipantId((current) => current || nextDataset.participants[0]?.id || '')
      setSelectedTemplateId((current) => current || nextDataset.routeTemplates[0]?.id || '')
      setIsLoading(false)
    }

    hydrate()
    return () => {
      isMounted = false
    }
  }, [])

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
    setDataset(next)
    return next
  }

  async function addBomItem(payload: Omit<InstructionBomItem, 'id'>) {
    const next = await createInstructionBomItem(payload)
    updateDataset({ ...dataset, instructionBoms: [...dataset.instructionBoms, next] })
  }

  function previewStepsForBomIds(bomItemIds: string[]) {
    return buildStepsFromBomIds(dataset, bomItemIds)
  }

  async function createTemplate(payload: Omit<RouteTemplate, 'id'>) {
    const template = await saveRouteTemplate(payload)
    const persisted = updateDataset({ ...dataset, routeTemplates: [...dataset.routeTemplates, template] })
    setSelectedTemplateId(template.id)
    return { template, dataset: persisted }
  }

  async function assignTemplate(participantId: string, templateId: string) {
    const assignment = await assignTemplateToParticipant(dataset, participantId, templateId)
    if (!assignment) return { assignment: null, dataset }
    const nextParticipants = dataset.participants.map((participant) =>
      participant.id === participantId ? { ...participant, activeJourneyId: assignment.id } : participant
    )
    const persisted = updateDataset({
      ...dataset,
      participants: nextParticipants,
      journeyAssignments: [assignment, ...dataset.journeyAssignments]
    })
    return { assignment, dataset: persisted }
  }

  async function buildTemplateFromBom(input: { name: string; description: string; targetPhase: JourneyPhase; bomItemIds: string[] }) {
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
    isLoading,
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
