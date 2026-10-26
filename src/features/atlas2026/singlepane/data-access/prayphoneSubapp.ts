/**
 * openPrayPhoneAgentFromWorkspace calls atlas.fn_create_prayphone_handoff
 * and assigns window.location to the conferencer /agent Uniform Resource Locator (URL)
 * with that code in the hash. An empty code still assigns the /agent URL.
 */
import { supabase } from '@/lib/supabaseClient'

const WARM_LINE_MENU = 'warm line'

/** Live conferencer. The agent console is this origin plus /agent. */
export const PRAYPHONE_AGENT_ORIGIN = 'https://prayphone-68d333045316.herokuapp.com'

export function configuredPrayPhoneOrigin(): string {
  // A non-empty VITE_ATLAS_PRAYPHONE_URL is returned with trailing slashes removed.
  // An empty value returns PRAYPHONE_AGENT_ORIGIN.
  const override = String(import.meta.env.VITE_ATLAS_PRAYPHONE_URL || '').trim().replace(/\/+$/, '')
  return override || PRAYPHONE_AGENT_ORIGIN
}

/** Returns Boolean(configuredPrayPhoneOrigin()). */
export function isPrayPhoneWarmLineConfigured(): boolean {
  return Boolean(configuredPrayPhoneOrigin())
}

export function isWarmLineMenu(menu: string): boolean {
  return menu.trim().toLowerCase() === WARM_LINE_MENU
}

/**
 * Builds /agent on configuredPrayPhoneOrigin. When fn_create_prayphone_handoff
 * returns 64 hex characters, those characters are written into the URL hash
 * as atlas_handoff. The passed window receives that URL. With no window,
 * this page is assigned the URL.
 */
export async function openPrayPhoneAgentFromWorkspace(target?: Window | null): Promise<void> {
  const origin = configuredPrayPhoneOrigin()
  if (!origin || typeof window === 'undefined') return

  const agentUrl = new URL('/agent', `${origin}/`)
  if (supabase) {
    const { data, error } = await supabase.schema('atlas').rpc('fn_create_prayphone_handoff')
    const code = typeof data === 'string' ? data : ''
    if (!error && /^[0-9a-f]{64}$/.test(code)) {
      agentUrl.hash = new URLSearchParams({ atlas_handoff: code }).toString()
    }
  }
  const href = agentUrl.toString()
  if (target && !target.closed) {
    target.location.href = href
    target.focus()
    return
  }
  window.location.assign(href)
}
