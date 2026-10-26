import React from 'react'
import { Phone } from 'lucide-react'
import { AtlasIconButton } from '@/features/atlas2026/components/AtlasPrimitives'
import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { supabase } from '@/lib/supabaseClient'
import { fetchLiveInboundRing } from '../data-access/prayphoneInboundRing'
import { fetchQueuedCallCount } from '../data-access/prayphoneQueueCount'
import { prayPhoneRingtone } from '../data-access/prayphoneRingtone'
import { configuredPrayPhoneOrigin, isPrayPhoneWarmLineConfigured, openPrayPhoneAgentFromWorkspace } from '../data-access/prayphoneSubapp'
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
 * The first pointer or key on this tab arms the clip. Later calls play it
 * without another click. A reload is not used: it clears that arming.
 * When the clip is blocked, a granted notification plays the system alert.
 */
export default function PrayPhoneListenButton({ role }: PrayPhoneListenButtonProps) {
  const eligibleRole = role === 'navigator' || role === 'supervisor' || role === 'administrator'
  const configured = isPrayPhoneWarmLineConfigured()
  const [hasAccess, setHasAccess] = React.useState(false)
  const [incoming, setIncoming] = React.useState(false)
  const [queuedCount, setQueuedCount] = React.useState(0)
  const incomingRef = React.useRef(false)
  const noticeRef = React.useRef<Notification | null>(null)
  const silencedRef = React.useRef(false)
  const openedRef = React.useRef<Window | null>(null)
  incomingRef.current = incoming

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
      if (cancelled) return
      if (read.ok) {
        const ringing = Boolean(read.ring)
        setIncoming(ringing)
        if (!ringing) silencedRef.current = false
        if (ringing && !silencedRef.current) prayPhoneRingtone.start()
      }
      const queued = await fetchQueuedCallCount()
      if (!cancelled && queued.ok) setQueuedCount(queued.count)
    }
    const onWake = () => {
      void refresh()
      if (incomingRef.current && !silencedRef.current) prayPhoneRingtone.start()
    }
    void refresh()
    const poll = window.setInterval(() => {
      void refresh()
    }, RING_POLL_MS)
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    window.addEventListener('pageshow', onWake)
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
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
      window.removeEventListener('pageshow', onWake)
      void supabase.removeChannel(channel)
    }
  }, [hasAccess])

  React.useEffect(() => {
    const onAnswered = (event: MessageEvent) => {
      if (event.data?.type !== 'prayphone-answered') return
      const expected = configuredPrayPhoneOrigin()
      const fromOpened = Boolean(openedRef.current) && event.source === openedRef.current
      if (!fromOpened && expected && event.origin !== expected) return
      silencedRef.current = true
      prayPhoneRingtone.stop()
    }
    window.addEventListener('message', onAnswered)
    return () => window.removeEventListener('message', onAnswered)
  }, [])

  React.useEffect(() => {
    if (!incoming) {
      silencedRef.current = false
      prayPhoneRingtone.stop()
      noticeRef.current?.close()
      noticeRef.current = null
      return
    }
    if (silencedRef.current) {
      prayPhoneRingtone.stop()
      return
    }
    prayPhoneRingtone.start()
    let notified = false
    const showNotice = () => {
      if (notified) return
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      if (prayPhoneRingtone.isAudible()) return
      try {
        const notice = new Notification('Incoming Pray Phone call', {
          body: 'A caller is waiting in the conferencer.',
          tag: 'prayphone-inbound'
        })
        notified = true
        noticeRef.current = notice
        notice.onclick = () => {
          window.focus()
          notice.close()
          const popup = window.open('', 'prayphone-agent')
          openedRef.current = popup
          void openPrayPhoneAgentFromWorkspace(popup)
        }
        notice.onclose = () => {
          if (noticeRef.current === notice) noticeRef.current = null
        }
      } catch {
        // The browser refused the notice. The icon stays red.
      }
    }
    const noticeTimer = window.setTimeout(showNotice, 700)
    const retry = window.setInterval(() => {
      if (silencedRef.current) return
      prayPhoneRingtone.start()
      showNotice()
    }, 2000)
    return () => {
      window.clearInterval(retry)
      window.clearTimeout(noticeTimer)
      prayPhoneRingtone.stop()
      noticeRef.current?.close()
      noticeRef.current = null
    }
  }, [incoming])

  React.useEffect(() => {
    if (!hasAccess) return
    prayPhoneRingtone.prepare()
    const prime = () => prayPhoneRingtone.prime()
    const primeAndAsk = () => prayPhoneRingtone.prime({ askNotification: true })
    window.addEventListener('pointerdown', primeAndAsk)
    window.addEventListener('keydown', prime)
    return () => {
      window.removeEventListener('pointerdown', primeAndAsk)
      window.removeEventListener('keydown', prime)
    }
  }, [hasAccess])

  if (!eligibleRole || !configured || !hasAccess) return null

  const label = incoming
    ? `Incoming Pray Phone call. ${queuedCount} in queue. Press to open the agent console.`
    : `Pray Phone. ${queuedCount} in queue. Press to open the agent console.`
  const borderColor = incoming ? SP_COLORS.red : '#ffffff70'

  function onPress() {
    const popup = window.open('', 'prayphone-agent')
    openedRef.current = popup
    void openPrayPhoneAgentFromWorkspace(popup)
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
