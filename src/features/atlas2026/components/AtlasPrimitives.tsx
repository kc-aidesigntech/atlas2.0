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
    <section className={cn('rounded-2xl border border-white/15 bg-[#0d0d0d] text-white', className)}>
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
  return <div className={cn('rounded-[20px] border border-white/15 bg-black/80 px-4 py-3', className)}>{children}</div>
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
    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black', className)} style={color ? { color } : undefined}>
      {children}
    </div>
  )
}
