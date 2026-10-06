import Icon from '@expo/vector-icons/Feather';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/theme';
import { useNotificationPanel } from '../../contexts/NotificationPanelContext';
import { useAppSelector } from '../../store/hooks';

export function HeaderNotificationBell({ iconSize = 22 }) {
  const { isAuthenticated } = useAppSelector((s) => s.auth);
  const { open, badgeText } = useNotificationPanel();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.bellWrap}
      onPress={open}
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
});

export default HeaderNotificationBell;
