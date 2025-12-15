import apiClient from './apiClient';

export const authService = {
  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} userType - User type (sponsor or delegate)
   * @returns {Promise<Object>} - Response data with token and user info
   */
  async login(email, password, userType = 'sponsor') {
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
        user_type: userType, // API expects user_type (snake_case)
      });

      // Validate user_type from response BEFORE storing token
      const actualUserType = 
        response?.data?.user_type || 
        response?.data?.userType || 
        response?.user?.user_type || 
        response?.user?.userType ||
        response?.data?.data?.user_type ||
        response?.data?.data?.userType ||
        response?.user_type ||
        response?.userType;

      // Normalize for comparison
      const selectedType = userType?.toLowerCase();
      const actualType = actualUserType?.toLowerCase();

      // If user type is found and doesn't match, reject login
      if (actualType && actualType !== selectedType) {
        const userTypeLabel = actualType === 'sponsor' ? 'Sponsor' : 'Delegate';
        return {
          success: false,
          error: `This account is registered as ${userTypeLabel}. Please select the correct user type.`,
          status: 403,
          data: response,
        };
      }

      // Only store token if user type validation passes
      if (response.token || response.access_token || response.data?.token) {
        const token = response.token || response.access_token || response.data?.token;
        await apiClient.setToken(token);
      }

      return {
        success: true,
        data: response,
        message: response.message || 'Login successful',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Login failed. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      // Get token first to ensure it's available for the API call
      const token = await apiClient.getToken();
      
      // Call logout API endpoint
      // Token is automatically added via Authorization header by apiClient
      // Some APIs also expect token in body, so we include it there too
      if (token) {
        try {
          await apiClient.post('/auth/logout', { token });
        } catch (apiError) {
          // Even if API call fails, continue with local logout
          console.warn('Logout API call failed, but continuing with local logout:', apiError.message || apiError);
        }
      } else {
        console.warn('No token found, skipping logout API call');
      }
      
      // Remove token from storage
      await apiClient.removeToken();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, try to remove token locally
      try {
        await apiClient.removeToken();
      } catch (removeError) {
        console.error('Error removing token:', removeError);
      }
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const token = await apiClient.getToken();
      return !!token;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get stored auth token
   * @returns {Promise<string|null>}
   */
  async getToken() {
    return await apiClient.getToken();
  },

  /**
   * Send forgot password reset link
   * @param {string} email - User email
   * @returns {Promise<Object>} - Response data
   */
  async forgotPassword(email) {
    try {
      const response = await apiClient.post('/auth/forgot-password', {
        email,
      });

      return {
        success: true,
        data: response,
        message: response.message || 'Password reset link sent successfully',
      };
    } catch (error) {
      // Extract more detailed error message
      let errorMessage = 'Failed to send reset link. Please try again.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.status === 404) {
        errorMessage = 'Endpoint not found. Please contact support.';
      } else if (error.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.status === 400) {
        errorMessage = 'Invalid email address. Please check and try again.';
      } else if (error.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      }
      
      console.error('Forgot password error:', {
        status: error.status,
        message: error.message,
        data: typeof error.data === 'string' ? error.data.substring(0, 200) : error.data,
      });

      return {
        success: false,
        error: errorMessage,
        status: error.status,
        data: error.data,
      };
    }
  },
};

export default authService;

