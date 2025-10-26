# ATLAS - Community Information Exchange Portal

A professional-facing React web application for the ATLAS/PRAXIS Community Information Exchange (CIE) system. This portal enables Peer Counselors, Case Managers, and RNs to manage enrollees, track social risk, coordinate care, and make referrals to community resources.

## 🎯 Overview

ATLAS is designed with a **civic-friendly, accessible** interface focused on mental health and social services. The application emphasizes:

- **Accessibility**: WCAG 2.1 AA compliant, built with shadcn/ui and Radix UI
- **Professional Design**: Calm color palette with soft blues (sky) and greens (emerald)
- **Mental Health Focus**: Clean layouts with generous whitespace and empathetic language
- **Real-time Collaboration**: Firebase/Firestore backend with live updates

## 🚀 Features

### Core Functionality

1. **Dashboard**
   - Overview of enrollee count, pending referrals, and recent updates
   - Regional scoreboard showing community-wide impact metrics
   - Quick access to key metrics and tasks

2. **My Enrollees**
   - View all assigned enrollees in a sortable table
   - Risk tier visualization (Tiers 1-3)
   - Care team size indicators
   - Click-through to detailed enrollee profiles

3. **Enrollee Profile Pages**
   - **Risk Rating Tab**: Interactive pie chart showing 8 Dimensions of Wellness
     - Physical, Emotional, Intellectual, Spiritual, Social, Occupational, Environmental, Financial
     - Expandable accordion for risk tiers (Z-Codes, LS/CMI scores)
   - **Shared Care Plan Tab**: Longitudinal record with:
     - Care notes from team members
     - PRAXIS AI insights with accept/dismiss functionality
     - System alerts
   - **Details Tab**: Demographics and care team information

4. **Community Resources**
   - Searchable directory of community services
   - Dynamic filtering by enrollee eligibility (Z-Codes, income level)
   - Category-coded resources (Food, Housing, Healthcare, etc.)
   - One-click referral creation

5. **Referrals Management**
   - Track all referrals with status updates (Pending, Accepted, Rejected)
   - Referral dialog with enrollee selection and notes
   - Summary statistics (total, pending, accepted, rejected)
   - Real-time status tracking

6. **New Enrollee Creation**
   - Simple form for adding new enrollees
   - Automatic care team assignment
   - Initial risk profile setup

## 🛠 Technology Stack

- **Frontend**: React.js 18.3+ (Vite)
- **UI Framework**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with custom civic theme
- **Icons**: lucide-react
- **Charts**: recharts (for risk visualization)
- **State Management**: React Context (authentication) + local state
- **Backend**: Firebase/Firestore
- **Authentication**: Firebase Auth with custom tokens

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🔥 Firebase Configuration

The app expects the following global variables to be defined:

```javascript
window.__firebase_config = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
}

window.__app_id = "your-app-id"
window.__initial_auth_token = "optional-custom-token"
```

## 📊 Firestore Data Model

### Collections Structure

```
/artifacts/{appId}/
  ├── users/{userId}/profile/{profileDoc}
  │   └── { name, role, email, assignedEnrollees[] }
  │
  └── public/data/
      ├── enrollees/{enrolleeId}
      │   ├── { demographics, careTeam[], riskProfile }
      │   └── carePlan/{noteId}
      │       └── { type, timestamp, authorUserId, content, status }
      │
      ├── resources/{resourceId}
      │   └── { name, category, description, eligibilityCriteria }
      │
      └── referrals/{referralId}
          └── { enrolleeId, resourceId, status, notes, createdTimestamp }
```

### Key Data Schemas

**Enrollee:**
```javascript
{
  demographics: { firstName, lastName, dob, photoUrl },
  careTeam: [{ userId, name, role }],
  riskProfile: {
    tier: 1-3,
    wellnessScores: { physical, emotional, ... },
    zCodes: ["Z59.0", ...],
    lscmiScores: { antisocial, family, ... }
  }
}
```

**Care Plan Entry:**
```javascript
{
  type: "Note" | "PRAXISInsight" | "Alert",
  timestamp: ServerTimestamp,
  authorUserId: string,
  authorName: string,
  content: string,
  status?: "Pending" | "Accepted" | "Dismissed"  // For PRAXIS insights
}
```

**Resource:**
```javascript
{
  name: string,
  category: "Food" | "Housing" | "Healthcare" | ...,
  description: string,
  eligibilityCriteria: {
    zCodes: string[],
    income: string
  }
}
```

**Referral:**
```javascript
{
  enrolleeId: string,
  enrolleeName: string,
  resourceId: string,
  resourceName: string,
  referringUserId: string,
  referringUserName: string,
  status: "Pending" | "Accepted" | "Rejected",
  notes: string,
  createdTimestamp: ServerTimestamp
}
```

## 🎨 Design System

### Colors

- **Primary**: Sky blue (`sky-600`, `#0284c7`)
- **Secondary**: Emerald green (`emerald-600`, `#059669`)
- **Warning**: Amber (`amber-600`, `#d97706`)
- **Destructive**: Rose (`rose-600`, `#e11d48`)

### Risk Tier Colors

- **Tier 1**: Green (basic wellness)
- **Tier 2**: Yellow (social determinants)
- **Tier 3**: Red (criminogenic risk)

## 🔐 Security & Privacy

- Firebase Security Rules should be configured to ensure:
  - Users can only read/write their own profile
  - Enrollee data is shared among assigned care team members
  - Resources are publicly readable
  - Referrals are only visible to the referring user

## 📱 Responsive Design

The application is fully responsive with breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## ♿ Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly (ARIA labels)
- High contrast mode compatible
- Focus indicators on all interactive elements

## 🧪 Development Notes

- The app uses a single-file architecture (`App.jsx`) for simplicity
- All components are defined in `App.jsx`
- Firebase functions are imported inline using `require()`
- State management is handled through React hooks and Context API

## 📝 License

This application is built for the ATLAS/PRAXIS Community Information Exchange system.

## 🤝 Contributing

This is a professional healthcare coordination tool. All contributions should maintain:
1. Accessibility standards (WCAG 2.1 AA)
2. Professional, empathetic tone
3. Clean, maintainable code
4. Comprehensive error handling

---

**Built with ❤️ for community health coordination**

