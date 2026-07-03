import type {
  CreateSessionRecord,
  IpsCompetencySelfAssessmentRecord,
  IpsccCompetencyKey,
  IpsccEncounterSubmissionRecord,
  SupervisorIpsAssessmentRecord
} from '@/features/atlas2026/shared/contracts'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

function normalizeItemScores(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.max(1, Math.min(5, Math.round(item))))
}

function normalizeCompetencyScores(
  value: unknown
): Partial<Record<IpsccCompetencyKey, number>> {
  if (!value || typeof value !== 'object') return {}
  const typed = value as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(typed)
      .filter(([, score]) => Number.isFinite(Number(score)))
      .map(([key, score]) => [key, Math.max(1, Math.min(5, Math.round(Number(score))))])
  ) as Partial<Record<IpsccCompetencyKey, number>>
}

export async function loadNavigatorIpsccEncounterSubmissions(
  navigatorName: string
): Promise<IpsccEncounterSubmissionRecord[]> {
  if (!hasSupabaseConfig || !supabase) return []
  const normalizedNavigatorName = navigatorName.trim().toLowerCase()
  return withOptionalSupabaseFallback('singlepane.navigatorIpsccEncounterSubmissions', async () => {
    const { data, error } = await supabase
      .schema('atlas')
      .from('navigator_ipscc_encounter_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return (data || [])
      .map((row) => ({
        id: String(row.id),
        navigatorName: String(row.navigator_name || '').trim(),
        enrolleeId: String(row.enrollee_id || '').trim(),
        enrolleeName: String(row.enrollee_name || '').trim(),
        enrollmentId: row.enrollment_id ? String(row.enrollment_id) : null,
        submittedAtIso: String(row.submitted_at || row.created_at || new Date().toISOString()),
        submittedBy: String(row.submitted_by || 'service user'),
        itemScores: normalizeItemScores(row.item_scores),
        note: String(row.note || '')
      }))
      .filter((row) => !normalizedNavigatorName || row.navigatorName.trim().toLowerCase() === normalizedNavigatorName)
  }, [])
}

export async function saveNavigatorIpsccEncounterSubmission(
  record: IpsccEncounterSubmissionRecord
): Promise<IpsccEncounterSubmissionRecord> {
  if (!hasSupabaseConfig || !supabase) {
    return {
      ...record,
      itemScores: normalizeItemScores(record.itemScores)
    }
  }
  const payload = {
    id: record.id,
    navigator_name: record.navigatorName,
    enrollee_id: record.enrolleeId,
    enrollee_name: record.enrolleeName,
    enrollment_id: record.enrollmentId,
    submitted_at: record.submittedAtIso,
    submitted_by: record.submittedBy,
    item_scores: normalizeItemScores(record.itemScores),
    note: record.note
  }
  const { data, error } = await supabase
    .schema('atlas')
    .from('navigator_ipscc_encounter_submissions')
    .upsert(payload)
    .select('*')
    .single()
  if (error) throw error
  return {
    id: String(data.id),
    navigatorName: String(data.navigator_name || '').trim(),
    enrolleeId: String(data.enrollee_id || '').trim(),
    enrolleeName: String(data.enrollee_name || '').trim(),
    enrollmentId: data.enrollment_id ? String(data.enrollment_id) : null,
    submittedAtIso: String(data.submitted_at || data.created_at || new Date().toISOString()),
    submittedBy: String(data.submitted_by || 'service user'),
    itemScores: normalizeItemScores(data.item_scores),
    note: String(data.note || '')
  }
}

export async function loadNavigatorIpsSelfAssessments(
  navigatorName: string
): Promise<IpsCompetencySelfAssessmentRecord[]> {
  if (!hasSupabaseConfig || !supabase) return []
  const normalizedNavigatorName = navigatorName.trim().toLowerCase()
  return withOptionalSupabaseFallback('singlepane.navigatorIpsSelfAssessments', async () => {
    const { data, error } = await supabase
      .schema('atlas')
      .from('navigator_ips_self_assessments')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return (data || [])
      .map((row) => ({
        id: String(row.id),
        navigatorName: String(row.navigator_name || '').trim(),
        weekStartIso: String(row.week_start_iso || row.submitted_at || new Date().toISOString()),
        submittedAtIso: String(row.submitted_at || row.created_at || new Date().toISOString()),
        competencyScores: normalizeCompetencyScores(row.competency_scores),
        note: String(row.note || '')
      }))
      .filter((row) => !normalizedNavigatorName || row.navigatorName.trim().toLowerCase() === normalizedNavigatorName)
  }, [])
}

export async function loadSupervisorIpsAssessments(): Promise<SupervisorIpsAssessmentRecord[]> {
  if (!hasSupabaseConfig || !supabase) return []
  return withOptionalSupabaseFallback('singlepane.supervisorIpsAssessments', async () => {
    const { data, error } = await supabase
      .schema('atlas')
      .from('supervisor_ips_assessments')
      .select('*')
      .order('submitted_at', { ascending: false })
    if (error) throw error
    return (data || []).map((row) => ({
      id: String(row.id),
      supervisorName: String(row.supervisor_name || '').trim(),
      navigatorName: String(row.navigator_name || '').trim(),
      weekStartIso: String(row.week_start_iso || row.submitted_at || new Date().toISOString()),
      submittedAtIso: String(row.submitted_at || row.created_at || new Date().toISOString()),
      competencyScores: normalizeCompetencyScores(row.competency_scores),
      note: String(row.note || '')
    }))
  }, [])
}

export async function saveNavigatorIpsSelfAssessment(
  record: IpsCompetencySelfAssessmentRecord
): Promise<IpsCompetencySelfAssessmentRecord> {
  if (!hasSupabaseConfig || !supabase) {
    return {
      ...record,
      competencyScores: normalizeCompetencyScores(record.competencyScores)
    }
  }
  const payload = {
    id: record.id,
    navigator_name: record.navigatorName,
    week_start_iso: record.weekStartIso,
    submitted_at: record.submittedAtIso,
    competency_scores: normalizeCompetencyScores(record.competencyScores),
    note: record.note
  }
  const { data, error } = await supabase
    .schema('atlas')
    .from('navigator_ips_self_assessments')
    .upsert(payload)
    .select('*')
    .single()
  if (error) throw error
  return {
    id: String(data.id),
    navigatorName: String(data.navigator_name || '').trim(),
    weekStartIso: String(data.week_start_iso || data.submitted_at || new Date().toISOString()),
    submittedAtIso: String(data.submitted_at || data.created_at || new Date().toISOString()),
    competencyScores: normalizeCompetencyScores(data.competency_scores),
    note: String(data.note || '')
  }
}

export async function saveSupervisorIpsAssessment(
  record: SupervisorIpsAssessmentRecord
): Promise<SupervisorIpsAssessmentRecord> {
  if (!hasSupabaseConfig || !supabase) {
    return {
      ...record,
      competencyScores: normalizeCompetencyScores(record.competencyScores)
    }
  }
  const payload = {
    id: record.id,
    supervisor_name: record.supervisorName,
    navigator_name: record.navigatorName,
    week_start_iso: record.weekStartIso,
    submitted_at: record.submittedAtIso,
    competency_scores: normalizeCompetencyScores(record.competencyScores),
    note: record.note
  }
  const { data, error } = await supabase
    .schema('atlas')
    .from('supervisor_ips_assessments')
    .upsert(payload)
    .select('*')
    .single()
  if (error) throw error
  return {
    id: String(data.id),
    supervisorName: String(data.supervisor_name || '').trim(),
    navigatorName: String(data.navigator_name || '').trim(),
    weekStartIso: String(data.week_start_iso || data.submitted_at || new Date().toISOString()),
    submittedAtIso: String(data.submitted_at || data.created_at || new Date().toISOString()),
    competencyScores: normalizeCompetencyScores(data.competency_scores),
    note: String(data.note || '')
  }
}

export async function loadNavigatorCreateSessions(
  navigatorName: string
): Promise<CreateSessionRecord[]> {
  if (!hasSupabaseConfig || !supabase) return []
  const normalizedNavigatorName = navigatorName.trim().toLowerCase()
  return withOptionalSupabaseFallback('singlepane.navigatorCreateSessions', async () => {
    const { data, error } = await supabase
      .schema('atlas')
      .from('navigator_create_sessions')
      .select('*')
      .order('session_at', { ascending: false })
    if (error) throw error
    return (data || [])
      .map((row) => ({
        id: String(row.id),
        navigatorName: String(row.navigator_name || '').trim(),
        supervisorName: String(row.supervisor_name || '').trim(),
        sessionAtIso: String(row.session_at || row.submitted_at || new Date().toISOString()),
        submittedAtIso: String(row.submitted_at || row.created_at || new Date().toISOString()),
        supervisionMode:
          row.supervision_mode === 'online' || row.supervision_mode === 'phone_call' ? row.supervision_mode : 'in_person',
        sessionDurationMinutes: typeof row.session_duration_minutes === 'number' ? row.session_duration_minutes : null,
        connectFocusedListening: Boolean(row.connect_focused_listening),
        recognizeNotes: String(row.recognize_notes || ''),
        encourageNotes: String(row.encourage_notes || ''),
        acknowledgeNotes: String(row.acknowledge_notes || ''),
        trainNotes: String(row.train_notes || ''),
        empowerNotes: String(row.empower_notes || ''),
        createActionPlan: String(row.create_action_plan || ''),
        supervisorSubmission: String(row.supervisor_submission || ''),
        superviseeSubmission: String(row.supervisee_submission || ''),
        peerSpecialistSignature: String(row.peer_specialist_signature || ''),
        peerSpecialistSignedAtIso: row.peer_specialist_signed_at ? String(row.peer_specialist_signed_at) : null,
        supervisorSignature: String(row.supervisor_signature || ''),
        supervisorSignedAtIso: row.supervisor_signed_at ? String(row.supervisor_signed_at) : null
      }))
      .filter((row) => !normalizedNavigatorName || row.navigatorName.trim().toLowerCase() === normalizedNavigatorName)
  }, [])
}

export async function saveNavigatorCreateSession(record: CreateSessionRecord): Promise<CreateSessionRecord> {
  if (!hasSupabaseConfig || !supabase) {
    return record
  }
  const payload = {
    id: record.id,
    navigator_name: record.navigatorName,
    supervisor_name: record.supervisorName,
    session_at: record.sessionAtIso,
    submitted_at: record.submittedAtIso,
    supervision_mode: record.supervisionMode,
    session_duration_minutes: record.sessionDurationMinutes,
    connect_focused_listening: record.connectFocusedListening,
    recognize_notes: record.recognizeNotes,
    encourage_notes: record.encourageNotes,
    acknowledge_notes: record.acknowledgeNotes,
    train_notes: record.trainNotes,
    empower_notes: record.empowerNotes,
    create_action_plan: record.createActionPlan,
    supervisor_submission: record.supervisorSubmission,
    supervisee_submission: record.superviseeSubmission,
    peer_specialist_signature: record.peerSpecialistSignature,
    peer_specialist_signed_at: record.peerSpecialistSignedAtIso,
    supervisor_signature: record.supervisorSignature,
    supervisor_signed_at: record.supervisorSignedAtIso
  }
  const { data, error } = await supabase
    .schema('atlas')
    .from('navigator_create_sessions')
    .upsert(payload)
    .select('*')
    .single()
  if (error) throw error
  return {
    id: String(data.id),
    navigatorName: String(data.navigator_name || '').trim(),
    supervisorName: String(data.supervisor_name || '').trim(),
    sessionAtIso: String(data.session_at || data.submitted_at || new Date().toISOString()),
    submittedAtIso: String(data.submitted_at || data.created_at || new Date().toISOString()),
    supervisionMode:
      data.supervision_mode === 'online' || data.supervision_mode === 'phone_call' ? data.supervision_mode : 'in_person',
    sessionDurationMinutes: typeof data.session_duration_minutes === 'number' ? data.session_duration_minutes : null,
    connectFocusedListening: Boolean(data.connect_focused_listening),
    recognizeNotes: String(data.recognize_notes || ''),
    encourageNotes: String(data.encourage_notes || ''),
    acknowledgeNotes: String(data.acknowledge_notes || ''),
    trainNotes: String(data.train_notes || ''),
    empowerNotes: String(data.empower_notes || ''),
    createActionPlan: String(data.create_action_plan || ''),
    supervisorSubmission: String(data.supervisor_submission || ''),
    superviseeSubmission: String(data.supervisee_submission || ''),
    peerSpecialistSignature: String(data.peer_specialist_signature || ''),
    peerSpecialistSignedAtIso: data.peer_specialist_signed_at ? String(data.peer_specialist_signed_at) : null,
    supervisorSignature: String(data.supervisor_signature || ''),
    supervisorSignedAtIso: data.supervisor_signed_at ? String(data.supervisor_signed_at) : null
  }
}
