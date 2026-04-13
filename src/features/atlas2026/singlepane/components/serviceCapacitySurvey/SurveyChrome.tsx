import React, { useEffect, useMemo, useRef, useState } from 'react'
import { usesLightTextOnZCodeColor } from '@atlas/shared'
import { getScaleOption } from '@/features/atlas2026/singlepane/data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'
import type { PartnerServiceCapacityScaleOption, ZCodeSurveyPrompt } from '@/features/atlas2026/singlepane/types'

export function BurdenCard({
  promptItem,
  scale,
  score,
  notEncountered,
  accentColor,
  currentIndex,
  totalCount,
  hasPrevious,
  hasNext,
  canAdvance,
  onPreviousNavigate,
  onNextNavigate,
  onChange,
  onNotEncounteredChange
}: {
  promptItem: ZCodeSurveyPrompt
  scale: PartnerServiceCapacityScaleOption[]
  score: number | null
  notEncountered: boolean
  accentColor: string
  currentIndex: number
  totalCount: number
  hasPrevious: boolean
  hasNext: boolean
  canAdvance: boolean
  onPreviousNavigate: () => void
  onNextNavigate: () => void
  onChange: (score: number | null) => void
  onNotEncounteredChange: (value: boolean) => void
}) {
  const numericInputRef = useRef<HTMLInputElement | null>(null)
  const previousScoreRef = useRef<number | null>(score)
  const [isPulsing, setIsPulsing] = useState(false)
  const effectiveScore = score ?? 5
  const scaleState = typeof score === 'number' ? getScaleOption(scale, effectiveScore) : null
  const badgeTextColor =
    accentColor === SP_COLORS.yellow || accentColor === SP_COLORS.green ? SP_COLORS.bg : SP_COLORS.white
  const sliderScaleColors = useMemo(
    () => scale.map((option) => (option.value <= 3 ? SP_COLORS.red : option.value <= 6 ? SP_COLORS.yellow : SP_COLORS.deepGreen)),
    [scale]
  )

  useEffect(() => {
    const previousScore = previousScoreRef.current
    if (typeof score === 'number' && score !== previousScore) {
      setIsPulsing(true)
      const timeoutId = window.setTimeout(() => setIsPulsing(false), 420)
      previousScoreRef.current = score
      return () => window.clearTimeout(timeoutId)
    }
    previousScoreRef.current = score
    return undefined
  }, [score])

  function handleSelectScore(nextScore: number) {
    onNotEncounteredChange(false)
    onChange(nextScore)
  }

  function handleNumberInputChange(nextValue: string) {
    if (!nextValue) {
      onChange(null)
      return
    }
    const parsed = Number(nextValue)
    if (!Number.isFinite(parsed)) return
    handleSelectScore(Math.max(1, Math.min(9, Math.round(parsed))))
  }

  return (
    <div className="rounded-[24px] border px-4 py-4 md:px-5 md:py-5" style={{ borderColor: '#ffffff30', borderWidth: '1.5px', backgroundColor: '#050505' }}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4" style={{ borderColor: '#ffffff20' }}>
        <div className="min-w-0 flex-1">
          <small className="block text-[12px] uppercase tracking-[0.14em] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            question {currentIndex + 1} of {totalCount}
          </small>
          <div className="mt-2 flex flex-wrap items-start gap-3 md:gap-4">
            <div className="text-[16px] font-medium leading-none text-white md:text-[18px]">{promptItem.zCode}</div>
            <div className="max-w-[820px] text-[15px] leading-snug text-[#d6d6d6] md:text-[18px]">{promptItem.description}</div>
          </div>
        </div>
        <div
          className={`flex h-12 min-w-[56px] items-center justify-center rounded-full px-3 text-[18px] font-bold leading-none md:h-14 md:min-w-[64px] md:text-[22px] ${
            isPulsing ? 'animate-pulse' : ''
          }`}
          style={{
            backgroundColor: notEncountered ? '#1b1b1b' : accentColor,
            color: notEncountered ? SP_COLORS.muted : badgeTextColor,
            opacity: score == null && !notEncountered ? 0.4 : 1,
            boxShadow: isPulsing ? `0 0 0 1px ${accentColor}, 0 0 24px ${accentColor}44` : 'none'
          }}
        >
          {notEncountered ? 'n/a' : score ?? '--'}
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border px-3 py-3 md:px-4 md:py-4" style={{ borderColor: '#ffffff22', backgroundColor: '#020202' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <small className="text-[12px] uppercase tracking-[0.12em] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            assign a burden score
          </small>
          <button
            type="button"
            onClick={() => {
              const nextValue = !notEncountered
              onNotEncounteredChange(nextValue)
              if (nextValue) {
                onChange(null)
              } else {
                requestAnimationFrame(() => numericInputRef.current?.focus())
              }
            }}
            className="rounded-full border px-3 py-1.5 text-[12px] transition-[border-color,background-color,color] duration-150 ease-out md:text-[13px]"
            style={{
              borderColor: notEncountered ? SP_COLORS.green : '#ffffff2c',
              backgroundColor: notEncountered ? '#0f2117' : 'transparent',
              color: notEncountered ? SP_COLORS.green : SP_COLORS.muted
            }}
          >
            not encountered in our work
          </button>
        </div>

        <div className={`mt-4 ${notEncountered ? 'opacity-45' : ''}`}>
          <input
            type="range"
            min={1}
            max={9}
            step={1}
            disabled={notEncountered}
            value={effectiveScore}
            onChange={(event) => handleSelectScore(Number(event.target.value))}
            className="w-full accent-white disabled:cursor-not-allowed"
          />
          <div className="mt-3 grid grid-cols-9 gap-1.5">
            {scale.map((option, index) => {
              const isSelected = !notEncountered && option.value === score
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={notEncountered}
                  onClick={() => handleSelectScore(option.value)}
                  className={`rounded-[16px] border px-0 py-2 text-[13px] font-semibold transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out md:text-[15px] ${
                    isSelected && isPulsing ? 'animate-pulse' : ''
                  }`}
                  style={{
                    borderColor: isSelected ? accentColor : '#ffffff22',
                    backgroundColor: isSelected ? `${accentColor}18` : '#050505',
                    color: sliderScaleColors[index],
                    boxShadow: isSelected ? `0 0 0 1px ${accentColor}, 0 0 16px ${accentColor}22` : 'none',
                    transform: isSelected ? 'translateY(-1px)' : 'none'
                  }}
                >
                  {option.value}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] md:text-[14px]" style={{ color: SP_COLORS.muted }}>
            <span>value</span>
            <input
              ref={numericInputRef}
              type="number"
              min={1}
              max={9}
              step={1}
              disabled={notEncountered}
              value={score ?? ''}
              onChange={(event) => handleNumberInputChange(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              inputMode="numeric"
              className="w-[72px] rounded-xl border bg-black px-2 py-1 text-center text-[15px] text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ borderColor: '#ffffff30' }}
            />
          </label>
          <div className="min-h-[20px] flex-1 text-[12px] md:text-[14px]" style={{ color: scaleState ? SP_COLORS.white : SP_COLORS.muted }}>
            {notEncountered ? 'This item is marked as not encountered and will be stored without a score.' : scaleState ? `${scaleState.value} - ${scaleState.label}: ${scaleState.description}` : 'Select a value from 1 to 9 by dragging, clicking, or typing.'}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPreviousNavigate}
          disabled={!hasPrevious}
          className="rounded-full border px-3 py-1.5 text-[12px] lowercase md:text-[13px]"
          style={{ borderColor: '#ffffff24', color: SP_COLORS.muted, opacity: hasPrevious ? 1 : 0.35 }}
        >
          back
        </button>
        {hasNext ? (
          <button
            type="button"
            onClick={onNextNavigate}
            disabled={!canAdvance}
            className="rounded-full border px-4 py-2 text-[13px] font-medium md:text-[14px]"
            style={{
              borderColor: SP_COLORS.yellow,
              color: SP_COLORS.yellow,
              opacity: canAdvance ? 1 : 0.45,
              boxShadow: canAdvance ? '0 0 18px rgba(252,192,26,0.12)' : 'none'
            }}
          >
            {'next ->'}
          </button>
        ) : (
          <small className="text-[12px] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            final question
          </small>
        )}
      </div>
    </div>
  )
}

export function SurveyProgressHeader({
  currentIndex,
  totalCount,
  completedCount,
  parentCode,
  parentTheme,
  accentColor
}: {
  currentIndex: number
  totalCount: number
  completedCount: number
  parentCode: string
  parentTheme: string
  accentColor: string
}) {
  const ratio = totalCount ? completedCount / totalCount : 0
  const useLightText = usesLightTextOnZCodeColor(accentColor)

  return (
    <div className="sticky top-0 z-30 mt-5 rounded-[22px] border bg-black/92 px-4 py-3 backdrop-blur-sm md:px-5" style={{ borderColor: '#ffffff24' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <small className="block text-[12px] uppercase tracking-[0.12em] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            survey progress
          </small>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[12px] font-semibold md:text-[13px]"
              style={{
                backgroundColor: accentColor,
                color: useLightText ? SP_COLORS.white : SP_COLORS.bg
              }}
            >
              {parentCode}
            </span>
            <small className="text-[12px] text-[#d5d5d5] md:text-[13px]">{parentTheme}</small>
          </div>
        </div>
        <small className="text-[12px] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
          {Math.min(currentIndex + 1, totalCount)} of {totalCount} viewed | {completedCount} completed
        </small>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%`, backgroundColor: accentColor }}
        />
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
