import { useState, type Dispatch, type SetStateAction } from 'react'
import type {
  AccountSettings,
  AtlasRole,
  EnrolleeProfile,
  PartnerStationProfile
} from '@/features/atlas2026/shared/contracts'
import {
  loadPartnerStationProfile,
  saveAccountSettings,
  uploadAccountProfileImage,
  uploadEnrolleeProfileImage
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import type { SinglePaneBootstrapState } from '@/features/atlas2026/singlepane/hooks/useSinglePaneBootstrapState'
import { compressImageToDataUrl } from '@/features/atlas2026/singlepane/domain/loadsRoutes'

interface ProfileImageUploadsInput {
  remoteSessionActive: boolean
  accountSettings: AccountSettings
  viewerRole: AtlasRole
  partnerStationProfile: PartnerStationProfile | null
  selectedEnrollee: EnrolleeProfile | null
  setBootstrapState: Dispatch<SetStateAction<SinglePaneBootstrapState>>
  ensureEnrolleeImageWriteAllowed: () => void
}

/**
 * Coordinates optimistic image previews with durable account/enrollee storage updates.
 * Object URLs are always revoked after persistence or rollback to avoid browser memory leaks.
 */
export function useProfileImageUploads({
  remoteSessionActive,
  accountSettings,
  viewerRole,
  partnerStationProfile,
  selectedEnrollee,
  setBootstrapState,
  ensureEnrolleeImageWriteAllowed
}: ProfileImageUploadsInput) {
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false)
  const [profileImageUploadError, setProfileImageUploadError] = useState<string | null>(null)
  const [isUploadingAccountProfileImage, setIsUploadingAccountProfileImage] = useState(false)
  const [accountProfileImageUploadError, setAccountProfileImageUploadError] = useState<string | null>(null)

  async function replaceAccountProfileImage(file: File) {
    if (remoteSessionActive) {
      throw new Error('Exit troubleshooting mode before editing account settings.')
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file.')
    }

    const previewUrl = URL.createObjectURL(file)
    const previousAvatarUrl = accountSettings.avatarUrl || null
    setIsUploadingAccountProfileImage(true)
    setAccountProfileImageUploadError(null)
    setBootstrapState((current) => ({
      ...current,
      accountSettings: { ...current.accountSettings, avatarUrl: previewUrl }
    }))

    try {
      // Prefer Storage-backed URLs; only authentication/configuration gaps may use
      // the compressed local data URL compatibility path.
      let avatarUrl: string
      try {
        const uploaded = await uploadAccountProfileImage(file)
        avatarUrl = uploaded.avatarUrl
      } catch (storageError) {
        const storageMessage = storageError instanceof Error ? storageError.message : ''
        const canUseLocalFallback =
          /sign in is required|supabase is required/i.test(storageMessage) ||
          storageMessage.toLowerCase().includes('auth session missing')
        if (!canUseLocalFallback) throw storageError
        avatarUrl = await compressImageToDataUrl(file)
      }

      const saved = await saveAccountSettings({ ...accountSettings, avatarUrl })
      // Navigator station identity remains anchored to its linked organization rather
      // than being re-pointed by an account avatar update.
      const stationOrganizationName =
        viewerRole === 'navigator'
          ? partnerStationProfile?.organizationName?.trim() || saved.organization
          : saved.organization
      const stationProfile = await loadPartnerStationProfile(stationOrganizationName, {
        fullName: saved.fullName,
        email: saved.email
      })
      setBootstrapState((current) => ({
        ...current,
        accountSettings: saved,
        partnerStationProfile: stationProfile
      }))
      return { avatarUrl }
    } catch (error) {
      setBootstrapState((current) => ({
        ...current,
        accountSettings: { ...current.accountSettings, avatarUrl: previousAvatarUrl }
      }))
      setAccountProfileImageUploadError(error instanceof Error ? error.message : 'Unable to upload profile image.')
      throw error
    } finally {
      URL.revokeObjectURL(previewUrl)
      setIsUploadingAccountProfileImage(false)
    }
  }

  async function replaceSelectedEnrolleeProfileImage(file: File) {
    ensureEnrolleeImageWriteAllowed()
    if (!selectedEnrollee) {
      throw new Error('Select an enrollee profile before uploading an image.')
    }

    const previewUrl = URL.createObjectURL(file)
    const previousAvatarUrl = selectedEnrollee.avatarUrl || null
    setIsUploadingProfileImage(true)
    setProfileImageUploadError(null)
    setBootstrapState((current) => ({
      ...current,
      enrollees: current.enrollees.map((enrollee) =>
        enrollee.id === selectedEnrollee.id ? { ...enrollee, avatarUrl: previewUrl } : enrollee
      )
    }))

    try {
      const uploaded = await uploadEnrolleeProfileImage(selectedEnrollee.id, file)
      setBootstrapState((current) => ({
        ...current,
        enrollees: current.enrollees.map((enrollee) =>
          enrollee.id === selectedEnrollee.id ? { ...enrollee, avatarUrl: uploaded.avatarUrl } : enrollee
        )
      }))
      return uploaded
    } catch (error) {
      setBootstrapState((current) => ({
        ...current,
        enrollees: current.enrollees.map((enrollee) =>
          enrollee.id === selectedEnrollee.id ? { ...enrollee, avatarUrl: previousAvatarUrl || undefined } : enrollee
        )
      }))
      setProfileImageUploadError(error instanceof Error ? error.message : 'Unable to upload profile image.')
      throw error
    } finally {
      URL.revokeObjectURL(previewUrl)
      setIsUploadingProfileImage(false)
    }
  }

  return {
    isUploadingProfileImage,
    profileImageUploadError,
    isUploadingAccountProfileImage,
    accountProfileImageUploadError,
    replaceAccountProfileImage,
    replaceSelectedEnrolleeProfileImage
  }
}
