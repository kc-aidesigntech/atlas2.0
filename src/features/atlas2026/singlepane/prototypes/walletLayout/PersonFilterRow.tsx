/**
 * Person filter circles for the wallet layout prototype. The circle and pill
 * classes are copied from `WalletClaimCircles.tsx`; that file renders on the
 * live wallet, so the prototype does not import or edit it.
 */
import React from 'react'
import { getAvatarInitials } from '@/features/atlas2026/components/avatarFallback'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { personFirstName, type PrototypePerson } from './walletLayoutModel'

interface PersonFilterRowProps {
  /** Read by screen readers as the name of the group. */
  label: string
  people: PrototypePerson[]
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
}

export default function PersonFilterRow({ label, people, selectedPersonId, onSelectPerson }: PersonFilterRowProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {people.map((person) => {
        const selected = person.id === selectedPersonId
        if (!selected) {
          return (
            <button
              key={person.id}
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-full border text-[14px] font-semibold"
              style={{ borderColor: '#ffffff40', backgroundColor: '#111111', color: SP_COLORS.white }}
              aria-pressed={false}
              title={person.name}
              onClick={() => onSelectPerson(person.id)}
            >
              {getAvatarInitials(person.name)}
            </button>
          )
        }
        // The chosen circle prints as a pill holding the first name; pressing it again clears the filter.
        return (
          <button
            key={person.id}
            type="button"
            className="flex h-12 items-center justify-center rounded-full border px-5 text-[14px] font-medium"
            style={{ borderColor: SP_COLORS.deepGreen, backgroundColor: `${SP_COLORS.deepGreen}33`, color: SP_COLORS.white }}
            aria-pressed
            title={`${person.name} · press to clear`}
            onClick={() => onSelectPerson(null)}
          >
            {personFirstName(person)}
          </button>
        )
      })}
    </div>
  )
}
