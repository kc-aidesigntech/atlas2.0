/**
 * Pray Phone warm-line subapp: Atlas portal entry to the agent webpage.
 * The kiosk Raspberry Pi and SignalWire stack stay on prayphone-server;
 * Atlas only owns navigation, session handoff, and role gating.
 */
import { supabase } from '@/lib/supabaseClient'

const WARM_LINE_MENU = 'warm line'

function configuredPrayPhoneOrigin(): string {
  return String(import.meta.env.VITE_ATLAS_PRAYPHONE_URL || '').trim().replace(/\/+$/, '')
}

/** True when the workspace should show the warm-line menu. */
export function isPrayPhoneWarmLineConfigured(): boolean {
  return Boolean(configuredPrayPhoneOrigin())
}

export function isWarmLineMenu(menu: string): boolean {
  return menu.trim().toLowerCase() === WARM_LINE_MENU
}

/**
 * Open the Pray Phone agent console on its own origin, carrying the current
 * Atlas JSON Web Token (JWT) in the URL fragment so the agent page can
 * `setSession` without a second password prompt. Fragments are not sent to
 * the server. The agent page must strip them immediately after consume.
 */
export async function openPrayPhoneAgentFromWorkspace(): Promise<void> {
  const origin = configuredPrayPhoneOrigin()
  if (!origin || typeof window === 'undefined') return

  const agentUrl = new URL('/agent', `${origin}/`)
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    const refreshToken = data.session?.refresh_token
    if (accessToken && refreshToken) {
      agentUrl.hash = new URLSearchParams({
        atlas_access_token: accessToken,
        atlas_refresh_token: refreshToken
      }).toString()
    }
  }
  window.location.assign(agentUrl.toString())
}
