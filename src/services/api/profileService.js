import apiClient from './apiClient';

export const profileService = {
  /**
   * Get user profile
   * @returns {Promise<Object>} - Response data with user profile
   */
  async getProfile() {
    try {
      const response = await apiClient.get('/profile');

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Profile retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch profile. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} - Response data
   */
  async updateProfile(profileData) {
    try {
      const response = await apiClient.put('/profile', profileData);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Profile updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to update profile. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Change user password
   * @param {Object} passwordData - Password data (currentPassword, newPassword)
   * @returns {Promise<Object>} - Response data
   */
  async changePassword(passwordData) {
    try {
      const response = await apiClient.put('/profile/change-password', passwordData);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Password changed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to change password. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },
};

export default profileService;

