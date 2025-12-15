import apiClient from './apiClient';

export const messagesService = {
  /**
   * Get all messages/conversations
   * @returns {Promise<Object>} - Response data with messages array
   */
  async getMessages() {
    try {
      const response = await apiClient.get('/messages');

      return {
        success: true,
        data: response.data || response || [],
        message: response.message || 'Messages retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch messages. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Get a specific message/conversation by ID
   * @param {string|number} messageId - Message ID
   * @returns {Promise<Object>} - Response data with message details
   */
  async getMessageById(messageId) {
    try {
      if (!messageId) {
        return {
          success: false,
          error: 'Message ID is required',
        };
      }

      const response = await apiClient.get(`/messages/${messageId}`);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Message retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch message. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },

  /**
   * Send a message
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} - Response data
   */
  async sendMessage(messageData) {
    try {
      const response = await apiClient.post('/messages', messageData);

      return {
        success: true,
        data: response.data || response,
        message: response.message || 'Message sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to send message. Please try again.',
        status: error.status,
        data: error.data,
      };
    }
  },
};

export default messagesService;

