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

export async function createRouteRecord({ db, appId, payload }) {
  return createLegacyRouteRecord(db, payload)
}

export async function updateRouteRecord({ db, appId, routeDocId, payload }) {
  return updateLegacyRouteRecord(db, routeDocId, payload)
}

export async function createMemoryEvent({ db, appId, payload }) {
  return createLegacyMemoryEvent(db, payload)
}

export async function createRouteStepRecord({ db, appId, payload }) {
  return createLegacyRouteStepRecord(db, payload)
}

export async function updateRouteStepRecord({ db, appId, stepDocId, payload }) {
  return updateLegacyRouteStepRecord(db, stepDocId, payload)
}

export async function saveOntologyWeightsRecord({ db, appId, payload }) {
  return saveLegacyOntologyWeights(db, payload)
}

export async function createOntologyAuditRecord({ db, appId, payload }) {
  return createLegacyOntologyAuditRecord(db, payload)
}

export async function saveRenewalRoleRecord({ db, appId, participantId, payload }) {
  return saveLegacyRenewalRoleRecord(db, participantId, payload)
}

