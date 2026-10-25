const RING_GAP_MS = 3000
const RING_VOLUME = 0.35

/** Vite serves files in public/ under BASE_URL ("/" locally, VITE_BASE_PATH in a production build). */
function ringSrc(): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}audio/ringtone.mp3`
}

/**
 * sounds/ringtone.mp3 is stored with Git Large File Storage (LFS). The build copies it to public/audio/ringtone.mp3.
 * stop() during the quiet gap bumps the generation so that pass does not start again.
 * A rejected play() leaves the ring pending so the next start() tries the clip again.
 */
function createPrayPhoneRingtone() {
  let audio: HTMLAudioElement | null = null
  let playing = false
  let unlocked = false
  let playPending = false
  let notificationAsked = false
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

  function isAudibleNow(): boolean {
    return Boolean(playing && audio && !audio.paused && !audio.ended)
  }

  function beginPass(gen: number) {
    const el = element()
    if (!el || !playing || gen !== generation) return
    resetPosition(el)
    playPending = true
    void el.play().then(() => {
      unlocked = true
      if (gen === generation) playPending = false
      if (playing && gen === generation) return
      el.pause()
      resetPosition(el)
    }).catch(() => {
      if (gen === generation) playPending = false
      // A blocked play leaves playing set. The next start() tries the clip again.
    })
  }

  function askNotification() {
    if (notificationAsked) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'default') return
    notificationAsked = true
    void Notification.requestPermission().catch(() => {
      notificationAsked = false
    })
  }

  return {
    prepare() {
      const el = element()
      if (!el || playing) return
      el.load()
    },
    prime(options?: { askNotification?: boolean }) {
      const el = element()
      if (!el) return
      if (options?.askNotification) askNotification()
      // An armed tab does not play again on every key. A silent in-progress ring still does.
      if (!playing && unlocked) return
      if (isAudibleNow()) return
      // load() drops a clip that has not started. Skip it once a ring is already in progress.
      if (!playing) el.load()
      // A gesture-started play is what later allows the chime. Pause unless a ring is sounding.
      playPending = true
      void el.play().then(() => {
        unlocked = true
        playPending = false
        if (playing) {
          clearGap()
          return
        }
        el.pause()
        resetPosition(el)
      }).catch(() => {
        playPending = false
        // Leave the unlock unset so the next pointer gesture can try again.
      })
    },
    start() {
      const el = element()
      if (!el) return
      if (playing && (gapTimer !== null || playPending || isAudibleNow())) return
      playing = true
      const gen = ++generation
      clearGap()
      beginPass(gen)
    },
    stop() {
      playing = false
      playPending = false
      generation += 1
      clearGap()
      if (!audio) return
      audio.pause()
      resetPosition(audio)
    },
    isAudible() {
      // The quiet gap and an in-flight play() still count as the chime sounding.
      return Boolean(playing && (gapTimer !== null || playPending || isAudibleNow()))
    }
  }
}

export const prayPhoneRingtone = createPrayPhoneRingtone()
