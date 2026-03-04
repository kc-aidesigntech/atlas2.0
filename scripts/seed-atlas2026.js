import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { addDoc, collection, doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env.local') })
dotenv.config({ path: join(__dirname, '../.env') })

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase configuration in .env.local or .env')
  process.exit(1)
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const appId = process.env.VITE_APP_ID || process.env.APP_ID || 'demo-app'

const participants = [
  {
    id: 'pt-101',
    participantId: 'pt-101',
    countyId: 'county-commons-01',
    displayName: 'North District Participant',
    currentPhase: 'Regulation',
    phaseReadiness: 0.35,
    pressureVectors: [
      { domain: 'habitat', severity: 0.83, trajectory: 'up', reversibility: 0.38, confidence: 0.8 },
      { domain: 'socialNetworks', severity: 0.7, trajectory: 'flat', reversibility: 0.45, confidence: 0.76 },
      { domain: 'work', severity: 0.68, trajectory: 'up', reversibility: 0.41, confidence: 0.74 },
      { domain: 'health', severity: 0.64, trajectory: 'down', reversibility: 0.63, confidence: 0.71 },
      { domain: 'mobility', severity: 0.58, trajectory: 'flat', reversibility: 0.52, confidence: 0.69 }
    ]
  },
  {
    id: 'pt-204',
    participantId: 'pt-204',
    countyId: 'county-commons-01',
    displayName: 'Harbor Corridor Participant',
    currentPhase: 'Readiness',
    phaseReadiness: 0.57,
    pressureVectors: [
      { domain: 'habitat', severity: 0.51, trajectory: 'down', reversibility: 0.62, confidence: 0.72 },
      { domain: 'socialNetworks', severity: 0.62, trajectory: 'flat', reversibility: 0.53, confidence: 0.73 },
      { domain: 'work', severity: 0.77, trajectory: 'up', reversibility: 0.37, confidence: 0.8 },
      { domain: 'health', severity: 0.44, trajectory: 'down', reversibility: 0.64, confidence: 0.67 },
      { domain: 'mobility', severity: 0.4, trajectory: 'flat', reversibility: 0.68, confidence: 0.69 }
    ]
  }
]

const capacityTopology = [
  {
    id: 'station-housing-01',
    partnerId: 'station-housing-01',
    label: 'Housing Stabilization Station',
    coverageScore: 0.84,
    phaseAlignment: 0.89,
    specializationScore: 0.82,
    reversibilitySupport: 0.78,
    transferCost: 0.22,
    interferenceRisk: 0.16,
    phaseIndex: 0,
    dependencies: []
  },
  {
    id: 'station-work-03',
    partnerId: 'station-work-03',
    label: 'Work Restoration Station',
    coverageScore: 0.74,
    phaseAlignment: 0.75,
    specializationScore: 0.86,
    reversibilitySupport: 0.71,
    transferCost: 0.25,
    interferenceRisk: 0.2,
    phaseIndex: 1,
    dependencies: ['route-plan-1']
  },
  {
    id: 'station-network-02',
    partnerId: 'station-network-02',
    label: 'Social Network Repair Station',
    coverageScore: 0.78,
    phaseAlignment: 0.8,
    specializationScore: 0.72,
    reversibilitySupport: 0.66,
    transferCost: 0.31,
    interferenceRisk: 0.27,
    phaseIndex: 1,
    dependencies: []
  }
]

const weights = {
  coverageWeight: 0.3,
  phaseAlignmentWeight: 0.2,
  specializationWeight: 0.2,
  reversibilityWeight: 0.15,
  transferCostPenalty: 0.1,
  interferencePenalty: 0.05
}

async function seedAtlas2026() {
  await signInAnonymously(auth)

  for (const participant of participants) {
    await setDoc(doc(db, `artifacts/${appId}/atlas2026/participants/${participant.id}`), {
      ...participant,
      updatedAt: serverTimestamp()
    }, { merge: true })
  }

  for (const node of capacityTopology) {
    await setDoc(doc(db, `artifacts/${appId}/atlas2026/capacityTopology/${node.id}`), {
      ...node,
      updatedAt: serverTimestamp()
    }, { merge: true })
  }

  await setDoc(doc(db, `artifacts/${appId}/atlas2026/ontology/weights`), {
    ...weights,
    kind: 'weights',
    updatedByRole: 'governanceAdmin',
    updatedByUserId: 'atlas-seed-script',
    updatedAt: serverTimestamp()
  }, { merge: true })

  await addDoc(collection(db, `artifacts/${appId}/atlas2026/ontologyAudit`), {
    kind: 'weightsUpdate',
    weights,
    updatedByRole: 'governanceAdmin',
    updatedByUserId: 'atlas-seed-script',
    updatedAt: serverTimestamp()
  })

  await addDoc(collection(db, `artifacts/${appId}/atlas2026/memoryEvents`), {
    participantId: 'pt-101',
    eventType: 'phaseGateSatisfied',
    phase: 'Regulation',
    label: 'Initial gate validated for stabilization intake.',
    verified: true,
    createdByRole: 'stationOperator',
    createdByUserId: 'atlas-seed-script',
    createdAt: serverTimestamp()
  })

  console.log('ATLAS 2026 seed complete.')
}

seedAtlas2026().catch((error) => {
  console.error(error)
  process.exit(1)
})

