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
  'Z59.1': 1,
  'Z56.2': 1,
  'Z60.4': 1
}

const partnerBurdenByStation = {
  northHarborHousingHub: {
    'Z59.1': 9,
    'Z56.2': 4,
    'Z60.4': 5
  },
  workSpringEmploymentDesk: {
    'Z59.1': 5,
    'Z56.2': 8,
    'Z60.4': 4
  },
  bridgeLineCommunityCommons: {
    'Z59.1': 7,
    'Z56.2': 6,
    'Z60.4': 9
  }
}

const ranked = scoreStation(activeNeedByZCode, partnerBurdenByStation)
assert(ranked[0].stationId === 'bridgeLineCommunityCommons', 'bridgeLine should rank first for Elena when it is strongest across all three active parent groups')
assert(ranked[0].score === 22, 'top ranked weighted score should equal Elena route total 7 + 6 + 9')
assert(ranked[1].stationId === 'northHarborHousingHub', 'north harbor should rank second with an 18-point three-parent total')
assert(ranked[2].stationId === 'workSpringEmploymentDesk', 'workspring should rank third with a 17-point three-parent total')
assert(ranked.every((item) => item.score === Number(item.score)), 'all scored stations should have numeric scores')

process.stdout.write('weighted route ranking rule test passed\n')
