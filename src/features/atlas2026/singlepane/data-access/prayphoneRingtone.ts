const RING_ON_MS = 2000
const RING_OFF_MS = 4000

/**
 * Two-tone phone ring played only after the staff member turns listening on.
 * Browsers block sound until that gesture, so the toggle primes the context.
 */
function createPrayPhoneRingtone() {
  let ctx: AudioContext | null = null
  let playing = false
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let oscillators: OscillatorNode[] = []

  function context(): AudioContext | null {
    if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null
    if (!ctx) ctx = new window.AudioContext()
    return ctx
  }

  function silence() {
    for (const osc of oscillators) {
      try {
        osc.stop()
      } catch {
        // The oscillator may already have stopped when the ring cadence flips.
      }
    }
    oscillators = []
  }

  function burst() {
    const audio = context()
    if (!audio || audio.state === 'suspended') return
    const master = audio.createGain()
    master.gain.value = 0.07
    master.connect(audio.destination)
    for (const frequency of [440, 480]) {
      const osc = audio.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequency
      osc.connect(master)
      osc.start()
      oscillators.push(osc)
    }
  }

  function loop(toneOn: boolean) {
    if (!playing) return
    if (toneOn) burst()
    else silence()
    timer = setTimeout(() => loop(!toneOn), toneOn ? RING_ON_MS : RING_OFF_MS)
  }

  return {
    prime() {
      const audio = context()
      if (audio && audio.state === 'suspended') void audio.resume()
    },
    start() {
      if (playing) return
      const audio = context()
      if (!audio) return
      playing = true
      const gen = ++generation
      void audio.resume().then(() => {
        if (!playing || gen !== generation) return
        silence()
        loop(true)
      })
    },
    stop() {
      playing = false
      generation += 1
      if (timer) clearTimeout(timer)
      timer = null
      silence()
    }
  }
}

export const prayPhoneRingtone = createPrayPhoneRingtone()
