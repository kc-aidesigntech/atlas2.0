import React from 'react'
import { Field, RecordTable } from '@/features/atlas2026/admin/components/AdminControlPanelPrimitives'
import { AtlasStatusPill } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import { tierDisplayLabel } from '@/features/atlas2026/shared/tiers'
import {
  issueCompetencyCard,
  listCompetencyAssessmentsForPerson,
  listCompetencyCards,
  listPersonCompetencyCards,
  type CompetencyAssessmentOption,
  type PersonCompetencyCardRecord
} from '@/features/atlas2026/singlepane/data-access/tierFeatureRepository'
import {
  PersonSelect,
  TierFeatureActionButton,
  TierFeatureErrorLine,
  TierFeatureListNotice,
  TierFeatureNoAccess,
  TierFeaturePanel,
  dateTimeLabel,
  usePeopleDirectory,
  useTierFeatureList,
  useTierFeatureWrite
} from '@/features/atlas2026/singlepane/components/tierFeaturePanels/tierFeaturePanelShared'

interface CompetencyCardsPanelProps {
  /** `supervision.give`: issue cards. */
  canIssueCards: boolean
}

/**
 * Competency card issuance for `supervision.give` holders. The catalog comes
 * from `atlas.competency_cards`; earned cards from `atlas.people_competency_cards`.
 * Issuing calls `fn_issue_competency_card`, optionally linked to one of the
 * person's `navigator_competency_assessments` rows, the same rows the
 * supervisor wallet's navigator competency panel summarizes.
 */
export default function CompetencyCardsPanel({ canIssueCards }: CompetencyCardsPanelProps) {
  const catalog = useTierFeatureList(listCompetencyCards)
  const earned = useTierFeatureList(() => listPersonCompetencyCards())
  const people = usePeopleDirectory()
  const write = useTierFeatureWrite(earned.reload)
  const [personId, setPersonId] = React.useState('')
  const [cardId, setCardId] = React.useState('')
  const [assessmentId, setAssessmentId] = React.useState('')
  const [assessments, setAssessments] = React.useState<CompetencyAssessmentOption[]>([])

  // The assessment list follows the chosen person; the RPC rejects an assessment of anyone else.
  React.useEffect(() => {
    let isMounted = true
    setAssessmentId('')
    if (!personId) {
      setAssessments([])
      return
    }
    void listCompetencyAssessmentsForPerson(personId).then((result) => {
      if (isMounted) setAssessments(result.rows)
    })
    return () => {
      isMounted = false
    }
  }, [personId])

  if (!canIssueCards) return <TierFeatureNoAccess permissionKey="supervision.give" title="competency cards" />

  const isBusy = Boolean(write.busyKey)
  const heldCardIds = new Set(earned.rows.filter((row) => row.personId === personId).map((row) => row.cardId))
  const visibleEarned = personId ? earned.rows.filter((row) => row.personId === personId) : earned.rows

  function submitIssue() {
    if (!personId || !cardId) return
    void write.run('issue', async () => {
      await issueCompetencyCard(personId, cardId, assessmentId || null)
      setCardId('')
      setAssessmentId('')
    })
  }

  return (
    <TierFeaturePanel kicker="competency cards" title="Issue competency cards" description="Cards a person has earned. Link an assessment when one backs the card.">
      <div className="space-y-5">
        <div className="atlas-surface-raised grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-3">
          <Field label="person">
            <PersonSelect people={people.rows} value={personId} onChange={setPersonId} disabled={isBusy} />
          </Field>
          <Field label="card">
            <select value={cardId} onChange={(event) => setCardId(event.target.value)} disabled={isBusy || !personId} className="atlas-admin-input">
              <option value="">choose a card</option>
              {catalog.rows.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.title}
                  {card.tierMin ? ` (${tierDisplayLabel(card.tierMin)})` : ''}
                  {heldCardIds.has(card.id) ? ' · held' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="assessment (optional)">
            <select value={assessmentId} onChange={(event) => setAssessmentId(event.target.value)} disabled={isBusy || !personId || !assessments.length} className="atlas-admin-input">
              <option value="">{assessments.length ? 'none' : 'no assessments for this person'}</option>
              {assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {dateTimeLabel(assessment.assessedAtIso)}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-3">
            <TierFeatureActionButton onClick={submitIssue} disabled={isBusy || !personId || !cardId} accent={SP_COLORS.deepGreen}>
              {write.busyKey === 'issue' ? 'issuing…' : heldCardIds.has(cardId) ? 're-issue card' : 'issue card'}
            </TierFeatureActionButton>
          </div>
        </div>

        <TierFeatureErrorLine message={write.error} />

        <section className="space-y-2">
          <small className="atlas-overline block">catalog</small>
          <TierFeatureListNotice state={catalog} emptyLabel="The catalog is empty." tableLabel="The competency cards catalog" />
          <div className="flex flex-wrap gap-2">
            {catalog.rows.map((card) => (
              <AtlasStatusPill key={card.id} color={heldCardIds.has(card.id) ? SP_COLORS.deepGreen : '#ffffff90'}>
                {card.title}
              </AtlasStatusPill>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <small className="atlas-overline block">{personId ? 'cards held by this person' : 'cards issued'}</small>
          <TierFeatureListNotice state={{ ...earned, rows: visibleEarned }} emptyLabel="No cards issued yet." tableLabel="The earned cards table" />
          {visibleEarned.length ? (
            <RecordTable
              columns={['card', 'person', 'earned', 'issued by', 'assessment']}
              rows={visibleEarned}
              renderRow={(row) => {
                const record = row as PersonCompetencyCardRecord
                return (
                  <div className="grid items-center gap-3 px-4 py-3 text-[13px] text-white" style={{ gridTemplateColumns: '1.3fr repeat(4, minmax(0, 1fr))' }}>
                    <div className="truncate font-medium">{record.cardTitle}</div>
                    <div className="truncate text-[12px]">{record.personName}</div>
                    <div className="text-[12px]">{dateTimeLabel(record.earnedAtIso)}</div>
                    <div className="truncate text-[12px]">{record.issuedByName || '—'}</div>
                    <div className="text-[12px]">{record.assessmentId ? 'linked' : '—'}</div>
                  </div>
                )
              }}
            />
          ) : null}
        </section>
      </div>
    </TierFeaturePanel>
  )
}
