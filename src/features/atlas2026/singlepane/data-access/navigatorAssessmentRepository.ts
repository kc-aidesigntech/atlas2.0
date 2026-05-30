import type { NavigatorCompetencyAssessmentRecord } from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

/**
 * Navigator competency assessment repository.
 *
 * Purpose:
 * - resolves person/role identities required by assessment tables.
 * - maps normalized persistence rows to User Interface (UI) contract records.
 */

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

  // The whole assessment is sent as one JSON packet to the validated SECURITY
  // DEFINER command RPC, which gates the caller (administrator/supervisor),
  // resolves the supervisor + navigator staff identities server-side, and writes
  // the assessment + answers atomically. Direct table writes (including the
  // people/role provisioning the client previously did) are revoked.
  const submittedAtIso = new Date().toISOString()
  const payload = {
    supervisorName: input.supervisorName,
    navigatorName: input.navigatorName,
    formVersion: input.formVersion,
    answers: input.answers.map((answer) => ({
      parentCode: answer.parentCode,
      theme: answer.theme,
      score: answer.score
    }))
  }

  const { data: assessmentId, error } = await supabase
    .schema('atlas')
    .rpc('fn_save_navigator_competency_assessment', { payload })

  if (error) throw error
  if (!assessmentId) throw new Error('Competency assessment save returned no id')

  return {
    id: assessmentId as string,
    submittedAtIso,
    ...input
  }
}
