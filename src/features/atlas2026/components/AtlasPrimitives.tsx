import React from 'react'

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
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
    <section className={cn('rounded-2xl border border-white/15 bg-[var(--surface-panel-soft)] text-white', className)}>
      {(kicker || title || description || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-6 pb-4 pt-6">
          <div className="min-w-0 flex-1">
            {kicker ? <small className="block text-xs font-black tracking-[0.12em] text-[var(--foreground-secondary)]">{kicker}</small> : null}
            {title ? <h3 className="mt-1 text-[28px] font-medium text-white md:text-[34px]">{title}</h3> : null}
            {description ? <small className="mt-1 block text-[14px] text-[var(--foreground-secondary)] md:text-[17px]">{description}</small> : null}
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
  return <div className={cn('rounded-[20px] border border-white/15 bg-[var(--surface-panel-raised)] px-4 py-3', className)}>{children}</div>
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
      <small className="block text-[11px] uppercase tracking-[0.12em] text-[var(--foreground-secondary)]">{label}</small>
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
      className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] md:text-[12px]', className)}
      style={{ borderColor: `${color}90`, color }}
    >
      {children}
    </span>
  )
}

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
      className={cn('h-10 w-10 text-[24px] font-light', className)}
      style={{ ['--button-border-color' as const]: 'var(--atlas-signal-yellow)', color: 'var(--atlas-signal-yellow)' } as React.CSSProperties}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.9" strokeLinecap="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </AtlasIconButton>
  )
}

export const AtlasTextButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function AtlasTextButton(
  { className, children, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      {...props}
      className={cn(
        'atlas-sign-button [--button-line-inset:8px] [--button-radius:10px] rounded-[10px] border transition-[box-shadow,border-color,opacity,filter] duration-150 ease-out hover:border-white/60 hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_22px_rgba(255,255,255,0.14)] disabled:opacity-60 disabled:hover:brightness-100 disabled:hover:shadow-none',
        className
      )}
    >
      {children}
    </button>
  )
})

export const AtlasIconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function AtlasIconButton(
  { className, children, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      {...props}
      className={cn(
        'atlas-sign-button atlas-sign-button-icon [--button-line-inset:6px] [--button-radius:10px] inline-flex h-8 w-8 items-center justify-center rounded-[10px] border transition-[box-shadow,border-color,opacity,filter] duration-150 ease-out hover:border-white/60 hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_18px_rgba(255,255,255,0.1)] disabled:opacity-60 disabled:hover:brightness-100 disabled:hover:shadow-none',
        className
      )}
    >
      {children}
    </button>
  )
})

export const AtlasTextLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function AtlasTextLink(
  { className, children, ...props },
  ref
) {
  return (
    <a
      ref={ref}
      {...props}
      className={cn(
        'atlas-sign-button [--button-line-inset:8px] [--button-radius:10px] rounded-[10px] border transition-[box-shadow,border-color,opacity,filter] duration-150 ease-out hover:border-white/60 hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_22px_rgba(255,255,255,0.14)]',
        className
      )}
    >
      {children}
    </a>
  )
})
