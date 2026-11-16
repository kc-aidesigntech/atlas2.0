import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import NavigatorMyProfilePanel, { type NavigatorMyProfilePanelProps } from '../NavigatorMyProfilePanel'
import SupervisorNavigatorClaims from '../supervisorProfile/SupervisorNavigatorClaims'

interface WalletAssignmentsOverlayProps {
  /** `enrollee_profile.write`: prints the enrollee claim circles and the weekly regulation review badge. */
  showEnrollees: boolean
  /** `supervision.give`: prints the navigator claim circles. */
  showNavigators: boolean
  navigator: NavigatorMyProfilePanelProps
  onClose: () => void
}

/**
 * The overlay the plus button beside the person circles opens. It holds the
 * claim surfaces My Wallet printed in its body before the two-column layout:
 * the enrollee claim circles and the navigator claim circles.
 */
export default function WalletAssignmentsOverlay({ showEnrollees, showNavigators, navigator, onClose }: WalletAssignmentsOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Assignments"
    >
      <div className="atlas-surface-panel max-h-[90vh] w-full max-w-[980px] overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[18px] font-medium text-white">assignments</div>
          <AtlasTextButton onClick={onClose} className="px-3 py-1 text-[12px]">
            close
          </AtlasTextButton>
        </div>
        <div className="flex flex-col gap-4">
          {showEnrollees ? <NavigatorMyProfilePanel {...navigator} /> : null}
          {showNavigators ? <SupervisorNavigatorClaims /> : null}
        </div>
      </div>
    </div>
  )
}
