import apiClient from './apiClient';

export const sponsorsService = {
  /**
   * Get all sponsors
   * @returns {Promise<Object>} - Response data with sponsors array
   */
  async getSponsors() {
    try {
      const response = await apiClient.get('/sponsors');

      return {
        success: true,
        data: response.data || response || [],
        message: response.message || 'Sponsors retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch sponsors. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Get a specific sponsor by ID
   * @param {string|number} sponsorId - Sponsor ID
   * @returns {Promise<Object>} - Response data with sponsor details
   */
  async getSponsorById(sponsorId) {
    try {
      if (!sponsorId) {
        return {
          success: false,
          error: 'Sponsor ID is required',
        };
      }

      const response = await apiClient.get(`/sponsors/${sponsorId}`);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Sponsor retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch sponsor. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },
};

export default sponsorsService;

