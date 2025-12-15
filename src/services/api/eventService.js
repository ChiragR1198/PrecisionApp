import apiClient from './apiClient';

export const eventService = {
  /**
   * Get all events
   * @returns {Promise<Object>} - Response data with events array
   */
  async getAllEvents() {
    try {
      const response = await apiClient.get('/events');

      return {
        success: true,
        data: response.data || [],
        message: response.message || 'Events retrieved successfully',
        count: response.count || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch events. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Get a specific event by ID
   * @param {string|number} eventId - Event ID
   * @returns {Promise<Object>} - Response data with event details
   */
  async getEventById(eventId) {
    try {
      if (!eventId) {
        return {
          success: false,
          error: 'Event ID is required',
        };
      }

      const response = await apiClient.get(`/events/${eventId}`);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Event retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch event. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },
};

export default eventService;

