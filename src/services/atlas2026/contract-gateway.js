import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

export async function createRouteRecord({ db, appId, payload }) {
  return addDoc(collection(db, `artifacts/${appId}/atlas2026/routes`), {
    ...payload,
    createdAt: serverTimestamp()
  })
}

export async function updateRouteRecord({ db, appId, routeDocId, payload }) {
  return updateDoc(doc(db, `artifacts/${appId}/atlas2026/routes/${routeDocId}`), {
    ...payload,
    updatedAt: serverTimestamp()
  })
}

export async function createMemoryEvent({ db, appId, payload }) {
  return addDoc(collection(db, `artifacts/${appId}/atlas2026/memoryEvents`), {
    ...payload,
    createdAt: serverTimestamp()
  })
}

export async function createRouteStepRecord({ db, appId, payload }) {
  return addDoc(collection(db, `artifacts/${appId}/atlas2026/routeSteps`), {
    ...payload,
    createdAt: serverTimestamp()
  })
}

export async function updateRouteStepRecord({ db, appId, stepDocId, payload }) {
  return updateDoc(doc(db, `artifacts/${appId}/atlas2026/routeSteps/${stepDocId}`), {
    ...payload,
    updatedAt: serverTimestamp()
  })
}

export async function saveOntologyWeightsRecord({ db, appId, payload }) {
  return setDoc(
    doc(db, `artifacts/${appId}/atlas2026/ontology/weights`),
    {
      ...payload,
      kind: 'weights',
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )
}

export async function createOntologyAuditRecord({ db, appId, payload }) {
  return addDoc(collection(db, `artifacts/${appId}/atlas2026/ontologyAudit`), {
    ...payload,
    updatedAt: serverTimestamp()
  })
}

