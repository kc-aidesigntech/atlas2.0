/**
 * Microphone capture + incremental transcription for Atlas Scribe.
 *
 * Recording strategy: instead of MediaRecorder timeslices (whose chunks after
 * the first lack container headers and cannot be decoded standalone), we
 * rotate the MediaRecorder every ~45 seconds on the same live stream. Each
 * segment is a complete WebM/MP4 file that is transcribed immediately, so the
 * transcript builds while the conversation continues and no single upload is
 * large enough to hit the Heroku 30-second router timeout.
 *
 * Privacy: audio segments live only in memory and are discarded after
 * transcription; nothing is persisted locally or server-side.
 */
import React from 'react'
import { transcribeAudioChunk } from '@/services/atlas2026/transcribeAudioService'

const SEGMENT_DURATION_MS = 45_000

export interface TranscriptSegment {
  id: number
  /** null while transcription is in flight. */
  text: string | null
  failed: boolean
}

export interface ScribeRecorder {
  isRecording: boolean
  elapsedSeconds: number
  segments: TranscriptSegment[]
  /** Segments currently awaiting a transcription response. */
  pendingCount: number
  recorderError: string | null
  start: () => Promise<void>
  /** Resolves with the full assembled transcript once all segments settle. */
  stop: () => Promise<string>
}

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  // Opus/WebM first (Chrome, Firefox, Edge); MP4 covers Safari.
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || ''
}

export function useScribeRecorder(): ScribeRecorder {
  const [isRecording, setIsRecording] = React.useState(false)
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0)
  const [segments, setSegments] = React.useState<TranscriptSegment[]>([])
  const [recorderError, setRecorderError] = React.useState<string | null>(null)

  const streamRef = React.useRef<MediaStream | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const rotationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const isRecordingRef = React.useRef(false)
  const nextSegmentIdRef = React.useRef(0)
  // Settled transcript text by segment id; source of truth for stop()'s return
  // value because React state updates are async relative to stop().
  const segmentTextsRef = React.useRef(new Map<number, string>())
  const pendingTranscriptionsRef = React.useRef(new Set<Promise<void>>())
  // Resolves when the active recorder's onstop handler has run, guaranteeing
  // the final segment's transcription promise is registered before we await.
  const activeSegmentStopRef = React.useRef<Promise<void> | null>(null)

  const transcribeSegment = React.useCallback((segmentId: number, blob: Blob) => {
    setSegments((current) => [...current, { id: segmentId, text: null, failed: false }])
    const task = transcribeAudioChunk(blob)
      .then((result) => {
        segmentTextsRef.current.set(segmentId, result.text)
        setSegments((current) =>
          current.map((segment) => (segment.id === segmentId ? { ...segment, text: result.text } : segment))
        )
      })
      .catch((error) => {
        console.warn(`Scribe segment ${segmentId} transcription failed.`, error)
        setSegments((current) =>
          current.map((segment) => (segment.id === segmentId ? { ...segment, text: '', failed: true } : segment))
        )
      })
      .finally(() => {
        pendingTranscriptionsRef.current.delete(task)
      }) as Promise<void>
    pendingTranscriptionsRef.current.add(task)
  }, [])

  const beginSegment = React.useCallback(
    (stream: MediaStream) => {
      const mimeType = pickSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const segmentId = nextSegmentIdRef.current++
      const localChunks: Blob[] = []
      let resolveStopped: () => void = () => {}
      activeSegmentStopRef.current = new Promise<void>((resolve) => {
        resolveStopped = resolve
      })
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) localChunks.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(localChunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        // Skip empty segments (e.g. immediate stop) so we don't send junk audio.
        if (blob.size > 0) transcribeSegment(segmentId, blob)
        resolveStopped()
      }
      recorder.start()
      recorderRef.current = recorder
    },
    [transcribeSegment]
  )

  const rotateSegment = React.useCallback(() => {
    if (!isRecordingRef.current || !streamRef.current) return
    recorderRef.current?.stop()
    beginSegment(streamRef.current)
    rotationTimerRef.current = setTimeout(rotateSegment, SEGMENT_DURATION_MS)
  }, [beginSegment])

  const start = React.useCallback(async () => {
    if (isRecordingRef.current) return
    setRecorderError(null)
    setSegments([])
    setElapsedSeconds(0)
    segmentTextsRef.current.clear()
    nextSegmentIdRef.current = 0
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      isRecordingRef.current = true
      setIsRecording(true)
      beginSegment(stream)
      rotationTimerRef.current = setTimeout(rotateSegment, SEGMENT_DURATION_MS)
      tickTimerRef.current = setInterval(() => setElapsedSeconds((current) => current + 1), 1000)
    } catch (error) {
      console.warn('Scribe microphone access failed.', error)
      setRecorderError('Microphone access was denied or unavailable. Check browser permissions and try again.')
    }
  }, [beginSegment, rotateSegment])

  const stop = React.useCallback(async () => {
    if (!isRecordingRef.current) return ''
    isRecordingRef.current = false
    setIsRecording(false)
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current)
    if (tickTimerRef.current) clearInterval(tickTimerRef.current)
    rotationTimerRef.current = null
    tickTimerRef.current = null

    recorderRef.current?.stop()
    // Wait for onstop to register the final transcription before settling all.
    if (activeSegmentStopRef.current) await activeSegmentStopRef.current
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null

    await Promise.allSettled(Array.from(pendingTranscriptionsRef.current))

    // Assemble in segment order; failed segments are simply omitted (the UI
    // shows which ones failed so the clinician knows there may be gaps).
    const orderedIds = Array.from(segmentTextsRef.current.keys()).sort((left, right) => left - right)
    return orderedIds
      .map((id) => segmentTextsRef.current.get(id) || '')
      .filter(Boolean)
      .join(' ')
      .trim()
  }, [])

  // Release the microphone and timers if the component unmounts mid-recording.
  React.useEffect(() => {
    return () => {
      if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current)
      if (tickTimerRef.current) clearInterval(tickTimerRef.current)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const pendingCount = segments.filter((segment) => segment.text === null && !segment.failed).length

  return { isRecording, elapsedSeconds, segments, pendingCount, recorderError, start, stop }
}
