import {
  SERVICE_CAPACITY_FORM_VERSION,
  ZCODE_DOMAIN_SCALE_GUIDE,
  ZCODE_DOMAIN_SCORE_RANGE,
  ZCODE_DOMAIN_SURVEY_FORM_VERSION,
  describeZCodeDomainSpectrumScore
} from '../../data/serviceCapacitySurveyCatalog'
import type {
  PartnerIdentifierRecord,
  PartnerServiceCapacityHeader,
  PartnerServiceCapacityScaleOption,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord
} from '../../types'
import type { PartnerMyStationDebutRequirement } from '../../data-access/partnerMyStationDebut'

export interface ServiceCapacitySurveyPanelProps {
  submissionHistory: PartnerServiceCapacitySubmissionRecord[]
  defaultHeader: PartnerServiceCapacityHeader
  isSaving: boolean
  saveError: string | null
  onBackToWorkspace?: () => void
  onSearchPartnerIdentifiers: (firstName: string, lastName: string) => Promise<PartnerIdentifierRecord[]>
  onEnsurePartnerIdentifier: (header: {
    firstName: string
    lastName: string
    organizationName: string
    email?: string | null
  }) => Promise<PartnerIdentifierRecord>
  onSubmit: (
    payload: PartnerServiceCapacitySubmissionInput
  ) => Promise<PartnerServiceCapacitySubmissionRecord | void> | PartnerServiceCapacitySubmissionRecord | void
  onDeleteDraft: (
    submissionId: string
  ) => Promise<{ id: string; draftKey: string } | void> | { id: string; draftKey: string } | void
  surveyVariant?: 'burden' | 'domainSpectrum'
  /** Optional My Station commissioning checklist shown on the burden history surface. */
  myStationDebutRequirements?: PartnerMyStationDebutRequirement[] | null
  canDebutMyStation?: boolean
}

export interface SurveyCardConfig {
  formVersion: string
  scale: PartnerServiceCapacityScaleOption[] | null
  scoreRange: { min: number; max: number; step?: number } | null
  historyKicker: string
  historyTitle: string
  historyDescription: string
  historyStartButtonLabel: string
  panelTitle: string
  panelSubtitle: string
  promptQuestion: string
  assignmentLabel: string
  unansweredHint: string
  inputControl: 'slider' | 'knob'
  requireEmail: boolean
  requireOrganizationName: boolean
  requireRespondentRoles: boolean
  enablePartnerIdentifierLookup: boolean
  describeScore?: (score: number) => { value: number; label: string; description: string }
}

const BURDEN_SURVEY_CONFIG: SurveyCardConfig = {
  formVersion: SERVICE_CAPACITY_FORM_VERSION,
  scale: null,
  scoreRange: null,
  historyKicker: 'partner service capacity',
  historyTitle: 'Service capacity survey history',
  historyDescription:
    'Past service capacity submissions and drafts stay here. Open a draft to keep editing; completed runs stay read-only. Start a new survey only when you need a fresh assessment.',
  historyStartButtonLabel: 'Start a new service capacity survey',
  panelTitle: 'Z-code burden survey',
  panelSubtitle: 'Capture how well your organization can handle each Z-code pressure area on a 1-9 burden scale.',
  promptQuestion: 'Is this handled as a core specialty or is it a burden to have to handle it?',
  assignmentLabel: 'assign a burden score',
  unansweredHint: 'Select a value from 1 to 9 by dragging, clicking, or typing.',
  inputControl: 'slider',
  requireEmail: false,
  requireOrganizationName: true,
  requireRespondentRoles: true,
  enablePartnerIdentifierLookup: true
}

const DOMAIN_SPECTRUM_SURVEY_CONFIG: SurveyCardConfig = {
  formVersion: ZCODE_DOMAIN_SURVEY_FORM_VERSION,
  scale: ZCODE_DOMAIN_SCALE_GUIDE,
  scoreRange: ZCODE_DOMAIN_SCORE_RANGE,
  historyKicker: 'z code domain survey',
  historyTitle: 'Domain spectrum survey history',
  historyDescription:
    'Past domain spectrum submissions and drafts stay here. Open a draft to keep editing; completed runs stay read-only. Start a new survey only when you need a fresh assessment.',
  historyStartButtonLabel: 'Start a new domain spectrum survey',
  panelTitle: 'Z-code to domain spectrum survey',
  panelSubtitle: 'Rate each Z-code on a 1-99 domain spectrum to drive habitat, social networks, and work radial positioning.',
  promptQuestion: 'Where should this Z-code sit on the 1-99 habitat-social-work-habitat spectrum?',
  assignmentLabel: 'assign a domain spectrum value',
  unansweredHint: 'Select a value from 1 to 99 by dragging, clicking, or typing.',
  inputControl: 'knob',
  requireEmail: true,
  requireOrganizationName: false,
  requireRespondentRoles: false,
  enablePartnerIdentifierLookup: false,
  describeScore: describeZCodeDomainSpectrumScore
}

export function getSurveyCardConfig(variant: NonNullable<ServiceCapacitySurveyPanelProps['surveyVariant']>) {
  return variant === 'domainSpectrum' ? DOMAIN_SPECTRUM_SURVEY_CONFIG : BURDEN_SURVEY_CONFIG
}

export function getRespondentValidationMessage(header: PartnerServiceCapacityHeader, surveyConfig: SurveyCardConfig) {
  if (!header.firstName.trim() || !header.lastName.trim()) {
    return 'Complete the required respondent details before submitting the survey.'
  }
  if (surveyConfig.requireEmail && !header.email.trim()) {
    return 'Add your email address before submitting the survey.'
  }
  if (surveyConfig.requireOrganizationName && !header.organizationName.trim()) {
    return 'Complete the required respondent details before submitting the survey.'
  }
  if (surveyConfig.requireRespondentRoles && !header.respondentRoles.length) {
    return 'Complete the required respondent details before submitting the survey.'
  }
  if (header.respondentRoles.includes('other') && !header.otherRoleText.trim()) {
    return 'Add the role description for “Other” before submitting the survey.'
  }
  return null
}
