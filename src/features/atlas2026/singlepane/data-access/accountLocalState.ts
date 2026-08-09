import type { AccountSettings, AtlasRole, PartnerTroubleshootingGrant } from '@/features/atlas2026/shared/contracts'
import {
  loadConfigPayloadMapByPrefix,
  loadLatestConfigPayload,
  loadLocalStorageState,
  persistLocalStorageState,
  upsertConfigPayload
} from '@/features/atlas2026/singlepane/data-access/configDocumentPersistence'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

const SETTINGS_CONFIG_KEY = 'account_settings'
const LOCAL_ACCOUNT_SETTINGS_KEY = 'atlas2026.singlepane.account-settings.v2'
const PARTNER_TROUBLESHOOTING_GRANT_CONFIG_KEY_PREFIX = 'partner_troubleshooting_grant:'
const LOCAL_PARTNER_TROUBLESHOOTING_GRANTS_KEY = 'atlas2026.singlepane.partner-troubleshooting-grants.v1'

function getDefaultAccountSettings(): AccountSettings {
  return {
    fullName: 'atlas operator',
    email: 'operator@atlas.local',
    organization: 'atlas operations',
    avatarUrl: null,
    enabledRoles: ['administrator', 'supervisor', 'partner', 'navigator']
  }
}

function normalizeAccountAvatarUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  // Drop oversized data Uniform Resource Locator (URL) avatars that exhausted localStorage quota.
  if (trimmed.startsWith('data:image/') && trimmed.length > 180_000) return null
  return trimmed
}

function normalizeAccountSettingsPayload(payload: Partial<AccountSettings> | null | undefined, fallback: AccountSettings = getDefaultAccountSettings()) {
  const enabledRoles = Array.isArray(payload?.enabledRoles)
    ? payload.enabledRoles.filter((role): role is AtlasRole => ['navigator', 'partner', 'supervisor', 'administrator'].includes(String(role)))
    : fallback.enabledRoles
  return {
    fullName: payload?.fullName || fallback.fullName,
    email: payload?.email || fallback.email,
    organization: payload?.organization || fallback.organization,
    avatarUrl: normalizeAccountAvatarUrl(payload?.avatarUrl),
    enabledRoles: enabledRoles.length ? enabledRoles : fallback.enabledRoles
  } satisfies AccountSettings
}

interface AccountSettingsIdentityContext {
  configKey: string
  localStorageKey: string
  fallback: AccountSettings
  normalizedSessionEmail: string
}

function normalizeEmailValue(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

function buildAccountSettingsFallbackFromSession(session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']): AccountSettings {
  const metadata = (session?.user?.user_metadata || {}) as Record<string, unknown>
  const email = session?.user?.email?.trim() || getDefaultAccountSettings().email
  const fullName =
    String(metadata.full_name || '').trim() ||
    `${String(metadata.first_name || '').trim()} ${String(metadata.last_name || '').trim()}`.trim() ||
    email
  const organization =
    String(metadata.organization_name || '').trim() ||
    String(metadata.organization || '').trim() ||
    getDefaultAccountSettings().organization
  return { fullName, email, organization, avatarUrl: null, enabledRoles: ['partner'] }
}

async function resolveAccountSettingsIdentityContext(): Promise<AccountSettingsIdentityContext> {
  if (!hasSupabaseConfig || !supabase) {
    return { configKey: SETTINGS_CONFIG_KEY, localStorageKey: LOCAL_ACCOUNT_SETTINGS_KEY, fallback: getDefaultAccountSettings(), normalizedSessionEmail: '' }
  }
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user) {
    return { configKey: SETTINGS_CONFIG_KEY, localStorageKey: LOCAL_ACCOUNT_SETTINGS_KEY, fallback: getDefaultAccountSettings(), normalizedSessionEmail: '' }
  }
  const userId = data.session.user.id?.trim()
  return {
    configKey: userId ? `${SETTINGS_CONFIG_KEY}:${userId}` : SETTINGS_CONFIG_KEY,
    localStorageKey: userId ? `${LOCAL_ACCOUNT_SETTINGS_KEY}:${userId}` : LOCAL_ACCOUNT_SETTINGS_KEY,
    fallback: buildAccountSettingsFallbackFromSession(data.session),
    normalizedSessionEmail: normalizeEmailValue(data.session.user.email)
  }
}

function loadLocalAccountSettingsState(storageKey: string, fallback: AccountSettings) {
  return loadLocalStorageState(storageKey, fallback, (parsed) => normalizeAccountSettingsPayload(parsed as Partial<AccountSettings>, fallback))
}

/**
 * Write the account settings localStorage copy without letting a full browser
 * store break the save. When Supabase is configured it is the durable record and
 * localStorage is only a warm cache, so quota failures degrade to a warning.
 * Without Supabase, localStorage IS the durable store, so failures stay fatal.
 */
