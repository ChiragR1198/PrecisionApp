import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { EAS_PROJECT_ID } from '../constants/easProject';

// Foreground + background: show OS banner / list (Expo SDK 50+ requires banner + list, not only deprecated shouldShowAlert)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
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
    
    // Android: channels must match backend Expo push `channelId` (see ExpoPush.php → default)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8A3490',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
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
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      EAS_PROJECT_ID;
    if (!projectId) {
      console.error('❌ Push: Missing EAS projectId — check app.json extra.eas.projectId');
      return null;
    }
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('📱 Notification token:', token.data);
    return token.data;
  } catch (error) {
    console.error('❌ Error getting notification token:', error);
    return null;
  }
};

/**
 * Show local notification for new message
 * @param {string} title
 * @param {string} body
 * @param {object} data
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
      trigger: null,
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
 * @param {function} onNotificationReceived
 * @returns {function} Cleanup function
 */
export const setupNotificationListener = (onNotificationReceived) => {
  const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received (foreground):', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 Notification tapped:', response);
    const data = response.notification.request.content.data;
    if (data && data.type === 'message' && onNotificationReceived) {
      onNotificationReceived(response.notification);
    }
  });

  // Cleanup
  return () => {
    if (notificationListener && typeof notificationListener.remove === 'function') {
      notificationListener.remove();
    }
    if (responseListener && typeof responseListener.remove === 'function') {
      responseListener.remove();
    }
  };
};