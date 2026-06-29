/**
 * Standalone authenticated route for the z-code survey suite, allowing users to
 * switch between service-capacity and domain-spectrum tabs in one place.
 */
import React from 'react'
import { AtlasTextButton } from '@/features/atlas2026/components/AtlasPrimitives'
import AtlasArrowIcon from '@/features/atlas2026/components/AtlasArrowIcon'
import ServiceCapacitySurveyPanel from '@/features/atlas2026/singlepane/components/ServiceCapacitySurveyPanel'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import { useSinglePaneData } from '@/features/atlas2026/singlepane/useSinglePaneData'

const SESSION_ROLE_KEY = 'atlas2026.singlepane.session.role'
const SESSION_ACTIVE_MENU_KEY = 'atlas2026.singlepane.session.active-menu'
const SURVEY_RETURN_ROLE_KEY = 'atlas2026.surveys.return.role'
const SURVEY_RETURN_MENU_KEY = 'atlas2026.surveys.return.menu'
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
    if (typeof window === 'undefined') return
    const currentRole = window.sessionStorage.getItem(SESSION_ROLE_KEY)
    const currentMenu = window.sessionStorage.getItem(SESSION_ACTIVE_MENU_KEY)
    // Capture pre-survey shell context once per entry so Back can restore role/menu continuity.
    if (currentRole) window.sessionStorage.setItem(SURVEY_RETURN_ROLE_KEY, currentRole)
    if (currentMenu) window.sessionStorage.setItem(SURVEY_RETURN_MENU_KEY, currentMenu)
  }, [])

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
    const returnRole = window.sessionStorage.getItem(SURVEY_RETURN_ROLE_KEY)
    const returnMenu = window.sessionStorage.getItem(SURVEY_RETURN_MENU_KEY)
    if (returnRole) window.sessionStorage.setItem(SESSION_ROLE_KEY, returnRole)
    if (returnMenu) window.sessionStorage.setItem(SESSION_ACTIVE_MENU_KEY, returnMenu)
    window.sessionStorage.removeItem(SURVEY_RETURN_ROLE_KEY)
    window.sessionStorage.removeItem(SURVEY_RETURN_MENU_KEY)
    let hasSameOriginReferrer = false
    try {
      hasSameOriginReferrer = Boolean(window.document.referrer) && new URL(window.document.referrer).origin === window.location.origin
    } catch {
      hasSameOriginReferrer = false
    }
    if (hasSameOriginReferrer || window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.assign(new URL('/app', window.location.origin).toString())
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-black text-white"
      style={{ backgroundColor: SP_COLORS.bg, color: SP_COLORS.text, fontFamily: 'Helvetica, Arial, sans-serif' }}
    >
      <header className="border-b bg-black" style={{ borderColor: '#ffffff70' }}>
        <div className="atlas-shell-edge-buffer flex h-[54px] items-center border-b" style={{ borderColor: '#ffffff45' }}>
          <button
            type="button"
            onClick={backToWorkspace}
            className="atlas-font-heading text-[17px] font-medium tracking-[0.08em] text-white"
            aria-label="Go to ATLAS home"
          >
            ATLAS
          </button>
        </div>
        <div className="atlas-shell-edge-buffer flex min-h-[54px] items-center py-2">
          <div className="flex min-w-max flex-wrap items-center gap-2 text-white">
            <AtlasTextButton
              onClick={backToWorkspace}
              className="inline-flex items-center gap-2 px-[14px] py-[7px] text-[13px] font-medium"
              style={{ ['--button-border-color' as const]: '#ffffff2f', color: SP_COLORS.white } as React.CSSProperties}
            >
              <AtlasArrowIcon decorative direction="left" className="h-[1.1rem] w-[1.1rem] opacity-90" />
              back
            </AtlasTextButton>
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
        </div>
      </header>
      <main className="atlas-shell-edge-buffer mx-auto w-full max-w-[1240px] space-y-4 py-6 md:py-8">
        <ServiceCapacitySurveyPanel
          submissionHistory={partnerServiceCapacitySurveyHistory}
          defaultHeader={partnerServiceCapacityDefaultHeader}
          isSaving={isSavingPartnerServiceCapacitySurvey}
          saveError={partnerServiceCapacitySurveyError}
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
