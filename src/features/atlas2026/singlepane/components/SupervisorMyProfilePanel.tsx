import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { SupervisorIpsAssessmentRecord, SupervisorNavigatorCompetencySummary } from '@/features/atlas2026/shared/contracts'
import IpsCompetencySurvey, {
  isIpsCompetencySurveyComplete,
  scoresMapToCompetencyRecord,
  type IpsCompetencyScoreMap
} from './IpsCompetencySurvey'
import ProfileNavigationCard from './ProfileNavigationCard'

interface SupervisorNavigatorDirectoryEntry {
  navigatorPersonId: string
  navigatorName: string
  assignedEnrolleeCount: number
  isManagedByCurrentSupervisor: boolean
}

interface SupervisorMyProfilePanelProps {
  currentSupervisorName: string
  navigatorDirectory: SupervisorNavigatorDirectoryEntry[]
  competencyByNavigator: SupervisorNavigatorCompetencySummary[]
  allSupervisorIpsAssessments: SupervisorIpsAssessmentRecord[]
  isSavingAssignments?: boolean
  onToggleManagedNavigator?: (navigatorPersonId: string, isManaged: boolean) => Promise<void> | void
  onSaveSupervisorIpsAssessment: (record: SupervisorIpsAssessmentRecord) => Promise<unknown> | unknown
}

type OverlayKey = 'section_1_weekly_ips' | 'section_2_assigned_navigators' | 'section_3_assessment_rollup'

const CARD_DEFS: Array<{
  key: OverlayKey
  title: string
  cardTitle: string
  cardSubtitle: string
  actionLabel: string
  variant: 'green' | 'blue'
  illustration: 'feedback' | 'reflection' | 'create'
}> = [
  { key: 'section_1_weekly_ips', title: 'Section 1: Weekly IPSCC assessment by supervisor', cardTitle: 'weekly review', cardSubtitle: 'ipscc', actionLabel: 'start reflection', variant: 'blue', illustration: 'reflection' },
  { key: 'section_2_assigned_navigators', title: 'Section 2: Assigned navigators', cardTitle: 'navigator roster', cardSubtitle: 'assignments', actionLabel: 'view feedback', variant: 'green', illustration: 'feedback' },
  { key: 'section_3_assessment_rollup', title: 'Section 3: Navigator assessment rollup', cardTitle: 'assessment rollup', cardSubtitle: 'competency', actionLabel: 'create & share', variant: 'green', illustration: 'create' }
]

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'not recorded'
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}

