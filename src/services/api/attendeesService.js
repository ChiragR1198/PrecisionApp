import apiClient from './apiClient';

export const attendeesService = {
  /**
   * Get all attendees
   * @param {Object} params - Query parameters (filters, sorting, etc.)
   * @returns {Promise<Object>} - Response data with attendees array
   */
  async getAttendees(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const endpoint = queryString ? `/attendees?${queryString}` : '/attendees';
      const response = await apiClient.get(endpoint);

      return {
        success: true,
        data: response.data || response || [],
        message: response.message || 'Attendees retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch attendees. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Get a specific attendee/delegate by ID
   * @param {string|number} delegateId - Delegate ID
   * @returns {Promise<Object>} - Response data with delegate details
   */
  async getDelegateById(delegateId) {
    try {
      if (!delegateId) {
        return {
          success: false,
          error: 'Delegate ID is required',
        };
      }

      const response = await apiClient.get(`/attendees/${delegateId}`);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Delegate retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch delegate. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },
};

export default attendeesService;

