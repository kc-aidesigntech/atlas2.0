/**
 * AlayaCare to ATLAS Data Mapping Utilities
 * Converts AlayaCare data structures to ATLAS format
 */

// ============================================================================
// RISK TIER CALCULATION
// ============================================================================

/**
 * Calculate ATLAS risk tier from LS/CMI total score
 * @param {number} lscmiTotalScore - Total LS/CMI score (0-43)
 * @returns {number} ATLAS risk tier (1-3)
 */
export function calculateRiskTier(lscmiTotalScore) {
  if (lscmiTotalScore <= 11) return 1  // Low Risk
  if (lscmiTotalScore <= 20) return 2  // Moderate Risk
  if (lscmiTotalScore <= 31) return 2  // Moderate-High Risk (still Tier 2)
  return 3  // High Risk (32+)
}

/**
 * Calculate wellness score from assessment
 * @param {object} assessment - AlayaCare assessment data
 * @returns {object} Wellness scores for 8 dimensions (0-100 scale)
 */
export function calculateWellnessScores(assessment) {
  const scores = {}
  
  // Map assessment fields to wellness dimensions
  // Note: These mappings should be customized based on your actual form fields
  
  // Physical Wellness (from physical health indicators)
  scores.physical = mapScoreToPercentile(
    assessment.physical_health_score || 50,
    0, 100, 0, 100
  )
  
  // Emotional Wellness (from PHQ-9, GAD-7)
  const phq9 = assessment.phq9_score || 0  // 0-27 scale (higher = worse)
  const gad7 = assessment.gad7_score || 0  // 0-21 scale (higher = worse)
  scores.emotional = Math.round(100 - ((phq9 / 27 + gad7 / 21) / 2 * 100))
  
  // Social Wellness (from social support indicators)
  scores.social = mapScoreToPercentile(
    assessment.social_support_score || 50,
    0, 100, 0, 100
  )
  
  // Intellectual Wellness (from education level)
  scores.intellectual = mapEducationToScore(assessment.education_level)
  
  // Occupational Wellness (from employment status)
  scores.occupational = mapEmploymentToScore(assessment.employment_status)
  
  // Environmental Wellness (from housing status)
  scores.environmental = mapHousingToScore(assessment.housing_status)
  
  // Financial Wellness (from financial stability indicators)
  scores.financial = mapScoreToPercentile(
    assessment.financial_stability || 50,
    0, 100, 0, 100
  )
  
  // Spiritual Wellness (from spiritual practice indicators)
  scores.spiritual = mapScoreToPercentile(
    assessment.spiritual_practices || 50,
    0, 100, 0, 100
  )
  
  return scores
}

// Helper mapping functions
function mapScoreToPercentile(value, minIn, maxIn, minOut, maxOut) {
  return Math.round(((value - minIn) / (maxIn - minIn)) * (maxOut - minOut) + minOut)
}

function mapEducationToScore(level) {
  const educationMap = {
    'less_than_high_school': 30,
    'high_school': 50,
    'some_college': 65,
    'associates': 70,
    'bachelors': 80,
    'masters': 90,
    'doctorate': 95
  }
  return educationMap[level] || 50
}

function mapEmploymentToScore(status) {
  const employmentMap = {
    'full_time': 90,
    'part_time': 70,
    'self_employed': 80,
    'student': 75,
    'retired': 85,
    'unemployed_looking': 40,
    'unemployed_not_looking': 30,
    'disabled': 50
  }
  return employmentMap[status] || 50
}

function mapHousingToScore(status) {
  const housingMap = {
    'owned': 90,
    'rented': 80,
    'staying_with_family': 60,
    'temporary_housing': 40,
    'shelter': 20,
    'homeless': 10
  }
  return housingMap[status] || 50
}

// ============================================================================
// Z-CODE MAPPING
// ============================================================================

/**
 * Extract Z-Codes (social determinants) from assessment
 * @param {object} assessment - AlayaCare assessment data
 * @returns {Array<string>} List of applicable Z-codes
 */
