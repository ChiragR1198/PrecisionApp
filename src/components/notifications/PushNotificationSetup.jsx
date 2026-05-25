import * as Notifications from 'expo-notifications';
import { useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { api, useRegisterPushTokenMutation } from '../../store/api';
import { store } from '../../store';
import { navigateFromNotificationData } from '../../utils/notificationNavigation';
import {
  getNotificationToken,
  requestNotificationPermissions,
} from '../../utils/notifications';

function parseNotificationData(response) {
  return response?.notification?.request?.content?.data || {};
}

/**
 * Registers Expo push token with backend and handles OS notification taps (lock screen / banner).
 * Requires a development or production build — not Expo Go.
 */
export function PushNotificationSetup() {
  const [registerPushToken] = useRegisterPushTokenMutation();
  const navigationState = useRootNavigationState();
  const navReady = Boolean(navigationState?.key);
  const pendingNavRef = useRef(null);
  const handledColdStartRef = useRef(false);

  const registerTokenWithBackend = async () => {
    const granted = await requestNotificationPermissions();
    if (!granted) {
      console.warn('📱 Push: Notification permission not granted — enable in device Settings.');
      return;
    }
    const token = await getNotificationToken();
    if (!token) {
      console.warn('📱 Push: No Expo push token — use a real device and EAS/dev build (not Expo Go).');
      return;
    }
    try {
      await registerPushToken({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      }).unwrap();
      console.log('✅ Push token registered with backend.');
    } catch (err) {
      const status = err?.status ?? err?.data?.status;
      const message = err?.data?.message ?? err?.message ?? '';
      console.warn('❌ Push token registration failed:', status, message || err?.data || err);
    }
  };

  const queueNavigation = (data) => {
    if (!data || typeof data !== 'object') return;
    pendingNavRef.current = data;
  };

  const flushPendingNavigation = () => {
    if (!navReady || !pendingNavRef.current) return;
    const data = pendingNavRef.current;
    pendingNavRef.current = null;
    setTimeout(() => {
      navigateFromNotificationData(data);
    }, 150);
  };

  useEffect(() => {
    registerTokenWithBackend();

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        registerTokenWithBackend();
      }
    });
    return () => sub?.remove();
  }, [registerPushToken]);

  useEffect(() => {
    flushPendingNavigation();
  }, [navReady]);

  // Cold start: user tapped notification while app was killed
  useEffect(() => {
    if (handledColdStartRef.current) return;
    handledColdStartRef.current = true;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        queueNavigation(parseNotificationData(response));
        flushPendingNavigation();
      })
      .catch((e) => console.warn('getLastNotificationResponseAsync', e));
  }, []);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const data = notification?.request?.content?.data || {};
        const tags = ['NotificationInbox'];
        if (
          data.type === 'itinerary_meeting_deleted' ||
          data.type === 'itinerary_meeting_updated'
        ) {
          tags.push('Agenda');
        }
        if (data.type === 'chat_message' || data.type === 'message') {
          tags.push('Messages');
        }
        if (data.type === 'meeting_request') {
          tags.push('MeetingRequests');
        }
        store.dispatch(api.util.invalidateTags(tags));
      } catch (e) {
        console.warn('invalidate notification tags', e);
      }
    });
    return () => receivedSub.remove();
  }, []);

  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = parseNotificationData(response);
      if (navReady) {
        setTimeout(() => navigateFromNotificationData(data), 100);
      } else {
        queueNavigation(data);
      }
    });
    return () => responseSub.remove();
  }, [navReady]);

  return null;
}
