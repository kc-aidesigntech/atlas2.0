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

export async function loadAccessMatrixDataset(): Promise<AccessMatrixDataset> {
  if (!hasSupabaseConfig || !supabase) return createEmptyDataset()
  try {
    const [peopleResult, rolesResult, activeAssignmentsResult, enrollmentResult, navigatorResult, supervisorResult, partnerResult] =
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
          .from('v_singlepane_enrollee_profiles')
          .select('enrollment_id, enrollee_id, full_name, case_id')
          .order('full_name', { ascending: true }),
        (supabase as any)
          .schema('atlas')
          .from('navigator_assignments')
          .select('enrollment_id, navigator_person_id')
          .is('ends_on', null),
        (supabase as any)
          .schema('atlas')
          .from('supervisor_navigator_assignments')
          .select('navigator_person_id, supervisor_person_id')
          .is('ends_on', null),
        (supabase as any)
          .schema('atlas')
          .from('partners')
          .select('id, organization_name, primary_contact_email')
          .eq('is_active', true)
      ])

    const firstError =
      peopleResult.error ||
      rolesResult.error ||
      activeAssignmentsResult.error ||
      enrollmentResult.error ||
      navigatorResult.error ||
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

    const personIdByEmail = new Map<string, string>()
    for (const person of people) {
      if (person.email.trim()) {
        personIdByEmail.set(person.email.trim().toLowerCase(), person.id)
      }
    }

    const navigatorByEnrollment = new Map<string, string>()
    for (const row of navigatorResult.data || []) {
      const candidate = row as { enrollment_id: string; navigator_person_id: string }
      if (!navigatorByEnrollment.has(candidate.enrollment_id)) {
        navigatorByEnrollment.set(candidate.enrollment_id, candidate.navigator_person_id)
      }
    }

    const enrollmentAssignments: AccessMatrixEnrollmentRecord[] = (enrollmentResult.data || []).map((row: any) => ({
      enrollmentId: row.enrollment_id,
      enrolleeId: row.enrollee_id,
      enrolleeName: row.full_name || 'unnamed enrollee',
      caseId: row.case_id || '',
      navigatorPersonId: navigatorByEnrollment.get(row.enrollment_id) || null
    }))

    const supervisorByNavigator = new Map<string, string>()
    for (const row of supervisorResult.data || []) {
      const candidate = row as { navigator_person_id: string; supervisor_person_id: string }
      if (!supervisorByNavigator.has(candidate.navigator_person_id)) {
        supervisorByNavigator.set(candidate.navigator_person_id, candidate.supervisor_person_id)
      }
    }

    const supervisorAssignments: AccessMatrixSupervisorRecord[] = people
      .filter((person) => person.roleKeys.includes('navigator'))
      .map((person) => ({
        navigatorPersonId: person.id,
        supervisorPersonId: supervisorByNavigator.get(person.id) || null
      }))

    const partnerAssignments: AccessMatrixPartnerRecord[] = (partnerResult.data || []).map((row: any) => ({
      partnerId: row.id,
      organizationName: row.organization_name || 'unnamed partner',
      primaryContactEmail: row.primary_contact_email || null,
      primaryContactPersonId: row.primary_contact_email
        ? personIdByEmail.get(String(row.primary_contact_email).toLowerCase()) || null
        : null
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
  const { data: roleRows, error: roleError } = await (supabase as any)
    .schema('atlas')
    .from('roles')
    .select('id, role_key')
    .in('role_key', nextRoleKeys)
  if (roleError) throw roleError

  const roleIdByKey = new Map<string, string>((roleRows || []).map((row: { id: string; role_key: string }) => [row.role_key, row.id]))
  const nextRoleIds = new Set<string>(Array.from(roleIdByKey.values()))

  const { data: currentRows, error: currentError } = await (supabase as any)
    .schema('atlas')
    .from('people_role_assignments')
    .select('id, role_id')
    .eq('person_id', personId)
    .is('ends_on', null)
  if (currentError) throw currentError

  const current = currentRows || []
  const nowDate = new Date().toISOString().slice(0, 10)
  const toDeactivate = current.filter((row: { role_id: string }) => !nextRoleIds.has(row.role_id)).map((row: { id: string }) => row.id)
  if (toDeactivate.length) {
    const { error } = await (supabase as any)
      .schema('atlas')
      .from('people_role_assignments')
      .update({ ends_on: nowDate, is_primary: false })
      .in('id', toDeactivate)
    if (error) throw error
  }

  const currentRoleIds = new Set<string>(current.map((row: { role_id: string }) => row.role_id))
  const inserts = Array.from(nextRoleIds)
    .filter((roleId) => !currentRoleIds.has(roleId))
    .map((roleId) => ({
      id: crypto.randomUUID(),
      person_id: personId,
      role_id: roleId,
      is_primary: false,
      starts_on: nowDate,
      ends_on: null
    }))

  if (inserts.length) {
    const { error } = await (supabase as any)
      .schema('atlas')
      .from('people_role_assignments')
      .insert(inserts)
    if (error) throw error
  }

  const primaryRoleKey = nextRoleKeys.includes('administrator') ? 'administrator' : nextRoleKeys[0] || null
  const primaryRoleId = primaryRoleKey ? roleIdByKey.get(primaryRoleKey) || null : null
  const { error: clearPrimaryError } = await (supabase as any)
    .schema('atlas')
    .from('people_role_assignments')
    .update({ is_primary: false })
    .eq('person_id', personId)
    .is('ends_on', null)
  if (clearPrimaryError) throw clearPrimaryError

  if (primaryRoleId) {
    const { error: setPrimaryError } = await (supabase as any)
      .schema('atlas')
      .from('people_role_assignments')
      .update({ is_primary: true })
      .eq('person_id', personId)
      .eq('role_id', primaryRoleId)
      .is('ends_on', null)
    if (setPrimaryError) throw setPrimaryError
  }
}

export async function saveAccessMatrixEnrollmentNavigator(enrollmentId: string, navigatorPersonId: string | null) {
  if (!hasSupabaseConfig || !supabase) return
  const nowDate = new Date().toISOString().slice(0, 10)
  if (!navigatorPersonId) {
    const { error } = await (supabase as any)
      .schema('atlas')
      .from('navigator_assignments')
      .update({ ends_on: nowDate })
      .eq('enrollment_id', enrollmentId)
      .is('ends_on', null)
    if (error) throw error
    return
  }

  const { error: clearError } = await (supabase as any)
    .schema('atlas')
    .from('navigator_assignments')
    .update({ ends_on: nowDate })
    .eq('enrollment_id', enrollmentId)
    .is('ends_on', null)
    .neq('navigator_person_id', navigatorPersonId)
  if (clearError) throw clearError

  const { data: existing, error: existingError } = await (supabase as any)
    .schema('atlas')
    .from('navigator_assignments')
    .select('id')
    .eq('enrollment_id', enrollmentId)
    .eq('navigator_person_id', navigatorPersonId)
    .is('ends_on', null)
    .limit(1)
  if (existingError) throw existingError
  if (existing?.length) return

  const { error: insertError } = await (supabase as any)
    .schema('atlas')
    .from('navigator_assignments')
    .insert({
      id: crypto.randomUUID(),
      enrollment_id: enrollmentId,
      navigator_person_id: navigatorPersonId,
      starts_on: nowDate,
      ends_on: null,
      station_id: null
    })
  if (insertError) throw insertError
}

export async function saveAccessMatrixSupervisorAssignment(navigatorPersonId: string, supervisorPersonId: string | null) {
  if (!hasSupabaseConfig || !supabase) return
  const nowDate = new Date().toISOString().slice(0, 10)
  if (!supervisorPersonId) {
    const { error } = await (supabase as any)
      .schema('atlas')
      .from('supervisor_navigator_assignments')
      .update({ ends_on: nowDate })
      .eq('navigator_person_id', navigatorPersonId)
      .is('ends_on', null)
    if (error) throw error
    return
  }

  const { error: clearError } = await (supabase as any)
    .schema('atlas')
    .from('supervisor_navigator_assignments')
    .update({ ends_on: nowDate })
    .eq('navigator_person_id', navigatorPersonId)
    .is('ends_on', null)
    .neq('supervisor_person_id', supervisorPersonId)
  if (clearError) throw clearError

  const { data: existing, error: existingError } = await (supabase as any)
    .schema('atlas')
    .from('supervisor_navigator_assignments')
    .select('id')
    .eq('navigator_person_id', navigatorPersonId)
    .eq('supervisor_person_id', supervisorPersonId)
    .is('ends_on', null)
    .limit(1)
  if (existingError) throw existingError
  if (existing?.length) return

  const { error: insertError } = await (supabase as any)
    .schema('atlas')
    .from('supervisor_navigator_assignments')
    .insert({
      id: crypto.randomUUID(),
      navigator_person_id: navigatorPersonId,
      supervisor_person_id: supervisorPersonId,
      starts_on: nowDate,
      ends_on: null
    })
  if (insertError) throw insertError
}

export async function saveAccessMatrixPartnerPrimaryContact(partnerId: string, primaryContactPersonId: string | null) {
  if (!hasSupabaseConfig || !supabase) return
  if (!primaryContactPersonId) {
    const { error } = await (supabase as any)
      .schema('atlas')
      .from('partners')
      .update({
        primary_contact_first_name: null,
        primary_contact_last_name: null,
        primary_contact_email: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', partnerId)
    if (error) throw error
    return
  }

  const { data: personRows, error: personError } = await (supabase as any)
    .schema('atlas')
    .from('people')
    .select('first_name, last_name, email')
    .eq('id', primaryContactPersonId)
    .limit(1)
  if (personError) throw personError

  const person = personRows?.[0]
  if (!person) return
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('partners')
    .update({
      primary_contact_first_name: person.first_name || null,
      primary_contact_last_name: person.last_name || null,
      primary_contact_email: person.email || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', partnerId)
  if (error) throw error
}
