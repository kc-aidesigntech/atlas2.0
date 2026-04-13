import React, { useEffect, useRef, useState } from 'react'
import { usesLightTextOnZCodeColor } from '@atlas/shared'
import { getScaleOption } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { PartnerServiceCapacityScaleOption, ZCodeSurveyPrompt } from '@/features/atlas2026/singlepane/types'

const downArrowUrl = new URL('../../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png', import.meta.url).toString()

export function BurdenCard({
  promptItem,
  scale,
  score,
  accentColor,
  cardRef,
  inputRef,
  onTabNavigate,
  onArrowNavigate,
  onChange
}: {
  promptItem: ZCodeSurveyPrompt
  scale: PartnerServiceCapacityScaleOption[]
  score: number | null
  accentColor: string
  cardRef?: (element: HTMLDivElement | null) => void
  inputRef?: (element: HTMLInputElement | null) => void
  onTabNavigate: (direction: 1 | -1) => boolean
  onArrowNavigate: () => boolean
  onChange: (score: number | null) => void
}) {
  const effectiveScore = score ?? 5
  const scaleState = getScaleOption(scale, effectiveScore)
  const thumbPercent = ((effectiveScore - 1) / 8) * 100
  const badgeTextColor =
    accentColor === SP_COLORS.yellow || accentColor === SP_COLORS.green ? SP_COLORS.bg : SP_COLORS.white
  const tooltipHalfWidth = 110
  const tooltipLeft = `clamp(${tooltipHalfWidth}px, ${thumbPercent}%, calc(100% - ${tooltipHalfWidth}px))`
  const sliderScaleColors = scale.map((option) =>
    option.value <= 3 ? SP_COLORS.red : option.value <= 6 ? SP_COLORS.yellow : SP_COLORS.deepGreen
  )
  const localInputRef = useRef<HTMLInputElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const tooltipReservedHeight = score == null ? 0 : Math.max(tooltipHeight, 62)

  const setNumericInputRef = React.useCallback(
    (element: HTMLInputElement | null) => {
      localInputRef.current = element
      inputRef?.(element)
    },
    [inputRef]
  )

  function focusNumericInput() {
    const target = localInputRef.current
    if (!target) return
    target.focus()
    target.select()
  }

  function handleNumberInputChange(nextValue: string) {
    if (!nextValue) {
      onChange(null)
      return
    }
    const parsed = Number(nextValue)
    if (!Number.isFinite(parsed)) return
    onChange(Math.max(1, Math.min(9, Math.round(parsed))))
  }

  function handleCardClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      focusNumericInput()
      return
    }

    if (target.closest('button, input, label')) return
    focusNumericInput()
  }

  useEffect(() => {
    if (score == null) {
      setTooltipHeight(0)
      return
    }

    const tooltip = tooltipRef.current
    if (!tooltip) return

    const updateHeight = () => {
      setTooltipHeight(tooltip.offsetHeight)
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateHeight)
    observer.observe(tooltip)
    return () => observer.disconnect()
  }, [score, scaleState.description, scaleState.label])

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      className="relative scroll-mt-5 rounded-[22px] border px-4 pb-3 pt-3 transition-[box-shadow,border-color] duration-150 ease-out hover:border-white/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_24px_rgba(255,255,255,0.08)] focus-within:border-white/50 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_28px_rgba(255,255,255,0.1)] active:border-white/45 active:shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_26px_rgba(255,255,255,0.09)] md:px-5 md:pb-3.5 md:scroll-mt-6"
      style={{ borderColor: '#ffffff30', borderWidth: '1.5px', backgroundColor: '#050505' }}
    >
      <div
        className="flex items-start justify-between gap-3 border-b pb-3 md:gap-4 md:pb-3.5"
        style={{ borderColor: '#ffffff40', borderBottomWidth: '1.5px' }}
      >
        <div className="min-w-0 flex flex-1 items-baseline gap-3 md:gap-4">
          <div className="w-[88px] shrink-0 text-[14px] font-medium leading-none text-white md:w-[104px] md:text-[16px]">
            {promptItem.zCode}
          </div>
          <div className="min-w-0 flex-1 pr-2 text-[13px] leading-tight text-[#d6d6d6] md:text-[15px]">
            {promptItem.description}
          </div>
        </div>
        <div className="flex shrink-0 items-start">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-[24px] font-bold leading-none md:h-11 md:w-11 md:text-[30px]"
            style={{
              backgroundColor: accentColor,
              color: badgeTextColor,
              opacity: score == null ? 0.35 : 1
            }}
          >
            {score ?? ''}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-start md:gap-4 md:pt-3.5">
        <div className="hidden w-[88px] shrink-0 sm:block md:w-[104px]" />
        <div className="min-w-0 flex-1">
          <div
            className="relative transition-[padding-top] duration-200 ease-out md:duration-300"
            style={{ paddingTop: score == null ? 0 : tooltipReservedHeight + 8 }}
          >
            {score == null ? null : (
              <div
                ref={tooltipRef}
                className="pointer-events-none absolute top-0 z-10 w-[220px] max-w-[calc(100%-8px)] -translate-x-1/2 rounded-[16px] border px-3 py-2 transition-[left,opacity] duration-200 ease-out md:duration-300"
                style={{
                  left: tooltipLeft,
                  borderColor: '#ffffff25',
                  backgroundColor: '#080808'
                }}
              >
                <small className="block text-[11px] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
                  {scaleState.value} - {scaleState.label}
                </small>
                <small className="block text-[11px] text-white md:text-[13px]">{scaleState.description}</small>
              </div>
            )}

            <div
              className="rounded-[20px] border px-3 py-2.5 md:px-3.5 md:py-3"
              style={{ borderColor: '#ffffff26', borderWidth: '1.5px', backgroundColor: '#020202' }}
            >
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className={`relative h-6 overflow-visible ${score == null ? 'opacity-55' : ''}`}>
                    <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-white/50" />
                    {score == null ? null : (
                      <div
                        className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{
                          left: `${thumbPercent}%`,
                          backgroundColor: '#f3f4f6',
                          border: '1.5px solid rgba(255,255,255,0.85)',
                          boxShadow: '0 0 0 1px rgba(0,0,0,0.18)'
                        }}
                      />
                    )}
                    <input
                      type="range"
                      min={1}
                      max={9}
                      step={1}
                      value={effectiveScore}
                      onChange={(event) => onChange(Number(event.target.value))}
                      tabIndex={-1}
                      className="absolute inset-0 h-6 w-full cursor-pointer opacity-0"
                    />
                  </div>
                  <div className="relative mt-1.5 h-4 overflow-visible text-[10px] md:h-[18px] md:text-[11px]">
                    {scale.map((option, index) => (
                      <span
                        key={option.value}
                        className="absolute top-0 leading-none"
                        style={{
                          left: `${((option.value - 1) / 8) * 100}%`,
                          transform: 'translateX(-50%)',
                          color: sliderScaleColors[index]
                        }}
                      >
                        {option.value}
                      </span>
                    ))}
                  </div>
                </div>
                <label className="ml-2 flex items-center gap-2 text-[12px] sm:ml-3 sm:pt-0.5 md:text-[14px]" style={{ color: SP_COLORS.muted }}>
                  <span>value</span>
                  <input
                    ref={setNumericInputRef}
                    type="number"
                    min={1}
                    max={9}
                    step={1}
                    value={score ?? ''}
                    onChange={(event) => handleNumberInputChange(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      if (event.key !== 'Tab') return
                      if (onTabNavigate(event.shiftKey ? -1 : 1)) {
                        event.preventDefault()
                      }
                    }}
                    inputMode="numeric"
                    className="w-[64px] rounded-xl border bg-black px-2 py-1 text-center text-[14px] text-white md:text-[15px]"
                    style={{ borderColor: '#ffffff30' }}
                  />
                </label>
              </div>
              {score == null ? (
                <small className="mt-2 block text-[11px] text-[#8f8f8f] md:text-[12px]">
                  Select a rating from 1 to 9 to capture this capability.
                </small>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 self-end flex-col items-center gap-2 pt-1 sm:self-start sm:pl-2">
          <button
            type="button"
            onClick={onArrowNavigate}
            className="rounded-full p-1 transition-[box-shadow,opacity,background-color] duration-150 ease-out hover:bg-white/5 hover:opacity-100 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_18px_rgba(255,255,255,0.12)] focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/5 focus:shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_18px_rgba(255,255,255,0.12)] active:bg-white/5 active:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_16px_rgba(255,255,255,0.1)]"
            aria-label={`Jump to next card after ${promptItem.zCode}`}
          >
            <img
              src={downArrowUrl}
              alt=""
              aria-hidden="true"
              className="h-16 w-7 rotate-180 object-contain opacity-70 md:h-20 md:w-8"
            />
          </button>
        </div>
      </div>
    </div>
  )
}

