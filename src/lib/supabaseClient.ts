import { createAtlasSupabaseClient, hasSupabaseConfig as hasConfig } from '@atlas/shared'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

const config = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey
}

export const hasSupabaseConfig = hasConfig(config)

export const supabase = createAtlasSupabaseClient(config, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})
