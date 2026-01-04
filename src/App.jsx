import React, { useState, createContext, useContext, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { 
  getFirestore, 
  setLogLevel,
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore'
import { GoogleMap, Marker, Circle, Polygon, useLoadScript } from '@react-google-maps/api'
import { Home, Users, BookHeart, Send, UserCircle2, LogOut, FileText, PlusCircle, Database, Edit, Trash2, Save, X, MessageCircle, Settings, RefreshCw, Activity, Download, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import * as d3 from 'd3'
import { gsap } from 'gsap'

// ============================================================================
// FIREBASE CONTEXT & AUTHENTICATION
// ============================================================================

const FirebaseContext = createContext(null)

export const useAuthentication = () => {
  const context = useContext(FirebaseContext)
  if (!context) {
    throw new Error('useAuthentication must be used within FirebaseProvider')
  }
  return context
}

function FirebaseProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [db, setDb] = useState(null)
  const [auth, setAuth] = useState(null)

  useEffect(() => {
    // Initialize Firebase using environment variables or global variables
    const firebaseConfig = window.__firebase_config || {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    }

    const app = initializeApp(firebaseConfig)
    const firebaseAuth = getAuth(app)
    const firestore = getFirestore(app)
    
    // Set Firestore debug logging
    setLogLevel('debug')
    
    setAuth(firebaseAuth)
    setDb(firestore)

    // Handle authentication
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        setLoading(false)
      } else {
        // Attempt to sign in with custom token if available
        const customToken = window.__initial_auth_token
        try {
          if (customToken) {
            await signInWithCustomToken(firebaseAuth, customToken)
          } else {
            // Fall back to anonymous auth for demo purposes
            await signInAnonymously(firebaseAuth)
          }
        } catch (error) {
          console.error('Authentication error:', error)
          setLoading(false)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <FirebaseContext.Provider value={{ db, auth, user, loading }}>
      {children}
    </FirebaseContext.Provider>
  )
}

// ============================================================================
// WELLNESS SCORE UTILITIES
// ============================================================================

// Calculate average wellness score from 8 dimensions
function calculateWellnessScore(enrollee) {
  if (!enrollee?.riskProfile?.wellnessScores) return 0
  
  const scores = enrollee.riskProfile.wellnessScores
  const dimensions = [
    scores.physical || 0,
    scores.emotional || 0,
    scores.social || 0,
    scores.intellectual || 0,
    scores.occupational || 0,
    scores.environmental || 0,
    scores.financial || 0,
    scores.spiritual || 0
  ]
  
  const sum = dimensions.reduce((acc, score) => acc + score, 0)
  return Math.round(sum / dimensions.length)
}

// Get color based on wellness score (Green -> Yellow -> Red)
function getWellnessColor(score) {
  if (score >= 70) return { bg: '#22c55e', text: '#16a34a', label: 'Good' } // Green
  if (score >= 40) return { bg: '#eab308', text: '#ca8a04', label: 'At Risk' } // Yellow
  return { bg: '#ef4444', text: '#dc2626', label: 'High Risk' } // Red
}

// Get wellness level for display
function getWellnessLevel(score) {
  if (score >= 70) return 'Good'
  if (score >= 40) return 'At Risk'
  return 'High Risk'
}

// ============================================================================
// PERMISSIONS & ROLES SYSTEM
// ============================================================================

const ROLES = {
  ADMIN: 'Admin',
  ENROLLMENT_MANAGER: 'Enrollment Manager',
  PARTNER: 'Partner'
}

const SERVICE_LINES = [
  { id: 'housing', label: 'Housing Stability', code: 'H', color: '#0039A6' },
  { id: 'financial', label: 'Financial & Food', code: 'F', color: '#FF6319' },
  { id: 'mental', label: 'Mental & Behavioral Health', code: 'M', color: '#B933AD' },
  { id: 'education', label: 'Learning & Skills', code: 'E', color: '#A7A9AC' },
  { id: 'occupational', label: 'Employment & Training', code: 'O', color: '#FCCC0A' },
  { id: 'justice', label: 'Justice & Legal', code: 'J', color: '#996633' },
  { id: 'social', label: 'Social & Family', code: 'S', color: '#EE352E' },
  { id: 'mobility', label: 'Mobility & Transit', code: 'T', color: '#01A89E' },
  { id: 'wellness', label: 'Wellness & Prevention', code: 'W', color: '#6CBE45' },
  { id: 'crisis', label: 'Crisis Response', code: 'C', color: '#FFD700' },
]

const JOURNEY_STRIP_FALLBACK = {
  routeName: 'Episode of Care',
  routeColor: '#00933C',
  phases: [
    { name: 'Regulation', duration: 3 },
    { name: 'Readiness', duration: 5 },
    { name: 'Renewal', duration: 4 }
  ],
  stops: [
    { month: 0.5, name: 'Initial Intake & 8D Assessment', phase: 'Regulation', services: ['H', 'E'] },
    { month: 1.0, name: 'SafetyNet Stabilization', phase: 'Regulation', services: ['H', 'M', 'S'] },
    { month: 2.5, name: 'Z-Code Survey Completed (Tier 2)', phase: 'Regulation', services: ['E', 'F'] },
    { month: 3.5, name: 'LS/CMI Administered (Tier 3)', phase: 'Readiness', services: ['J'] },
    { month: 5.0, name: 'CSC Referral & Engagement', phase: 'Readiness', services: ['M', 'S'] },
    { month: 6.5, name: 'Housing Application Submitted', phase: 'Readiness', services: ['H', 'F'] },
    { month: 7.5, name: 'Occupational Training Start', phase: 'Readiness', services: ['O', 'F'] },
    { month: 9.0, name: 'Peer Mentorship Program', phase: 'Renewal', services: ['S', 'M'] },
    { month: 10.5, name: 'Stable Housing Secured', phase: 'Renewal', services: ['H'] },
    { month: 11.5, name: 'Graduation Milestone', phase: 'Renewal', services: [] },
  ],
  stageMilestones: [
    { month: 0.5, code: 'H', label: 'Housing Stability', lane: 0 },
    { month: 2.5, code: 'F', label: 'Financial & Food', lane: 0 },
    { month: 5.0, code: 'M', label: 'Mental & Behavioral Health', lane: 0 },
    { month: 5.0, code: 'E', label: 'Learning & Skills', lane: 1 },
    { month: 7.5, code: 'O', label: 'Employment Support', lane: -1 },
    { month: 9.5, code: 'S', label: 'Social & Family', lane: 0 },
  ],
  currentProgress: 7.8,
}

const PERMISSIONS = {
  // Enrollee permissions
  CREATE_ENROLLEE: ['Admin', 'Enrollment Manager'],
  EDIT_ENROLLEE: ['Admin', 'Enrollment Manager'],
  DELETE_ENROLLEE: ['Admin'],
  VIEW_ENROLLEE: ['Admin', 'Enrollment Manager'],

  // Resource permissions
  CREATE_RESOURCE: ['Admin'],
  EDIT_RESOURCE: ['Admin'],
  DELETE_RESOURCE: ['Admin'],
  VIEW_RESOURCE: ['Admin', 'Enrollment Manager', 'Partner'],

  // Referral permissions
  CREATE_REFERRAL: ['Admin', 'Enrollment Manager'],
  EDIT_REFERRAL: ['Admin', 'Enrollment Manager'],
  CANCEL_REFERRAL: ['Admin', 'Enrollment Manager'],
  VIEW_REFERRAL: ['Admin', 'Enrollment Manager', 'Partner'],
  RESPOND_REFERRAL: ['Admin', 'Partner'],

  // Care Plan permissions
  CREATE_CARE_NOTE: ['Admin', 'Enrollment Manager'],
  EDIT_CARE_NOTE: ['Admin', 'Enrollment Manager'],
  DELETE_CARE_NOTE: ['Admin'],

  // System permissions
  LOAD_SAMPLE_DATA: ['Admin'],
  MANAGE_USERS: ['Admin'],
  ADMIN_PORTAL: ['Admin']
}

// Hook to check user permissions
function usePermissions() {
  const { user, db } = useAuthentication()
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const appId = window.__app_id || 'demo-app'

  useEffect(() => {
    if (!db || !user?.uid) {
      setLoading(false)
      return
    }

    const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`)
    const unsubscribe = onSnapshot(profileRef, (profileSnap) => {
      if (profileSnap.exists()) {
        const role = profileSnap.data().role || 'CPC'
        setUserRole(role)
      } else {
        setUserRole('CPC') // Default role
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, user, appId])

  const hasPermission = (permission) => {
    if (!userRole) return false
    const allowedRoles = PERMISSIONS[permission] || []
    return allowedRoles.includes(userRole)
  }

  const isAdmin = userRole === ROLES.ADMIN
  const isEnrollmentManager = userRole === ROLES.ENROLLMENT_MANAGER
  const isPartner = userRole === ROLES.PARTNER

  return {
    userRole,
    hasPermission,
    isAdmin,
    isEnrollmentManager,
    isPartner,
    loading
  }
}

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

function Sidebar({ currentPage, setCurrentPage }) {
  const { hasPermission, isAdmin, isPartner } = usePermissions()

  const partnerNavItems = [
    { id: 'provider-dashboard', label: 'Partner Pulse', description: 'Shared referrals & scoreboards', icon: Home },
    { id: 'referral-inbox', label: 'Active Routes', description: 'Respond to new handoffs', icon: Send },
    { id: 'resources', label: 'Resource Atlas', description: 'Directory of stabilization partners', icon: BookHeart },
  ]

  const enrollmentManagerNavItems = [
    { id: 'dashboard', label: 'Network Pulse', description: 'Scoreboard across your caseload', icon: Home, permission: null },
    { id: 'enrollees', label: 'Care Journeys', description: 'Strip map view for each participant', icon: Users, permission: 'VIEW_ENROLLEE' },
    { id: 'journey-strip', label: 'Journey Strip Map', description: 'Prototype visual narrative', icon: Map, permission: 'VIEW_ENROLLEE' },
    { id: 'resources', label: 'Resource Atlas', description: 'Browse offerings by Z-code line', icon: BookHeart, permission: 'VIEW_RESOURCE' },
    { id: 'referrals', label: 'Referral Routes', description: 'Coordinate current and new routes', icon: Send, permission: 'VIEW_REFERRAL' },
    { id: 'create', label: 'Enroll Participant', description: 'Launch a new episode of care', icon: PlusCircle, permission: 'CREATE_ENROLLEE' },
    { id: 'load-data', label: 'Sandbox Data', description: 'Reset demo strip maps', icon: Database, permission: 'LOAD_SAMPLE_DATA' },
  ]

  const adminNavItems = [
    { id: 'admin-portal', label: 'System Console', description: 'Manage identities & roles', icon: UserCircle2, divider: true },
    { id: 'dashboard', label: 'Network Pulse', description: 'Scoreboard across the network', icon: Home },
    { id: 'enrollees', label: 'Care Journeys', description: 'Participant strip map view', icon: Users },
    { id: 'journey-strip', label: 'Journey Strip Map', description: 'Prototype visual narrative', icon: Map },
    { id: 'resources', label: 'Resource Atlas', description: 'Full stabilization directory', icon: BookHeart },
    { id: 'referrals', label: 'Referral Routes', description: 'Monitor all handoffs', icon: Send },
    { id: 'create', label: 'Enroll Participant', description: 'Launch a new episode', icon: PlusCircle },
    { id: 'provider-dashboard', label: 'Partner Pulse', description: 'What partners are seeing', icon: Home, divider: true },
    { id: 'referral-inbox', label: 'Active Routes', description: 'Respond to partner requests', icon: Send },
    { id: 'load-data', label: 'Sandbox Data', description: 'Reset demo experience', icon: Database },
  ]

  let allNavItems
  if (isAdmin) {
    allNavItems = adminNavItems
  } else if (isPartner) {
    allNavItems = partnerNavItems
  } else {
    allNavItems = enrollmentManagerNavItems
  }

  const navItems = isAdmin
    ? allNavItems
    : isPartner
      ? allNavItems
      : allNavItems.filter(item => {
          if (!item.permission) return true
          return hasPermission(item.permission)
        })

  return (
    <aside className="relative hidden w-72 shrink-0 flex-col border-r border-white/10 bg-brand-midnight/95 px-6 py-8 backdrop-blur-xl lg:flex">
      <div className="mb-12">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-brand-slate font-display text-lg tracking-[0.12em] text-white">
            A
          </span>
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.4em] text-white">Atlas CIE</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.28em] text-white/60">Regulation → Readiness → Renewal</p>
          </div>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item, index) => {
          const Icon = item.icon
          const isActive = currentPage === item.id

          return (
            <React.Fragment key={item.id}>
              {item.divider && index > 0 && (
                <div className="py-3">
                  <div className="border-t border-white/10" />
                </div>
              )}
              <button
                onClick={() => setCurrentPage(item.id)}
                className={`group relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary/70 bg-white/10 text-white shadow-glow'
                    : 'border-transparent text-slate-300 hover:border-white/20 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span
                  className={`absolute left-0 top-0 h-full w-1 bg-primary transition-opacity ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                  }`}
                  aria-hidden
                />
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 ${isActive ? 'bg-white/10 text-white' : 'text-slate-200'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <span className="block text-base font-medium tracking-tight text-white">{item.label}</span>
                    {item.description && (
                      <span className="mt-1 block text-sm text-white/65">{item.description}</span>
                    )}
                  </div>
                </div>
              </button>
            </React.Fragment>
          )
        })}
      </nav>

      <div className="mt-auto pt-10">
        <div className="rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-white/70">
          <p className="text-base font-semibold text-white">Strip Map Focus</p>
          <p className="mt-3 leading-relaxed text-white/70">
            Track each journey as it moves from regulation to readiness to renewal. Service line icons surface at every stop.
          </p>
        </div>
      </div>
    </aside>
  )
}

function Header({ user }) {
  const { userRole, isAdmin } = usePermissions()
  const { db } = useAuthentication()
  const [switching, setSwitching] = useState(false)
  const appId = window.__app_id || 'demo-app'

  const userInitials = user?.email 
    ? user.email.substring(0, 2).toUpperCase() 
    : 'U'

  const roleNarrative = {
    [ROLES.ADMIN]: 'Stewarding the network and keeping permissions aligned.',
    [ROLES.ENROLLMENT_MANAGER]: 'Guiding journeys from stabilization to renewal.',
    [ROLES.PARTNER]: 'Responding to incoming routes and coordinating resources.'
  }

  const handleRoleSwitch = async (newRole) => {
    if (!db || !user?.uid) return
    setSwitching(true)
    try {
      const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`)
      await setDoc(
        profileRef,
        {
          role: newRole,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      )
    } catch (error) {
      console.error('Error switching role:', error)
      alert('Failed to switch role')
    } finally {
      setSwitching(false)
    }
  }
  
  return (
    <header className="border-b border-white/10 px-6 py-7 text-white backdrop-blur lg:px-14">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.48em] text-white/55">Atlas Command</span>
          <h2 className="mt-3 font-semibold text-white">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}.
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-white/70">
            {roleNarrative[userRole] || 'Coordinating stabilization lines across the Social Aid Society network.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {userRole && (
            <span className="hidden rounded-full border border-primary/40 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.3em] text-primary md:inline-flex">
              {userRole}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-3 border-white/15 bg-white/5 text-sm text-slate-200 backdrop-blur-sm hover:border-primary/60"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span>{user?.email || 'User'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 border border-white/10 bg-brand-slate text-slate-100">
              <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                My account
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />

              <DropdownMenuLabel className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                Switch role
              </DropdownMenuLabel>
              {[ROLES.ADMIN, ROLES.ENROLLMENT_MANAGER, ROLES.PARTNER].map(role => (
                <DropdownMenuItem
                  key={role}
                  onClick={() => handleRoleSwitch(role)}
                  disabled={switching || userRole === role}
                  className="text-slate-200 focus:bg-white/10"
                >
                  <RefreshCw className="mr-2 h-4 w-4 text-primary" />
                  <span>{role}</span>
                  {userRole === role && <span className="ml-auto text-xs text-primary">Current</span>}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator className="bg-white/10" />

              {isAdmin && (
                <>
                  <DropdownMenuItem
                    onClick={() => (window.location.hash = 'admin-portal')}
                    className="text-slate-200 focus:bg-white/10"
                  >
                    <Settings className="mr-2 h-4 w-4 text-primary" />
                    <span>Open System Console</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                </>
              )}

              <DropdownMenuItem className="text-slate-200 focus:bg-white/10">
                <UserCircle2 className="mr-2 h-4 w-4 text-primary" />
                <span>View profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem className="text-slate-200 focus:bg-white/10">
                <LogOut className="mr-2 h-4 w-4 text-primary" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function MainLayout({ children, currentPage, setCurrentPage, user }) {
  return (
    <div className="relative flex min-h-screen bg-brand-midnight text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-transparent" />
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="relative z-10 flex flex-1 flex-col">
        <Header user={user} />
        <main className="flex-1 px-6 py-10 lg:px-14 lg:py-12">
          {children}
        </main>
      </div>
    </div>
  )
}

// ============================================================================
// GEOGRAPHIC HEAT MAP & ANALYTICS COMPONENTS
// ============================================================================

function GeographicHeatMap({ enrollees }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const [map, setMap] = useState(null)
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [showPolygons, setShowPolygons] = useState(true)
  const [selectedPolygon, setSelectedPolygon] = useState(null)
  const [zipCodePolygons, setZipCodePolygons] = useState([])
  const [loadingPolygons, setLoadingPolygons] = useState(true)

  // Use the useLoadScript hook
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || ''
  })

  // Load real Census ZIP code boundaries
  useEffect(() => {
    console.log('🗺️ Loading real Census ZIP code boundaries...')
    fetch('/wa-zip-codes.geojson')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(geoData => {
        console.log(`✅ Loaded ${geoData.features.length} ZIP code polygons`)
        
        // Convert GeoJSON features to polygon format
        const polygons = geoData.features.map(feature => {
          // GeoJSON uses [longitude, latitude] - need to swap to [latitude, longitude]
          let coordinates = []
          
          if (feature.geometry.type === 'Polygon') {
            // Take the outer ring (first array of coordinates)
            coordinates = feature.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }))
          } else if (feature.geometry.type === 'MultiPolygon') {
            // For MultiPolygon, take the first polygon's outer ring
            coordinates = feature.geometry.coordinates[0][0].map(([lng, lat]) => ({ lat, lng }))
          }
          
          return {
            zipCode: feature.properties.zipCode,
            name: `ZIP ${feature.properties.zipCode}`,
            coordinates: coordinates,
            areaLand: feature.properties.areaLand,
            areaWater: feature.properties.areaWater
          }
        })
        
        setZipCodePolygons(polygons)
        setLoadingPolygons(false)
      })
      .catch(error => {
        console.error('❌ Error loading ZIP codes:', error)
        console.log('ℹ️ Using fallback demo polygons')
        setLoadingPolygons(false)
        // Keep empty array - will use demo polygons as fallback
      })
  }, [])

  // Real Seattle/Tacoma area addresses with actual coordinates AND ZIP codes
  const seattleLocations = [
    { lat: 47.6062, lng: -122.3321, address: 'Downtown Seattle', zipCode: '98101' },
    { lat: 47.5650, lng: -122.2766, address: 'Rainier Valley, Seattle', zipCode: '98118' },
    { lat: 47.6740, lng: -122.1215, address: 'Redmond', zipCode: '98052' },
    { lat: 47.2529, lng: -122.4443, address: 'Tacoma', zipCode: '98402' },
    { lat: 47.4668, lng: -122.3489, address: 'Kent', zipCode: '98032' },
    { lat: 47.3073, lng: -122.2284, address: 'Auburn', zipCode: '98001' },
  ]

  // Assign each enrollee to a real location with ZIP code
  const enrolleeLocations = enrollees.map((enrollee, index) => {
    const location = seattleLocations[index % seattleLocations.length]
    const score = calculateWellnessScore(enrollee)
    
    console.log(`Enrollee ${index}:`, {
      name: `${enrollee.demographics?.firstName} ${enrollee.demographics?.lastName}`,
      score,
      lat: location.lat,
      lng: location.lng,
      address: location.address,
      zipCode: location.zipCode
    })
    
    return {
      lat: location.lat,
      lng: location.lng,
      address: location.address,
      zipCode: location.zipCode,
      enrollee,
      score
    }
  })

  console.log('Total enrollee locations:', enrolleeLocations.length)

  // Calculate aggregate wellness scores per ZIP code
  const zipCodeStats = zipCodePolygons.map(polygon => {
    const enrolleesInZip = enrolleeLocations.filter(loc => loc.zipCode === polygon.zipCode)
    const avgScore = enrolleesInZip.length > 0
      ? Math.round(enrolleesInZip.reduce((sum, loc) => sum + loc.score, 0) / enrolleesInZip.length)
      : null
    
    const color = avgScore ? getWellnessColor(avgScore) : { bg: '#94a3b8', text: '#64748b', label: 'No Data' }
    
    return {
      ...polygon,
      enrolleeCount: enrolleesInZip.length,
      avgWellnessScore: avgScore,
      color: color
    }
  })

  console.log('ZIP Code Stats:', zipCodeStats)

  // Group enrollees by wellness level
  const wellnessStats = {
    good: enrolleeLocations.filter(loc => loc.score >= 70).length,
    atRisk: enrolleeLocations.filter(loc => loc.score >= 40 && loc.score < 70).length,
    highRisk: enrolleeLocations.filter(loc => loc.score < 40).length
  }

  // Seattle/Washington State center
  const mapCenter = { lat: 47.6062, lng: -122.3321 }

  // Auto-fit bounds to show all markers (only when map is available)
  useEffect(() => {
    if (map && enrolleeLocations.length > 0 && window.google?.maps) {
      console.log('Auto-fitting map bounds to', enrolleeLocations.length, 'locations')
      const bounds = new window.google.maps.LatLngBounds()
      enrolleeLocations.forEach((location, index) => {
        const point = { lat: location.lat, lng: location.lng }
        console.log(`Adding point ${index} to bounds:`, point)
        bounds.extend(point)
      })
      map.fitBounds(bounds)
      
      // Add padding after fitBounds
      setTimeout(() => {
        const currentZoom = map.getZoom()
        if (currentZoom > 11) {
          map.setZoom(11) // Don't zoom in too much
        }
        console.log('Map zoom level:', map.getZoom())
      }, 100)
    }
  }, [map])

  // Helper function to get Google Maps colored marker URL (HTTPS!)
  const getMarkerIcon = (score) => {
    // IMPORTANT: Use HTTPS not HTTP
    if (score >= 70) return 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
    if (score >= 40) return 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'
    return 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
  }

  // Add native markers directly to map as fallback
  useEffect(() => {
    if (!map || !window.google?.maps) return
    
    console.log('🔧 Adding native Google Maps markers as fallback...')
    const markers = []
    
    enrolleeLocations.forEach((location, index) => {
      const marker = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: map,
        title: `${location.enrollee.demographics?.firstName} ${location.enrollee.demographics?.lastName}`,
        icon: {
          url: getMarkerIcon(location.score),
          scaledSize: new window.google.maps.Size(32, 32)
        }
      })
      
      marker.addListener('click', () => {
        console.log('Native marker clicked:', location.enrollee.demographics?.firstName)
        setSelectedMarker(location)
      })
      
      markers.push(marker)
      console.log(`✅ Native marker ${index} added at`, location.lat, location.lng)
    })
    
    return () => {
      markers.forEach(m => m.setMap(null))
    }
  }, [map, enrolleeLocations.length])

  // Show error if Maps failed to load
  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geographic Wellness Heat Map</CardTitle>
          <CardDescription>Error loading map</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-sm text-white/75">Failed to load Google Maps. Please check your API key.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show loading state
  if (!isLoaded || !apiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geographic Wellness Heat Map</CardTitle>
          <CardDescription>Enrollee locations color-coded by wellness scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5">
            <div className="max-w-md text-center">
              <h3 className="mb-3 text-2xl font-semibold text-white">
                {!apiKey ? 'Google Maps API Key Required' : 'Loading...'}
              </h3>
              <p className="mb-3 text-base text-white/70">
                {!apiKey 
                  ? 'Add your Google Maps API key to .env:' 
                  : 'Initializing Google Maps...'}
              </p>
              {!apiKey && (
                <code className="block rounded bg-black/80 p-3 text-sm text-primary">
                  VITE_GOOGLE_MAPS_API_KEY=your_key_here
                </code>
              )}
            </div>
          </div>
          
          {/* Wellness Distribution Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center">
              <p className="text-3xl font-semibold text-service-wellness">{wellnessStats.good}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/65">Good (70-100)</p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center">
              <p className="text-3xl font-semibold text-service-occupational">{wellnessStats.atRisk}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/65">At Risk (40-69)</p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center">
              <p className="text-3xl font-semibold text-service-social">{wellnessStats.highRisk}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/65">High Risk (0-39)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Map is loaded and ready
  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Wellness Heat Map</CardTitle>
        <CardDescription>Enrollee locations color-coded by wellness scores (Green = Good, Yellow = At Risk, Red = High Risk)</CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '400px', borderRadius: '0.5rem' }}
          center={mapCenter}
          zoom={9}
          onLoad={(mapInstance) => {
            console.log('Map loaded successfully')
            setMap(mapInstance)
          }}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {/* Heat map circles (markers are added via native API in useEffect) */}
          {enrolleeLocations.map((location, index) => {
            const color = getWellnessColor(location.score)

            return (
              <Circle
                key={`circle-${index}-${location.lat}-${location.lng}`}
                center={{ lat: location.lat, lng: location.lng }}
                radius={5000} // 5km radius
                options={{
                  fillColor: color.bg,
                  fillOpacity: 0.25,
                  strokeColor: color.bg,
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                }}
              />
            )
          })}

          {/* ZIP Code Polygon Layer - Shows aggregate wellness by jurisdiction */}
          {showPolygons && zipCodeStats.map((zipData, index) => (
            <Polygon
              key={`polygon-${zipData.zipCode}`}
              paths={zipData.coordinates}
              options={{
                fillColor: zipData.color.bg,
                fillOpacity: 0.35,
                strokeColor: zipData.color.text,
                strokeOpacity: 0.9,
                strokeWeight: 2,
                clickable: true,
              }}
              onClick={() => {
                console.log('Polygon clicked:', zipData.name)
                setSelectedPolygon(zipData)
              }}
            />
          ))}
        </GoogleMap>
        
        {/* Selected Polygon Info */}
        {selectedPolygon && (
          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h4 className="text-xl font-semibold text-white">{selectedPolygon.name}</h4>
                <p className="text-sm text-white/70">ZIP Code: {selectedPolygon.zipCode}</p>
              </div>
              <button 
                onClick={() => setSelectedPolygon(null)}
                className="text-white/50 transition hover:text-white/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>Enrollees in Area:</span>
                <span className="text-lg font-semibold text-white">{selectedPolygon.enrolleeCount}</span>
              </div>
              {selectedPolygon.avgWellnessScore !== null && (
                <>
                  <div className="flex items-center justify-between">
                    <span>Avg Wellness Score:</span>
                    <span 
                      className="text-lg font-semibold"
                      style={{ color: selectedPolygon.color.text }}
                    >
                      {selectedPolygon.avgWellnessScore}/100
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Area Status:</span>
                    <span 
                      className="rounded px-3 py-1 text-xs font-semibold"
                      style={{ 
                        backgroundColor: `${selectedPolygon.color.bg}40`,
                        color: selectedPolygon.color.text
                      }}
                    >
                      {selectedPolygon.color.label}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Selected Marker Info */}
        {selectedMarker && (
          <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-5">
            <div className="mb-3 flex items-start justify-between">
              <h4 className="text-xl font-semibold text-white">
                {selectedMarker.enrollee.demographics?.firstName} {selectedMarker.enrollee.demographics?.lastName}
              </h4>
              <button 
                onClick={() => setSelectedMarker(null)}
                className="text-white/50 transition hover:text-white/80"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>Wellness Score:</span>
                <span 
                  className="text-lg font-semibold"
                  style={{ color: getWellnessColor(selectedMarker.score).text }}
                >
                  {selectedMarker.score}/100
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <span 
                  className="rounded px-3 py-1 text-xs font-semibold"
                  style={{ 
                    backgroundColor: `${getWellnessColor(selectedMarker.score).bg}20`,
                    color: getWellnessColor(selectedMarker.score).text
                  }}
                >
                  {getWellnessColor(selectedMarker.score).label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>ZIP Code:</span>
                <span className="font-medium text-white">{selectedMarker.zipCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Risk Tier:</span>
                <span className="font-medium text-white">
                  Tier {selectedMarker.enrollee.riskProfile?.tier || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Map Legend & Controls */}
        <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-base font-semibold text-white">Map Legend</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPolygons(!showPolygons)}
              className="text-xs text-white/85"
            >
              {showPolygons ? '🗺️ Hide ZIP Zones' : '🗺️ Show ZIP Zones'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 text-white/70">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-service-wellness"></div>
              <span className="text-xs uppercase tracking-[0.22em]">
                Good Wellness (70-100)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-service-occupational"></div>
              <span className="text-xs uppercase tracking-[0.22em]">
                At Risk (40-69)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-service-social"></div>
              <span className="text-xs uppercase tracking-[0.22em]">
                High Risk (0-39)
              </span>
            </div>
          </div>
        </div>

        {/* Note about demo locations */}
        <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4">
          <p className="text-xs text-white/70">
            <strong className="text-white">📍 Real Locations:</strong> Enrollees are mapped to actual Seattle/Tacoma area locations: 
            Downtown Seattle, Rainier Valley, Redmond, Tacoma, Kent, and Auburn.
            In production, actual enrollee addresses would be geocoded from their profile data.
          </p>
        </div>

        {/* Polygon Layer Info */}
        <div className="mt-4 rounded-2xl border border-white/12 bg-white/5 p-4">
          {loadingPolygons ? (
            <p className="text-xs text-white/70">
              <strong className="text-white">⏳ Loading ZIP Code Data...</strong> Fetching real US Census TIGER/Line boundaries for Washington State...
            </p>
          ) : zipCodePolygons.length > 0 ? (
            <p className="text-xs text-white/70">
              <strong className="text-white">🗺️ Real Census Data Loaded!</strong> Displaying {zipCodePolygons.length} actual Washington State ZIP code boundaries 
              from US Census Bureau TIGER/Line 2023 Shapefiles. Polygons are colored by aggregate wellness scores. 
              Toggle "Show ZIP Zones" to view boundaries, and click any zone to see detailed statistics.
            </p>
          ) : (
            <p className="text-xs text-white/70">
              <strong className="text-white">⚠️ Using Demo Data:</strong> Real Census polygons failed to load. Showing simplified demo boundaries. 
              Check console for errors or refresh to try again.
            </p>
          )}
        </div>

        {/* Wellness Distribution Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center">
            <p className="text-3xl font-semibold text-service-wellness">{wellnessStats.good}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/65">Good (70-100)</p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center">
            <p className="text-3xl font-semibold text-service-occupational">{wellnessStats.atRisk}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/65">At Risk (40-69)</p>
          </div>
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 text-center">
            <p className="text-3xl font-semibold text-service-social">{wellnessStats.highRisk}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/65">High Risk (0-39)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Risk Assessment Timeline Component
function RiskAssessmentTimeline({ enrolleeId, enrollee }) {
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedAssessment, setSelectedAssessment] = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)
  const { db } = useContext(FirebaseContext)

  // Load assessment history
  useEffect(() => {
    if (!enrolleeId) return

    const loadAssessments = async () => {
      try {
        setLoading(true)
        
        // Check if AlayaCare integration is enabled
        const alayacareEnabled = import.meta.env.VITE_ALAYACARE_ENABLED === 'true'
        
        if (alayacareEnabled && enrollee?.alayacareClientId) {
          // Try to fetch from AlayaCare
          setSyncStatus('Syncing with AlayaCare...')
          
          try {
            const { getAlayaCareClient } = await import('./services/alayacare-client.js')
            const { createAssessmentTimeline } = await import('./services/alayacare-mapper.js')
            
            const client = getAlayaCareClient()
            const rawAssessments = await client.getClientAssessments(enrollee.alayacareClientId, {
              startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Last 12 months
              endDate: new Date().toISOString()
            })
            
            const timeline = createAssessmentTimeline(rawAssessments)
            setAssessments(timeline)
            setSyncStatus(`✅ Synced ${timeline.length} assessments from AlayaCare`)
            
          } catch (error) {
            console.warn('AlayaCare sync failed, using local data:', error)
            setSyncStatus('Using local data (AlayaCare unavailable)')
            loadLocalAssessments()
          }
        } else {
          // Use demo/local data
          setSyncStatus('Using local data')
          loadLocalAssessments()
        }
        
      } catch (error) {
        console.error('Error loading assessments:', error)
        setSyncStatus('Error loading assessments')
      } finally {
        setLoading(false)
      }
    }

    const loadLocalAssessments = () => {
      // Generate demo timeline data
      const now = Date.now()
      const demoAssessments = [
        {
          id: 'demo-1',
          date: new Date(now - 270 * 24 * 60 * 60 * 1000).toISOString(), // 9 months ago
          tier: 3,
          totalScore: 35,
          assessor: 'Dr. Sarah Johnson',
          formName: 'LS/CMI Initial Assessment',
          scores: {
            criminal: 5, education: 4, financial: 5, family: 4,
            accommodation: 4, leisure: 3, companions: 4, alcohol: 3, attitudes: 2, antisocial: 1
          }
        },
        {
          id: 'demo-2',
          date: new Date(now - 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months ago
          tier: 3,
          totalScore: 32,
          assessor: 'John Smith, LMHC',
          formName: 'LS/CMI Follow-up',
          scores: {
            criminal: 5, education: 3, financial: 4, family: 4,
            accommodation: 4, leisure: 3, companions: 3, alcohol: 3, attitudes: 2, antisocial: 1
          }
        },
        {
          id: 'demo-3',
          date: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months ago
          tier: 2,
          totalScore: 24,
          assessor: 'Maria Rodriguez, MSW',
          formName: 'LS/CMI Progress Check',
          scores: {
            criminal: 4, education: 2, financial: 3, family: 3,
            accommodation: 3, leisure: 2, companions: 3, alcohol: 2, attitudes: 1, antisocial: 1
          }
        },
        {
          id: 'demo-4',
          date: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks ago
          tier: 1,
          totalScore: 18,
          assessor: 'Dr. Michael Chen',
          formName: 'LS/CMI Current Assessment',
          scores: {
            criminal: 3, education: 1, financial: 2, family: 2,
            accommodation: 2, leisure: 2, companions: 2, alcohol: 2, attitudes: 1, antisocial: 1
          }
        }
      ]
      
      setAssessments(demoAssessments)
    }

    loadAssessments()
  }, [enrolleeId, enrollee, db])

  // Calculate trend
  const getTrend = () => {
    if (assessments.length < 2) return null
    const first = assessments[0]
    const last = assessments[assessments.length - 1]
    const scoreChange = first.totalScore - last.totalScore
    
    if (scoreChange > 5) return { direction: 'improving', label: 'Significant Improvement', color: 'text-green-600', icon: '📈' }
    if (scoreChange > 0) return { direction: 'improving', label: 'Improving', color: 'text-emerald-600', icon: '↗️' }
    if (scoreChange < -5) return { direction: 'declining', label: 'Declining', color: 'text-red-600', icon: '📉' }
    if (scoreChange < 0) return { direction: 'declining', label: 'Slight Decline', color: 'text-amber-600', icon: '↘️' }
    return { direction: 'stable', label: 'Stable', color: 'text-slate-600', icon: '→' }
  }

  const trend = getTrend()

  const getTierColor = (tier) => {
    if (tier === 1) return { bg: 'bg-green-500', text: 'text-green-700', label: 'Low Risk' }
    if (tier === 2) return { bg: 'bg-yellow-500', text: 'text-yellow-700', label: 'Moderate Risk' }
    return { bg: 'bg-red-500', text: 'text-red-700', label: 'High Risk' }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Risk Assessment Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            Loading assessment history...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Risk Assessment Timeline
          </CardTitle>
          {syncStatus && (
            <span className="text-xs text-slate-500">{syncStatus}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {assessments.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No assessment history available</p>
            <p className="text-xs mt-2">Assessments will appear here once synced from AlayaCare</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Timeline visualization */}
            <div className="relative py-4">
              {/* Timeline line */}
              <div className="absolute left-0 right-0 top-1/2 h-1 bg-white/20"></div>
              
              {/* Timeline points */}
              <div className="relative flex justify-between items-center">
                {assessments.map((assessment, index) => {
                  const tierColor = getTierColor(assessment.tier)
                  return (
                    <button
                      key={assessment.id}
                      onClick={() => setSelectedAssessment(assessment)}
                      className="flex flex-col items-center gap-2 group cursor-pointer"
                    >
                      {/* Point */}
                      <div className={`w-6 h-6 rounded-full ${tierColor.bg} border-4 border-white shadow-lg group-hover:scale-125 transition-transform z-10`}></div>
                      
                      {/* Date & Details */}
                      <div className="min-w-[100px] text-center text-white/70">
                        <div className="text-xs font-medium text-white">
                          {new Date(assessment.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </div>
                        <div className={`text-xs font-bold ${tierColor.text}`}>
                          Tier {assessment.tier}
                        </div>
                        <div className="text-xs text-white/55">
                          Score: {assessment.totalScore}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Trend indicator */}
            {trend && (
              <div className={`rounded-2xl border border-white/12 bg-white/5 p-4 text-center text-white`}>
                <span className="mr-2 text-lg">{trend.icon}</span>
                <span className={`font-semibold ${trend.color}`}>{trend.label}</span>
                <span className="ml-2 text-sm text-white/70">
                  over {assessments.length} assessment{assessments.length > 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Selected assessment details */}
            {selectedAssessment && (
              <div className="rounded-2xl border border-white/12 bg-white/5 p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h4 className="text-xl font-semibold text-white">{selectedAssessment.formName}</h4>
                    <p className="text-sm text-white/70">
                      {new Date(selectedAssessment.date).toLocaleDateString('en-US', { 
                        year: 'numeric', month: 'long', day: 'numeric' 
                      })}
                    </p>
                    <p className="text-xs text-white/55">Assessed by: {selectedAssessment.assessor}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedAssessment(null)}
                    className="text-white/50 transition hover:text-white/80"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">Risk Tier</div>
                    <div className={`text-2xl font-bold ${getTierColor(selectedAssessment.tier).text}`}>
                      Tier {selectedAssessment.tier}
                    </div>
                    <div className="text-xs text-white/60">{getTierColor(selectedAssessment.tier).label}</div>
                  </div>
                  <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/60">Total LS/CMI Score</div>
                    <div className="text-2xl font-bold text-white">{selectedAssessment.totalScore}</div>
                    <div className="text-xs text-white/60">out of 43</div>
                  </div>
                </div>

                {/* Domain scores */}
                <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                  <div className="mb-2 text-sm font-semibold text-white">Domain Scores</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
                    {Object.entries(selectedAssessment.scores || {}).map(([domain, score]) => (
                      <div key={domain} className="flex justify-between">
                        <span className="capitalize">{domain}:</span>
                        <span className="font-medium text-white">{score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Export buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={async () => {
                  const { exportTimelineToPDF } = await import('./services/export-utils.js')
                  exportTimelineToPDF(enrollee, assessments)
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={async () => {
                  const { exportTimelineToExcel } = await import('./services/export-utils.js')
                  exportTimelineToExcel(enrollee, assessments)
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Wellness Dimension Chart Component
function WellnessDimensionChart({ enrollees, onDimensionClick }) {
  // Calculate average scores for each dimension across all enrollees
  const dimensionAverages = {
    physical: 0,
    emotional: 0,
    social: 0,
    intellectual: 0,
    occupational: 0,
    environmental: 0,
    financial: 0,
    spiritual: 0
  }

  if (enrollees.length > 0) {
    enrollees.forEach(enrollee => {
      if (enrollee.riskProfile?.wellnessScores) {
        const scores = enrollee.riskProfile.wellnessScores
        Object.keys(dimensionAverages).forEach(dim => {
          dimensionAverages[dim] += scores[dim] || 0
        })
      }
    })

    Object.keys(dimensionAverages).forEach(dim => {
      dimensionAverages[dim] = Math.round(dimensionAverages[dim] / enrollees.length)
    })
  }

  const dimensions = [
    { name: 'Physical', key: 'physical', score: dimensionAverages.physical },
    { name: 'Emotional', key: 'emotional', score: dimensionAverages.emotional },
    { name: 'Social', key: 'social', score: dimensionAverages.social },
    { name: 'Intellectual', key: 'intellectual', score: dimensionAverages.intellectual },
    { name: 'Occupational', key: 'occupational', score: dimensionAverages.occupational },
    { name: 'Environmental', key: 'environmental', score: dimensionAverages.environmental },
    { name: 'Financial', key: 'financial', score: dimensionAverages.financial },
    { name: 'Spiritual', key: 'spiritual', score: dimensionAverages.spiritual }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>8 Dimensions of Wellness - Average Scores</CardTitle>
        <CardDescription>Click any dimension to see detailed breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dimensions.map(dim => {
            const color = getWellnessColor(dim.score)
            return (
              <button
                key={dim.key}
                onClick={() => onDimensionClick?.(dim)}
                className="w-full rounded-lg p-3 text-left transition-colors hover:bg-white/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{dim.name}</span>
                  <span className="text-sm font-bold" style={{ color: color.text }}>
                    {dim.score}/100
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${dim.score}%`,
                      backgroundColor: color.bg
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Risk Tier Distribution Chart Component
function RiskTierChart({ enrollees, onTierClick }) {
  const tierCounts = {
    tier1: enrollees.filter(e => e.riskProfile?.tier === 1).length,
    tier2: enrollees.filter(e => e.riskProfile?.tier === 2).length,
    tier3: enrollees.filter(e => e.riskProfile?.tier === 3).length,
    noTier: enrollees.filter(e => !e.riskProfile?.tier).length
  }

  const total = enrollees.length
  const tiers = [
    { name: 'Tier 1 - Low Risk', count: tierCounts.tier1, color: '#22c55e', textColor: '#16a34a', tier: 1 },
    { name: 'Tier 2 - Moderate Risk', count: tierCounts.tier2, color: '#eab308', textColor: '#ca8a04', tier: 2 },
    { name: 'Tier 3 - High Risk', count: tierCounts.tier3, color: '#ef4444', textColor: '#dc2626', tier: 3 },
    { name: 'Not Assessed', count: tierCounts.noTier, color: '#94a3b8', textColor: '#64748b', tier: null }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Tier Distribution</CardTitle>
        <CardDescription>Click any tier to view enrollees</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tiers.map(tier => {
            const percentage = total > 0 ? Math.round((tier.count / total) * 100) : 0
            return (
              <button
                key={tier.name}
                onClick={() => onTierClick?.(tier)}
                className="w-full rounded-lg border border-white/12 p-4 text-left transition-colors hover:bg-white/10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{tier.name}</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold" style={{ color: tier.textColor }}>
                      {tier.count}
                    </span>
                    <span className="text-sm text-slate-500 ml-2">
                      ({percentage}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: tier.color
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// PAGE COMPONENTS (Placeholders for now)
// ============================================================================

function DashboardPage() {
  const { db, user } = useAuthentication()
  const [pendingReferrals, setPendingReferrals] = useState([])
  const [recentUpdates, setRecentUpdates] = useState([])
  const [enrolleeCount, setEnrolleeCount] = useState(0)
  const [enrollees, setEnrollees] = useState([]) // For analytics
  const [loading, setLoading] = useState(true)
  const [selectedDimension, setSelectedDimension] = useState(null)
  const [selectedTier, setSelectedTier] = useState(null)
  const appId = window.__app_id || 'demo-app'

  // Fetch pending referrals
  useEffect(() => {
    if (!db || !user?.uid) return

    const referralsRef = collection(db, `artifacts/${appId}/public/data/referrals`)
    const q = query(
      referralsRef,
      where('referringUserId', '==', user.uid),
      where('status', '==', 'Pending')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const referralsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setPendingReferrals(referralsData)
    })

    return () => unsubscribe()
  }, [db, user, appId])

  // Fetch recent updates (Accepted/Rejected in last 24h)
  useEffect(() => {
    if (!db || !user?.uid) return

    const referralsRef = collection(db, `artifacts/${appId}/public/data/referrals`)
    const q = query(
      referralsRef,
      where('referringUserId', '==', user.uid),
      where('status', 'in', ['Accepted', 'Rejected'])
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date()
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      
      const recentData = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(referral => {
          if (!referral.createdTimestamp) return false
          const createdDate = referral.createdTimestamp.toDate 
            ? referral.createdTimestamp.toDate() 
            : new Date(referral.createdTimestamp)
          return createdDate >= twentyFourHoursAgo
        })
      
      setRecentUpdates(recentData)
    })

    return () => unsubscribe()
  }, [db, user, appId])

  // Fetch enrollee count AND full enrollee data for analytics
  useEffect(() => {
    if (!db || !user?.uid) return

    const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`)
    
    const unsubscribe = onSnapshot(profileRef, async (profileSnap) => {
      if (profileSnap.exists()) {
        const profileData = profileSnap.data()
        const assignedEnrollees = profileData.assignedEnrollees || []
        setEnrolleeCount(assignedEnrollees.length)

        // Fetch full enrollee data for analytics
        if (assignedEnrollees.length > 0) {
          const enrolleesRef = collection(db, `artifacts/${appId}/public/data/enrollees`)
          const q = query(enrolleesRef)
          const snapshot = await getDocs(q)
          const enrolleesData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(e => assignedEnrollees.includes(e.id))
          setEnrollees(enrolleesData)
        }
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, user, appId])

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Network Pulse</h1>
        <p className="text-sm text-slate-300">Calibrating your strip map signals…</p>
      </div>
    )
  }

  const handleExportDashboard = async (format) => {
    const { calculateDashboardAnalytics } = await import('./services/analytics-service.js')
    const analytics = calculateDashboardAnalytics(enrollees, pendingReferrals)
    
    if (format === 'pdf') {
      const { exportDashboardAnalyticsToPDF } = await import('./services/export-utils.js')
      exportDashboardAnalyticsToPDF(analytics)
    } else {
      const { exportDashboardAnalyticsToExcel } = await import('./services/export-utils.js')
      exportDashboardAnalyticsToExcel(analytics)
    }
  }

  return (
    <div>
      <div className="mb-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-semibold text-white">Network Pulse</h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-white/70">
              Live scoreboard for journeys moving from regulation to renewal.
            </p>
          </div>
          {enrollees.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 text-slate-200"
                onClick={() => handleExportDashboard('pdf')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Download PDF Brief
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/30 text-slate-200"
                onClick={() => handleExportDashboard('excel')}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </div>
          )}
        </div>

        {/* Service Line Legend */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
          {SERVICE_LINES.map(line => (
            <div key={line.id} className="flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: line.color }}
              >
                {line.code}
              </span>
              <span className="text-sm uppercase tracking-[0.28em] text-white/70">{line.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/40 via-white/15 to-transparent" />
          <CardHeader>
            <CardDescription className="flex items-center gap-4 text-sm font-medium uppercase tracking-[0.4em] text-white/65">
              <Users className="h-6 w-6 text-service-housing" />
              Active care journeys
            </CardDescription>
            <CardTitle className="mt-4 text-5xl font-semibold text-white">{enrolleeCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-white/70">
              Participants progressing along the regulation → readiness → renewal strip map.
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/40 via-white/15 to-transparent" />
          <CardHeader>
            <CardDescription className="flex items-center gap-4 text-sm font-medium uppercase tracking-[0.4em] text-white/65">
              <Send className="h-6 w-6 text-service-financial" />
              Routes awaiting response
            </CardDescription>
            <CardTitle className="mt-4 text-5xl font-semibold text-white">{pendingReferrals.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-white/70">
              Referrals in motion that still require partner confirmation.
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/40 via-white/15 to-transparent" />
          <CardHeader>
            <CardDescription className="flex items-center gap-4 text-sm font-medium uppercase tracking-[0.4em] text-white/65">
              <BookHeart className="h-6 w-6 text-service-social" />
              Signals in last 24 hours
            </CardDescription>
            <CardTitle className="mt-4 text-5xl font-semibold text-white">{recentUpdates.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed text-white/70">
              Accepted or declined referrals that need a follow-up touch.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Referrals Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-white">Pending referrals</CardTitle>
            <CardDescription className="text-base text-white/65">Routes awaiting partner confirmation</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingReferrals.length === 0 ? (
              <p className="text-base text-white/65">No pending referrals at this time.</p>
            ) : (
              <div className="space-y-3">
                {pendingReferrals.slice(0, 5).map((referral) => (
                  <div key={referral.id} className="flex items-start justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{referral.enrolleeName}</p>
                      <p className="text-sm text-white/65">{referral.resourceName}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-service-crisis">
                      Pending
                    </span>
                  </div>
                ))}
                {pendingReferrals.length > 5 && (
                  <p className="text-center text-sm text-white/55">
                    And {pendingReferrals.length - 5} more…
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* New Updates Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-white">New updates</CardTitle>
            <CardDescription className="text-base text-white/65">Responses in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            {recentUpdates.length === 0 ? (
              <p className="text-base text-white/65">No new updates in the last 24 hours.</p>
            ) : (
              <div className="space-y-3">
                {recentUpdates.map((referral) => (
                  <div key={referral.id} className="flex items-start justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{referral.enrolleeName}</p>
                      <p className="text-sm text-white/65">{referral.resourceName}</p>
                      <p className="mt-1 text-sm text-white/55">{formatTimestamp(referral.createdTimestamp)}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium ${
                      referral.status === 'Accepted'
                        ? 'text-service-wellness'
                        : 'text-service-social'
                    }`}>
                      {referral.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Geographic Heat Map */}
      {enrollees.length > 0 && (
        <div className="mt-6">
          <GeographicHeatMap enrollees={enrollees} />
        </div>
      )}

      {/* Analytics Charts Grid */}
      {enrollees.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <WellnessDimensionChart 
            enrollees={enrollees}
            onDimensionClick={(dim) => setSelectedDimension(dim)}
          />
          <RiskTierChart 
            enrollees={enrollees}
            onTierClick={(tier) => setSelectedTier(tier)}
          />
        </div>
      )}

      {/* Drill-down dialogs */}
      {selectedDimension && (
        <Dialog open={!!selectedDimension} onOpenChange={() => setSelectedDimension(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedDimension.name} Wellness - Detailed View</DialogTitle>
              <DialogDescription>
                Enrollees with scores in this dimension
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {enrollees
                .filter(e => e.riskProfile?.wellnessScores?.[selectedDimension.key])
                .sort((a, b) => {
                  const scoreA = a.riskProfile.wellnessScores[selectedDimension.key] || 0
                  const scoreB = b.riskProfile.wellnessScores[selectedDimension.key] || 0
                  return scoreB - scoreA
                })
                .map(enrollee => {
                  const score = enrollee.riskProfile.wellnessScores[selectedDimension.key]
                  const color = getWellnessColor(score)
                  return (
                    <div key={enrollee.id} className="flex items-center justify-between rounded-xl border border-white/12 bg-white/5 p-3">
                      <span className="font-medium text-white">
                        {enrollee.demographics?.firstName} {enrollee.demographics?.lastName}
                      </span>
                      <span className="font-semibold" style={{ color: color.text }}>
                        {score}/100
                      </span>
                    </div>
                  )
                })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedTier && (
        <Dialog open={!!selectedTier} onOpenChange={() => setSelectedTier(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedTier.name}</DialogTitle>
              <DialogDescription>
                {selectedTier.count} enrollee{selectedTier.count !== 1 ? 's' : ''} in this tier
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {enrollees
                .filter(e => selectedTier.tier === null ? !e.riskProfile?.tier : e.riskProfile?.tier === selectedTier.tier)
                .map(enrollee => {
                  const wellnessScore = calculateWellnessScore(enrollee)
                  return (
                    <div key={enrollee.id} className="flex items-center justify-between rounded-xl border border-white/12 bg-white/5 p-3">
                      <div>
                        <p className="font-medium text-white">
                          {enrollee.demographics?.firstName} {enrollee.demographics?.lastName}
                        </p>
                        <p className="text-xs text-white/65">
                          Wellness Score: {wellnessScore}/100 - {getWellnessLevel(wellnessScore)}
                        </p>
                      </div>
                      <span 
                        className="rounded px-3 py-1 text-xs font-semibold"
                        style={{ 
                          backgroundColor: `${selectedTier.color}30`,
                          color: selectedTier.textColor
                        }}
                      >
                        Tier {selectedTier.tier || 'N/A'}
                      </span>
                    </div>
                  )
                })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Regional Scoreboard / Common Agenda Placeholder */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-3xl text-white">
            <BookHeart className="h-6 w-6 text-service-wellness" />
            Regional Scoreboard & Common Agenda
          </CardTitle>
          <CardDescription className="text-base text-white/65">
            Community-wide impact metrics and shared goals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/12 bg-white/5 p-6">
              <h4 className="mb-3 text-2xl font-semibold text-white">Collective Impact Metrics</h4>
              <p className="mb-4 text-base text-white/70">
                Track community-wide outcomes across all service providers in the ATLAS network.
              </p>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-3xl font-semibold text-service-wellness">1,247</p>
                  <p className="mt-1 text-sm uppercase tracking-[0.28em] text-white/60">
                    Total Enrollees
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-semibold text-service-mobility">3,891</p>
                  <p className="mt-1 text-sm uppercase tracking-[0.28em] text-white/60">
                    Successful Referrals
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-semibold text-service-mental">89%</p>
                  <p className="mt-1 text-sm uppercase tracking-[0.28em] text-white/60">
                    Connection Rate
                  </p>
                </div>
              </div>
            </div>
            <div className="text-sm text-white/60">
              <p className="italic">📊 Regional scoreboard data aggregates outcomes from all CIE participants.</p>
              <p className="mt-1 italic">
                🎯 Common Agenda: Reduce homelessness by 25% and improve mental health access by 40% by 2026.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function JourneyStripMapPage() {
  const containerRef = useRef(null)
  const { db } = useAuthentication()
  const appId = window.__app_id || 'demo-app'
  const participantId = 'demo-journey'
  const [journeyData, setJourneyData] = useState(JOURNEY_STRIP_FALLBACK)
  const [journeyLoading, setJourneyLoading] = useState(true)

  useEffect(() => {
    if (!db) {
      setJourneyData(JOURNEY_STRIP_FALLBACK)
      setJourneyLoading(false)
      return
    }

    const journeyRef = doc(db, `artifacts/${appId}/participants/${participantId}/journey/meta`)
    const unsubscribe = onSnapshot(
      journeyRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const payload = snapshot.data() || {}
          setJourneyData({
               ...JOURNEY_STRIP_FALLBACK,
               ...payload,
               routeName: payload.routeName || JOURNEY_STRIP_FALLBACK.routeName,
               routeColor: payload.routeColor || JOURNEY_STRIP_FALLBACK.routeColor,
               currentProgress: payload.currentProgress ?? JOURNEY_STRIP_FALLBACK.currentProgress,
               phases: payload.phases || JOURNEY_STRIP_FALLBACK.phases,
               stops: payload.stops || JOURNEY_STRIP_FALLBACK.stops,
               stageMilestones: payload.stageMilestones || JOURNEY_STRIP_FALLBACK.stageMilestones,
          })
        } else {
          setJourneyData(JOURNEY_STRIP_FALLBACK)
          setDoc(journeyRef, JOURNEY_STRIP_FALLBACK).catch((error) => {
            console.error('Failed to seed journey strip data:', error)
          })
        }
        setJourneyLoading(false)
      },
      (error) => {
        console.error('Error loading journey strip data:', error)
        setJourneyData(JOURNEY_STRIP_FALLBACK)
        setJourneyLoading(false)
      }
    )

    return () => unsubscribe()
  }, [db, appId, participantId])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !journeyData) return

    container.innerHTML = ''

    const phases = journeyData.phases || []
    const stops = journeyData.stops || []
    const stageMilestones = journeyData.stageMilestones || []

    const phaseEntries = phases.reduce((accumulator, phase, index) => {
      const duration = Math.max(phase.duration || 0, 0)
      const start = index === 0 ? 0 : accumulator[index - 1].end
      const end = start + duration
      accumulator.push({ phase, index, start, end, center: start + duration / 2, duration })
      return accumulator
    }, [])

    const totalDuration = phaseEntries.length
      ? phaseEntries[phaseEntries.length - 1].end
      : 1

    const serviceColorLookup = SERVICE_LINES.reduce((acc, line) => {
      acc[line.code] = line.color
      return acc
    }, {})

    const margin = { top: 130, right: 120, bottom: 180, left: 120 }
    const width = 1480 - margin.left - margin.right
    const height = 520 - margin.top - margin.bottom
    const mapYCenter = height / 2

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const xScale = d3.scaleLinear().domain([0, totalDuration || 1]).range([0, width])

    g.selectAll('.phase-rect')
      .data(phaseEntries)
      .enter()
      .append('rect')
      .attr('class', 'phase-rect')
      .attr('x', d => xScale(d.start))
      .attr('y', mapYCenter - 42)
      .attr('width', d => Math.max(xScale(d.end) - xScale(d.start), 0))
      .attr('height', 84)
      .attr('fill', (d, i) => (i % 2 === 0 ? '#0B0F14' : '#10161D'))

    const phaseLabels = g.selectAll('.phase-label')
      .data(phaseEntries)
      .enter()
      .append('text')
      .attr('class', 'phase-label')
      .attr('x', d => xScale(d.center))
      .attr('y', mapYCenter - 170)
      .attr('fill', '#E2E8F0')
      .attr('text-anchor', 'middle')
      .attr('font-size', 13)
      .attr('font-weight', 600)
      .text(d => (d.phase.name || '').toUpperCase())

    phaseLabels.append('tspan')
      .attr('x', d => xScale(d.center))
      .attr('dy', 18)
      .attr('fill', '#606C82')
      .attr('font-size', 10)
      .text((d, i) => {
        if (i === 0) return '0-3 MONTHS'
        if (i === 1) return '3-8 MONTHS'
        return '8-12 MONTHS'
      })

    g.append('line')
      .attr('x1', 0)
      .attr('y1', mapYCenter)
      .attr('x2', width)
      .attr('y2', mapYCenter)
      .attr('stroke', '#2D3238')
      .attr('stroke-width', 8)
      .attr('stroke-linecap', 'round')

    const progressLine = g.append('line')
      .attr('x1', 0)
      .attr('y1', mapYCenter)
      .attr('x2', 0)
      .attr('y2', mapYCenter)
      .attr('stroke', journeyData.routeColor || JOURNEY_STRIP_FALLBACK.routeColor)
      .attr('stroke-width', 8)
      .attr('stroke-linecap', 'round')

    const stopsGroup = g.selectAll('.stop-group')
      .data(stops)
      .enter()
      .append('g')
      .attr('class', 'stop-group')
      .attr('transform', d => `translate(${xScale(d.month)},${mapYCenter})`)

    const detailsGroup = g.append('g')
      .attr('transform', `translate(0, ${mapYCenter + 20})`)
      .style('opacity', 0)

    const showStopDetails = (stop) => {
      detailsGroup.selectAll('*').remove()

      detailsGroup.append('text')
        .attr('x', xScale(stop.month))
        .attr('y', 60)
        .attr('fill', '#ADB4BF')
        .attr('font-size', 11)
        .attr('font-weight', 400)
        .attr('text-anchor', 'middle')
        .text(`Service Lines @ ${stop.name}`)

      const icons = detailsGroup.selectAll('.service-icon')
        .data(stop.services || [])
        .enter()
        .append('g')
        .attr('class', 'service-icon')
        .attr('transform', (s, i) => {
          const offset = i * 26 - (((stop.services || []).length - 1) * 13)
          return `translate(${xScale(stop.month) + offset}, 20)`
        })

      icons.append('circle')
        .attr('r', 10)
        .attr('fill', s => serviceColorLookup[s] || '#6B7280')

      icons.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .attr('fill', '#050505')
        .text(s => s)

      gsap.to(detailsGroup.node(), { duration: 0.3, opacity: 1 })
    }

    stopsGroup.append('circle')
      .attr('class', 'stop-circle')
      .attr('r', 7)
      .attr('fill', d => (d.month <= (journeyData.currentProgress ?? 0) ? (journeyData.routeColor || JOURNEY_STRIP_FALLBACK.routeColor) : '#3F4754'))
      .attr('stroke', '#050505')
      .attr('stroke-width', 2)
      .on('click', function (event, d) {
        d3.selectAll('.stop-circle').classed('active', false)
        d3.select(this).classed('active', true)
        showStopDetails(d)
      })

    stopsGroup.append('text')
      .attr('class', 'stop-label')
      .text(d => d.name)
      .attr('transform', 'rotate(-40) translate(22, -12)')
      .style('text-anchor', 'start')
      .attr('fill', '#F8FAFC')
      .attr('font-size', 12)
      .attr('font-weight', 500)
      .on('click', function (event, d) {
        d3.select(this.parentNode).select('.stop-circle').dispatch('click')
      })

    const laneHeight = 34
    const baseLaneOffset = mapYCenter + 45

    const milestoneGroup = g.selectAll('.milestone-icon')
      .data(stageMilestones)
      .enter()
      .append('g')
      .attr('class', 'milestone-icon')
      .attr('transform', d => {
        const lane = typeof d.lane === 'number' ? d.lane : 0
        const yOffset = baseLaneOffset + lane * laneHeight
        return `translate(${xScale(d.month)}, ${yOffset})`
      })

    milestoneGroup.append('circle')
      .attr('r', 16)
      .attr('fill', d => serviceColorLookup[d.code] || '#6B7280')
      .attr('stroke', '#0F1729')
      .attr('stroke-width', 2.5)

    milestoneGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 11)
      .attr('font-weight', '700')
      .attr('fill', '#FFFFFF')
      .text(d => d.code)

    milestoneGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', 'rgba(212, 221, 236, 0.85)')
      .attr('y', d => {
        const lane = typeof d.lane === 'number' ? d.lane : 0
        return lane >= 0 ? 28 : -24
      })
      .attr('dominant-baseline', d => {
        const lane = typeof d.lane === 'number' ? d.lane : 0
        return lane >= 0 ? 'hanging' : 'auto'
      })
      .text(d => d.label)

    const animateJourney = () => {
      const progress = Math.min(journeyData.currentProgress ?? 0, totalDuration)
      const targetX = xScale(progress)
      gsap.to(progressLine.node(), {
        duration: 2.5,
        attr: { x2: targetX },
        ease: 'power2.inOut'
      })

      const indicator = g.append('circle')
        .attr('cx', targetX)
        .attr('cy', mapYCenter)
        .attr('r', 8)
        .attr('fill', '#FFFFFF')
        .attr('stroke', journeyData.routeColor || JOURNEY_STRIP_FALLBACK.routeColor)
        .attr('stroke-width', 3)
        .style('opacity', 0)

      gsap.to(indicator.node(), {
        duration: 0.5,
        opacity: 1,
        delay: 2.4
      })

      gsap.to(indicator.node(), {
        duration: 1.5,
        scale: 1.5,
        opacity: 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 2.5
      })
    }

    animateJourney()

    return () => {
      container.innerHTML = ''
    }
  }, [journeyData])

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#00933C] text-2xl font-bold uppercase text-white shadow-[0_0_25px_rgba(0,147,60,0.45)]">A</span>
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Atlas journey prototype</p>
          <h1 className="text-3xl font-semibold text-white uppercase tracking-[0.25em]">Individual strip map</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.35em] text-slate-400">Participant Sandra Morrison · Episode of care · 12 months</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-brand-midnight/80 p-4">
        {journeyLoading ? (
          <div className="min-w-[1200px] flex items-center justify-center py-32 text-muted-foreground">
            Loading journey strip map…
          </div>
        ) : (
          <div ref={containerRef} className="min-w-[1200px]" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
        {SERVICE_LINES.map(line => (
          <div key={line.id} className="flex items-center gap-2">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: line.color }}
            >
              {line.code}
            </span>
            <span className="text-xs uppercase tracking-[0.25em] text-slate-300">{line.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MyEnrolleesPage({ setCurrentPage, setCurrentEnrolleeId }) {
  const { db, user } = useAuthentication()
  const [enrollees, setEnrollees] = useState([])
  const [loading, setLoading] = useState(true)
  const appId = window.__app_id || 'demo-app'

  useEffect(() => {
    if (!db || !user?.uid) return
    
    // Listen to the user's profile to get assigned enrollees
    const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`)
    
    const unsubscribe = onSnapshot(profileRef, async (profileSnap) => {
      if (profileSnap.exists()) {
        const profileData = profileSnap.data()
        const assignedEnrollees = profileData.assignedEnrollees || []
        
        if (assignedEnrollees.length > 0) {
          // Query enrollees collection for assigned enrollees
          const enrolleesRef = collection(db, `artifacts/${appId}/public/data/enrollees`)
          const q = query(enrolleesRef, where('__name__', 'in', assignedEnrollees))
          
          const enrolleesSnap = await getDocs(q)
          const enrolleesData = enrolleesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          
          setEnrollees(enrolleesData)
        } else {
          setEnrollees([])
        }
      } else {
        // Profile doesn't exist yet, create it
        await setDoc(profileRef, {
          name: user.email || 'User',
          role: 'Certified Peer Counselor',
          email: user.email,
          assignedEnrollees: []
        })
        setEnrollees([])
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, user, appId])

  const handleEnrolleeClick = (enrolleeId) => {
    setCurrentEnrolleeId(enrolleeId)
    setCurrentPage('profile')
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-6">My Enrollees</h1>
        <p className="text-slate-600">Loading enrollees...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-white">My Enrollees</h1>
        {enrollees.length > 0 && (
          <div className="flex gap-3">
            <Button 
              variant="outline"
              size="sm"
              onClick={async () => {
                const { exportEnrolleesToPDF } = await import('./services/export-utils.js')
                exportEnrolleesToPDF(enrollees, 'My Enrollees Report')
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={async () => {
                const { exportEnrolleesToExcel } = await import('./services/export-utils.js')
                exportEnrolleesToExcel(enrollees)
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        )}
      </div>
      
      {enrollees.length === 0 ? (
        <div className="rounded-2xl border border-white/12 bg-white/5 p-10 text-center">
          <Users className="mx-auto mb-6 h-12 w-12 text-white/50" />
          <h3 className="mb-3 text-2xl font-semibold text-white">No Enrollees Yet</h3>
          <p className="mb-6 text-base text-white/65">
            You haven't been assigned any enrollees yet, or you can create a new one.
          </p>
          <Button onClick={() => setCurrentPage('create')} className="bg-gradient-to-r from-service-social to-service-financial hover:brightness-110">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Enrollee
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/12 bg-white/5">
          <Table className="text-base text-white/80">
            <TableHeader className="border-white/10">
              <TableRow className="border-white/10">
                <TableHead className="text-sm uppercase tracking-[0.28em] text-white/60">Name</TableHead>
                <TableHead className="text-sm uppercase tracking-[0.28em] text-white/60">Date of Birth</TableHead>
                <TableHead className="text-sm uppercase tracking-[0.28em] text-white/60">Risk Tier</TableHead>
                <TableHead className="text-sm uppercase tracking-[0.28em] text-white/60">Care Team Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-white/10">
              {enrollees.map((enrollee) => (
                <TableRow 
                  key={enrollee.id}
                  onClick={() => handleEnrolleeClick(enrollee.id)}
                  className="cursor-pointer border-transparent transition hover:bg-white/10"
                >
                  <TableCell className="font-medium text-white">
                    {enrollee.demographics?.firstName} {enrollee.demographics?.lastName}
                  </TableCell>
                  <TableCell className="text-white/70">{enrollee.demographics?.dob || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      enrollee.riskProfile?.tier === 1 ? 'border border-white/15 bg-service-wellness/20 text-service-wellness' :
                      enrollee.riskProfile?.tier === 2 ? 'border border-white/15 bg-service-occupational/20 text-service-occupational' :
                      enrollee.riskProfile?.tier === 3 ? 'border border-white/15 bg-service-social/20 text-service-social' :
                      'border border-white/15 bg-white/10 text-white/70'
                    }`}>
                      Tier {enrollee.riskProfile?.tier || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell className="text-white/70">{enrollee.careTeam?.length || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function ResourcesPage() {
  const { db, user } = useAuthentication()
  const { hasPermission } = usePermissions()
  const [resources, setResources] = useState([])
  const [enrollees, setEnrollees] = useState([])
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState('all')
  const [selectedEnrollee, setSelectedEnrollee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const appId = window.__app_id || 'demo-app'

  // Fetch resources
  useEffect(() => {
    if (!db) return

    const resourcesRef = collection(db, `artifacts/${appId}/public/data/resources`)

    const unsubscribe = onSnapshot(resourcesRef, (snapshot) => {
      const resourcesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setResources(resourcesData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, appId])

  // Fetch user's enrollees for the filter dropdown
  useEffect(() => {
    if (!db || !user?.uid) return

    const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`)
    
    const unsubscribe = onSnapshot(profileRef, async (profileSnap) => {
      if (profileSnap.exists()) {
        const profileData = profileSnap.data()
        const assignedEnrollees = profileData.assignedEnrollees || []
        
        if (assignedEnrollees.length > 0) {
          const enrolleesRef = collection(db, `artifacts/${appId}/public/data/enrollees`)
          const q = query(enrolleesRef, where('__name__', 'in', assignedEnrollees))
          const enrolleesSnap = await getDocs(q)
          const enrolleesData = enrolleesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          setEnrollees(enrolleesData)
        }
      }
    })

    return () => unsubscribe()
  }, [db, user, appId])

  // Update selected enrollee when selection changes
  useEffect(() => {
    if (selectedEnrolleeId && selectedEnrolleeId !== 'all') {
      const enrollee = enrollees.find(e => e.id === selectedEnrolleeId)
      setSelectedEnrollee(enrollee)
    } else {
      setSelectedEnrollee(null)
    }
  }, [selectedEnrolleeId, enrollees])

  // Filter resources based on selected enrollee
  const filteredResources = selectedEnrollee
    ? resources.filter(resource => {
        const criteria = resource.eligibilityCriteria || {}
        const enrolleeZCodes = selectedEnrollee.riskProfile?.zCodes || []
        
        // If resource has zCode criteria, check if enrollee has matching codes
        if (criteria.zCodes && criteria.zCodes.length > 0) {
          const hasMatchingZCode = criteria.zCodes.some(code => 
            enrolleeZCodes.includes(code)
          )
          if (!hasMatchingZCode) return false
        }
        
        // Add more eligibility criteria checks as needed
        return true
      })
    : resources

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Community Resources</h1>
          <p className="text-slate-600">Browse and refer enrollees to community services</p>
        </div>
        {hasPermission('CREATE_RESOURCE') && (
          <Button onClick={() => setShowCreateDialog(true)} className="bg-sky-600 hover:bg-sky-700">
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Resource
          </Button>
        )}
      </div>

      {/* Create Resource Dialog */}
      {showCreateDialog && (
        <CreateResourceDialog 
          onClose={() => setShowCreateDialog(false)}
          db={db}
          appId={appId}
        />
      )}

      {/* Enrollee Filter */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filter by Enrollee</CardTitle>
          <CardDescription>
            Select an enrollee to see resources matching their eligibility criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedEnrolleeId} onValueChange={setSelectedEnrolleeId}>
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="All Resources (No Filter)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources (No Filter)</SelectItem>
              {enrollees.map(enrollee => (
                <SelectItem key={enrollee.id} value={enrollee.id}>
                  {enrollee.demographics?.firstName} {enrollee.demographics?.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedEnrollee && (
            <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-lg">
              <p className="text-sm font-medium text-sky-900">
                Filtering for: {selectedEnrollee.demographics?.firstName} {selectedEnrollee.demographics?.lastName}
              </p>
              <p className="text-xs text-sky-700 mt-1">
                Risk Tier {selectedEnrollee.riskProfile?.tier} · 
                {selectedEnrollee.riskProfile?.zCodes?.length || 0} Z-Codes
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resources List */}
      {loading ? (
        <p className="text-slate-600">Loading resources...</p>
      ) : filteredResources.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-600 text-center">
              {selectedEnrollee 
                ? 'No resources match the selected enrollee\'s eligibility criteria.' 
                : 'No resources available yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResources.map(resource => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </div>
  )
}

// Resource Card Component
function ResourceCard({ resource }) {
  const { db, user } = useAuthentication()
  const { hasPermission } = usePermissions()
  const [enrollees, setEnrollees] = useState([])
  const [selectedEnrolleeId, setSelectedEnrolleeId] = useState('')
  const [notes, setNotes] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const appId = window.__app_id || 'demo-app'

  const handleDelete = async () => {
    if (!db) return
    setDeleting(true)
    try {
      const resourceRef = doc(db, `artifacts/${appId}/public/data/resources/${resource.id}`)
      await deleteDoc(resourceRef)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting resource:', error)
      alert('Failed to delete resource')
      setDeleting(false)
    }
  }

  // Fetch enrollees for the referral dialog
  useEffect(() => {
    if (!db || !user?.uid) return

    const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`)
    
    const unsubscribe = onSnapshot(profileRef, async (profileSnap) => {
      if (profileSnap.exists()) {
        const profileData = profileSnap.data()
        const assignedEnrollees = profileData.assignedEnrollees || []
        
        if (assignedEnrollees.length > 0) {
          const enrolleesRef = collection(db, `artifacts/${appId}/public/data/enrollees`)
          const q = query(enrolleesRef, where('__name__', 'in', assignedEnrollees))
          const enrolleesSnap = await getDocs(q)
          const enrolleesData = enrolleesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          setEnrollees(enrolleesData)
        }
      }
    })

    return () => unsubscribe()
  }, [db, user, appId])

  const handleSubmitReferral = async () => {
    if (!db || !user?.uid || !selectedEnrolleeId) return

    setIsSubmitting(true)

    try {
      const selectedEnrollee = enrollees.find(e => e.id === selectedEnrolleeId)
      
      const referralsRef = collection(db, `artifacts/${appId}/public/data/referrals`)
      await addDoc(referralsRef, {
        enrolleeId: selectedEnrolleeId,
        enrolleeName: `${selectedEnrollee.demographics?.firstName} ${selectedEnrollee.demographics?.lastName}`,
        resourceId: resource.id,
        resourceName: resource.name,
        referringUserId: user.uid,
        referringUserName: user.email || 'User',
        status: 'Pending',
        notes: notes.trim(),
        createdTimestamp: serverTimestamp()
      })

      // Reset form and close dialog
      setNotes('')
      setSelectedEnrolleeId('')
      setIsOpen(false)
      alert('Referral created successfully!')
    } catch (error) {
      console.error('Error creating referral:', error)
      alert('Failed to create referral. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCategoryColor = (category) => {
    const colors = {
      'Food': 'bg-green-100 text-green-800 border-green-200',
      'Housing': 'bg-blue-100 text-blue-800 border-blue-200',
      'Healthcare': 'bg-red-100 text-red-800 border-red-200',
      'Employment': 'bg-purple-100 text-purple-800 border-purple-200',
      'Legal': 'bg-amber-100 text-amber-800 border-amber-200',
      'Mental Health': 'bg-sky-100 text-sky-800 border-sky-200',
      'Transportation': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    }
    return colors[category] || 'bg-slate-100 text-slate-800 border-slate-200'
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{resource.name}</CardTitle>
          {resource.category && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(resource.category)}`}>
              {resource.category}
            </span>
          )}
        </div>
        <CardDescription>{resource.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {resource.eligibilityCriteria && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Eligibility:</p>
            <div className="flex flex-wrap gap-1">
              {resource.eligibilityCriteria.zCodes?.map((code, idx) => (
                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700">
                  {code}
                </span>
              ))}
              {resource.eligibilityCriteria.income && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                  Income: {resource.eligibilityCriteria.income}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              <Send className="w-4 h-4 mr-2" />
              Create Referral
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Referral</DialogTitle>
              <DialogDescription>
                Refer an enrollee to {resource.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="enrollee">Select Enrollee *</Label>
                <Select value={selectedEnrolleeId} onValueChange={setSelectedEnrolleeId}>
                  <SelectTrigger id="enrollee">
                    <SelectValue placeholder="Choose an enrollee" />
                  </SelectTrigger>
                  <SelectContent>
                    {enrollees.map(enrollee => (
                      <SelectItem key={enrollee.id} value={enrollee.id}>
                        {enrollee.demographics?.firstName} {enrollee.demographics?.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any relevant notes about this referral..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReferral}
                disabled={!selectedEnrolleeId || isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? 'Creating...' : 'Create Referral'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Button (Admin Only) */}
        {hasPermission('EDIT_RESOURCE') && (
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="w-4 h-4" />
          </Button>
        )}

        {/* Delete Button (Admin Only) */}
        {hasPermission('DELETE_RESOURCE') && (
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}

        {/* Edit Resource Dialog */}
        {showEditDialog && (
          <EditResourceDialog
            resource={resource}
            onClose={() => setShowEditDialog(false)}
            db={db}
            appId={appId}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Resource</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {resource.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}

// Create Resource Dialog Component
function CreateResourceDialog({ onClose, db, appId }) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    address: '',
    phone: '',
    email: ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!db || !formData.name) return
    setSaving(true)
    try {
      const resourcesRef = collection(db, `artifacts/${appId}/public/data/resources`)
      await addDoc(resourcesRef, {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        address: formData.address,
        contactInfo: {
          phone: formData.phone,
          email: formData.email
        },
        eligibilityCriteria: {},
        servicesOffered: []
      })
      onClose()
    } catch (error) {
      console.error('Error creating resource:', error)
      alert('Failed to create resource')
      setSaving(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Resource</DialogTitle>
          <DialogDescription>Add a new community resource to the system</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Resource Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Community Food Bank"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Food Security">Food Security</SelectItem>
                  <SelectItem value="Housing Support">Housing Support</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Mental Health">Mental Health</SelectItem>
                  <SelectItem value="Employment Support">Employment Support</SelectItem>
                  <SelectItem value="Legal Aid">Legal Aid</SelectItem>
                  <SelectItem value="Transportation">Transportation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Brief description of services"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              placeholder="123 Main St, City, ST 12345"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="contact@resource.org"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!formData.name || saving} className="bg-sky-600 hover:bg-sky-700">
            {saving ? 'Creating...' : 'Create Resource'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Edit Resource Dialog Component
function EditResourceDialog({ resource, onClose, db, appId }) {
  const [formData, setFormData] = useState({
    name: resource.name || '',
    category: resource.category || '',
    description: resource.description || '',
    address: resource.address || '',
    phone: resource.contactInfo?.phone || '',
    email: resource.contactInfo?.email || ''
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!db || !formData.name) return
    setSaving(true)
    try {
      const resourceRef = doc(db, `artifacts/${appId}/public/data/resources/${resource.id}`)
      await updateDoc(resourceRef, {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        address: formData.address,
        'contactInfo.phone': formData.phone,
        'contactInfo.email': formData.email
      })
      onClose()
    } catch (error) {
      console.error('Error updating resource:', error)
      alert('Failed to update resource')
      setSaving(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Resource</DialogTitle>
          <DialogDescription>Update resource information</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Resource Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Food Security">Food Security</SelectItem>
                  <SelectItem value="Housing Support">Housing Support</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Mental Health">Mental Health</SelectItem>
                  <SelectItem value="Employment Support">Employment Support</SelectItem>
                  <SelectItem value="Legal Aid">Legal Aid</SelectItem>
                  <SelectItem value="Transportation">Transportation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!formData.name || saving} className="bg-sky-600 hover:bg-sky-700">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReferralsPage() {
  const { db, user } = useAuthentication()
  const { hasPermission } = usePermissions()
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingReferral, setEditingReferral] = useState(null)
  const [editNotes, setEditNotes] = useState('')
  const [cancelingReferralId, setCancelingReferralId] = useState(null)
  const [saving, setSaving] = useState(false)
  const appId = window.__app_id || 'demo-app'

  const handleEditClick = (referral) => {
    setEditingReferral(referral)
    setEditNotes(referral.notes || '')
  }

  const handleSaveEdit = async () => {
    if (!db || !editingReferral) return
    setSaving(true)
    try {
      const referralRef = doc(db, `artifacts/${appId}/public/data/referrals/${editingReferral.id}`)
      await updateDoc(referralRef, {
        notes: editNotes
      })
      setEditingReferral(null)
      setEditNotes('')
    } catch (error) {
      console.error('Error updating referral:', error)
      alert('Failed to update referral')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelReferral = async (referralId) => {
    if (!db) return
    setSaving(true)
    try {
      const referralRef = doc(db, `artifacts/${appId}/public/data/referrals/${referralId}`)
      await updateDoc(referralRef, {
        status: 'Cancelled'
      })
      setCancelingReferralId(null)
    } catch (error) {
      console.error('Error cancelling referral:', error)
      alert('Failed to cancel referral')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!db || !user?.uid) return

    const referralsRef = collection(db, `artifacts/${appId}/public/data/referrals`)
    const q = query(
      referralsRef, 
      where('referringUserId', '==', user.uid)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const referralsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        // Sort by timestamp descending (newest first) in memory
        const timeA = a.createdTimestamp?.toMillis?.() || 0
        const timeB = b.createdTimestamp?.toMillis?.() || 0
        return timeB - timeA
      })
      setReferrals(referralsData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, user, appId])

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status) => {
    const badges = {
      'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Accepted': 'bg-green-100 text-green-800 border-green-200',
      'Rejected': 'bg-red-100 text-red-800 border-red-200',
      'Completed': 'bg-blue-100 text-blue-800 border-blue-200',
      'Cancelled': 'bg-slate-100 text-slate-800 border-slate-200',
    }
    return badges[status] || 'bg-slate-100 text-slate-800 border-slate-200'
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-slate-900">Referrals</h1>
          {!loading && referrals.length > 0 && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { exportReferralsToPDF } = await import('./services/export-utils.js')
                  exportReferralsToPDF(referrals, 'All Referrals')
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={async () => {
                  const { exportReferralsToExcel } = await import('./services/export-utils.js')
                  exportReferralsToExcel(referrals)
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            </div>
          )}
        </div>
        <p className="text-slate-600">Track all referrals you've created</p>
      </div>

      {loading ? (
        <p className="text-slate-600">Loading referrals...</p>
      ) : referrals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Send className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Referrals Yet</h3>
              <p className="text-slate-600 mb-4">You haven't created any referrals yet.</p>
              <Button onClick={() => window.location.hash = 'resources'} className="bg-sky-600 hover:bg-sky-700">
                Browse Resources
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {referrals.map((referral) => (
            <Card key={referral.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{referral.enrolleeName}</CardTitle>
                    <CardDescription>
                      Referred to: {referral.resourceName} • {formatTimestamp(referral.createdTimestamp)}
                    </CardDescription>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(referral.status)}`}>
                    {referral.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {referral.notes && (
                    <div>
                      <p className="text-sm font-medium text-slate-700">Initial Notes:</p>
                      <p className="text-sm text-slate-600">{referral.notes}</p>
                    </div>
                  )}
                  {referral.responseNotes && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm font-medium text-slate-700">Provider Response:</p>
                      <p className="text-sm text-slate-600">{referral.responseNotes}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        By {referral.respondedBy} • {formatTimestamp(referral.respondedTimestamp)}
                      </p>
                    </div>
                  )}

                  {/* Communication Thread */}
                  <ReferralCommunicationThread referralId={referral.id} />
                </div>
              </CardContent>
              {(hasPermission('EDIT_REFERRAL') || hasPermission('CANCEL_REFERRAL')) && referral.status === 'Pending' && (
                <CardFooter className="flex gap-2">
                  {hasPermission('EDIT_REFERRAL') && (
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(referral)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Notes
                    </Button>
                  )}
                  {hasPermission('CANCEL_REFERRAL') && (
                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={() => setCancelingReferralId(referral.id)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel Referral
                    </Button>
                  )}
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      {referrals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Referrals</CardDescription>
              <CardTitle className="text-3xl">{referrals.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">
                {referrals.filter(r => r.status === 'Pending').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Accepted</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {referrals.filter(r => r.status === 'Accepted').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Rejected</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                {referrals.filter(r => r.status === 'Rejected').length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Edit Referral Dialog */}
      <Dialog open={editingReferral !== null} onOpenChange={() => setEditingReferral(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Referral Notes</DialogTitle>
            <DialogDescription>
              Update notes for referral to {editingReferral?.resourceName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add or update referral notes..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingReferral(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="bg-sky-600 hover:bg-sky-700">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Referral Confirmation Dialog */}
      <Dialog open={cancelingReferralId !== null} onOpenChange={() => setCancelingReferralId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Referral</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this referral? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelingReferralId(null)} disabled={saving}>
              No, Keep It
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleCancelReferral(cancelingReferralId)} 
              disabled={saving}
            >
              {saving ? 'Cancelling...' : 'Yes, Cancel Referral'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RecordCreationPage({ setCurrentPage, setCurrentEnrolleeId }) {
  const { db, user } = useAuthentication()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dob: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const appId = window.__app_id || 'demo-app'

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!db || !user?.uid) return

    setIsSubmitting(true)

    try {
      // Create new enrollee document
      const enrolleesRef = collection(db, `artifacts/${appId}/public/data/enrollees`)
      const newEnrolleeDoc = await addDoc(enrolleesRef, {
        demographics: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dob: formData.dob,
          photoUrl: `https://placehold.co/100x100/E2E8F0/64748B?text=${formData.firstName[0]}${formData.lastName[0]}`
        },
        careTeam: [
          {
            userId: user.uid,
            name: user.email || 'User',
            role: 'CPC'
          }
        ],
        riskProfile: {
          tier: 1,
          wellnessScores: {
            physical: 50,
            emotional: 50,
            intellectual: 50,
            spiritual: 50,
            social: 50,
            occupational: 50,
            environmental: 50,
            financial: 50
          },
          zCodes: [],
          lscmiScores: {}
        }
      })

      const newEnrolleeId = newEnrolleeDoc.id

      // Update user's profile to include this enrollee
      const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`)
      await updateDoc(profileRef, {
        assignedEnrollees: arrayUnion(newEnrolleeId)
      })

      // Navigate to the new enrollee's profile
      setCurrentEnrolleeId(newEnrolleeId)
      setCurrentPage('profile')
    } catch (error) {
      console.error('Error creating enrollee:', error)
      alert('Failed to create enrollee. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Create New Enrollee</h1>
      <p className="text-slate-600 mb-6">Add a new person to your care team roster.</p>
      
      <Card>
        <CardHeader>
          <CardTitle>Enrollee Demographics</CardTitle>
          <CardDescription>
            Please enter the basic information for the new enrollee. You can add more details later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input
                id="dob"
                name="dob"
                type="date"
                value={formData.dob}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {isSubmitting ? 'Creating...' : 'Create Enrollee'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentPage('enrollees')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function EnrolleeProfilePage({ enrolleeId, setCurrentPage }) {
  const { db } = useAuthentication()
  const [enrollee, setEnrollee] = useState(null)
  const [loading, setLoading] = useState(true)
  const appId = window.__app_id || 'demo-app'

  useEffect(() => {
    if (!db || !enrolleeId) return

    const enrolleeRef = doc(db, `artifacts/${appId}/public/data/enrollees/${enrolleeId}`)

    const unsubscribe = onSnapshot(enrolleeRef, (docSnap) => {
      if (docSnap.exists()) {
        setEnrollee({ id: docSnap.id, ...docSnap.data() })
      } else {
        console.error('Enrollee not found')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, enrolleeId, appId])

  if (loading) {
    return (
      <div>
        <p className="text-slate-600">Loading enrollee profile...</p>
      </div>
    )
  }

  if (!enrollee) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Enrollee Not Found</h1>
        <Button onClick={() => setCurrentPage('enrollees')}>
          Back to Enrollees
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Profile Header */}
      <ProfileHeader enrollee={enrollee} setCurrentPage={setCurrentPage} />

      {/* Tabs */}
      <Tabs defaultValue="risk" className="mt-6">
        <TabsList>
          <TabsTrigger value="risk">Risk Rating</TabsTrigger>
          <TabsTrigger value="assessments">Assessment History</TabsTrigger>
          <TabsTrigger value="careplan">Shared Care Plan</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="risk">
          <Tab_RiskRating riskProfile={enrollee.riskProfile} />
        </TabsContent>

        <TabsContent value="assessments">
          <RiskAssessmentTimeline enrolleeId={enrolleeId} enrollee={enrollee} />
        </TabsContent>

        <TabsContent value="careplan">
          <Tab_CarePlan enrolleeId={enrolleeId} />
        </TabsContent>

        <TabsContent value="details">
          <Tab_Details enrollee={enrollee} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Profile Header Component
function ProfileHeader({ enrollee, setCurrentPage }) {
  const { db } = useAuthentication()
  const { hasPermission } = usePermissions()
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const appId = window.__app_id || 'demo-app'

  const demographics = enrollee.demographics || {}
  const fullName = `${demographics.firstName || ''} ${demographics.lastName || ''}`
  
  const handleEdit = () => {
    setEditedData({
      firstName: demographics.firstName || '',
      lastName: demographics.lastName || '',
      dob: demographics.dob || ''
    })
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!db) return
    try {
      const enrolleeRef = doc(db, `artifacts/${appId}/public/data/enrollees/${enrollee.id}`)
      await updateDoc(enrolleeRef, {
        'demographics.firstName': editedData.firstName,
        'demographics.lastName': editedData.lastName,
        'demographics.dob': editedData.dob
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating enrollee:', error)
      alert('Failed to update enrollee')
    }
  }

  const handleDelete = async () => {
    if (!db) return
    setDeleting(true)
    try {
      const enrolleeRef = doc(db, `artifacts/${appId}/public/data/enrollees/${enrollee.id}`)
      await deleteDoc(enrolleeRef)
      setCurrentPage('enrollees') // Navigate back to enrollees list
    } catch (error) {
      console.error('Error deleting enrollee:', error)
      alert('Failed to delete enrollee')
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={demographics.photoUrl} alt={fullName} />
              <AvatarFallback className="bg-sky-100 text-sky-700 text-xl">
                {demographics.firstName?.[0]}{demographics.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              {isEditing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={editedData.firstName}
                      onChange={(e) => setEditedData({...editedData, firstName: e.target.value})}
                      placeholder="First Name"
                      className="w-40"
                    />
                    <Input
                      value={editedData.lastName}
                      onChange={(e) => setEditedData({...editedData, lastName: e.target.value})}
                      placeholder="Last Name"
                      className="w-40"
                    />
                  </div>
                  <Input
                    type="date"
                    value={editedData.dob}
                    onChange={(e) => setEditedData({...editedData, dob: e.target.value})}
                    className="w-56"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-slate-900">{fullName}</h1>
                  <p className="text-slate-600 mt-1">
                    Date of Birth: {demographics.dob || 'N/A'}
                  </p>
                </>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  enrollee.riskProfile?.tier === 1 ? 'bg-green-100 text-green-800' :
                  enrollee.riskProfile?.tier === 2 ? 'bg-yellow-100 text-yellow-800' :
                  enrollee.riskProfile?.tier === 3 ? 'bg-red-100 text-red-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  Risk Tier {enrollee.riskProfile?.tier || 'N/A'}
                </span>
                <span className="text-sm text-slate-600">
                  · Care Team: {enrollee.careTeam?.length || 0} members
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {hasPermission('EDIT_ENROLLEE') && (
                  <Button onClick={handleEdit} variant="outline">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
                {hasPermission('DELETE_ENROLLEE') && (
                  <Button onClick={() => setShowDeleteDialog(true)} variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                )}
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Send className="w-4 h-4 mr-2" />
                  Make Referral
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Enrollee</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {fullName}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// Tab: Risk Rating with Pie Chart and Accordion
function Tab_RiskRating({ riskProfile }) {
  const wellnessScores = riskProfile?.wellnessScores || {}
  
  // Prepare data for pie chart
  const chartData = [
    { name: 'Physical', value: wellnessScores.physical || 50, color: '#0ea5e9' },
    { name: 'Emotional', value: wellnessScores.emotional || 50, color: '#8b5cf6' },
    { name: 'Intellectual', value: wellnessScores.intellectual || 50, color: '#06b6d4' },
    { name: 'Spiritual', value: wellnessScores.spiritual || 50, color: '#6366f1' },
    { name: 'Social', value: wellnessScores.social || 50, color: '#10b981' },
    { name: 'Occupational', value: wellnessScores.occupational || 50, color: '#f59e0b' },
    { name: 'Environmental', value: wellnessScores.environmental || 50, color: '#84cc16' },
    { name: 'Financial', value: wellnessScores.financial || 50, color: '#ef4444' },
  ]

  return (
    <div className="space-y-6 mt-4">
      {/* Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>8 Dimensions of Wellness</CardTitle>
          <CardDescription>
            Visual representation of wellness scores across all dimensions (0-100 scale)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Risk Tier Accordion */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment Tiers</CardTitle>
          <CardDescription>
            Detailed breakdown of risk factors by tier level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* Tier 1: 8 Dimensions Summary */}
            <AccordionItem value="tier1">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Tier 1
                  </span>
                  <span className="font-medium">8 Dimensions of Wellness</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-slate-600 mb-4">
                    Basic wellness assessment across all dimensions. Scores range from 0-100, 
                    with higher scores indicating better wellness.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {chartData.map((dimension) => (
                      <div key={dimension.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: dimension.color }}
                          />
                          <span className="text-sm font-medium">{dimension.name}</span>
                        </div>
                        <span className="text-sm font-bold">{dimension.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Tier 2: Z-Codes */}
            <AccordionItem value="tier2">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Tier 2
                  </span>
                  <span className="font-medium">Social Determinants of Health (Z-Codes)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  <p className="text-sm text-slate-600 mb-3">
                    ICD-10 Z-codes identify social determinants affecting health outcomes.
                  </p>
                  {riskProfile?.zCodes && riskProfile.zCodes.length > 0 ? (
                    <div className="space-y-2">
                      {riskProfile.zCodes.map((zCode, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <span className="font-mono text-sm font-semibold text-yellow-900">{zCode}</span>
                          <span className="text-sm text-slate-600">
                            {getZCodeDescription(zCode)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No Z-codes recorded</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Tier 3: Criminogenic (LS/CMI) */}
            <AccordionItem value="tier3">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Tier 3
                  </span>
                  <span className="font-medium">Criminogenic Risk Assessment (LS/CMI)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  <p className="text-sm text-slate-600 mb-3">
                    Level of Service/Case Management Inventory scores for justice-involved individuals.
                  </p>
                  {riskProfile?.lscmiScores && Object.keys(riskProfile.lscmiScores).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(riskProfile.lscmiScores).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                          <span className="text-sm font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-sm font-bold text-red-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No LS/CMI scores recorded</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper function to get Z-code descriptions
function getZCodeDescription(zCode) {
  const descriptions = {
    'Z59.0': 'Homelessness',
    'Z59.1': 'Inadequate housing',
    'Z59.4': 'Lack of adequate food',
    'Z59.5': 'Extreme poverty',
    'Z59.6': 'Low income',
    'Z59.7': 'Insufficient social insurance',
    'Z59.8': 'Other problems related to housing',
    'Z59.9': 'Problem related to housing, unspecified',
    'Z63.4': 'Disappearance or death of family member',
    'Z63.5': 'Disruption of family by separation or divorce',
    'Z56.9': 'Unspecified problem related to employment',
    'Z60.2': 'Problems related to living alone',
    'Z60.3': 'Acculturation difficulty',
    'Z65.0': 'Conviction in civil or criminal proceedings',
    'Z65.1': 'Imprisonment or other incarceration',
  }
  return descriptions[zCode] || 'Social determinant'
}

function Tab_CarePlan({ enrolleeId }) {
  const { db, user } = useAuthentication()
  const [carePlanEntries, setCarePlanEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const appId = window.__app_id || 'demo-app'

  useEffect(() => {
    if (!db || !enrolleeId) return

    const carePlanRef = collection(db, `artifacts/${appId}/public/data/enrollees/${enrolleeId}/carePlan`)
    const q = query(carePlanRef, orderBy('timestamp', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setCarePlanEntries(entries)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, enrolleeId, appId])

  return (
    <div className="space-y-4 mt-4">
      {/* New Note Form */}
      <NewNoteForm enrolleeId={enrolleeId} />

      {/* Care Plan Entries */}
      {loading ? (
        <p className="text-slate-600">Loading care plan...</p>
      ) : carePlanEntries.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-600 text-center">No care plan entries yet. Add a note above to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {carePlanEntries.map((entry) => {
            switch (entry.type) {
              case 'Note':
                return <NoteEntry key={entry.id} entry={entry} enrolleeId={enrolleeId} />
              case 'PRAXISInsight':
                return <PRAXISInsightEntry key={entry.id} entry={entry} enrolleeId={enrolleeId} />
              case 'Alert':
                return <AlertEntry key={entry.id} entry={entry} enrolleeId={enrolleeId} />
              default:
                return <NoteEntry key={entry.id} entry={entry} enrolleeId={enrolleeId} />
            }
          })}
        </div>
      )}
    </div>
  )
}

// New Note Form Component
function NewNoteForm({ enrolleeId }) {
  const { db, user } = useAuthentication()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const appId = window.__app_id || 'demo-app'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!db || !user?.uid || !content.trim()) return

    setIsSubmitting(true)

    try {
      const carePlanRef = collection(db, `artifacts/${appId}/public/data/enrollees/${enrolleeId}/carePlan`)
      
      await addDoc(carePlanRef, {
        type: 'Note',
        timestamp: serverTimestamp(),
        authorUserId: user.uid,
        authorName: user.email || 'User',
        content: content.trim()
      })

      setContent('')
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Failed to add note. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Care Note</CardTitle>
        <CardDescription>Document observations, goals, or interventions</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Enter your care note here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            disabled={isSubmitting}
          />
          <Button type="submit" disabled={isSubmitting || !content.trim()} className="bg-sky-600 hover:bg-sky-700">
            {isSubmitting ? 'Adding...' : 'Add Note'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Note Entry Component
function NoteEntry({ entry, enrolleeId }) {
  const { db, user } = useAuthentication()
  const { hasPermission } = usePermissions()
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(entry.content || '')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const appId = window.__app_id || 'demo-app'

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const handleSave = async () => {
    if (!db || !editedContent.trim()) return
    setSaving(true)
    try {
      // Extract enrolleeId from the entry's path (stored in Firestore)
      const entryRef = doc(db, entry.ref?.path || `artifacts/${appId}/public/data/enrollees/${entry.enrolleeId}/carePlan/${entry.id}`)
      await updateDoc(entryRef, {
        content: editedContent.trim()
      })
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating note:', error)
      alert('Failed to update note')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!db) return
    setSaving(true)
    try {
      const entryRef = doc(db, entry.ref?.path || `artifacts/${appId}/public/data/enrollees/${entry.enrolleeId}/carePlan/${entry.id}`)
      await deleteDoc(entryRef)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Failed to delete note')
      setSaving(false)
    }
  }

  const canEdit = hasPermission('EDIT_CARE_NOTE') && entry.authorUserId === user?.uid
  const canDelete = hasPermission('DELETE_CARE_NOTE')

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{entry.authorName}</CardTitle>
            <CardDescription className="text-xs">{formatTimestamp(entry.timestamp)}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              Note
            </span>
            {!isEditing && (
              <>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className="w-3 h-3" />
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              rows={4}
              disabled={saving}
            />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !editedContent.trim()} size="sm" className="bg-sky-600 hover:bg-sky-700">
                <Save className="w-3 h-3 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" disabled={saving}>
                <X className="w-3 h-3 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.content}</p>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Care Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// PRAXIS Insight Entry Component
function PRAXISInsightEntry({ entry, enrolleeId }) {
  const { db } = useAuthentication()
  const [isUpdating, setIsUpdating] = useState(false)
  const appId = window.__app_id || 'demo-app'

  const handleStatusUpdate = async (newStatus) => {
    if (!db) return
    setIsUpdating(true)

    try {
      const entryRef = doc(db, `artifacts/${appId}/public/data/enrollees/${enrolleeId}/carePlan/${entry.id}`)
      await updateDoc(entryRef, { status: newStatus })
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status. Please try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <Card className="border-sky-200 border-2">
      <CardHeader className="pb-3 bg-sky-50">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-sky-600 text-white">
                PRAXIS AI
              </span>
              {entry.authorName || 'PRAXIS System'}
            </CardTitle>
            <CardDescription className="text-xs">{formatTimestamp(entry.timestamp)}</CardDescription>
          </div>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            entry.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
            entry.status === 'Accepted' ? 'bg-green-100 text-green-800' :
            entry.status === 'Dismissed' ? 'bg-slate-100 text-slate-700' :
            'bg-slate-100 text-slate-700'
          }`}>
            {entry.status || 'Pending'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.content}</p>
      </CardContent>
      {entry.status === 'Pending' && (
        <CardFooter className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleStatusUpdate('Accepted')}
            disabled={isUpdating}
            className="bg-green-600 hover:bg-green-700"
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusUpdate('Dismissed')}
            disabled={isUpdating}
          >
            Dismiss
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

// Alert Entry Component
function AlertEntry({ entry }) {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <Card className="border-amber-200 border-2 bg-amber-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{entry.authorName || 'System Alert'}</CardTitle>
            <CardDescription className="text-xs">{formatTimestamp(entry.timestamp)}</CardDescription>
          </div>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-600 text-white">
            Alert
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.content}</p>
      </CardContent>
    </Card>
  )
}

function Tab_Details({ enrollee }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Enrollee Details</CardTitle>
        <CardDescription>Demographics and care team information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Demographics</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-600">First Name:</dt>
              <dd className="font-medium">{enrollee.demographics?.firstName || 'N/A'}</dd>
              <dt className="text-slate-600">Last Name:</dt>
              <dd className="font-medium">{enrollee.demographics?.lastName || 'N/A'}</dd>
              <dt className="text-slate-600">Date of Birth:</dt>
              <dd className="font-medium">{enrollee.demographics?.dob || 'N/A'}</dd>
            </dl>
          </div>
          
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Care Team</h3>
            <div className="space-y-2">
              {enrollee.careTeam?.map((member, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-slate-100 text-slate-700 text-xs">
                      {member.name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-slate-600 text-xs">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// LOAD SAMPLE DATA PAGE
// ============================================================================

function LoadDataPage({ setCurrentPage }) {
  const { db, user } = useAuthentication()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState([])
  const appId = window.__app_id || 'demo-app'

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date() }])
  }

  const loadSampleData = async () => {
    if (!db || !user?.uid) {
      addLog('❌ Error: Not authenticated', 'error')
      return
    }

    setLoading(true)
    setLogs([])
    addLog('🌱 Starting to load sample data...', 'info')

    try {
      // Sample resources (condensed for brevity - using same data as seed script)
      const resources = [
        {
          name: "Community Food Bank",
          category: "Food Security",
          description: "Free groceries and hot meals for families in need.",
          contactInfo: { phone: "(555) 123-4567", email: "info@communityfoodbank.org" },
          address: "123 Main St, City, ST 12345",
          eligibilityCriteria: { zCodes: ["Z59.4"], income: "Below 200% FPL" },
          servicesOffered: ["Emergency Food", "Meal Programs", "Nutrition Education"]
        },
        {
          name: "Safe Haven Housing Services",
          category: "Housing Support",
          description: "Emergency shelter and transitional housing assistance.",
          contactInfo: { phone: "(555) 234-5678", email: "support@safehaven.org" },
          address: "456 Oak Ave, City, ST 12345",
          eligibilityCriteria: { zCodes: ["Z59.0", "Z59.1"], familyStatus: "Any" },
          servicesOffered: ["Emergency Shelter", "Case Management"]
        },
        {
          name: "Wellness Center Mental Health Clinic",
          category: "Mental Health",
          description: "Counseling and therapy services on a sliding scale.",
          contactInfo: { phone: "(555) 345-6789", email: "appointments@wellnesscenter.org" },
          address: "789 Elm St, City, ST 12345",
          eligibilityCriteria: { insurance: "Medicaid accepted" },
          servicesOffered: ["Individual Therapy", "Group Counseling"]
        },
        {
          name: "Skills Forward Employment Center",
          category: "Employment Support",
          description: "Job training, resume help, and interview prep.",
          contactInfo: { phone: "(555) 456-7890", email: "jobs@skillsforward.org" },
          address: "321 Pine St, City, ST 12345",
          eligibilityCriteria: { age: "18+", status: "Unemployed or underemployed" },
          servicesOffered: ["Job Training", "Resume Writing"]
        },
        {
          name: "Community Legal Services",
          category: "Legal Aid",
          description: "Free legal assistance for low-income families.",
          contactInfo: { phone: "(555) 567-8901", email: "help@communitylegal.org" },
          address: "654 Maple Dr, City, ST 12345",
          eligibilityCriteria: { income: "Below 125% FPL" },
          servicesOffered: ["Family Law", "Housing Law"]
        },
        {
          name: "Metro Community Health Center",
          category: "Healthcare",
          description: "Primary care and preventive health services.",
          contactInfo: { phone: "(555) 678-9012", email: "info@metrohealth.org" },
          address: "987 Cedar Ln, City, ST 12345",
          eligibilityCriteria: { insurance: "Medicaid, Medicare, Uninsured accepted" },
          servicesOffered: ["Primary Care", "Dental"]
        },
        {
          name: "Ride Share Program",
          category: "Transportation",
          description: "Free or low-cost rides to medical appointments.",
          contactInfo: { phone: "(555) 789-0123", email: "rides@rideshare.org" },
          address: "Service covers entire metro area",
          eligibilityCriteria: { purpose: "Medical appointments" },
          servicesOffered: ["Medical Transport", "Scheduled Rides"]
        }
      ]

      // Add resources
      addLog('📦 Adding resources...', 'info')
      const resourcesRef = collection(db, `artifacts/${appId}/public/data/resources`)
      for (const resource of resources) {
        await addDoc(resourcesRef, resource)
        addLog(`  ✅ Added: ${resource.name}`, 'success')
      }
      addLog(`✅ Added ${resources.length} resources\n`, 'success')

      // Sample enrollees
      const enrollees = [
        {
          demographics: {
            firstName: 'Sandra',
            lastName: 'Morrison',
            dob: '1977-07-07',
            photoUrl: 'https://placehold.co/100x100/E2E8F0/64748B?text=SM'
          },
          riskProfile: {
            tier: 1,
            wellnessScores: {
              physical: 50, emotional: 50, social: 50, intellectual: 50,
              occupational: 50, environmental: 50, spiritual: 50, financial: 50
            },
            zCodes: [],
            lscmiScores: {}
          },
          careTeam: [{ userId: user.uid, name: user.email || 'User', role: 'CPC' }]
        },
        {
          demographics: {
            firstName: 'Marcus',
            lastName: 'Thompson',
            dob: '1985-03-15',
            photoUrl: 'https://placehold.co/100x100/E2E8F0/64748B?text=MT'
          },
          riskProfile: {
            tier: 2,
            wellnessScores: {
              physical: 40, emotional: 35, social: 45, intellectual: 55,
              occupational: 30, environmental: 50, spiritual: 60, financial: 25
            },
            zCodes: ['Z59.0', 'Z56.0'],
            lscmiScores: {}
          },
          careTeam: [{ userId: user.uid, name: user.email || 'User', role: 'CPC' }]
        },
        {
          demographics: {
            firstName: 'Elena',
            lastName: 'Rodriguez',
            dob: '1992-11-28',
            photoUrl: 'https://placehold.co/100x100/E2E8F0/64748B?text=ER'
          },
          riskProfile: {
            tier: 3,
            wellnessScores: {
              physical: 30, emotional: 25, social: 35, intellectual: 45,
              occupational: 20, environmental: 40, spiritual: 50, financial: 15
            },
            zCodes: ['Z59.0', 'Z59.4', 'Z63.4', 'Z91.5'],
            lscmiScores: {}
          },
          careTeam: [{ userId: user.uid, name: user.email || 'User', role: 'CPC' }]
        }
      ]

      // Add enrollees
      addLog('👥 Adding enrollees...', 'info')
      const enrolleesRef = collection(db, `artifacts/${appId}/public/data/enrollees`)
      const enrolleeIds = []
      for (const enrollee of enrollees) {
        const docRef = await addDoc(enrolleesRef, enrollee)
        enrolleeIds.push(docRef.id)
        addLog(`  ✅ Added: ${enrollee.demographics.firstName} ${enrollee.demographics.lastName}`, 'success')
      }
      addLog(`✅ Added ${enrollees.length} enrollees\n`, 'success')

      // Assign enrollees to current user
      addLog('👤 Assigning enrollees to your profile...', 'info')
      const userProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/main`)
      await setDoc(userProfileRef, {
        name: user.email || 'User',
        role: 'Certified Peer Counselor',
        email: user.email,
        assignedEnrollees: enrolleeIds
      }, { merge: true })
      addLog('  ✅ Enrollees assigned!\n', 'success')

      addLog('🎉 Sample data loaded successfully!', 'success')
      setStatus('success')
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const clearAllData = async () => {
    if (!window.confirm('Delete ALL data? This cannot be undone!')) return

    setLoading(true)
    setLogs([])
    addLog('🧹 Clearing data...', 'info')

    try {
      const collections = ['resources', 'enrollees', 'referrals']
      for (const collName of collections) {
        const ref = collection(db, `artifacts/${appId}/public/data/${collName}`)
        const snap = await getDocs(ref)
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, `artifacts/${appId}/public/data/${collName}`, docSnap.id))
        }
        addLog(`✅ Deleted ${snap.size} ${collName}`, 'success')
      }
      addLog('🎉 Cleanup complete!', 'success')
      setStatus('success')
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error')
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Load Sample Data</h1>
        <p className="text-slate-600">Populate your database with sample data for testing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={loadSampleData} disabled={loading} className="w-full bg-sky-600 hover:bg-sky-700">
              {loading ? '⏳ Loading...' : '📦 Load Sample Data'}
            </Button>
            <Button onClick={clearAllData} disabled={loading} variant="destructive" className="w-full">
              {loading ? '⏳ Clearing...' : '🗑️ Clear All Data'}
            </Button>
            {status === 'success' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">✅ Operation successful!</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => setCurrentPage('enrollees')} variant="outline" className="w-full">
              View My Enrollees →
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 text-slate-100 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-slate-400">Click an action to begin...</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-slate-300'}>
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// RESOURCE PROVIDER PORTAL
// ============================================================================

// Resource Provider Dashboard
function ResourceProviderDashboard() {
  const { db, user } = useAuthentication()
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    rejected: 0,
    total: 0
  })
  const [recentReferrals, setRecentReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const appId = window.__app_id || 'demo-app'

  useEffect(() => {
    if (!db || !user?.uid) return

    // Fetch all referrals (in a real system, this would filter by resource organization)
    const referralsRef = collection(db, `artifacts/${appId}/public/data/referrals`)
    
    const unsubscribe = onSnapshot(referralsRef, (snapshot) => {
      const referrals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Calculate stats
      const pending = referrals.filter(r => r.status === 'Pending').length
      const accepted = referrals.filter(r => r.status === 'Accepted').length
      const rejected = referrals.filter(r => r.status === 'Rejected').length

      setStats({
        pending,
        accepted,
        rejected,
        total: referrals.length
      })

      // Get recent referrals (last 5)
      const recent = referrals
        .sort((a, b) => {
          const timeA = a.createdTimestamp?.toMillis?.() || 0
          const timeB = b.createdTimestamp?.toMillis?.() || 0
          return timeB - timeA
        })
        .slice(0, 5)
      
      setRecentReferrals(recent)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, user, appId])

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Resource Provider Dashboard</h1>
        <p className="text-slate-600">Manage incoming referrals and service requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Referrals</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Accepted</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.accepted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.rejected}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Referrals</CardTitle>
          <CardDescription>Latest service requests from care coordinators</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-600">Loading referrals...</p>
          ) : recentReferrals.length === 0 ? (
            <p className="text-slate-600 text-center py-4">No referrals yet</p>
          ) : (
            <div className="space-y-3">
              {recentReferrals.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{referral.enrolleeName}</p>
                    <p className="text-sm text-slate-600">
                      {referral.resourceName} • {formatTimestamp(referral.createdTimestamp)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    referral.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                    referral.status === 'Accepted' ? 'bg-green-100 text-green-800 border-green-200' :
                    referral.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-slate-100 text-slate-800 border-slate-200'
                  }`}>
                    {referral.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => window.location.hash = 'referral-inbox'} className="w-full bg-sky-600 hover:bg-sky-700">
            View All Referrals
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

// Referral Communication Thread Component
function ReferralCommunicationThread({ referralId }) {
  const { db, user } = useAuthentication()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [showThread, setShowThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const appId = window.__app_id || 'demo-app'

  useEffect(() => {
    if (!db || !referralId) return

    const messagesRef = collection(db, `artifacts/${appId}/public/data/referrals/${referralId}/messages`)
    const q = query(messagesRef, orderBy('timestamp', 'asc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setMessages(messagesData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, referralId, appId])

  const handleSendMessage = async () => {
    if (!db || !newMessage.trim()) return
    setSending(true)
    try {
      const messagesRef = collection(db, `artifacts/${appId}/public/data/referrals/${referralId}/messages`)
      await addDoc(messagesRef, {
        content: newMessage.trim(),
        senderUserId: user?.uid,
        senderName: user?.email || 'User',
        timestamp: serverTimestamp()
      })
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => setShowThread(!showThread)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Messages {messages.length > 0 && `(${messages.length})`}
        </span>
        <span className="text-xs">{showThread ? '▲' : '▼'}</span>
      </Button>

      {showThread && (
        <div className="mt-3 space-y-3">
          {/* Message Thread */}
          {loading ? (
            <p className="text-xs text-slate-500">Loading messages...</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-2">No messages yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`p-3 rounded-lg ${
                    msg.senderUserId === user?.uid 
                      ? 'bg-sky-50 border border-sky-200' 
                      : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-xs font-medium text-slate-700">{msg.senderName}</p>
                    <p className="text-xs text-slate-500">{formatTimestamp(msg.timestamp)}</p>
                  </div>
                  <p className="text-sm text-slate-600">{msg.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* New Message Input */}
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              rows={2}
              disabled={sending}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              size="sm"
              className="bg-sky-600 hover:bg-sky-700"
            >
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Referral Inbox for Resource Providers
function ReferralInboxPage() {
  const { db, user } = useAuthentication()
  const { hasPermission } = usePermissions()
  const [referrals, setReferrals] = useState([])
  const [filter, setFilter] = useState('all') // all, pending, accepted, rejected
  const [selectedReferral, setSelectedReferral] = useState(null)
  const [showResponseDialog, setShowResponseDialog] = useState(false)
  const [responseNotes, setResponseNotes] = useState('')
  const [responding, setResponding] = useState(false)
  const [loading, setLoading] = useState(true)
  const appId = window.__app_id || 'demo-app'

  useEffect(() => {
    if (!db) return

    // Fetch all referrals (in a real system, filter by resource organization)
    const referralsRef = collection(db, `artifacts/${appId}/public/data/referrals`)
    
    const unsubscribe = onSnapshot(referralsRef, (snapshot) => {
      const referralsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const timeA = a.createdTimestamp?.toMillis?.() || 0
        const timeB = b.createdTimestamp?.toMillis?.() || 0
        return timeB - timeA
      })
      setReferrals(referralsData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, appId])

  const handleRespond = (referral, action) => {
    setSelectedReferral({ ...referral, action })
    setResponseNotes('')
    setShowResponseDialog(true)
  }

  const submitResponse = async () => {
    if (!db || !selectedReferral) return
    setResponding(true)
    try {
      const referralRef = doc(db, `artifacts/${appId}/public/data/referrals/${selectedReferral.id}`)
      await updateDoc(referralRef, {
        status: selectedReferral.action,
        responseNotes: responseNotes.trim(),
        respondedBy: user?.email || 'Resource Provider',
        respondedTimestamp: serverTimestamp()
      })
      setShowResponseDialog(false)
      setSelectedReferral(null)
    } catch (error) {
      console.error('Error responding to referral:', error)
      alert('Failed to respond to referral')
    } finally {
      setResponding(false)
    }
  }

  const filteredReferrals = filter === 'all' 
    ? referrals 
    : referrals.filter(r => r.status.toLowerCase() === filter)

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Referral Inbox</h1>
        <p className="text-slate-600">Review and respond to incoming service requests</p>
      </div>

      {/* Filter Tabs */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              size="sm"
            >
              All ({referrals.length})
            </Button>
            <Button 
              variant={filter === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilter('pending')}
              size="sm"
            >
              Pending ({referrals.filter(r => r.status === 'Pending').length})
            </Button>
            <Button 
              variant={filter === 'accepted' ? 'default' : 'outline'}
              onClick={() => setFilter('accepted')}
              size="sm"
            >
              Accepted ({referrals.filter(r => r.status === 'Accepted').length})
            </Button>
            <Button 
              variant={filter === 'rejected' ? 'default' : 'outline'}
              onClick={() => setFilter('rejected')}
              size="sm"
            >
              Rejected ({referrals.filter(r => r.status === 'Rejected').length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      {loading ? (
        <p className="text-slate-600">Loading referrals...</p>
      ) : filteredReferrals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-slate-600 text-center py-8">No referrals found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReferrals.map((referral) => (
            <Card key={referral.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{referral.enrolleeName}</CardTitle>
                    <CardDescription>
                      Referred to: {referral.resourceName} • {formatTimestamp(referral.createdTimestamp)}
                    </CardDescription>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    referral.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                    referral.status === 'Accepted' ? 'bg-green-100 text-green-800 border-green-200' :
                    referral.status === 'Rejected' ? 'bg-red-100 text-red-800 border-red-200' :
                    'bg-slate-100 text-slate-800 border-slate-200'
                  }`}>
                    {referral.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Referring CPC:</p>
                    <p className="text-sm text-slate-600">{referral.referringUserName}</p>
                  </div>
                  {referral.notes && (
                    <div>
                      <p className="text-sm font-medium text-slate-700">Notes:</p>
                      <p className="text-sm text-slate-600">{referral.notes}</p>
                    </div>
                  )}
                  {referral.responseNotes && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm font-medium text-slate-700">Response:</p>
                      <p className="text-sm text-slate-600">{referral.responseNotes}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        By {referral.respondedBy} • {formatTimestamp(referral.respondedTimestamp)}
                      </p>
                    </div>
                  )}

                  {/* Communication Thread */}
                  <ReferralCommunicationThread referralId={referral.id} />
                </div>
              </CardContent>
              {referral.status === 'Pending' && hasPermission('RESPOND_REFERRAL') && (
                <CardFooter className="flex gap-2">
                  <Button 
                    onClick={() => handleRespond(referral, 'Accepted')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Accept Referral
                  </Button>
                  <Button 
                    onClick={() => handleRespond(referral, 'Rejected')}
                    variant="destructive"
                    className="flex-1"
                  >
                    Reject Referral
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedReferral?.action === 'Accepted' ? 'Accept Referral' : 'Reject Referral'}
            </DialogTitle>
            <DialogDescription>
              Respond to referral for {selectedReferral?.enrolleeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="response-notes">Response Notes</Label>
              <Textarea
                id="response-notes"
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                placeholder="Add any notes about your decision..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResponseDialog(false)} disabled={responding}>
              Cancel
            </Button>
            <Button 
              onClick={submitResponse} 
              disabled={responding}
              className={selectedReferral?.action === 'Accepted' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={selectedReferral?.action === 'Rejected' ? 'destructive' : 'default'}
            >
              {responding ? 'Submitting...' : `Confirm ${selectedReferral?.action}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// ADMIN PORTAL
// ============================================================================

function AdminPortalPage() {
  const { db, user } = useAuthentication()
  const { hasPermission } = usePermissions()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingUserId, setEditingUserId] = useState(null)
  const [saving, setSaving] = useState(false)
  const appId = window.__app_id || 'demo-app'

  useEffect(() => {
    if (!db) return

    // Fetch all users
    const usersRef = collection(db, `artifacts/${appId}/users`)
    
    const unsubscribe = onSnapshot(usersRef, async (snapshot) => {
      const usersData = []
      
      for (const userDoc of snapshot.docs) {
        const userId = userDoc.id
        const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/main`)
        const profileSnap = await getDocs(query(collection(db, `artifacts/${appId}/users/${userId}/profile`)))
        
        if (profileSnap.docs.length > 0) {
          const profileData = profileSnap.docs[0].data()
          usersData.push({
            id: userId,
            ...profileData
          })
        }
      }
      
      setUsers(usersData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, appId])

  const handleRoleChange = async (userId, newRole) => {
    if (!db) return
    setSaving(true)
    try {
      const profileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/main`)
      await updateDoc(profileRef, {
        role: newRole
      })
      setEditingUserId(null)
    } catch (error) {
      console.error('Error updating user role:', error)
      alert('Failed to update user role')
    } finally {
      setSaving(false)
    }
  }

  if (!hasPermission('ADMIN_PORTAL')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have permission to access the Admin Portal.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Portal</h1>
        <p className="text-slate-600">Manage users, roles, and system settings</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Admins</CardDescription>
            <CardTitle className="text-3xl text-sky-600">
              {users.filter(u => u.role === ROLES.ADMIN).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Enrollment Managers</CardDescription>
            <CardTitle className="text-3xl text-emerald-600">
              {users.filter(u => u.role === ROLES.ENROLLMENT_MANAGER).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Partners</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {users.filter(u => u.role === ROLES.PARTNER).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* User Management Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage user roles and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-600">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No users found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Enrollees Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userData) => (
                  <TableRow key={userData.id}>
                    <TableCell className="font-mono text-xs">{userData.id.substring(0, 8)}...</TableCell>
                    <TableCell>{userData.name || 'N/A'}</TableCell>
                    <TableCell>{userData.email || 'Anonymous'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        userData.role === ROLES.ADMIN ? 'bg-sky-100 text-sky-800' :
                        userData.role === ROLES.ENROLLMENT_MANAGER ? 'bg-emerald-100 text-emerald-800' :
                        userData.role === ROLES.PARTNER ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {userData.role || 'No Role'}
                      </span>
                    </TableCell>
                    <TableCell>{userData.assignedEnrollees?.length || 0}</TableCell>
                    <TableCell className="text-right">
                      {editingUserId === userData.id ? (
                        <div className="flex justify-end gap-2">
                          <Select
                            value={userData.role}
                            onValueChange={(newRole) => handleRoleChange(userData.id, newRole)}
                            disabled={saving}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                              <SelectItem value={ROLES.ENROLLMENT_MANAGER}>Enrollment Manager</SelectItem>
                              <SelectItem value={ROLES.PARTNER}>Partner</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingUserId(null)}
                            disabled={saving}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUserId(userData.id)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Change Role
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Admin</CardTitle>
            <CardDescription>Full system access</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>Access to Admin Portal</li>
              <li>Manage all users and roles</li>
              <li>View both Enrollment & Partner portals</li>
              <li>Full CRUD on all data</li>
              <li>Load sample data</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enrollment Manager</CardTitle>
            <CardDescription>Care coordination & enrollment</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>Manage enrollees</li>
              <li>Create referrals</li>
              <li>View resources</li>
              <li>Update care plans</li>
              <li>Message with partners</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Partner</CardTitle>
            <CardDescription>Resource provider portal</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>View referral inbox</li>
              <li>Accept/reject referrals</li>
              <li>Message with CPCs</li>
              <li>View resources</li>
              <li>Partner dashboard</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// CONTENT AREA - ROUTER
// ============================================================================

function ContentArea({ currentPage, currentEnrolleeId, setCurrentPage, setCurrentEnrolleeId }) {
  switch (currentPage) {
    case 'admin-portal':
      return <AdminPortalPage />
    case 'dashboard':
      return <DashboardPage />
    case 'enrollees':
      return <MyEnrolleesPage setCurrentPage={setCurrentPage} setCurrentEnrolleeId={setCurrentEnrolleeId} />
    case 'journey-strip':
      return <JourneyStripMapPage />
    case 'resources':
      return <ResourcesPage />
    case 'referrals':
      return <ReferralsPage />
    case 'create':
      return <RecordCreationPage setCurrentPage={setCurrentPage} setCurrentEnrolleeId={setCurrentEnrolleeId} />
    case 'profile':
      return <EnrolleeProfilePage enrolleeId={currentEnrolleeId} setCurrentPage={setCurrentPage} />
    case 'load-data':
      return <LoadDataPage setCurrentPage={setCurrentPage} />
    // Resource Provider Portal Pages
    case 'provider-dashboard':
      return <ResourceProviderDashboard />
    case 'referral-inbox':
      return <ReferralInboxPage />
    default:
      return <DashboardPage />
  }
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [currentEnrolleeId, setCurrentEnrolleeId] = useState(null)

  return (
    <FirebaseProvider>
      <AppContent 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        currentEnrolleeId={currentEnrolleeId}
        setCurrentEnrolleeId={setCurrentEnrolleeId}
      />
    </FirebaseProvider>
  )
}

function AppContent({ currentPage, setCurrentPage, currentEnrolleeId, setCurrentEnrolleeId }) {
  const { user, loading } = useAuthentication()
  const { isPartner, isAdmin, loading: permissionsLoading } = usePermissions()
  const [hasSetInitialPage, setHasSetInitialPage] = useState(false)

  // Set default page based on role ONLY on initial load
  useEffect(() => {
    if (!permissionsLoading && !hasSetInitialPage && currentPage === 'dashboard') {
      if (isAdmin) {
        setCurrentPage('admin-portal')
      } else if (isPartner) {
        setCurrentPage('provider-dashboard')
      }
      setHasSetInitialPage(true)
    }
  }, [isPartner, isAdmin, permissionsLoading, currentPage, setCurrentPage, hasSetInitialPage])

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
          <p className="mt-4 text-slate-600">Loading ATLAS...</p>
        </div>
      </div>
    )
  }

  return (
    <MainLayout currentPage={currentPage} setCurrentPage={setCurrentPage} user={user}>
      <ContentArea 
        currentPage={currentPage} 
        currentEnrolleeId={currentEnrolleeId}
        setCurrentPage={setCurrentPage}
        setCurrentEnrolleeId={setCurrentEnrolleeId}
      />
    </MainLayout>
  )
}

export default App

