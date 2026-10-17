const RING_GAP_MS = 3000
const RING_VOLUME = 0.35

/**
 * Vite serves atlas/public at the app base path. Local dev is "/".
 * A production build uses VITE_BASE_PATH, exposed here as BASE_URL.
 */
function ringSrc(): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}audio/prayphone-ring.ogg`
}

/**
 * Recorded glass chime for an inbound call whose source is enabled.
 * Browsers block sound until the page has had a pointer gesture, so the header primes this clip.
 * A stop during the quiet gap bumps the generation so that pass does not start again.
 */
function createPrayPhoneRingtone() {
  let audio: HTMLAudioElement | null = null
  let playing = false
  let unlocked = false
  let generation = 0
  let gapTimer: ReturnType<typeof setTimeout> | null = null

  function clearGap() {
    if (gapTimer === null) return
    clearTimeout(gapTimer)
    gapTimer = null
  }

  function resetPosition(el: HTMLAudioElement) {
    try {
      el.currentTime = 0
    } catch {
      // Seek throws before the browser knows the duration. The next play still starts at the beginning.
    }
  }

  function element(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
    if (!audio) {
      audio = new Audio(ringSrc())
      audio.preload = 'auto'
      audio.volume = RING_VOLUME
      // The clip is one chime. The quiet gap is what makes it read as a ring.
      audio.addEventListener('ended', () => {
        if (!playing) return
        const gen = generation
        clearGap()
        gapTimer = setTimeout(() => {
          gapTimer = null
          if (!playing || gen !== generation) return
          beginPass(gen)
        }, RING_GAP_MS)
      })
    }
    return audio
  }

  function beginPass(gen: number) {
    const el = element()
    if (!el || !playing || gen !== generation) return
    resetPosition(el)
    void el.play().then(() => {
      unlocked = true
      if (playing && gen === generation) return
      el.pause()
      resetPosition(el)
    }).catch(() => {
      // A blocked play must not throw. The header icon still turns red.
    })
  }

  return {
    prime() {
      const el = element()
      if (!el || unlocked) return
      // load() drops a clip that has not started. Skip it once a ring is already in progress.
      if (!playing) el.load()
      // A gesture-started play is what later allows the chime. Pause unless a ring is sounding.
      void el.play().then(() => {
        unlocked = true
        // A ring that started during this gesture owns the element. Otherwise pause the unlock.
        if (playing) {
          clearGap()
          return
        }
        el.pause()
        resetPosition(el)
      }).catch(() => {
        // Leave the unlock unset so the next pointer gesture can try again.
      })
    },
    start() {
      if (playing) return
      if (!element()) return
      playing = true
      const gen = ++generation
      clearGap()
      beginPass(gen)
    },
    stop() {
      playing = false
      generation += 1
      clearGap()
      if (!audio) return
      audio.pause()
      resetPosition(audio)
    }
  }
}

export const prayPhoneRingtone = createPrayPhoneRingtone()
