import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
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
    api,
    useGetDelegateChatMessagesQuery,
    useGetSponsorChatMessagesQuery,
    useSendDelegateMessageMutation,
    useSendSponsorMessageMutation,
} from '../../store/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { websocketManager } from '../../utils/websocket';

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
  const flatListRef = useRef(null);
  const previousMessagesLengthRef = useRef(0);

  const [sendDelegateMessage, { isLoading: delegateSending }] = useSendDelegateMessageMutation();
  const [sendSponsorMessage, { isLoading: sponsorSending }] = useSendSponsorMessageMutation();
  const isSending = delegateSending || sponsorSending;

  // Debug: Log params when they change
  useEffect(() => {
    console.log('📋 MessageDetailScreen params changed:', {
      allParams: params,
      returnTo: params?.returnTo,
      hasThread: !!params?.thread,
    });
  }, [params]);

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
    // No polling - WebSocket handles real-time updates
    pollingInterval: 0,
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
    // No polling - WebSocket handles real-time updates
    pollingInterval: 0,
  });

  const messagesData = isDelegate ? delegateMessagesData : sponsorMessagesData;
  const isLoadingMessages = isDelegate ? isLoadingDelegateMessages : isLoadingSponsorMessages;
  const messagesError = isDelegate ? delegateMessagesError : sponsorMessagesError;
  const refetchMessages = isDelegate ? refetchDelegateMessages : refetchSponsorMessages;
  const isFocused = useIsFocused();
  const dispatch = useAppDispatch();

  // Mark chat as read when screen comes into focus
  // This ensures unread count is only cleared when user actually opens the chat
  const hasMarkedAsRead = useRef(false);
  const currentChatKey = useRef(null);
  
  useEffect(() => {
    if (isFocused && toId && thread) {
      // Use same format as MessagesScreen: userId_userType
      const userId = String(toId);
      const userType = thread.user_type || 'delegate';
      const chatKey = `${userId}_${userType}`;
      
      // Mark as read only once per chat open (when chat changes or first time)
      if (!hasMarkedAsRead.current || currentChatKey.current !== chatKey) {
        console.log('💬 Chat detail screen opened - marking chat as read');
        hasMarkedAsRead.current = true;
        currentChatKey.current = chatKey;
        
        // Mark this chat as read in AsyncStorage
        const markChatAsRead = async () => {
          try {
            console.log('💬 Marking chat as read:', {
              toId,
              userId,
              userType,
              threadUserType: thread.user_type,
              chatKey,
            });
            
            const stored = await AsyncStorage.getItem('read_chats');
            const readChats = stored ? JSON.parse(stored) : {};
            readChats[chatKey] = true;
            await AsyncStorage.setItem('read_chats', JSON.stringify(readChats));
            console.log('✅ Chat marked as read:', chatKey);
            console.log('✅ All read chats:', readChats);
          } catch (error) {
            console.error('❌ Error marking chat as read:', error);
          }
        };
        
        markChatAsRead();
        
        // Initial refetch only once when chat is opened
        if (refetchMessages) {
          refetchMessages();
        }
        
        // Invalidate messages list tag to trigger refetch in MessagesScreen (only once)
        setTimeout(() => {
          console.log('💬 Invalidating messages list to update unread count');
          dispatch(api.util.invalidateTags(['Messages']));
        }, 500);
      }
    } else {
      // Reset flag when screen loses focus
      hasMarkedAsRead.current = false;
      currentChatKey.current = null;
    }
  }, [isFocused, toId, thread, refetchMessages, dispatch]);

  // Setup WebSocket for real-time message updates in chat detail
  useEffect(() => {
    if (!isFocused || !toId || !user) return;

    const userId = String(user.id || user.user_id || user.delegate_id || user.sponsor_id);
    const userType = (user.login_type || user.user_type || '').toLowerCase();

    if (!userId || !userType) {
      console.warn('⚠️ Missing userId or userType for WebSocket connection');
      return;
    }

    // Connect WebSocket if not already connected
    websocketManager.connect(userId, userType);

    // Listen for new messages in this chat
    const unsubscribeNewMessage = websocketManager.on('new_message', (data) => {
      console.log('💬 New message in chat via WebSocket:', data);
      // Check if message is for current chat
      const messageToId = String(data.to_id || data.toId || '');
      const messageFromId = String(data.from_id || data.fromId || '');
      const currentToId = String(toId);
      
      if (messageToId === currentToId || messageFromId === currentToId) {
        // Refetch messages for this chat only when WebSocket message arrives
        if (refetchMessages) {
          refetchMessages();
        }
      }
    });

    // Listen for message updates
    const unsubscribeMessageUpdate = websocketManager.on('message_update', (data) => {
      console.log('💬 Message update via WebSocket:', data);
      const messageToId = String(data.to_id || data.toId || '');
      const messageFromId = String(data.from_id || data.fromId || '');
      const currentToId = String(toId);
      
      if (data.message_id || messageToId === currentToId || messageFromId === currentToId) {
        if (refetchMessages) {
          refetchMessages();
        }
      }
    });

    // Cleanup
    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageUpdate();
    };
  }, [isFocused, toId, user, refetchMessages]);

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
    
    // Log API response for debugging
    if (messagesData) {
      console.log('💬 MessageDetailScreen: API Response:', JSON.stringify(messagesData, null, 2));
    }
    
    // Handle different response formats
    let messagesArray = [];
    if (messagesData?.success && Array.isArray(messagesData.data)) {
      messagesArray = messagesData.data;
    } else if (Array.isArray(messagesData?.data)) {
      messagesArray = messagesData.data;
    } else if (Array.isArray(messagesData)) {
      messagesArray = messagesData;
    } else if (messagesData?.data && typeof messagesData.data === 'object') {
      // If data is an object, try to extract array from it
      const dataObj = messagesData.data;
      if (Array.isArray(dataObj.messages)) {
        messagesArray = dataObj.messages;
      } else if (Array.isArray(dataObj.data)) {
        messagesArray = dataObj.data;
      }
    }
    
    // Always process messages when API data is available
    if (messagesData && !isLoadingMessages) {
      const dataLength = messagesArray.length;
      
      // Create a more accurate key using last message ID and timestamp to detect new messages
      const lastMessage = dataLength > 0 ? messagesArray[dataLength - 1] : null;
      const lastMessageId = lastMessage ? String(lastMessage.id || '') : '';
      const lastMessageTime = lastMessage ? (lastMessage.date || lastMessage.created_at || lastMessage.timestamp || '') : '';
      const dataKey = `${currentThreadId}-${dataLength}-${lastMessageId}-${lastMessageTime}`;
      
      // Always update if data changed (new messages detected by different key)
      if (lastProcessedMessagesRef.current !== dataKey || !initializedRef.current) {
        if (dataLength > 0) {
          console.log(`💬 MessageDetailScreen: Processing ${dataLength} messages (Key: ${dataKey})`);
          // Map API messages to local format
          // Log first message to see API structure
          if (messagesArray.length > 0) {
            console.log('💬 ========== API RESPONSE DEBUG ==========');
            console.log('💬 First message from API:', JSON.stringify(messagesArray[0], null, 2));
            console.log('💬 Current User ID:', currentUserId, typeof currentUserId);
            console.log('💬 Current User Object:', JSON.stringify(user, null, 2));
            console.log('💬 Total messages:', messagesArray.length);
            console.log('💬 =========================================');
          }
          
          const mappedMessages = messagesArray.map((msg, index) => {
            // Determine sender: check all possible fields
            let sender = 'them'; // default to 'them'
            let detectionMethod = 'default';
            
            // Method 1: Check is_send field (most common)
            if (msg.is_send !== undefined && msg.is_send !== null) {
              const isSendValue = String(msg.is_send).toLowerCase();
              if (isSendValue === '1' || isSendValue === 'true' || msg.is_send === 1 || msg.is_send === true) {
                sender = 'me';
                detectionMethod = 'is_send=1';
              } else if (isSendValue === '0' || isSendValue === 'false' || msg.is_send === 0 || msg.is_send === false) {
                sender = 'them';
                detectionMethod = 'is_send=0';
              }
            }
            // Method 2: Check from_id vs current user id (try both string and number comparison)
            if (sender === 'them' && currentUserId && (msg.from_id !== undefined && msg.from_id !== null)) {
              const fromIdStr = String(msg.from_id).trim();
              const fromIdNum = Number(msg.from_id);
              const currentUserIdStr = String(currentUserId).trim();
              const currentUserIdNum = Number(currentUserId);
              
              // Try multiple comparison methods
              if (fromIdStr === currentUserIdStr || 
                  fromIdNum === currentUserIdNum || 
                  String(fromIdNum) === String(currentUserIdNum) ||
                  String(fromIdStr) === String(currentUserIdStr)) {
                sender = 'me';
                detectionMethod = 'from_id match';
              } else {
                detectionMethod = `from_id mismatch (${fromIdStr} vs ${currentUserIdStr})`;
              }
            }
            // Method 3: Check from_user_id (alternative field name) - only if still 'them'
            if (sender === 'them' && currentUserId && msg.from_user_id) {
              const fromUserIdStr = String(msg.from_user_id).trim();
              const currentUserIdStr = String(currentUserId).trim();
              if (fromUserIdStr === currentUserIdStr || Number(msg.from_user_id) === Number(currentUserId)) {
                sender = 'me';
                detectionMethod = 'from_user_id match';
              }
            }
            // Method 4: Check user_id vs current user id - only if still 'them'
            if (sender === 'them' && currentUserId && msg.user_id) {
              const userIdStr = String(msg.user_id).trim();
              const currentUserIdStr = String(currentUserId).trim();
              if (userIdStr === currentUserIdStr || Number(msg.user_id) === Number(currentUserId)) {
                sender = 'me';
                detectionMethod = 'user_id match';
              }
            }
            // Method 5: Check to_id (if message was sent to current user, it's from them) - only if still 'them'
            if (sender === 'them' && currentUserId && msg.to_id) {
              const toIdStr = String(msg.to_id).trim();
              const currentUserIdStr = String(currentUserId).trim();
              if (toIdStr === currentUserIdStr || Number(msg.to_id) === Number(currentUserId)) {
                // Message was sent TO current user, so it's FROM them
                sender = 'them';
                detectionMethod = 'to_id match (received)';
              } else {
                // Message was sent to someone else, so it's FROM me
                sender = 'me';
                detectionMethod = 'to_id mismatch (sent)';
              }
            }
            // Method 6: Check sender_id - only if still 'them'
            if (sender === 'them' && currentUserId && msg.sender_id) {
              const senderIdStr = String(msg.sender_id).trim();
              const currentUserIdStr = String(currentUserId).trim();
              if (senderIdStr === currentUserIdStr || Number(msg.sender_id) === Number(currentUserId)) {
                sender = 'me';
                detectionMethod = 'sender_id match';
              }
            }
            
            // Always log for debugging (first 5 messages to see pattern)
            if (index < 5) {
              console.log(`💬 [${index + 1}] Sender: ${sender} | Method: ${detectionMethod}`, {
                is_send: msg.is_send,
                from_id: msg.from_id,
                currentUserId: currentUserId,
                match: msg.from_id && currentUserId ? `${String(msg.from_id)} === ${String(currentUserId)} = ${String(msg.from_id) === String(currentUserId)}` : 'N/A',
                text: (msg.message || msg.text || '').substring(0, 40),
              });
            }
            
            return {
              id: String(msg.id || msg.message_id || `msg-${index}-${Date.now()}`),
              sender: sender,
              text: msg.message || msg.text || msg.content || '',
              time: formatMessageTime(msg.date || msg.created_at || msg.timestamp || msg.time),
            };
          });
          
          console.log(`💬 MessageDetailScreen: Setting ${mappedMessages.length} messages`);
          setMessages(mappedMessages);
          lastProcessedMessagesRef.current = dataKey;
          initializedRef.current = true;
        } else {
          // Empty array - only set if we haven't initialized yet
          if (!initializedRef.current) {
            console.log('💬 MessageDetailScreen: No messages found');
            setMessages([]);
            lastProcessedMessagesRef.current = dataKey;
            initializedRef.current = true;
          }
        }
      } else {
        console.log('💬 MessageDetailScreen: No changes detected (same dataKey)');
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
  }, [toId, isLoadingMessages, currentUserId, messagesData]);

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
        console.log('✅ Message sent successfully:', result.data);
        // Add sent message to local state optimistically
        const sentMessage = {
          id: String(result.data.id || Date.now()),
          sender: 'me',
          text: result.data.message || messageText,
          time: formatMessageTime(result.data.date || new Date().toISOString()),
        };
        setMessages((prev) => [...prev, sentMessage]);
        setInputValue('');
        // Refetch messages immediately to get updated conversation
        setTimeout(() => {
          if (refetchMessages) {
            console.log('🔄 Refetching messages after send...');
            refetchMessages();
          }
        }, 500);
      } else {
        console.error('❌ Failed to send message:', result);
        Alert.alert('Error', result?.message || 'Failed to send message');
      }
    } catch (error) {
      // PARSING_ERROR often means backend saved the message but returned non-JSON (e.g. PHP warning). Treat as success.
      if (error?.status === 'PARSING_ERROR') {
        const sentMessage = {
          id: String(Date.now()),
          sender: 'me',
          text: messageText,
          time: formatMessageTime(new Date().toISOString()),
        };
        setMessages((prev) => [...prev, sentMessage]);
        setInputValue('');
        setTimeout(() => refetchMessages?.(), 500);
        return;
      }
      if (error?.status !== 409) console.error('Error sending message:', error);
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
    console.log(`💬 Rendering message: sender="${item.sender}", isMe=${isMe}, text="${item.text.substring(0, 20)}"`);
    
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
        <View style={styles.messageContainer}>
          <View
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleThem,
              { maxWidth: SIZES.bubbleMaxWidth },
            ]}
          >
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
          </View>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{item.time}</Text>
        </View>
      </View>
    );
  };

  // Handle back navigation (both header back button and hardware back button)
  const handleBack = useCallback(() => {
    console.log('🔙 MessageDetailScreen: handleBack called');
    console.log('🔙 All params:', params);
    console.log('🔙 ReturnTo param:', params?.returnTo);
    console.log('🔙 ReturnTo type:', typeof params?.returnTo);
    console.log('🔙 ReturnTo === "messages":', params?.returnTo === 'messages');
    console.log('🔙 Navigation canGoBack:', navigation.canGoBack());
    
    // Check if we have returnTo parameter (navigated from detail screen or list screen)
    // Handle both string and array formats (expo-router sometimes returns arrays)
    const returnTo = Array.isArray(params?.returnTo) ? params.returnTo[0] : params?.returnTo;
    console.log('🔙 Processed returnTo:', returnTo);
    
    if (returnTo === 'sponsor-details' && params?.returnSponsor) {
      // Navigate back to sponsor details screen with original data
      try {
        console.log('🔙 Navigating back to sponsor-details screen with data');
        router.push({
          pathname: '/sponsor-details',
          params: {
            sponsor: params.returnSponsor, // Pass original sponsor data
          },
        });
        return;
      } catch (error) {
        console.error('❌ Navigation to sponsor-details failed:', error);
      }
    } else if (returnTo === 'delegate-details' && params?.returnDelegate) {
      // Navigate back to delegate details screen with original data
      try {
        console.log('🔙 Navigating back to delegate-details screen with data');
        router.push({
          pathname: '/delegate-details',
          params: {
            delegate: params.returnDelegate, // Pass original delegate data
          },
        });
        return;
      } catch (error) {
        console.error('❌ Navigation to delegate-details failed:', error);
      }
    } else if (returnTo === 'sponsors') {
      // Navigate back to sponsors screen (from list)
      try {
        console.log('🔙 Navigating back to sponsors screen');
        router.push('/(drawer)/sponsors');
        return;
      } catch (error) {
        console.error('❌ Navigation to sponsors failed:', error);
      }
    } else if (returnTo === 'attendees') {
      // Navigate back to attendees screen (from list)
      try {
        console.log('🔙 Navigating back to attendees screen');
        router.push('/(drawer)/attendees');
        return;
      } catch (error) {
        console.error('❌ Navigation to attendees failed:', error);
      }
    } else if (returnTo === 'messages') {
      // Navigate back to messages screen (from list)
      // For expo-router with drawer navigation, explicitly navigate to messages screen
      try {
        console.log('🔙 Navigating back to messages screen');
        router.push('/(drawer)/messages');
        return;
      } catch (error) {
        console.error('❌ Navigation to messages failed:', error);
        // Fallback: try router.back()
        try {
          console.log('🔙 Fallback: trying router.back()');
          router.back();
        } catch (backError) {
          console.error('❌ Router.back() also failed:', backError);
        }
      }
    }
    
    // If no returnTo param, try router.back() first
    try {
      console.log('🔙 Trying router.back()');
      router.back();
    } catch (error) {
      console.warn('⚠️ router.back() failed, navigating to messages screen');
      // Last resort: navigate to messages screen
      try {
        console.log('🔙 Fallback: navigating to messages screen');
        router.push('/(drawer)/messages');
      } catch (navError) {
        console.error('❌ All navigation methods failed:', navError);
      }
    }
  }, [navigation, params?.returnTo, params?.returnSponsor, params?.returnDelegate]);

  const handleOpenProfile = useCallback(() => {
    if (!thread) return;

    const targetId = String(thread.user_id || thread.id || '').trim();
    if (!targetId) {
      Alert.alert('Error', 'Invalid profile information');
      return;
    }

    const profileName = thread.name || thread.user_name || 'Unknown';
    const profileImage = thread.avatar || thread.user_image || null;
    const userType = String(thread.user_type || '').toLowerCase();
    const currentReturnTo = Array.isArray(params?.returnTo) ? params.returnTo[0] : params?.returnTo;

    if (userType === 'sponsor') {
      router.push({
        pathname: '/sponsor-details',
        params: {
          returnTo: 'message-detail',
          returnThread: JSON.stringify(thread),
          returnToFromThread: currentReturnTo || 'messages',
          sponsor: JSON.stringify({
            id: targetId,
            name: profileName,
            image: profileImage,
            tier: 'Sponsor',
          }),
        },
      });
      return;
    }

    router.push({
      pathname: '/delegate-details',
      params: {
        returnTo: 'message-detail',
        returnThread: JSON.stringify(thread),
        returnToFromThread: currentReturnTo || 'messages',
        delegate: JSON.stringify({
          id: targetId,
          name: profileName,
          image: profileImage,
        }),
      },
    });
  }, [thread, params?.returnTo]);

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true; // Prevent default behavior
      });

      return () => backHandler.remove();
    }
  }, [handleBack]);

  if (!thread) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        leftIcon="arrow-left"
        onLeftPress={handleBack}
        iconSize={SIZES.headerIconSize}
        center={
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenProfile}
            style={[styles.headerCenter, { alignSelf: 'flex-start' }]}
          >
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
          </TouchableOpacity>
        }
        right={
          <TouchableOpacity activeOpacity={0.7}>
            {/* <Text style={styles.headerAction}>⋮</Text> */}
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.messagesContainer}>
          {isLoadingMessages ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptySubtext}>Loading messages...</Text>
            </View>
          ) : messages.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onContentSizeChange={() => {
                // Auto-scroll when content size changes (new messages)
                if (flatListRef.current && messages.length > previousMessagesLengthRef.current) {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }
              }}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation</Text>
            </View>
          )}
        </View>

        <View style={[styles.inputBar, { paddingHorizontal: SIZES.paddingHorizontal, paddingBottom: Math.max(insets.bottom - 34, 0) }]}>
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
    messagesContainer: {
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
      paddingBottom: 20, // Add padding to prevent messages from going under input bar
      flexGrow: 1,
    },
    messageRow: {
      marginBottom: 16,
      width: '100%',
      paddingHorizontal: SIZES.paddingHorizontal,
    },
    messageRowThem: {
      alignItems: 'flex-start',
    },
    messageRowMe: {
      alignItems: 'flex-end',
    },
    messageContainer: {
      maxWidth: '80%',
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
      alignSelf: 'flex-start',
    },
    messageTimeMe: {
      alignSelf: 'flex-end',
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

