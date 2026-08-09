/**
 * Supabase persistence for Atlas Scribe encounters.
 * Rows live in atlas.scribe_encounters behind owner-only Row-Level Security
 * (RLS), so all queries here implicitly scope to the signed-in user. Audio is
 * never stored; only transcript text and note sections reach this table.
 */
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import type { SoapNoteSections } from '@/services/atlas2026/generateSoapNoteService'

export type ScribeEncounterStatus = 'draft' | 'final'

export interface ScribeEncounterRecord {
  id: string
  encounterLabel: string
  transcriptText: string
  noteFramework: string
  noteSections: SoapNoteSections
  status: ScribeEncounterStatus
  model: string
  createdAtIso: string
  updatedAtIso: string
}

export interface ScribeEncounterDraftInput {
  /** Empty string for a brand-new encounter; UUID for updates. */
  id?: string
  encounterLabel: string
  transcriptText: string
  noteSections: SoapNoteSections
  status: ScribeEncounterStatus
  model: string
}

const EMPTY_SECTIONS: SoapNoteSections = { subjective: '', objective: '', assessment: '', plan: '' }

function readSections(raw: unknown): SoapNoteSections {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_SECTIONS }
  const source = raw as Record<string, unknown>
  return {
    subjective: typeof source.subjective === 'string' ? source.subjective : '',
    objective: typeof source.objective === 'string' ? source.objective : '',
    assessment: typeof source.assessment === 'string' ? source.assessment : '',
    plan: typeof source.plan === 'string' ? source.plan : ''
  }
}

function mapRow(row: Record<string, unknown>): ScribeEncounterRecord {
  return {
    id: String(row.id),
    encounterLabel: String(row.encounter_label || ''),
    transcriptText: String(row.transcript_text || ''),
    noteFramework: String(row.note_framework || 'soap'),
    noteSections: readSections(row.note_sections),
    status: row.status === 'final' ? 'final' : 'draft',
    model: String(row.model || ''),
    createdAtIso: String(row.created_at || ''),
    updatedAtIso: String(row.updated_at || '')
  }
}

/** Newest-first list of the signed-in user's encounters (RLS enforces ownership). */
export async function loadScribeEncounters(): Promise<ScribeEncounterRecord[]> {
  if (!hasSupabaseConfig || !supabase) return []
  const { data, error } = await supabase
    .schema('atlas')
    .from('scribe_encounters')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map((row) => mapRow(row as Record<string, unknown>))
}

/**
 * Insert or update an encounter. Save failures throw so the UI can surface
 * them; losing a captured encounter silently is unacceptable here.
 */
export async function saveScribeEncounter(input: ScribeEncounterDraftInput): Promise<ScribeEncounterRecord> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is not configured; encounter cannot be saved.')
  }
  const payload = {
    encounter_label: input.encounterLabel.trim(),
    transcript_text: input.transcriptText,
    note_framework: 'soap',
    note_sections: input.noteSections,
    status: input.status,
    model: input.model,
    updated_at: new Date().toISOString()
  }
  // Update existing rows in place; let Postgres allocate ids for new rows so
  // created_by defaults to auth.uid() under the insert policy.
  const writer = input.id
    ? supabase.schema('atlas').from('scribe_encounters').update(payload).eq('id', input.id)
    : supabase.schema('atlas').from('scribe_encounters').insert(payload)
  const { data, error } = await writer.select('*').single()
  if (error) throw error
  return mapRow(data as Record<string, unknown>)
}

export async function deleteScribeEncounter(id: string): Promise<void> {
  if (!hasSupabaseConfig || !supabase) return
  const { error } = await supabase.schema('atlas').from('scribe_encounters').delete().eq('id', id)
  if (error) throw error
}
