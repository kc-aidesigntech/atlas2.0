/**
 * Client for Atlas Scribe audio transcription via the Heroku Model Context
 * Protocol (MCP) service → Whisper server on RunPod. Audio chunks are sent as
 * base64 JavaScript Object Notation (JSON) payloads and are never persisted:
 * the MCP service forwards them in memory only.
 */
import { getAtlasMcpBearer, getTranscribeUrl } from './atlasMcpEnv'

export interface TranscribeAudioResult {
  text: string
  model: string
}

/**
 * Convert a recorded audio blob to base64 without exceeding the call-stack
 * limits of String.fromCharCode on large buffers.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

/**
 * Transcribe one recorded chunk. Throws on network/contract failure so the
 * caller can mark the chunk as failed and keep the rest of the transcript.
 */
export async function transcribeAudioChunk(blob: Blob, language?: string): Promise<TranscribeAudioResult> {
  const audioBase64 = await blobToBase64(blob)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const bearer = getAtlasMcpBearer()
  if (bearer) headers.authorization = `Bearer ${bearer}`

  const response = await fetch(getTranscribeUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      ...(language ? { language } : {})
    })
  })
  if (!response.ok) {
    throw new Error(`Transcription request failed with status ${response.status}`)
  }
  const data = (await response.json()) as { text?: unknown; model?: unknown }
  return {
    text: typeof data?.text === 'string' ? data.text.trim() : '',
    model: typeof data?.model === 'string' ? data.model : ''
  }
}
