import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions
 * @returns {Promise<boolean>} True if permission granted
 */
export const requestNotificationPermissions = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('⚠️ Notification permission not granted');
      return false;
    }
    
    // For Android, create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }
    
    console.log('✅ Notification permissions granted');
    return true;
  } catch (error) {
    console.error('❌ Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Get notification token for push notifications
 * @returns {Promise<string|null>} Expo push token
 */
export const getNotificationToken = async () => {
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: '0439d5f9-4716-47e0-a8f3-07b17c27a43d', // From app.json
    });
    console.log('📱 Notification token:', token.data);
    return token.data;
  } catch (error) {
    console.error('❌ Error getting notification token:', error);
    return null;
  }
};

/**
 * Show local notification for new message
 * @param {string} title - Notification title
 * @param {string} body - Notification body (message text)
 * @param {object} data - Additional data (user_id, thread_id, etc.)
 */
export const showMessageNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'New Message',
        body: body || 'You have a new message',
        data: {
          type: 'message',
          ...data,
        },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Show immediately
    });
    console.log('📬 Notification shown:', { title, body });
  } catch (error) {
    console.error('❌ Error showing notification:', error);
  }
};

/**
 * Cancel all notifications
 */
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('❌ Error canceling notifications:', error);
  }
};

/**
 * Setup notification listener
 * @param {function} onNotificationReceived - Callback when notification received
 * @returns {function} Cleanup function
 */
export const setupNotificationListener = (onNotificationReceived) => {
  // Listener for notifications received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received (foreground):', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener for user tapping on notification
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 Notification tapped:', response);
    const data = response.notification.request.content.data;
    if (data && data.type === 'message' && onNotificationReceived) {
      onNotificationReceived(response.notification);
    }
  });

  // Return cleanup function
  return () => {
    // Use .remove() method on subscription objects instead of removeNotificationSubscription
    if (notificationListener && typeof notificationListener.remove === 'function') {
      notificationListener.remove();
    }
    if (responseListener && typeof responseListener.remove === 'function') {
      responseListener.remove();
    }
  };
};

