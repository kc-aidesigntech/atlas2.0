import type {
  CreateSessionRecord,
  NavigatorCreateReflectionRecord,
  SupervisorIpsAssessmentRecord,
  SupervisorNavigatorCompetencySummary
} from '@/features/atlas2026/shared/contracts'
import type { SupervisorNavigatorDirectoryEntry, SupervisorProfileOverlayKey } from './SupervisorProfileOverlay'

/** The records and save handlers My Wallet passes to the supervisor cards' overlay (`supervision.give`). */
export interface SupervisorWalletProps {
  currentSupervisorName: string
  navigatorDirectory: SupervisorNavigatorDirectoryEntry[]
  competencyByNavigator: SupervisorNavigatorCompetencySummary[]
  allSupervisorIpsAssessments: SupervisorIpsAssessmentRecord[]
  managedCreateReflections: NavigatorCreateReflectionRecord[]
  isSavingAssignments?: boolean
  onToggleManagedNavigator?: (navigatorPersonId: string, isManaged: boolean) => Promise<void> | void
  onSaveSupervisorIpsAssessment: (record: SupervisorIpsAssessmentRecord) => Promise<unknown> | unknown
  onSaveCreateReflectionOverride: (input: { navigatorName: string; reflectionText: string }) => Promise<unknown> | unknown
  onRestoreCreateReflectionGenerated: (navigatorName: string) => Promise<unknown> | unknown
  createSessions?: CreateSessionRecord[]
  onSaveCreateSession?: (record: CreateSessionRecord) => Promise<unknown> | unknown
}

export const SUPERVISOR_PROFILE_CARDS: Array<{
  // overlayId (not "key") avoids gitleaks generic-api-key false positives on section ids.
  overlayId: SupervisorProfileOverlayKey
  title: string
  cardTitle: string
  cardSubtitle: string
  actionLabel: string
  variant: 'green' | 'blue'
  illustration: 'feedback' | 'reflection' | 'create'
  /** False for the roster section: My Wallet's assignments overlay holds the navigator claim circles. */
  isWalletCard: boolean
}> = [
  // Intentional Peer Support Core Competencies (IPSCC).
  { overlayId: 'section_1_weekly_ips', title: 'Section 1: Weekly IPSCC assessment by supervisor', cardTitle: 'weekly review', cardSubtitle: 'ipscc', actionLabel: 'start reflection', variant: 'blue', illustration: 'reflection', isWalletCard: true },
  { overlayId: 'section_2_assigned_navigators', title: 'Section 2: Assigned navigators', cardTitle: 'navigator roster', cardSubtitle: 'assignments', actionLabel: 'view feedback', variant: 'green', illustration: 'feedback', isWalletCard: false },
  { overlayId: 'section_3_assessment_rollup', title: 'Section 3: Navigator assessment rollup', cardTitle: 'assessment rollup', cardSubtitle: 'competency', actionLabel: 'create & share', variant: 'green', illustration: 'create', isWalletCard: true },
  { overlayId: 'section_4_create_reflections', title: 'Section 4: C.R.E.A.T.E. reflection review', cardTitle: 'c.r.e.a.t.e.', cardSubtitle: 'review & override', actionLabel: 'review reflections', variant: 'blue', illustration: 'reflection', isWalletCard: true }
]

export const SUPERVISOR_WALLET_CARDS = SUPERVISOR_PROFILE_CARDS.filter((card) => card.isWalletCard)
