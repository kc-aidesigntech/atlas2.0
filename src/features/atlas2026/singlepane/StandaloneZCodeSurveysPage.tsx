/**
 * Standalone authenticated route for the z-code survey suite, allowing users to
 * switch between service-capacity and domain-spectrum tabs in one place.
 */
import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import ServiceCapacitySurveyPanel from '@/features/atlas2026/singlepane/components/ServiceCapacitySurveyPanel'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

const SESSION_ROLE_KEY = 'atlas2026.singlepane.session.role'
const SESSION_ACTIVE_MENU_KEY = 'atlas2026.singlepane.session.active-menu'
type ZCodeSurveyTab = 'serviceCapacity' | 'domainSpectrum'
const HASH_BY_TAB: Record<ZCodeSurveyTab, string> = {
  serviceCapacity: 'service-capacity',
  domainSpectrum: 'domain-spectrum'
}

function tabFromHash(hash: string): ZCodeSurveyTab | null {
  const normalizedHash = hash.replace(/^#/, '').trim().toLowerCase()
  if (normalizedHash === HASH_BY_TAB.serviceCapacity) return 'serviceCapacity'
  if (normalizedHash === HASH_BY_TAB.domainSpectrum) return 'domainSpectrum'
  return null
}

export default function StandaloneZCodeSurveysPage() {
  const {
    role,
    setRole,
    partnerServiceCapacitySurveyHistory,
    partnerServiceCapacityDefaultHeader,
    isSavingPartnerServiceCapacitySurvey,
    partnerServiceCapacitySurveyError,
    searchPartnerIdentifierMatches,
    ensurePartnerIdentifier,
    savePartnerServiceCapacitySurvey,
    deletePartnerServiceCapacityDraft
  } = useSinglePaneData('partner')
  const [activeTab, setActiveTab] = React.useState<ZCodeSurveyTab>(() => {
    if (typeof window === 'undefined') return 'serviceCapacity'
    return tabFromHash(window.location.hash) || 'serviceCapacity'
  })

  React.useEffect(() => {
    if (role !== 'partner') {
      setRole('partner')
    }
  }, [role, setRole])

  React.useEffect(() => {
    const previousTitle = document.title
    document.title = 'ATLAS Z Code Surveys'
    return () => {
      document.title = previousTitle
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    function syncTabFromLocationHash() {
      const nextTab = tabFromHash(window.location.hash)
      if (!nextTab) return
      setActiveTab((current) => (current === nextTab ? current : nextTab))
    }

    // Rehydrate tab state from location hash on first mount.
    syncTabFromLocationHash()
    window.addEventListener('hashchange', syncTabFromLocationHash)
    return () => {
      window.removeEventListener('hashchange', syncTabFromLocationHash)
    }
  }, [])

  function navigateToTab(tab: ZCodeSurveyTab) {
    if (typeof window === 'undefined') {
      setActiveTab(tab)
      return
    }

    const nextHash = HASH_BY_TAB[tab]
    const currentHash = window.location.hash.replace(/^#/, '').trim().toLowerCase()
    if (currentHash === nextHash) {
      // hashchange won't fire if the hash is unchanged.
      setActiveTab(tab)
      return
    }
    // Update URL hash directly so tab buttons always drive navigable links.
    window.location.hash = nextHash
  }

  function backToWorkspace() {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(SESSION_ROLE_KEY, 'partner')
    window.sessionStorage.setItem(SESSION_ACTIVE_MENU_KEY, 'my station')
    window.location.assign(new URL('/', window.location.origin).toString())
  }

  return (
    <div
      className="atlas-shell-edge-buffer min-h-screen overflow-x-hidden bg-black py-6 text-white md:py-8"
      style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <main className="mx-auto w-full max-w-[1240px] space-y-4">
        <div className="atlas-surface-panel flex flex-wrap items-center gap-2 px-4 py-3">
          <AtlasTextButton
            onClick={() => navigateToTab('serviceCapacity')}
            className="px-[14px] py-[7px] text-[13px] font-medium"
            style={{
              ['--button-border-color' as const]: activeTab === 'serviceCapacity' ? SP_COLORS.yellow : '#ffffff2f',
              color: activeTab === 'serviceCapacity' ? SP_COLORS.yellow : SP_COLORS.white
            } as React.CSSProperties}
          >
            Service capacity survey
          </AtlasTextButton>
          <AtlasTextButton
            onClick={() => navigateToTab('domainSpectrum')}
            className="px-[14px] py-[7px] text-[13px] font-medium"
            style={{
              ['--button-border-color' as const]: activeTab === 'domainSpectrum' ? SP_COLORS.yellow : '#ffffff2f',
              color: activeTab === 'domainSpectrum' ? SP_COLORS.yellow : SP_COLORS.white
            } as React.CSSProperties}
          >
            Domain spectrum survey
          </AtlasTextButton>
        </div>

        <ServiceCapacitySurveyPanel
          submissionHistory={partnerServiceCapacitySurveyHistory}
          defaultHeader={partnerServiceCapacityDefaultHeader}
          isSaving={isSavingPartnerServiceCapacitySurvey}
          saveError={partnerServiceCapacitySurveyError}
          onBackToWorkspace={backToWorkspace}
          onSearchPartnerIdentifiers={searchPartnerIdentifierMatches}
          onEnsurePartnerIdentifier={ensurePartnerIdentifier}
          onSubmit={savePartnerServiceCapacitySurvey}
          onDeleteDraft={deletePartnerServiceCapacityDraft}
          surveyVariant={activeTab === 'domainSpectrum' ? 'domainSpectrum' : 'burden'}
        />
      </main>
    </div>
  )
}
