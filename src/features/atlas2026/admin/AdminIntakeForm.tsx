import React, { useEffect, useState } from 'react'
import type { EnrolleeIntakeRecord } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

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
      <section className="rounded-xl border p-3" style={{ borderColor: '#ffffff3a' }}>
        <small className="text-[12px] text-[#d4d4d4]">Select an enrollee to open the intake form.</small>
      </section>
    )
  }

  function handleSave() {
    onSave({
      ...draft,
      zCodeTags: draft.zCodeTags.map((tag) => tag.toLowerCase()).filter(Boolean)
    })
  }

  return (
    <section className="rounded-xl border p-3" style={{ borderColor: '#ffffff3a' }}>
      <div className="mb-3">
        <small className="block text-[12px] font-semibold text-white">onboarding intake</small>
        <small className="text-[12px] text-[#bbbbbb]">
          Enrollment start saved here becomes the timeline source of truth for the selected enrollee.
        </small>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="full name">
          <input
            value={draft.fullName}
            onChange={(event) => setDraft((current) => (current ? { ...current, fullName: event.target.value } : current))}
            className="mt-1.5 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
            style={{ borderColor: '#ffffff30' }}
          />
        </Field>
        <Field label="date of birth">
          <input
            value={draft.dob}
            onChange={(event) => setDraft((current) => (current ? { ...current, dob: event.target.value } : current))}
            className="mt-1.5 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
            style={{ borderColor: '#ffffff30' }}
          />
        </Field>
        <Field label="case id">
          <input
            value={draft.caseId}
            onChange={(event) => setDraft((current) => (current ? { ...current, caseId: event.target.value } : current))}
            className="mt-1.5 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
            style={{ borderColor: '#ffffff30' }}
          />
        </Field>
        <Field label="email">
          <input
            value={draft.email}
            onChange={(event) => setDraft((current) => (current ? { ...current, email: event.target.value } : current))}
            className="mt-1.5 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
            style={{ borderColor: '#ffffff30' }}
          />
        </Field>
        <Field label="assigned navigator">
          <input
            value={draft.assignedNavigator}
            onChange={(event) =>
              setDraft((current) => (current ? { ...current, assignedNavigator: event.target.value } : current))
            }
            className="mt-1.5 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
            style={{ borderColor: '#ffffff30' }}
          />
        </Field>
        <Field label="enrollment start">
          <input
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
            className="mt-1.5 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
            style={{ borderColor: '#ffffff30' }}
          />
        </Field>
      </div>

      <Field label="z-codes" className="mt-3">
        <input
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
          className="mt-1.5 w-full rounded-xl border bg-black px-3 py-2 text-[13px] text-white"
          style={{ borderColor: '#ffffff30' }}
        />
      </Field>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full border px-4 py-2 text-[12px] font-medium text-white"
          style={{ borderColor: SP_COLORS.white }}
        >
          save intake
        </button>
      </div>
    </section>
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
