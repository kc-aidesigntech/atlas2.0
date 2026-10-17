import { supabase } from '@/lib/supabaseClient'
import { isPrayPhoneRingSourceEnabled } from './prayphoneRingSources'

/**
 * The kiosk ends a stuck call after one hour. Ignore a ring that is still
 * marked ringing well past that, so a missed clear cannot ring all day.
 */
const RING_MAX_AGE_MS = 2 * 60 * 60 * 1000

/** Enough recent ringing rows to see a kiosk behind newer classes that are turned off. */
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
 * Newest ringing row inside the two-hour window whose caller class is enabled.
 * A newer anonymous, enrollee, or prospective row does not hide an older kiosk ring.
 * A failed read leaves the header on its last state so a live ring is not cleared by a blip.
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
  const now = Date.now()
  const ring =
    (data ?? []).find(
      (row) => isLiveInboundRing(row.created_at, now) && isPrayPhoneRingSourceEnabled(row.caller_class)
    ) ?? null
  return { ok: true, ring }
}
