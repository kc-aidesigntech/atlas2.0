import React from 'react'
import feedbackCycleIcon from '../assets/navigation-cards/feedback-cycle.png'
import selfReflectionIcon from '../assets/navigation-cards/self-reflection.png'
import createShareIcon from '../assets/navigation-cards/create-share.png'

type CardVariant = 'green' | 'blue'
type CardIllustration = 'feedback' | 'reflection' | 'create'

interface ProfileNavigationCardProps {
  sequenceNumber: number
  title: string
  subtitle: string
  actionLabel: string
  variant: CardVariant
  illustration: CardIllustration
  ticketId?: string
  onClick: () => void
}

const SECTION_LOGO_PATH = '/section1logo.png'

const VARIANT_STYLES: Record<CardVariant, { accent: string; accentSoft: string }> = {
  green: { accent: '#4aa52e', accentSoft: '#2e7f1f' },
  blue: { accent: '#0f5ba9', accentSoft: '#0b4280' }
}

const ILLUSTRATION_BY_KEY: Record<CardIllustration, string> = {
  feedback: feedbackCycleIcon,
  reflection: selfReflectionIcon,
  create: createShareIcon
}

export default function ProfileNavigationCard({
  sequenceNumber,
  title,
  subtitle,
  actionLabel,
  variant,
  illustration,
  ticketId = 'NAV-0017',
  onClick
}: ProfileNavigationCardProps) {
  const style = VARIANT_STYLES[variant]
  const illustrationSrc = ILLUSTRATION_BY_KEY[illustration]
  const cornerChamferPx = 22

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative mx-auto flex h-[248px] w-full max-w-[400px] overflow-hidden rounded-[24px] border border-[#d8d8d8] bg-[#f7f7f7] text-left text-[#0f1115] shadow-[0_14px_24px_rgba(0,0,0,0.35)] transition hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      // Match the physical-card motif: keep rounded corners but chamfer the top-right corner.
      style={{ clipPath: `polygon(0 0, calc(100% - ${cornerChamferPx}px) 0, 100% ${cornerChamferPx}px, 100% 100%, 0 100%)` }}
      aria-label={`${title} card`}
    >
      {/* Keep fixed geometry so all role menus share one physical-card silhouette. */}
      <div className="absolute inset-y-0 left-0 w-[10px]" style={{ backgroundColor: style.accent }} />
      <div className="absolute left-0 top-[112px] h-[24px] w-[24px] rounded-r-full bg-black" />

      <div className="absolute left-[22px] top-[16px] flex h-[42px] w-[42px] items-center justify-center rounded-full text-[26px] font-bold leading-none text-white" style={{ backgroundColor: style.accent }}>
        {sequenceNumber}
      </div>

      <div className="absolute right-[22px] top-[20px] text-[14px] font-semibold tracking-[0.02em] text-[#121317]">
        {ticketId}
      </div>

      <div className="absolute left-[44px] right-[164px] top-[88px]">
        <div className="text-[16px] font-bold leading-[1.15] tracking-[-0.01em] text-[#101215]">{title}</div>
        <div className="mt-[2px] text-[13px] font-medium leading-[1.15] tracking-[-0.005em] text-[#1f2024]">{subtitle}</div>
      </div>

      <img src={illustrationSrc} alt="" className="absolute right-[20px] top-[48px] h-[130px] w-[140px] object-contain" />

      <div className="absolute inset-x-0 top-[178px] flex h-[38px] items-center bg-[#020304] pl-[18px] pr-[18px]">
        <span className="mr-[10px] text-[30px] leading-none" style={{ color: style.accent }}>←</span>
        <span className="text-[10px] font-semibold leading-none tracking-[0.025em] text-[#f5f5f5]">{actionLabel}</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex h-[32px] items-center justify-between px-[14px]">
        <div className="flex items-center gap-[7px]">
          <img src={SECTION_LOGO_PATH} alt="" className="h-[20px] w-[20px] object-contain" />
          <span className="text-[11px] font-semibold leading-none tracking-[0.01em] text-[#111317]">for atlas use only</span>
        </div>
        <div className="flex items-center gap-[8px]">
          <span className="text-[11px] font-medium leading-none tracking-[0.02em]" style={{ color: style.accentSoft }}>insert this way</span>
          <span className="text-[22px] font-semibold leading-none tracking-[0.01em]" style={{ color: style.accent }}>‹‹‹</span>
        </div>
      </div>
    </button>
  )
}
