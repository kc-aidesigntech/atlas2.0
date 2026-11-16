/**
 * The legal pad that holds the readiness list: a black header with the Atlas
 * logo, a ruled white page with a red margin line, and colored tabs hanging
 * under the page. The tab behavior comes from the shared Radix `Tabs` wrapper;
 * the pad look and the round checkboxes exist only in this prototype folder.
 */
import React from 'react'
import { usesLightTextOnZCodeColor } from '@atlas/shared'
import type { TabsContentProps, TabsListProps, TabsTriggerProps } from '@radix-ui/react-tabs'
import { Check } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import atlasLogoSrc from '@/features/atlas2026/assets/branding/ATLAS_LOGO_simple_lucidGreenBlue4.png'
import { SP_COLORS } from '@/features/atlas2026/shared/theme'
import type { ReadinessTab } from './walletLayoutModel'

// The shared wrapper is a `.jsx` file, so its three components reach TypeScript with no props.
// These names are the same components read with the Radix prop types.
const PadTabsContent = TabsContent as React.ComponentType<TabsContentProps>
const PadTabsList = TabsList as React.ComponentType<TabsListProps>
const PadTabsTrigger = TabsTrigger as React.ComponentType<TabsTriggerProps>

const PAPER_COLOR = '#ffffff'
const RULE_COLOR = '#6f9fd8'
const INK_COLOR = '#1b1b1b'
/** Height of one ruled line, in pixels; every row on the page is this tall. */
const ROW_PX = 44
/** Width of the category flag at a row's right edge, in pixels. */
const FLAG_WIDTH_PX = 14
/** Distance from the page's left edge to the red margin line, in pixels. */
const MARGIN_PX = 52

interface LegalPadProps {
  tabs: ReadinessTab[]
  activeTabKey: string
  onSelectTab: (tabKey: string) => void
  /** The scrolling page element; the scroll track beside the pad reads it. */
  pageRef: React.RefObject<HTMLDivElement>
  pageId: string
  /** Printed at the right end of the black header. */
  headerTrailing?: React.ReactNode
  children: React.ReactNode
}

export default function LegalPad({ tabs, activeTabKey, onSelectTab, pageRef, pageId, headerTrailing, children }: LegalPadProps) {
  return (
    <Tabs value={activeTabKey} onValueChange={onSelectTab} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative flex h-[68px] shrink-0 items-center justify-center gap-2 rounded-t-[16px] border border-white/20 bg-black">
        <img src={atlasLogoSrc} alt="" className="h-12 w-12 object-contain" />
        <span className="text-[30px] font-black leading-none tracking-[0.02em] text-white">atlas</span>
        {headerTrailing ? <div className="absolute right-3 top-1/2 -translate-y-1/2">{headerTrailing}</div> : null}
      </div>
      {/* One panel whose value always equals the chosen tab, so the page stays mounted while its rows change. */}
      <PadTabsContent
        value={activeTabKey}
        className="relative mt-0 min-h-0 flex-1 overflow-hidden rounded-b-[10px]"
        style={{ backgroundColor: PAPER_COLOR }}
      >
        <div
          ref={pageRef}
          id={pageId}
          className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            color: INK_COLOR,
            // One blue rule at the bottom of every row; `local` scrolls the rules with the rows.
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_PX - 1}px, ${RULE_COLOR} ${ROW_PX - 1}px, ${RULE_COLOR} ${ROW_PX}px)`,
            backgroundAttachment: 'local'
          }}
        >
          {children}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px"
          style={{ left: MARGIN_PX, backgroundColor: SP_COLORS.red }}
        />
      </PadTabsContent>
      {/* Each tab is as wide as its label plus an equal share of the spare width, so five labels fit a phone-width pad. */}
      <PadTabsList className="flex h-auto w-full shrink-0 items-start justify-start gap-0.5 rounded-none bg-transparent p-0 px-1 sm:gap-1 sm:px-4">
        {tabs.map((tab) => (
          <PadTabsTrigger
            key={tab.key}
            value={tab.key}
            className="h-9 min-w-0 flex-auto rounded-none rounded-b-[12px] px-1.5 py-0 text-[11px] font-bold tracking-normal sm:px-2 sm:text-[13px] sm:tracking-[0.04em] transition-[height,opacity] data-[state=active]:h-11 data-[state=active]:shadow-none data-[state=inactive]:opacity-70 motion-reduce:transition-none"
            style={{ backgroundColor: tab.color, color: usesLightTextOnZCodeColor(tab.color) ? SP_COLORS.white : INK_COLOR }}
          >
            <span className="truncate">{tab.label}</span>
          </PadTabsTrigger>
        ))}
      </PadTabsList>
    </Tabs>
  )
}

interface PadCheckRowProps {
  checked: boolean
  onToggle: () => void
  /** False prints a checked row's text at full strength; a checked row's text is faded otherwise. */
  fadeWhenChecked?: boolean
  /** Printed small after the row's text. */
  trailing?: React.ReactNode
  /** The row's category flag: its fill color and the category name read to screen readers. Null prints no flag. */
  flag?: { color: string; label: string } | null
  children: React.ReactNode
}

/** One ruled row: a round checkbox in the margin, the row's text, then a colored rectangle at the row's right edge. */
export function PadCheckRow({ checked, onToggle, fadeWhenChecked = true, trailing, flag = null, children }: PadCheckRowProps) {
  return (
    <label className="flex cursor-pointer items-center" style={{ height: ROW_PX }}>
      <span className="flex shrink-0 items-center justify-center" style={{ width: MARGIN_PX }}>
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={onToggle} />
        <span
          aria-hidden
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-black"
          style={checked ? { backgroundColor: SP_COLORS.yellow, borderColor: '#00000080' } : { borderColor: '#00000073' }}
        >
          {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} color={INK_COLOR} /> : null}
        </span>
      </span>
      <span
        className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap pl-3 pr-3 text-[16px] ${
          checked && fadeWhenChecked ? 'opacity-45' : ''
        }`}
      >
        {children}
      </span>
      {trailing ? <span className="shrink-0 whitespace-nowrap pr-3 text-[12px] opacity-60">{trailing}</span> : null}
      {/* A row with no flag keeps the flag's width empty, so every row's text ends at the same place. */}
      <span data-pad-flag={flag ? flag.label : undefined} className="h-6 shrink-0" style={{ width: FLAG_WIDTH_PX, backgroundColor: flag?.color }}>
        {flag ? <span className="sr-only">{flag.label}</span> : null}
      </span>
    </label>
  )
}

/** One ruled row with no checkbox, for a line of plain text on the page. */
export function PadNoteRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center text-[15px] italic" style={{ height: ROW_PX, paddingLeft: MARGIN_PX + 12, paddingRight: 12 }}>
      <span className="truncate">{children}</span>
    </div>
  )
}
