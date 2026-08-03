/**
 * Client for Connect, Recognize, Encourage, Acknowledge, Train, and Empower
 * (C.R.E.A.T.E.) reflection generation via Heroku Model Context Protocol (MCP)
 * → RunPod Ollama `qwen2.5:3b-instruct`. Mirrors the Z-code demo inference path.
 */
import type { CreateSessionRecord } from '@/features/atlas2026/shared/contracts'

const DEFAULT_REFLECTION_ENDPOINT = 'http://localhost:4310/summarize-create-session'
const INFERENCE_BEARER = (import.meta.env.VITE_ATLAS_DEMO_INFERENCE_BEARER || '').trim()

/** Maximum sessions sent to MCP / used for local fallback (latest + prior nine). */
export const CREATE_REFLECTION_SESSION_LIMIT = 10

export interface CreateReflectionGenerateInput {
  navigatorName: string
  supervisorName: string
  /** Chronological (oldest → newest), length ≤ CREATE_REFLECTION_SESSION_LIMIT. */
  sessions: CreateSessionRecord[]
}

export interface CreateReflectionGenerateResult {
  reflectionText: string
  model: string
  usedFallback: boolean
}

function trimNote(value: string, max = 180): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function collectLatestThemes(session: CreateSessionRecord): string[] {
  const snippets = [
    trimNote(session.recognizeNotes),
    trimNote(session.encourageNotes),
    trimNote(session.acknowledgeNotes),
    trimNote(session.trainNotes),
    trimNote(session.empowerNotes),
    trimNote(session.createActionPlan),
    trimNote(session.supervisorSubmission),
    trimNote(session.superviseeSubmission)
  ].filter(Boolean)
  return snippets.slice(0, 4)
}

/**
 * Deterministic offline paragraph when MCP/Ollama is unavailable.
 * Stays within supplied notes and uses peer-support language (no clinical invention).
 */
export function buildOfflineCreateReflection(input: CreateReflectionGenerateInput): CreateReflectionGenerateResult {
  const sessions = input.sessions.slice(-CREATE_REFLECTION_SESSION_LIMIT)
  const latest = sessions[sessions.length - 1]
  const navigatorName = (input.navigatorName || latest?.navigatorName || 'Navigator').trim() || 'Navigator'
  const priorCount = Math.max(0, sessions.length - 1)
  const themes = latest ? collectLatestThemes(latest) : []
  const themeClause = themes.length
    ? `In this latest session, I noticed work around ${themes.join('; ')}.`
    : 'In this latest session, we captured useful supervision notes to carry forward.'
  const continuityClause =
    priorCount > 0
      ? ` Building on recent supervision themes across the prior ${priorCount} session${priorCount === 1 ? '' : 's'}, keep practicing what is already working and stay curious about the next small step with service users.`
      : ' As you continue, stay grounded in what is already working and stay curious about the next small step with service users.'
  const connectClause = latest?.connectFocusedListening
    ? ' Your focused listening remains a strong anchor for connection.'
    : ''
  // Keep 3–4 sentences without inventing clinical claims beyond the supplied notes.
  const reflectionText =
    `${navigatorName}, thank you for the care you brought to this C.R.E.A.T.E. supervision. ${themeClause}${connectClause}${continuityClause}`.replace(
      /\s+/g,
      ' '
    ).trim()

  return {
    reflectionText,
    model: 'fallback-local-notes',
    usedFallback: true
  }
}

function serializeSessionForMcp(session: CreateSessionRecord) {
  return {
    id: session.id,
    sessionAtIso: session.sessionAtIso,
    supervisionMode: session.supervisionMode,
    sessionDurationMinutes: session.sessionDurationMinutes,
    connectFocusedListening: session.connectFocusedListening,
    recognizeNotes: session.recognizeNotes,
    encourageNotes: session.encourageNotes,
    acknowledgeNotes: session.acknowledgeNotes,
    trainNotes: session.trainNotes,
    empowerNotes: session.empowerNotes,
    createActionPlan: session.createActionPlan,
    supervisorSubmission: session.supervisorSubmission,
    superviseeSubmission: session.superviseeSubmission
  }
}

/**
 * Prefer MCP reflection; on any network/contract failure, return the sensitive offline stitch.
 */
export async function generateCreateReflection(
  input: CreateReflectionGenerateInput
): Promise<CreateReflectionGenerateResult> {
  const sessions = input.sessions
    .slice()
    .sort((left, right) => new Date(left.sessionAtIso).getTime() - new Date(right.sessionAtIso).getTime())
    .slice(-CREATE_REFLECTION_SESSION_LIMIT)

  const payload = {
    navigatorName: input.navigatorName.trim(),
    supervisorName: input.supervisorName.trim(),
    sessions: sessions.map(serializeSessionForMcp)
  }

  const endpoint = (import.meta.env.VITE_ATLAS_CREATE_REFLECTION_URL || DEFAULT_REFLECTION_ENDPOINT).trim()
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (INFERENCE_BEARER) {
      headers.authorization = `Bearer ${INFERENCE_BEARER}`
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      throw new Error(`Create reflection request failed with status ${response.status}`)
    }
    const data = (await response.json()) as { reflectionText?: unknown; model?: unknown }
    const reflectionText = typeof data?.reflectionText === 'string' ? data.reflectionText.trim() : ''
    if (reflectionText) {
      return {
        reflectionText,
        model: typeof data?.model === 'string' && data.model.trim() ? data.model.trim() : 'qwen2.5:3b-instruct',
        usedFallback: false
      }
    }
  } catch (error) {
    console.warn('C.R.E.A.T.E. reflection request failed; using local fallback.', error)
  }

  return buildOfflineCreateReflection({ ...input, sessions })
}
