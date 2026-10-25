import React from 'react'
import { Phone } from 'lucide-react'
import { AtlasIconButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { supabase } from '@/lib/supabaseClient'
import { fetchLiveInboundRing } from '../data-access/prayphoneInboundRing'
import { fetchQueuedCallCount } from '../data-access/prayphoneQueueCount'
import { prayPhoneRingtone } from '../data-access/prayphoneRingtone'
import { isPrayPhoneWarmLineConfigured, openPrayPhoneAgentFromWorkspace } from '../data-access/prayphoneSubapp'
import { fetchCanAccessWarmLineAgent } from '../data-access/warmlineAccess'

const RING_POLL_MS = 4000

interface PrayPhoneListenButtonProps {
  role: AtlasRole
}

/**
 * Permanent Pray Phone door in the top bar, left of Account Settings.
 * Navigator, supervisor, and administrator profiles that pass the warm-line
 * permission see it on every workspace menu, and on the fleet and scribe
 * shells. Partners do not. A press always opens the
 * agent console. The green count is conferencer sessions whose state is
 * initiated, dialing, or ringing. An empty queue shows zero. An inbound
 * call turns the control red and rings when that class is enabled in
 * atlas.prayphone_ring_sources. All four classes start enabled.
 */
export default function PrayPhoneListenButton({ role }: PrayPhoneListenButtonProps) {
  const eligibleRole = role === 'navigator' || role === 'supervisor' || role === 'administrator'
  const configured = isPrayPhoneWarmLineConfigured()
  const [hasAccess, setHasAccess] = React.useState(false)
  const [incoming, setIncoming] = React.useState(false)
  const [queuedCount, setQueuedCount] = React.useState(0)

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
      setQueuedCount(0)
      return
    }
    let cancelled = false
    const refresh = async () => {
      const read = await fetchLiveInboundRing()
      if (!cancelled && read.ok) setIncoming(Boolean(read.ring))
      const queued = await fetchQueuedCallCount()
      if (!cancelled && queued.ok) setQueuedCount(queued.count)
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
    ? `Incoming Pray Phone call. ${queuedCount} in queue. Press to open the agent console.`
    : `Pray Phone. ${queuedCount} in queue. Press to open the agent console.`
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
          {queuedCount}
        </span>
      </span>
    </>
  )
}
