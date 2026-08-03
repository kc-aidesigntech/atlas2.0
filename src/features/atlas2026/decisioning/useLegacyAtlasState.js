import { useEffect, useState } from 'react'
import { fetchLegacyAtlasSnapshot } from '@atlas/shared'
import { createParticipantState } from '@/core/atlas2026/data-model'
import { DEFAULT_ONTOLOGY_WEIGHTS } from '@/core/atlas2026/canonical-spec'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

function normalizeParticipant(docId, raw) {
  return createParticipantState({ ...raw, participantId: raw?.participantId ?? docId })
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

export function useLegacyAtlasState() {
  const [participants, setParticipants] = useState([])
  const [capacityTopology, setCapacityTopology] = useState([])
  const [routeRecords, setRouteRecords] = useState([])
  const [routeSteps, setRouteSteps] = useState([])
  const [memoryEvents, setMemoryEvents] = useState([])
  const [ontologyAudit, setOntologyAudit] = useState([])
  const [renewalRoles, setRenewalRoles] = useState([])
  // Clone canonical defaults so local edits stay isolated from module-level state.
  const [ontologyWeights, setOntologyWeights] = useState(() => ({ ...DEFAULT_ONTOLOGY_WEIGHTS }))
  const [selectedParticipantId, setSelectedParticipantId] = useState('')
  const [loadingLiveData, setLoadingLiveData] = useState(true)
  const [isLiveData, setIsLiveData] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [dbContext, setDbContext] = useState(null)

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setLoadingLiveData(false)
      setLoadError('Supabase configuration not found.')
      return
    }
    let isActive = true
    // Normalize the legacy snapshot once so downstream decisioning uses stable shapes.
    async function hydrateLegacyAtlas() {
      setLoadingLiveData(true)
      try {
        const snapshot = await fetchLegacyAtlasSnapshot(supabase)
        if (!isActive) return
        const nextParticipants = snapshot.participants.map((participant) =>
          normalizeParticipant(participant.participantId, participant)
        )
        setParticipants(nextParticipants)
        setCapacityTopology(snapshot.capacityTopology.map((node) => normalizeCapacityNode(node.partnerId, node)))
        setRouteRecords(snapshot.routeRecords)
        setRouteSteps(snapshot.routeSteps.map((step) => ({ ...step, routeDocId: step.routeRecordId })))
        setMemoryEvents(snapshot.memoryEvents)
        setOntologyWeights(snapshot.ontologyWeights)
        setOntologyAudit(snapshot.ontologyAudit)
        setRenewalRoles(snapshot.renewalRoles.map((record) => ({
          id: record.id,
          participantId: record.participantId,
          roleName: record.roleLabel,
          contributionDomain: record.payload?.contributionDomain || null,
          status: record.payload?.status || null,
          notes: record.payload?.notes || '',
          assignedByRole: record.assignedByRole,
          assignedByUserId: record.assignedByUserId,
          updatedAt: record.updatedAt
        })))
        setDbContext({ db: supabase, appId: 'atlas', userId: 'supabase-web' })
        setSelectedParticipantId((current) =>
          nextParticipants.some((item) => item.participantId === current)
            ? current
            : nextParticipants[0]?.participantId || ''
        )
        setIsLiveData(nextParticipants.length > 0)
        setLoadError(null)
      } catch (error) {
        if (!isActive) return
        setLoadError(`Supabase bootstrap failed: ${error.message}`)
        setIsLiveData(false)
      } finally {
        if (isActive) setLoadingLiveData(false)
      }
    }
    hydrateLegacyAtlas()
    return () => {
      isActive = false
    }
  }, [])

  return {
    participants, capacityTopology, routeRecords, setRouteRecords, routeSteps, setRouteSteps,
    memoryEvents, setMemoryEvents, ontologyAudit, renewalRoles, setRenewalRoles,
    ontologyWeights, setOntologyWeights, selectedParticipantId, setSelectedParticipantId,
    loadingLiveData, isLiveData, loadError, dbContext
  }
}
