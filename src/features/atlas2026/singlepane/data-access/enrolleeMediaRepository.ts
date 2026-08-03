import type {
  EnrolleeZCodeOverrideInput,
  EnrolleeZCodeOverrideResult,
  EnrolleeZCodeResolutionInput
} from '@/features/atlas2026/shared/contracts'
import {
  overrideEnrolleeZCodes as persistEnrolleeZCodeOverride,
  setEnrolleeZCodeResolution as persistEnrolleeZCodeResolution
} from '@atlas/shared'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

const PROFILE_IMAGE_ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

function sanitizeFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function assertProfileImageFile(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Please select an image file.')
  if (!PROFILE_IMAGE_ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Use a PNG, JPEG, or WebP image (max 5 MB).')
  }
  if (typeof file.size === 'number' && file.size > PROFILE_IMAGE_MAX_BYTES) {
    throw new Error('Image must be 5 MB or smaller.')
  }
}

export async function uploadEnrolleeProfileImage(
  enrolleeId: string,
  file: File
): Promise<{ avatarUrl: string; storagePath: string }> {
  if (!enrolleeId.trim()) throw new Error('An enrollee id is required to upload a profile image.')
  if (!hasSupabaseConfig || !supabase) throw new Error('Supabase is required to upload profile images.')
  assertProfileImageFile(file)

  const safeFileName = sanitizeFilename(file.name || 'profile-image.jpeg') || 'profile-image.jpeg'
  const storagePath = `enrollees/${enrolleeId}/${Date.now()}-${safeFileName}`
  const bucket = (supabase as any).storage.from('profile-images')
  const { error: uploadError } = await bucket.upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  })
  if (uploadError) throw uploadError

  const { data: publicData } = bucket.getPublicUrl(storagePath)
  const publicUrl = publicData?.publicUrl || `/storage/v1/object/public/profile-images/${storagePath}`
  const nowIso = new Date().toISOString()
  const profileImagePayload = {
    enrollee_id: enrolleeId,
    storage_bucket: 'profile-images',
    storage_path: storagePath,
    public_url: publicUrl,
    original_filename: file.name || safeFileName,
    mime_type: file.type || null,
    file_size_bytes: typeof file.size === 'number' ? file.size : null,
    intake_source: 'manual',
    intake_status: 'ready',
    is_primary: true,
    alt_text: 'Enrollee profile image',
    metadata: { uploaded_from: 'singlepane-ui' },
    ready_at: nowIso,
    updated_at: nowIso
  }

  // Reuse the primary image row when present so consumers retain one canonical pointer.
  const { data: updatedPrimaryRows, error: updatePrimaryError } = await (supabase as any)
    .schema('atlas')
    .from('profile_images')
    .update(profileImagePayload)
    .eq('enrollee_id', enrolleeId)
    .eq('is_primary', true)
    .select('id')
  if (updatePrimaryError) throw updatePrimaryError

  if (!updatedPrimaryRows?.length) {
    const { error: profileImageInsertError } = await (supabase as any)
      .schema('atlas')
      .from('profile_images')
      .insert(profileImagePayload)
    if (profileImageInsertError) throw profileImageInsertError
  }

  return { avatarUrl: publicUrl, storagePath }
}

/**
 * Upload a navigator or partner avatar under the authenticated account.
 * Persist only the public Uniform Resource Locator (URL), never a data URL, so
 * browser and application configuration documents stay under size limits.
 */
export async function uploadAccountProfileImage(
  file: File
): Promise<{ avatarUrl: string; storagePath: string }> {
  if (!hasSupabaseConfig || !supabase) throw new Error('Supabase is required to upload profile images.')
  assertProfileImageFile(file)

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const userId = sessionData.session?.user?.id?.trim()
  if (!userId) throw new Error('Sign in is required to upload a profile image.')

  const safeFileName = sanitizeFilename(file.name || 'profile-image.jpeg') || 'profile-image.jpeg'
  const storagePath = `accounts/${userId}/${Date.now()}-${safeFileName}`
  const bucket = supabase.storage.from('profile-images')
  const { error: uploadError } = await bucket.upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  })
  if (uploadError) throw uploadError

  const { data: publicData } = bucket.getPublicUrl(storagePath)
  const publicUrl = publicData?.publicUrl || `/storage/v1/object/public/profile-images/${storagePath}`
  return { avatarUrl: publicUrl, storagePath }
}

export async function setEnrolleeZCodeResolution(
  enrolleeZCodeId: string,
  isResolved: boolean,
  input: EnrolleeZCodeResolutionInput = {}
) {
  if (!enrolleeZCodeId || !hasSupabaseConfig || !supabase) {
    return {
      enrolleeZCodeId,
      isResolved,
      resolutionAt: isResolved ? new Date().toISOString() : null,
      resolutionPartnerId: isResolved ? input.partnerId ?? null : null,
      resolutionPartnerName: isResolved ? input.partnerName ?? null : null,
      resolutionNote: isResolved ? input.resolutionNote?.trim() || null : null,
      // Mirror server derivation so offline demonstration state stays coherent with the toggle.
      codeReviewStatus: input.codeReviewStatus ?? (isResolved ? ('resolved' as const) : ('not_resolved' as const)),
      confidenceLevel: input.confidenceLevel ?? null
    }
  }
  return persistEnrolleeZCodeResolution(
    supabase,
    enrolleeZCodeId,
    isResolved,
    isResolved ? input.partnerId ?? null : null,
    isResolved ? input.partnerName?.trim() || null : null,
    isResolved ? input.resolutionNote?.trim() || null : null,
    input.codeReviewStatus ?? null,
    input.confidenceLevel ?? null
  )
}

export async function overrideEnrolleeZCodes(
  enrollmentId: string,
  input: EnrolleeZCodeOverrideInput
): Promise<EnrolleeZCodeOverrideResult | null> {
  // No local persistence exists for the active code set, so do not fabricate a persisted result.
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return null
  const result = await persistEnrolleeZCodeOverride(supabase, enrollmentId, {
    checkedZCodes: input.checkedZCodes,
    uncheckReasons: input.uncheckReasons.map((reason) => ({
      zCode: reason.zCode,
      reasonCode: reason.reasonCode,
      reasonText: reason.reasonText ?? null
    }))
  })
  return {
    enrollmentId: result.enrollmentId,
    zCodeTags: result.zCodeTags,
    activeZCodeDetails: result.activeZCodeDetails
  }
}
