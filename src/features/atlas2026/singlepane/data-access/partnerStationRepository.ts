import type {
  DomainLoad,
  DomainLoadBreakdown,
  PartnerStationProfile
} from '@/features/atlas2026/shared/contracts'
import { fetchPartnerLoadBreakdown } from '@atlas/shared'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'
import { ensurePartnerIdentifierRecordForSurvey } from '@/features/atlas2026/singlepane/data-access/partnerServiceCapacityRepository'
import { toNormalizedRadialDomainLoad } from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { splitFullName } from '@/features/atlas2026/singlepane/personNameUtils'

export interface NavigatorStationContext {
  partnerId: string
  organizationName: string
  stationId: string | null
  stationName: string | null
  countyName: string | null
}

export async function loadPartnerRadialLoad(): Promise<DomainLoad | null> {
  const breakdown = await loadPartnerRadialLoadBreakdown()
  return toNormalizedRadialDomainLoad(breakdown)
}

export async function loadPartnerRadialLoadBreakdown(): Promise<DomainLoadBreakdown | null> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return null
  return withOptionalSupabaseFallback('singlepane.partnerLoadBreakdown', () => fetchPartnerLoadBreakdown(supabase), null)
}

function normalizeOrganizationName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function buildFallbackPartnerStationProfile(
  organizationName: string,
  fallback?: { fullName?: string | null; email?: string | null }
): PartnerStationProfile | null {
  const normalizedOrganizationName = organizationName.trim()
  if (!normalizedOrganizationName) return null
  const splitName = splitFullName(fallback?.fullName || '')
  return {
    partnerId: 'local-partner-profile',
    organizationName: normalizedOrganizationName,
    stationId: null,
    stationName: normalizedOrganizationName || '[My Station]',
    countyName: null,
    primaryContactFirstName: splitName.firstName || null,
    primaryContactLastName: splitName.lastName || null,
    primaryContactEmail: fallback?.email?.trim() || null,
    capacityTotal: null,
    capacityAvailable: null
  }
}

async function loadPartnerDirectoryRows(normalizedOrganizationName: string, cacheKey: string) {
  if (!supabase) return []
  return withOptionalSupabaseFallback(
    cacheKey,
    async () => {
      const { data: rows, error } = await (supabase as any)
        .schema('atlas')
        .from('v_partner_station_directory')
        .select(
          `
          partner_id,
          organization_name,
          organization_name_normalized,
          primary_contact_first_name,
          primary_contact_last_name,
          primary_contact_email,
          station_id,
          station_name,
          capacity_total,
          capacity_available,
          county_name
        `
        )
        .eq('organization_name_normalized', normalizedOrganizationName)
        .limit(1)
      if (error) throw error
      return rows || []
    },
    []
  )
}

export async function loadPartnerStationProfile(
  organizationName: string,
  fallback?: { fullName?: string | null; email?: string | null }
): Promise<PartnerStationProfile | null> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) {
    return buildFallbackPartnerStationProfile(organizationName, fallback)
  }
  const normalized = normalizeOrganizationName(organizationName)
  if (!normalized) return buildFallbackPartnerStationProfile(organizationName, fallback)

  let data = await loadPartnerDirectoryRows(normalized, `singlepane.partnerStationProfile:${normalized}`)
  let partner = data?.[0]
  if (!partner) {
    const splitName = splitFullName(fallback?.fullName || '')
    if (splitName.firstName && splitName.lastName) {
      try {
        // Materialize the identifier before retrying because the directory view depends on it.
        await ensurePartnerIdentifierRecordForSurvey({
          firstName: splitName.firstName,
          lastName: splitName.lastName,
          organizationName,
          email: fallback?.email || null
        })
      } catch {}

      data = await loadPartnerDirectoryRows(normalized, `singlepane.partnerStationProfile.refresh:${normalized}`)
      partner = data?.[0]
    }
  }

  if (!partner) return buildFallbackPartnerStationProfile(organizationName, fallback)
  return {
    partnerId: partner.partner_id,
    organizationName: partner.organization_name,
    stationId: partner.station_id || null,
    stationName: partner.station_name || null,
    countyName: partner.county_name || null,
    primaryContactFirstName: partner.primary_contact_first_name || null,
    primaryContactLastName: partner.primary_contact_last_name || null,
    primaryContactEmail: partner.primary_contact_email || null,
    capacityTotal: typeof partner.capacity_total === 'number' ? partner.capacity_total : null,
    capacityAvailable: typeof partner.capacity_available === 'number' ? partner.capacity_available : null
  }
}

export async function loadNavigatorStationContext(): Promise<NavigatorStationContext | null> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return null
  const { data, error } = await (supabase as any).schema('atlas').rpc('fn_get_my_navigator_station_context')
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const typed = row as Record<string, unknown>
  const partnerId = String(typed.partner_id || typed.partnerId || '').trim()
  const organizationName = String(typed.organization_name || typed.organizationName || '').trim()
  if (!partnerId || !organizationName) return null
  return {
    partnerId,
    organizationName,
    stationId: String(typed.station_id || typed.stationId || '').trim() || null,
    stationName: String(typed.station_name || typed.stationName || '').trim() || null,
    countyName: String(typed.county_name || typed.countyName || '').trim() || null
  }
}
