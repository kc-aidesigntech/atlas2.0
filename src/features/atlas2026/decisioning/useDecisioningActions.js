import { useState } from 'react'
import { MEMORY_EVENT_TYPES, ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'
import { canRolePerform } from '@/core/atlas2026/policy'
import {
  createMemoryEvent, createOntologyAuditRecord, createRouteRecord, createRouteStepRecord,
  saveOntologyWeightsRecord, saveRenewalRoleRecord, updateRouteRecord, updateRouteStepRecord
} from '@/services/atlas2026/contractGateway'
import { buildRouteSteps, canTransitionStep, deriveRouteLifecycleFromSteps, STEP_STATUS } from '@/services/atlas2026/stepGraph'

function createOptimisticId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useDecisioningActions(context) {
  const {
    selectedParticipant, selectedRole, dbContext, routePlan, routeSteps, civicBioSnapshot,
    ontologyWeights, renewalRoles, setRouteRecords, setRouteSteps, setMemoryEvents,
    setRenewalRoles, setOntologyWeights
  } = context
  const [actionError, setActionError] = useState(null)
  const [savingRoute, setSavingRoute] = useState(false)
  const [updatingRoute, setUpdatingRoute] = useState(false)
  const [updatingStep, setUpdatingStep] = useState(false)
  const [savingMemoryEvent, setSavingMemoryEvent] = useState(false)
  const [assigningRenewalRole, setAssigningRenewalRole] = useState(false)

  function requireLive(actionLabel) {
    if (!dbContext?.db || !dbContext?.appId) {
      setActionError(`Live datastore is not connected; ${actionLabel} skipped.`)
      return false
    }
    return true
  }

  async function activateRecommendedRoute() {
    setActionError(null)
    if (!selectedParticipant || !routePlan.recommendedRouteId) {
      setActionError('No participant or recommended route is available.')
      return false
    }
    if (!canRolePerform(selectedRole, 'activateRoute')) {
      setActionError(`Role "${selectedRole}" cannot activate routes.`)
      return false
    }
    if (!requireLive('route activation')) return false
    const chosenRoute = routePlan.routes.find((item) => item.routeId === routePlan.recommendedRouteId)
    if (!chosenRoute) {
      setActionError('Recommended route payload is unavailable.')
      return false
    }
    try {
      setSavingRoute(true)
      // Optimistic records keep operator workflows responsive and are removed on failure.
      const common = {
        participantId: selectedParticipant.participantId,
        activatedByRole: selectedRole,
        activatedByUserId: dbContext.userId
      }
      const optimisticRoute = {
        id: createOptimisticId('optimistic-route'), ...common,
        routeId: chosenRoute.routeId, partnerId: chosenRoute.partnerId,
        routeClass: chosenRoute.routeClass || 'stabilization', status: ROUTE_LIFECYCLE.active,
        score: chosenRoute.score, interferenceRisk: chosenRoute.interferenceRisk,
        transferCost: chosenRoute.transferCost, createdAt: { seconds: Math.floor(Date.now() / 1000) }, optimistic: true
      }
      const memoryPayload = {
        participantId: selectedParticipant.participantId,
        eventType: MEMORY_EVENT_TYPES.routeActivated,
        phase: selectedParticipant.currentPhase,
        label: `Route ${chosenRoute.routeId} activated via ${chosenRoute.partnerId}`,
        verified: true, createdByRole: selectedRole, createdByUserId: dbContext.userId
      }
      setRouteRecords((current) => [optimisticRoute, ...current])
      setMemoryEvents((current) => [{
        id: createOptimisticId('optimistic-memory'), ...memoryPayload,
        createdAt: { seconds: Math.floor(Date.now() / 1000) }, optimistic: true
      }, ...current])
      const routeDoc = await createRouteRecord({
        db: dbContext.db, appId: dbContext.appId,
        payload: {
          ...common, routeId: chosenRoute.routeId, partnerId: chosenRoute.partnerId,
          routeClass: chosenRoute.routeClass || 'stabilization', status: ROUTE_LIFECYCLE.active,
          score: chosenRoute.score, interferenceRisk: chosenRoute.interferenceRisk, transferCost: chosenRoute.transferCost
        }
      })
      await Promise.all(buildRouteSteps(chosenRoute).map((step, index) => createRouteStepRecord({
        db: dbContext.db, appId: dbContext.appId,
        payload: {
          routeDocId: routeDoc.id, routeId: chosenRoute.routeId,
          participantId: selectedParticipant.participantId, partnerId: chosenRoute.partnerId,
          stepId: step.stepId, label: step.label, status: step.status,
          dependencies: step.dependencies, domain: step.domain, sequence: index + 1
        }
      })))
      await createMemoryEvent({ db: dbContext.db, appId: dbContext.appId, payload: memoryPayload })
      return true
    } catch (error) {
      setRouteRecords((current) => current.filter((item) => !item.optimistic))
      setMemoryEvents((current) => current.filter((item) => !item.optimistic))
      setActionError(`Route activation failed: ${error.message}`)
      return false
    } finally {
      setSavingRoute(false)
    }
  }

  async function appendMemoryEvent({ label, verified = true, eventType = MEMORY_EVENT_TYPES.milestoneVerified } = {}) {
    setActionError(null)
    if (!selectedParticipant) {
      setActionError('No participant selected.')
      return false
    }
    if (!canRolePerform(selectedRole, 'appendMemoryEvent')) {
      setActionError(`Role "${selectedRole}" cannot append memory events.`)
      return false
    }
    if (!requireLive('memory event')) return false
    const payload = {
      participantId: selectedParticipant.participantId, eventType, phase: selectedParticipant.currentPhase,
      label: label || 'Milestone verified by station operator.', verified,
      createdByRole: selectedRole, createdByUserId: dbContext.userId
    }
    try {
      setSavingMemoryEvent(true)
      setMemoryEvents((current) => [{
        id: createOptimisticId('optimistic-memory'), ...payload,
        createdAt: { seconds: Math.floor(Date.now() / 1000) }, optimistic: true
      }, ...current])
      await createMemoryEvent({ db: dbContext.db, appId: dbContext.appId, payload })
      return true
    } catch (error) {
      setMemoryEvents((current) => current.filter((item) => !item.optimistic))
      setActionError(`Memory event write failed: ${error.message}`)
      return false
    } finally {
      setSavingMemoryEvent(false)
    }
  }

  async function transitionRouteStatus({ routeDocId, nextStatus, reason }) {
    setActionError(null)
    if (!routeDocId || !nextStatus) {
      setActionError('Route transition payload is incomplete.')
      return false
    }
    if (!canRolePerform(selectedRole, 'transitionRoute')) {
      setActionError(`Role "${selectedRole}" cannot transition route status.`)
      return false
    }
    if (!requireLive('route transition')) return false
    if (![ROUTE_LIFECYCLE.active, ROUTE_LIFECYCLE.blocked, ROUTE_LIFECYCLE.completed].includes(nextStatus)) {
      setActionError(`Unsupported route status: ${nextStatus}`)
      return false
    }
    try {
      setUpdatingRoute(true)
      setRouteRecords((current) => current.map((route) =>
        route.id === routeDocId ? { ...route, status: nextStatus, optimistic: true } : route
      ))
      await updateRouteRecord({
        db: dbContext.db, appId: dbContext.appId, routeDocId,
        payload: { status: nextStatus, updatedByRole: selectedRole, updatedByUserId: dbContext.userId, transitionReason: reason || null }
      })
      const eventType = nextStatus === ROUTE_LIFECYCLE.completed
        ? MEMORY_EVENT_TYPES.milestoneVerified
        : nextStatus === ROUTE_LIFECYCLE.blocked ? MEMORY_EVENT_TYPES.blockerDetected : MEMORY_EVENT_TYPES.routeActivated
      await createMemoryEvent({
        db: dbContext.db, appId: dbContext.appId,
        payload: {
          participantId: selectedParticipant.participantId, eventType, phase: selectedParticipant.currentPhase,
          label: `Route ${routeDocId} transitioned to ${nextStatus}${reason ? `: ${reason}` : ''}`,
          verified: nextStatus !== ROUTE_LIFECYCLE.blocked, createdByRole: selectedRole, createdByUserId: dbContext.userId
        }
      })
      return true
    } catch (error) {
      setActionError(`Route transition failed: ${error.message}`)
      return false
    } finally {
      setUpdatingRoute(false)
    }
  }

  async function transitionRouteStepStatus({ stepDocId, nextStatus }) {
    setActionError(null)
    if (!stepDocId || !nextStatus) {
      setActionError('Step transition payload is incomplete.')
      return false
    }
    if (!canRolePerform(selectedRole, 'transitionRoute')) {
      setActionError(`Role "${selectedRole}" cannot transition route steps.`)
      return false
    }
    if (!requireLive('step transition')) return false
    const step = routeSteps.find((item) => item.id === stepDocId)
    if (!step) {
      setActionError('Step record not found.')
      return false
    }
    const peerSteps = routeSteps.filter((item) => item.routeDocId === step.routeDocId)
    const gate = canTransitionStep(step, nextStatus, peerSteps)
    if (!gate.allowed) {
      setActionError(gate.reason)
      return false
    }
    try {
      setUpdatingStep(true)
      setRouteSteps((current) => current.map((item) =>
        item.id === stepDocId ? { ...item, status: nextStatus, optimistic: true } : item
      ))
      await updateRouteStepRecord({
        db: dbContext.db, appId: dbContext.appId, stepDocId,
        payload: { status: nextStatus, updatedByRole: selectedRole, updatedByUserId: dbContext.userId }
      })
      const updatedSteps = peerSteps.map((item) => item.id === stepDocId ? { ...item, status: nextStatus } : item)
      await updateRouteRecord({
        db: dbContext.db, appId: dbContext.appId, routeDocId: step.routeDocId,
        payload: { status: deriveRouteLifecycleFromSteps(updatedSteps), updatedByRole: selectedRole, updatedByUserId: dbContext.userId }
      })
      await createMemoryEvent({
        db: dbContext.db, appId: dbContext.appId,
        payload: {
          participantId: step.participantId,
          eventType: nextStatus === STEP_STATUS.blocked ? MEMORY_EVENT_TYPES.blockerDetected : MEMORY_EVENT_TYPES.milestoneVerified,
          phase: selectedParticipant.currentPhase, label: `Step ${step.stepId} transitioned to ${nextStatus}`,
          verified: nextStatus !== STEP_STATUS.blocked, createdByRole: selectedRole, createdByUserId: dbContext.userId
        }
      })
      return true
    } catch (error) {
      setActionError(`Step transition failed: ${error.message}`)
      return false
    } finally {
      setUpdatingStep(false)
    }
  }

  async function assignRenewalRole({ roleName, contributionDomain, notes }) {
    setActionError(null)
    if (!selectedParticipant || !roleName) {
      setActionError(selectedParticipant ? 'Renewal role is required.' : 'No participant selected for renewal role assignment.')
      return false
    }
    if (!canRolePerform(selectedRole, 'assignRenewalRole')) {
      setActionError(`Role "${selectedRole}" cannot assign renewal roles.`)
      return false
    }
    if (!requireLive('renewal role assignment')) return false
    const reciprocityIndex = civicBioSnapshot.renewal.reciprocityIndex ?? 0
    const threshold = ontologyWeights.reciprocityActivationThreshold ?? 0.6
    if (reciprocityIndex < threshold && selectedRole !== 'governanceAdmin') {
      setActionError('Reciprocity index is below activation threshold; escalate to governance or continue renewal progress.')
      return false
    }
    const previous = renewalRoles
    const domain = contributionDomain || 'community-care'
    const status = reciprocityIndex >= threshold ? 'active' : 'provisional'
    const optimistic = {
      id: selectedParticipant.participantId, participantId: selectedParticipant.participantId,
      roleName, contributionDomain: domain, status, notes: notes || '',
      assignedByRole: selectedRole, assignedByUserId: dbContext.userId,
      updatedAt: { seconds: Math.floor(Date.now() / 1000) }, optimistic: true
    }
    try {
      setAssigningRenewalRole(true)
      setRenewalRoles((current) => [optimistic, ...current.filter((item) => item.participantId !== selectedParticipant.participantId)])
      await saveRenewalRoleRecord({
        db: dbContext.db, appId: dbContext.appId, participantId: selectedParticipant.participantId,
        payload: { roleName, contributionDomain: domain, status, notes: notes || '', assignedByRole: selectedRole, assignedByUserId: dbContext.userId, reciprocityIndex, activationThreshold: threshold }
      })
      await createMemoryEvent({
        db: dbContext.db, appId: dbContext.appId,
        payload: {
          participantId: selectedParticipant.participantId, eventType: MEMORY_EVENT_TYPES.milestoneVerified,
          phase: 'Renewal', label: `Renewal role assigned: ${roleName} (${domain})`,
          verified: true, createdByRole: selectedRole, createdByUserId: dbContext.userId
        }
      })
      return true
    } catch (error) {
      setRenewalRoles(previous)
      setActionError(`Renewal role assignment failed: ${error.message}`)
      return false
    } finally {
      setAssigningRenewalRole(false)
    }
  }

  async function saveOntologyWeights(nextWeights) {
    setActionError(null)
    if (!canRolePerform(selectedRole, 'manageOntology')) {
      setActionError(`Role "${selectedRole}" cannot modify ontology weights.`)
      return false
    }
    if (!requireLive('ontology update')) return false
    try {
      setOntologyWeights((current) => ({ ...current, ...nextWeights }))
      const audit = { ...nextWeights, updatedByRole: selectedRole, updatedByUserId: dbContext.userId }
      await saveOntologyWeightsRecord({ db: dbContext.db, appId: dbContext.appId, payload: audit })
      await createOntologyAuditRecord({
        db: dbContext.db, appId: dbContext.appId,
        payload: { kind: 'weightsUpdate', weights: nextWeights, updatedByRole: selectedRole, updatedByUserId: dbContext.userId }
      })
      return true
    } catch (error) {
      setActionError(`Ontology update failed: ${error.message}`)
      return false
    }
  }

  return {
    activateRecommendedRoute, appendMemoryEvent, transitionRouteStatus, transitionRouteStepStatus,
    assignRenewalRole, saveOntologyWeights, setActionError, actionError, savingRoute,
    updatingRoute, updatingStep, savingMemoryEvent, assigningRenewalRole
  }
}
