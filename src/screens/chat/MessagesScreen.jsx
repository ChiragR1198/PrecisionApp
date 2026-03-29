import { useIsFocused, useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { SearchBar } from '../../components/common/SearchBar';
import { colors } from '../../constants/theme';
import { useGetDelegateMessagesQuery, useGetSponsorMessagesQuery } from '../../store/api';
import { useAppSelector } from '../../store/hooks';
import { requestNotificationPermissions, setupNotificationListener, showMessageNotification } from '../../utils/notifications';
import { websocketManager } from '../../utils/websocket';

// Format date string to relative time (e.g., "2:30 PM", "Yesterday", "Monday")
const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    // Today - show time
    if (diffDays === 0) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      return `${displayHours}:${displayMinutes} ${ampm}`;
    }
    
    // Yesterday
    if (diffDays === 1) {
      return 'Yesterday';
    }
    
    // This week - show day name
    if (diffDays < 7) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[date.getDay()];
    }
    
    // Older - show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
};

export const MessagesScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const isSponsor = loginType === 'sponsor';
  const currentUserId = user?.id ? String(user.id) : String(user?.user_id || user?.delegate_id || user?.sponsor_id || '');
  
  // Fetch messages based on user type - WebSocket is used for real-time updates, so no polling needed
  const { 
    data: delegateMessagesData, 
    isLoading: delegateLoading, 
    error: delegateError,
    refetch: refetchDelegateMessages,
  } = useGetDelegateMessagesQuery(undefined, {
    skip: !isDelegate,
    refetchOnMountOrArgChange: true,
    // Disable cache - always fetch fresh data
    keepUnusedDataFor: 0,
    // No polling - WebSocket handles real-time updates
    pollingInterval: 0,
  });
  
  const { 
    data: sponsorMessagesData, 
    isLoading: sponsorLoading, 
    error: sponsorError,
    refetch: refetchSponsorMessages,
  } = useGetSponsorMessagesQuery(undefined, {
    skip: !isSponsor,
    refetchOnMountOrArgChange: true,
    // Disable cache - always fetch fresh data
    keepUnusedDataFor: 0,
    // No polling - WebSocket handles real-time updates
    pollingInterval: 0,
  });
  
  const isLoading = isDelegate ? delegateLoading : sponsorLoading;
  const error = isDelegate ? delegateError : sponsorError;
  const messagesData = isDelegate ? delegateMessagesData : sponsorMessagesData;
  const refetchMessages = isDelegate ? refetchDelegateMessages : refetchSponsorMessages;
  const isFocused = useIsFocused();
  const previousMessagesRef = useRef([]);

  // Request notification permissions on mount
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Track previous messages count for notifications
  useEffect(() => {
    if (messagesData && Array.isArray(messagesData?.data)) {
      const currentMessages = messagesData.data;
      const previousMessages = previousMessagesRef.current;
      
      // Check for new messages (compare by message count or last message ID)
      if (previousMessages.length > 0 && currentMessages.length > 0) {
        currentMessages.forEach((currentThread) => {
          const previousThread = previousMessages.find(
            (p) => String(p.user_id || p.id) === String(currentThread.user_id || currentThread.id)
          );
          
          // If thread has new unread messages and we're not on that screen
          if (previousThread && currentThread.unread_count > previousThread.unread_count) {
            const senderName = currentThread.user_name || currentThread.name || 'Someone';
            const messageText = currentThread.last_message || currentThread.message || 'New message';
            
            // Show notification for new message
            showMessageNotification(
              senderName,
              messageText,
              {
                user_id: currentThread.user_id || currentThread.id,
                user_type: currentThread.user_type || 'delegate',
              }
            );
          }
        });
      }
      
      previousMessagesRef.current = currentMessages;
    }
  }, [messagesData]);

  // Setup notification listener
  useEffect(() => {
    const cleanup = setupNotificationListener((notification) => {
      // When notification is tapped, navigate to messages
      console.log('📬 Notification received:', notification);
      // You can add navigation logic here if needed
    });
    
    return cleanup;
  }, []);

  // Setup WebSocket for real-time message updates
  const hasInitialRefetch = useRef(false);
  
  useEffect(() => {
    if (!isFocused || !user) return;

    const userId = String(user.id || user.user_id || user.delegate_id || user.sponsor_id);
    const userType = (user.login_type || user.user_type || '').toLowerCase();

    if (!userId || !userType) {
      console.warn('⚠️ Missing userId or userType for WebSocket connection');
      return;
    }

    // Connect WebSocket when screen is focused
    websocketManager.connect(userId, userType);

    // Initial refetch only once when screen is first focused
    if (!hasInitialRefetch.current && refetchMessages) {
      hasInitialRefetch.current = true;
      refetchMessages();
    }

    // Listen for new messages via WebSocket
    const unsubscribeNewMessage = websocketManager.on('new_message', (data) => {
      console.log('💬 New message received via WebSocket:', data);
      // Refetch only when new message arrives via WebSocket
      if (refetchMessages) {
        refetchMessages();
      }
    });

    // Listen for message list updates
    const unsubscribeMessageUpdate = websocketManager.on('message_update', (data) => {
      console.log('💬 Message list update via WebSocket:', data);
      if (refetchMessages) {
        refetchMessages();
      }
    });

    // Cleanup on unmount or when screen loses focus
    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageUpdate();
      // Reset initial refetch flag when screen loses focus
      hasInitialRefetch.current = false;
      // Don't disconnect WebSocket here - keep it connected for other screens
    };
  }, [isFocused, user, refetchMessages]);

  const { SIZES, isTablet } = useMemo(() => {
    const isAndroid = Platform.OS === 'android';
    const isIOS = Platform.OS === 'ios';
    const isTabletDevice = SCREEN_WIDTH >= 768;

    const getResponsiveValue = ({ android, ios, tablet, default: defaultValue }) => {
      if (isTabletDevice && tablet !== undefined) return tablet;
      if (isAndroid && android !== undefined) return android;
      if (isIOS && ios !== undefined) return ios;
      return defaultValue;
    };

    return {
      SIZES: {
        headerIconSize: getResponsiveValue({ android: 22, ios: 23, tablet: 25, default: 22 }),
        contentMaxWidth: getResponsiveValue({ android: '100%', ios: '100%', tablet: 600, default: '100%' }),
        paddingHorizontal: getResponsiveValue({ android: 16, ios: 18, tablet: 20, default: 16 }),
        avatarSize: getResponsiveValue({ android: 54, ios: 56, tablet: 60, default: 54 }),
        title: getResponsiveValue({ android: 17, ios: 18, tablet: 19, default: 17 }),
        body: getResponsiveValue({ android: 13.5, ios: 14, tablet: 15, default: 13.5 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const pickOtherParticipant = useCallback(
    (item) => {
      const safe = (v) => (v === undefined || v === null ? '' : String(v).trim());
      const lower = (v) => safe(v).toLowerCase();

      const meId = safe(currentUserId);
      const meType = lower(loginType);

      const fromId = safe(item?.from_id || item?.fromId || item?.sender_id || item?.senderId);
      const toId = safe(item?.to_id || item?.toId || item?.receiver_id || item?.receiverId);
      const fromType = lower(item?.from_type || item?.fromType || item?.sender_type || item?.senderType);
      const toType = lower(item?.to_type || item?.toType || item?.receiver_type || item?.receiverType);

      const matchesMe = (id, type) => !!meId && !!id && id === meId && (!type || !meType || type === meType);

      // Prefer explicit from/to fields when available.
      if (fromId && toId) {
        if (matchesMe(fromId, fromType)) {
          return { user_id: toId, user_type: toType || item?.user_type || '' };
        }
        if (matchesMe(toId, toType)) {
          return { user_id: fromId, user_type: fromType || item?.user_type || '' };
        }
        // If neither side matches (API may omit type), fallback to "other = user_id".
      }

      const apiUserId = safe(item?.user_id || item?.id || item?.delegate_id || item?.sponsor_id);
      const apiUserType = lower(item?.user_type || (item?.delegate_id ? 'delegate' : item?.sponsor_id ? 'sponsor' : ''));

      // If API mistakenly returns current user as user_id, try using the opposite id.
      if (apiUserId && meId && apiUserId === meId) {
        const candidateOtherId = fromId && fromId !== meId ? fromId : toId && toId !== meId ? toId : '';
        const candidateOtherType =
          (candidateOtherId === fromId ? fromType : candidateOtherId === toId ? toType : '') || apiUserType;
        if (candidateOtherId) return { user_id: candidateOtherId, user_type: candidateOtherType };
      }

      return { user_id: apiUserId, user_type: apiUserType };
    },
    [currentUserId, loginType]
  );

  // Map API messages to chat thread format
  const chatThreads = useMemo(() => {
    // Only use API data - no static fallback
    if (!messagesData) {
      console.log('📭 MessagesScreen: No messagesData available');
      return [];
    }
    
    // Log API response for debugging
    console.log('📭 MessagesScreen: API Response:', JSON.stringify(messagesData, null, 2));
    
    // Handle different response formats
    let list = [];
    if (Array.isArray(messagesData?.data)) {
      list = messagesData.data;
    } else if (Array.isArray(messagesData)) {
      list = messagesData;
    } else if (messagesData?.data && typeof messagesData.data === 'object') {
      // If data is an object, try to extract array from it
      const dataObj = messagesData.data;
      if (Array.isArray(dataObj.messages)) {
        list = dataObj.messages;
      } else if (Array.isArray(dataObj.data)) {
        list = dataObj.data;
      }
    }
    
    console.log('📭 MessagesScreen: Processed list length:', list.length);
    
    return list.map((item, index) => {
      const other = pickOtherParticipant(item);
      const userId = String(other.user_id || `unknown-${index}`);
      const userType = (other.user_type || '').toLowerCase() || (item?.delegate_id ? 'delegate' : item?.sponsor_id ? 'sponsor' : 'delegate');

      // Prefer explicit "other user" naming fields if present.
      const name =
        item.user_name ||
        item.name ||
        item.full_name ||
        item.delegate_name ||
        item.sponsor_name ||
        item.to_name ||
        item.from_name ||
        'Unknown';
      const avatar = item.user_image || item.image || item.avatar || item.to_image || item.from_image || null;
      // Same source as drawer total: server unread_count (user_chat_messages.is_read for incoming)
      const unreadCount = Number(item.unread_count ?? item.unreadCount) || 0;
      
      const lastMessage = item.last_message || item.message || item.lastMessage || '';
      const lastMessageDate = item.last_message_date || item.last_message_date || item.date || item.created_at || '';
      const time = formatMessageTime(lastMessageDate);
      
      return {
        id: userId,
        user_id: userId, // Other user's id for API calls
        user_type: userType, // Other user's type for determining to_type
        name,
        message: lastMessage,
        time,
        unreadCount,
        avatar,
        status: 'Online', // Default status
        messages: [], // Will be loaded in detail screen
      };
    });
  }, [messagesData, pickOtherParticipant]);

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chatThreads;
    return chatThreads.filter(
      (chat) =>
        chat.name.toLowerCase().includes(q) ||
        (chat.message || '').toLowerCase().includes(q)
    );
  }, [searchQuery, chatThreads]);

  const renderRow = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.85}
      onPress={() =>
        router.push({
          pathname: '/message-detail',
          params: {
            thread: JSON.stringify(item),
            returnTo: 'messages', // Track where we came from
          },
        })
      }
    >
      <View style={[styles.avatarWrap, { width: SIZES.avatarSize, height: SIZES.avatarSize, borderRadius: SIZES.avatarSize / 2 }]}>
        {item.badgeIcon ? (
          <View style={styles.iconAvatar}>
            <Text style={styles.iconAvatarText}>{"</>"}</Text>
          </View>
        ) : item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
        ) : (
          <View style={styles.iconAvatar}>
            <Text style={styles.iconAvatarText}>
              {item.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowName}>{item.name}</Text>
          <Text style={styles.rowTime}>{item.time}</Text>
        </View>
        <View style={styles.rowMessageWrap}>
          <Text style={styles.rowMessage} numberOfLines={1}>
            {item.message || 'No messages yet'}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Messages"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
      />

      <View style={styles.content}>
        <SearchBar
          placeholder="Search messages"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {error?.data?.message || error?.message || 'Failed to load messages'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetchMessages()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredChats.length > 0 ? (
          <FlatList
            data={filteredChats}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRow}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start a conversation to see messages here</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const createStyles = (SIZES) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: 12,
  },
  searchBar: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  avatarWrap: {
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  iconAvatar: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(82, 165, 255, 0.18)',
  },
  iconAvatarText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  rowContent: {
    flex: 1,
    borderBottomWidth: 0,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowName: {
    fontSize: SIZES.title,
    fontWeight: '700',
    color: colors.text,
  },
  rowTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rowMessageWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMessage: {
    flex: 1,
    fontSize: SIZES.body,
    color: colors.textMuted,
  },
  unreadBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MessagesScreen;

