import apiClient from './apiClient';

export const agendaService = {
  /**
   * Get all agenda items
   * @returns {Promise<Object>} - Response data with agenda array
   */
  async getAgenda() {
    try {
      const response = await apiClient.get('/agenda');

      return {
        success: true,
        data: response.data || response || [],
        message: response.message || 'Agenda retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch agenda. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Get a specific agenda item by ID
   * @param {string|number} agendaId - Agenda ID
   * @returns {Promise<Object>} - Response data with agenda item details
   */
  async getAgendaItem(agendaId) {
    try {
      if (!agendaId) {
        return {
          success: false,
          error: 'Agenda ID is required',
        };
      }

      const response = await apiClient.get(`/agenda/item/${agendaId}`);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Agenda item retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch agenda item. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },
};

export default agendaService;

