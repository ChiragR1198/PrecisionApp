import { API_BASE_URL } from '../config/api';

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.isConnecting = false;
    this.isConnected = false;
    this.currentUserId = null;
    this.currentUserType = null;
    this.endpointUnavailable = false; // Track if endpoint is unavailable (404)
    this.hasWarnedAboutUnavailable = false; // Track if we've already warned
  }

  // Get WebSocket URL with user authentication
  getWebSocketUrl(userId, userType) {
    // Extract base URL from API_BASE_URL and convert to WebSocket URL
    // API_BASE_URL: https://stage1.events.precision-globe.com/mobile/
    // WebSocket URL: wss://stage1.events.precision-globe.com/ws?userId=...&type=...
    let baseUrl = API_BASE_URL.replace(/^https?:\/\//, ''); // Remove http:// or https://
    baseUrl = baseUrl.replace(/\/mobile\/?$/, ''); // Remove /mobile/ at the end
    baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    // Convert to WebSocket URL (wss for https, ws for http)
    const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
    const wsBaseUrl = `${wsProtocol}://${baseUrl}`;
    
    // Construct WebSocket URL matching backend format: wss://events.precision-globe.com/ws?userId=...&type=...
    const wsUrl = `${wsBaseUrl}/ws?userId=${userId}&type=${userType}`;
    console.log('🔌 WebSocket URL constructed:', wsUrl);
    return wsUrl;
  }

  // Connect to WebSocket server
  async connect(userId, userType) {
    if (this.isConnecting || this.isConnected) {
      console.log('🔌 WebSocket already connecting or connected');
      return;
    }

    // Don't attempt connection if endpoint is known to be unavailable
    if (this.endpointUnavailable) {
      return;
    }

    if (!userId || !userType) {
      console.warn('⚠️ userId and userType required for WebSocket connection');
      return;
    }

    try {
      this.isConnecting = true;
      
      // Get WebSocket URL with user authentication
      const wsUrl = this.getWebSocketUrl(userId, userType);
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      
      // Store userId and userType for reconnection
      this.currentUserId = userId;
      this.currentUserType = userType;
      
      // Create WebSocket connection
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Store userId and userType for reconnection
        this.currentUserId = userId;
        this.currentUserType = userType;
        
        // Notify all listeners
        this.emit('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);
          
          // Handle different message types
          if (data.type) {
            this.emit(data.type, data);
          } else {
            this.emit('message', data);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          // If not JSON, emit as raw message
          this.emit('message', event.data);
        }
      };

      this.socket.onerror = (error) => {
        // Suppress WebSocket errors - they're handled in onclose event
        // Don't log or emit errors here to avoid showing "Unknown WebSocket error" to users
        // The onclose handler will properly handle connection failures
        return;
      };

      this.socket.onclose = (event) => {
        // Detect 404/unavailable endpoint: code 1006 (abnormal closure) 
        // with no normal close reason, typically means endpoint doesn't exist
        const is404Error = event.code === 1006 && (
          event.reason?.includes('404') || 
          event.reason?.includes('bad response code') ||
          !event.reason || // Empty reason with 1006 often indicates 404
          event.reason === ''
        );
        
        if (is404Error && !this.endpointUnavailable) {
          // Mark endpoint as unavailable to prevent further attempts
          this.endpointUnavailable = true;
          this.reconnectAttempts = this.maxReconnectAttempts;
          
          // Only warn once
          if (!this.hasWarnedAboutUnavailable) {
            console.warn('⚠️ WebSocket endpoint not found (404). WebSocket server may not be available on staging.');
            console.warn('⚠️ App will continue to work. Use pull-to-refresh to get new messages.');
            this.hasWarnedAboutUnavailable = true;
          }
          
          this.isConnected = false;
          this.isConnecting = false;
          this.emit('disconnected', event);
          return;
        }
        
        // If endpoint is known to be unavailable, don't log or attempt reconnection
        if (this.endpointUnavailable) {
          this.isConnected = false;
          this.isConnecting = false;
          return;
        }
        
        console.log('🔌 WebSocket closed:', event.code, event.reason || 'No reason provided');
        this.isConnected = false;
        this.isConnecting = false;
        this.emit('disconnected', event);
        
        // Attempt to reconnect if not intentionally closed and endpoint is available
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts && !this.endpointUnavailable) {
          this.reconnectAttempts++;
          console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => {
            // Reconnect with stored userId and userType
            if (this.currentUserId && this.currentUserType && !this.endpointUnavailable) {
              this.connect(this.currentUserId, this.currentUserType);
            }
          }, this.reconnectDelay);
        }
      };

    } catch (error) {
      console.error('❌ Error connecting WebSocket:', error);
      this.isConnecting = false;
      this.emit('error', error);
    }
  }

  // Disconnect from WebSocket server
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      // Note: Don't reset endpointUnavailable on disconnect - keep it until next app restart
    }
  }
  
  // Reset endpoint unavailable status (useful for testing or when endpoint becomes available)
  resetEndpointStatus() {
    this.endpointUnavailable = false;
    this.hasWarnedAboutUnavailable = false;
    this.reconnectAttempts = 0;
  }

  // Send message through WebSocket
  send(type, data) {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ WebSocket not connected, cannot send message. Message will be sent via API instead.');
      return false;
    }

    try {
      const message = {
        type,
        data,
        timestamp: Date.now(),
      };
      this.socket.send(JSON.stringify(message));
      console.log('📤 WebSocket message sent:', message);
      return true;
    } catch (error) {
      console.error('❌ Error sending WebSocket message:', error);
      // Don't throw error - let API handle message sending as fallback
      return false;
    }
  }

  // Subscribe to WebSocket events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Emit event to all listeners
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in WebSocket listener for ${event}:`, error);
        }
      });
    }
  }

  // Remove all listeners
  removeAllListeners() {
    this.listeners.clear();
  }
}

// Export singleton instance
export const websocketManager = new WebSocketManager();

// Helper function to setup WebSocket for messages
export const setupMessageWebSocket = (onNewMessage, onMessageUpdate) => {
  // Connect if not already connected
  if (!websocketManager.isConnected && !websocketManager.isConnecting) {
    websocketManager.connect();
  }

  // Listen for new messages
  const unsubscribeNewMessage = websocketManager.on('new_message', (data) => {
    console.log('💬 New message received via WebSocket:', data);
    if (onNewMessage) {
      onNewMessage(data);
    }
  });

  // Listen for message updates
  const unsubscribeMessageUpdate = websocketManager.on('message_update', (data) => {
    console.log('💬 Message update received via WebSocket:', data);
    if (onMessageUpdate) {
      onMessageUpdate(data);
    }
  });

  // Listen for connection status
  const unsubscribeConnected = websocketManager.on('connected', () => {
    console.log('✅ WebSocket connected for messages');
  });

  const unsubscribeDisconnected = websocketManager.on('disconnected', () => {
    console.log('🔌 WebSocket disconnected for messages');
  });

  // Return cleanup function
  return () => {
    unsubscribeNewMessage();
    unsubscribeMessageUpdate();
    unsubscribeConnected();
    unsubscribeDisconnected();
  };
};

