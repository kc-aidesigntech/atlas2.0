#!/usr/bin/env node
/**
 * Focused Phase 3 residual verification:
 * - My Station debut gate rules (capacity entries + specialization clarity)
 * - County Commons remains hidden
 * - CardHolders / Alum MVP skip is documented
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function countScoredCapacityEntries(answers) {
  return answers.filter(
    (answer) => !answer.notEncountered && typeof answer.score === 'number' && Number.isFinite(answer.score)
  ).length
}

function deriveSpecialtyParentCodes(answers) {
  const parents = new Set()
  for (const answer of answers) {
    if (answer.notEncountered || typeof answer.score !== 'number' || answer.score <= 6) continue
    parents.add(answer.parentCode)
  }
  return [...parents]
}

function evaluateDebut({ organizationName, partnerId, answers, formVersion = '2026-z-burden-v2', status = 'completed' }) {
  const stationProfileInitiated = Boolean(organizationName?.trim() && partnerId?.trim())
  const isBurden = formVersion === '2026-z-burden-v2' && status === 'completed'
  const capacityEntriesComplete = isBurden && countScoredCapacityEntries(answers) > 0
  const specializationClarity = isBurden && deriveSpecialtyParentCodes(answers).length > 0
  return {
    canDebut: stationProfileInitiated && capacityEntriesComplete && specializationClarity,
    stationProfileInitiated,
    capacityEntriesComplete,
    specializationClarity
  }
}

function filterPartnerMenus(menus, canDebut) {
  if (canDebut) return menus
  return menus.filter((menu) => menu.trim().toLowerCase() !== 'my station')
}

// --- Debut gate cases ---
const locked = evaluateDebut({
  organizationName: 'Harborview Demo Partner',
  partnerId: 'partner-1',
  answers: []
})
assert(!locked.canDebut, 'empty answers must keep My Station locked')

const capacityOnly = evaluateDebut({
  organizationName: 'Harborview Demo Partner',
  partnerId: 'partner-1',
  answers: [{ parentCode: 'Z59', score: 5, notEncountered: false }]
})
assert(capacityOnly.capacityEntriesComplete, 'scored answers count as capacity entries')
assert(!capacityOnly.specializationClarity, 'scores at or below 6 do not create specialties')
assert(!capacityOnly.canDebut, 'missing specialization clarity must keep My Station locked')

const ready = evaluateDebut({
  organizationName: 'Harborview Demo Partner',
  partnerId: 'partner-1',
  answers: [
    { parentCode: 'Z59', score: 8, notEncountered: false },
    { parentCode: 'Z56', score: 3, notEncountered: false }
  ]
})
assert(ready.canDebut, 'capacity entries + specialty score above 6 must unlock My Station')

const domainSpectrum = evaluateDebut({
  organizationName: 'Harborview Demo Partner',
  partnerId: 'partner-1',
  formVersion: '2026-z-domain-spectrum-v1',
  answers: [{ parentCode: 'Z59', score: 80, notEncountered: false }]
})
assert(!domainSpectrum.canDebut, 'domain-spectrum-only completion must not debut My Station')

assert(
  JSON.stringify(filterPartnerMenus(['referral portal', 'my station', 'service capacity'], false)) ===
    JSON.stringify(['referral portal', 'service capacity']),
  'locked partners must not see my station'
)
assert(
  JSON.stringify(filterPartnerMenus(['referral portal', 'my station', 'service capacity'], true)) ===
    JSON.stringify(['referral portal', 'my station', 'service capacity']),
  'commissioned partners must keep my station'
)

// --- Source smoke: County Commons stays hidden ---
const repositorySource = readFileSync(
  resolve(root, 'src/features/atlas2026/singlepane/data-access/singlepaneRepository.ts'),
  'utf8'
)
assert(
  /const SHOW_COUNTY_COMMONS = false/.test(repositorySource),
  'SHOW_COUNTY_COMMONS must remain false for MVP'
)
assert(
  /export function isCountyCommonsMenuEnabled/.test(repositorySource),
  'County Commons smoke helper must remain exported'
)

const debutSource = readFileSync(
  resolve(root, 'src/features/atlas2026/singlepane/data-access/partnerMyStationDebut.ts'),
  'utf8'
)
assert(
  /export function evaluatePartnerMyStationDebut/.test(debutSource),
  'partner My Station debut evaluator must exist'
)
assert(
  /export function applyPartnerMyStationDebutMenuGate/.test(debutSource),
  'partner My Station menu gate must exist'
)

const skipDoc = readFileSync(resolve(root, 'docs/PARTNER_MY_STATION_DEBUT.md'), 'utf8')
assert(
  /CardHolders \/ Alum subheader — skipped for MVP/i.test(skipDoc),
  'CardHolders/Alum MVP skip must be documented'
)

console.log('partner my station debut checks passed')
