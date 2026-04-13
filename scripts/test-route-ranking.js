#!/usr/bin/env node

function scoreStation(activeNeedByZCode, partnerBurdenByStation) {
  return Object.entries(partnerBurdenByStation)
    .map(([stationId, burdenByZCode]) => {
      let score = 0
      let matchedZCodeCount = 0
      let needUnitsMatched = 0
      let partnerBurdenTotal = 0

      for (const [zCode, needCount] of Object.entries(activeNeedByZCode)) {
        const burdenScore = burdenByZCode[zCode] ?? 0
        if (burdenScore <= 0) continue
        score += needCount * burdenScore
        matchedZCodeCount += 1
        needUnitsMatched += needCount
        partnerBurdenTotal += burdenScore
      }

      return { stationId, score, matchedZCodeCount, needUnitsMatched, partnerBurdenTotal }
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.matchedZCodeCount - a.matchedZCodeCount ||
        b.needUnitsMatched - a.needUnitsMatched ||
        b.partnerBurdenTotal - a.partnerBurdenTotal ||
        a.stationId.localeCompare(b.stationId)
    )
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const activeNeedByZCode = {
  'Z59.0': 2,
  'Z56.0': 1,
  'Z60.0': 1
}

const partnerBurdenByStation = {
  stationAlpha: {
    'Z59.0': 9,
    'Z56.0': 1
  },
  stationBeta: {
    'Z59.0': 5,
    'Z56.0': 5,
    'Z60.0': 5
  },
  stationGamma: {
    'Z59.0': 8
  }
}

const ranked = scoreStation(activeNeedByZCode, partnerBurdenByStation)
assert(ranked[0].stationId === 'stationBeta', 'station with the highest aggregated need x burden total should rank first')
assert(ranked[0].score === 20, 'top ranked weighted score should equal summed need x burden products')
assert(ranked[1].stationId === 'stationAlpha', 'secondary station should rank below the highest total and above weaker partial matches')
assert(ranked[2].stationId === 'stationGamma', 'single-code match should rank below broader higher-total matches')
assert(ranked.every((item) => item.score === Number(item.score)), 'all scored stations should have numeric scores')

process.stdout.write('weighted route ranking rule test passed\n')
