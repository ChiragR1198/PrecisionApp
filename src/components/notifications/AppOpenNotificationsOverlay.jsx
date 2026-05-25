import Icon from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../../constants/theme';
import { useAppOpenNotificationItems } from '../../hooks/useAppOpenNotificationItems';
import { useAppSelector } from '../../store/hooks';

const ICON_BY_TYPE = {
  meeting_requests: 'calendar',
  new_attendees: 'users',
  messages: 'message-circle',
};

function routeForItem(type) {
  switch (type) {
    case 'meeting_requests':
      return '/(drawer)/meeting-requests';
    case 'new_attendees':
      return '/(drawer)/attendees';
    case 'messages':
      return '/(drawer)/messages';
    default:
      return null;
  }
}

/**
 * In-app notification cards when the user opens or returns to the app.
 * Shows pending meetings, new attendees today, and unread messages.
 */
export function AppOpenNotificationsOverlay() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const [dismissed, setDismissed] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const { items, refetch, isFetching } = useAppOpenNotificationItems();

  useEffect(() => {
    if (!isAuthenticated) {
      setDismissed(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (
        isAuthenticated &&
        (prev === 'background' || prev === 'inactive') &&
        nextState === 'active'
      ) {
        setDismissed(false);
        refetch();
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, refetch]);

  const onDismissAll = useCallback(() => setDismissed(true), []);

  const onPressItem = useCallback(
    (row) => {
      const path = routeForItem(row?.type);
      setDismissed(true);
      if (path) {
        router.push(path);
      }
    },
    []
  );

  if (!isAuthenticated || dismissed || items.length === 0) {
    return null;
  }

  return (
    <View
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Updates for you</Text>
        <TouchableOpacity
          onPress={onDismissAll}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss all updates"
        >
          <Icon name="x" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      {items.map((row) => {
        const iconName = ICON_BY_TYPE[row.type] || 'bell';
        return (
          <Pressable
            key={row.type}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => onPressItem(row)}
          >
            <View style={styles.iconCircle}>
              <Icon name={iconName} size={18} color={colors.primary} />
            </View>
            <Text style={styles.cardText} numberOfLines={2}>
              {row.message}
            </Text>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        );
      })}
      {isFetching && items.length > 0 ? (
        <Text style={styles.refreshHint}>Refreshing…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardPressed: {
    backgroundColor: 'rgba(138, 52, 144, 0.06)',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(138, 52, 144, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  refreshHint: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 4,
  },
});

export default AppOpenNotificationsOverlay;
