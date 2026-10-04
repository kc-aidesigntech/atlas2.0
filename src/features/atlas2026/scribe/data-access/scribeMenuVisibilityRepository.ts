/**
 * Administrator control for whether each permission level sees "scribe" in the
 * workspace menu. Visibility is the presence of that label on
 * atlas.app_role_navigation.top_menus. Row-Level Security (RLS) allows any
 * signed-in user to read the rows and only an administrator JSON Web Token
 * (JWT) (app_metadata.atlas_role) to write them.
 */
import type { AtlasRole } from '@/features/atlas2026/shared/contracts'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import {
  SCRIBE_MENU_ROLES,
  isScribeMenuRole,
  menuListIncludesScribe,
  setScribeOnMenuList
} from '@/features/atlas2026/scribe/scribeMenuVisibility'

const NAVIGATION_SURFACE = 'singlepane'

export type ScribeMenuVisibilityByRole = Record<AtlasRole, boolean>

function emptyVisibility(): ScribeMenuVisibilityByRole {
  return {
    administrator: false,
    supervisor: false,
    navigator: false,
    partner: false
  }
}

function readMenuList(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export async function fetchScribeMenuVisibility(): Promise<ScribeMenuVisibilityByRole> {
  const visibility = emptyVisibility()
  if (!hasSupabaseConfig || !supabase) return visibility

  const { data, error } = await supabase
    .schema('atlas')
    .from('app_role_navigation')
    .select('role_key, top_menus')
    .eq('surface', NAVIGATION_SURFACE)

  if (error) throw error

  for (const row of data || []) {
    const roleKey = String(row.role_key || '')
    if (!isScribeMenuRole(roleKey)) continue
    visibility[roleKey] = menuListIncludesScribe(readMenuList(row.top_menus))
  }

  return visibility
}

export async function setScribeMenuVisibility(role: AtlasRole, visible: boolean) {
  if (!SCRIBE_MENU_ROLES.includes(role)) {
    throw new Error('That permission level does not have a workspace menu.')
  }
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Scribe menu visibility needs a configured Supabase connection.')
  }

  const { data: existing, error: readError } = await supabase
    .schema('atlas')
    .from('app_role_navigation')
    .select('top_menus')
    .eq('surface', NAVIGATION_SURFACE)
    .eq('role_key', role)
    .maybeSingle()

  if (readError) throw readError
  if (!existing) {
    throw new Error(`No menu list is configured for ${role}.`)
  }

  const nextMenus = setScribeOnMenuList(readMenuList(existing.top_menus), visible)
  // Select the updated row so a Row-Level Security (RLS) denial (zero rows,
  // no error) is distinguishable from a successful write.
  const { data: updated, error: writeError } = await supabase
    .schema('atlas')
    .from('app_role_navigation')
    .update({ top_menus: nextMenus })
    .eq('surface', NAVIGATION_SURFACE)
    .eq('role_key', role)
    .select('role_key')

  if (writeError) throw writeError
  if (!updated?.length) {
    throw new Error('Only an administrator profile can change the scribe menu.')
  }
}
