/**
 * Advanced Analytics Service for ATLAS
 * Calculates comprehensive metrics and insights
 */

// ============================================================================
// CORE ANALYTICS CALCULATIONS
// ============================================================================

/**
 * Calculate comprehensive dashboard analytics
 * @param {Array} enrollees - Array of all enrollees
 * @param {Array} referrals - Array of all referrals
 * @returns {object} Analytics object with all metrics
 */
export function calculateDashboardAnalytics(enrollees, referrals) {
  const analytics = {
    // Basic counts
    totalEnrollees: enrollees.length,
    totalReferrals: referrals.length,
    activeReferrals: referrals.filter(r => r.status === 'Pending').length,
    
    // Risk distribution
    tier1Count: enrollees.filter(e => e.riskProfile?.tier === 1).length,
    tier2Count: enrollees.filter(e => e.riskProfile?.tier === 2).length,
    tier3Count: enrollees.filter(e => e.riskProfile?.tier === 3).length,
    
    // Wellness scores
    avgWellnessScore: calculateAverageWellness(enrollees),
    wellnessDimensions: calculateWellnessDimensions(enrollees),
    
    // Risk distribution percentages
    riskDistribution: calculateRiskDistribution(enrollees),
    
    // Z-Codes analysis
    zCodeAnalysis: analyzeZCodes(enrollees),
    
    // Care team metrics
    careTeamMetrics: analyzeCareTeams(enrollees),
    
    // Referral metrics
    referralMetrics: analyzeReferrals(referrals),
    
    // Trends
    trends: calculateTrends(enrollees),
    
    // Geographic analysis
    geographicAnalysis: analyzeGeography(enrollees)
  }
  
  return analytics
}

/**
 * Calculate average wellness score across all dimensions
 * @param {Array} enrollees - Array of enrollees
 * @returns {number} Average wellness score (0-100)
 */
function calculateAverageWellness(enrollees) {
  if (enrollees.length === 0) return 0
  
  const dimensions = ['physical', 'emotional', 'social', 'intellectual', 'occupational', 'environmental', 'financial', 'spiritual']
  
  let totalScore = 0
  let scoreCount = 0
  
  enrollees.forEach(enrollee => {
    if (enrollee.riskProfile?.wellnessScores) {
      dimensions.forEach(dim => {
        const score = enrollee.riskProfile.wellnessScores[dim]
        if (typeof score === 'number') {
          totalScore += score
          scoreCount++
        }
      })
    }
  })
  
  return scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0
}

/**
 * Calculate average scores for each wellness dimension
 * @param {Array} enrollees - Array of enrollees
 * @returns {object} Dimension averages
 */
function calculateWellnessDimensions(enrollees) {
  const dimensions = ['physical', 'emotional', 'social', 'intellectual', 'occupational', 'environmental', 'financial', 'spiritual']
  const averages = {}
  
  dimensions.forEach(dim => {
    const scores = enrollees
      .map(e => e.riskProfile?.wellnessScores?.[dim])
      .filter(score => typeof score === 'number')
    
    averages[dim] = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0
  })
  
  return averages
}

/**
 * Calculate risk distribution with percentages
 * @param {Array} enrollees - Array of enrollees
 * @returns {object} Risk distribution data
 */
function calculateRiskDistribution(enrollees) {
  const total = enrollees.length
  if (total === 0) return { tier1: 0, tier2: 0, tier3: 0, tier1Percent: 0, tier2Percent: 0, tier3Percent: 0 }
  
  const tier1 = enrollees.filter(e => e.riskProfile?.tier === 1).length
  const tier2 = enrollees.filter(e => e.riskProfile?.tier === 2).length
  const tier3 = enrollees.filter(e => e.riskProfile?.tier === 3).length
  
  return {
    tier1,
    tier2,
    tier3,
    tier1Percent: Math.round((tier1 / total) * 100),
    tier2Percent: Math.round((tier2 / total) * 100),
    tier3Percent: Math.round((tier3 / total) * 100)
  }
}

/**
 * Analyze Z-Codes (social determinants)
 * @param {Array} enrollees - Array of enrollees
 * @returns {object} Z-Code analysis
 */
function analyzeZCodes(enrollees) {
  const zCodeCounts = {}
  let totalZCodes = 0
  let enrolleesWithZCodes = 0
  
  enrollees.forEach(enrollee => {
    const zCodes = enrollee.riskProfile?.zCodes || []
    if (zCodes.length > 0) {
      enrolleesWithZCodes++
      totalZCodes += zCodes.length
      
      zCodes.forEach(code => {
        zCodeCounts[code] = (zCodeCounts[code] || 0) + 1
      })
    }
  })
  
  // Get top 5 most common Z-Codes
  const topZCodes = Object.entries(zCodeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count, name: getZCodeName(code) }))
  
  return {
    totalZCodes,
    enrolleesWithZCodes,
    avgZCodesPerEnrollee: enrollees.length > 0 ? (totalZCodes / enrollees.length).toFixed(1) : 0,
    topZCodes
  }
}

