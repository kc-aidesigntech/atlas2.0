import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import CreateSessionDesk from '../CreateSessionDesk'
import {
  NavigatorCreateHistorySection,
  NavigatorIpsccFeedbackSection,
  NavigatorSelfAwarenessSection
} from '../navigatorProfile/NavigatorProfilePrimarySections'
import { NAVIGATOR_PROFILE_CARDS, type NavigatorProfileOverlayKey } from '../navigatorProfile/model'
import type { NavigatorMyProfilePanelProps } from '../navigatorProfile/NavigatorProfileExperience'

interface NavigatorCardOverlayProps {
  /** The card whose form the overlay holds. */
  activeOverlay: NavigatorProfileOverlayKey
  navigator: NavigatorMyProfilePanelProps
  onClose: () => void
}

/**
 * The overlay a My Wallet card opens: the Intentional Peer Support Core
 * Competencies (IPSCC) enrollee survey, the self-reflection form, or the
 * supervisor Connect, Recognize, Encourage, Acknowledge, Train, and Empower
 * (C.R.E.A.T.E.) session desk with its history.
 */
export default function NavigatorCardOverlay({ activeOverlay, navigator, onClose }: NavigatorCardOverlayProps) {
  const {
    currentNavigatorName,
    assignedEnrollees,
    ipsccEnrolleeFeedbackPrivacy,
    selfAwarenessCorrelationRows,
    selfAwarenessSummary,
    ipsSelfAssessments,
    navigatorSupervisorIpsAssessments,
    createSessions,
    createReflection,
    onSaveIpsSelfAssessment,
    onSaveIpsccEncounterSubmission,
    onSaveCreateSession
  } = navigator

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="atlas-surface-panel max-h-[90vh] w-full max-w-[980px] overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[18px] font-medium text-white">
            {NAVIGATOR_PROFILE_CARDS.find((card) => card.overlayId === activeOverlay)?.title || 'section'}
          </div>
          <AtlasTextButton onClick={onClose} className="px-3 py-1 text-[12px]">
            close
          </AtlasTextButton>
        </div>
        {activeOverlay === 'section_1_ipscc' ? (
          <NavigatorIpsccFeedbackSection
            assignedEnrollees={assignedEnrollees}
            currentNavigatorName={currentNavigatorName}
            privacy={ipsccEnrolleeFeedbackPrivacy}
            onSave={onSaveIpsccEncounterSubmission}
          />
        ) : null}
        {activeOverlay === 'section_2_awareness' ? (
          <NavigatorSelfAwarenessSection
            currentNavigatorName={currentNavigatorName}
            assessments={ipsSelfAssessments}
            supervisorAssessments={navigatorSupervisorIpsAssessments}
            correlationRows={selfAwarenessCorrelationRows}
            summary={selfAwarenessSummary}
            privacy={ipsccEnrolleeFeedbackPrivacy}
            onSave={onSaveIpsSelfAssessment}
          />
        ) : null}
        {activeOverlay === 'section_3_create' ? (
          <div className="space-y-3">
            {/* Current reflection travels with session history so Section 3 stays off chrome. */}
            <div className="atlas-surface-raised space-y-2 px-3 py-3 text-[12px] text-white">
              <div>
                <small className="atlas-overline block text-[#9eacb9]">section 3 · what is being workshopped</small>
                <div className="mt-0.5 text-[14px] font-medium text-white">C.R.E.A.T.E. supervision reflection</div>
              </div>
              {createReflection?.reflectionText?.trim() ? (
                <div className="rounded-[10px] border border-white/10 px-2.5 py-2">
                  <p className="whitespace-pre-wrap leading-relaxed text-[#d7e0e9]">
                    {createReflection.reflectionText.trim()}
                  </p>
                  <small className="atlas-meta mt-2 block text-[#9eacb9]">
                    Updated after latest C.R.E.A.T.E. · based on last{' '}
                    {createReflection.sourceSessionIds?.length || 1} session
                    {(createReflection.sourceSessionIds?.length || 1) === 1 ? '' : 's'}
                    {createReflection.supervisorOverriddenAtIso
                      ? ` · edited by ${createReflection.supervisorOverriddenBy || 'supervisor'}`
                      : createReflection.usedFallback
                        ? ' · offline summary'
                        : ''}
                  </small>
                </div>
              ) : (
                <div className="text-[#9eacb9]">
                  No C.R.E.A.T.E. reflection yet. A supervisor reflection appears after the first saved supervision
                  session.
                </div>
              )}
            </div>
            <CreateSessionDesk
              role="navigator"
              selfName={currentNavigatorName}
              counterparts={[]}
              sessions={createSessions}
              onSave={onSaveCreateSession}
            />
            <NavigatorCreateHistorySection sessions={createSessions} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
