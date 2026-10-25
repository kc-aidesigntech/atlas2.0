import { supabase } from '@/lib/supabaseClient'

/** Waiting states shown in the conferencer agent queues. */
export const QUEUED_CALL_STATES = ['initiated', 'dialing', 'ringing'] as const

/**
 * Selects a count of prayphone_call_sessions whose state is initiated, dialing, or ringing.
 * A failed read returns ok: false.
 */
export async function fetchQueuedCallCount(): Promise<{ ok: true; count: number } | { ok: false }> {
  if (!supabase) return { ok: false }
  const { count, error } = await supabase
    .schema('atlas')
    .from('prayphone_call_sessions')
    .select('id', { count: 'exact', head: true })
    .in('state', [...QUEUED_CALL_STATES])
  if (error) {
    console.warn('Pray Phone queue count failed', error.message)
    return { ok: false }
  }
  return { ok: true, count: count ?? 0 }
}
