import apiClient from './apiClient';

export const meetingRequestsService = {
  /**
   * Get all meeting requests
   * @returns {Promise<Object>} - Response data with meeting requests array
   */
  async getMeetingRequests() {
    try {
      const response = await apiClient.get('/meeting-requests');

      return {
        success: true,
        data: response.data || response || [],
        message: response.message || 'Meeting requests retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch meeting requests. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Create a meeting request
   * @param {Object} requestData - Meeting request data
   * @returns {Promise<Object>} - Response data
   */
  async createMeetingRequest(requestData) {
    try {
      const response = await apiClient.post('/meeting-requests', requestData);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Meeting request created successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to create meeting request. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Update a meeting request (accept/reject)
   * @param {string|number} requestId - Meeting request ID
   * @param {Object} updateData - Update data (status, etc.)
   * @returns {Promise<Object>} - Response data
   */
  async updateMeetingRequest(requestId, updateData) {
    try {
      if (!requestId) {
        return {
          success: false,
          error: 'Request ID is required',
        };
      }

      const response = await apiClient.put(`/meeting-requests/${requestId}`, updateData);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Meeting request updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to update meeting request. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },
};

export default meetingRequestsService;

