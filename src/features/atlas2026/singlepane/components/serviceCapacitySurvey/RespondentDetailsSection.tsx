import React from 'react'
import { AtlasTextButton } from '../../../components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type {
  PartnerIdentifierRecord,
  PartnerServiceCapacityHeader,
  PartnerSurveyRespondentRole
} from '../../types'
import type { SurveyCardConfig } from './config'
import { Field, Input } from './SurveyChrome'

const ROLE_OPTIONS: Array<{ value: PartnerSurveyRespondentRole; label: string }> = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'direct_service_provider', label: 'Direct Service Provider' },
  { value: 'other', label: 'Other' }
]

interface RespondentDetailsSectionProps {
  header: PartnerServiceCapacityHeader
  surveyConfig: SurveyCardConfig
  firstNameInputRef: React.Ref<HTMLInputElement>
  partnerIdentifierMatches: PartnerIdentifierRecord[]
  partnerIdentifierError: string | null
  isSearchingPartnerIdentifiers: boolean
  isEnsuringPartnerIdentifier: boolean
  selectedPartnerIdentifierId: string | null
  onUpdateHeader: <K extends keyof PartnerServiceCapacityHeader>(
    key: K,
    value: PartnerServiceCapacityHeader[K]
  ) => void
  onApplyPartnerIdentifierMatch: (match: PartnerIdentifierRecord) => void
}

export function RespondentDetailsSection({
  header,
  surveyConfig,
  firstNameInputRef,
  partnerIdentifierMatches,
  partnerIdentifierError,
  isSearchingPartnerIdentifiers,
  isEnsuringPartnerIdentifier,
  selectedPartnerIdentifierId,
  onUpdateHeader,
  onApplyPartnerIdentifierMatch
}: RespondentDetailsSectionProps) {
  function toggleRole(role: PartnerSurveyRespondentRole) {
    const nextRoles = header.respondentRoles.includes(role)
      ? header.respondentRoles.filter((item) => item !== role)
      : [...header.respondentRoles, role]
    onUpdateHeader('respondentRoles', nextRoles)
    if (role === 'other' && !nextRoles.includes('other')) onUpdateHeader('otherRoleText', '')
  }

  return (
    <section className="atlas-surface-raised p-4">
      <small className="atlas-overline mb-3 block text-[#bdbdbd] md:text-[14px]">your details</small>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Field label="Your Name*" requiredHint="This field is required.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={header.firstName}
                placeholder="first name"
                onChange={(value) => onUpdateHeader('firstName', value)}
                inputRef={firstNameInputRef}
              />
              <Input
                value={header.lastName}
                placeholder="last name"
                onChange={(value) => onUpdateHeader('lastName', value)}
              />
            </div>
            {surveyConfig.enablePartnerIdentifierLookup && header.firstName.trim() && header.lastName.trim() ? (
              <div
                className="mt-3 rounded-[12px] border px-3 py-3"
                style={{ borderColor: '#ffffff18', backgroundColor: 'var(--surface-panel-raised)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <small className="text-[11px] uppercase tracking-[0.12em]" style={{ color: SP_COLORS.muted }}>
                    checking our system
                  </small>
                  <small className="text-[11px]" style={{ color: SP_COLORS.muted }}>
                    {isSearchingPartnerIdentifiers || isEnsuringPartnerIdentifier
                      ? 'checking...'
                      : selectedPartnerIdentifierId
                        ? 'linked'
                        : `${partnerIdentifierMatches.length} found`}
                  </small>
                </div>
                {partnerIdentifierError ? (
                  <small className="mt-2 block text-[12px]" style={{ color: SP_COLORS.red }}>
                    {partnerIdentifierError}
                  </small>
                ) : null}
                {!selectedPartnerIdentifierId && partnerIdentifierMatches.length ? (
                  <div className="mt-3 space-y-2">
                    <small className="block text-[12px] text-[#bdbdbd]">
                      Choose an existing partner identifier if this person already exists in the partners tab.
                    </small>
                    {partnerIdentifierMatches.map((match) => (
                      <AtlasTextButton
                        key={match.partnerId}
                        onClick={() => onApplyPartnerIdentifierMatch(match)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
                        style={{ ['--button-border-color' as const]: '#ffffff20' } as React.CSSProperties}
                      >
                        <div>
                          <div className="text-[13px] text-white md:text-[14px]">
                            {match.firstName} {match.lastName}
                          </div>
                          <small className="block text-[12px] text-[#bdbdbd]">{match.organizationName}</small>
                        </div>
                        <small className="max-w-[220px] text-right text-[11px] text-[#9f9f9f] md:text-[12px]">
                          {match.email || 'no email on file'}
                        </small>
                      </AtlasTextButton>
                    ))}
                  </div>
                ) : selectedPartnerIdentifierId ? (
                  <small className="mt-2 block text-[12px] text-[#bdbdbd]">
                    Existing partner identifier selected. Editing respondent details clears the match.
                  </small>
                ) : null}
              </div>
            ) : null}
          </Field>
        </div>
        <Field
          label={surveyConfig.requireOrganizationName ? 'The Name of Your Organization*' : 'The Name of Your Organization'}
          requiredHint={surveyConfig.requireOrganizationName ? 'This field is required.' : undefined}
        >
          <Input
            value={header.organizationName}
            placeholder="organization name"
            onChange={(value) => onUpdateHeader('organizationName', value)}
          />
        </Field>
        <Field
          label={surveyConfig.requireEmail ? 'Your Email Address*' : 'Your Email Address'}
          requiredHint={surveyConfig.requireEmail ? 'This field is required.' : undefined}
        >
          <Input value={header.email} placeholder="email address" onChange={(value) => onUpdateHeader('email', value)} />
        </Field>
        <Field label="Your Job Title">
          <Input value={header.jobTitle} placeholder="job title" onChange={(value) => onUpdateHeader('jobTitle', value)} />
        </Field>
        <div className="lg:col-span-2">
          <Field
            label={surveyConfig.requireRespondentRoles
              ? 'Please select the option/s that apply to you*'
              : 'Please select the option/s that apply to you'}
            requiredHint={surveyConfig.requireRespondentRoles ? 'This field is required.' : undefined}
          >
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((option) => {
                const isSelected = header.respondentRoles.includes(option.value)
                return (
                  <AtlasTextButton
                    key={option.value}
                    onClick={() => toggleRole(option.value)}
                    className="px-[14px] py-[7px] text-[14px] md:text-[16px]"
                    style={{
                      ['--button-border-color' as const]: isSelected ? SP_COLORS.yellow : '#ffffff30',
                      color: isSelected ? SP_COLORS.yellow : SP_COLORS.white
                    } as React.CSSProperties}
                  >
                    {option.label}
                  </AtlasTextButton>
                )
              })}
            </div>
            {header.respondentRoles.includes('other') ? (
              <div className="mt-3">
                <Input
                  value={header.otherRoleText}
                  placeholder="tell us your role"
                  onChange={(value) => onUpdateHeader('otherRoleText', value)}
                />
              </div>
            ) : null}
          </Field>
        </div>
      </div>
      <small className="mt-4 block text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
        Fill in who is responding, then scroll to the questions. Required fields are enforced when you submit.
      </small>
    </section>
  )
}
