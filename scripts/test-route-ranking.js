#!/usr/bin/env node

function scoreStation(activeZCodes, capabilitiesByStation) {
  const entries = Object.entries(capabilitiesByStation)
  return entries
    .map(([stationId, caps]) => {
      let specializeHits = 0
      let conflictHits = 0
      let interfereHits = 0
      let specializationStrength = 0

      for (const zCode of activeZCodes) {
        const specialize = caps.find((c) => c.zCode === zCode && c.relationType === 'specialize')
        const interfere = caps.find((c) => c.zCode === zCode && c.relationType === 'interfere')

        if (specialize && !interfere) specializeHits += 1
        if (specialize && interfere) conflictHits += 1
        if (!specialize && interfere) interfereHits += 1
        if (specialize) specializationStrength += specialize.strength ?? 1
      }

      const score = specializeHits * 10 + specializationStrength * 2 - conflictHits * 6 - interfereHits * 4
      return { stationId, score, specializeHits, conflictHits, interfereHits }
    })
    .sort((a, b) => b.score - a.score || b.specializeHits - a.specializeHits || a.conflictHits - b.conflictHits || a.interfereHits - b.interfereHits)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const activeZCodes = ['Z59.0', 'Z56.0']
const capabilitiesByStation = {
  stationAlpha: [
    { zCode: 'Z59.0', relationType: 'interfere', strength: 1 },
    { zCode: 'Z56.0', relationType: 'specialize', strength: 1 }
  ],
  stationBeta: [
    { zCode: 'Z59.0', relationType: 'specialize', strength: 1 },
    { zCode: 'Z56.0', relationType: 'specialize', strength: 1 }
  ],
  stationGamma: [
    { zCode: 'Z59.0', relationType: 'specialize', strength: 1 },
    { zCode: 'Z59.0', relationType: 'interfere', strength: 1 },
    { zCode: 'Z56.0', relationType: 'specialize', strength: 1 }
  ]
}

const ranked = scoreStation(activeZCodes, capabilitiesByStation)
assert(ranked[0].stationId === 'stationBeta', 'station with specialize and no interfere should rank first')
const gammaRank = ranked.findIndex((item) => item.stationId === 'stationGamma')
const betaRank = ranked.findIndex((item) => item.stationId === 'stationBeta')
assert(gammaRank > betaRank, 'station with specialize+interfere conflict should rank below clean specialize')
assert(ranked.every((item) => item.score === Number(item.score)), 'all scored stations should have numeric score')

process.stdout.write('route ranking rule test passed\n')
