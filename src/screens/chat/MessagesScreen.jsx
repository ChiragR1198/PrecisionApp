import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
  
  // Fetch messages based on user type - no cache, always fresh data
  const { data: delegateMessagesData, isLoading: delegateLoading, error: delegateError } = useGetDelegateMessagesQuery(undefined, {
    skip: !isDelegate,
    refetchOnMountOrArgChange: true,
    // Disable cache - always fetch fresh data
    keepUnusedDataFor: 0,
  });
  
  const { data: sponsorMessagesData, isLoading: sponsorLoading, error: sponsorError } = useGetSponsorMessagesQuery(undefined, {
    skip: !isSponsor,
    refetchOnMountOrArgChange: true,
    // Disable cache - always fetch fresh data
    keepUnusedDataFor: 0,
  });
  
  const isLoading = isDelegate ? delegateLoading : sponsorLoading;
  const error = isDelegate ? delegateError : sponsorError;
  const messagesData = isDelegate ? delegateMessagesData : sponsorMessagesData;

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

  // Map API messages to chat thread format
  const chatThreads = useMemo(() => {
    // Only use API data - no static fallback
    if (!messagesData) return [];
    
    const list = Array.isArray(messagesData?.data) ? messagesData.data : [];
    return list.map((item) => {
      const userId = String(item.user_id || item.id || '');
      const name = item.user_name || item.name || 'Unknown';
      const avatar = item.user_image || item.image || null;
      const unreadCount = item.unread_count || item.unreadCount || 0;
      const lastMessage = item.last_message || item.message || '';
      const lastMessageDate = item.last_message_date || item.last_message_date || item.date || '';
      const time = formatMessageTime(lastMessageDate);
      
      return {
        id: userId,
        user_id: item.user_id || item.id, // Keep original user_id for API calls
        user_type: item.user_type || 'delegate', // Keep user_type for determining to_type
        name,
        message: lastMessage,
        time,
        unreadCount,
        avatar,
        status: 'Online', // Default status
        messages: [], // Will be loaded in detail screen
      };
    });
  }, [messagesData]);

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
    <SafeAreaView style={styles.container} edges={['top']}>
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
});

export default MessagesScreen;

