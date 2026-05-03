import type { NavigatorCompetencyAssessmentRecord } from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

/**
 * Navigator competency assessment repository.
 *
 * Purpose:
 * - resolves person/role identities required by assessment tables.
 * - maps normalized persistence rows to UI contract records.
 */

// People-role assignments are validated here to preserve the domain invariant
// that one staff identity cannot simultaneously represent conflicting roles.
function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return { firstName: parts[0] || displayName.trim() || 'atlas', lastName: 'operator' }
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  }
}

type StaffRoleKey = 'navigator' | 'supervisor'

async function ensurePersonId(displayName: string, roleKey: StaffRoleKey) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const trimmed = displayName.trim()
  if (!trimmed) throw new Error(`${roleKey} name is required.`)

  const { data: exactRoleRows, error: exactRoleError } = await supabase
    .schema('atlas')
    .from('people')
    .select('id,display_name,people_role_assignments!inner(ends_on,role_id,roles!inner(role_key))')
    .eq('display_name', trimmed)
    .eq('people_role_assignments.roles.role_key', roleKey)
    .is('people_role_assignments.ends_on', null)
    .limit(1)

  if (exactRoleError) throw exactRoleError
  if (exactRoleRows?.[0]?.id) return exactRoleRows[0].id

  const { data: roleConflicts, error: roleConflictError } = await supabase
    .schema('atlas')
    .from('people')
    .select('id,display_name,people_role_assignments!inner(ends_on,role_id,roles!inner(role_key))')
    .eq('display_name', trimmed)
    .neq('people_role_assignments.roles.role_key', roleKey)
    .is('people_role_assignments.ends_on', null)
    .limit(1)

  if (roleConflictError) throw roleConflictError
  if (roleConflicts?.[0]) {
    const conflictAssignments = Array.isArray(roleConflicts[0].people_role_assignments)
      ? roleConflicts[0].people_role_assignments
      : [roleConflicts[0].people_role_assignments]
    const conflictRole = conflictAssignments[0]?.roles?.role_key || 'another role'
    throw new Error(`${trimmed} is already assigned as ${conflictRole}. Each person can only hold one role.`)
  }

  const { data: existing, error: existingError } = await supabase
    .schema('atlas')
    .from('people')
    .select('id')
    .eq('display_name', trimmed)
    .limit(1)

  const { firstName, lastName } = splitDisplayName(trimmed)
  if (existingError) throw existingError
  let personId = existing?.[0]?.id || null
  if (!personId) {
    const { data: insertedPerson, error: insertError } = await supabase
      .schema('atlas')
      .from('people')
      .insert({
        first_name: firstName,
        last_name: lastName,
        display_name: trimmed,
        person_type: 'staff',
        status: 'active'
      })
      .select('id')
      .single()
    if (insertError) throw insertError
    personId = insertedPerson?.id || null
  }

  if (!personId) {
    throw new Error(`Unable to resolve person record for ${trimmed}.`)
  }

  const { data: roleRows, error: roleError } = await supabase
    .schema('atlas')
    .from('roles')
    .select('id')
    .eq('role_key', roleKey)
    .limit(1)
  if (roleError) throw roleError
  if (!roleRows?.[0]?.id) {
    throw new Error(`Role ${roleKey} is not configured in atlas.roles.`)
  }

  const { error: assignmentError } = await supabase
    .schema('atlas')
    .from('people_role_assignments')
    .upsert(
      {
        person_id: personId,
        role_id: roleRows[0].id,
        is_primary: true,
        starts_on: new Date().toISOString().slice(0, 10),
        ends_on: null
      },
      { onConflict: 'person_id' }
    )
  if (assignmentError) throw assignmentError
  return personId
}

export async function loadNavigatorCompetencyAssessments(): Promise<NavigatorCompetencyAssessmentRecord[]> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []

  return withOptionalSupabaseFallback('singlepane.navigatorCompetencyAssessments', async () => {
    const { data: assessments, error } = await supabase
      .schema('atlas')
      .from('navigator_competency_assessments')
      .select('*')
      .order('assessed_at', { ascending: false })

    if (error) throw error
    if (!assessments?.length) return []

    const personIds = Array.from(
      new Set(
        assessments.flatMap((assessment) => [assessment.supervisor_person_id, assessment.navigator_person_id]).filter(Boolean)
      )
    )
    const { data: people, error: peopleError } = await supabase
      .schema('atlas')
      .from('v_people_directory')
      .select('id,display_name')
      .in('id', personIds)
    if (peopleError) throw peopleError

    // Answers are loaded in a separate query and grouped client-side to keep
    // the returned record shape stable and avoid nested row coupling.
    const { data: answers, error: answersError } = await supabase
      .schema('atlas')
      .from('navigator_competency_assessment_answers')
      .select('*')
      .in('assessment_id', assessments.map((assessment) => assessment.id))
    if (answersError) throw answersError

    const peopleById = new Map((people || []).map((person) => [person.id, person.display_name]))
    const answersByAssessmentId = new Map<string, typeof answers>()
    ;(answers || []).forEach((answer) => {
      const existing = answersByAssessmentId.get(answer.assessment_id) || []
      existing.push(answer)
      answersByAssessmentId.set(answer.assessment_id, existing)
    })

    return assessments.map((assessment) => ({
      id: assessment.id,
      navigatorName: peopleById.get(assessment.navigator_person_id) || 'unknown navigator',
      supervisorName: peopleById.get(assessment.supervisor_person_id) || 'unknown supervisor',
      submittedAtIso: assessment.assessed_at,
      formVersion: assessment.form_version,
      answers: (answersByAssessmentId.get(assessment.id) || []).map((answer) => ({
        parentCode: answer.parent_code,
        theme: answer.title || answer.description || answer.parent_code,
        score: answer.competency_score
      }))
    }))
  }, [])
}

export async function saveNavigatorCompetencyAssessment(
  input: Omit<NavigatorCompetencyAssessmentRecord, 'id' | 'submittedAtIso'>
): Promise<NavigatorCompetencyAssessmentRecord> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to save navigator competency assessments.')
  }

  const [supervisorPersonId, navigatorPersonId] = await Promise.all([
    ensurePersonId(input.supervisorName, 'supervisor'),
    ensurePersonId(input.navigatorName, 'navigator')
  ])

  const submittedAtIso = new Date().toISOString()
  const { data: assessment, error } = await supabase
    .schema('atlas')
    .from('navigator_competency_assessments')
    .insert({
      supervisor_person_id: supervisorPersonId,
      navigator_person_id: navigatorPersonId,
      form_version: input.formVersion,
      assessed_at: submittedAtIso
    })
    .select('id')
    .single()

  if (error) throw error

  const { error: answersError } = await supabase
    .schema('atlas')
    .from('navigator_competency_assessment_answers')
    .insert(
      input.answers.map((answer) => ({
        assessment_id: assessment.id,
        parent_code: answer.parentCode,
        z_code: answer.parentCode,
        normalized_z_code: answer.parentCode,
        title: answer.theme,
        description: answer.theme,
        competency_score: answer.score
      }))
    )

  if (answersError) throw answersError

  return {
    id: assessment.id,
    submittedAtIso,
    ...input
  }
}
