/**
 * Shared Atlas (ATLAS) User Interface (UI) primitives used by single-pane screens to keep panel/button
 * behavior and visual semantics consistent across feature modules.
 */
import React from 'react'
import { X } from 'lucide-react'

const ATLAS_LUCID_GREEN = '#81bc36'
const ATLAS_DEFAULT_BUTTON_ACCENT = 'var(--atlas-signal-lucid-teal)'

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

type ButtonStyle = React.CSSProperties & Record<string, string | number | undefined>

function readStyleValue(style: React.CSSProperties | undefined, key: string) {
  const value = (style as ButtonStyle | undefined)?.[key]
  return typeof value === 'string' ? value : undefined
}

function stripAlphaChannel(color: string) {
  const normalized = color.trim()
  if (/^#[\da-fA-F]{8}$/.test(normalized)) return normalized.slice(0, 7)
  if (/^#[\da-fA-F]{4}$/.test(normalized)) return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`

  const rgbaMatch = normalized.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*[\d.]+\s*\)$/i)
  if (rgbaMatch) return `rgb(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]})`

  return normalized
}

function readAlphaChannel(color: string) {
  const normalized = color.trim()
  const hexMatch = normalized.match(/^#([\da-fA-F]{8})$/)
  if (hexMatch) return Number.parseInt(hexMatch[1].slice(6, 8), 16) / 255

  const shortHexMatch = normalized.match(/^#([\da-fA-F]{4})$/)
  if (shortHexMatch) return Number.parseInt(`${shortHexMatch[1][3]}${shortHexMatch[1][3]}`, 16) / 255

  const rgbaMatch = normalized.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i)
  if (rgbaMatch) return Number.parseFloat(rgbaMatch[1])

  return 1
}

function parseRgbChannels(color: string) {
  const normalized = stripAlphaChannel(color)
  const hexMatch = normalized.match(/^#([\da-fA-F]{6})$/)
  if (hexMatch) {
    const hex = hexMatch[1]
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16)
    }
  }

  const rgbMatch = normalized.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i)
  if (rgbMatch) {
    return {
      r: Number.parseFloat(rgbMatch[1]),
      g: Number.parseFloat(rgbMatch[2]),
      b: Number.parseFloat(rgbMatch[3])
    }
  }

  return null
}

function isWhiteLikeColor(color: string) {
  if (/white/i.test(color)) return true
  const channels = parseRgbChannels(color)
  if (!channels) return false
  return channels.r > 228 && channels.g > 228 && channels.b > 228
}

function isLucidGreenColor(color: string) {
  const normalized = color.trim().toLowerCase()
  if (normalized.includes('atlas-signal-lucid-green')) return true
  return stripAlphaChannel(color).toLowerCase() === ATLAS_LUCID_GREEN
}

function getContrastTextColor(fillColor: string) {
  if (isLucidGreenColor(fillColor)) return '#111111'
  if (/yellow/i.test(fillColor)) return '#111111'
  const channels = parseRgbChannels(fillColor)
  if (!channels) return '#ffffff'
  const luminance = (0.2126 * channels.r + 0.7152 * channels.g + 0.0722 * channels.b) / 255
  return luminance > 0.64 ? '#111111' : '#ffffff'
}

function resolveSolidButtonStyle(style: React.CSSProperties | undefined) {
  const nextStyle: ButtonStyle = { ...(style as ButtonStyle | undefined) }
  const accent = readStyleValue(style, '--button-border-color') ?? readStyleValue(style, 'borderColor') ?? ATLAS_DEFAULT_BUTTON_ACCENT
  const explicitFill = readStyleValue(style, '--button-fill-color') ?? readStyleValue(style, 'backgroundColor')
  const solidAccent = stripAlphaChannel(accent)
  const accentAlpha = readAlphaChannel(accent)
  const isNeutralUnselected = isWhiteLikeColor(solidAccent) && accentAlpha < 0.55
  const fill = explicitFill ? stripAlphaChannel(explicitFill) : isNeutralUnselected ? '#181b20' : isWhiteLikeColor(solidAccent) ? '#ffffff' : solidAccent
  const explicitTextColor = readStyleValue(style, 'color')
  const explicitLineColor = readStyleValue(style, '--button-line-color')
  const legacyOutlineColor = explicitTextColor && stripAlphaChannel(explicitTextColor) === solidAccent
  const lineMatchesFill = explicitLineColor && stripAlphaChannel(explicitLineColor) === stripAlphaChannel(fill)
  const foreground =
    readStyleValue(style, '--button-foreground-color') ??
    (!explicitTextColor || legacyOutlineColor ? getContrastTextColor(fill) : explicitTextColor)

  nextStyle['--button-border-color'] = accent
  nextStyle['--button-fill-color'] = fill
  nextStyle['--button-line-color'] = !explicitLineColor || lineMatchesFill ? foreground : explicitLineColor
  nextStyle['--button-line-opacity'] = readStyleValue(style, '--button-line-opacity') ?? (isNeutralUnselected ? '0.18' : '0.28')
  nextStyle.color = foreground
  nextStyle.backgroundColor = fill
  return nextStyle
}