export function extractZCodes(assessment) {
  const zCodes = []
  
  // Housing-related
  if (assessment.housing_status === 'homeless') {
    zCodes.push('Z59.0') // Homelessness
  } else if (assessment.housing_status === 'temporary_housing') {
    zCodes.push('Z59.8') // Housing instability
  }
  
  if (assessment.housing_quality === 'inadequate') {
    zCodes.push('Z59.1') // Inadequate housing
  }
  
  // Food security
  if (assessment.food_insecurity) {
    zCodes.push('Z59.4') // Lack of adequate food
  }
  
  // Employment
  if (assessment.employment_status === 'unemployed_looking' || 
      assessment.employment_status === 'unemployed_not_looking') {
    zCodes.push('Z56.0') // Unemployment
  }
  
  if (assessment.job_loss_recent) {
    zCodes.push('Z56.9') // Other problems related to employment
  }
  
  // Financial
  if (assessment.low_income || assessment.financial_stability < 30) {
    zCodes.push('Z59.6') // Low income
  }
  
  // Education
  if (assessment.educational_problems) {
    zCodes.push('Z55.9') // Problems related to education
  }
  
  // Social/Family
  if (assessment.victim_of_abuse) {
    zCodes.push('Z91.4') // Personal history of psychological trauma
  }
  
  if (assessment.family_disruption) {
    zCodes.push('Z63.4') // Disappearance or death of family member
  }
  
  if (assessment.social_isolation) {
    zCodes.push('Z65.1') // Imprisonment and other incarceration (if applicable)
  }
  
  return zCodes
}

// ============================================================================
// CLIENT MAPPING
// ============================================================================

/**
 * Map AlayaCare client to ATLAS enrollee format
 * @param {object} alayaCareClient - AlayaCare client object
 * @returns {object} ATLAS enrollee object
 */
export function mapClientToEnrollee(alayaCareClient) {
  return {
    alayacareClientId: alayaCareClient.id,
    demographics: {
      firstName: alayaCareClient.firstName || alayaCareClient.first_name,
      lastName: alayaCareClient.lastName || alayaCareClient.last_name,
      dob: alayaCareClient.dateOfBirth || alayaCareClient.date_of_birth,
      photoUrl: alayaCareClient.photoUrl || generatePlaceholderPhoto(
        alayaCareClient.firstName, 
        alayaCareClient.lastName
      ),
      phone: alayaCareClient.phone,
      email: alayaCareClient.email,
      address: {
        street: alayaCareClient.address?.street,
        city: alayaCareClient.address?.city,
        state: alayaCareClient.address?.state,
        zipCode: alayaCareClient.address?.zip_code
      }
    },
    careTeam: [],
    riskProfile: {
      tier: 1, // Will be updated with assessment data
      wellnessScores: {
        physical: 50,
        emotional: 50,
        social: 50,
        intellectual: 50,
        occupational: 50,
        environmental: 50,
        financial: 50,
        spiritual: 50
      },
      lscmiScores: {},
      zCodes: []
    },
    externalIds: {
      alayacare: alayaCareClient.id,
      externalId: alayaCareClient.externalId || alayaCareClient.external_id
    },
    lastSyncedAt: new Date().toISOString()
  }
}

function generatePlaceholderPhoto(firstName, lastName) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  return `https://placehold.co/100x100/E2E8F0/64748B?text=${initials}`
}

// ============================================================================
// ASSESSMENT MAPPING
// ============================================================================

/**
 * Map AlayaCare assessment to ATLAS risk profile
 * @param {object} alayaCareAssessment - AlayaCare assessment object
 * @returns {object} ATLAS risk profile update
 */
