import type {
  AccessMatrixDataset,
  AccessMatrixEnrollmentRecord,
  AccessMatrixPartnerRecord,
  AccessMatrixPersonRecord,
  AccessMatrixSupervisorRecord,
  AdminPortalPersonRole
} from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const KNOWN_ROLE_KEYS: AdminPortalPersonRole[] = ['administrator', 'supervisor', 'navigator', 'partner', 'enrollee']

function createEmptyDataset(): AccessMatrixDataset {
  return {
    people: [],
    roleKeys: [...KNOWN_ROLE_KEYS],
    enrollmentAssignments: [],
    supervisorAssignments: [],
    partnerAssignments: [],
    updatedAtIso: new Date().toISOString()
  }
}

function toFullName(row: { display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }) {
  const explicit = row.display_name?.trim()
  if (explicit) return explicit
  const fallback = `${row.first_name || ''} ${row.last_name || ''}`.trim()
  if (fallback) return fallback
  return row.email?.trim() || 'unnamed person'
}

function normalizeRoles(values: string[]): AdminPortalPersonRole[] {
  return values.filter((value): value is AdminPortalPersonRole => KNOWN_ROLE_KEYS.includes(value as AdminPortalPersonRole))
}

function normalizePersonIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

export async function loadAccessMatrixDataset(): Promise<AccessMatrixDataset> {
  if (!hasSupabaseConfig || !supabase) return createEmptyDataset()
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    const atlasRole = sessionData.session?.user?.app_metadata?.atlas_role
    // Access matrix endpoints hit admin-only tables; skip requests until the
    // browser session is authenticated with an administrator claim.
    if (atlasRole !== 'administrator') return createEmptyDataset()

    const [peopleResult, rolesResult, activeAssignmentsResult, enrollmentResult, supervisorResult, partnerResult] =
      await Promise.all([
        (supabase as any)
          .schema('atlas')
          .from('people')
          .select('id, display_name, first_name, last_name, email')
          .order('display_name', { ascending: true }),
        (supabase as any)
          .schema('atlas')
          .from('roles')
          .select('id, role_key'),
        (supabase as any)
          .schema('atlas')
          .from('people_role_assignments')
          .select('person_id, role_id')
          .is('ends_on', null),
        (supabase as any)
          .schema('atlas')
          .from('v_active_enrollment_roster')
          .select('enrollment_id, enrollee_id, enrollee_name, case_id, navigator_person_ids')
          .order('enrollee_name', { ascending: true }),
        (supabase as any)
          .schema('atlas')
          .from('v_active_supervisor_assignment_edges')
          .select('navigator_person_id, supervisor_person_id'),
        (supabase as any)
          .schema('atlas')
          .from('v_active_partner_contact_edges')
          .select('partner_id, partner_name, contact_person_id, contact_email')
      ])

    const firstError =
      peopleResult.error ||
      rolesResult.error ||
      activeAssignmentsResult.error ||
      enrollmentResult.error ||
      supervisorResult.error ||
      partnerResult.error

    if (firstError) throw firstError

    const rolesById = new Map<string, string>((rolesResult.data || []).map((row: { id: string; role_key: string }) => [row.id, row.role_key]))
    const roleMapByPerson = new Map<string, Set<string>>()
    for (const assignment of activeAssignmentsResult.data || []) {
      const roleKey = rolesById.get((assignment as { role_id: string }).role_id)
      if (!roleKey) continue
      const personId = (assignment as { person_id: string }).person_id
      const current = roleMapByPerson.get(personId) || new Set<string>()
      current.add(roleKey)
      roleMapByPerson.set(personId, current)
    }

    const people: AccessMatrixPersonRecord[] = (peopleResult.data || []).map((row: any) => ({
      id: row.id,
      fullName: toFullName(row),
      email: row.email || '',
      roleKeys: normalizeRoles(Array.from(roleMapByPerson.get(row.id) || []))
    }))

    const enrollmentAssignments: AccessMatrixEnrollmentRecord[] = (enrollmentResult.data || []).map((row: any) => ({
      enrollmentId: row.enrollment_id,
      enrolleeId: row.enrollee_id,
      enrolleeName: row.enrollee_name || 'unnamed enrollee',
      caseId: row.case_id || '',
      navigatorPersonIds: normalizePersonIds(Array.isArray(row.navigator_person_ids) ? row.navigator_person_ids : [])
    }))

    const supervisorIdsByNavigator = new Map<string, Set<string>>()
    for (const row of supervisorResult.data || []) {
      const candidate = row as { navigator_person_id: string; supervisor_person_id: string }
      const current = supervisorIdsByNavigator.get(candidate.navigator_person_id) || new Set<string>()
      current.add(candidate.supervisor_person_id)
      supervisorIdsByNavigator.set(candidate.navigator_person_id, current)
    }

    const supervisorAssignments: AccessMatrixSupervisorRecord[] = people
      .filter((person) => person.roleKeys.includes('navigator'))
      .map((person) => ({
        navigatorPersonId: person.id,
        supervisorPersonIds: normalizePersonIds(Array.from(supervisorIdsByNavigator.get(person.id) || []))
      }))

    const partnerRecordById = new Map<string, { organizationName: string; personIds: Set<string>; emails: Set<string> }>()
    for (const row of partnerResult.data || []) {
      const candidate = row as {
        partner_id: string
        partner_name: string | null
        contact_person_id: string | null
        contact_email: string | null
      }
      const current = partnerRecordById.get(candidate.partner_id) || {
        organizationName: candidate.partner_name || 'unnamed partner',
        personIds: new Set<string>(),
        emails: new Set<string>()
      }
      if (candidate.contact_person_id) current.personIds.add(candidate.contact_person_id)
      if (candidate.contact_email?.trim()) current.emails.add(candidate.contact_email.trim().toLowerCase())
      partnerRecordById.set(candidate.partner_id, current)
    }

    const partnerAssignments: AccessMatrixPartnerRecord[] = Array.from(partnerRecordById.entries()).map(([partnerId, value]) => ({
      partnerId,
      organizationName: value.organizationName,
      primaryContactPersonIds: normalizePersonIds(Array.from(value.personIds)),
      primaryContactEmails: normalizePersonIds(Array.from(value.emails))
    }))

    return {
      people,
      roleKeys: [...KNOWN_ROLE_KEYS],
      enrollmentAssignments,
      supervisorAssignments,
      partnerAssignments,
      updatedAtIso: new Date().toISOString()
    }
  } catch (error) {
    if (isOptionalSupabaseDataError(error)) return createEmptyDataset()
    throw error
  }
}

