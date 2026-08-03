import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import type {
  CreateSessionRecord,
  NavigatorCreateReflectionRecord,
  NavigatorProgramState
} from '@/features/atlas2026/shared/contracts'
import {
  loadNavigatorCreateReflection,
  loadNavigatorCreateReflections,
  loadNavigatorCreateSessions,
  loadNavigatorIpsSelfAssessments,
  loadNavigatorIpsccEncounterSubmissions,
  loadSupervisorIpsAssessments,
  saveNavigatorCreateReflection as persistNavigatorCreateReflection,
  saveNavigatorCreateSession as persistNavigatorCreateSession
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { toSupabaseErrorMessage } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import {
  CREATE_REFLECTION_SESSION_LIMIT,
  generateCreateReflection
} from '@/services/atlas2026/createReflectionService'

interface UseCreateReflectionActionsInput {
  currentNavigatorName: string
  currentSupervisorName: string
  managedNavigatorNames: string[]
  mergedNavigatorProgramState: NavigatorProgramState
  setNavigatorProgramState: Dispatch<SetStateAction<NavigatorProgramState>>
  setNavigatorProgramError: Dispatch<SetStateAction<string | null>>
  ensureWriteAllowed: (capability: 'navigatorProgram.write', actionDescription: string) => void
  saveNavigatorProgramState: (state: NavigatorProgramState) => Promise<NavigatorProgramState>
}

/**
 * Owns Connect, Recognize, Encourage, Acknowledge, Train, and Empower
 * (C.R.E.A.T.E.) reflection loading, generation, and supervisor overrides.
 */
export function useCreateReflectionActions({
  currentNavigatorName,
  currentSupervisorName,
  managedNavigatorNames,
  mergedNavigatorProgramState,
  setNavigatorProgramState,
  setNavigatorProgramError,
  ensureWriteAllowed,
  saveNavigatorProgramState
}: UseCreateReflectionActionsInput) {
  const [navigatorCreateReflection, setNavigatorCreateReflection] =
    useState<NavigatorCreateReflectionRecord | null>(null)
  const [supervisorManagedCreateReflections, setSupervisorManagedCreateReflections] = useState<
    NavigatorCreateReflectionRecord[]
  >([])

  useEffect(() => {
    let isMounted = true
    // Load Intentional Peer Support Core Competencies (IPSCC) rows and the reflection as one
    // snapshot so the profile never mixes records from different navigators.
    setNavigatorCreateReflection(null)
    Promise.all([
      loadNavigatorIpsccEncounterSubmissions(currentNavigatorName),
      loadNavigatorIpsSelfAssessments(currentNavigatorName),
      loadNavigatorCreateSessions(currentNavigatorName),
      loadSupervisorIpsAssessments(),
      loadNavigatorCreateReflection(currentNavigatorName)
    ])
      .then(
        ([
          ipsccEncounterSubmissions,
          ipsSelfAssessments,
          createSessions,
          supervisorIpsAssessments,
          createReflection
        ]) => {
          if (!isMounted) return
          setNavigatorProgramState((current) => ({
            ...current,
            ipsccEncounterSubmissions: ipsccEncounterSubmissions.length
              ? ipsccEncounterSubmissions
              : current.ipsccEncounterSubmissions,
            ipsSelfAssessments: ipsSelfAssessments.length ? ipsSelfAssessments : current.ipsSelfAssessments,
            createSessions: createSessions.length ? createSessions : current.createSessions,
            supervisorIpsAssessments: supervisorIpsAssessments.length
              ? supervisorIpsAssessments
              : current.supervisorIpsAssessments
          }))
          setNavigatorCreateReflection(createReflection)
        }
      )
      .catch((error) => {
        if (!isMounted) return
        setNavigatorProgramError(
          toSupabaseErrorMessage(error, 'Unable to load IPSCC or C.R.E.A.T.E. supervision records.')
        )
      })
    return () => {
      isMounted = false
    }
  }, [currentNavigatorName, setNavigatorProgramError, setNavigatorProgramState])

  const managedNavigatorNamesKey = managedNavigatorNames.join('|')
  useEffect(() => {
    const names = managedNavigatorNamesKey ? managedNavigatorNamesKey.split('|') : []
    if (!names.length) {
      setSupervisorManagedCreateReflections([])
      return
    }
    let isMounted = true
    // Supervisor profiles load only reflections for navigators in their managed directory.
    loadNavigatorCreateReflections(names)
      .then((rows) => {
        if (isMounted) setSupervisorManagedCreateReflections(rows)
      })
      .catch((error) => {
        if (isMounted) console.warn('Unable to load managed navigator C.R.E.A.T.E. reflections.', error)
      })
    return () => {
      isMounted = false
    }
  }, [managedNavigatorNamesKey])

  const saveNavigatorCreateSession = useCallback(
    async (record: CreateSessionRecord) => {
      ensureWriteAllowed('navigatorProgram.write', 'save C.R.E.A.T.E. supervision sessions')
      const savedRecord = await persistNavigatorCreateSession(record)
      const nextCreateSessions = [
        savedRecord,
        ...mergedNavigatorProgramState.createSessions.filter((item) => item.id !== savedRecord.id)
      ]
      const savedProgramState = await saveNavigatorProgramState({
        ...mergedNavigatorProgramState,
        createSessions: nextCreateSessions
      })

      // Regenerate the reflection from the latest session and at most nine prior sessions.
      const sessionsForReflection = nextCreateSessions
        .filter((item) => item.navigatorName.trim().toLowerCase() === savedRecord.navigatorName.trim().toLowerCase())
        .slice()
        .sort((left, right) => new Date(left.sessionAtIso).getTime() - new Date(right.sessionAtIso).getTime())
        .slice(-CREATE_REFLECTION_SESSION_LIMIT)

      try {
        const generated = await generateCreateReflection({
          navigatorName: savedRecord.navigatorName,
          supervisorName: savedRecord.supervisorName,
          sessions: sessionsForReflection
        })
        const reflection = await persistNavigatorCreateReflection({
          navigatorName: savedRecord.navigatorName,
          reflectionText: generated.reflectionText,
          // Fresh generation replaces any prior supervisor edit of the display narrative.
          generatedReflectionText: generated.reflectionText,
          sourceSessionIds: sessionsForReflection.map((session) => session.id),
          sourceLatestSessionId: savedRecord.id,
          model: generated.model,
          generatedAtIso: new Date().toISOString(),
          usedFallback: generated.usedFallback,
          supervisorOverriddenAtIso: null,
          supervisorOverriddenBy: ''
        })
        setNavigatorCreateReflection(reflection)
        setSupervisorManagedCreateReflections((current) => [
          reflection,
          ...current.filter(
            (item) => item.navigatorName.trim().toLowerCase() !== reflection.navigatorName.trim().toLowerCase()
          )
        ])
      } catch (error) {
        // Session persistence remains authoritative even if narrative generation fails afterward.
        console.warn('Unable to persist C.R.E.A.T.E. reflection after session save.', error)
      }
      return savedProgramState
    },
    [ensureWriteAllowed, mergedNavigatorProgramState, saveNavigatorProgramState]
  )

  const saveSupervisorCreateReflectionOverride = useCallback(
    async (input: { navigatorName: string; reflectionText: string }) => {
      ensureWriteAllowed('navigatorProgram.write', 'override C.R.E.A.T.E. reflection')
      const navigatorName = input.navigatorName.trim()
      const reflectionText = input.reflectionText.trim()
      if (!navigatorName) throw new Error('Select a navigator before overriding the reflection.')
      if (!reflectionText) throw new Error('Reflection text cannot be empty.')

      const existing =
        supervisorManagedCreateReflections.find(
          (row) => row.navigatorName.trim().toLowerCase() === navigatorName.toLowerCase()
        ) || (await loadNavigatorCreateReflection(navigatorName))
      const nowIso = new Date().toISOString()
      // Preserve the generated copy so a supervisor can restore it after an override.
      const generatedReflectionText =
        existing?.generatedReflectionText?.trim() || existing?.reflectionText?.trim() || reflectionText
      const saved = await persistNavigatorCreateReflection({
        id: existing?.id,
        navigatorName,
        reflectionText,
        generatedReflectionText,
        sourceSessionIds: existing?.sourceSessionIds || [],
        sourceLatestSessionId: existing?.sourceLatestSessionId || '',
        model: existing?.model || 'supervisor-override',
        generatedAtIso: existing?.generatedAtIso || nowIso,
        usedFallback: existing?.usedFallback || false,
        supervisorOverriddenAtIso: nowIso,
        supervisorOverriddenBy: currentSupervisorName.trim() || 'supervisor'
      })
      setSupervisorManagedCreateReflections((current) => [
        saved,
        ...current.filter(
          (item) => item.navigatorName.trim().toLowerCase() !== saved.navigatorName.trim().toLowerCase()
        )
      ])
      if (saved.navigatorName.trim().toLowerCase() === currentNavigatorName.trim().toLowerCase()) {
        setNavigatorCreateReflection(saved)
      }
      return saved
    },
    [
      currentNavigatorName,
      currentSupervisorName,
      ensureWriteAllowed,
      supervisorManagedCreateReflections
    ]
  )

  const restoreSupervisorCreateReflectionGenerated = useCallback(
    async (navigatorNameInput: string) => {
      ensureWriteAllowed('navigatorProgram.write', 'restore generated C.R.E.A.T.E. reflection')
      const navigatorName = navigatorNameInput.trim()
      if (!navigatorName) throw new Error('Select a navigator before restoring the generated reflection.')
      const existing =
        supervisorManagedCreateReflections.find(
          (row) => row.navigatorName.trim().toLowerCase() === navigatorName.toLowerCase()
        ) || (await loadNavigatorCreateReflection(navigatorName))
      if (!existing) throw new Error('No C.R.E.A.T.E. reflection exists for this navigator yet.')
      const restoredText = existing.generatedReflectionText.trim() || existing.reflectionText.trim()
      if (!restoredText) throw new Error('No generated reflection is available to restore.')

      const saved = await persistNavigatorCreateReflection({
        ...existing,
        reflectionText: restoredText,
        generatedReflectionText: restoredText,
        supervisorOverriddenAtIso: null,
        supervisorOverriddenBy: ''
      })
      setSupervisorManagedCreateReflections((current) => [
        saved,
        ...current.filter(
          (item) => item.navigatorName.trim().toLowerCase() !== saved.navigatorName.trim().toLowerCase()
        )
      ])
      if (saved.navigatorName.trim().toLowerCase() === currentNavigatorName.trim().toLowerCase()) {
        setNavigatorCreateReflection(saved)
      }
      return saved
    },
    [currentNavigatorName, ensureWriteAllowed, supervisorManagedCreateReflections]
  )

  return {
    navigatorCreateReflection,
    supervisorManagedCreateReflections,
    saveNavigatorCreateSession,
    saveSupervisorCreateReflectionOverride,
    restoreSupervisorCreateReflectionGenerated
  }
}
