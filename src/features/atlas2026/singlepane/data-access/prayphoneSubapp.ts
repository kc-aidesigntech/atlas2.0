/**
 * Pray Phone warm-line subapp: Atlas portal entry to the agent webpage.
 * The kiosk Raspberry Pi and SignalWire stack stay on prayphone-server;
 * Atlas only owns navigation, session handoff, and role gating.
 *
 * Both apps use the same Supabase project. They are different sites, so the
 * agent cannot read the Atlas browser session. The click creates a 60-second
 * code and the agent signs that same user in. The session token stays out of
 * the address bar.
 */
import { supabase } from '@/lib/supabaseClient'

const WARM_LINE_MENU = 'warm line'

/** Live conferencer. The agent console is this origin plus /agent. */
export const PRAYPHONE_AGENT_ORIGIN = 'https://prayphone-68d333045316.herokuapp.com'

function configuredPrayPhoneOrigin(): string {
  // A set env value can point at a future custom domain. An empty value still
  // opens the live conferencer, so the phone icon is not compiled out.
  const override = String(import.meta.env.VITE_ATLAS_PRAYPHONE_URL || '').trim().replace(/\/+$/, '')
  return override || PRAYPHONE_AGENT_ORIGIN
}

/** True when the workspace should show the warm-line menu. */
export function isPrayPhoneWarmLineConfigured(): boolean {
  return Boolean(configuredPrayPhoneOrigin())
}

export function isWarmLineMenu(menu: string): boolean {
  return menu.trim().toLowerCase() === WARM_LINE_MENU
}

/**
 * Open the Pray Phone agent on its own origin, already aimed at the signed-in
 * Atlas user. The address bar receives a one-time code, which the agent page
 * removes immediately. A failed code still opens the console so the person
 * can sign in with the same Atlas account.
 */
export async function openPrayPhoneAgentFromWorkspace(): Promise<void> {
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
  window.location.assign(agentUrl.toString())
}
