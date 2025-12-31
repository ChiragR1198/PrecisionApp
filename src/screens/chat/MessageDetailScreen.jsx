import { useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import {
  useGetDelegateChatMessagesQuery,
  useGetSponsorChatMessagesQuery,
  useSendDelegateMessageMutation,
  useSendSponsorMessageMutation,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

// Format date string to time (e.g., "2:30 PM")
const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch (e) {
    return '';
  }
};

export const MessageDetailScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const insets = useSafeAreaInsets();
  const { user } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const isSponsor = loginType === 'sponsor';
  const currentUserId = user?.id ? String(user.id) : null;
  const initializedRef = useRef(false);
  const threadIdRef = useRef(null);
  const lastProcessedMessagesRef = useRef(null);

  const [sendDelegateMessage, { isLoading: delegateSending }] = useSendDelegateMessageMutation();
  const [sendSponsorMessage, { isLoading: sponsorSending }] = useSendSponsorMessageMutation();
  const isSending = delegateSending || sponsorSending;

  // Parse thread from params
  const thread = useMemo(() => {
    if (params?.thread) {
      try {
        return JSON.parse(params.thread);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [params]);

  // Determine to_type based on thread user_type
  const toType = useMemo(() => {
    if (!thread) return null;
    // Use user_type from API response (should always be present)
    return thread.user_type || null;
  }, [thread?.user_type]);

  // Get to_id from thread for fetching messages
  const toId = useMemo(() => {
    if (!thread) return null;
    return thread.user_id || thread.id || null;
  }, [thread?.user_id, thread?.id]);

  // Fetch messages with specific user based on login type
  const shouldSkipDelegateMessages = !toId || !isDelegate;
  const shouldSkipSponsorMessages = !toId || !isSponsor;
  
  const {
    data: delegateMessagesData,
    isLoading: isLoadingDelegateMessages,
    error: delegateMessagesError,
    refetch: refetchDelegateMessages,
  } = useGetDelegateChatMessagesQuery(toId, {
    skip: shouldSkipDelegateMessages,
    // Disable cache - always fetch fresh data
    keepUnusedDataFor: 0,
    refetchOnMountOrArgChange: true,
  });

  const {
    data: sponsorMessagesData,
    isLoading: isLoadingSponsorMessages,
    error: sponsorMessagesError,
    refetch: refetchSponsorMessages,
  } = useGetSponsorChatMessagesQuery(toId, {
    skip: shouldSkipSponsorMessages,
    // Disable cache - always fetch fresh data
    keepUnusedDataFor: 0,
    refetchOnMountOrArgChange: true,
  });

  const messagesData = isDelegate ? delegateMessagesData : sponsorMessagesData;
  const isLoadingMessages = isDelegate ? isLoadingDelegateMessages : isLoadingSponsorMessages;
  const messagesError = isDelegate ? delegateMessagesError : sponsorMessagesError;
  const refetchMessages = isDelegate ? refetchDelegateMessages : refetchSponsorMessages;

  // Initialize messages from API data
  useEffect(() => {
    if (!thread) {
      initializedRef.current = false;
      threadIdRef.current = null;
      lastProcessedMessagesRef.current = null;
      setMessages([]);
      return;
    }

    // Use user_id (from API) or id (fallback) as thread identifier
    const currentThreadId = thread.user_id || thread.id;
    
    // Check if thread changed - reset state
    if (threadIdRef.current !== currentThreadId) {
      initializedRef.current = false;
      lastProcessedMessagesRef.current = null;
      threadIdRef.current = currentThreadId;
    }
    
    // If API data is available and we haven't processed it yet
    if (messagesData?.success && Array.isArray(messagesData.data)) {
      // Create a stable key using count and first/last message IDs
      const dataLength = messagesData.data.length;
      const firstId = dataLength > 0 ? String(messagesData.data[0].id) : '';
      const lastId = dataLength > 0 ? String(messagesData.data[dataLength - 1].id) : '';
      const dataKey = `${currentThreadId}-${dataLength}-${firstId}-${lastId}`;
      
      // Only process if this is new data
      if (lastProcessedMessagesRef.current !== dataKey) {
        if (dataLength > 0) {
          // Map API messages to local format
          const mappedMessages = messagesData.data.map((msg) => {
            // Determine sender: prioritize is_send field, fallback to from_id comparison
            let sender = 'them'; // default to 'them'
            if (msg.is_send === '1' || msg.is_send === 1) {
              sender = 'me';
            } else if (msg.is_send === '0' || msg.is_send === 0) {
              sender = 'them';
            } else if (currentUserId && msg.from_id) {
              // Fallback: compare from_id with current user id
              sender = String(msg.from_id) === String(currentUserId) ? 'me' : 'them';
            }
            
            return {
              id: String(msg.id),
              sender: sender,
              text: msg.message || '',
              time: formatMessageTime(msg.date),
            };
          });
          
          setMessages(mappedMessages);
          lastProcessedMessagesRef.current = dataKey;
          initializedRef.current = true;
        } else {
          // Empty array
          setMessages([]);
          lastProcessedMessagesRef.current = dataKey;
          initializedRef.current = true;
        }
      }
    } else if (!isLoadingMessages && !initializedRef.current) {
      // No API data yet, use fallback from thread
      if (thread.messages && Array.isArray(thread.messages) && thread.messages.length > 0) {
        setMessages(thread.messages);
        initializedRef.current = true;
      } else {
        // Check for last_message as placeholder
        const lastMessage = thread.message || thread.last_message;
        const lastMessageDate = thread.last_message_date || thread.date;
        
        if (lastMessage && lastMessage.trim()) {
          const initialMessage = {
            id: `last-${currentThreadId}`,
            sender: 'them',
            text: lastMessage,
            time: formatMessageTime(lastMessageDate),
          };
          setMessages([initialMessage]);
        } else {
          setMessages([]);
        }
        initializedRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toId, isLoadingMessages, currentUserId]);

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    const messageText = inputValue.trim();
    
    if (!messageText) {
      return;
    }
    
    if (!thread) {
      Alert.alert('Error', 'No conversation selected');
      return;
    }

    // Get to_id from thread - prioritize user_id (from API), fallback to id
    const toIdValue = thread.user_id || thread.id;
    const toId = Number(toIdValue);
    
    if (!toId || isNaN(toId)) {
      Alert.alert('Error', `Invalid recipient ID: ${toIdValue}`);
      console.error('Invalid toId:', { toIdValue, thread });
      return;
    }

    // Get to_type from thread.user_type (should be set from MessagesScreen API response)
    // This is the type of the recipient (the other person in the conversation)
    const finalToType = thread.user_type;
    
    if (!finalToType) {
      Alert.alert('Error', 'Unable to determine recipient type. Please go back and try again.');
      console.error('Missing user_type in thread:', thread);
      return;
    }
    
    // Validate to_type is either 'delegate' or 'sponsor'
    if (finalToType !== 'delegate' && finalToType !== 'sponsor') {
      Alert.alert('Error', `Invalid recipient type: ${finalToType}`);
      console.error('Invalid to_type:', finalToType);
      return;
    }

    try {
      const requestData = {
        to_id: toId,
        to_type: finalToType,
        message: messageText,
      };

      console.log('Sending message:', {
        from_type: isDelegate ? 'delegate' : 'sponsor',
        to_id: toId,
        to_type: finalToType,
        message: messageText,
      });

      const result = isDelegate
        ? await sendDelegateMessage(requestData).unwrap()
        : await sendSponsorMessage(requestData).unwrap();

      if (result?.success && result?.data) {
        // Add sent message to local state optimistically
        const sentMessage = {
          id: String(result.data.id),
          sender: 'me',
          text: result.data.message,
          time: formatMessageTime(result.data.date),
        };
        setMessages((prev) => [...prev, sentMessage]);
        setInputValue('');
        // Refetch messages to get updated conversation
        refetchMessages();
      } else {
        Alert.alert('Error', result?.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error?.data?.message || error?.message || 'Failed to send message';
      Alert.alert('Error', errorMessage);
    }
  }, [inputValue, thread, isDelegate, sendDelegateMessage, sendSponsorMessage, refetchMessages]);

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

  // Handle back navigation to MessagesScreen
  const handleBack = useCallback(() => {
    // Explicitly navigate to messages screen (like other detail screens do)
    router.push('/messages');
  }, []);

  if (!thread) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header
          leftIcon="arrow-left"
          onLeftPress={handleBack}
          iconSize={SIZES.headerIconSize}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invalid conversation</Text>
        </View>
      </SafeAreaView>
    );
  }

  const threadName = thread.name || thread.user_name || 'Unknown';
  const threadAvatar = thread.avatar || thread.user_image || null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        leftIcon="arrow-left"
        onLeftPress={handleBack}
        iconSize={SIZES.headerIconSize}
        center={
          <View style={[styles.headerCenter, { alignSelf: 'flex-start' }]}>
            {threadAvatar ? (
              <Image source={{ uri: threadAvatar }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                <Text style={styles.headerAvatarText}>
                  {threadName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.headerName}>{threadName}</Text>
              {/* <Text style={styles.headerStatus}>{thread.status || 'Online'}</Text> */}
            </View>
          </View>
        }
        right={
          <TouchableOpacity activeOpacity={0.7}>
            {/* <Text style={styles.headerAction}>⋮</Text> */}
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {isLoadingMessages ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptySubtext}>Loading messages...</Text>
          </View>
        ) : messages.length > 0 ? (
          <FlatList
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={[styles.messagesContent, { paddingHorizontal: SIZES.paddingHorizontal }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation</Text>
          </View>
        )}

        <View style={[styles.inputBar, { paddingHorizontal: SIZES.paddingHorizontal, paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 12 }]}>
        <TouchableOpacity activeOpacity={0.7} style={styles.attachButton}>
          <Text style={styles.attachText}>＋</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          value={inputValue}
          onChangeText={setInputValue}
          editable={!isSending}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.sendButton, (isSending || !inputValue.trim()) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={isSending || !inputValue.trim()}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (SIZES) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoidingView: {
      flex: 1,
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
    headerAvatarPlaceholder: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '700',
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
      lineHeight: 22,
      letterSpacing: 0.4,
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
    sendButtonDisabled: {
      opacity: 0.6,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
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
    },
  });

export default MessageDetailScreen;

