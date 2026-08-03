import { useState } from 'react'
import type { RouteCandidateRecord } from '../types'

export interface ResolutionOverlayState {
  source: 'route-board' | 'page-zcode'
  candidate: RouteCandidateRecord | null
  filterParentCode?: string | null
  filterChildCodes?: string[]
}

// Centralize mutually independent overlay destinations so the workspace composer
// has one routing contract instead of accumulating modal-specific state declarations.
export function useWorkspaceOverlayRouter<TSpecialtyGroup>() {
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false)
  const [isRoutePlanningOpen, setIsRoutePlanningOpen] = useState(false)
  const [isRegulationTestsOpen, setIsRegulationTestsOpen] = useState(false)
  const [assessmentInitialTestType, setAssessmentInitialTestType] = useState<
    'mh_sca' | 'svs' | 'ipf' | 'b_ipf' | null
  >(null)
  const [isLoadTableOpen, setIsLoadTableOpen] = useState(false)
  const [isReferralPortalOpen, setIsReferralPortalOpen] = useState(false)
  const [isNavigatorAssignmentReferralOpen, setIsNavigatorAssignmentReferralOpen] = useState(false)
  const [isPartnerHistoryOpen, setIsPartnerHistoryOpen] = useState(false)
  const [enrolleeSurveyTargetId, setEnrolleeSurveyTargetId] = useState<string | null>(null)
  const [requestedAdminDomainSurveyZCode, setRequestedAdminDomainSurveyZCode] = useState<string | null>(null)
  const [selectedRouteCandidateId, setSelectedRouteCandidateId] = useState<string | null>(null)
  const [resolutionOverlayState, setResolutionOverlayState] = useState<ResolutionOverlayState | null>(null)
  const [selectedPartnerSpecialtyGroup, setSelectedPartnerSpecialtyGroup] = useState<TSpecialtyGroup | null>(null)

  return {
    isAccountSettingsOpen,
    setIsAccountSettingsOpen,
    isRoutePlanningOpen,
    setIsRoutePlanningOpen,
    isRegulationTestsOpen,
    setIsRegulationTestsOpen,
    assessmentInitialTestType,
    setAssessmentInitialTestType,
    isLoadTableOpen,
    setIsLoadTableOpen,
    isReferralPortalOpen,
    setIsReferralPortalOpen,
    isNavigatorAssignmentReferralOpen,
    setIsNavigatorAssignmentReferralOpen,
    isPartnerHistoryOpen,
    setIsPartnerHistoryOpen,
    enrolleeSurveyTargetId,
    setEnrolleeSurveyTargetId,
    requestedAdminDomainSurveyZCode,
    setRequestedAdminDomainSurveyZCode,
    selectedRouteCandidateId,
    setSelectedRouteCandidateId,
    resolutionOverlayState,
    setResolutionOverlayState,
    selectedPartnerSpecialtyGroup,
    setSelectedPartnerSpecialtyGroup
  }
}
