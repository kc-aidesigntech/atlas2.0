import { supabase } from '@/lib/supabaseClient'

/** Caller classes the conferencer can store on an inbound ring. */
export const PRAYPHONE_RING_SOURCES = ['kiosk', 'anonymous', 'enrollee', 'prospective'] as const

export type PrayPhoneRingSource = (typeof PRAYPHONE_RING_SOURCES)[number]

function isKnownRingSource(source: string | null | undefined): source is PrayPhoneRingSource {
  return source === 'kiosk' || source === 'anonymous' || source === 'enrollee' || source === 'prospective'
}

/** True when this class is enabled in the set Atlas just read. An unknown class stays quiet. */
export function isPrayPhoneRingSourceEnabled(
  source: string | null | undefined,
  enabled: ReadonlySet<string>
): boolean {
  return Boolean(source && enabled.has(source))
}

/** Every known class. A failed settings read uses this so a blip does not mute a live call. */
export function allRingSourcesEnabled(): Set<string> {
  return new Set(PRAYPHONE_RING_SOURCES)
}

/**
 * Enabled rows from atlas.prayphone_ring_sources.
 * Null means the read failed. The header then rings every known class.
 */
export async function fetchEnabledRingSources(): Promise<Set<string> | null> {
  if (!supabase) return null
  const { data, error } = await supabase.schema('atlas').from('prayphone_ring_sources').select('source, enabled')
  if (error) {
    console.warn('Pray Phone ring source read failed', error.message)
    return null
  }
  const enabled = new Set<string>()
  for (const row of data ?? []) {
    if (row.enabled === true && isKnownRingSource(row.source)) enabled.add(row.source)
  }
  return enabled
}
