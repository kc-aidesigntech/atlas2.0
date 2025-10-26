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
      firstName: "Sandra",
      lastName: "Morrison",
      dob: "1989-03-15",
      photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=SM"
    },
    careTeam: [{ userId: "demo-user", name: "Demo User", role: "CPC" }],
    riskProfile: {
      tier: 3,
      wellnessScores: {
        physical: 35, emotional: 25, intellectual: 40, spiritual: 30,
        social: 20, occupational: 15, environmental: 25, financial: 20
      },
      zCodes: ["Z59.0", "Z63.4", "Z56.9", "Z65.1"],
      lscmiScores: {
        antisocial: 7, family: 6, education: 4, employment: 8,
        leisure: 5, companions: 7, alcohol: 3, attitudes: 6
      }
    }
  },
  {
    demographics: {
      firstName: "Marcus",
      lastName: "Thompson",
      dob: "1995-07-22",
      photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=MT"
    },
    careTeam: [{ userId: "demo-user", name: "Demo User", role: "CPC" }],
    riskProfile: {
      tier: 2,
      wellnessScores: {
        physical: 55, emotional: 45, intellectual: 60, spiritual: 50,
        social: 40, occupational: 35, environmental: 50, financial: 30
      },
      zCodes: ["Z59.4", "Z59.6", "Z56.9"],
      lscmiScores: {}
    }
  },
  {
    demographics: {
      firstName: "Elena",
      lastName: "Rodriguez",
      dob: "2001-11-08",
      photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=ER"
    },
    careTeam: [{ userId: "demo-user", name: "Demo User", role: "CPC" }],
    riskProfile: {
      tier: 1,
      wellnessScores: {
        physical: 70, emotional: 65, intellectual: 75, spiritual: 60,
        social: 70, occupational: 60, environmental: 65, financial: 55
      },
      zCodes: [],
      lscmiScores: {}
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

