/**
 * Client for Atlas Scribe draft note generation via the Heroku Model Context
 * Protocol (MCP) service → RunPod Ollama. Produces a Subjective, Objective,
 * Assessment, Plan (SOAP) structured note from an encounter transcript.
 */
import { getAtlasMcpBearer, getGenerateSoapNoteUrl } from './atlasMcpEnv'

export interface SoapNoteSections {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export interface GenerateSoapNoteResult extends SoapNoteSections {
  model: string
  usedFallback: boolean
}

/**
 * Deterministic offline note when MCP/Ollama is unreachable from the browser:
 * preserves the transcript in the Subjective section so the encounter is
 * never lost and the clinician can complete the note manually.
 */
export function buildOfflineSoapNote(transcript: string): GenerateSoapNoteResult {
  const excerpt = transcript.replace(/\s+/g, ' ').trim()
  return {
    subjective: excerpt
      ? `Automatic note generation was unavailable. Raw conversation transcript for manual review: ${excerpt}`
      : 'Automatic note generation was unavailable and no transcript text was captured.',
    objective: 'Not generated. Complete from clinician observation.',
    assessment: 'Not generated. Complete after reviewing the transcript above.',
    plan: 'Not generated. Complete after reviewing the transcript above.',
    model: 'fallback-local-transcript',
    usedFallback: true
  }
}

function readSection(data: Record<string, unknown>, key: keyof SoapNoteSections): string {
  const value = data?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Prefer MCP generation; on any network/contract failure, return the offline
 * transcript-preserving note so the recording session always yields output.
 */
export async function generateSoapNote(
  transcript: string,
  encounterContext?: string
): Promise<GenerateSoapNoteResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const bearer = getAtlasMcpBearer()
  if (bearer) headers.authorization = `Bearer ${bearer}`

  try {
    const response = await fetch(getGenerateSoapNoteUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transcript,
        ...(encounterContext?.trim() ? { encounterContext: encounterContext.trim() } : {})
      })
    })
    if (!response.ok) {
      throw new Error(`SOAP note request failed with status ${response.status}`)
    }
    const data = (await response.json()) as Record<string, unknown>
    const sections: SoapNoteSections = {
      subjective: readSection(data, 'subjective'),
      objective: readSection(data, 'objective'),
      assessment: readSection(data, 'assessment'),
      plan: readSection(data, 'plan')
    }
    if (Object.values(sections).some(Boolean)) {
      return {
        ...sections,
        model: typeof data?.model === 'string' ? data.model : '',
        usedFallback: Boolean(data?.fallback)
      }
    }
  } catch (error) {
    console.warn('SOAP note request failed; using local transcript-preserving fallback.', error)
  }

  return buildOfflineSoapNote(transcript)
}
