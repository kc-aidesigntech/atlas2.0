/**
 * AlayaCare Application Programming Interface (API) Client
 * Handles authentication and API requests to AlayaCare platform
 */

class AlayaCareClient {
  constructor() {
    this.brokerBaseUrl = (import.meta.env.VITE_ALAYACARE_BROKER_URL || '').replace(/\/+$/, '')
    this.tenantId = import.meta.env.VITE_ALAYACARE_TENANT_ID
    this.enabled = import.meta.env.VITE_ALAYACARE_ENABLED === 'true' && Boolean(this.brokerBaseUrl)
  }

  /**
   * Check if AlayaCare integration is enabled
   */
  isEnabled() {
    return this.enabled
  }

  /**
   * Make authenticated API request
   * @param {string} endpoint - API endpoint (relative to base Uniform Resource Locator (URL))
   * @param {object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}) {
    if (!this.isEnabled()) {
      throw new Error('AlayaCare integration is not enabled or broker URL is missing')
    }

    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }
    if (this.tenantId) {
      headers['X-Tenant-ID'] = this.tenantId
    }

    const response = await fetch(`${this.brokerBaseUrl}${normalizedEndpoint}`, {
      ...options,
      headers
    })

    if (!response.ok) {
      const error = await response.text()
      // Surface raw body text because AlayaCare returns useful diagnostics outside JavaScript Object Notation (JSON) envelopes.
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
   * Get client by Identifier (ID)
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
    
    // Always return arrays to keep caller rendering logic null-safe.
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