interface AtlasPanelProps {
  kicker?: string
  title?: string
  description?: string
  actions?: React.ReactNode
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

export function AtlasOverline({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return <small className={cn('atlas-overline block', className)}>{children}</small>
}

export function AtlasMetaText({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return <small className={cn('atlas-meta', className)}>{children}</small>
}

export function AtlasBodyText({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return <p className={cn('atlas-body', className)}>{children}</p>
}

export function AtlasPanel({
  kicker,
  title,
  description,
  actions,
  className,
  contentClassName,
  children
}: AtlasPanelProps) {
  return (
    <section className={cn('atlas-surface-panel text-white', className)}>
      {(kicker || title || description || actions) && (
        <div className="atlas-divider flex flex-wrap items-start justify-between gap-4 border-b px-6 pb-4 pt-6">
          <div className="min-w-0 flex-1">
            {kicker ? <AtlasOverline>{kicker}</AtlasOverline> : null}
            {title ? <h3 className="atlas-panel-title mt-1">{title}</h3> : null}
            {description ? <small className="atlas-panel-copy mt-1 block">{description}</small> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      <div className={cn(kicker || title || description || actions ? 'p-6 pt-5' : 'p-6', contentClassName)}>
        {children}
      </div>
    </section>
  )
}

export function AtlasInsetCard({
  className,
  children
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('atlas-surface-raised px-4 py-3', className)}>{children}</div>
}

export function AtlasMetricPill({
  label,
  value,
  accentColor,
  className
}: {
  label: string
  value: React.ReactNode
  accentColor?: string
  className?: string
}) {
  return (
    <AtlasInsetCard className={cn('px-3 py-2', className)}>
      <small className="atlas-overline block">{label}</small>
      <small className="mt-1 block text-base font-black text-white" style={accentColor ? { color: accentColor } : undefined}>
        {value}
      </small>
    </AtlasInsetCard>
  )
}

export function AtlasStatusPill({
  children,
  color,
  className
}: {
  children: React.ReactNode
  color: string
  className?: string
}) {
  return (
    <span
      className={cn('atlas-utility inline-flex items-center rounded-full border px-2.5 py-1 md:text-[12px]', className)}
      style={{ borderColor: `${color}90`, color }}
    >
      {children}
    </span>
  )
}

// Button primitives below intentionally share sign-button treatment so hover,
// focus, and disabled behavior stay uniform across all shell actions.
export function AtlasIconBadge({
  children,
  color,
  className
}: {
  children: React.ReactNode
  color?: string
  className?: string
}) {
  return (
    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[var(--surface-panel-raised)]', className)} style={color ? { color } : undefined}>
      {children}
    </div>
  )
}

export function AtlasPlusButton({
  onClick,
  label,
  title,
  disabled = false,
  className
}: {
  onClick?: () => void
  label: string
  title?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <AtlasIconButton
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={cn('h-12 w-12 text-[29px] font-light', className)}
      style={{ ['--button-border-color' as const]: '#ffffff', color: '#111111' } as React.CSSProperties}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </AtlasIconButton>
  )
}

export function AtlasCloseButton({
  onClick,
  title = 'close',
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  title?: string
}) {
  return (
    <AtlasIconButton
      onClick={onClick}
      aria-label={title}
      title={title}
      className={cn('h-11 w-11 text-white', className)}
      {...props}
    >
      <X className="h-5 w-5" strokeWidth={2.1} />
    </AtlasIconButton>
  )
}

export const AtlasTextButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function AtlasTextButton(
  { className, children, type = 'button', style, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      {...props}
      style={resolveSolidButtonStyle(style)}
      className={cn(
        'atlas-sign-button atlas-font-body [--button-line-inset:0px] [--button-line-top:8px] [--button-radius:6px] rounded-[6px] border px-[14px] text-[14px] font-medium transition-[box-shadow,border-color,opacity,filter] duration-150 ease-out hover:border-white/60 hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_22px_rgba(255,255,255,0.14)] disabled:opacity-60 disabled:hover:brightness-100 disabled:hover:shadow-none md:text-[17px]',
        className
      )}
    >
      {children}
    </button>
  )
})

export const AtlasIconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function AtlasIconButton(
  { className, children, type = 'button', style, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      {...props}
      style={resolveSolidButtonStyle(style)}
      className={cn(
        'atlas-sign-button atlas-sign-button-icon [--button-line-inset:6px] [--button-radius:10px] inline-flex h-10 w-10 items-center justify-center rounded-[10px] border transition-[box-shadow,border-color,opacity,filter] duration-150 ease-out hover:border-white/60 hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_18px_rgba(255,255,255,0.1)] disabled:opacity-60 disabled:hover:brightness-100 disabled:hover:shadow-none',
        className
      )}
    >
      {children}
    </button>
  )
})

export const AtlasTextLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function AtlasTextLink(
  { className, children, style, ...props },
  ref
) {
  return (
    <a
      ref={ref}
      {...props}
      style={resolveSolidButtonStyle(style)}
      className={cn(
        'atlas-sign-button atlas-font-body [--button-line-inset:0px] [--button-line-top:8px] [--button-radius:6px] rounded-[6px] border px-[14px] text-[14px] font-medium transition-[box-shadow,border-color,opacity,filter] duration-150 ease-out hover:border-white/60 hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_22px_rgba(255,255,255,0.14)] md:text-[17px]',
        className
      )}
    >
      {children}
    </a>
  )
})
