import type { NavigatorProgramState } from '@/features/atlas2026/shared/contracts'
import {
  loadLatestConfigPayload,
  loadLocalStorageState,
  persistLocalStorageState,
  upsertConfigPayload
} from '@/features/atlas2026/singlepane/data-access/configDocumentPersistence'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const NAVIGATOR_PROGRAM_STATE_CONFIG_KEY = 'navigator_program_state'
const LOCAL_NAVIGATOR_PROGRAM_STATE_KEY = 'atlas2026.singlepane.navigator-program-state.v1'
const ALLOW_SENSITIVE_LOCAL_CACHE = import.meta.env.VITE_ALLOW_SENSITIVE_LOCAL_CACHE === 'true'

function getDefaultNavigatorProgramState(): NavigatorProgramState {
  return {
    pickupQueue: [],
    selfAssessments: [],
    ipsSelfAssessments: [],
    supervisorIpsAssessments: [],
    ipsccEncounterSubmissions: [],
    createSessions: [],
    supervisionSessions: [],
    intervalAssessmentRules: [],
    updatedAtIso: new Date().toISOString()
  }
}

function normalizeNavigatorProgramState(payload: Partial<NavigatorProgramState> | null | undefined): NavigatorProgramState {
  return {
    pickupQueue: Array.isArray(payload?.pickupQueue) ? payload.pickupQueue.filter(Boolean) : [],
    selfAssessments: Array.isArray(payload?.selfAssessments) ? payload.selfAssessments.filter(Boolean) : [],
    ipsSelfAssessments: Array.isArray(payload?.ipsSelfAssessments) ? payload.ipsSelfAssessments.filter(Boolean) : [],
    supervisorIpsAssessments: Array.isArray(payload?.supervisorIpsAssessments) ? payload.supervisorIpsAssessments.filter(Boolean) : [],
    ipsccEncounterSubmissions: Array.isArray(payload?.ipsccEncounterSubmissions) ? payload.ipsccEncounterSubmissions.filter(Boolean) : [],
    createSessions: Array.isArray(payload?.createSessions) ? payload.createSessions.filter(Boolean) : [],
    supervisionSessions: Array.isArray(payload?.supervisionSessions) ? payload.supervisionSessions.filter(Boolean) : [],
    intervalAssessmentRules: Array.isArray(payload?.intervalAssessmentRules) ? payload.intervalAssessmentRules.filter(Boolean) : [],
    updatedAtIso: payload?.updatedAtIso || new Date().toISOString()
  }
}

function loadLocalNavigatorProgramState(): NavigatorProgramState {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return getDefaultNavigatorProgramState()
  return loadLocalStorageState(
    LOCAL_NAVIGATOR_PROGRAM_STATE_KEY,
    getDefaultNavigatorProgramState(),
    (parsed) => normalizeNavigatorProgramState(parsed as Partial<NavigatorProgramState>)
  )
}

export async function loadNavigatorProgramState(): Promise<NavigatorProgramState> {
  const { payload, error } = await loadLatestConfigPayload<Partial<NavigatorProgramState>>(NAVIGATOR_PROGRAM_STATE_CONFIG_KEY)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalNavigatorProgramState()
    throw error
  }
  const normalized = normalizeNavigatorProgramState(payload)
  if (ALLOW_SENSITIVE_LOCAL_CACHE) persistLocalStorageState(LOCAL_NAVIGATOR_PROGRAM_STATE_KEY, normalized)
  return normalized
}

export async function saveNavigatorProgramState(state: NavigatorProgramState): Promise<NavigatorProgramState> {
  const normalized = normalizeNavigatorProgramState({ ...state, updatedAtIso: new Date().toISOString() })
  if (ALLOW_SENSITIVE_LOCAL_CACHE) persistLocalStorageState(LOCAL_NAVIGATOR_PROGRAM_STATE_KEY, normalized)
  const error = await upsertConfigPayload(NAVIGATOR_PROGRAM_STATE_CONFIG_KEY, normalized)
  if (error && !isOptionalSupabaseDataError(error)) throw error
  return normalized
}
