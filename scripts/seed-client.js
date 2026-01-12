import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
const envPath = join(__dirname, '../.env');
console.log(`📁 Loading environment from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error loading .env:', result.error);
  console.log('\n💡 Make sure .env exists in the atlas directory with your Firebase config');
  process.exit(1);
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Validate that we have the required config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Missing Firebase configuration!');
  console.log('\nFound in .env.local:');
  console.log(`  API Key: ${firebaseConfig.apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log(`  Auth Domain: ${firebaseConfig.authDomain ? '✅ Present' : '❌ Missing'}`);
  console.log(`  Project ID: ${firebaseConfig.projectId ? '✅ Present' : '❌ Missing'}`);
  console.log(`  Storage Bucket: ${firebaseConfig.storageBucket ? '✅ Present' : '❌ Missing'}`);
  console.log(`  Messaging Sender ID: ${firebaseConfig.messagingSenderId ? '✅ Present' : '❌ Missing'}`);
  console.log(`  App ID: ${firebaseConfig.appId ? '✅ Present' : '❌ Missing'}`);
  console.log('\n💡 Check that your .env.local file has VITE_FIREBASE_* variables set correctly');
  process.exit(1);
}

console.log('✅ Firebase configuration loaded successfully\n');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'demo-app'; // Must match what the app uses

// Sample data
const resources = [
  {
    name: "Community Food Bank",
    category: "Food",
    description: "Provides weekly food parcels to families in need. No appointment necessary, walk-ins welcome Monday-Friday 9am-5pm.",
    eligibilityCriteria: {
      zCodes: ["Z59.4", "Z59.5", "Z59.6"],
      income: "low"
    }
  },
  {
    name: "Safe Haven Housing Services",
    category: "Housing",
    description: "Emergency housing assistance and transitional housing programs for individuals experiencing homelessness.",
    eligibilityCriteria: {
      zCodes: ["Z59.0", "Z59.1"],
      income: "low"
    }
  },
  {
    name: "Wellness Center Mental Health Clinic",
    category: "Mental Health",
    description: "Sliding scale mental health services including therapy, psychiatry, and group counseling.",
    eligibilityCriteria: {
      zCodes: ["Z63.4", "Z60.2"],
      income: "low-to-moderate"
    }
  },
  {
    name: "Skills Forward Employment Center",
    category: "Employment",
    description: "Free job training, resume assistance, and job placement services.",
    eligibilityCriteria: {
      zCodes: ["Z56.9"],
      income: "any"
    }
  },
  {
    name: "Community Legal Services",
    category: "Legal",
    description: "Pro bono legal assistance for family law, housing disputes, and criminal record expungement.",
    eligibilityCriteria: {
      zCodes: ["Z65.0", "Z65.1"],
      income: "low"
    }
  },
  {
    name: "Metro Community Health Center",
    category: "Healthcare",
    description: "Primary care, dental, and pharmacy services on a sliding fee scale.",
    eligibilityCriteria: {
      zCodes: [],
      income: "any"
    }
  },
  {
    name: "Ride Share Program",
    category: "Transportation",
    description: "Free transportation vouchers for medical appointments, job interviews, and essential services.",
    eligibilityCriteria: {
      zCodes: [],
      income: "low"
    }
  }
];

const enrollees = [
  {
    demographics: {
      firstName: "Sariah",
      lastName: "Valdez",
      dob: "1990-04-12",
      photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=SV"
    },
    phenotypeId: "SV",
    careTeam: [
      { userId: "demo-user", name: "Demo User", role: "CPC" },
      { userId: "demo-rn", name: "RN Manager", role: "RN" }
    ],
    riskProfile: {
      tier: 3,
      wellnessScores: {
        physical: 40, emotional: 30, intellectual: 45, spiritual: 35,
        social: 25, occupational: 20, environmental: 30, financial: 25
      },
      zCodes: ["Z65.4", "Z59.0", "Z59.1", "Z59.6", "Z60.4", "Z63.0"],
      lscmiScores: { antisocial: 6, family: 5 }
    },
    radialLoad: { density: 6, zCodes: ["Z65.4", "Z59.0", "Z59.1", "Z59.6", "Z60.4", "Z63.0"] },
    ipf: { score: 48, history: [42, 45, 48] },
    reciprocity: {
      roles: ["Peer mentoring (survivor support)", "Community safety dialogue"],
      evidence: "Sustained safe housing, resumed employment schedule, voluntary prosocial engagement."
    },
    allostaticLoad: { trend: "declining" },
    journeyStrip: {
      phases: ["Regulation", "Readiness", "Renewal"],
      currentProgress: 7.2,
      stops: [
        { month: 0.5, name: "Respite stay, sleep restoration", phase: "Regulation", services: ["H", "S"] },
        { month: 1.0, name: "DV-informed housing placement", phase: "Regulation", services: ["H"] },
        { month: 2.0, name: "Pocket Guide completed", phase: "Regulation", services: ["S"] },
        { month: 3.5, name: "Coercive ties severed", phase: "Readiness", services: ["S"] },
        { month: 5.0, name: "Work schedule stabilized", phase: "Readiness", services: ["O"] },
        { month: 7.0, name: "Peer mentoring starts", phase: "Renewal", services: ["S", "M"] }
      ],
      stageMilestones: [
        { month: 1.0, code: "H", label: "Housing Stability", lane: 0 },
        { month: 3.5, code: "S", label: "Safe Networks", lane: 0 },
        { month: 5.0, code: "O", label: "Work Routine", lane: -1 }
      ]
    }
  },
  {
    demographics: {
      firstName: "Preston",
      lastName: "Chung",
      dob: "2003-09-01",
      photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=SP"
    },
    phenotypeId: "SP",
    careTeam: [{ userId: "demo-user", name: "Demo User", role: "CPC" }],
    riskProfile: {
      tier: 2,
      wellnessScores: {
        physical: 55, emotional: 50, intellectual: 60, spiritual: 50,
        social: 45, occupational: 40, environmental: 55, financial: 35
      },
      zCodes: ["Z59.1", "Z60.2", "Z60.4", "Z55.9"],
      lscmiScores: {}
    },
    radialLoad: { density: 4, zCodes: ["Z59.1", "Z60.2", "Z60.4", "Z55.9"] },
    ipf: { score: 58, history: [52, 55, 58] },
    reciprocity: {
      roles: ["Campus peer support", "Study group facilitator"],
      evidence: "Academic load recalibrated, sustained enrollment, peer engagement without over-stimulation."
    },
    allostaticLoad: { trend: "stable" },
    journeyStrip: {
      phases: ["Regulation", "Readiness", "Renewal"],
      currentProgress: 5.5,
      stops: [
        { month: 0.5, name: "Short respite, sleep restoration", phase: "Regulation", services: ["M"] },
        { month: 1.0, name: "Sensory regulation, reduced cognitive load", phase: "Regulation", services: ["M"] },
        { month: 2.5, name: "Predictable housing secured", phase: "Readiness", services: ["H"] },
        { month: 3.0, name: "Peer anchors re-established", phase: "Readiness", services: ["S"] },
        { month: 4.5, name: "Academic load recalibrated", phase: "Readiness", services: ["E"] },
        { month: 6.0, name: "Continuity milestone (no conversion)", phase: "Renewal", services: [] }
      ],
      stageMilestones: [
        { month: 1.0, code: "M", label: "Stress downshift", lane: 0 },
        { month: 2.5, code: "H", label: "Stable Housing", lane: 0 },
        { month: 4.5, code: "E", label: "Academic Fit", lane: -1 }
      ]
    }
  },
  {
    demographics: {
      firstName: "Ramon",
      lastName: "Rivas",
      dob: "1986-12-02",
      photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=RR"
    },
    phenotypeId: "RR",
    careTeam: [
      { userId: "demo-user", name: "Demo User", role: "CPC" },
      { userId: "demo-probation", name: "Probation Lead", role: "Partner" }
    ],
    riskProfile: {
      tier: 3,
      wellnessScores: {
        physical: 45, emotional: 35, intellectual: 50, spiritual: 40,
        social: 30, occupational: 25, environmental: 35, financial: 30
      },
      zCodes: ["Z65.0", "Z65.1", "Z60.4", "Z63.0", "Z59.1", "Z59.7"],
      lscmiScores: { antisocial: 8, companions: 7, attitudes: 7 }
    },
    radialLoad: { density: 6, zCodes: ["Z65.0", "Z65.1", "Z60.4", "Z63.0", "Z59.1", "Z59.7"] },
    ipf: { score: 52, history: [44, 48, 52] },
    reciprocity: {
      roles: ["Restorative justice participation", "Violence interruption (supervised)"],
      evidence: "Sustained work participation, adherence to community norms, survivor-consent restorative work."
    },
    allostaticLoad: { trend: "declining" },
    journeyStrip: {
      phases: ["Regulation", "Readiness", "Renewal"],
      currentProgress: 6.3,
      stops: [
        { month: 0.5, name: "Medication + housing separation", phase: "Regulation", services: ["H", "M", "J"] },
        { month: 1.5, name: "Criminogenic peers removed", phase: "Regulation", services: ["J", "S"] },
        { month: 3.0, name: "Accountability + safety plan", phase: "Readiness", services: ["J"] },
        { month: 4.5, name: "Workforce training start", phase: "Readiness", services: ["O"] },
        { month: 5.5, name: "Mentor network established", phase: "Readiness", services: ["S"] },
        { month: 7.0, name: "Restorative justice participation", phase: "Renewal", services: ["J"] }
      ],
      stageMilestones: [
        { month: 0.5, code: "H", label: "Housing Separation", lane: 0 },
        { month: 1.5, code: "J", label: "Risk Contained", lane: 0 },
        { month: 4.5, code: "O", label: "Structured Work", lane: -1 }
      ]
    }
  }
];

const partnerStations = [
  {
    name: "County Public Defender Station",
    type: "Public Defender",
    zBurdenSurvey: {
      zCodes: ["Z65.0", "Z65.1", "Z60.4", "Z63.0", "Z59.7"],
      weights: { justice: 0.35, housing: 0.25, social: 0.2, work: 0.2 }
    },
    watershedWeights: { housing: 0.3, justice: 0.3, social: 0.2, work: 0.2 },
    stripMap: {
      phases: ["Regulation", "Readiness", "Renewal"],
      currentProgress: 4.2,
      stops: [
        { order: 1, name: "Z-code partner survey completed", phase: "Regulation" },
        { order: 2, name: "Impact report generated", phase: "Regulation" },
        { order: 3, name: "Eligibility demographics captured", phase: "Regulation" },
        { order: 4, name: "MOU + pilot scope agreed", phase: "Readiness" },
        { order: 5, name: "Gatekeeper workshop delivered", phase: "Readiness" },
        { order: 6, name: "Pilot tools/policies released", phase: "Readiness" },
        { order: 7, name: "Pilot evaluation launched", phase: "Readiness" },
        { order: 8, name: "Intervention adjustments applied", phase: "Renewal" }
      ]
    },
    pilotStatus: { state: "planning", workshopsCompleted: 1, pilotsLaunched: 0 },
    referralsManaged: 18,
    civicYield: {
      policyInfluence: "Contributed to pretrial stabilization protocol draft.",
      crimeReduction: "Early signal: fewer breach-of-contact incidents among referred cohort.",
      economic: "Stabilized participants sustaining employment through supervision."
    }
  }
];

const countyCommons = [
  {
    name: "County Commons (Pilot Region)",
    watershedWeightsAggregate: { housing: 0.32, justice: 0.24, social: 0.18, work: 0.16, health: 0.10 },
    zBurdenAggregate: ["Z59.0", "Z59.1", "Z65.0", "Z65.1", "Z60.4", "Z56.0"],
    leadersEngaged: 72,
    agendaIterations: 2,
    incubators: 3,
    actionTeams: 4,
    quickWins: [
      "3rd Gen CPTED park cleanup pilots",
      "Pray phone deployment",
      "Inter-agency food + housing referral sprints"
    ],
    campaigns: [
      { name: "Stabilization Awareness", status: "active" },
      { name: "Prosocial Prescribing", status: "planned" }
    ],
    impactReports: 2,
    civicYield: {
      economic: "Workforce retention improvement among referred cohort.",
      policy: "Common agenda papers iterated; draft community plan in progress.",
      crimeReduction: "Early reduction signals in target zones correlated to CPTED pilots."
    },
    stripMap: {
      phases: ["Regulation", "Readiness", "Renewal"],
      currentProgress: 3.8,
      stops: [
        { order: 1, name: "Impact reports generated", phase: "Regulation" },
        { order: 2, name: "Agenda process map published", phase: "Regulation" },
        { order: 3, name: "100 leaders gathered/invested", phase: "Regulation" },
        { order: 4, name: "Common agenda papers v1", phase: "Regulation" },
        { order: 5, name: "Incubators convened & pilots identified", phase: "Readiness" },
        { order: 6, name: "Action teams launched", phase: "Readiness" },
        { order: 7, name: "Quick wins deployed (CPTED, pray phones)", phase: "Readiness" },
        { order: 8, name: "Community care plan benchmarks set", phase: "Readiness" },
        { order: 9, name: "Regional civic yield tracked", phase: "Renewal" }
      ]
    }
  }
];

async function seedData() {
  console.log('🔐 Authenticating with Firebase...');
  
  try {
    // Sign in anonymously (same as the app does)
    await signInAnonymously(auth);
    console.log('✅ Authenticated successfully\n');

    console.log('🌱 Starting to seed data...\n');

    // Add Resources
    console.log('📦 Adding resources...');
    const resourcesRef = collection(db, `artifacts/${appId}/public/data/resources`);
    for (const resource of resources) {
      const docRef = await addDoc(resourcesRef, resource);
      console.log(`  ✅ Added: ${resource.name} (${docRef.id})`);
    }
    console.log(`✅ Added ${resources.length} resources\n`);

    // Add Enrollees
    console.log('👥 Adding enrollees...');
    const enrolleesRef = collection(db, `artifacts/${appId}/public/data/enrollees`);
    const enrolleeIds = [];
    
    for (const enrollee of enrollees) {
      const docRef = await addDoc(enrolleesRef, enrollee);
      enrolleeIds.push(docRef.id);
      console.log(`  ✅ Added: ${enrollee.demographics.firstName} ${enrollee.demographics.lastName} (${docRef.id})`);
    }
    console.log(`✅ Added ${enrollees.length} enrollees\n`);

    // Add care plan entries for first enrollee
    console.log('📝 Adding care plan entries...');
    const firstEnrolleeId = enrolleeIds[0];
    const carePlanRef = collection(db, `artifacts/${appId}/public/data/enrollees/${firstEnrolleeId}/carePlan`);
    
    await addDoc(carePlanRef, {
      type: 'Note',
      timestamp: serverTimestamp(),
      authorUserId: 'demo-user',
      authorName: 'Demo User',
      content: 'Initial assessment completed. Client is motivated and eager to engage with services. Discussed housing goals and employment barriers.'
    });
    console.log('  ✅ Added care note');

    await addDoc(carePlanRef, {
      type: 'PRAXISInsight',
      timestamp: serverTimestamp(),
      authorUserId: 'system',
      authorName: 'PRAXIS AI',
      content: 'Based on risk profile, recommend referral to mental health services and housing assistance. Client shows elevated stress indicators.',
      status: 'Pending'
    });
    console.log('  ✅ Added PRAXIS insight\n');

    // Add sample referral
    console.log('📤 Adding sample referral...');
    const referralsRef = collection(db, `artifacts/${appId}/public/data/referrals`);
    await addDoc(referralsRef, {
      enrolleeId: enrolleeIds[0],
      enrolleeName: 'Sandra Morrison',
      resourceId: 'resource-housing',
      resourceName: 'Safe Haven Housing Services',
      referringUserId: 'demo-user',
      referringUserName: 'demo@atlas.org',
      status: 'Pending',
      notes: 'Urgent housing assistance needed.',
      createdTimestamp: serverTimestamp()
    });
    console.log('  ✅ Added referral\n');

    // Add partner stations
    console.log('🤝 Adding partner stations...');
    const partnersRef = collection(db, `artifacts/${appId}/partners`);
    for (const partner of partnerStations) {
      const docRef = await addDoc(partnersRef, partner);
      console.log(`  ✅ Added partner station: ${partner.name} (${docRef.id})`);
    }
    console.log(`✅ Added ${partnerStations.length} partner station(s)\n`);

    // Add county commons record
    console.log('🏛️  Adding county commons...');
    const countyRef = collection(db, `artifacts/${appId}/countyCommons`);
    for (const county of countyCommons) {
      const docRef = await addDoc(countyRef, county);
      console.log(`  ✅ Added county commons: ${county.name} (${docRef.id})`);
    }
    console.log(`✅ Added ${countyCommons.length} county commons record(s)\n`);

    // Update current user's profile with enrollee assignments
    console.log('👤 Updating user profile with enrollee assignments...');
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userProfileRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/profile/main`);
      await setDoc(userProfileRef, {
        name: currentUser.email || 'Demo User',
        role: 'Certified Peer Counselor',
        email: currentUser.email || 'demo@atlas.org',
        assignedEnrollees: enrolleeIds
      }, { merge: true });
      console.log(`  ✅ Assigned enrollees to user: ${currentUser.uid}\n`);
    }

    console.log('🎉 Data seeding complete!\n');
    console.log('📋 Enrollee IDs for reference:');
    enrolleeIds.forEach((id, index) => {
      console.log(`   ${index + 1}. ${enrollees[index].demographics.firstName} ${enrollees[index].demographics.lastName}: ${id}`);
    });
    console.log('\n✨ Open http://localhost:5173 to see your data!');
    console.log('💡 NOTE: Since this script uses anonymous auth, the enrollees are assigned to a different user.');
    console.log('   To see them in your app, you need to update YOUR user profile with these enrollee IDs.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();