/**
 * Analyze care team metrics
 * @param {Array} enrollees - Array of enrollees
 * @returns {object} Care team analysis
 */
function analyzeCareTeams(enrollees) {
  let totalTeamMembers = 0
  let enrolleesWithTeams = 0
  const roleCounts = {}
  
  enrollees.forEach(enrollee => {
    const team = enrollee.careTeam || []
    if (team.length > 0) {
      enrolleesWithTeams++
      totalTeamMembers += team.length
      
      team.forEach(member => {
        const role = member.role || 'Unknown'
        roleCounts[role] = (roleCounts[role] || 0) + 1
      })
    }
  })
  
  return {
    totalTeamMembers,
    enrolleesWithTeams,
    avgTeamSize: enrollees.length > 0 ? (totalTeamMembers / enrollees.length).toFixed(1) : 0,
    roleCounts
  }
}

/**
 * Analyze referral metrics
 * @param {Array} referrals - Array of referrals
 * @returns {object} Referral analysis
 */
function analyzeReferrals(referrals) {
  const statusCounts = {
    Pending: referrals.filter(r => r.status === 'Pending').length,
    Accepted: referrals.filter(r => r.status === 'Accepted').length,
    Rejected: referrals.filter(r => r.status === 'Rejected').length
  }
  
  const acceptanceRate = referrals.length > 0
    ? Math.round((statusCounts.Accepted / referrals.length) * 100)
    : 0
  
  // Referrals by resource
  const resourceCounts = {}
  referrals.forEach(referral => {
    const resource = referral.resourceName || 'Unknown'
    resourceCounts[resource] = (resourceCounts[resource] || 0) + 1
  })
  
  const topResources = Object.entries(resourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
  
  return {
    statusCounts,
    acceptanceRate,
    topResources
  }
}

/**
 * Calculate trends over time
 * @param {Array} enrollees - Array of enrollees
 * @returns {object} Trend analysis
 */
function calculateTrends(enrollees) {
  // Calculate improvement/decline trends
  // This would ideally look at historical data
  // For now, we'll calculate current vs average
  
  const avgWellness = calculateAverageWellness(enrollees)
  
  const improving = enrollees.filter(e => {
    const wellness = calculateEnrolleeWellness(e)
    return wellness > avgWellness + 10
  }).length
  
  const stable = enrollees.filter(e => {
    const wellness = calculateEnrolleeWellness(e)
    return Math.abs(wellness - avgWellness) <= 10
  }).length
  
  const declining = enrollees.filter(e => {
    const wellness = calculateEnrolleeWellness(e)
    return wellness < avgWellness - 10
  }).length
  
  return {
    improving,
    stable,
    declining,
    improvingPercent: enrollees.length > 0 ? Math.round((improving / enrollees.length) * 100) : 0,
    stablePercent: enrollees.length > 0 ? Math.round((stable / enrollees.length) * 100) : 0,
    decliningPercent: enrollees.length > 0 ? Math.round((declining / enrollees.length) * 100) : 0
  }
}

/**
 * Analyze geographic distribution
 * @param {Array} enrollees - Array of enrollees
 * @returns {object} Geographic analysis
 */
function analyzeGeography(enrollees) {
  const zipCounts = {}
  const cityCounts = {}
  
  enrollees.forEach(enrollee => {
    const zip = enrollee.demographics?.address?.zipCode
    const city = enrollee.demographics?.address?.city
    
    if (zip) {
      zipCounts[zip] = (zipCounts[zip] || 0) + 1
    }
    
    if (city) {
      cityCounts[city] = (cityCounts[city] || 0) + 1
    }
  })
  
  const topZipCodes = Object.entries(zipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([zip, count]) => ({ zip, count }))
  
  const topCities = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }))
  
  return {
    topZipCodes,
    topCities
  }
}

// ============================================================================
// COHORT ANALYSIS
// ============================================================================

/**
 * Analyze enrollees by cohort
 * @param {Array} enrollees - Array of enrollees
 * @param {string} cohortType - 'age' | 'tier' | 'zcode'
 * @returns {object} Cohort analysis
 */
export function analyzeByCohort(enrollees, cohortType) {
  switch (cohortType) {
    case 'age':
      return analyzeByAge(enrollees)
    case 'tier':
      return analyzeByRiskTier(enrollees)
    case 'zcode':
      return analyzeByZCode(enrollees)
    default:
      return {}
  }
}

