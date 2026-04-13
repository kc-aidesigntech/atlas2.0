import React, { useEffect, useMemo, useRef, useState } from 'react'
import { usesLightTextOnZCodeColor } from '@atlas/shared'
import { getScaleOption } from '../../data/serviceCapacitySurveyCatalog'
import { SP_COLORS } from '../../theme'
import type { PartnerServiceCapacityScaleOption, ZCodeSurveyPrompt } from '../../types'
import arrowIconUrl from '../../../../../../assets/up-arrow-icon-symbol-sign-north-point-ahead-above-vector-47696729.png'

export interface SurveySectionProgressItem {
  parentCode: string
  total: number
  completed: number
  accentColor: string
  isCurrent: boolean
}

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
  canResume,
  compact,
  onPreviousNavigate,
  onNextNavigate,
  onResumeNavigate,
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
  canResume: boolean
  compact?: boolean
  onPreviousNavigate: () => void
  onNextNavigate: () => void
  onResumeNavigate: () => void
  onChange: (score: number | null) => void
  onNotEncounteredChange: (value: boolean) => void
}) {
  const numericInputRef = useRef<HTMLInputElement | null>(null)
  const previousScoreRef = useRef<number | null>(score)
  const [isPulsing, setIsPulsing] = useState(false)
  const effectiveScore = typeof score === 'number' && score >= 1 && score <= 9 ? score : 5
  const scaleState = typeof score === 'number' && score >= 1 && score <= 9 ? getScaleOption(scale, effectiveScore) : null
  const thumbPercent = ((effectiveScore - 1) / 8) * 100
  const badgeTextColor =
    accentColor === SP_COLORS.yellow || accentColor === SP_COLORS.green ? SP_COLORS.bg : SP_COLORS.white
  const sliderScaleColors = useMemo(() => scale.map((option) => {
    if (option.value <= 3) return SP_COLORS.red
    if (option.value <= 6) return SP_COLORS.yellow
    return SP_COLORS.deepGreen
  }), [scale])

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-1',hypothesisId:'H4',location:'SurveyChrome.tsx:67',message:'burden card navigation state',data:{promptId:promptItem.id,zCode:promptItem.zCode,score,notEncountered,hasPrevious,hasNext,canAdvance,canResume,compact:Boolean(compact),currentIndex,totalCount},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [canAdvance, canResume, compact, currentIndex, hasNext, hasPrevious, notEncountered, promptItem.id, promptItem.zCode, score, totalCount])

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
    <div
      className={`rounded-[16px] border transition-[padding,border-radius,transform,height] duration-500 ease-out ${
        compact ? 'flex h-full min-h-0 flex-col px-3 py-3 md:px-4 md:py-4' : 'px-4 py-4 md:px-5 md:py-5'
      }`}
      style={{ borderColor: '#ffffff30', borderWidth: '1.5px', backgroundColor: '#050505' }}
    >
      <div className={`flex flex-wrap items-start justify-between gap-3 border-b ${compact ? 'pb-2.5' : 'pb-4'}`} style={{ borderColor: '#ffffff20' }}>
        <div className="min-w-0 flex-1">
          <small className="block text-[12px] uppercase tracking-[0.14em] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            question {currentIndex + 1} of {totalCount}
          </small>
          <div className={`mt-2 grid items-center gap-y-1.5 text-left ${compact ? 'grid-cols-[64px_minmax(0,1fr)] gap-x-3 md:grid-cols-[78px_minmax(0,1fr)] md:gap-x-3.5' : 'grid-cols-[72px_minmax(0,1fr)] gap-x-3 md:grid-cols-[88px_minmax(0,1fr)] md:gap-x-4'}`}>
            <div className="text-[16px] font-medium leading-none text-white md:text-[18px]">{promptItem.zCode}</div>
            <div className="text-[15px] leading-snug text-[#d6d6d6] md:text-[18px]">{promptItem.description}</div>
          </div>
        </div>
        <div
          className={`flex items-center justify-center rounded-full px-3 font-bold leading-none ${
            compact ? 'h-11 min-w-[52px] text-[17px] md:h-12 md:min-w-[58px] md:text-[20px]' : 'h-12 min-w-[56px] text-[18px] md:h-14 md:min-w-[64px] md:text-[22px]'
          } ${
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

      <div
        className={`${compact ? 'mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[14px] px-3 py-3 pr-2.5 md:px-3.5 md:py-3.5 md:pr-3' : 'mt-4 rounded-[16px] px-3 py-3 md:px-4 md:py-4'} border`}
        style={{ borderColor: '#ffffff22', backgroundColor: '#020202' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <small className="text-[12px] uppercase tracking-[0.12em] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            assign a burden score
          </small>
          <button
            type="button"
            onClick={() => {
              const nextValue = !notEncountered
              onNotEncounteredChange(nextValue)
              if (!nextValue) {
                requestAnimationFrame(() => numericInputRef.current?.focus())
              }
            }}
            className={`atlas-sign-button [--button-line-inset:8px] [--button-radius:10px] rounded-[10px] border transition-[border-color,background-color,color,box-shadow] duration-150 ease-out ${
              compact ? 'px-2.5 py-1 text-[11px] md:text-[12px]' : 'px-3 py-1.5 text-[12px] md:text-[13px]'
            }`}
            style={{
              ['--button-border-color' as const]: notEncountered ? SP_COLORS.green : '#ffffff2c',
              backgroundColor: notEncountered ? `${SP_COLORS.green}20` : 'transparent',
              color: notEncountered ? SP_COLORS.green : SP_COLORS.muted,
              boxShadow: notEncountered ? `0 0 0 1px ${SP_COLORS.green}55, 0 0 18px ${SP_COLORS.green}30` : 'none'
            } as React.CSSProperties}
          >
            not encountered in our work
          </button>
        </div>

        <div className={`${compact ? 'mt-3.5' : 'mt-4'} ${notEncountered ? 'opacity-45' : ''}`}>
          <div className={`relative ${compact ? 'h-5' : 'h-6'}`}>
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-white/20" />
            <div
              className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.18)] transition-[left,opacity] duration-150 ease-out ${
                compact ? 'h-[13px] w-[13px]' : 'h-[15px] w-[15px]'
              }`}
              style={{ left: `${thumbPercent}%`, opacity: score == null && !notEncountered ? 0.45 : 1 }}
            />
            <input
              type="range"
              min={1}
              max={9}
              step={1}
              disabled={notEncountered}
              value={effectiveScore}
              onChange={(event) => handleSelectScore(Number(event.target.value))}
              className={`absolute inset-0 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed ${compact ? 'h-5' : 'h-6'}`}
            />
          </div>
          <div className={`${compact ? 'mt-2.5' : 'mt-3'} grid grid-cols-9`}>
            {scale.map((option, index) => {
              const isSelected = !notEncountered && option.value === score
              const selectedColor = sliderScaleColors[index]
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={notEncountered}
                  onClick={() => handleSelectScore(option.value)}
                  className={`atlas-sign-button [--button-line-inset:8px] [--button-radius:11px] rounded-[11px] border px-0 font-semibold transition-[transform,box-shadow,border-color,background-color,color] duration-150 ease-out ${
                    compact ? 'mx-[2px] py-1.5 text-[12px] md:mx-[3px] md:py-[7px] md:text-[14px]' : 'mx-[3px] py-2 text-[13px] md:mx-[4px] md:text-[15px]'
                  } ${
                    isSelected && isPulsing ? 'animate-pulse' : ''
                  }`}
                  style={{
                    ['--button-border-color' as const]: isSelected ? selectedColor : '#ffffff22',
                    backgroundColor: isSelected ? `${selectedColor}14` : '#050505',
                    color: isSelected ? selectedColor : SP_COLORS.white,
                    boxShadow: isSelected ? `0 0 0 1px ${selectedColor}, 0 0 16px ${selectedColor}22` : 'none',
                    transform: isSelected ? 'translateY(-1px)' : 'none'
                  } as React.CSSProperties}
                >
                  {option.value}
                </button>
              )
            })}
          </div>
        </div>

        <div className={`${compact ? 'mt-3.5 gap-3' : 'mt-4 gap-3'} flex flex-wrap items-center`}>
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
              className={`rounded-[8px] border bg-black px-2 py-1 text-center text-white disabled:cursor-not-allowed disabled:opacity-45 ${
                compact ? 'w-[66px] text-[14px]' : 'w-[72px] text-[15px]'
              }`}
              style={{ borderColor: '#ffffff30' }}
            />
          </label>
          <div className={`min-h-[20px] flex-1 ${compact ? 'text-[12px] leading-snug md:text-[13px]' : 'text-[12px] md:text-[14px]'}`} style={{ color: scaleState ? SP_COLORS.white : SP_COLORS.muted }}>
            {notEncountered
              ? 'Recorded as not encountered in your work. This answer is saved and you can continue to the next question.'
              : scaleState
                ? `${scaleState.value} - ${scaleState.label}: ${scaleState.description}`
                : 'Select a value from 1 to 9 by dragging, clicking, or typing.'}
          </div>
        </div>
      </div>

      <div className={`${compact ? 'mt-3 shrink-0 border-t border-white/10 pt-3' : 'mt-5'} flex items-center justify-between gap-3`}>
        <button
          type="button"
          onClick={onPreviousNavigate}
          disabled={!hasPrevious}
          className={`atlas-sign-button [--button-line-inset:8px] [--button-radius:10px] inline-flex items-center gap-2 rounded-[10px] border lowercase ${
            compact ? 'px-3 py-1.5 text-[12px] md:text-[13px]' : 'px-3 py-1.5 text-[12px] md:text-[13px]'
          }`}
          style={{
            ['--button-border-color' as const]: '#ffffff24',
            color: SP_COLORS.muted,
            opacity: hasPrevious ? 1 : 0.35
          } as React.CSSProperties}
        >
          <img src={arrowIconUrl} alt="" aria-hidden="true" className="h-[1.2rem] w-[1.2rem] -rotate-90 opacity-90" />
          back
        </button>
        {hasNext ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResumeNavigate}
              disabled={!canResume}
              className={`atlas-sign-button [--button-line-inset:8px] [--button-radius:10px] inline-flex items-center gap-2 rounded-[10px] border font-medium ${
                compact ? 'px-3.5 py-1.5 text-[12px] md:text-[13px]' : 'px-4 py-2 text-[13px] md:text-[14px]'
              }`}
              style={{
                ['--button-border-color' as const]: '#ffffff24',
                color: SP_COLORS.white,
                opacity: canResume ? 1 : 0.4
              } as React.CSSProperties}
            >
              <span>resume</span>
            </button>
            <button
              type="button"
              onClick={onNextNavigate}
              disabled={!canAdvance}
              className={`atlas-sign-button [--button-line-inset:8px] [--button-radius:10px] inline-flex items-center gap-2 rounded-[10px] border font-medium ${
                compact ? 'px-3.5 py-1.5 text-[12px] md:text-[13px]' : 'px-4 py-2 text-[13px] md:text-[14px]'
              }`}
              style={{
                ['--button-border-color' as const]: SP_COLORS.yellow,
                color: SP_COLORS.yellow,
                opacity: canAdvance ? 1 : 0.45,
                boxShadow: canAdvance ? '0 0 18px rgba(252,192,26,0.12)' : 'none'
              } as React.CSSProperties}
            >
              <span>next</span>
              <img src={arrowIconUrl} alt="" aria-hidden="true" className="h-[1.2rem] w-[1.2rem] rotate-90 opacity-90" />
            </button>
          </div>
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
  accentColor,
  sectionProgress,
  pinToViewport = true,
  className = ''
}: {
  currentIndex: number
  totalCount: number
  completedCount: number
  parentCode: string
  parentTheme: string
  accentColor: string
  sectionProgress: SurveySectionProgressItem[]
  pinToViewport?: boolean
  className?: string
}) {
  const ratio = totalCount ? completedCount / totalCount : 0
  const useLightText = usesLightTextOnZCodeColor(accentColor)

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7549/ingest/0a2b055f-3c79-424f-9cff-1288c71c5ade',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0b07da'},body:JSON.stringify({sessionId:'0b07da',runId:'service-capacity-debug-1',hypothesisId:'H5',location:'SurveyChrome.tsx:309',message:'survey progress header state',data:{currentIndex,totalCount,completedCount,parentCode,pinToViewport,sectionCount:sectionProgress.length,ratio},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [completedCount, currentIndex, parentCode, pinToViewport, ratio, sectionProgress.length, totalCount])

  return (
    <div
      className={`${pinToViewport ? 'sticky top-0 z-30' : 'relative'} mt-5 rounded-[16px] border bg-black/92 px-4 py-3 backdrop-blur-sm transition-[padding,border-radius,background-color] duration-500 ease-out md:px-5 ${className}`}
      style={{ borderColor: '#ffffff24' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <small className="block text-[12px] uppercase tracking-[0.12em] md:text-[13px]" style={{ color: SP_COLORS.muted }}>
            survey progress
          </small>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="rounded-[10px] px-2.5 py-1 text-[12px] font-semibold md:text-[13px]"
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
      <div
        className="mt-4 grid items-start justify-items-center gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${sectionProgress.length}, minmax(0, 1fr))` }}
      >
        {sectionProgress.map((item) => {
          const sectionRatio = item.total ? item.completed / item.total : 0
          const circleSize = 40
          const radius = 17
          const circumference = 2 * Math.PI * radius
          const dashOffset = circumference * (1 - Math.max(0, Math.min(1, sectionRatio)))
          const itemUsesLightText = usesLightTextOnZCodeColor(item.accentColor)
          const isComplete = item.total > 0 && item.completed === item.total

          return (
            <div
              key={item.parentCode}
              className={`flex w-full min-w-0 flex-col items-center gap-1 rounded-[11px] px-1 py-1.5 transition-[background-color,border-color] duration-200 ease-out ${
                item.isCurrent ? 'border bg-white/6' : 'border border-transparent bg-transparent'
              }`}
              style={item.isCurrent ? { borderColor: '#ffffff14' } : undefined}
            >
              <div className="relative h-[clamp(26px,7vw,40px)] w-[clamp(26px,7vw,40px)]">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox={`0 0 ${circleSize} ${circleSize}`} aria-hidden="true">
                  <circle
                    cx={circleSize / 2}
                    cy={circleSize / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="3"
                  />
                  <circle
                    cx={circleSize / 2}
                    cy={circleSize / 2}
                    r={radius}
                    fill="none"
                    stroke={item.accentColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div
                  className="absolute left-1/2 top-1/2 flex h-[calc(100%-8px)] w-[calc(100%-8px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[clamp(10px,2.5vw,14px)] font-bold leading-none"
                  style={{
                    backgroundColor: isComplete ? item.accentColor : '#050505',
                    color: isComplete ? (itemUsesLightText ? SP_COLORS.white : SP_COLORS.bg) : item.accentColor,
                    border: `1px solid ${isComplete ? item.accentColor : '#ffffff1f'}`
                  }}
                >
                  {item.parentCode.replace(/^Z/i, '')}
                </div>
              </div>
              <small className="text-[clamp(8px,1.8vw,12px)] font-medium leading-none" style={{ color: SP_COLORS.muted }}>
                {item.completed}/{item.total}
              </small>
            </div>
          )
        })}
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
    <label className="flex h-full flex-col justify-end text-[12px] text-[#bcbcbc] md:text-[14px]">
      <div className="min-h-[48px] md:min-h-[54px]">
        <span className="block">{label}</span>
        <small className={`mt-1 block text-[11px] text-[#8f8f8f] md:text-[13px] ${requiredHint ? '' : 'opacity-0'}`}>
          {requiredHint || 'placeholder'}
        </small>
      </div>
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
      className="w-full rounded-[11px] border bg-black px-3 py-2 text-[14px] text-white md:text-[16px]"
      style={{ borderColor: '#ffffff30' }}
    />
  )
}

export function BlockingSupportOverlay({
  message,
  supportEmail
}: {
  message: string
  supportEmail: string
}) {
  const supportHref = `mailto:${supportEmail}?subject=${encodeURIComponent('ATLAS service capacity survey support request')}`

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[21px] bg-black/85 px-4 py-6 backdrop-blur-sm">
      <div
        className="w-full max-w-[620px] rounded-[20px] border px-5 py-5 text-center md:px-6 md:py-6"
        style={{ borderColor: `${SP_COLORS.red}80`, backgroundColor: '#070707' }}
      >
        <small className="block text-[12px] uppercase tracking-[0.16em] md:text-[13px]" style={{ color: SP_COLORS.red }}>
          save error
        </small>
        <h4 className="mt-2 text-[22px] font-medium text-white md:text-[28px]">Unable to save this survey</h4>
        <p className="mt-3 text-[14px] text-[#d2d2d2] md:text-[16px]">{message}</p>
        <p className="mt-3 text-[13px] text-[#b3b3b3] md:text-[14px]">
          This issue blocks progress until support reviews the failed save.
        </p>
        <div className="mt-5 flex justify-center">
          <a
            href={supportHref}
            className="atlas-sign-button [--button-line-inset:8px] [--button-radius:10px] inline-flex items-center justify-center rounded-[10px] border px-5 py-2 text-[13px] font-medium text-white md:text-[14px]"
            style={{ ['--button-border-color' as const]: SP_COLORS.white } as React.CSSProperties}
          >
            email {supportEmail}
          </a>
        </div>
      </div>
    </div>
  )
}
