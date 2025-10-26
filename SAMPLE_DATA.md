# Sample Data for ATLAS CIE Portal

This document provides sample data structures you can add to your Firestore database for testing and development.

## 📋 Sample Resources

Add these to `/artifacts/{appId}/public/data/resources/`:

```javascript
// Resource 1: Food Bank
{
  name: "Community Food Bank",
  category: "Food",
  description: "Provides weekly food parcels to families in need. No appointment necessary, walk-ins welcome Monday-Friday 9am-5pm.",
  eligibilityCriteria: {
    zCodes: ["Z59.4", "Z59.5", "Z59.6"],
    income: "low"
  }
}

// Resource 2: Housing Assistance
{
  name: "Safe Haven Housing Services",
  category: "Housing",
  description: "Emergency housing assistance and transitional housing programs for individuals experiencing homelessness.",
  eligibilityCriteria: {
    zCodes: ["Z59.0", "Z59.1"],
    income: "low"
  }
}

// Resource 3: Mental Health Clinic
{
  name: "Wellness Center Mental Health Clinic",
  category: "Mental Health",
  description: "Sliding scale mental health services including therapy, psychiatry, and group counseling. Accepting new patients.",
  eligibilityCriteria: {
    zCodes: ["Z63.4", "Z60.2"],
    income: "low-to-moderate"
  }
}

// Resource 4: Job Training
{
  name: "Skills Forward Employment Center",
  category: "Employment",
  description: "Free job training, resume assistance, and job placement services for unemployed and underemployed individuals.",
  eligibilityCriteria: {
    zCodes: ["Z56.9"],
    income: "any"
  }
}

// Resource 5: Legal Aid
{
  name: "Community Legal Services",
  category: "Legal",
  description: "Pro bono legal assistance for family law, housing disputes, and criminal record expungement.",
  eligibilityCriteria: {
    zCodes: ["Z65.0", "Z65.1"],
    income: "low"
  }
}

// Resource 6: Healthcare
{
  name: "Metro Community Health Center",
  category: "Healthcare",
  description: "Primary care, dental, and pharmacy services on a sliding fee scale. No insurance required.",
  eligibilityCriteria: {
    zCodes: [],
    income: "any"
  }
}

// Resource 7: Transportation
{
  name: "Ride Share Program",
  category: "Transportation",
  description: "Free transportation vouchers for medical appointments, job interviews, and essential services.",
  eligibilityCriteria: {
    zCodes: [],
    income: "low"
  }
}
```

## 👥 Sample Enrollees

Add these to `/artifacts/{appId}/public/data/enrollees/`:

```javascript
// Enrollee 1: Sandra Morrison (High Risk - Tier 3)
{
  demographics: {
    firstName: "Sandra",
    lastName: "Morrison",
    dob: "1989-03-15",
    photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=SM"
  },
  careTeam: [
    { userId: "user_cpc_1", name: "Jane Doe", role: "CPC" },
    { userId: "user_rn_1", name: "David Kim", role: "RN Manager" }
  ],
  riskProfile: {
    tier: 3,
    wellnessScores: {
      physical: 35,
      emotional: 25,
      intellectual: 40,
      spiritual: 30,
      social: 20,
      occupational: 15,
      environmental: 25,
      financial: 20
    },
    zCodes: ["Z59.0", "Z63.4", "Z56.9", "Z65.1"],
    lscmiScores: {
      antisocial: 7,
      family: 6,
      education: 4,
      employment: 8,
      leisure: 5,
      companions: 7,
      alcohol: 3,
      attitudes: 6
    }
  }
}

// Enrollee 2: Marcus Thompson (Medium Risk - Tier 2)
{
  demographics: {
    firstName: "Marcus",
    lastName: "Thompson",
    dob: "1995-07-22",
    photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=MT"
  },
  careTeam: [
    { userId: "user_cpc_1", name: "Jane Doe", role: "CPC" }
  ],
  riskProfile: {
    tier: 2,
    wellnessScores: {
      physical: 55,
      emotional: 45,
      intellectual: 60,
      spiritual: 50,
      social: 40,
      occupational: 35,
      environmental: 50,
      financial: 30
    },
    zCodes: ["Z59.4", "Z59.6", "Z56.9"],
    lscmiScores: {}
  }
}

// Enrollee 3: Elena Rodriguez (Low Risk - Tier 1)
{
  demographics: {
    firstName: "Elena",
    lastName: "Rodriguez",
    dob: "2001-11-08",
    photoUrl: "https://placehold.co/100x100/E2E8F0/64748B?text=ER"
  },
  careTeam: [
    { userId: "user_cpc_1", name: "Jane Doe", role: "CPC" }
  ],
  riskProfile: {
    tier: 1,
    wellnessScores: {
      physical: 70,
      emotional: 65,
      intellectual: 75,
      spiritual: 60,
      social: 70,
      occupational: 60,
      environmental: 65,
      financial: 55
    },
    zCodes: [],
    lscmiScores: {}
  }
}
```