export async function saveAccessMatrixPersonRoles(personId: string, roleKeys: AdminPortalPersonRole[]) {
  if (!hasSupabaseConfig || !supabase) return
  const nextRoleKeys = normalizeRoles(Array.from(new Set(roleKeys)))
  const { error } = await (supabase as any).rpc('fn_access_matrix_save_person_roles', {
    target_person_id: personId,
    target_role_keys: nextRoleKeys
  })
  if (error) throw error
}

export async function saveAccessMatrixEnrollmentNavigators(enrollmentId: string, navigatorPersonIds: string[]) {
  if (!hasSupabaseConfig || !supabase) return
  const { error } = await (supabase as any).rpc('fn_access_matrix_save_enrollment_navigators', {
    target_enrollment_id: enrollmentId,
    target_navigator_person_ids: normalizePersonIds(navigatorPersonIds)
  })
  if (error) throw error
}

export async function saveAccessMatrixSupervisorAssignments(navigatorPersonId: string, supervisorPersonIds: string[]) {
  if (!hasSupabaseConfig || !supabase) return
  const { error } = await (supabase as any).rpc('fn_access_matrix_save_navigator_supervisors', {
    target_navigator_person_id: navigatorPersonId,
    target_supervisor_person_ids: normalizePersonIds(supervisorPersonIds)
  })
  if (error) throw error
}

export async function saveAccessMatrixPartnerPrimaryContacts(partnerId: string, primaryContactPersonIds: string[]) {
  if (!hasSupabaseConfig || !supabase) return
  const { error } = await (supabase as any).rpc('fn_access_matrix_save_partner_contacts', {
    target_partner_id: partnerId,
    target_primary_contact_person_ids: normalizePersonIds(primaryContactPersonIds)
  })
  if (error) throw error
}
