import React from 'react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import type { DomainLoad } from '@/features/atlas2026/singlepane/types'
import { SP_COLORS } from '@/features/atlas2026/singlepane/theme'

interface RadialLoadChartProps {
  load: DomainLoad | null
}

export default function RadialLoadChart({ load }: RadialLoadChartProps) {
  const data = [
    { domain: 'habitat', value: load?.habitat || 0 },
    { domain: 'work', value: load?.work || 0 },
    { domain: 'social networks', value: load?.socialNetworks || 0 }
  ]

  return (
    <div className="flex h-[248px] w-[292px] flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="84%">
        <RadarChart cx="50%" cy="54%" outerRadius="74%" data={data}>
          <PolarGrid stroke={SP_COLORS.border} strokeOpacity={0.72} />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: SP_COLORS.white, fontSize: 11, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 500 }}
          />
          <Radar dataKey="value" stroke={SP_COLORS.blue} fill={SP_COLORS.blue} fillOpacity={0.42} strokeOpacity={0.8} strokeWidth={1.7} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-[2px] flex w-[92%] items-center justify-between text-[11px]">
        <small style={{ color: SP_COLORS.white }}>manageable strain</small>
        <small style={{ color: SP_COLORS.white }}>destabilizing load</small>
      </div>
    </div>
  )
}