export function mapAssessmentToRiskProfile(alayaCareAssessment) {
  const lscmiScores = extractLSCMIScores(alayaCareAssessment)
  const totalScore = Object.values(lscmiScores).reduce((sum, score) => sum + score, 0)
  
  return {
    tier: calculateRiskTier(totalScore),
    wellnessScores: calculateWellnessScores(alayaCareAssessment),
    lscmiScores: lscmiScores,
    zCodes: extractZCodes(alayaCareAssessment),
    assessmentId: alayaCareAssessment.id,
    assessmentDate: alayaCareAssessment.submittedAt || alayaCareAssessment.submitted_at,
    assessor: alayaCareAssessment.assessor || alayaCareAssessment.submitted_by,
    lastSyncedAt: new Date().toISOString()
  }
}

/**
 * Extract LS/CMI scores from assessment
 * @param {object} assessment - AlayaCare assessment data
 * @returns {object} LS/CMI scores by domain
 */
export function extractLSCMIScores(assessment) {
  // Map assessment fields to LS/CMI domains
  // Note: Field names depend on your AlayaCare form configuration
  
  return {
    criminal: assessment.criminal_history_score || 0,
    education: assessment.education_employment_score || 0,
    financial: assessment.financial_score || 0,
    family: assessment.family_marital_score || 0,
    accommodation: assessment.accommodation_score || 0,
    leisure: assessment.leisure_recreation_score || 0,
    companions: assessment.companions_score || 0,
    alcohol: assessment.alcohol_drug_score || 0,
    attitudes: assessment.procriminal_attitude_score || 0,
    antisocial: assessment.antisocial_pattern_score || 0
  }
}

// ============================================================================
// ASSESSMENT TIMELINE
// ============================================================================

/**
 * Format assessment for timeline display
 * @param {object} assessment - AlayaCare assessment
 * @returns {object} Timeline entry
 */
export function formatAssessmentForTimeline(assessment) {
  const lscmiScores = extractLSCMIScores(assessment)
  const totalScore = Object.values(lscmiScores).reduce((sum, score) => sum + score, 0)
  const tier = calculateRiskTier(totalScore)
  
  return {
    id: assessment.id,
    date: assessment.submittedAt || assessment.submitted_at,
    tier: tier,
    totalScore: totalScore,
    assessor: assessment.assessor || assessment.submitted_by,
    formName: assessment.formName || assessment.form_name || 'LS/CMI Assessment',
    scores: lscmiScores,
    wellnessScores: calculateWellnessScores(assessment),
    zCodes: extractZCodes(assessment)
  }
}

/**
 * Create assessment timeline from multiple assessments
 * @param {Array<object>} assessments - Array of AlayaCare assessments
 * @returns {Array<object>} Sorted timeline entries
 */
export function createAssessmentTimeline(assessments) {
  return assessments
    .map(formatAssessmentForTimeline)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that required fields are present
 * @param {object} client - AlayaCare client
 * @returns {object} Validation result { valid: boolean, errors: Array }
 */
export function validateClient(client) {
  const errors = []
  
  if (!client.id) errors.push('Client ID is required')
  if (!client.firstName && !client.first_name) errors.push('First name is required')
  if (!client.lastName && !client.last_name) errors.push('Last name is required')
  if (!client.dateOfBirth && !client.date_of_birth) errors.push('Date of birth is required')
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate assessment data
 * @param {object} assessment - AlayaCare assessment
 * @returns {object} Validation result
 */
export function validateAssessment(assessment) {
  const errors = []
  
  if (!assessment.id) errors.push('Assessment ID is required')
  if (!assessment.clientId && !assessment.client_id) errors.push('Client ID is required')
  if (!assessment.submittedAt && !assessment.submitted_at) errors.push('Submission date is required')
  
  return {
    valid: errors.length === 0,
    errors
  }
}

export default {
  calculateRiskTier,
  calculateWellnessScores,
  extractZCodes,
  mapClientToEnrollee,
  mapAssessmentToRiskProfile,
  extractLSCMIScores,
  formatAssessmentForTimeline,
  createAssessmentTimeline,
  validateClient,
  validateAssessment
}

