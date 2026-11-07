import React from 'react'
import { Field, RecordTable } from '@/features/atlas2026/admin/components/AdminControlPanelPrimitives'
import { AtlasInsetCard } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import {
  createCohort,
  enrollInCohort,
  listCohortEnrollments,
  listCohorts,
  type IpsCohortEnrollmentRecord,
  type IpsCohortRecord
} from '@/features/atlas2026/singlepane/data-access/tierFeatureRepository'
import {
  PersonSelect,
  StatusWordPill,
  TierFeatureActionButton,
  TierFeatureErrorLine,
  TierFeatureListNotice,
  TierFeatureNoAccess,
  TierFeaturePanel,
  dateLabel,
  dateTimeLabel,
  usePeopleDirectory,
  useTierFeatureList,
  useTierFeatureWrite
} from '@/features/atlas2026/singlepane/components/tierFeaturePanels/tierFeaturePanelShared'

interface CohortsPanelProps {
  /** `supervision.give` (t4, t4plus, and the system-admin bypass). */
  canManageCohorts: boolean
}

/**
 * Intentional Peer Support (IPS) Core cohorts for `supervision.give` holders:
 * the cohort list, each cohort's enrollments, a create-cohort form, and an
 * enroll action that calls `fn_enroll_in_cohort`. The database trigger on the
 * enrollment insert moves an active t1 person to t2.
 */
export default function CohortsPanel({ canManageCohorts }: CohortsPanelProps) {
  const cohorts = useTierFeatureList(listCohorts)
  const enrollments = useTierFeatureList(listCohortEnrollments)
  const people = usePeopleDirectory()
  const reloadAll = React.useCallback(async () => {
    await Promise.all([cohorts.reload(), enrollments.reload()])
  }, [cohorts.reload, enrollments.reload])
  const write = useTierFeatureWrite(reloadAll)
  const [isComposerOpen, setIsComposerOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [startsOn, setStartsOn] = React.useState('')
  const [endsOn, setEndsOn] = React.useState('')
  const [selectedCohortId, setSelectedCohortId] = React.useState<string | null>(null)
  const [enrollPersonId, setEnrollPersonId] = React.useState('')

  if (!canManageCohorts) return <TierFeatureNoAccess permissionKey="supervision.give" title="cohorts" />

  const isBusy = Boolean(write.busyKey)
  const selectedCohort = cohorts.rows.find((cohort) => cohort.id === selectedCohortId) || cohorts.rows[0] || null
  const selectedEnrollments = selectedCohort ? enrollments.rows.filter((row) => row.cohortId === selectedCohort.id) : []
  const enrollmentCountByCohort = new Map<string, number>()
  for (const row of enrollments.rows) enrollmentCountByCohort.set(row.cohortId, (enrollmentCountByCohort.get(row.cohortId) || 0) + 1)

  function submitCohort() {
    if (!name.trim()) return
    void write.run('create', async () => {
      const id = await createCohort({ name, startsOn: startsOn || null, endsOn: endsOn || null })
      setName('')
      setStartsOn('')
      setEndsOn('')
      setIsComposerOpen(false)
      setSelectedCohortId(id)
    })
  }

  function submitEnrollment() {
    if (!selectedCohort || !enrollPersonId) return
    const cohortId = selectedCohort.id
    void write.run('enroll', async () => {
      await enrollInCohort(cohortId, enrollPersonId)
      setEnrollPersonId('')
    })
  }

  return (
    <TierFeaturePanel
      kicker="cohorts"
      title="IPS Core cohorts"
      description="Enrolling a Candidate (T1) in a cohort advances them to Apprentice (T2)."
      actions={
        <TierFeatureActionButton onClick={() => setIsComposerOpen((open) => !open)} disabled={isBusy} accent={SP_COLORS.yellow}>
          {isComposerOpen ? 'close' : 'new cohort'}
        </TierFeatureActionButton>
      }
    >
      <div className="space-y-4">
        {isComposerOpen ? (
          <div className="atlas-surface-raised grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-3">
            <Field label="cohort name">
              <input value={name} onChange={(event) => setName(event.target.value)} className="atlas-admin-input" />
            </Field>
            <Field label="starts on">
              <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} className="atlas-admin-input" />
            </Field>
            <Field label="ends on">
              <input type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} className="atlas-admin-input" />
            </Field>
            <div className="md:col-span-3">
              <TierFeatureActionButton onClick={submitCohort} disabled={isBusy || !name.trim()} accent={SP_COLORS.deepGreen}>
                {write.busyKey === 'create' ? 'saving…' : 'save cohort'}
              </TierFeatureActionButton>
            </div>
          </div>
        ) : null}

        <TierFeatureErrorLine message={write.error} />
        <TierFeatureListNotice state={cohorts} emptyLabel="No cohorts yet." tableLabel="The cohorts table" />

        {cohorts.rows.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <RecordTable
              columns={['cohort', 'dates', 'enrolled']}
              rows={cohorts.rows}
              renderRow={(row) => {
                const cohort = row as IpsCohortRecord
                const isSelected = selectedCohort?.id === cohort.id
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedCohortId(cohort.id)}
                    aria-pressed={isSelected}
                    className="grid w-full items-center gap-3 px-4 py-3 text-left text-[13px] text-white"
                    style={{ gridTemplateColumns: '1.3fr repeat(2, minmax(0, 1fr))', backgroundColor: isSelected ? '#ffffff0d' : undefined }}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{cohort.name}</div>
                      <div className="mt-1">
                        <StatusWordPill status={cohort.status} />
                      </div>
                    </div>
                    <div className="text-[12px]">
                      {dateLabel(cohort.startsOn, 'tbd')} – {dateLabel(cohort.endsOn, 'open')}
                    </div>
                    <div className="text-[12px]">{enrollmentCountByCohort.get(cohort.id) || 0}</div>
                  </button>
                )
              }}
            />

            {selectedCohort ? (
              <AtlasInsetCard>
                <small className="atlas-overline block">{selectedCohort.name}</small>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <Field label="enroll a person">
                    <PersonSelect
                      people={people.rows}
                      value={enrollPersonId}
                      onChange={setEnrollPersonId}
                      disabled={isBusy}
                      excludeIds={selectedEnrollments.map((row) => row.personId)}
                    />
                  </Field>
                  <TierFeatureActionButton onClick={submitEnrollment} disabled={isBusy || !enrollPersonId} accent={SP_COLORS.deepGreen}>
                    {write.busyKey === 'enroll' ? 'enrolling…' : 'enroll'}
                  </TierFeatureActionButton>
                </div>
                <div className="mt-4 space-y-2">
                  <TierFeatureListNotice state={{ ...enrollments, rows: selectedEnrollments }} emptyLabel="No one is enrolled in this cohort yet." tableLabel="The cohort enrollments table" />
                  {selectedEnrollments.map((enrollment: IpsCohortEnrollmentRecord) => (
                    <div key={enrollment.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-white/10 px-3 py-2 text-[13px] text-white">
                      <div className="min-w-0">
                        <div className="truncate">{enrollment.personName}</div>
                        <small className="block text-[11px] text-[var(--foreground-secondary)]">enrolled {dateTimeLabel(enrollment.enrolledAtIso)}</small>
                      </div>
                      <StatusWordPill status={enrollment.status} />
                    </div>
                  ))}
                </div>
              </AtlasInsetCard>
            ) : null}
          </div>
        ) : null}
      </div>
    </TierFeaturePanel>
  )
}
