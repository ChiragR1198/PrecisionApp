import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';

const DEFAULT_THREAD = {
  id: '1',
  name: 'Sarah Johnson',
  status: 'Online',
  avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&w=200&h=200',
  messages: [
    {
      id: 'm1',
      sender: 'them',
      text: 'Hey! Are we still on for lunch tomorrow?',
      time: '2:30 PM',
    },
    {
      id: 'm2',
      sender: 'me',
      text: 'Yes! Looking forward to it. How about 12:30 at the usual place?',
      time: '2:32 PM',
    },
    {
      id: 'm3',
      sender: 'them',
      text: 'Perfect! See you there 😊',
      time: '2:35 PM',
    },
    {
      id: 'm4',
      sender: 'me',
      text: "Great! I'll make a reservation just in case",
      time: '2:36 PM',
    },
  ],
};

export const MessageDetailScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const [inputValue, setInputValue] = useState('');
  const insets = useSafeAreaInsets();

  const thread = useMemo(() => {
    if (params?.thread) {
      try {
        const parsed = JSON.parse(params.thread);
        return {
          ...DEFAULT_THREAD,
          ...parsed,
          messages: parsed.messages || DEFAULT_THREAD.messages,
        };
      } catch (e) {
        return DEFAULT_THREAD;
      }
    }
    return DEFAULT_THREAD;
  }, [params]);

  const { SIZES, isTablet } = useMemo(() => {
    const isTabletDevice = SCREEN_WIDTH >= 768;
    const getValue = ({ tablet, default: defaultValue }) => {
      if (isTabletDevice && tablet !== undefined) return tablet;
      return defaultValue;
    };

    return {
      SIZES: {
        headerIconSize: getValue({ tablet: 25, default: 22 }),
        contentMaxWidth: getValue({ tablet: 600, default: '100%' }),
        paddingHorizontal: getValue({ tablet: 20, default: 16 }),
        bubbleMaxWidth: getValue({ tablet: 420, default: 280 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const renderMessage = ({ item }) => {
    const isMe = item.sender === 'me';
    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        <View
          style={[
            styles.bubble,
            isMe ? styles.bubbleMe : styles.bubbleThem,
            { maxWidth: SIZES.bubbleMaxWidth },
          ]}
        >
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
        </View>
        <Text style={styles.messageTime}>{item.time}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        leftIcon="arrow-left"
        onLeftPress={() => navigation.goBack?.()}
        iconSize={SIZES.headerIconSize}
        center={
          <View style={[styles.headerCenter, { alignSelf: 'flex-start' }]}>
            <Image source={{ uri: thread.avatar }} style={styles.headerAvatar} />
            <View>
              <Text style={styles.headerName}>{thread.name}</Text>
              <Text style={styles.headerStatus}>{thread.status || 'Online'}</Text>
            </View>
          </View>
        }
        right={
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.headerAction}>⋮</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={thread.messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.messagesContent, { paddingHorizontal: SIZES.paddingHorizontal }]}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.inputBar, { paddingHorizontal: SIZES.paddingHorizontal, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity activeOpacity={0.7} style={styles.attachButton}>
          <Text style={styles.attachText}>＋</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          value={inputValue}
          onChangeText={setInputValue}
        />
        <TouchableOpacity activeOpacity={0.8} style={styles.sendButton}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (SIZES) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    headerName: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 15,
    },
    headerStatus: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
    },
    headerAction: {
      color: colors.white,
      fontSize: 22,
      paddingHorizontal: 4,
    },
    messagesContent: {
      paddingVertical: 16,
      flexGrow: 1,
    },
    messageRow: {
      marginBottom: 16,
      alignSelf: 'flex-start',
    },
    messageRowMe: {
      alignSelf: 'flex-end',
      alignItems: 'flex-end',
    },
    bubble: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
    },
    bubbleThem: {
      backgroundColor: colors.gray100,
      borderBottomLeftRadius: 4,
    },
    bubbleMe: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleText: {
      color: colors.text,
      fontSize: 15,
    },
    bubbleTextMe: {
      color: colors.white,
    },
    messageTime: {
      marginTop: 4,
      fontSize: 11,
      color: colors.textMuted,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.white,
      // paddingBottom will be set dynamically based on safe area insets
    },
    attachButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attachText: {
      color: colors.textMuted,
      fontSize: 18,
      marginTop: -4,
    },
    input: {
      flex: 1,
      backgroundColor: colors.gray100,
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      paddingVertical: 10,
      color: colors.text,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendIcon: {
      color: colors.white,
      fontSize: 18,
    },
  });

export default MessageDetailScreen;