export default function SupervisorMyProfilePanel({
  currentSupervisorName,
  navigatorDirectory,
  competencyByNavigator,
  allSupervisorIpsAssessments,
  isSavingAssignments = false,
  onToggleManagedNavigator,
  onSaveSupervisorIpsAssessment
}: SupervisorMyProfilePanelProps) {
  const [activeOverlay, setActiveOverlay] = React.useState<OverlayKey | null>(null)
  const [selectedNavigatorName, setSelectedNavigatorName] = React.useState('')
  const [assessmentNote, setAssessmentNote] = React.useState('')
  const [draftScores, setDraftScores] = React.useState<IpsCompetencyScoreMap>({})

  React.useEffect(() => {
    if (!selectedNavigatorName && navigatorDirectory.length) {
      setSelectedNavigatorName(navigatorDirectory[0].navigatorName)
    }
  }, [navigatorDirectory, selectedNavigatorName])

  return (
    <div className="relative flex flex-col gap-4">
      <div className="atlas-surface-panel px-5 py-4">
        <div className="atlas-h4 text-[24px] font-medium text-white">supervisor my profile</div>
        <small className="mt-1 block text-[#9eacb9]">{currentSupervisorName}</small>
      </div>
      <div className="atlas-profile-nav-grid">
        {CARD_DEFS.map((card) => (
          <ProfileNavigationCard
            key={card.key}
            sequenceNumber={Number(card.key.replace('section_', '').split('_')[0])}
            title={card.cardTitle}
            subtitle={card.cardSubtitle}
            actionLabel={card.actionLabel}
            variant={card.variant}
            illustration={card.illustration}
            onClick={() => setActiveOverlay(card.key)}
          />
        ))}
      </div>

      {activeOverlay ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="atlas-surface-panel max-h-[90vh] w-full max-w-[980px] overflow-y-auto p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[18px] font-medium text-white">{CARD_DEFS.find((card) => card.key === activeOverlay)?.title}</div>
              <AtlasTextButton onClick={() => setActiveOverlay(null)} className="px-3 py-1 text-[12px]">close</AtlasTextButton>
            </div>

            {activeOverlay === 'section_1_weekly_ips' ? (
              <div className="space-y-3">
                <IpsCompetencySurvey
                  scores={draftScores}
                  onChangeScore={(key, score) => setDraftScores((current) => ({ ...current, [key]: score }))}
                  assignmentLabel="rate this navigator on the competency"
                  accentColor={SP_COLORS.blue}
                  headerSlot={
                    <label className="block">
                      <small className="atlas-overline block text-[#9eacb9]">Navigator being assessed</small>
                      <select
                        className="atlas-select mt-1 h-10 w-full bg-transparent text-white"
                        value={selectedNavigatorName}
                        onChange={(event) => setSelectedNavigatorName(event.target.value)}
                      >
                        {navigatorDirectory.map((row) => (
                          <option key={row.navigatorPersonId} value={row.navigatorName} className="bg-black text-white">
                            {row.navigatorName}
                          </option>
                        ))}
                      </select>
                    </label>
                  }
                  footerSlot={
                    <div className="space-y-3">
                      <textarea
                        className="atlas-textarea min-h-[90px] bg-transparent text-white"
                        value={assessmentNote}
                        onChange={(event) => setAssessmentNote(event.target.value)}
                        placeholder="Weekly supervisor IPSCC assessment note..."
                      />
                      <div className="flex justify-end">
                        <AtlasTextButton
                          disabled={!selectedNavigatorName.trim() || !isIpsCompetencySurveyComplete(draftScores)}
                          onClick={async () => {
                            if (!selectedNavigatorName.trim()) return
                            const now = new Date().toISOString()
                            await onSaveSupervisorIpsAssessment({
                              id: `supervisor-ips-${Date.now()}`,
                              supervisorName: currentSupervisorName,
                              navigatorName: selectedNavigatorName,
                              weekStartIso: now,
                              submittedAtIso: now,
                              competencyScores: scoresMapToCompetencyRecord(draftScores),
                              note: assessmentNote
                            })
                            setDraftScores({})
                            setAssessmentNote('')
                          }}
                          className="px-4 py-2 text-[12px]"
                        >
                          save section 1 entry
                        </AtlasTextButton>
                      </div>
                    </div>
                  }
                />
                <div className="atlas-surface-raised px-3 py-3">
                  <div className="text-[13px] font-medium text-white">Historical supervisor assessments</div>
                  <div className="mt-2 space-y-2">
                    {allSupervisorIpsAssessments.slice(0, 14).map((record) => (
                      <div key={record.id} className="atlas-surface-raised grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-[12px]">
                        <span className="text-white">{formatDateLabel(record.submittedAtIso)}</span>
                        <span style={{ color: '#9eacb9' }}>{record.navigatorName}</span>
                        <span className="truncate" style={{ color: '#d7e0e9' }}>{record.note || 'no note'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeOverlay === 'section_2_assigned_navigators' ? (
              <div className="space-y-2">
                {navigatorDirectory.length ? navigatorDirectory.map((row) => (
                  <label
                    key={row.navigatorPersonId}
                    className="atlas-surface-raised flex items-center justify-between px-3 py-2"
                  >
                    <div>
                      <small className="block text-[12px] text-white">{row.navigatorName}</small>
                      <small className="text-[11px] text-[#cfcfcf]">{row.assignedEnrolleeCount} assigned enrollees</small>
                    </div>
                    <input
                      type="checkbox"
                      checked={row.isManagedByCurrentSupervisor}
                      onChange={() => onToggleManagedNavigator?.(row.navigatorPersonId, !row.isManagedByCurrentSupervisor)}
                      className="h-4 w-4 accent-white"
                      disabled={isSavingAssignments}
                    />
                  </label>
                )) : (
                  <small className="block text-[12px] text-[#cfcfcf]">No navigator identities are available yet.</small>
                )}
              </div>
            ) : null}

            {activeOverlay === 'section_3_assessment_rollup' ? (
              <div className="space-y-2">
                {competencyByNavigator.length ? competencyByNavigator.map((row) => (
                  <div key={row.navigatorName} className="atlas-surface-raised flex items-center justify-between px-3 py-2">
                    <div>
                      <small className="block text-[12px] text-white">{row.navigatorName}</small>
                      <small className="text-[11px] text-[#cfcfcf]">
                        {row.assessmentCount} assessments
                        {row.lastAssessmentAtIso ? ` • last ${new Date(row.lastAssessmentAtIso).toLocaleDateString()}` : ''}
                      </small>
                    </div>
                    <small className="text-[12px] font-medium text-white">{row.weightedRollingAverage.toFixed(2)}</small>
                  </div>
                )) : (
                  <small className="block text-[12px] text-[#cfcfcf]">No navigator assessments recorded yet.</small>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
