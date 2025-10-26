const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with your project
// This will use your default credentials from Firebase CLI
admin.initializeApp({
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'atlas-information-exchange'
});

const db = admin.firestore();
const appId = 'atlas-demo';

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
  console.log('🌱 Starting to seed data...\n');

  try {
    // Add Resources
    console.log('📦 Adding resources...');
    const resourcesRef = db.collection(`artifacts/${appId}/public/data/resources`);
    for (const resource of resources) {
      await resourcesRef.add(resource);
      console.log(`  ✅ Added: ${resource.name}`);
    }
    console.log(`✅ Added ${resources.length} resources\n`);

    // Add Enrollees
    console.log('👥 Adding enrollees...');
    const enrolleesRef = db.collection(`artifacts/${appId}/public/data/enrollees`);
    const enrolleeIds = [];
    
    for (const enrollee of enrollees) {
      const docRef = await enrolleesRef.add(enrollee);
      enrolleeIds.push(docRef.id);
      console.log(`  ✅ Added: ${enrollee.demographics.firstName} ${enrollee.demographics.lastName} (${docRef.id})`);
    }
    console.log(`✅ Added ${enrollees.length} enrollees\n`);

    // Add a sample care plan entry for the first enrollee
    console.log('📝 Adding care plan entries...');
    const firstEnrolleeId = enrolleeIds[0];
    const carePlanRef = db.collection(`artifacts/${appId}/public/data/enrollees/${firstEnrolleeId}/carePlan`);
    
    await carePlanRef.add({
      type: 'Note',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      authorUserId: 'demo-user',
      authorName: 'Demo User',
      content: 'Initial assessment completed. Client is motivated and eager to engage with services. Discussed housing goals and employment barriers.'
    });
    console.log('  ✅ Added care note');

    await carePlanRef.add({
      type: 'PRAXISInsight',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      authorUserId: 'system',
      authorName: 'PRAXIS AI',
      content: 'Based on risk profile, recommend referral to mental health services and housing assistance. Client shows elevated stress indicators.',
      status: 'Pending'
    });
    console.log('  ✅ Added PRAXIS insight\n');

    // Add a sample referral
    console.log('📤 Adding sample referral...');
    const referralsRef = db.collection(`artifacts/${appId}/public/data/referrals`);
    await referralsRef.add({
      enrolleeId: enrolleeIds[0],
      enrolleeName: 'Sandra Morrison',
      resourceId: 'resource-housing',
      resourceName: 'Safe Haven Housing Services',
      referringUserId: 'demo-user',
      referringUserName: 'demo@atlas.org',
      status: 'Pending',
      notes: 'Urgent housing assistance needed.',
      createdTimestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('  ✅ Added referral\n');

    console.log('🎉 Data seeding complete!');
    console.log('\nℹ️  Note: You\'ll need to update your user profile to add these enrollees to assignedEnrollees array.');
    console.log(`   Enrollee IDs: ${enrolleeIds.join(', ')}\n`);
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

seedData();

