import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useRegisterPushTokenMutation } from '../../store/api';
import {
  getNotificationToken,
  requestNotificationPermissions,
} from '../../utils/notifications';

/**
 * Registers push token with backend and handles notification tap navigation.
 * Render once when user is authenticated (e.g. inside drawer layout).
 */
export function PushNotificationSetup() {
  const [registerPushToken] = useRegisterPushTokenMutation();
  const listenerRef = useRef(null);

  const registerTokenWithBackend = async () => {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.warn('📱 Push: Notification permission not granted – token not sent to backend.');
      return;
    }
    const token = await getNotificationToken();
    if (!token) {
      console.warn('📱 Push: No Expo push token (simulator/device) – token not sent to backend.');
      return;
    }
    console.log('📱 Push: Sending token to backend...', token.slice(0, 40) + '...');
    try {
      await registerPushToken({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      }).unwrap();
      console.log('✅ Push token registered with backend – tokens are stored in backend DB (mobile_device_tokens).');
    } catch (err) {
      const status = err?.status ?? err?.data?.status;
      const message = err?.data?.message ?? err?.message ?? '';
      console.warn('❌ Push token registration failed:', status, message || err?.data || err);
      if (status === 404) {
        console.warn('📌 Tip: Backend pe push/register-token route deploy karo. Local DB dekh rahe ho to app ko local API URL se run karo.');
      }
    }
  };

  // Register on mount and when app comes to foreground (so token is saved after backend is deployed)
  useEffect(() => {
    let mounted = true;
    registerTokenWithBackend();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && mounted) {
        registerTokenWithBackend();
      }
    });
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [registerPushToken]);

  // Handle notification tap (user opened app from notification)
  useEffect(() => {
    listenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data || {};
        const type = data.type;
        try {
          if (type === 'meeting_request' || type === 'meeting_approved' || type === 'meeting_rejected') {
            router.push('/(drawer)/meeting-requests');
            return;
          }
          if (type === 'chat_message' && (data.from_id != null || data.to_id != null)) {
            const fromId = data.from_id ?? data.to_id;
            const fromType = data.from_type || 'delegate';
            const thread = {
              id: fromId,
              user_id: fromId,
              user_type: fromType,
              name: 'Chat',
            };
            router.push({
              pathname: '/(drawer)/message-detail',
              params: {
                thread: JSON.stringify(thread),
                returnTo: 'messages',
              },
            });
            return;
          }
          if (type === 'session_reminder') {
            router.push('/(drawer)/agenda');
            return;
          }
          if (type === 'exhibition_announcement' && data.event_id) {
            router.push('/(drawer)/dashboard');
            return;
          }
        } catch (e) {
          console.warn('Notification navigation error:', e);
        }
      }
    );

    return () => {
      if (listenerRef.current?.remove) {
        listenerRef.current.remove();
      }
    };
  }, []);

  return null;
}
