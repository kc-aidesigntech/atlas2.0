import { useEffect, useMemo, useState } from 'react'
import { getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth'
import { addDoc, collection, getFirestore, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { evaluateParticipantForRoutes } from '@/core/atlas2026/intel-contract'
import { createParticipantState, MEMORY_EVENT_TYPES, ROUTE_LIFECYCLE } from '@/core/atlas2026/data-model'
import { canRolePerform } from '@/core/atlas2026/policy'
import { DEMO_CAPACITY_TOPOLOGY, DEMO_PARTICIPANTS } from './sample-data'

function normalizeParticipant(docId, raw) {
  return createParticipantState({
    ...raw,
    participantId: raw?.participantId ?? docId
  })
}

function normalizeCapacityNode(docId, raw) {
  return {
    partnerId: raw?.partnerId ?? docId,
    label: raw?.label ?? raw?.partnerId ?? docId,
    coverageScore: raw?.coverageScore ?? 0.65,
    phaseAlignment: raw?.phaseAlignment ?? 0.7,
    specializationScore: raw?.specializationScore ?? 0.7,
    reversibilitySupport: raw?.reversibilitySupport ?? 0.65,
    transferCost: raw?.transferCost ?? 0.25,
    interferenceRisk: raw?.interferenceRisk ?? 0.2,
    phaseIndex: raw?.phaseIndex ?? 0,
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

export function useAtlasDecisioning() {
  const [participants, setParticipants] = useState(DEMO_PARTICIPANTS)
  const [capacityTopology, setCapacityTopology] = useState(DEMO_CAPACITY_TOPOLOGY)
  const [routeRecords, setRouteRecords] = useState([])
  const [memoryEvents, setMemoryEvents] = useState([])
  const [selectedParticipantId, setSelectedParticipantId] = useState(DEMO_PARTICIPANTS[0].participantId)
  const [selectedRole, setSelectedRole] = useState('peerNavigator')
  const [loadingLiveData, setLoadingLiveData] = useState(true)
  const [isLiveData, setIsLiveData] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [savingRoute, setSavingRoute] = useState(false)
  const [savingMemoryEvent, setSavingMemoryEvent] = useState(false)
  const [dbContext, setDbContext] = useState(null)

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
    let unsubscribeMemoryEvents = null

    const cleanupSnapshots = () => {
      if (unsubscribeParticipants) unsubscribeParticipants()
      if (unsubscribeCapacity) unsubscribeCapacity()
      if (unsubscribeRoutes) unsubscribeRoutes()
      if (unsubscribeMemoryEvents) unsubscribeMemoryEvents()
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
      const memoryEventsPath = collection(db, `artifacts/${appId}/atlas2026/memoryEvents`)
      let participantsReady = false
      let capacityReady = false
      let routesReady = false
      let memoryReady = false
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
          if (participantsReady && capacityReady && routesReady && memoryReady) {
            setIsLiveData(snapshot.size > 0)
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
          if (participantsReady && capacityReady && routesReady && memoryReady) {
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
          if (participantsReady && capacityReady && routesReady && memoryReady) {
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
          if (participantsReady && capacityReady && routesReady && memoryReady) {
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
    })

    return () => {
      cleanupSnapshots()
      unsubscribeAuth()
    }
  }, [])

  const selectedParticipant = useMemo(
    () => participants.find((participant) => participant.participantId === selectedParticipantId) ?? participants[0],
    [participants, selectedParticipantId]
  )

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

  const selectedMemoryEvents = useMemo(
    () =>
      memoryEvents
        .filter((item) => item.participantId === selectedParticipant?.participantId)
        .sort((a, b) => {
          const left = a?.createdAt?.seconds ?? 0
          const right = b?.createdAt?.seconds ?? 0
          return right - left
        }),
    [memoryEvents, selectedParticipant]
  )

  async function activateRecommendedRoute() {
    setActionError(null)
    if (!selectedParticipant || !decisionPacket.recommendedRouteId) {
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

    const chosenRoute = decisionPacket.routeOptions.find((item) => item.routeId === decisionPacket.recommendedRouteId)
    if (!chosenRoute) {
      setActionError('Recommended route payload is unavailable.')
      return false
    }

    try {
      setSavingRoute(true)
      await addDoc(collection(dbContext.db, `artifacts/${dbContext.appId}/atlas2026/routes`), {
        participantId: selectedParticipant.participantId,
        routeId: chosenRoute.routeId,
        partnerId: chosenRoute.partnerId,
        status: ROUTE_LIFECYCLE.active,
        score: chosenRoute.score,
        interferenceRisk: chosenRoute.interferenceRisk,
        transferCost: chosenRoute.transferCost,
        activatedByRole: selectedRole,
        activatedByUserId: dbContext.userId,
        activatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      })

      await addDoc(collection(dbContext.db, `artifacts/${dbContext.appId}/atlas2026/memoryEvents`), {
        participantId: selectedParticipant.participantId,
        eventType: MEMORY_EVENT_TYPES.routeActivated,
        phase: selectedParticipant.currentPhase,
        label: `Route ${chosenRoute.routeId} activated via ${chosenRoute.partnerId}`,
        verified: true,
        createdByRole: selectedRole,
        createdByUserId: dbContext.userId,
        createdAt: serverTimestamp()
      })
      return true
    } catch (error) {
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
      await addDoc(collection(dbContext.db, `artifacts/${dbContext.appId}/atlas2026/memoryEvents`), {
        participantId: selectedParticipant.participantId,
        eventType,
        phase: selectedParticipant.currentPhase,
        label: label || 'Milestone verified by station operator.',
        verified,
        createdByRole: selectedRole,
        createdByUserId: dbContext.userId,
        createdAt: serverTimestamp()
      })
      return true
    } catch (error) {
      setActionError(`Memory event write failed: ${error.message}`)
      return false
    } finally {
      setSavingMemoryEvent(false)
    }
  }

  return {
    selectedRole,
    setSelectedRole,
    selectedParticipant,
    selectedParticipantId,
    setSelectedParticipantId,
    participants,
    capacityTopology,
    decisionPacket,
    selectedRoutes,
    selectedMemoryEvents,
    activateRecommendedRoute,
    appendMemoryEvent,
    actionError,
    savingRoute,
    savingMemoryEvent,
    isLiveData,
    loadingLiveData,
    loadError
  }
}

