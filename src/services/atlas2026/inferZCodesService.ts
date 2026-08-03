/**
 * Z-code inference client for partner referrals via Heroku Model Context Protocol (MCP)
 * → RunPod Ollama. Falls back to deterministic category/note rules when MCP is unreachable.
 */
import { getAtlasMcpBearer, getInferZcodesUrl } from './atlasMcpEnv'

const INFERENCE_BEARER = getAtlasMcpBearer()

const CATEGORY_TO_ZCODE: Record<string, string> = {
  Housing: 'Z59.1',
  Employment: 'Z56.0',
  Transportation: 'Z59.9',
  Food: 'Z59.4',
  Healthcare: 'Z60.8',
  Education: 'Z55.9',
  Childcare: 'Z62.9',
  Legal: 'Z65.3'
}

export interface InferZCodesReferralPayload {
  situationCategories?: string[]
  backgroundNotes?: string
  [key: string]: unknown
}

export interface InferZCodesResult {
  zCodes: string[]
  rationale: string
  model: string
  fallback: boolean
}

function normalizeZCode(value: unknown): string | null {
  const normalized = String(value || '').trim().toUpperCase()
  return /^Z\d{2}(\.\d+)?$/.test(normalized) ? normalized : null
}

function buildFallbackCodes({
  situationCategories = [],
  backgroundNotes = ''
}: InferZCodesReferralPayload): string[] {
  const seeded: string[] = []
  for (const category of situationCategories) {
    const mapped = CATEGORY_TO_ZCODE[String(category || '').trim()]
    if (mapped) seeded.push(mapped)
  }
  const notes = String(backgroundNotes || '').toLowerCase()
  if (notes.includes('housing') || notes.includes('shelter') || notes.includes('rent')) seeded.push('Z59.1')
  if (notes.includes('job') || notes.includes('work') || notes.includes('employment')) seeded.push('Z56.0')
  if (notes.includes('food') || notes.includes('hunger')) seeded.push('Z59.4')
  if (notes.includes('legal') || notes.includes('court') || notes.includes('probation')) seeded.push('Z65.3')

  // Keep fallback deterministic: the first two distinct valid Z-codes are returned.
  const unique = Array.from(new Set(seeded.map(normalizeZCode).filter(Boolean))) as string[]
  if (unique.length >= 2) return unique.slice(0, 2)
  if (unique.length === 1) return [unique[0], 'Z60.8']
  return ['Z59.1', 'Z56.0']
}

export async function inferZCodesForReferral(
  payload: InferZCodesReferralPayload
): Promise<InferZCodesResult> {
  const endpoint = getInferZcodesUrl()
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
      throw new Error(`Inference request failed with status ${response.status}`)
    }
    const data = (await response.json()) as {
      zCodes?: unknown
      rationale?: unknown
      model?: unknown
    }
    const normalized = Array.from(
      new Set((Array.isArray(data?.zCodes) ? data.zCodes : []).map(normalizeZCode).filter(Boolean))
    ) as string[]
    if (normalized.length >= 2) {
      return {
        zCodes: normalized.slice(0, 4),
        rationale: typeof data?.rationale === 'string' ? data.rationale : '',
        model: typeof data?.model === 'string' ? data.model : 'qwen2.5:3b-instruct',
        fallback: false
      }
    }
  } catch (error) {
    console.warn('Z-code inference request failed; using local fallback.', error)
  }
  return {
    zCodes: buildFallbackCodes(payload),
    rationale: 'Deterministic fallback from referral categories and notes.',
    model: 'fallback-rules',
    fallback: true
  }
}
