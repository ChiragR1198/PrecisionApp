import Icon from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../constants/theme';
import {
  useDeleteNotificationMutation,
  useGetNotificationInboxQuery,
  useGetNotificationUnreadCountQuery,
  useMarkNotificationReadMutation,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  // Force all notification timestamps to Eastern Time.
  // Using IANA tz handles both EST + EDT automatically.
  try {
    return d.toLocaleString(undefined, {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    // Fallback: older Android/JS runtimes may not support timeZone option.
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}

export function HeaderNotificationBell({ iconSize = 22 }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [open, setOpen] = useState(false);

  const { data: unreadData, refetch: refetchUnread } = useGetNotificationUnreadCountQuery(undefined, {
    skip: !isAuthenticated,
    pollingInterval: isAuthenticated ? 25000 : 0,
  });

  const { data: inboxResp, isFetching, refetch: refetchInbox } = useGetNotificationInboxQuery(
    { limit: 10 },
    {
      skip: !isAuthenticated || !open,
    }
  );

  const [markRead] = useMarkNotificationReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  const unread =
    unreadData?.data?.unread_count ??
    inboxResp?.data?.unread_count ??
    0;
  const items = inboxResp?.data?.items ?? [];

  const badgeText = useMemo(() => {
    if (!unread || unread <= 0) return '';
    if (unread > 99) return '99+';
    return String(unread);
  }, [unread]);

  const onOpen = useCallback(() => {
    if (!isAuthenticated) return;
    setOpen(true);
    refetchUnread();
  }, [isAuthenticated, refetchUnread]);

  // Refetch inbox after the panel is open (subscription active). Avoids refetch in onOpen before skip flips.
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    refetchInbox();
  }, [open, isAuthenticated, refetchInbox]);

  const close = useCallback(() => setOpen(false), []);

  const handleMarkAll = useCallback(async () => {
    try {
      await markRead({ mark_all: true }).unwrap();
      refetchUnread();
      refetchInbox();
    } catch (e) {
      console.warn('mark all read', e);
    }
  }, [markRead, refetchUnread, refetchInbox]);

  const navigateFromPayload = useCallback((payload, row) => {
    const type = payload?.type;
    const category = row?.category;
    // Accept → Itinerary (scheduled meeting); request / decline → Meeting Requests inbox
    if (type === 'meeting_approved' || category === 'meeting_accepted') {
      router.push('/(drawer)/itinerary');
      return;
    }
    if (
      type === 'itinerary_meeting_deleted' ||
      type === 'itinerary_meeting_updated' ||
      category === 'itinerary_deleted' ||
      category === 'itinerary_updated'
    ) {
      router.push('/(drawer)/itinerary');
      return;
    }
    if (
      type === 'meeting_request' ||
      type === 'meeting_rejected' ||
      category === 'meeting_request' ||
      category === 'meeting_declined'
    ) {
      router.push('/(drawer)/meeting-requests');
      return;
    }
    if (type === 'chat_message') {
      const fromId = payload.from_id ?? payload.to_id;
      const fromType = payload.from_type || 'delegate';
      if (fromId != null) {
        router.push({
          pathname: '/(drawer)/message-detail',
          params: {
            thread: JSON.stringify({
              id: fromId,
              user_id: fromId,
              user_type: fromType,
              name: 'Chat',
            }),
            returnTo: 'messages',
          },
        });
      } else {
        router.push('/(drawer)/messages');
      }
    }
  }, []);

  const onPressItem = useCallback(
    async (row) => {
      try {
        if (row?.id && !row.is_read) {
          await markRead({ id: row.id }).unwrap();
        }
        refetchUnread();
        refetchInbox();
        close();
        if (row?.payload && typeof row.payload === 'object') {
          navigateFromPayload(row.payload, row);
        } else if (row?.category) {
          navigateFromPayload({}, row);
        }
      } catch (e) {
        console.warn('notification item', e);
      }
    },
    [markRead, refetchUnread, refetchInbox, close, navigateFromPayload]
  );

  const onDismissItem = useCallback(
    async (row) => {
      if (!row?.id) return;
      try {
        await deleteNotification({ id: row.id }).unwrap();
        refetchUnread();
        refetchInbox();
      } catch (e) {
        console.warn('dismiss notification', e);
      }
    },
    [deleteNotification, refetchUnread, refetchInbox]
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.bellWrap}
        onPress={onOpen}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <Icon name="bell" size={iconSize} color={colors.white} />
        {badgeText ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.modalBackdrop} onPress={close}>
          <Pressable
            style={[styles.panel, { marginTop: Math.max(insets.top, 8) + 52 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              {unread > 0 ? (
                <TouchableOpacity onPress={handleMarkAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.markAll}>Mark all read</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {isFetching && items.length === 0 ? (
              <View style={styles.loader}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : items.length === 0 ? (
              <Text style={styles.empty}>No notifications yet</Text>
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {items.map((row) => (
                  <View
                    key={String(row.id)}
                    style={[styles.rowWrap, row.is_read ? styles.rowRead : styles.rowUnread]}
                  >
                    <TouchableOpacity
                      style={styles.rowMain}
                      activeOpacity={0.85}
                      onPress={() => onPressItem(row)}
                    >
                      <View style={styles.rowTop}>
                        <Text style={styles.rowTitle} numberOfLines={2}>
                          {row.title}
                        </Text>
                        {!row.is_read ? <View style={styles.dot} /> : null}
                      </View>
                      {row.body ? (
                        <Text style={styles.rowBody} numberOfLines={3}>
                          {row.body}
                        </Text>
                      ) : null}
                      <Text style={styles.rowTime}>{formatTime(row.created_at)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rowDismiss}
                      onPress={() => onDismissItem(row)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel="Remove notification"
                    >
                      <Icon name="x" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellWrap: {
    position: 'relative',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
  },
  panel: {
    alignSelf: 'flex-end',
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  markAll: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  list: {
    maxHeight: 420,
  },
  loader: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  empty: {
    padding: 20,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  rowDismiss: {
    padding: 8,
    marginTop: 2,
  },
  rowUnread: {
    backgroundColor: 'rgba(138, 52, 144, 0.06)',
  },
  rowRead: {
    backgroundColor: colors.white,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  rowBody: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  rowTime: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textMuted,
  },
});

export default HeaderNotificationBell;
