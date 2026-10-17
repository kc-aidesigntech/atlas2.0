import React from 'react'
import { Phone } from 'lucide-react'
import { AtlasIconButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { countOnlineDevices } from '@/features/atlas2026/fleet/fleetPresence'
import { supabase } from '@/lib/supabaseClient'
import { fetchLiveInboundRing } from '../data-access/prayphoneInboundRing'
import { fetchPrayPhoneDevicePresence, type PrayPhonePresenceRow } from '../data-access/prayphonePresence'
import { prayPhoneRingtone } from '../data-access/prayphoneRingtone'
import { isPrayPhoneWarmLineConfigured, openPrayPhoneAgentFromWorkspace } from '../data-access/prayphoneSubapp'
import { fetchCanAccessWarmLineAgent } from '../data-access/warmlineAccess'

const RING_POLL_MS = 4000
const PRESENCE_POLL_MS = 20000
const PRESENCE_AGE_MS = 15000

interface PrayPhoneListenButtonProps {
  role: AtlasRole
}

/**
 * Permanent Pray Phone door in the top bar, left of Account Settings.
 * Navigator, supervisor, and administrator profiles that pass the warm-line
 * permission see it on every workspace menu, and on the fleet and scribe
 * shells. Partners do not. A press always opens the
 * agent console. The green count is hardware kiosks whose heartbeat is
 * still inside the fleet online window. Phone-app rows (model mobile)
 * are not in that count. A kiosk key 0 turns the control red and rings.
 * Anonymous, enrollee, and prospective calls are stored and left off, so
 * they do not change this icon.
 */
export default function PrayPhoneListenButton({ role }: PrayPhoneListenButtonProps) {
  const eligibleRole = role === 'navigator' || role === 'supervisor' || role === 'administrator'
  const configured = isPrayPhoneWarmLineConfigured()
  const [hasAccess, setHasAccess] = React.useState(false)
  const [incoming, setIncoming] = React.useState(false)
  const [onlineCount, setOnlineCount] = React.useState(0)
  const presenceRows = React.useRef<PrayPhonePresenceRow[]>([])

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
    if (!hasAccess || !supabase) {
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
    // Supabase Realtime is the relay. The poll covers a missed socket event.
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
  }, [hasAccess])

  React.useEffect(() => {
    if (!hasAccess || !supabase) return
    let cancelled = false
    const publishCount = () => {
      if (!cancelled) setOnlineCount(countOnlineDevices(presenceRows.current))
    }
    const refresh = async () => {
      const read = await fetchPrayPhoneDevicePresence()
      if (!read.ok || cancelled) return
      presenceRows.current = read.devices
      publishCount()
    }
    void refresh()
    // Heartbeats arrive about once a minute. Realtime refreshes on each post.
    // The age timer drops a phone after the online window with no new row.
    const poll = window.setInterval(() => {
      void refresh()
    }, PRESENCE_POLL_MS)
    const age = window.setInterval(publishCount, PRESENCE_AGE_MS)
    const channel = supabase
      .channel(`prayphone-device-presence-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'atlas', table: 'prayphone_devices' },
        () => {
          void refresh()
        }
      )
      .subscribe()
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.clearInterval(age)
      void supabase.removeChannel(channel)
    }
  }, [hasAccess])

  React.useEffect(() => {
    if (incoming) prayPhoneRingtone.start()
    else prayPhoneRingtone.stop()
    return () => prayPhoneRingtone.stop()
  }, [incoming])

  React.useEffect(() => {
    if (!hasAccess) return
    // Browsers block the ring until this page has had a user gesture.
    const prime = () => prayPhoneRingtone.prime()
    window.addEventListener('pointerdown', prime)
    return () => window.removeEventListener('pointerdown', prime)
  }, [hasAccess])

  if (!eligibleRole || !configured || !hasAccess) return null

  const label = incoming
    ? `Incoming Pray Phone call. ${onlineCount} devices online. Press to open the agent console.`
    : `Pray Phone. ${onlineCount} devices online. Press to open the agent console.`
  const borderColor = incoming ? SP_COLORS.red : '#ffffff70'

  function onPress() {
    prayPhoneRingtone.stop()
    void openPrayPhoneAgentFromWorkspace()
  }

  return (
    <>
      <span className="sr-only" aria-live="assertive">
        {incoming ? 'Incoming Pray Phone call' : ''}
      </span>
      <span className="relative inline-flex">
        <AtlasIconButton
          onClick={onPress}
          aria-label={label}
          title={label}
          className={incoming ? 'animate-pulse' : undefined}
          style={{ ['--button-border-color' as const]: borderColor } as React.CSSProperties}
        >
          <Phone size={16} color={incoming ? SP_COLORS.red : SP_COLORS.white} aria-hidden />
        </AtlasIconButton>
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-black"
          style={{ backgroundColor: SP_COLORS.green }}
          aria-hidden
        >
          {onlineCount}
        </span>
      </span>
    </>
  )
}
