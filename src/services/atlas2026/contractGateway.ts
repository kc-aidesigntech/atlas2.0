// Contract gateway preserves legacy persistence payloads while the Atlas service layer evolves.
import {
  createLegacyMemoryEvent,
  createLegacyOntologyAuditRecord,
  createLegacyRouteRecord,
  createLegacyRouteStepRecord,
  saveLegacyOntologyWeights,
  saveLegacyRenewalRoleRecord,
  updateLegacyRouteRecord,
  updateLegacyRouteStepRecord
} from '@atlas/shared'

type LegacyDbClient = Parameters<typeof createLegacyRouteRecord>[0]
type LegacyPayload = Record<string, unknown>

interface CreateRecordInput {
  db: LegacyDbClient
  appId?: string
  payload: LegacyPayload
}

interface UpdateRouteInput extends CreateRecordInput {
  routeDocId: string
}

interface UpdateStepInput extends CreateRecordInput {
  stepDocId: string
}

interface SaveRenewalRoleInput extends CreateRecordInput {
  participantId: string
}

// Do not reshape payloads here unless shared contract adapters are updated in lockstep.
export async function createRouteRecord({ db, appId, payload }: CreateRecordInput) {
  return createLegacyRouteRecord(db, payload)
}

export async function updateRouteRecord({ db, appId, routeDocId, payload }: UpdateRouteInput) {
  return updateLegacyRouteRecord(db, routeDocId, payload)
}

export async function createMemoryEvent({ db, appId, payload }: CreateRecordInput) {
  return createLegacyMemoryEvent(db, payload)
}

export async function createRouteStepRecord({ db, appId, payload }: CreateRecordInput) {
  return createLegacyRouteStepRecord(db, payload)
}

export async function updateRouteStepRecord({ db, appId, stepDocId, payload }: UpdateStepInput) {
  return updateLegacyRouteStepRecord(db, stepDocId, payload)
}

export async function saveOntologyWeightsRecord({ db, appId, payload }: CreateRecordInput) {
  return saveLegacyOntologyWeights(db, payload)
}

export async function createOntologyAuditRecord({ db, appId, payload }: CreateRecordInput) {
  return createLegacyOntologyAuditRecord(db, payload)
}

export async function saveRenewalRoleRecord({ db, appId, participantId, payload }: SaveRenewalRoleInput) {
  return saveLegacyRenewalRoleRecord(db, participantId, payload)
}
