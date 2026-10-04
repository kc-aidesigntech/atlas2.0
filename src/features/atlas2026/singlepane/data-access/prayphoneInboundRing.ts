import { supabase } from '@/lib/supabaseClient'

/** Browser preference for the header listen control. Not a server role. */
export const PRAYPHONE_LISTEN_STORAGE_KEY = 'atlas.prayphone.listen'

/**
 * The kiosk ends a stuck call after one hour. Ignore a ring that is still
 * marked ringing well past that, so a missed clear cannot ring all day.
 */
const RING_MAX_AGE_MS = 2 * 60 * 60 * 1000

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

/** Newest unanswered kiosk ring, or a failed read so the header can keep ringing. */
export async function fetchLiveInboundRing(): Promise<
  { ok: true; ring: PrayPhoneInboundRing | null } | { ok: false }
> {
  if (!supabase) return { ok: false }
  const { data, error } = await supabase
    .schema('atlas')
    .from('prayphone_inbound_rings')
    .select('id, session_id, created_at')
    .eq('state', 'ringing')
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) {
    console.warn('Pray Phone inbound ring read failed', error.message)
    return { ok: false }
  }
  const now = Date.now()
  const ring = (data ?? []).find((row) => isLiveInboundRing(row.created_at, now)) ?? null
  return { ok: true, ring }
}
