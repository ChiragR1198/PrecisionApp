import Icon from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useGetProfileQuery, useLogoutMutation } from '../store/api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearAuth } from '../store/slices/authSlice';

const NAV_ITEMS = [
  { label: 'Dashboard', route: 'dashboard', icon: 'bar-chart-2' },
  { label: 'My Event', route: 'my-event', icon: 'calendar' },
  { label: 'Agenda', route: 'agenda', icon: 'list' },
  { label: 'Attendees', route: 'attendees', icon: 'users' },
  { label: 'Sponsors', route: 'sponsors', icon: 'briefcase' },
  { label: 'Meeting Requests', route: 'meeting-requests', icon: 'calendar' },
  { label: 'Messages', route: 'messages', icon: 'message-circle' },
  { label: 'Itinerary', route: 'itinerary', icon: 'map-pin' },
  { label: 'Contacts', route: 'contacts', icon: 'book' },
  { label: 'Profile', route: 'profile', icon: 'user' },
  { label: 'Change Password', route: 'change-password', icon: 'key' },
  { label: 'Logout', icon: 'log-out', action: 'logout' },
];

const getIcon = (name, size, color) => {
  switch (name) {
    case 'meeting-requests':
      return <MaterialIcons name="meeting-room" size={size} color={color} />;
    case 'messages':
      return <MaterialCommunityIcons name="chat-outline" size={size} color={color} />;
    default:
      return <Icon name={name} size={size} color={color} />;
  }
};

export const CustomDrawerContent = (props) => {
  const { state, navigation } = props;
  const dispatch = useAppDispatch();
  const [logoutMutation] = useLogoutMutation();
  const { user } = useAppSelector((state) => state.auth);
  const { selectedEventId, selectedEventIndex } = useAppSelector((state) => state.event);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';

  // Fetch profile data
  const { data: profileData } = useGetProfileQuery();
  const profile = useMemo(() => {
    return profileData?.data || profileData || null;
  }, [profileData]);

  const activeRouteName = state.routeNames[state.index];

  const sizes = useMemo(() => {
    const isTablet = Platform.OS === 'ios' || Platform.OS === 'android'
      ? state?.type === 'drawer' && Platform.isPad
      : false;

    const getValue = ({ tablet, default: defaultValue }) => {
      if (isTablet && tablet !== undefined) return tablet;
      return defaultValue;
    };

    return {
      icon: getValue({ tablet: 20, default: 18 }),
      text: getValue({ tablet: 16, default: 15 }),
      headerHeight: getValue({ tablet: 130, default: 100 }),
      avatar: getValue({ tablet: 64, default: 56 }),
    };
  }, [state]);

  const navItems = useMemo(() => {
    if (!isDelegate) return NAV_ITEMS;
    return NAV_ITEMS.map((item) =>
      item.route === 'sponsors'
        ? { ...item, label: 'Delegate' }
        : item
    );
  }, [isDelegate]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left']}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { minHeight: sizes.headerHeight }]}
      >
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { width: sizes.avatar, height: sizes.avatar, borderRadius: sizes.avatar / 2 }]}>
            {profile?.image ? (
              <Image
                source={{ uri: profile.image }}
                style={[styles.avatarImage, { width: sizes.avatar, height: sizes.avatar, borderRadius: sizes.avatar / 2 }]}
                resizeMode="cover"
              />
            ) : (
              <Icon name="user" size={sizes.icon + 10} color="#FFFFFF" />
            )}
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.full_name || `${profile?.fname || ''} ${profile?.lname || ''}`.trim() || 'User'}
            </Text>
            <Text style={styles.profileRole} numberOfLines={1}>
              {profile?.job_title || 'Delegate'}
            </Text>
          </View>
        </View>
      </LinearGradient>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {navItems.map((item) => {
          const isActive = item.route ? activeRouteName === item.route : false;
          const isLogout = item.action === 'logout';
          const handlePress = async () => {
            if (isLogout) {
              Alert.alert(
                'Logout',
                'Are you sure you want to logout?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await logoutMutation().unwrap();
                        dispatch(clearAuth());
                        router.replace('/login');
                      } catch (error) {
                        console.error('Logout error:', error);
                        // Even if API call fails, clear auth and navigate to login
                        dispatch(clearAuth());
                        router.replace('/login');
                      }
                    },
                  },
                ],
                { cancelable: true }
              );
              return;
            }
            if (item.route) {
              // Pass eventId and selectedEventIndex as params if available
              const params = {};
              if (selectedEventId) {
                params.eventId = String(selectedEventId);
              }
              if (selectedEventIndex !== undefined && selectedEventIndex !== null) {
                params.selectedEventIndex = String(selectedEventIndex);
              }
              // Use router.push for Expo Router compatibility
              if (Object.keys(params).length > 0) {
                router.push({ pathname: `/${item.route}`, params });
              } else {
                router.push(`/${item.route}`);
              }
              // Close drawer after navigation
              navigation.closeDrawer();
            }
          };
          return (
            <TouchableOpacity
              key={item.route || item.label}
              style={[
                styles.item,
                isActive && styles.itemActive,
                isLogout && styles.logoutItem,
              ]}
              activeOpacity={0.85}
              onPress={handlePress}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                {getIcon(
                  item.icon,
                  sizes.icon,
                  isLogout ? '#EF4444' : isActive ? colors.white : colors.primary
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  { fontSize: sizes.text },
                  isActive && styles.labelActive,
                  isLogout && styles.logoutLabel,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 25,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  profileRole: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  scrollContent: {
    paddingTop: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  itemActive: {
    backgroundColor: 'rgba(138, 52, 144, 0.08)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(138,52,144,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconWrapActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  labelActive: {
    color: colors.primaryDark,
  },
  logoutItem: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutLabel: {
    color: '#EF4444',
    fontWeight: '700',
  },
});

export default CustomDrawerContent;

