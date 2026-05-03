import type { NavigatorProgramState, PartnerReferralSubmissionInput, UnassignedEnrolleePickupRecord } from './types'

interface ReferralContext {
  accountFullName: string
  accountOrganization: string
  partnerStationOrganizationName: string | null
  actorRoleLabel?: string | null
  sourceLabel?: string | null
}

interface ReferralQueueBuildResult {
  nextRecord: UnassignedEnrolleePickupRecord
  nextState: NavigatorProgramState
}

export interface PartnerInquirySubmissionInput {
  contactName: string
  organizationName: string
  contactEmail: string
  contactPhone: string
  backgroundNotes: string
}

function createPickupCaseId() {
  return `atlas-intake-${Date.now().toString(36)}`
}

/**
 * Pure utility for mapping partner referral form input into the navigator
 * pickup-queue record contract. Extracted to keep User Interface (UI) hook orchestration focused
 * on state transitions instead of field normalization details.
 */
export function buildReferralQueueUpdate(
  input: PartnerReferralSubmissionInput,
  currentState: NavigatorProgramState,
  context: ReferralContext
): ReferralQueueBuildResult {
  const submittedAtIso = new Date().toISOString()
  const partnerOrganizationName =
    input.partnerOrganizationName.trim() ||
    context.partnerStationOrganizationName?.trim() ||
    context.accountOrganization.trim() ||
    'community partner'
  const referrerName = input.selfReferring
    ? 'self referral'
    : input.referrerName.trim() || context.accountFullName.trim() || 'partner referral'
  const partnerContactSummary = !input.existingPartner
    ? [input.partnerContactName.trim(), input.partnerContactEmail.trim(), input.partnerContactPhone.trim()]
        .filter(Boolean)
        .join(' · ')
    : ''
  const backgroundNotes = input.backgroundNotes.trim()
  const situationSummary = input.situationCategories.map((value) => value.trim()).filter(Boolean).join(', ')
  const referralMessage = [
    context.actorRoleLabel ? `submitted by ${context.actorRoleLabel}` : '',
    situationSummary ? `situation categories: ${situationSummary}` : '',
    backgroundNotes ? `background notes: ${backgroundNotes}` : '',
    !input.existingPartner && partnerContactSummary ? `new partner contact: ${partnerContactSummary}` : '',
    context.sourceLabel || ''
  ]
    .filter(Boolean)
    .join(' | ')

  const nextRecord: UnassignedEnrolleePickupRecord = {
    id: `pickup-referral-${Date.now().toString(36)}`,
    fullName: input.referredParticipantName.trim(),
    dob: '',
    caseId: createPickupCaseId(),
    email: input.participantEmail.trim(),
    phone: input.participantPhone.trim(),
    demographicsSummary: input.existingPartner
      ? 'Referred by an existing partner profile.'
      : 'Referred by a new partner profile captured during intake.',
    referredAtIso: submittedAtIso,
    referrerName,
    referrerOrganization: partnerOrganizationName,
    backgroundNotes,
    referrerMessage: referralMessage || 'Referral submitted through partner referral workflow.',
    zCodeTags: [],
    status: 'available',
    claimedByNavigatorName: null,
    claimedAtIso: null
  }

  return {
    nextRecord,
    nextState: {
      ...currentState,
      pickupQueue: [nextRecord, ...currentState.pickupQueue.filter((record) => record.id !== nextRecord.id)]
    }
  }
}

/**
 * Maps public partner inquiry submissions into the shared navigator queue
 * contract so supervisors/navigators can triage outreach in one place.
 */
export function buildPartnerInquiryQueueUpdate(
  input: PartnerInquirySubmissionInput,
  currentState: NavigatorProgramState,
  context: ReferralContext
): ReferralQueueBuildResult {
  const submittedAtIso = new Date().toISOString()
  const contactName = input.contactName.trim() || 'partner inquiry contact'
  const organizationName =
    input.organizationName.trim() || context.partnerStationOrganizationName?.trim() || context.accountOrganization.trim() || 'community partner'
  const contactLines = [input.contactEmail.trim(), input.contactPhone.trim()].filter(Boolean).join(' · ')
  const backgroundNotes = input.backgroundNotes.trim()
  const nextRecord: UnassignedEnrolleePickupRecord = {
    id: `pickup-inquiry-${Date.now().toString(36)}`,
    fullName: contactName,
    dob: '',
    caseId: createPickupCaseId(),
    email: input.contactEmail.trim(),
    phone: input.contactPhone.trim(),
    demographicsSummary: 'Partner outreach inquiry from public landing page.',
    referredAtIso: submittedAtIso,
    referrerName: contactName,
    referrerOrganization: organizationName,
    backgroundNotes,
    referrerMessage: [context.actorRoleLabel ? `submitted by ${context.actorRoleLabel}` : '', backgroundNotes ? `background notes: ${backgroundNotes}` : '', contactLines, context.sourceLabel || 'public partner inquiry']
      .filter(Boolean)
      .join(' | '),
    zCodeTags: [],
    status: 'available',
    claimedByNavigatorName: null,
    claimedAtIso: null
  }
  return {
    nextRecord,
    nextState: {
      ...currentState,
      pickupQueue: [nextRecord, ...currentState.pickupQueue.filter((record) => record.id !== nextRecord.id)]
    }
  }
}
