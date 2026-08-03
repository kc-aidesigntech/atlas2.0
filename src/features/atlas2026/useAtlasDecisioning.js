import { useEffect, useState } from 'react'
import { useLegacyAtlasState } from './decisioning/useLegacyAtlasState'
import { useDecisioningDerivedState } from './decisioning/useDecisioningDerivedState'
import { useDecisioningActions } from './decisioning/useDecisioningActions'

/**
 * Legacy Atlas (ATLAS) decisioning orchestrator.
 *
 * Keeps the public hook contract stable while hydration, derivation, and mutations
 * remain independently maintainable.
 */
export function useAtlasDecisioning() {
  const state = useLegacyAtlasState()
  const [selectedCountyId, setSelectedCountyId] = useState('all')
  const [selectedRole, setSelectedRole] = useState('peerNavigator')

  const derived = useDecisioningDerivedState({
    ...state,
    selectedCountyId,
    selectedRole
  })
  const actions = useDecisioningActions({
    ...state,
    ...derived,
    selectedRole
  })

  useEffect(() => {
    actions.setActionError(null)
  }, [state.selectedParticipantId, selectedRole, selectedCountyId])

  return {
    selectedRole,
    setSelectedRole,
    selectedCountyId,
    setSelectedCountyId,
    countyOptions: derived.countyOptions,
    selectedParticipant: derived.selectedParticipant,
    selectedParticipantId: state.selectedParticipantId,
    setSelectedParticipantId: state.setSelectedParticipantId,
    participants: derived.filteredParticipants,
    capacityTopology: state.capacityTopology,
    decisionPacket: derived.decisionPacket,
    civicBioSnapshot: derived.civicBioSnapshot,
    routePlan: derived.routePlan,
    selectedRoutes: derived.selectedRoutes,
    selectedRouteSteps: derived.selectedRouteSteps,
    selectedMemoryView: derived.selectedMemoryView,
    selectedRenewalRoleRecord: derived.selectedRenewalRoleRecord,
    situationalOverlay: derived.situationalOverlay,
    operationsSnapshot: derived.operationsSnapshot,
    countyComparisons: derived.countyComparisons,
    executionSnapshot: derived.executionSnapshot,
    ontologyWeights: state.ontologyWeights,
    ontologyAudit: state.ontologyAudit,
    activateRecommendedRoute: actions.activateRecommendedRoute,
    transitionRouteStatus: actions.transitionRouteStatus,
    transitionRouteStepStatus: actions.transitionRouteStepStatus,
    appendMemoryEvent: actions.appendMemoryEvent,
    assignRenewalRole: actions.assignRenewalRole,
    saveOntologyWeights: actions.saveOntologyWeights,
    actionError: actions.actionError,
    savingRoute: actions.savingRoute,
    updatingRoute: actions.updatingRoute,
    updatingStep: actions.updatingStep,
    savingMemoryEvent: actions.savingMemoryEvent,
    assigningRenewalRole: actions.assigningRenewalRole,
    isLiveData: state.isLiveData,
    loadingLiveData: state.loadingLiveData,
    loadError: state.loadError
  }
}