function analyzeByAge(enrollees) {
  const ageGroups = {
    '18-24': [],
    '25-34': [],
    '35-44': [],
    '45-54': [],
    '55-64': [],
    '65+': []
  }
  
  enrollees.forEach(enrollee => {
    const age = calculateAge(enrollee.demographics?.dob)
    if (age < 25) ageGroups['18-24'].push(enrollee)
    else if (age < 35) ageGroups['25-34'].push(enrollee)
    else if (age < 45) ageGroups['35-44'].push(enrollee)
    else if (age < 55) ageGroups['45-54'].push(enrollee)
    else if (age < 65) ageGroups['55-64'].push(enrollee)
    else ageGroups['65+'].push(enrollee)
  })
  
  return Object.entries(ageGroups).map(([group, enrollees]) => ({
    group,
    count: enrollees.length,
    avgWellness: calculateAverageWellness(enrollees),
    avgRiskTier: enrollees.length > 0
      ? enrollees.reduce((sum, e) => sum + (e.riskProfile?.tier || 0), 0) / enrollees.length
      : 0
  }))
}

function analyzeByRiskTier(enrollees) {
  const tiers = {
    '1': enrollees.filter(e => e.riskProfile?.tier === 1),
    '2': enrollees.filter(e => e.riskProfile?.tier === 2),
    '3': enrollees.filter(e => e.riskProfile?.tier === 3)
  }
  
  return Object.entries(tiers).map(([tier, enrollees]) => ({
    tier: `Tier ${tier}`,
    count: enrollees.length,
    avgWellness: calculateAverageWellness(enrollees),
    avgZCodes: enrollees.length > 0
      ? enrollees.reduce((sum, e) => sum + (e.riskProfile?.zCodes?.length || 0), 0) / enrollees.length
      : 0
  }))
}

function analyzeByZCode(enrollees) {
  // Group by presence of specific high-impact Z-Codes
  const categories = {
    'Housing Insecurity': enrollees.filter(e => 
      e.riskProfile?.zCodes?.some(code => code.startsWith('Z59'))
    ),
    'Employment Issues': enrollees.filter(e => 
      e.riskProfile?.zCodes?.some(code => code.startsWith('Z56'))
    ),
    'Educational Problems': enrollees.filter(e => 
      e.riskProfile?.zCodes?.some(code => code.startsWith('Z55'))
    ),
    'No Z-Codes': enrollees.filter(e => 
      !e.riskProfile?.zCodes || e.riskProfile.zCodes.length === 0
    )
  }
  
  return Object.entries(categories).map(([category, enrollees]) => ({
    category,
    count: enrollees.length,
    avgWellness: calculateAverageWellness(enrollees),
    avgRiskTier: enrollees.length > 0
      ? enrollees.reduce((sum, e) => sum + (e.riskProfile?.tier || 0), 0) / enrollees.length
      : 0
  }))
}

// ============================================================================
// PREDICTIVE ANALYTICS
// ============================================================================

/**
 * Calculate risk prediction for enrollee
 * @param {object} enrollee - Enrollee object
 * @returns {object} Risk prediction
 */
export function predictRiskTrend(enrollee) {
  // Simple prediction based on current metrics
  const wellness = calculateEnrolleeWellness(enrollee)
  const zCodeCount = enrollee.riskProfile?.zCodes?.length || 0
  const currentTier = enrollee.riskProfile?.tier || 2
  
  let prediction = 'stable'
  let confidence = 0
  
  // Factors indicating improvement
  if (wellness > 70 && zCodeCount <= 2) {
    prediction = 'improving'
    confidence = 0.75
  }
  // Factors indicating decline
  else if (wellness < 40 && zCodeCount >= 4) {
    prediction = 'declining'
    confidence = 0.7
  }
  // Stable
  else {
    prediction = 'stable'
    confidence = 0.6
  }
  
  return {
    prediction,
    confidence: Math.round(confidence * 100),
    recommendedTier: predictRecommendedTier(wellness, zCodeCount, currentTier)
  }
}

function predictRecommendedTier(wellness, zCodeCount, currentTier) {
  // Simple tier recommendation logic
  if (wellness > 70 && zCodeCount <= 2) return 1
  if (wellness < 40 || zCodeCount >= 5) return 3
  return 2
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateEnrolleeWellness(enrollee) {
  const scores = enrollee.riskProfile?.wellnessScores
  if (!scores) return 0
  
  const dimensions = ['physical', 'emotional', 'social', 'intellectual', 'occupational', 'environmental', 'financial', 'spiritual']
  const values = dimensions.map(dim => scores[dim]).filter(v => typeof v === 'number')
  
  return values.length > 0
    ? values.reduce((sum, score) => sum + score, 0) / values.length
    : 0
}

function calculateAge(dob) {
  if (!dob) return 0
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function getZCodeName(code) {
  const zCodeNames = {
    'Z59.0': 'Homelessness',
    'Z59.1': 'Inadequate Housing',
    'Z59.4': 'Lack of Adequate Food',
    'Z59.6': 'Low Income',
    'Z59.8': 'Housing Instability',
    'Z56.0': 'Unemployment',
    'Z56.9': 'Employment Problems',
    'Z55.9': 'Educational Problems',
    'Z63.4': 'Family Disruption',
    'Z91.4': 'History of Trauma'
  }
  return zCodeNames[code] || code
}

export default {
  calculateDashboardAnalytics,
  analyzeByCohort,
  predictRiskTrend
}

