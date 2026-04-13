import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AtlasInsetCard } from '@/features/atlas2026/components/AtlasPrimitives'
import type { EnrolleeIntakeRecord } from '@/features/atlas2026/singlepane/types'

interface AdminIntakeFormProps {
  intake: EnrolleeIntakeRecord | null
  onSave: (intake: EnrolleeIntakeRecord) => void
}

export default function AdminIntakeForm({ intake, onSave }: AdminIntakeFormProps) {
  const [draft, setDraft] = useState<EnrolleeIntakeRecord | null>(intake)

  useEffect(() => {
    setDraft(intake)
  }, [intake])

  if (!draft) {
    return (
      <AtlasInsetCard>
        <small className="text-[12px] text-[#d4d4d4]">Select an enrollee to open the intake form.</small>
      </AtlasInsetCard>
    )
  }

  function handleSave() {
    onSave({
      ...draft,
      zCodeTags: draft.zCodeTags.map((tag) => tag.toLowerCase()).filter(Boolean)
    })
  }

  return (
    <AtlasInsetCard>
      <div className="mb-3">
        <small className="block text-[12px] font-semibold text-white">onboarding intake</small>
        <small className="text-[12px] text-[#bbbbbb]">
          Enrollment start saved here becomes the timeline source of truth for the selected enrollee.
        </small>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="full name">
          <Input
            value={draft.fullName}
            onChange={(event) => setDraft((current) => (current ? { ...current, fullName: event.target.value } : current))}
            className="mt-1.5 text-[13px]"
          />
        </Field>
        <Field label="date of birth">
          <Input
            value={draft.dob}
            onChange={(event) => setDraft((current) => (current ? { ...current, dob: event.target.value } : current))}
            className="mt-1.5 text-[13px]"
          />
        </Field>
        <Field label="case id">
          <Input
            value={draft.caseId}
            onChange={(event) => setDraft((current) => (current ? { ...current, caseId: event.target.value } : current))}
            className="mt-1.5 text-[13px]"
          />
        </Field>
        <Field label="email">
          <Input
            value={draft.email}
            onChange={(event) => setDraft((current) => (current ? { ...current, email: event.target.value } : current))}
            className="mt-1.5 text-[13px]"
          />
        </Field>
        <Field label="assigned navigator">
          <Input
            value={draft.assignedNavigator}
            onChange={(event) =>
              setDraft((current) => (current ? { ...current, assignedNavigator: event.target.value } : current))
            }
            className="mt-1.5 text-[13px]"
          />
        </Field>
        <Field label="enrollment start">
          <Input
            type="date"
            value={draft.enrollmentStartIso.slice(0, 10)}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      enrollmentStartIso: `${event.target.value || '2026-03-01'}T00:00:00.000Z`
                    }
                  : current
              )
            }
            className="mt-1.5 text-[13px]"
          />
        </Field>
      </div>

      <Field label="z-codes" className="mt-3">
        <Input
          value={draft.zCodeTags.join(', ')}
          onChange={(event) =>
            setDraft((current) =>
              current
                ? {
                    ...current,
                    zCodeTags: event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean)
                  }
                : current
            )
          }
          className="mt-1.5 text-[13px]"
        />
      </Field>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          onClick={handleSave}
          className="border-white/30 bg-transparent px-4 py-2 text-[12px] font-medium text-white hover:bg-white/5"
        >
          save intake
        </Button>
      </div>
    </AtlasInsetCard>
  )
}

function Field({
  children,
  label,
  className = ''
}: {
  children: React.ReactNode
  label: string
  className?: string
}) {
  return (
    <label className={`block text-[12px] text-[#d4d4d4] ${className}`}>
      {label}
      {children}
    </label>
  )
}