export function SurveyProgressHeader({
  sectionProgress,
  onSelectSection
}: {
  sectionProgress: Array<{
    parentCode: string
    accentColor: string
    total: number
    completed: number
    ratio: number
  }>
  onSelectSection: (parentCode: string) => void
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const headerHeightClass = 'h-[86px] sm:h-[92px]'

  useEffect(() => {
    function updatePinnedState() {
      const sentinel = sentinelRef.current
      if (!sentinel) return
      setIsPinned(sentinel.getBoundingClientRect().top <= 0)
    }

    updatePinnedState()
    window.addEventListener('scroll', updatePinnedState, { passive: true })
    window.addEventListener('resize', updatePinnedState)

    return () => {
      window.removeEventListener('scroll', updatePinnedState)
      window.removeEventListener('resize', updatePinnedState)
    }
  }, [])

  return (
    <>
      <div ref={sentinelRef} className="mt-6" aria-hidden="true" />
      <div className={isPinned ? headerHeightClass : ''} aria-hidden="true" />
      <div className={isPinned ? 'fixed left-0 right-0 top-0 z-[70]' : 'relative z-30'}>
        <div
          className={`w-full border-b bg-black/95 backdrop-blur-sm ${headerHeightClass}`}
          style={{ borderColor: '#ffffff24' }}
        >
          <div className="mx-auto flex h-full w-full max-w-[1320px] items-center px-2 sm:px-3 md:px-6">
            <div className="grid w-full grid-cols-9 items-start justify-items-center gap-1.5 sm:gap-2 md:gap-3">
              {sectionProgress.map((section) => (
                <button
                  key={section.parentCode}
                  type="button"
                  onClick={() => onSelectSection(section.parentCode)}
                  className="flex min-w-0 w-full flex-col items-center gap-1 rounded-[18px] px-0.5 py-1 transition-[box-shadow,background-color] duration-150 ease-out hover:bg-white/5 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.14)]"
                >
                  <ProgressCircle
                    label={section.parentCode.replace(/^Z/i, '')}
                    accentColor={section.accentColor}
                    ratio={section.ratio}
                    isComplete={section.completed === section.total}
                  />
                  <small className="text-[clamp(8px,1.9vw,11px)] tracking-[0.04em]" style={{ color: SP_COLORS.muted }}>
                    {section.completed}/{section.total}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function ProgressCircle({
  label,
  accentColor,
  ratio,
  isComplete
}: {
  label: string
  accentColor: string
  ratio: number
  isComplete: boolean
}) {
  const size = 54
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, ratio)))
  const useLightText = usesLightTextOnZCodeColor(accentColor)

  return (
    <div className="relative h-[clamp(34px,6.1vw,54px)] w-[clamp(34px,6.1vw,54px)]">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div
        className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[clamp(14px,3vw,22px)] font-bold leading-none ${
          isComplete ? (useLightText ? 'text-white' : 'text-black') : ''
        }`}
        style={{
          width: 'calc(100% - 10px)',
          height: 'calc(100% - 10px)',
          backgroundColor: isComplete ? accentColor : '#050505',
          color: isComplete ? (useLightText ? SP_COLORS.white : SP_COLORS.bg) : accentColor,
          border: `1.5px solid ${isComplete ? accentColor : '#ffffff26'}`
        }}
      >
        {label}
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  requiredHint
}: {
  label: string
  children: React.ReactNode
  requiredHint?: string
}) {
  return (
    <label className="block text-[12px] text-[#bcbcbc] md:text-[14px]">
      <span>{label}</span>
      {requiredHint ? <small className="mt-1 block text-[11px] text-[#8f8f8f] md:text-[13px]">{requiredHint}</small> : null}
      <div className="mt-2">{children}</div>
    </label>
  )
}

export function Input({
  value,
  placeholder,
  onChange,
  inputRef
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <input
      ref={inputRef}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border bg-black px-3 py-2 text-[14px] text-white md:text-[16px]"
      style={{ borderColor: '#ffffff30' }}
    />
  )
}
