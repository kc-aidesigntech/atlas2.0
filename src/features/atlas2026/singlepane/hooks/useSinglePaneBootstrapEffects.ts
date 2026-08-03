import { useEffect, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type {
  AccessMatrixPersonRecord,
  AccountSettings,
  AdminDeletableServiceCapacitySubmissionRecord,
  AtlasRole,
  EnrolleeProfile,
  NavigatorEnrollmentAssignmentRecord,
  NavigatorProgramState,
  PartnerTroubleshootingGrant,
  TroubleshootingSessionState,
  UnassignedEnrolleePickupRecord,
  ZCodeDomainSurveyHistorySummary
} from '@/features/atlas2026/shared/contracts'
import {
  loadDemoTaggedEnrollmentIds,
  loadEnrollmentRequests,
  loadNavigatorEnrollmentAssignments,
  loadNavigatorProgramState,
  loadPartnerStationProfile,
  loadPartnerTroubleshootingGrants,
  prefetchJourneyStationMarkersForEnrollments,
  prefetchRouteCandidatesForEnrollments
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { loadPublicReferralQueueRecords } from '@/features/atlas2026/singlepane/data-access/publicReferralRepository'
import type { SinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'
import {
  SESSION_ACTIVE_MENU_KEY,
  SESSION_REMOTE_SESSION_KEY,
  SESSION_ROLE_KEY,
  writeSessionStorageValue
} from '@/features/atlas2026/singlepane/domain/sessionStorage'
import {
  extractAuthoritativeRolesFromSession,
  haveSameRoles,
  normalizeAtlasRoleKeys
} from '@/features/atlas2026/singlepane/domain/roles'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

interface AssignmentProfile {
  enrollmentId: string
  enrolleeId: string
  fullName: string
  caseId: string
  assignedNavigator: string
  activeZCodeDetails: EnrolleeProfile['activeZCodeDetails']
  zCodeTags: string[]
}

interface UseSinglePaneBootstrapEffectsInput {
  role: AtlasRole
  viewerRole: AtlasRole
  activeMenu: string
  selectedRoleTopMenus: string[]
  selectedRoleTopMenusKey: string
  remoteSession: TroubleshootingSessionState | null
  setRemoteSession: Dispatch<SetStateAction<TroubleshootingSessionState | null>>
  setRoleState: Dispatch<SetStateAction<AtlasRole>>
  setActiveMenu: Dispatch<SetStateAction<string>>
  sessionEmail: string
  setSessionEmail: Dispatch<SetStateAction<string>>
  authoritativeAccountRoles: AtlasRole[]
  setAuthoritativeAccountRoles: Dispatch<SetStateAction<AtlasRole[]>>
  adminDefaultAppliedForEmailRef: MutableRefObject<string | null>
  accountSettings: AccountSettings
  viewerPerson: AccessMatrixPersonRecord | null
  remotePartnerOrganizationName: string | null
  navigatorAssignmentProfiles: AssignmentProfile[]
  scopedEnrollees: EnrolleeProfile[]
  enrollees: EnrolleeProfile[]
  setBootstrapState: Dispatch<SetStateAction<SinglePaneBootstrapState>>
  setNavigatorProgramState: Dispatch<SetStateAction<NavigatorProgramState>>
  setNavigatorProgramError: Dispatch<SetStateAction<string | null>>
  setPartnerTroubleshootingGrants: Dispatch<SetStateAction<Record<string, PartnerTroubleshootingGrant>>>
  setRemotePartnerStationProfile: Dispatch<SetStateAction<Awaited<ReturnType<typeof loadPartnerStationProfile>> | null>>
  setNavigatorEnrollmentAssignments: Dispatch<SetStateAction<NavigatorEnrollmentAssignmentRecord[]>>
  setNavigatorEnrollmentAssignmentsError: Dispatch<SetStateAction<string | null>>
  setIsLoadingNavigatorEnrollmentAssignments: Dispatch<SetStateAction<boolean>>
  setPendingAssignmentEnrollees: Dispatch<SetStateAction<EnrolleeProfile[]>>
  setDemoTaggedEnrollmentIds: Dispatch<SetStateAction<string[]>>
  setPublicQueueRecords: Dispatch<SetStateAction<UnassignedEnrolleePickupRecord[]>>
  setZCodeDomainSurveyHistorySummary: Dispatch<SetStateAction<ZCodeDomainSurveyHistorySummary[]>>
  setZCodeDomainSurveyHistoryError: Dispatch<SetStateAction<string | null>>
  setAdminDeletableServiceCapacitySubmissions: Dispatch<SetStateAction<AdminDeletableServiceCapacitySubmissionRecord[]>>
  setAdminServiceCapacityDeletionError: Dispatch<SetStateAction<string | null>>
  reloadZCodeDomainSurveyHistory: () => Promise<void>
  reloadAdminDeletableServiceCapacitySubmissions: () => Promise<void>
}

/**
 * Coordinates mount, authentication, role-change, and background prefetch effects.
 * Keeping these transitions together makes cancellation and identity guardrails auditable.
 */
export function useSinglePaneBootstrapEffects(input: UseSinglePaneBootstrapEffectsInput) {
  const backgroundPrefetchEnrollments = useMemo(
    () =>
      input.scopedEnrollees
        .slice(0, 6)
        .map((enrollee) => ({ enrollmentId: enrollee.enrollmentId, enrolleeId: enrollee.id }))
        .filter((entry) => Boolean(entry.enrollmentId)),
    [input.scopedEnrollees]
  )

  useEffect(() => writeSessionStorageValue(SESSION_ROLE_KEY, input.role), [input.role])
  useEffect(
    () => writeSessionStorageValue(SESSION_ACTIVE_MENU_KEY, input.activeMenu || null),
    [input.activeMenu]
  )
  useEffect(
    () =>
      writeSessionStorageValue(
        SESSION_REMOTE_SESSION_KEY,
        input.remoteSession?.isActive ? JSON.stringify(input.remoteSession) : null
      ),
    [input.remoteSession]
  )

  useEffect(() => {
    let isMounted = true
    void loadPublicReferralQueueRecords().then((records) => {
      if (isMounted) input.setPublicQueueRecords(records)
    })
    return () => {
      isMounted = false
    }
  }, [input.setPublicQueueRecords])

  useEffect(() => {
    input.setPendingAssignmentEnrollees((current) => {
      const pending = current.filter((item) => !input.enrollees.some((enrollee) => enrollee.id === item.id))
      return pending.length === current.length ? current : pending
    })
  }, [input.enrollees, input.setPendingAssignmentEnrollees])

  useEffect(() => {
    const firstMenu = input.selectedRoleTopMenus[0]
    if (firstMenu) {
      input.setActiveMenu((current) => (input.selectedRoleTopMenus.includes(current) ? current : firstMenu))
    }
  }, [input.selectedRoleTopMenus, input.selectedRoleTopMenusKey, input.setActiveMenu])

  useEffect(() => {
    if (input.viewerRole !== 'administrator') {
      input.setZCodeDomainSurveyHistorySummary([])
      input.setZCodeDomainSurveyHistoryError(null)
      input.setAdminDeletableServiceCapacitySubmissions([])
      input.setAdminServiceCapacityDeletionError(null)
      return
    }
    void input.reloadZCodeDomainSurveyHistory()
    void input.reloadAdminDeletableServiceCapacitySubmissions()
  }, [input.viewerRole])

  useEffect(() => {
    if (!backgroundPrefetchEnrollments.length || typeof window === 'undefined') return
    const timeoutId = window.setTimeout(() => {
      void prefetchRouteCandidatesForEnrollments(backgroundPrefetchEnrollments.map((entry) => entry.enrollmentId))
      void prefetchJourneyStationMarkersForEnrollments(backgroundPrefetchEnrollments)
    }, 180)
    return () => window.clearTimeout(timeoutId)
  }, [backgroundPrefetchEnrollments])

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      input.setSessionEmail('')
      input.setAuthoritativeAccountRoles([])
      return
    }
    let isMounted = true
    const applySession = (
      session: { user?: { email?: string | null; app_metadata?: Record<string, unknown> | null } | null } | null
    ) => {
      if (!isMounted) return
      input.setSessionEmail(session?.user?.email?.trim() || '')
      input.setAuthoritativeAccountRoles(extractAuthoritativeRolesFromSession(session))
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!error) applySession(data.session)
    })
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))
    return () => {
      isMounted = false
      authListener?.subscription?.unsubscribe()
    }
  }, [input.setAuthoritativeAccountRoles, input.setSessionEmail])

  useEffect(() => {
    if (!input.authoritativeAccountRoles.length || input.authoritativeAccountRoles.includes('administrator')) return
    if (input.remoteSession) input.setRemoteSession(null)
    if (!input.authoritativeAccountRoles.includes(input.role)) {
      input.setRoleState(input.authoritativeAccountRoles[0])
    }
  }, [input.authoritativeAccountRoles, input.remoteSession, input.role])

  useEffect(() => {
    const normalizedEmail = input.sessionEmail.trim().toLowerCase()
    if (!normalizedEmail) return
    if (!input.authoritativeAccountRoles.includes('administrator')) {
      input.adminDefaultAppliedForEmailRef.current = null
      return
    }
    if (input.adminDefaultAppliedForEmailRef.current === normalizedEmail) return
    input.adminDefaultAppliedForEmailRef.current = normalizedEmail
    input.setRoleState('administrator')
  }, [input.authoritativeAccountRoles, input.sessionEmail])

  useEffect(() => {
    let isMounted = true
    void loadNavigatorProgramState()
      .then((state) => {
        if (!isMounted) return
        input.setNavigatorProgramState(state)
        input.setNavigatorProgramError(null)
      })
      .catch((error) => {
        if (isMounted) {
          input.setNavigatorProgramError(error instanceof Error ? error.message : 'Unable to load navigator program state.')
        }
      })
    return () => {
      isMounted = false
    }
  }, [input.setNavigatorProgramError, input.setNavigatorProgramState])

  useEffect(() => {
    let isMounted = true
    void loadPartnerTroubleshootingGrants()
      .then((grants) => {
        if (isMounted) input.setPartnerTroubleshootingGrants(grants)
      })
      .catch((error) => console.warn('Unable to load partner troubleshooting grants.', error))
    return () => {
      isMounted = false
    }
  }, [input.setPartnerTroubleshootingGrants])

  useEffect(() => {
    if (input.remoteSession || !input.viewerPerson) return
    const derivedRoles = normalizeAtlasRoleKeys(input.viewerPerson.roleKeys)
    if (!derivedRoles.length || haveSameRoles(derivedRoles, input.accountSettings.enabledRoles)) return
    input.setBootstrapState((current) => ({
      ...current,
      accountSettings: { ...current.accountSettings, enabledRoles: derivedRoles }
    }))
    if (!derivedRoles.includes(input.role)) input.setRoleState(derivedRoles[0] || 'navigator')
  }, [input.accountSettings.enabledRoles, input.remoteSession, input.role, input.viewerPerson])

  useEffect(() => {
    if (input.remoteSession?.targetRole !== 'partner') {
      input.setRemotePartnerStationProfile(null)
      return
    }
    const organizationName = input.remotePartnerOrganizationName || input.remoteSession.targetOrganizationName || ''
    if (!organizationName.trim()) {
      input.setRemotePartnerStationProfile(null)
      return
    }
    let isMounted = true
    void loadPartnerStationProfile(organizationName, {
      fullName: input.remoteSession.targetDisplayName,
      email: input.remoteSession.targetEmail
    })
      .then((profile) => {
        if (isMounted) input.setRemotePartnerStationProfile(profile)
      })
      .catch((error) => {
        if (!isMounted) return
        console.warn('Unable to load remote partner station profile.', error)
        input.setRemotePartnerStationProfile(null)
      })
    return () => {
      isMounted = false
    }
  }, [
    input.remotePartnerOrganizationName,
    input.remoteSession?.targetDisplayName,
    input.remoteSession?.targetEmail,
    input.remoteSession?.targetOrganizationName,
    input.remoteSession?.targetRole
  ])

  useEffect(() => {
    if (input.viewerRole !== 'navigator' || input.role === 'navigator') return
    let isMounted = true
    void loadEnrollmentRequests('navigator')
      .then((requests) => {
        if (isMounted) input.setBootstrapState((current) => ({ ...current, enrollmentRequests: requests }))
      })
      .catch((error) => console.warn('Unable to load navigator enrollment requests for troubleshooting.', error))
    return () => {
      isMounted = false
    }
  }, [input.role, input.viewerRole])

  useEffect(() => {
    if (input.viewerRole !== 'navigator') {
      input.setNavigatorEnrollmentAssignments([])
      input.setNavigatorEnrollmentAssignmentsError(null)
      input.setIsLoadingNavigatorEnrollmentAssignments(false)
      return
    }
    let isMounted = true
    input.setIsLoadingNavigatorEnrollmentAssignments(true)
    void loadNavigatorEnrollmentAssignments({ profileRows: input.navigatorAssignmentProfiles })
      .then((rows) => {
        if (!isMounted) return
        input.setNavigatorEnrollmentAssignments(rows)
        input.setNavigatorEnrollmentAssignmentsError(null)
      })
      .catch((error) => {
        if (isMounted) {
          input.setNavigatorEnrollmentAssignmentsError(
            error instanceof Error ? error.message : 'Unable to load navigator assignment board.'
          )
        }
      })
      .finally(() => {
        if (isMounted) input.setIsLoadingNavigatorEnrollmentAssignments(false)
      })
    return () => {
      isMounted = false
    }
  }, [input.navigatorAssignmentProfiles, input.viewerRole])

  useEffect(() => {
    if (input.viewerRole !== 'partner') {
      input.setDemoTaggedEnrollmentIds([])
      return
    }
    let isMounted = true
    void loadDemoTaggedEnrollmentIds()
      .then((ids) => {
        if (isMounted) input.setDemoTaggedEnrollmentIds(ids)
      })
      .catch((error) => console.warn('Unable to load demo-tagged enrollment ids for partner scope.', error))
    return () => {
      isMounted = false
    }
  }, [input.viewerRole])
}
