import { useEffect, useMemo } from 'react'
import { evaluateParticipantForRoutes } from '@/core/atlas2026/intel-contract'
import { generateRoutePlan } from '@/services/atlas2026/routeEngine'
import { buildMemoryView } from '@/services/atlas2026/memoryService'
import { buildSituationalOverlay } from '@/services/atlas2026/situationalService'
import { buildCountyComparisonSnapshot, buildOperationsSnapshot } from '@/services/atlas2026/operationsService'
import { buildExecutionSnapshot } from '@/services/atlas2026/executionService'
import {
  buildAscentEngineSnapshot,
  buildInstitutionalEcosystemSnapshot,
  buildRenewalSnapshot
} from '@/services/atlas2026/civicBioengineeringService'
import { STEP_STATUS } from '@/services/atlas2026/stepGraph'

export function useDecisioningDerivedState({
  participants, capacityTopology, routeRecords, routeSteps, memoryEvents, renewalRoles,
  ontologyWeights, selectedParticipantId, setSelectedParticipantId, selectedCountyId,
  selectedRole, isLiveData
}) {
  const countyOptions = useMemo(() => {
    const unique = [...new Set(participants.map((participant) => participant.countyId).filter(Boolean))]
    return ['all', ...unique]
  }, [participants])
  const filteredParticipants = useMemo(
    () => selectedCountyId === 'all'
      ? participants
      : participants.filter((participant) => participant.countyId === selectedCountyId),
    [participants, selectedCountyId]
  )
  const selectedParticipant = useMemo(
    () => filteredParticipants.find((participant) => participant.participantId === selectedParticipantId)
      ?? filteredParticipants[0]
      ?? participants[0],
    [filteredParticipants, participants, selectedParticipantId]
  )
  useEffect(() => {
    if (selectedParticipant && selectedParticipant.participantId !== selectedParticipantId) {
      setSelectedParticipantId(selectedParticipant.participantId)
    }
  }, [selectedParticipant, selectedParticipantId, setSelectedParticipantId])

  const decisionPacket = useMemo(() => evaluateParticipantForRoutes({
    participantState: selectedParticipant,
    capacityTopology,
    requestedByRole: selectedRole
  }), [capacityTopology, selectedParticipant, selectedRole])
  const selectedRoutes = useMemo(
    () => routeRecords.filter((item) => item.participantId === selectedParticipant?.participantId),
    [routeRecords, selectedParticipant]
  )
  const selectedRouteSteps = useMemo(
    () => routeSteps.filter((step) => step.participantId === selectedParticipant?.participantId)
      .sort((a, b) => (a?.sequence ?? 0) - (b?.sequence ?? 0)),
    [routeSteps, selectedParticipant]
  )
  const selectedMemoryView = useMemo(
    () => buildMemoryView({ events: memoryEvents, participant: selectedParticipant, selectedRole }),
    [memoryEvents, selectedParticipant, selectedRole]
  )
  const selectedRenewalRoleRecord = useMemo(
    () => renewalRoles.find((item) => item.participantId === selectedParticipant?.participantId) || null,
    [renewalRoles, selectedParticipant]
  )
  const civicBioSnapshot = useMemo(() => {
    const scopedRoutes = routeRecords.filter((route) => route.participantId === selectedParticipant?.participantId)
    const scopedSteps = routeSteps.filter((step) => step.participantId === selectedParticipant?.participantId)
    const scopedEvents = memoryEvents.filter((event) => event.participantId === selectedParticipant?.participantId)
    return {
      ascentEngine: buildAscentEngineSnapshot({
        participant: selectedParticipant, routes: scopedRoutes, steps: scopedSteps,
        pcfRefinementWeight: ontologyWeights.pcfRefinementWeight ?? 0.6
      }),
      renewal: buildRenewalSnapshot({
        participant: selectedParticipant, routes: scopedRoutes, steps: scopedSteps, memoryEvents: scopedEvents,
        reciprocityActivationThreshold: ontologyWeights.reciprocityActivationThreshold ?? 0.6
      }),
      ecosystem: buildInstitutionalEcosystemSnapshot({ isLiveData })
    }
  }, [routeRecords, routeSteps, memoryEvents, selectedParticipant, ontologyWeights, isLiveData])
  const routePlan = useMemo(() => generateRoutePlan({
    participant: selectedParticipant,
    capacityTopology,
    activeRoutes: selectedRoutes,
    completedStepIds: selectedRouteSteps.filter((step) => step.status === STEP_STATUS.completed).map((step) => step.stepId),
    interferenceThresholds: {
      medium: ontologyWeights.interferenceMediumThreshold ?? 0.35,
      high: Math.max(ontologyWeights.interferenceHighThreshold ?? 0.6, ontologyWeights.interferenceMediumThreshold ?? 0.35)
    },
    civicDiplomacyBoost: ontologyWeights.civicDiplomacyBoost ?? 0.08
  }), [capacityTopology, selectedParticipant, selectedRoutes, selectedRouteSteps, ontologyWeights])
  const scopedParticipantIds = useMemo(
    () => new Set(filteredParticipants.map((participant) => participant.participantId)),
    [filteredParticipants]
  )
  const situationalOverlay = useMemo(() => buildSituationalOverlay({
    participants: filteredParticipants, capacityTopology,
    phaseReadinessAlertThreshold: ontologyWeights.phaseReadinessAlertThreshold ?? 0.45
  }), [filteredParticipants, capacityTopology, ontologyWeights.phaseReadinessAlertThreshold])
  const operationsSnapshot = useMemo(() => buildOperationsSnapshot({
    participants: filteredParticipants,
    routes: routeRecords.filter((route) => scopedParticipantIds.has(route.participantId)),
    steps: routeSteps.filter((step) => scopedParticipantIds.has(step.participantId)),
    memoryEvents: memoryEvents.filter((event) => scopedParticipantIds.has(event.participantId)),
    slaThresholdHours: ontologyWeights.slaThresholdHours ?? 48,
    phaseReadinessAlertThreshold: ontologyWeights.phaseReadinessAlertThreshold ?? 0.45,
    reciprocityActivationThreshold: ontologyWeights.reciprocityActivationThreshold ?? 0.6
  }), [filteredParticipants, routeRecords, routeSteps, memoryEvents, scopedParticipantIds, ontologyWeights])
  const countyComparisons = useMemo(() => buildCountyComparisonSnapshot({
    participants, routes: routeRecords, steps: routeSteps, memoryEvents,
    slaThresholdHours: ontologyWeights.slaThresholdHours ?? 48
  }), [participants, routeRecords, routeSteps, memoryEvents, ontologyWeights.slaThresholdHours])
  const executionSnapshot = useMemo(() => buildExecutionSnapshot({
    routes: routeRecords, steps: routeSteps, memoryEvents,
    participantId: selectedParticipant?.participantId,
    slaThresholdHours: ontologyWeights.slaThresholdHours ?? 48,
    selectedParticipant,
    phaseReadinessAlertThreshold: ontologyWeights.phaseReadinessAlertThreshold ?? 0.45
  }), [routeRecords, routeSteps, memoryEvents, selectedParticipant, ontologyWeights])

  return {
    countyOptions, filteredParticipants, selectedParticipant, decisionPacket, selectedRoutes,
    selectedRouteSteps, selectedMemoryView, selectedRenewalRoleRecord, civicBioSnapshot,
    routePlan, situationalOverlay, operationsSnapshot, countyComparisons, executionSnapshot
  }
}