function cacheAccountSettingsLocally(storageKey: string, settings: AccountSettings) {
  try {
    persistLocalStorageState(storageKey, settings)
  } catch (error) {
    if (!hasSupabaseConfig || !supabase) throw error
    console.warn('[singlepane] skipped account settings cache write (browser storage full)', error)
  }
}

export async function loadAccountSettings(): Promise<AccountSettings> {
  const context = await resolveAccountSettingsIdentityContext()
  const { payload, error } = await loadLatestConfigPayload<Partial<AccountSettings>>(context.configKey)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalAccountSettingsState(context.localStorageKey, context.fallback)
    throw error
  }
  if (!payload && context.configKey !== SETTINGS_CONFIG_KEY) {
    const legacy = await loadLatestConfigPayload<Partial<AccountSettings>>(SETTINGS_CONFIG_KEY)
    if (!legacy.error && legacy.payload) {
      const normalized = normalizeAccountSettingsPayload(legacy.payload, context.fallback)
      const legacyEmail = normalizeEmailValue(normalized.email)
      if (!context.normalizedSessionEmail || !legacyEmail || legacyEmail === context.normalizedSessionEmail) {
        cacheAccountSettingsLocally(context.localStorageKey, normalized)
        await upsertConfigPayload(context.configKey, normalized)
        return normalized
      }
    }
  }
  const normalized = normalizeAccountSettingsPayload(payload, context.fallback)
  cacheAccountSettingsLocally(context.localStorageKey, normalized)
  return normalized
}

export async function saveAccountSettings(settings: AccountSettings): Promise<AccountSettings> {
  const context = await resolveAccountSettingsIdentityContext()
  const normalized = normalizeAccountSettingsPayload(settings, context.fallback)
  cacheAccountSettingsLocally(context.localStorageKey, normalized)
  const error = await upsertConfigPayload(context.configKey, normalized)
  if (error && !isOptionalSupabaseDataError(error)) throw error
  return normalized
}

function normalizePartnerTroubleshootingGrant(payload: Partial<PartnerTroubleshootingGrant> | null | undefined, partnerId: string): PartnerTroubleshootingGrant {
  return {
    partnerId,
    organizationName: payload?.organizationName?.trim() || '',
    allowedMenus: Array.isArray(payload?.allowedMenus) ? payload.allowedMenus.map(String).filter(Boolean) : [],
    allowWrite: Boolean(payload?.allowWrite),
    updatedAtIso: payload?.updatedAtIso || new Date().toISOString()
  }
}

function loadLocalPartnerTroubleshootingGrantState(): Record<string, PartnerTroubleshootingGrant> {
  return loadLocalStorageState(LOCAL_PARTNER_TROUBLESHOOTING_GRANTS_KEY, {}, (parsed) => {
    if (!parsed || typeof parsed !== 'object') return {}
    return Object.fromEntries(Object.entries(parsed as Record<string, Partial<PartnerTroubleshootingGrant>>).map(([id, value]) => [id, normalizePartnerTroubleshootingGrant(value, id)]))
  })
}

export async function loadPartnerTroubleshootingGrants(): Promise<Record<string, PartnerTroubleshootingGrant>> {
  const { rows, error } = await loadConfigPayloadMapByPrefix<PartnerTroubleshootingGrant>(PARTNER_TROUBLESHOOTING_GRANT_CONFIG_KEY_PREFIX)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalPartnerTroubleshootingGrantState()
    throw error
  }
  const normalized = Object.fromEntries((rows || []).map((row) => {
    const id = row.config_key?.replace(PARTNER_TROUBLESHOOTING_GRANT_CONFIG_KEY_PREFIX, '')
    return id ? [id, normalizePartnerTroubleshootingGrant(row.payload as Partial<PartnerTroubleshootingGrant>, id)] : null
  }).filter((entry): entry is [string, PartnerTroubleshootingGrant] => Boolean(entry)))
  persistLocalStorageState(LOCAL_PARTNER_TROUBLESHOOTING_GRANTS_KEY, normalized)
  return normalized
}

export async function savePartnerTroubleshootingGrant(grant: PartnerTroubleshootingGrant): Promise<PartnerTroubleshootingGrant> {
  const normalized = normalizePartnerTroubleshootingGrant(grant, grant.partnerId)
  persistLocalStorageState(LOCAL_PARTNER_TROUBLESHOOTING_GRANTS_KEY, { ...loadLocalPartnerTroubleshootingGrantState(), [normalized.partnerId]: normalized })
  const error = await upsertConfigPayload(`${PARTNER_TROUBLESHOOTING_GRANT_CONFIG_KEY_PREFIX}${normalized.partnerId}`, normalized)
  if (error && !isOptionalSupabaseDataError(error)) throw error
  return normalized
}
