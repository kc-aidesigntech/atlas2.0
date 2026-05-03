import { createAtlasSupabaseClient, hasSupabaseConfig as hasConfig } from '@atlas/shared'

/**
 * App-level Supabase client bootstrap.
 *
 * Purpose:
 * - centralizes env-based configuration and feature-flagged bootstrap behavior.
 * - exports one shared client/config contract for single-pane repositories/hooks.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  // Keep backward compatibility with older env naming while preferring the
  // publishable key identifier used by newer Supabase templates.
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

const config = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey
}

export const hasSupabaseConfig = hasConfig(config)
export const isSinglePaneSupabaseBootstrapEnabled =
  // In production we require auth bootstrap by default; local development can
  // opt in explicitly to keep non-auth workflows fast.
  !import.meta.env.DEV || import.meta.env.VITE_ENABLE_SINGLEPANE_SUPABASE_BOOTSTRAP === 'true'

export const supabase = createAtlasSupabaseClient(config, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})
