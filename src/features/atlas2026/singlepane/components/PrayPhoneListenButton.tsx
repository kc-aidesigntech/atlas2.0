import React from 'react'
import { Phone } from 'lucide-react'
import { AtlasIconButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { supabase } from '@/lib/supabaseClient'
import { fetchLiveInboundRing, PRAYPHONE_LISTEN_STORAGE_KEY } from '../data-access/prayphoneInboundRing'
import { prayPhoneRingtone } from '../data-access/prayphoneRingtone'
import { isPrayPhoneWarmLineConfigured, openPrayPhoneAgentFromWorkspace } from '../data-access/prayphoneSubapp'
import { fetchCanAccessWarmLineAgent } from '../data-access/warmlineAccess'

const RING_POLL_MS = 4000

interface PrayPhoneListenButtonProps {
  role: AtlasRole
}

/**
 * Small Pray Phone control to the left of Account Settings.
 * Listening is a per-browser toggle for navigator, supervisor, and administrator
 * profiles that already pass the warm-line permission. A kiosk key 0 lights the
 * button and rings. Pressing it then opens the existing agent console.
 */
export default function PrayPhoneListenButton({ role }: PrayPhoneListenButtonProps) {
  const eligibleRole = role === 'navigator' || role === 'supervisor' || role === 'administrator'
  const configured = isPrayPhoneWarmLineConfigured()
  const [hasAccess, setHasAccess] = React.useState(false)
  const [listening, setListening] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(PRAYPHONE_LISTEN_STORAGE_KEY) === '1'
  })
  const [incoming, setIncoming] = React.useState(false)

  React.useEffect(() => {
    if (!eligibleRole || !configured) return
    let cancelled = false
    void fetchCanAccessWarmLineAgent().then((allowed) => {
      if (!cancelled) setHasAccess(allowed)
    })
    return () => {
      cancelled = true
    }
  }, [configured, eligibleRole])

  React.useEffect(() => {
    if (!hasAccess || !listening || !supabase) {
      setIncoming(false)
      return
    }
    let cancelled = false
    const refresh = async () => {
      const read = await fetchLiveInboundRing()
      if (!cancelled && read.ok) setIncoming(Boolean(read.ring))
    }
    void refresh()
    const poll = window.setInterval(() => {
      void refresh()
    }, RING_POLL_MS)
    // Realtime is the relay. The poll covers a missed socket event.
    const channel = supabase
      .channel(`prayphone-inbound-rings-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'atlas', table: 'prayphone_inbound_rings' },
        () => {
          void refresh()
        }
      )
      .subscribe()
    return () => {
      cancelled = true
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [hasAccess, listening])

  React.useEffect(() => {
    if (listening && incoming) prayPhoneRingtone.start()
    else prayPhoneRingtone.stop()
    return () => prayPhoneRingtone.stop()
  }, [incoming, listening])

  React.useEffect(() => {
    if (!listening) return
    const prime = () => prayPhoneRingtone.prime()
    window.addEventListener('pointerdown', prime)
    return () => window.removeEventListener('pointerdown', prime)
  }, [listening])

  if (!eligibleRole || !configured || !hasAccess) return null

  const label = incoming
    ? 'Incoming Pray Phone call. Press to open the agent console.'
    : listening
      ? 'Pray Phone listening is on. Press to turn it off.'
      : 'Pray Phone listening is off. Press to listen for kiosk calls.'
  const borderColor = incoming ? SP_COLORS.yellow : listening ? '#ffffff' : '#ffffff70'

  function onPress() {
    if (listening && incoming) {
      prayPhoneRingtone.stop()
      void openPrayPhoneAgentFromWorkspace()
      return
    }
    const next = !listening
    if (next) prayPhoneRingtone.prime()
    window.localStorage.setItem(PRAYPHONE_LISTEN_STORAGE_KEY, next ? '1' : '0')
    setListening(next)
  }

  return (
    <>
      <span className="sr-only" aria-live="assertive">
        {incoming ? 'Incoming Pray Phone call' : ''}
      </span>
      <AtlasIconButton
        onClick={onPress}
        aria-pressed={listening}
        aria-label={label}
        title={label}
        className={incoming ? 'animate-pulse' : undefined}
        style={{ ['--button-border-color' as const]: borderColor } as React.CSSProperties}
      >
        <Phone size={16} aria-hidden />
      </AtlasIconButton>
    </>
  )
}
