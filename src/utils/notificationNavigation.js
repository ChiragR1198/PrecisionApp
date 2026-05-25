import { router } from 'expo-router';

/**
 * Navigate when user taps a push notification (or opens app from one).
 * @param {object} data — Expo push `data` payload from backend
 */
export function navigateFromNotificationData(data) {
  if (!data || typeof data !== 'object') return false;

  const type = data.type;
  const screen = data.screen;

  try {
    if (type === 'meeting_approved' || type === 'meeting_accepted') {
      router.push('/(drawer)/itinerary');
      return true;
    }
    if (type === 'itinerary_meeting_deleted' || type === 'itinerary_meeting_updated') {
      router.push('/(drawer)/itinerary');
      return true;
    }
    if (
      type === 'meeting_request' ||
      type === 'meeting_rejected' ||
      type === 'meeting_declined' ||
      screen === 'meeting_requests'
    ) {
      router.push('/(drawer)/meeting-requests');
      return true;
    }
    if (
      type === 'chat_message' ||
      type === 'message' ||
      screen === 'chat' ||
      screen === 'messages'
    ) {
      const fromId = data.from_id ?? data.to_id;
      const fromType = data.from_type || 'delegate';
      if (fromId != null && fromId !== '') {
        router.push({
          pathname: '/(drawer)/message-detail',
          params: {
            thread: JSON.stringify({
              id: fromId,
              user_id: fromId,
              user_type: fromType,
              name: data.sender_name || 'Chat',
            }),
            returnTo: 'messages',
          },
        });
        return true;
      }
      router.push('/(drawer)/messages');
      return true;
    }
    if (type === 'session_reminder') {
      router.push('/(drawer)/agenda');
      return true;
    }
    if (type === 'exhibition_announcement' || type === 'admin_broadcast') {
      router.push('/(drawer)/dashboard');
      return true;
    }
    if (screen === 'notifications') {
      router.push('/(drawer)/dashboard');
      return true;
    }
  } catch (e) {
    console.warn('Notification navigation error:', e);
  }
  return false;
}
