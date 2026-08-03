import type { EnrolleeIntakeRecord, EnrolleeProfile, RouteAssignmentRecord } from '@/features/atlas2026/shared/contracts'
import {
  loadConfigPayloadMapByPrefix,
  loadLatestConfigPayload,
  loadLocalStorageState,
  persistLocalStorageState,
  upsertConfigPayload
} from '@/features/atlas2026/singlepane/data-access/configDocumentPersistence'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const ENROLLEE_INTAKE_CONFIG_KEY_PREFIX = 'enrollee_intake:'
const ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX = 'route_assignment:'
const LOCAL_ENROLLEE_INTAKES_KEY = 'atlas2026.singlepane.enrollee-intakes.v2'
const LOCAL_ROUTE_ASSIGNMENTS_KEY = 'atlas2026.singlepane.route-assignments.v2'
const ALLOW_SENSITIVE_LOCAL_CACHE = import.meta.env.VITE_ALLOW_SENSITIVE_LOCAL_CACHE === 'true'

function loadSensitiveRecordMap<T>(storageKey: string): Record<string, T> {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return {}
  return loadLocalStorageState(storageKey, {}, (parsed) => parsed && typeof parsed === 'object' ? parsed as Record<string, T> : {})
}

function persistSensitiveRecordMap<T>(storageKey: string, state: Record<string, T>) {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return
  // Sensitive records remain local only when the deployment explicitly enables this cache.
  persistLocalStorageState(storageKey, state)
}

export function applyIntakeOverrides(enrollees: EnrolleeProfile[], intakeOverrides: Record<string, EnrolleeIntakeRecord>) {
  return enrollees.map((enrollee) => {
    const intake = intakeOverrides[enrollee.id]
    if (!intake) return enrollee
    return {
      ...enrollee,
      fullName: intake.fullName,
      dob: intake.dob,
      caseId: intake.caseId,
      email: intake.email,
      assignedNavigator: intake.assignedNavigator,
      zCodeTags: intake.zCodeTags
    }
  })
}

export async function loadEnrolleeIntakes(): Promise<Record<string, EnrolleeIntakeRecord>> {
  const { rows, error } = await loadConfigPayloadMapByPrefix<EnrolleeIntakeRecord>(ENROLLEE_INTAKE_CONFIG_KEY_PREFIX)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadSensitiveRecordMap(LOCAL_ENROLLEE_INTAKES_KEY)
    throw error
  }
  const normalized = Object.fromEntries((rows || []).map((row) => {
    const key = row.config_key?.replace(ENROLLEE_INTAKE_CONFIG_KEY_PREFIX, '')
    const payload = row.payload as EnrolleeIntakeRecord | null
    return key && payload ? [key, payload] : null
  }).filter((entry): entry is [string, EnrolleeIntakeRecord] => Boolean(entry)))
  persistSensitiveRecordMap(LOCAL_ENROLLEE_INTAKES_KEY, normalized)
  return normalized
}

export async function saveEnrolleeIntake(intake: EnrolleeIntakeRecord): Promise<EnrolleeIntakeRecord> {
  persistSensitiveRecordMap(LOCAL_ENROLLEE_INTAKES_KEY, {
    ...loadSensitiveRecordMap<EnrolleeIntakeRecord>(LOCAL_ENROLLEE_INTAKES_KEY),
    [intake.enrolleeId]: intake
  })
  const error = await upsertConfigPayload(`${ENROLLEE_INTAKE_CONFIG_KEY_PREFIX}${intake.enrolleeId}`, intake)
  if (error && !isOptionalSupabaseDataError(error)) throw error
  return intake
}

export async function loadRouteAssignments(): Promise<Record<string, RouteAssignmentRecord>> {
  const { rows, error } = await loadConfigPayloadMapByPrefix<RouteAssignmentRecord>(ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadSensitiveRecordMap(LOCAL_ROUTE_ASSIGNMENTS_KEY)
    throw error
  }
  const normalized = Object.fromEntries((rows || []).map((row) => {
    const key = row.config_key?.replace(ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX, '')
    const payload = row.payload as RouteAssignmentRecord | null
    return key && payload ? [key, payload] : null
  }).filter((entry): entry is [string, RouteAssignmentRecord] => Boolean(entry)))
  persistSensitiveRecordMap(LOCAL_ROUTE_ASSIGNMENTS_KEY, normalized)
  return normalized
}

export async function saveRouteAssignment(assignment: RouteAssignmentRecord): Promise<RouteAssignmentRecord> {
  const configKey = `${ROUTE_ASSIGNMENT_CONFIG_KEY_PREFIX}${assignment.enrolleeId}`
  persistSensitiveRecordMap(LOCAL_ROUTE_ASSIGNMENTS_KEY, {
    ...loadSensitiveRecordMap<RouteAssignmentRecord>(LOCAL_ROUTE_ASSIGNMENTS_KEY),
    [assignment.enrolleeId]: assignment
  })
  const error = await upsertConfigPayload(configKey, assignment)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return assignment
    throw error
  }
  // Read-after-write verification keeps route assignment deterministic across tabs.
  const { payload, error: verifyError } = await loadLatestConfigPayload<RouteAssignmentRecord>(configKey)
  if (verifyError) {
    if (!isOptionalSupabaseDataError(verifyError)) throw verifyError
    return assignment
  }
  if (!payload || payload.stationId !== assignment.stationId) {
    throw new Error(`Route assignment verification failed for enrollee ${assignment.enrolleeId}.`)
  }
  return assignment
}