## 📝 Sample Care Plan Entries

Add these to `/artifacts/{appId}/public/data/enrollees/{enrolleeId}/carePlan/`:

```javascript
// Note Example
{
  type: "Note",
  timestamp: new Date(),
  authorUserId: "user_cpc_1",
  authorName: "Jane Doe",
  content: "Met with enrollee today. Discussed short-term housing goals and identified barriers to employment. Client is motivated and eager to engage with services. Will follow up next week to review progress on housing applications."
}

// PRAXIS Insight Example
{
  type: "PRAXISInsight",
  timestamp: new Date(),
  authorUserId: "system",
  authorName: "PRAXIS AI",
  content: "Based on recent interactions, this enrollee may benefit from mental health counseling services. Risk indicators suggest elevated stress related to housing instability. Recommend referral to Wellness Center Mental Health Clinic.",
  status: "Pending"
}

// Alert Example
{
  type: "Alert",
  timestamp: new Date(),
  authorUserId: "system",
  authorName: "System",
  content: "⚠️ URGENT: Enrollee has missed 2 consecutive appointments. Wellness check recommended within 48 hours. Last contact: 5 days ago."
}
```

## 🔄 Sample Referrals

Add these to `/artifacts/{appId}/public/data/referrals/`:

```javascript
// Referral 1: Pending
{
  enrolleeId: "enrolleeId_1",
  enrolleeName: "Sandra Morrison",
  resourceId: "resourceId_housing",
  resourceName: "Safe Haven Housing Services",
  referringUserId: "user_cpc_1",
  referringUserName: "jane.doe@sas.org",
  status: "Pending",
  notes: "Client needs emergency housing placement. Currently staying in temporary shelter.",
  createdTimestamp: new Date()
}

// Referral 2: Accepted
{
  enrolleeId: "enrolleeId_2",
  enrolleeName: "Marcus Thompson",
  resourceId: "resourceId_foodbank",
  resourceName: "Community Food Bank",
  referringUserId: "user_cpc_1",
  referringUserName: "jane.doe@sas.org",
  status: "Accepted",
  notes: "Client approved for weekly food parcels starting next Monday.",
  createdTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
}

// Referral 3: Rejected
{
  enrolleeId: "enrolleeId_3",
  enrolleeName: "Elena Rodriguez",
  resourceId: "resourceId_employment",
  resourceName: "Skills Forward Employment Center",
  referringUserId: "user_cpc_1",
  referringUserName: "jane.doe@sas.org",
  status: "Rejected",
  notes: "Client does not meet current employment history requirements. Will retry in 3 months.",
  createdTimestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
}
```

## 🔑 User Profile Setup

Add this to `/artifacts/{appId}/users/{userId}/profile/main`:

```javascript
{
  name: "Jane Doe",
  role: "Certified Peer Counselor",
  email: "jane.doe@sas.org",
  assignedEnrollees: [
    "enrolleeId_1",  // Sandra Morrison
    "enrolleeId_2",  // Marcus Thompson
    "enrolleeId_3"   // Elena Rodriguez
  ]
}
```

## 🚀 Quick Setup Instructions

1. **Set up Firebase project** and configure authentication
2. **Create Firestore database** with the structure outlined in README.md
3. **Add sample resources** first (they don't depend on other data)
4. **Add sample enrollees** and note their document IDs
5. **Update user profile** with the enrollee IDs from step 4
6. **Add care plan entries** using the enrollee IDs
7. **Add referrals** using both enrollee and resource IDs

## 📊 Testing Scenarios

With this sample data, you can test:

✅ Viewing enrollees with different risk tiers (1, 2, 3)  
✅ Filtering resources by enrollee eligibility  
✅ Creating new referrals  
✅ Viewing referral statuses (Pending, Accepted, Rejected)  
✅ Adding care notes  
✅ Accepting/dismissing PRAXIS insights  
✅ Viewing system alerts  
✅ Dashboard metrics with real data  

---

**Note**: Replace placeholder IDs (like `enrolleeId_1`, `resourceId_foodbank`, etc.) with actual Firestore document IDs after creation.

