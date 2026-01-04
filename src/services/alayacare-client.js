/**
 * AlayaCare API Client
 * Handles authentication and API requests to AlayaCare platform
 */

class AlayaCareClient {
  constructor() {
    this.clientId = import.meta.env.VITE_ALAYACARE_CLIENT_ID
    this.clientSecret = import.meta.env.VITE_ALAYACARE_CLIENT_SECRET
    this.apiBase = import.meta.env.VITE_ALAYACARE_API_BASE || 'https://api.alayacare.com/v1'
    this.tenantId = import.meta.env.VITE_ALAYACARE_TENANT_ID
    this.enabled = import.meta.env.VITE_ALAYACARE_ENABLED === 'true'
    
    this.accessToken = null
    this.tokenExpiry = null
  }

  /**
   * Check if AlayaCare integration is enabled
   */
  isEnabled() {
    return this.enabled && this.clientId && this.clientSecret
  }

  /**
   * Authenticate with AlayaCare OAuth 2.0
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    if (!this.isEnabled()) {
      throw new Error('AlayaCare integration is not enabled or configured')
    }

    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    console.log('🔐 Authenticating with AlayaCare...')

    try {
      const response = await fetch(`${this.apiBase}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'clients.read assessments.read care_plans.read clinical.read'
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Authentication failed: ${response.status} ${error}`)
      }

      const data = await response.json()
      this.accessToken = data.access_token
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000

      console.log('✅ Authenticated with AlayaCare')
      return this.accessToken

    } catch (error) {
      console.error('❌ AlayaCare authentication error:', error)
      throw error
    }
  }

  /**
   * Make authenticated API request
   * @param {string} endpoint - API endpoint (relative to base URL)
   * @param {object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}) {
    const token = await this.authenticate()

    const response = await fetch(`${this.apiBase}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': this.tenantId,
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API request failed: ${response.status} ${error}`)
    }

    return await response.json()
  }

  // ============================================================================
  // CLIENT ENDPOINTS
  // ============================================================================

  /**
   * Get all clients
   * @param {object} params - Query parameters
   * @returns {Promise<Array>} List of clients
   */
  async getClients(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    const endpoint = `/clients${queryString ? `?${queryString}` : ''}`
    const data = await this.request(endpoint)
    return data.clients || []
  }

  /**
   * Get client by ID
   * @param {string} clientId - AlayaCare client ID
   * @returns {Promise<object>} Client details
   */
  async getClient(clientId) {
    return await this.request(`/clients/${clientId}`)
  }

  /**
   * Search clients by name or external ID
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Matching clients
   */
  async searchClients(searchTerm) {
    return await this.getClients({ search: searchTerm })
  }

  // ============================================================================
  // ASSESSMENT ENDPOINTS
  // ============================================================================

  /**
   * Get client assessments
   * @param {string} clientId - AlayaCare client ID
   * @param {object} options - Filter options (startDate, endDate, formId)
   * @returns {Promise<Array>} List of assessments
   */
  async getClientAssessments(clientId, options = {}) {
    const params = new URLSearchParams()
    if (options.startDate) params.append('start_date', options.startDate)
    if (options.endDate) params.append('end_date', options.endDate)
    if (options.formId) params.append('form_id', options.formId)

    const queryString = params.toString()
    const endpoint = `/clients/${clientId}/assessments${queryString ? `?${queryString}` : ''}`
    
    const data = await this.request(endpoint)
    return data.assessments || []
  }

  /**
   * Get specific assessment by ID
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<object>} Assessment details
   */
  async getAssessment(assessmentId) {
    return await this.request(`/assessments/${assessmentId}`)
  }

  // ============================================================================
  // CARE PLAN ENDPOINTS
  // ============================================================================

  /**
   * Get client care plans
   * @param {string} clientId - AlayaCare client ID
   * @returns {Promise<Array>} List of care plans
   */
  async getClientCarePlans(clientId) {
    const data = await this.request(`/clients/${clientId}/care_plans`)
    return data.care_plans || []
  }

  /**
   * Get active care plan for client
   * @param {string} clientId - AlayaCare client ID
   * @returns {Promise<object|null>} Active care plan or null
   */
  async getActiveCarePlan(clientId) {
    const carePlans = await this.getClientCarePlans(clientId)
    return carePlans.find(plan => plan.status === 'active') || null
  }

  // ============================================================================
  // CLINICAL NOTES ENDPOINTS
  // ============================================================================

  /**
   * Get client clinical notes
   * @param {string} clientId - AlayaCare client ID
   * @param {object} options - Filter options
   * @returns {Promise<Array>} List of clinical notes
   */
  async getClientClinicalNotes(clientId, options = {}) {
    const params = new URLSearchParams()
    if (options.startDate) params.append('start_date', options.startDate)
    if (options.endDate) params.append('end_date', options.endDate)
    if (options.noteType) params.append('note_type', options.noteType)

    const queryString = params.toString()
    const endpoint = `/clients/${clientId}/clinical_notes${queryString ? `?${queryString}` : ''}`
    
    const data = await this.request(endpoint)
    return data.clinical_notes || []
  }

  // ============================================================================
  // FORM ENDPOINTS
  // ============================================================================

  /**
   * Get available assessment forms
   * @returns {Promise<Array>} List of forms
   */
  async getForms() {
    const data = await this.request('/forms')
    return data.forms || []
  }

  /**
   * Get form submissions
   * @param {string} formId - Form ID
   * @param {object} options - Filter options
   * @returns {Promise<Array>} List of form submissions
   */
  async getFormSubmissions(formId, options = {}) {
    const params = new URLSearchParams()
    if (options.clientId) params.append('client_id', options.clientId)
    if (options.startDate) params.append('start_date', options.startDate)
    if (options.endDate) params.append('end_date', options.endDate)

    const queryString = params.toString()
    const endpoint = `/forms/${formId}/submissions${queryString ? `?${queryString}` : ''}`
    
    const data = await this.request(endpoint)
    return data.submissions || []
  }
}

// Create singleton instance
let alayaCareClient = null

/**
 * Get AlayaCare client instance
 * @returns {AlayaCareClient}
 */
export function getAlayaCareClient() {
  if (!alayaCareClient) {
    alayaCareClient = new AlayaCareClient()
  }
  return alayaCareClient
}

export default AlayaCareClient

