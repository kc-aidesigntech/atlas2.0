import type { NavigatorCompetencyAssessmentRecord } from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

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

async function ensurePersonId(displayName: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const trimmed = displayName.trim()
  const { data: existing, error: existingError } = await supabase
    .schema('atlas')
    .from('people')
    .select('id')
    .eq('display_name', trimmed)
    .limit(1)

  if (existingError) throw existingError
  if (existing?.[0]?.id) return existing[0].id

  const { firstName, lastName } = splitDisplayName(trimmed)
  const { data, error } = await supabase
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

  if (error) throw error
  return data.id
}

export async function loadNavigatorCompetencyAssessments(): Promise<NavigatorCompetencyAssessmentRecord[]> {
  if (!hasSupabaseConfig || !supabase) return []

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
    .from('people')
    .select('id,display_name')
    .in('id', personIds)
  if (peopleError) throw peopleError

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
}

export async function saveNavigatorCompetencyAssessment(
  input: Omit<NavigatorCompetencyAssessmentRecord, 'id' | 'submittedAtIso'>
): Promise<NavigatorCompetencyAssessmentRecord> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to save navigator competency assessments.')
  }

  const [supervisorPersonId, navigatorPersonId] = await Promise.all([
    ensurePersonId(input.supervisorName),
    ensurePersonId(input.navigatorName)
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
