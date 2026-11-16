import React from 'react'
import { personFirstName, type WalletPerson } from '@/features/atlas2026/singlepane/domain/walletTasks'
import PersonCircleButton, { PERSON_CIRCLE_SELECTED_STYLE } from '../PersonCircleButton'

interface PadPersonFilterRowProps {
  /** Read by screen readers as the name of the group. */
  label: string
  people: WalletPerson[]
  selectedPersonId: string | null
  onSelectPerson: (personId: string | null) => void
  /** Printed after the last circle, on the same row. */
  trailing?: React.ReactNode
}

/** The person circles above the task pad. Pressing a circle keeps only that person's tasks on the pad. */
export default function PadPersonFilterRow({ label, people, selectedPersonId, onSelectPerson, trailing }: PadPersonFilterRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label={label} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {people.map((person) => {
          if (person.id !== selectedPersonId) {
            return (
              <PersonCircleButton
                key={person.id}
                name={person.name}
                selected={false}
                title={person.name}
                onClick={() => onSelectPerson(person.id)}
              />
            )
          }
          // The chosen circle prints as a pill holding the first name; pressing it again clears the filter.
          return (
            <button
              key={person.id}
              type="button"
              className="flex h-12 items-center justify-center rounded-full border px-5 text-[14px] font-medium"
              style={PERSON_CIRCLE_SELECTED_STYLE}
              aria-pressed
              title={`${person.name} · press to clear`}
              onClick={() => onSelectPerson(null)}
            >
              {personFirstName(person)}
            </button>
          )
        })}
      </div>
      {trailing}
    </div>
  )
}
