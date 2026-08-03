import type {
  AtlasRole,
  EnrollmentRequestRecord,
  NavigatorEnrollmentAssignmentRecord,
  UnassignedEnrolleePickupRecord
} from '@/features/atlas2026/shared/contracts'
import {
  fetchEnrollmentAssignmentBoard,
  fetchNavigatorAssignedEnrollees,
  fetchSinglePaneEnrolleeProfiles,
  fetchSinglePaneEnrollmentRequests
} from '@atlas/shared'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const DEMO_NAVIGATOR_NAME = 'atlas demo navigator'
let demoTagsTableUnavailable = false

export interface ReferralClaimMaterializationResult {
  enrollmentId: string
  enrolleeId: string
  enrolleeName: string
  createdAtIso: string
}

interface NavigatorAssignmentProfileInput {
  enrollmentId: string
  enrolleeId: string
  fullName: string
  caseId: string
  assignedNavigator: string
  activeZCodeDetails?: Array<{ parentCode?: string }>
  zCodeTags?: string[]
}

function deriveParentCodesForAssignmentBoard(profile: {
  activeZCodeDetails?: Array<{ parentCode?: string }>
  zCodeTags?: string[]
}) {
  const fromDetails = (profile.activeZCodeDetails || [])
    .map((detail) => String(detail.parentCode || '').trim().toUpperCase())
    .filter((code) => /^Z\d{2}$/.test(code))

  const source = fromDetails.length
    ? fromDetails
    : (profile.zCodeTags || [])
        .map((tag) => {
          const match = String(tag || '')
            .trim()
            .toUpperCase()
            .match(/^Z(\d{2})/)
          return match ? `Z${match[1]}` : ''
        })
        .filter((code) => /^Z\d{2}$/.test(code))

  return Array.from(new Set(source)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

function normalizeRosterAssignedNavigatorLabel(value: string | null | undefined) {
  const normalized = (value || '').trim()
  if (!normalized) return ''
  return normalized.toLowerCase() === 'unassigned' ? '' : normalized
}

// Shared with bootstrap because both assignment views must resolve the same session identity.
export async function resolveSessionPersonIdFromMetadata() {
  if (!supabase) return null
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const appMetadata = sessionData.session?.user?.app_metadata || {}
  const metadataPersonId = String(
    (appMetadata as Record<string, unknown>).person_id || (appMetadata as Record<string, unknown>).atlas_person_id || ''
  ).trim()
  if (metadataPersonId) return metadataPersonId
  const { data: helperData, error: helperError } = await (supabase as any).schema('atlas').rpc('fn_current_person_id')
  if (helperError) {
    const helperCode = (helperError as { code?: string } | null)?.code
    if (helperCode === 'PGRST202') return null
    throw helperError
  }
  if (typeof helperData === 'string' && helperData.trim()) return helperData
  if (Array.isArray(helperData) && helperData.length) {
    const firstRow = helperData[0] as Record<string, unknown>
    const keyedValue = String(firstRow.fn_current_person_id || firstRow.id || '').trim()
    if (keyedValue) return keyedValue
  }
  if (helperData && typeof helperData === 'object') {
    const keyedValue = String((helperData as Record<string, unknown>).fn_current_person_id || '').trim()
    if (keyedValue) return keyedValue
  }
  return null
}

export async function loadEnrollmentRequests(role: AtlasRole): Promise<EnrollmentRequestRecord[]> {
  if (role !== 'navigator' || !hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []
  const rows = await withOptionalSupabaseFallback('singlepane.enrollmentRequests', () => fetchSinglePaneEnrollmentRequests(supabase), [])
  return rows.map((row) => ({
    id: row.id,
    submittedAt: row.submittedAt,
    status: row.status,
    prospectiveEnrollee: row.prospectiveEnrollee,
    email: row.email || undefined
  }))
}

export async function loadNavigatorEnrollmentAssignments(
  options?: { profileRows?: NavigatorAssignmentProfileInput[] }
): Promise<NavigatorEnrollmentAssignmentRecord[]> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []
  const [profiles, assignmentBoardRows, navigatorAssignments, navigatorPersonId] = await Promise.all([
    options?.profileRows
      ? Promise.resolve(options.profileRows)
      : withOptionalSupabaseFallback('singlepane.navigatorEnrollmentProfiles', () => fetchSinglePaneEnrolleeProfiles(supabase), []),
    withOptionalSupabaseFallback('singlepane.enrollmentAssignmentBoard', () => fetchEnrollmentAssignmentBoard(supabase), []),
    withOptionalSupabaseFallback('singlepane.navigatorAssignedEnrollees', () => fetchNavigatorAssignedEnrollees(supabase), []),
    withOptionalSupabaseFallback('singlepane.navigatorPersonFromMetadata', () => resolveSessionPersonIdFromMetadata(), null)
  ])

  const viewerEnrollmentIds = new Set(
    navigatorAssignments
      // Treat "assigned to you" as true only when session metadata proves navigator identity.
      // If identity resolution fails, trust database-scoped assignment rows for this navigator session.
      .filter((assignment) => (navigatorPersonId ? assignment.navigatorPersonId === navigatorPersonId : true))
      .map((assignment) => assignment.enrollmentId)
  )
  const assignmentCountsByEnrollmentId = navigatorAssignments.reduce<Record<string, Set<string>>>((accumulator, assignment) => {
    if (!accumulator[assignment.enrollmentId]) accumulator[assignment.enrollmentId] = new Set<string>()
    accumulator[assignment.enrollmentId].add(assignment.navigatorPersonId)
    return accumulator
  }, {})
  const assignmentBoardByEnrollmentId = new Map(assignmentBoardRows.map((row) => [row.enrollmentId, row]))

  return profiles
    .map((profile) => {
      const boardRow = assignmentBoardByEnrollmentId.get(profile.enrollmentId)
      const edgeNavigatorCount = assignmentCountsByEnrollmentId[profile.enrollmentId]?.size || 0
      const boardNavigatorCount = boardRow?.navigatorPersonIds.length || 0
      const navigatorAssignmentCount = Math.max(edgeNavigatorCount, boardNavigatorCount)
      const isAssignedToAnyNavigator = navigatorAssignmentCount > 0
      const boardNames = boardRow?.navigatorNames || []
      const normalizedRosterNavigatorName = normalizeRosterAssignedNavigatorLabel(profile.assignedNavigator)
      const assignedNavigatorNames = boardNames.length
        ? Array.from(new Set(boardNames.map((name) => name.trim()).filter(Boolean)))
        : isAssignedToAnyNavigator && normalizedRosterNavigatorName
          ? [normalizedRosterNavigatorName]
          : []
      return {
        enrollmentId: profile.enrollmentId,
        enrolleeId: profile.enrolleeId,
        enrolleeName: profile.fullName,
        caseId: profile.caseId,
        assignedNavigatorLabel: isAssignedToAnyNavigator ? 'assigned' : 'unassigned',
        navigatorAssignmentCount,
        assignedNavigatorNames,
        zCodeParentCodes: deriveParentCodesForAssignmentBoard(profile),
        isAssignedToAnyNavigator,
        isAssignedToViewer: viewerEnrollmentIds.has(profile.enrollmentId)
      }
    })
    .sort((left, right) => left.enrolleeName.localeCompare(right.enrolleeName))
}

export async function assignNavigatorEnrollmentToSelf(enrollmentId: string) {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return
  const { error } = await (supabase as any).schema('atlas').rpc('fn_navigator_assign_enrollment_to_self', {
    target_enrollment_id: enrollmentId
  })
  if (error) throw error
  const rows = await fetchNavigatorAssignedEnrollees(supabase)
  // Verify the write is visible immediately so identity or grant failures are deterministic.
  if (!rows.some((row) => row.enrollmentId === enrollmentId)) {
    throw new Error(
      `Assignment write completed for enrollment ${enrollmentId}, but the row is not visible to this navigator yet. Verify identity mapping and Row-Level Security grants.`
    )
  }
}

export async function unassignNavigatorEnrollmentFromSelf(enrollmentId: string) {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return
  const { error } = await (supabase as any).schema('atlas').rpc('fn_navigator_unassign_enrollment_from_self', {
    target_enrollment_id: enrollmentId
  })
  if (error) throw error
}

export async function materializeClaimedReferralIntoEnrollment(record: UnassignedEnrolleePickupRecord) {
  if (!record.id || !hasSupabaseConfig || !supabase) return null
  const payload = {
    queue_record_id: record.id,
    full_name: record.fullName,
    email: record.email || null,
    phone: record.phone || null,
    case_id: record.caseId || null,
    referrer_name: record.referrerName || null,
    referrer_organization: record.referrerOrganization || null,
    background_notes: record.backgroundNotes || null,
    metadata: { demo_tag: 'atlas_demo', demo_record: true, demo_navigator_name: DEMO_NAVIGATOR_NAME }
  }
  const { data, error } = await (supabase as any).schema('atlas').rpc('fn_claim_referral_queue_to_enrollment', payload)
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const typed = row as Record<string, unknown>
  const enrollmentId = String(typed.enrollment_id || typed.enrollmentId || '').trim()
  const enrolleeId = String(typed.enrollee_id || typed.enrolleeId || '').trim()
  if (!enrollmentId || !enrolleeId) return null
  return {
    enrollmentId,
    enrolleeId,
    enrolleeName: String(typed.enrollee_name || typed.enrolleeName || record.fullName || ''),
    createdAtIso: String(typed.created_at || typed.createdAt || new Date().toISOString())
  } satisfies ReferralClaimMaterializationResult
}

export async function upsertEnrollmentInferredZCodes(
  enrollmentId: string,
  zCodes: string[],
  sourceLabel = 'demo_ollama_inference'
) {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return []
  const normalizedCodes = Array.from(
    new Set(zCodes.map((value) => value.trim().toUpperCase()).filter((value) => /^Z\d{2}(\.\d+)?$/.test(value)))
  )
  if (!normalizedCodes.length) return []

  // A validated security-definer command scopes the caller, resolves identifiers,
  // de-duplicates active rows, and inserts the inferred codes atomically.
  const { data: applied, error: intakeError } = await (supabase as any)
    .schema('atlas')
    .rpc('fn_intake_enrollment_inferred_z_codes', {
      p_enrollment_id: enrollmentId,
      p_z_codes: normalizedCodes,
      p_source: sourceLabel
    })
  if (intakeError) throw intakeError
  return (applied || []) as string[]
}

export async function loadDemoTaggedEnrollmentIds(tag = 'atlas_demo') {
  if (demoTagsTableUnavailable || !hasSupabaseConfig || !supabase) return []
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('demo_record_tags')
    .select('record_id')
    .eq('tag', tag)
    .eq('record_type', 'enrollments')
  if (error) {
    const typedError = error as { code?: string; message?: string } | null
    if (typedError?.code === 'PGRST205' || typedError?.code === '42P01') {
      demoTagsTableUnavailable = true
      return []
    }
    throw error
  }
  return (data || []).map((row: { record_id: string }) => row.record_id).filter(Boolean)
}
