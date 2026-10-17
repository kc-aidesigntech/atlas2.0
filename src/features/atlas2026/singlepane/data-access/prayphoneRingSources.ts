/** Caller classes the conferencer can store on an inbound ring. */
export type PrayPhoneRingSource = 'kiosk' | 'anonymous' | 'enrollee' | 'prospective'

/**
 * Which sources turn the header red and play the chime.
 * The conferencer writes every class. Only a true entry rings.
 * Anonymous, enrollee, and prospective stay off until that source is turned on.
 */
export const PRAYPHONE_RING_SOURCES: Record<PrayPhoneRingSource, boolean> = {
  kiosk: true,
  anonymous: false,
  enrollee: false,
  prospective: false
}

/** True when this class is one Atlas currently lets ring. An unknown class stays quiet. */
export function isPrayPhoneRingSourceEnabled(source: string | null | undefined): boolean {
  if (source !== 'kiosk' && source !== 'anonymous' && source !== 'enrollee' && source !== 'prospective') {
    return false
  }
  return PRAYPHONE_RING_SOURCES[source]
}
