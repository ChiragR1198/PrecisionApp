import Icon from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DrawerContentScrollView, useDrawerStatus } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import {
  useDelegateLogoutMutation,
  useGetDelegateMessagesQuery,
  useGetDelegateProfileQuery,
  useGetSponsorMessagesQuery,
  useGetSponsorProfileQuery,
  useSponsorLogoutMutation,
} from '../store/api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearAuth } from '../store/slices/authSlice';

/** Same response shapes as MessagesScreen — sum server `unread_count` (user_chat_messages.is_read = 0, incoming). */
function getThreadsListFromMessagesResponse(messagesData) {
  if (!messagesData) return [];
  if (Array.isArray(messagesData?.data)) return messagesData.data;
  if (Array.isArray(messagesData)) return messagesData;
  if (messagesData?.data && typeof messagesData.data === 'object') {
    const dataObj = messagesData.data;
    if (Array.isArray(dataObj.messages)) return dataObj.messages;
    if (Array.isArray(dataObj.data)) return dataObj.data;
  }
  return [];
}

function sumServerUnreadCount(messagesData) {
  const list = getThreadsListFromMessagesResponse(messagesData);
  return list.reduce(
    (sum, item) => sum + (Number(item.unread_count ?? item.unreadCount) || 0),
    0
  );
}

// Engagement-first order: Dashboard, Agenda, Attendees, Meeting Requests, Messages, then rest
const NAV_ITEMS = [
  { label: 'Dashboard', route: 'dashboard', icon: 'bar-chart-2' },
  { label: 'Agenda', route: 'agenda', icon: 'list' },
  { label: 'Event Sponsors', route: 'attendees', icon: 'users' },
  { label: 'Meeting Requests', route: 'meeting-requests', icon: 'calendar' },
  { label: 'Messages', route: 'messages', icon: 'message-circle' },
  { label: 'My Event', route: 'my-event', icon: 'calendar' },
  { label: 'Sponsors', route: 'sponsors', icon: 'briefcase' },
  { label: 'Itinerary', route: 'itinerary', icon: 'map-pin' },
  { label: 'Contacts', route: 'contacts', icon: 'book' },
  { label: 'Profile', route: 'profile', icon: 'user' },
  { label: 'Change Password', route: 'change-password', icon: 'key' },
  { label: 'Contact Us', route: 'contact-us', icon: 'mail' },
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
  const insets = useSafeAreaInsets();
  const drawerStatus = useDrawerStatus();
  const drawerOpenRef = useRef(drawerStatus);
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { selectedEventId, selectedEventIndex } = useAppSelector((state) => state.event);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const [delegateLogout] = useDelegateLogoutMutation();
  const [sponsorLogout] = useSponsorLogoutMutation();
  const logoutMutation = isDelegate ? delegateLogout : sponsorLogout;

  const shouldSkipDelegateMsgs = !isAuthenticated || !user || !isDelegate;
  const shouldSkipSponsorMsgs = !isAuthenticated || !user || isDelegate;

  const { data: delegateMessagesPayload, refetch: refetchDelegateMessages } = useGetDelegateMessagesQuery(
    undefined,
    {
      skip: shouldSkipDelegateMsgs,
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 0,
      pollingInterval: 0,
    }
  );

  const { data: sponsorMessagesPayload, refetch: refetchSponsorMessages } = useGetSponsorMessagesQuery(
    undefined,
    {
      skip: shouldSkipSponsorMsgs,
      refetchOnMountOrArgChange: true,
      keepUnusedDataFor: 0,
      pollingInterval: 0,
    }
  );

  const messagesPayload = isDelegate ? delegateMessagesPayload : sponsorMessagesPayload;
  const refetchMessages = isDelegate ? refetchDelegateMessages : refetchSponsorMessages;

  const totalUnreadMessages = useMemo(
    () => sumServerUnreadCount(messagesPayload),
    [messagesPayload]
  );

  useEffect(() => {
    const wasOpen = drawerOpenRef.current === 'open';
    drawerOpenRef.current = drawerStatus;
    if (drawerStatus === 'open' && !wasOpen && isAuthenticated) {
      refetchMessages();
    }
  }, [drawerStatus, isAuthenticated, refetchMessages]);

  // Fetch profile data - only if user is authenticated and logged in
  // Force fresh data fetch - no cache
  const shouldSkipDelegate = !isAuthenticated || !user || !isDelegate;
  const shouldSkipSponsor = !isAuthenticated || !user || isDelegate;
  const { data: delegateProfileData } = useGetDelegateProfileQuery(undefined, { 
    skip: shouldSkipDelegate,
    refetchOnMountOrArgChange: true, // Force fresh data on mount
  });
  const { data: sponsorProfileData } = useGetSponsorProfileQuery(undefined, { 
    skip: shouldSkipSponsor,
    refetchOnMountOrArgChange: true, // Force fresh data on mount
  });
  const profileData = isDelegate ? delegateProfileData : sponsorProfileData;
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
    return NAV_ITEMS.map((item) => {
      // Dynamic label for attendees route:
      // - Delegate login: "Event Sponsors"
      // - Sponsor login: "Attendees"
      if (item.route === 'attendees') {
        return {
          ...item,
          label: isDelegate ? 'Event Sponsors' : 'Attendees',
        };
      }

      // For delegates, show "Delegates" for the sponsors route
      if (isDelegate && item.route === 'sponsors') {
        return { ...item, label: 'Delegates' };
      }

      return item;
    });
  }, [isDelegate]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left']}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { minHeight: sizes.headerHeight + insets.top, paddingTop: insets.top }]}
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
              {isDelegate 
                ? (profile?.full_name || `${profile?.fname || ''} ${profile?.lname || ''}`.trim() || 'User')
                : (profile?.name || 'User')
              }
            </Text>
            <Text style={styles.profileRole} numberOfLines={1}>
              {profile?.job_title || (isDelegate ? 'Delegate' : 'Sponsor')}
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
              <View style={styles.labelRow}>
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
                {item.route === 'messages' && totalUnreadMessages > 0 && (
                  <View style={styles.messageCountBadge}>
                    <Text style={styles.messageCountBadgeText}>
                      {totalUnreadMessages > 99 ? '99+' : String(totalUnreadMessages)}
                    </Text>
                  </View>
                )}
              </View>
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
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  label: {
    fontWeight: '600',
    color: colors.primary,
    flexShrink: 1,
  },
  messageCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  messageCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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

