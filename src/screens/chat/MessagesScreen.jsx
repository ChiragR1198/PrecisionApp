import { router } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
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

const CHAT_THREADS = [
  {
    id: '1',
    name: 'Sarah Johnson',
    message: "Hey! How's the project going?",
    time: '2:30 PM',
    unreadCount: 3,
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&w=200&h=200',
    messages: [
      { id: 'sj-1', sender: 'them', text: 'Hey! Are we still on for lunch tomorrow?', time: '2:30 PM' },
      { id: 'sj-2', sender: 'me', text: 'Yes! Looking forward to it. How about 12:30 at the usual place?', time: '2:32 PM' },
      { id: 'sj-3', sender: 'them', text: 'Perfect! See you there 😊', time: '2:35 PM' },
      { id: 'sj-4', sender: 'me', text: "Great! I'll make a reservation just in case", time: '2:36 PM' },
    ],
  },
  {
    id: '2',
    name: 'Mike Chen',
    message: 'Thanks for the feedback!',
    time: '1:15 PM',
    unreadCount: 0,
    avatar: 'https://images.unsplash.com/photo-1502767089025-6572583495b0?auto=format&fit=facearea&w=200&h=200',
  },
  {
    id: '3',
    name: 'Emma Wilson',
    message: "Perfect! Let's schedule a meeting",
    time: '11:30 AM',
    unreadCount: 0,
    avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=200&h=200',
  },
  {
    id: '4',
    name: 'Alex Rodriguez',
    message: 'Sounds good to me!',
    time: 'Yesterday',
    unreadCount: 0,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&w=200&h=200',
  },
  {
    id: '5',
    name: 'Development Team',
    message: 'Code review completed ✓',
    time: 'Yesterday',
    unreadCount: 0,
    avatar: null,
    badgeIcon: true,
  },
  {
    id: '6',
    name: 'Lisa Park',
    message: 'Great work on the presentation!',
    time: 'Monday',
    unreadCount: 0,
    avatar: 'https://images.unsplash.com/photo-1542596768-5d1d21f1cf98?auto=format&fit=facearea&w=200&h=200',
  },
];

export const MessagesScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return CHAT_THREADS;
    return CHAT_THREADS.filter(
      (chat) =>
        chat.name.toLowerCase().includes(q) ||
        chat.message.toLowerCase().includes(q)
    );
  }, [searchQuery]);

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
        ) : (
          <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
        )}
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowName}>{item.name}</Text>
          <Text style={styles.rowTime}>{item.time}</Text>
        </View>
        <View style={styles.rowMessageWrap}>
          <Text style={styles.rowMessage} numberOfLines={1}>
            {item.message}
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

        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
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
});

export default MessagesScreen;

