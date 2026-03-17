import React from 'react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import type { DomainLoad } from '../types'
import { SP_COLORS } from '../theme'

interface RadialLoadChartProps {
  load: DomainLoad | null
}

export default function RadialLoadChart({ load }: RadialLoadChartProps) {
  const habitat = load?.habitat || 0
  const work = load?.work || 0
  const social = load?.socialNetworks || 0

  // 6 points total:
  // 3 labeled anchor domains + 3 unlabeled adjacency interaction nodes.
  const data = [
    { axis: 'habitat', value: habitat },
    { axis: 'habitat-social', value: Math.round((habitat + social) / 2) },
    { axis: 'social networks', value: social },
    { axis: 'social-work', value: Math.round((social + work) / 2) },
    { axis: 'work', value: work },
    { axis: 'work-habitat', value: Math.round((work + habitat) / 2) }
  ]
  const polarRadius = [12, 24, 36, 48, 60, 72]
  const polarAngles = [90, 30, -30, -90, -150, -210]

  return (
    <div className="flex h-[280px] w-[360px] flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="84%">
        <RadarChart
          cx="50%"
          cy="53%"
          outerRadius="72%"
          data={data}
          startAngle={90}
          endAngle={-270}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <PolarGrid
            gridType="polygon"
            radialLines
            polarRadius={polarRadius}
            polarAngles={polarAngles}
            stroke={SP_COLORS.text}
            strokeOpacity={.5}
            strokeWidth={.4}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tickCount={6}
            tick={{ fill: 'transparent', fontSize: 1 }}
            axisLine={false}
            tickLine={false}
          />
          <PolarAngleAxis
            dataKey="axis"
            tickFormatter={(value) => (value.includes('-') ? '' : value)}
            tick={{ fill: SP_COLORS.text, fontSize: 14, fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Radar dataKey="value" stroke={SP_COLORS.text} fill={SP_COLORS.blue} fillOpacity={0.28} strokeOpacity={1} strokeWidth={1.8} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
      <div className="mt-[2px] flex w-[92%] items-center justify-between">
        <small className="text-[14px]" style={{ color: SP_COLORS.text }}>
          manageable strain
        </small>
        <small className="text-[14px]" style={{ color: SP_COLORS.text }}>
          destabilizing load
        </small>
      </div>
    </div>
  )
}
