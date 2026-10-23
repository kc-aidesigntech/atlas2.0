import { supabase } from '@/lib/supabaseClient'
import {
  allRingSourcesEnabled,
  fetchEnabledRingSources,
  isPrayPhoneRingSourceEnabled
} from './prayphoneRingSources'

/**
 * Returns false when createdAt does not parse, is after nowMs, or is more than two hours before nowMs.
 */
const RING_MAX_AGE_MS = 2 * 60 * 60 * 1000

/** Passed as limit to the ringing-row select. */
const RING_SCAN_LIMIT = 20

export type PrayPhoneInboundRing = {
  id: string
  session_id: string
  created_at: string
}

export function isLiveInboundRing(createdAt: string, nowMs: number): boolean {
  const created = Date.parse(createdAt)
  if (!Number.isFinite(created)) return false
  return nowMs - created >= 0 && nowMs - created <= RING_MAX_AGE_MS
}

/**
 * Returns the first ringing row in the newest-20 list that is inside two hours
 * and whose caller_class is in the enabled set. A failed query returns ok: false.
 */
export async function fetchLiveInboundRing(): Promise<
  { ok: true; ring: PrayPhoneInboundRing | null } | { ok: false }
> {
  if (!supabase) return { ok: false }
  const { data, error } = await supabase
    .schema('atlas')
    .from('prayphone_inbound_rings')
    .select('id, session_id, created_at, caller_class')
    .eq('state', 'ringing')
    .order('created_at', { ascending: false })
    .limit(RING_SCAN_LIMIT)
  if (error) {
    console.warn('Pray Phone inbound ring read failed', error.message)
    return { ok: false }
  }
  // fetchEnabledRingSources null is replaced with allRingSourcesEnabled().
  const enabled = (await fetchEnabledRingSources()) ?? allRingSourcesEnabled()
  const now = Date.now()
  const ring =
    (data ?? []).find(
      (row) => isLiveInboundRing(row.created_at, now) && isPrayPhoneRingSourceEnabled(row.caller_class, enabled)
    ) ?? null
  return { ok: true, ring }
}
