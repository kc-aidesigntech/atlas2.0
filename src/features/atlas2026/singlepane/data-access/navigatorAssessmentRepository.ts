import type { NavigatorCompetencyAssessmentRecord } from '@/features/atlas2026/singlepane/types'

const NAVIGATOR_ASSESSMENTS_KEY = 'atlas2026.singlepane.navigator-assessments.v1'

function loadNavigatorAssessmentState(): NavigatorCompetencyAssessmentRecord[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(NAVIGATOR_ASSESSMENTS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as NavigatorCompetencyAssessmentRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistNavigatorAssessmentState(records: NavigatorCompetencyAssessmentRecord[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(NAVIGATOR_ASSESSMENTS_KEY, JSON.stringify(records))
}

export async function loadNavigatorCompetencyAssessments(): Promise<NavigatorCompetencyAssessmentRecord[]> {
  return loadNavigatorAssessmentState()
}

export async function saveNavigatorCompetencyAssessment(
  input: Omit<NavigatorCompetencyAssessmentRecord, 'id' | 'submittedAtIso'>
): Promise<NavigatorCompetencyAssessmentRecord> {
  const record: NavigatorCompetencyAssessmentRecord = {
    id: `navigator-assessment-${Date.now().toString(36)}`,
    submittedAtIso: new Date().toISOString(),
    ...input
  }
  const nextState = [record, ...loadNavigatorAssessmentState()]
  persistNavigatorAssessmentState(nextState)
  return record
}
