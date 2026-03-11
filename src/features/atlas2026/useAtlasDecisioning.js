import { useEffect, useMemo, useState } from 'react'
import { getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth'
import { collection, getFirestore, onSnapshot } from 'firebase/firestore'
import { evaluateParticipantForRoutes } from '@/core/atlas2026/intel-contract'
import { createParticipantState, MEMORY_EVENT_TYPES, ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'
import { canRolePerform } from '@/core/atlas2026/policy'
import { DEMO_CAPACITY_TOPOLOGY, DEMO_PARTICIPANTS } from './sample-data'
import { generateRoutePlan } from '@/services/atlas2026/route-engine'
import { buildMemoryView } from '@/services/atlas2026/memory-service'
import { buildSituationalOverlay } from '@/services/atlas2026/situational-service'
import { buildCountyComparisonSnapshot, buildOperationsSnapshot } from '@/services/atlas2026/operations-service'
import { buildExecutionSnapshot } from '@/services/atlas2026/execution-service'
import {
  buildAscentEngineSnapshot,
  buildInstitutionalEcosystemSnapshot,
  buildRenewalSnapshot
} from '@/services/atlas2026/civic-bioengineering-service'
import {
  createMemoryEvent,
  createOntologyAuditRecord,
  createRouteRecord,
  createRouteStepRecord,
  saveOntologyWeightsRecord,
  saveRenewalRoleRecord,
  updateRouteStepRecord,
  updateRouteRecord
} from '@/services/atlas2026/contract-gateway'
import { buildRouteSteps, canTransitionStep, deriveRouteLifecycleFromSteps, STEP_STATUS } from '@/services/atlas2026/step-graph'

function normalizeParticipant(docId, raw) {
  return createParticipantState({
    ...raw,
    participantId: raw?.participantId ?? docId
  })
}

function normalizeCapacityNode(docId, raw) {
  const phaseIndex = raw?.phaseIndex ?? 0
  return {
    partnerId: raw?.partnerId ?? docId,
    label: raw?.label ?? raw?.partnerId ?? docId,
    routeClass: raw?.routeClass ?? (phaseIndex >= 2 ? 'civicDiplomacy' : phaseIndex >= 1 ? 'readiness' : 'stabilization'),
    coverageScore: raw?.coverageScore ?? 0.65,
    phaseAlignment: raw?.phaseAlignment ?? 0.7,
    specializationScore: raw?.specializationScore ?? 0.7,
    reversibilitySupport: raw?.reversibilitySupport ?? 0.65,
    transferCost: raw?.transferCost ?? 0.25,
    interferenceRisk: raw?.interferenceRisk ?? 0.2,
    phaseIndex,
    blockers: Array.isArray(raw?.blockers) ? raw.blockers : []
  }
}

function resolveFirebaseConfig() {
  if (typeof window === 'undefined') return null
  return (
    window.__firebase_config || {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    }
  )
}

function resolveAppId() {
  if (typeof window === 'undefined') return import.meta.env.VITE_APP_ID || 'demo-app'
  return window.__app_id || import.meta.env.VITE_APP_ID || 'demo-app'
}

function createOptimisticId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAtlasDecisioning() {
  const [participants, setParticipants] = useState(DEMO_PARTICIPANTS)
  const [capacityTopology, setCapacityTopology] = useState(DEMO_CAPACITY_TOPOLOGY)
  const [routeRecords, setRouteRecords] = useState([])
  const [routeSteps, setRouteSteps] = useState([])
  const [memoryEvents, setMemoryEvents] = useState([])
  const [ontologyAudit, setOntologyAudit] = useState([])
  const [renewalRoles, setRenewalRoles] = useState([])
  const [ontologyWeights, setOntologyWeights] = useState({
    coverageWeight: 0.3,
    phaseAlignmentWeight: 0.2,
    specializationWeight: 0.2,
    reversibilityWeight: 0.15,
    transferCostPenalty: 0.1,
    interferencePenalty: 0.05,
    civicDiplomacyBoost: 0.08,
    slaThresholdHours: 48,
    interferenceMediumThreshold: 0.35,
    interferenceHighThreshold: 0.6,
    phaseReadinessAlertThreshold: 0.45,
    pcfRefinementWeight: 0.6,
    reciprocityActivationThreshold: 0.6
  })
  const [selectedParticipantId, setSelectedParticipantId] = useState(DEMO_PARTICIPANTS[0].participantId)
  const [selectedCountyId, setSelectedCountyId] = useState('all')
  const [selectedRole, setSelectedRole] = useState('peerNavigator')
  const [loadingLiveData, setLoadingLiveData] = useState(true)
  const [isLiveData, setIsLiveData] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [savingRoute, setSavingRoute] = useState(false)
  const [updatingRoute, setUpdatingRoute] = useState(false)
  const [updatingStep, setUpdatingStep] = useState(false)
  const [savingMemoryEvent, setSavingMemoryEvent] = useState(false)
  const [assigningRenewalRole, setAssigningRenewalRole] = useState(false)
  const [dbContext, setDbContext] = useState(null)

  useEffect(() => {
    setActionError(null)
  }, [selectedParticipantId, selectedRole, selectedCountyId])

  useEffect(() => {
    const firebaseConfig = resolveFirebaseConfig()
    const hasConfig = firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey

    if (!hasConfig) {
      setLoadingLiveData(false)
      setIsLiveData(false)
      setLoadError('Firebase configuration not found; using demo topology.')
      return
    }

    const app = getApps()[0] || initializeApp(firebaseConfig)
    const auth = getAuth(app)
    const db = getFirestore(app)
    const appId = resolveAppId()

    let unsubscribeParticipants = null
    let unsubscribeCapacity = null
    let unsubscribeRoutes = null
    let unsubscribeRouteSteps = null
    let unsubscribeMemoryEvents = null
    let unsubscribeOntology = null
    let unsubscribeOntologyAudit = null
    let unsubscribeRenewalRoles = null

    const cleanupSnapshots = () => {
      if (unsubscribeParticipants) unsubscribeParticipants()
      if (unsubscribeCapacity) unsubscribeCapacity()
      if (unsubscribeRoutes) unsubscribeRoutes()
      if (unsubscribeRouteSteps) unsubscribeRouteSteps()
      if (unsubscribeMemoryEvents) unsubscribeMemoryEvents()
      if (unsubscribeOntology) unsubscribeOntology()
      if (unsubscribeOntologyAudit) unsubscribeOntologyAudit()
      if (unsubscribeRenewalRoles) unsubscribeRenewalRoles()
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      cleanupSnapshots()
      setLoadingLiveData(true)

      if (!user) {
        try {
          if (window.__initial_auth_token) {
            await signInWithCustomToken(auth, window.__initial_auth_token)
          } else {
            await signInAnonymously(auth)
          }
        } catch (error) {
          setLoadError(`Authentication failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
        return
      }

      const participantsPath = collection(db, `artifacts/${appId}/atlas2026/participants`)
      const capacityPath = collection(db, `artifacts/${appId}/atlas2026/capacityTopology`)
      const routesPath = collection(db, `artifacts/${appId}/atlas2026/routes`)
      const routeStepsPath = collection(db, `artifacts/${appId}/atlas2026/routeSteps`)
      const memoryEventsPath = collection(db, `artifacts/${appId}/atlas2026/memoryEvents`)
      const ontologyPath = collection(db, `artifacts/${appId}/atlas2026/ontology`)
      const ontologyAuditPath = collection(db, `artifacts/${appId}/atlas2026/ontologyAudit`)
      const renewalRolesPath = collection(db, `artifacts/${appId}/atlas2026/renewalRoles`)
      let participantsReady = false
      let capacityReady = false
      let routesReady = false
      let routeStepsReady = false
      let memoryReady = false
      let ontologyReady = false
      let ontologyAuditReady = false
      let renewalRolesReady = false
      setDbContext({ db, appId, userId: user.uid })

      unsubscribeParticipants = onSnapshot(
        participantsPath,
        (snapshot) => {
          const nextParticipants = snapshot.docs.map((item) => normalizeParticipant(item.id, item.data()))
          if (nextParticipants.length > 0) {
            setParticipants(nextParticipants)
            setSelectedParticipantId((current) =>
              nextParticipants.some((item) => item.participantId === current) ? current : nextParticipants[0].participantId
            )
          }
          participantsReady = true
          if (
            participantsReady &&
            capacityReady &&
            routesReady &&
            routeStepsReady &&
            memoryReady &&
            ontologyReady &&
            ontologyAuditReady &&
            renewalRolesReady
          ) {
            setIsLiveData((current) => current || snapshot.size > 0)
            setLoadError(null)
            setLoadingLiveData(false)
          }
        },
        (error) => {
          setLoadError(`Participants subscription failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
      )

      unsubscribeCapacity = onSnapshot(
        capacityPath,
        (snapshot) => {
          const nextCapacity = snapshot.docs.map((item) => normalizeCapacityNode(item.id, item.data()))
          if (nextCapacity.length > 0) {
            setCapacityTopology(nextCapacity)
          }
          capacityReady = true
          if (
            participantsReady &&
            capacityReady &&
            routesReady &&
            routeStepsReady &&
            memoryReady &&
            ontologyReady &&
            ontologyAuditReady &&
            renewalRolesReady
          ) {
            setIsLiveData(snapshot.size > 0)
            setLoadError(null)
            setLoadingLiveData(false)
          }
        },
        (error) => {
          setLoadError(`Capacity subscription failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
      )

      unsubscribeRoutes = onSnapshot(
        routesPath,
        (snapshot) => {
          setRouteRecords(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data()
            }))
          )
          routesReady = true
          if (
            participantsReady &&
            capacityReady &&
            routesReady &&
            routeStepsReady &&
            memoryReady &&
            ontologyReady &&
            ontologyAuditReady &&
            renewalRolesReady
          ) {
            setIsLiveData(snapshot.size > 0)
            setLoadError(null)
            setLoadingLiveData(false)
          }
        },
        (error) => {
          setLoadError(`Routes subscription failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
      )

      unsubscribeRouteSteps = onSnapshot(
        routeStepsPath,
        (snapshot) => {
          setRouteSteps(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data()
            }))
          )
          routeStepsReady = true
          if (
            participantsReady &&
            capacityReady &&
            routesReady &&
            routeStepsReady &&
            memoryReady &&
            ontologyReady &&
            ontologyAuditReady &&
            renewalRolesReady
          ) {
            setIsLiveData(snapshot.size > 0)
            setLoadError(null)
            setLoadingLiveData(false)
          }
        },
        (error) => {
          setLoadError(`Route steps subscription failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
      )

      unsubscribeMemoryEvents = onSnapshot(
        memoryEventsPath,
        (snapshot) => {
          setMemoryEvents(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data()
            }))
          )
          memoryReady = true
          if (
            participantsReady &&
            capacityReady &&
            routesReady &&
            routeStepsReady &&
            memoryReady &&
            ontologyReady &&
            ontologyAuditReady &&
            renewalRolesReady
          ) {
            setIsLiveData(snapshot.size > 0)
            setLoadError(null)
            setLoadingLiveData(false)
          }
        },
        (error) => {
          setLoadError(`Memory events subscription failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
      )

      unsubscribeOntology = onSnapshot(
        ontologyPath,
        (snapshot) => {
          const weightsDoc = snapshot.docs.find((doc) => doc.id === 'weights')
          if (weightsDoc) {
            setOntologyWeights((current) => ({
              ...current,
              ...weightsDoc.data()
            }))
          }
          ontologyReady = true
          if (
            participantsReady &&
            capacityReady &&
            routesReady &&
            routeStepsReady &&
            memoryReady &&
            ontologyReady &&
            ontologyAuditReady &&
            renewalRolesReady
          ) {
            setIsLiveData(snapshot.size > 0)
            setLoadError(null)
            setLoadingLiveData(false)
          }
        },
        (error) => {
          setLoadError(`Ontology subscription failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
      )

      unsubscribeOntologyAudit = onSnapshot(
        ontologyAuditPath,
        (snapshot) => {
          setOntologyAudit(
            snapshot.docs
              .map((item) => ({ id: item.id, ...item.data() }))
              .sort((a, b) => (b?.updatedAt?.seconds ?? 0) - (a?.updatedAt?.seconds ?? 0))
          )
          ontologyAuditReady = true
          if (
            participantsReady &&
            capacityReady &&
            routesReady &&
            routeStepsReady &&
            memoryReady &&
            ontologyReady &&
            ontologyAuditReady &&
            renewalRolesReady
          ) {
            setIsLiveData(snapshot.size > 0)
            setLoadError(null)
            setLoadingLiveData(false)
          }
        },
        (error) => {
          setLoadError(`Ontology audit subscription failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
      )

      unsubscribeRenewalRoles = onSnapshot(
        renewalRolesPath,
        (snapshot) => {
          setRenewalRoles(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
          renewalRolesReady = true
          if (
            participantsReady &&
            capacityReady &&
            routesReady &&
            routeStepsReady &&
            memoryReady &&
            ontologyReady &&
            ontologyAuditReady &&
            renewalRolesReady
          ) {
            setIsLiveData(snapshot.size > 0)
            setLoadError(null)
            setLoadingLiveData(false)
          }
        },
        (error) => {
          setLoadError(`Renewal roles subscription failed: ${error.message}`)
          setIsLiveData(false)
          setLoadingLiveData(false)
        }
      )
    })

    return () => {
      cleanupSnapshots()
      unsubscribeAuth()
    }
  }, [])

  const countyOptions = useMemo(() => {
    const unique = [...new Set(participants.map((participant) => participant.countyId).filter(Boolean))]
    return ['all', ...unique]
  }, [participants])

  const filteredParticipants = useMemo(
    () => (selectedCountyId === 'all' ? participants : participants.filter((participant) => participant.countyId === selectedCountyId)),
    [participants, selectedCountyId]
  )

  const selectedParticipant = useMemo(
    () =>
      filteredParticipants.find((participant) => participant.participantId === selectedParticipantId) ??
      filteredParticipants[0] ??
      participants[0],
    [filteredParticipants, participants, selectedParticipantId]
  )

  useEffect(() => {
    if (!selectedParticipant) return
    if (selectedParticipant.participantId !== selectedParticipantId) {
      setSelectedParticipantId(selectedParticipant.participantId)
    }
  }, [selectedParticipant, selectedParticipantId])

  const decisionPacket = useMemo(
    () =>
      evaluateParticipantForRoutes({
        participantState: selectedParticipant,
        capacityTopology,
        requestedByRole: selectedRole
      }),
    [capacityTopology, selectedParticipant, selectedRole]
  )

  const selectedRoutes = useMemo(
    () => routeRecords.filter((item) => item.participantId === selectedParticipant?.participantId),
    [routeRecords, selectedParticipant]
  )

  const selectedRouteSteps = useMemo(
    () =>
      routeSteps
        .filter((step) => step.participantId === selectedParticipant?.participantId)
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
    const scopedMemoryEvents = memoryEvents.filter((event) => event.participantId === selectedParticipant?.participantId)
    return {
      ascentEngine: buildAscentEngineSnapshot({
        participant: selectedParticipant,
        routes: scopedRoutes,
        steps: scopedSteps,
        pcfRefinementWeight: ontologyWeights.pcfRefinementWeight ?? 0.6
      }),
      renewal: buildRenewalSnapshot({
        participant: selectedParticipant,
        routes: scopedRoutes,
        steps: scopedSteps,
        memoryEvents: scopedMemoryEvents,
        reciprocityActivationThreshold: ontologyWeights.reciprocityActivationThreshold ?? 0.6
      }),
      ecosystem: buildInstitutionalEcosystemSnapshot({ isLiveData })
    }
  }, [
    routeRecords,
    routeSteps,
    memoryEvents,
    selectedParticipant,
    ontologyWeights.pcfRefinementWeight,
    ontologyWeights.reciprocityActivationThreshold,
    isLiveData
  ])

  const routePlan = useMemo(
    () =>
      generateRoutePlan({
        participant: selectedParticipant,
        capacityTopology,
        activeRoutes: selectedRoutes,
        completedStepIds: selectedRouteSteps
          .filter((step) => step.status === STEP_STATUS.completed)
          .map((step) => step.stepId),
        interferenceThresholds: {
          medium: ontologyWeights.interferenceMediumThreshold ?? 0.35,
          high: Math.max(
            ontologyWeights.interferenceHighThreshold ?? 0.6,
            ontologyWeights.interferenceMediumThreshold ?? 0.35
          )
        },
        civicDiplomacyBoost: ontologyWeights.civicDiplomacyBoost ?? 0.08
      }),
    [
      capacityTopology,
      selectedParticipant,
      selectedRoutes,
      selectedRouteSteps,
      ontologyWeights.interferenceMediumThreshold,
      ontologyWeights.interferenceHighThreshold,
      ontologyWeights.civicDiplomacyBoost
    ]
  )

  const scopedParticipantIds = useMemo(
    () => new Set(filteredParticipants.map((participant) => participant.participantId)),
    [filteredParticipants]
  )

  const situationalOverlay = useMemo(
    () =>
      buildSituationalOverlay({
        participants: filteredParticipants,
        capacityTopology,
        phaseReadinessAlertThreshold: ontologyWeights.phaseReadinessAlertThreshold ?? 0.45
      }),
    [filteredParticipants, capacityTopology, ontologyWeights.phaseReadinessAlertThreshold]
  )

  const operationsSnapshot = useMemo(
    () =>
      buildOperationsSnapshot({
        participants: filteredParticipants,
        routes: routeRecords.filter((route) => scopedParticipantIds.has(route.participantId)),
        steps: routeSteps.filter((step) => scopedParticipantIds.has(step.participantId)),
        memoryEvents: memoryEvents.filter((event) => scopedParticipantIds.has(event.participantId)),
        slaThresholdHours: ontologyWeights.slaThresholdHours ?? 48,
        phaseReadinessAlertThreshold: ontologyWeights.phaseReadinessAlertThreshold ?? 0.45,
        reciprocityActivationThreshold: ontologyWeights.reciprocityActivationThreshold ?? 0.6
      }),
    [
      filteredParticipants,
      routeRecords,
      routeSteps,
      memoryEvents,
      scopedParticipantIds,
      ontologyWeights.slaThresholdHours,
      ontologyWeights.phaseReadinessAlertThreshold,
      ontologyWeights.reciprocityActivationThreshold
    ]
  )

  const countyComparisons = useMemo(
    () =>
      buildCountyComparisonSnapshot({
        participants,
        routes: routeRecords,
        steps: routeSteps,
        memoryEvents,
        slaThresholdHours: ontologyWeights.slaThresholdHours ?? 48
      }),
    [participants, routeRecords, routeSteps, memoryEvents, ontologyWeights.slaThresholdHours]
  )

  const executionSnapshot = useMemo(
    () =>
      buildExecutionSnapshot({
        routes: routeRecords,
        steps: routeSteps,
        memoryEvents,
        participantId: selectedParticipant?.participantId,
        slaThresholdHours: ontologyWeights.slaThresholdHours ?? 48,
        selectedParticipant,
        phaseReadinessAlertThreshold: ontologyWeights.phaseReadinessAlertThreshold ?? 0.45
      }),
    [
      routeRecords,
      routeSteps,
      memoryEvents,
      selectedParticipant,
      ontologyWeights.slaThresholdHours,
      ontologyWeights.phaseReadinessAlertThreshold
    ]
  )

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
    if (!dbContext?.db || !dbContext?.appId) {
      setActionError('Live datastore is not connected; route activation skipped.')
      return false
    }

    const chosenRoute = routePlan.routes.find((item) => item.routeId === routePlan.recommendedRouteId)
    if (!chosenRoute) {
      setActionError('Recommended route payload is unavailable.')
      return false
    }

    try {
      setSavingRoute(true)
      const optimisticRouteId = createOptimisticId('optimistic-route')
      const optimisticMemoryId = createOptimisticId('optimistic-memory')
      const optimisticRoute = {
        id: optimisticRouteId,
        participantId: selectedParticipant.participantId,
        routeId: chosenRoute.routeId,
        partnerId: chosenRoute.partnerId,
        routeClass: chosenRoute.routeClass || 'stabilization',
        status: ROUTE_LIFECYCLE.active,
        score: chosenRoute.score,
        interferenceRisk: chosenRoute.interferenceRisk,
        transferCost: chosenRoute.transferCost,
        activatedByRole: selectedRole,
        activatedByUserId: dbContext.userId,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
        optimistic: true
      }
      const optimisticMemory = {
        id: optimisticMemoryId,
        participantId: selectedParticipant.participantId,
        eventType: MEMORY_EVENT_TYPES.routeActivated,
        phase: selectedParticipant.currentPhase,
        label: `Route ${chosenRoute.routeId} activated via ${chosenRoute.partnerId}`,
        verified: true,
        createdByRole: selectedRole,
        createdByUserId: dbContext.userId,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
        optimistic: true
      }
      setRouteRecords((current) => [optimisticRoute, ...current])
      setMemoryEvents((current) => [optimisticMemory, ...current])

      const routeDoc = await createRouteRecord({
        db: dbContext.db,
        appId: dbContext.appId,
        payload: {
          participantId: selectedParticipant.participantId,
          routeId: chosenRoute.routeId,
          partnerId: chosenRoute.partnerId,
          routeClass: chosenRoute.routeClass || 'stabilization',
          status: ROUTE_LIFECYCLE.active,
          score: chosenRoute.score,
          interferenceRisk: chosenRoute.interferenceRisk,
          transferCost: chosenRoute.transferCost,
          activatedByRole: selectedRole,
          activatedByUserId: dbContext.userId
        }
      })

      const defaultSteps = buildRouteSteps(chosenRoute)
      await Promise.all(
        defaultSteps.map((step, index) =>
          createRouteStepRecord({
            db: dbContext.db,
            appId: dbContext.appId,
            payload: {
              routeDocId: routeDoc.id,
              routeId: chosenRoute.routeId,
              participantId: selectedParticipant.participantId,
              partnerId: chosenRoute.partnerId,
              stepId: step.stepId,
              label: step.label,
              status: step.status,
              dependencies: step.dependencies,
              domain: step.domain,
              sequence: index + 1
            }
          })
        )
      )

      await createMemoryEvent({
        db: dbContext.db,
        appId: dbContext.appId,
        payload: {
          participantId: selectedParticipant.participantId,
          eventType: MEMORY_EVENT_TYPES.routeActivated,
          phase: selectedParticipant.currentPhase,
          label: `Route ${chosenRoute.routeId} activated via ${chosenRoute.partnerId}`,
          verified: true,
          createdByRole: selectedRole,
          createdByUserId: dbContext.userId
        }
      })
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
    if (!dbContext?.db || !dbContext?.appId) {
      setActionError('Live datastore is not connected; memory event skipped.')
      return false
    }

    try {
      setSavingMemoryEvent(true)
      const optimisticMemoryId = createOptimisticId('optimistic-memory')
      const optimisticMemory = {
        id: optimisticMemoryId,
        participantId: selectedParticipant.participantId,
        eventType,
        phase: selectedParticipant.currentPhase,
        label: label || 'Milestone verified by station operator.',
        verified,
        createdByRole: selectedRole,
        createdByUserId: dbContext.userId,
        createdAt: { seconds: Math.floor(Date.now() / 1000) },
        optimistic: true
      }
      setMemoryEvents((current) => [optimisticMemory, ...current])

      await createMemoryEvent({
        db: dbContext.db,
        appId: dbContext.appId,
        payload: {
        participantId: selectedParticipant.participantId,
        eventType,
        phase: selectedParticipant.currentPhase,
        label: label || 'Milestone verified by station operator.',
        verified,
        createdByRole: selectedRole,
          createdByUserId: dbContext.userId
        }
      })
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
    if (!dbContext?.db || !dbContext?.appId) {
      setActionError('Live datastore is not connected; route transition skipped.')
      return false
    }

    const validStatuses = [ROUTE_LIFECYCLE.active, ROUTE_LIFECYCLE.blocked, ROUTE_LIFECYCLE.completed]
    if (!validStatuses.includes(nextStatus)) {
      setActionError(`Unsupported route status: ${nextStatus}`)
      return false
    }

    try {
      setUpdatingRoute(true)
      setRouteRecords((current) =>
        current.map((route) => (route.id === routeDocId ? { ...route, status: nextStatus, optimistic: true } : route))
      )

      await updateRouteRecord({
        db: dbContext.db,
        appId: dbContext.appId,
        routeDocId,
        payload: {
        status: nextStatus,
        updatedByRole: selectedRole,
        updatedByUserId: dbContext.userId,
        transitionReason: reason || null
        }
      })

      const eventType =
        nextStatus === ROUTE_LIFECYCLE.completed
          ? MEMORY_EVENT_TYPES.milestoneVerified
          : nextStatus === ROUTE_LIFECYCLE.blocked
            ? MEMORY_EVENT_TYPES.blockerDetected
            : MEMORY_EVENT_TYPES.routeActivated

      await createMemoryEvent({
        db: dbContext.db,
        appId: dbContext.appId,
        payload: {
        participantId: selectedParticipant.participantId,
        eventType,
        phase: selectedParticipant.currentPhase,
        label: `Route ${routeDocId} transitioned to ${nextStatus}${reason ? `: ${reason}` : ''}`,
        verified: nextStatus !== ROUTE_LIFECYCLE.blocked,
        createdByRole: selectedRole,
          createdByUserId: dbContext.userId
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
    if (!dbContext?.db || !dbContext?.appId) {
      setActionError('Live datastore is not connected; step transition skipped.')
      return false
    }

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
      setRouteSteps((current) =>
        current.map((item) => (item.id === stepDocId ? { ...item, status: nextStatus, optimistic: true } : item))
      )

      await updateRouteStepRecord({
        db: dbContext.db,
        appId: dbContext.appId,
        stepDocId,
        payload: {
          status: nextStatus,
          updatedByRole: selectedRole,
          updatedByUserId: dbContext.userId
        }
      })

      const updatedSteps = peerSteps.map((item) => (item.id === stepDocId ? { ...item, status: nextStatus } : item))
      const derivedRouteStatus = deriveRouteLifecycleFromSteps(updatedSteps)
      await updateRouteRecord({
        db: dbContext.db,
        appId: dbContext.appId,
        routeDocId: step.routeDocId,
        payload: {
          status: derivedRouteStatus,
          updatedByRole: selectedRole,
          updatedByUserId: dbContext.userId
        }
      })

      await createMemoryEvent({
        db: dbContext.db,
        appId: dbContext.appId,
        payload: {
          participantId: step.participantId,
          eventType: nextStatus === STEP_STATUS.blocked ? MEMORY_EVENT_TYPES.blockerDetected : MEMORY_EVENT_TYPES.milestoneVerified,
          phase: selectedParticipant.currentPhase,
          label: `Step ${step.stepId} transitioned to ${nextStatus}`,
          verified: nextStatus !== STEP_STATUS.blocked,
          createdByRole: selectedRole,
          createdByUserId: dbContext.userId
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
    if (!selectedParticipant) {
      setActionError('No participant selected for renewal role assignment.')
      return false
    }
    if (!roleName) {
      setActionError('Renewal role is required.')
      return false
    }
    if (!canRolePerform(selectedRole, 'assignRenewalRole')) {
      setActionError(`Role "${selectedRole}" cannot assign renewal roles.`)
      return false
    }
    if (!dbContext?.db || !dbContext?.appId) {
      setActionError('Live datastore is not connected; renewal role assignment skipped.')
      return false
    }

    const reciprocityIndex = civicBioSnapshot.renewal.reciprocityIndex ?? 0
    const threshold = ontologyWeights.reciprocityActivationThreshold ?? 0.6
    if (reciprocityIndex < threshold && selectedRole !== 'governanceAdmin') {
      setActionError('Reciprocity index is below activation threshold; escalate to governance or continue renewal progress.')
      return false
    }

    const previousRenewalRoles = renewalRoles
    const optimisticRecord = {
      id: selectedParticipant.participantId,
      participantId: selectedParticipant.participantId,
      roleName,
      contributionDomain: contributionDomain || 'community-care',
      status: reciprocityIndex >= threshold ? 'active' : 'provisional',
      notes: notes || '',
      assignedByRole: selectedRole,
      assignedByUserId: dbContext.userId,
      updatedAt: { seconds: Math.floor(Date.now() / 1000) },
      optimistic: true
    }

    try {
      setAssigningRenewalRole(true)
      setRenewalRoles((current) => {
        const others = current.filter((item) => item.participantId !== selectedParticipant.participantId)
        return [optimisticRecord, ...others]
      })

      await saveRenewalRoleRecord({
        db: dbContext.db,
        appId: dbContext.appId,
        participantId: selectedParticipant.participantId,
        payload: {
          roleName,
          contributionDomain: contributionDomain || 'community-care',
          status: reciprocityIndex >= threshold ? 'active' : 'provisional',
          notes: notes || '',
          assignedByRole: selectedRole,
          assignedByUserId: dbContext.userId,
          reciprocityIndex,
          activationThreshold: threshold
        }
      })

      await createMemoryEvent({
        db: dbContext.db,
        appId: dbContext.appId,
        payload: {
          participantId: selectedParticipant.participantId,
          eventType: MEMORY_EVENT_TYPES.milestoneVerified,
          phase: 'Renewal',
          label: `Renewal role assigned: ${roleName} (${contributionDomain || 'community-care'})`,
          verified: true,
          createdByRole: selectedRole,
          createdByUserId: dbContext.userId
        }
      })
      return true
    } catch (error) {
      setRenewalRoles(previousRenewalRoles)
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
    if (!dbContext?.db || !dbContext?.appId) {
      setActionError('Live datastore is not connected; ontology update skipped.')
      return false
    }

    try {
      setOntologyWeights((current) => ({ ...current, ...nextWeights }))
      await saveOntologyWeightsRecord({
        db: dbContext.db,
        appId: dbContext.appId,
        payload: {
          ...nextWeights,
          updatedByRole: selectedRole,
          updatedByUserId: dbContext.userId
        }
      })

      await createOntologyAuditRecord({
        db: dbContext.db,
        appId: dbContext.appId,
        payload: {
          kind: 'weightsUpdate',
          weights: nextWeights,
          updatedByRole: selectedRole,
          updatedByUserId: dbContext.userId
        }
      })
      return true
    } catch (error) {
      setActionError(`Ontology update failed: ${error.message}`)
      return false
    }
  }

  return {
    selectedRole,
    setSelectedRole,
    selectedCountyId,
    setSelectedCountyId,
    countyOptions,
    selectedParticipant,
    selectedParticipantId,
    setSelectedParticipantId,
    participants: filteredParticipants,
    capacityTopology,
    decisionPacket,
    civicBioSnapshot,
    routePlan,
    selectedRoutes,
    selectedRouteSteps,
    selectedMemoryView,
    selectedRenewalRoleRecord,
    situationalOverlay,
    operationsSnapshot,
    countyComparisons,
    executionSnapshot,
    ontologyWeights,
    ontologyAudit,
    activateRecommendedRoute,
    transitionRouteStatus,
    transitionRouteStepStatus,
    appendMemoryEvent,
    assignRenewalRole,
    saveOntologyWeights,
    actionError,
    savingRoute,
    updatingRoute,
    updatingStep,
    savingMemoryEvent,
    assigningRenewalRole,
    isLiveData,
    loadingLiveData,
    loadError
  }
}

