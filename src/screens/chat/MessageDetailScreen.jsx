import Icon from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
const parseBackendDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;

  const raw = String(dateInput).trim();
  if (!raw) return null;

  // Backend commonly returns "YYYY-MM-DD HH:mm:ss" without timezone.
  // Treat it as UTC to avoid local-time drift (e.g. 5h/5h30 offset).
  const mysqlLike = raw.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/);
  if (mysqlLike) {
    const isoUtc = raw.replace(' ', 'T') + (raw.length === 16 ? ':00Z' : 'Z');
    const parsedUtc = new Date(isoUtc);
    if (!Number.isNaN(parsedUtc.getTime())) return parsedUtc;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
};

const formatMessageTime = (dateString) => {
  if (!dateString) return '';
  try {
    const date = parseBackendDate(dateString);
    if (!date) return '';
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

/** Ensures each row belongs to the DM between the logged-in user and the open peer (blocks stale RTK/cache). */
function chatRowMatchesOpenThread(msg, meIdRaw, meTypeRaw, peerIdRaw, peerTypeRaw) {
  const fid = Number(msg?.from_id);
  const tid = Number(msg?.to_id);
  const m = Number(meIdRaw);
  const p = Number(peerIdRaw);
  if (![fid, tid, m, p].every((x) => Number.isFinite(x))) return false;

  const idOk = (fid === m && tid === p) || (fid === p && tid === m);
  if (!idOk) return false;

  const ft = String(msg?.from_type ?? '').toLowerCase();
  const tt = String(msg?.to_type ?? '').toLowerCase();
  const mt = String(meTypeRaw ?? '').toLowerCase();
  const pt = String(peerTypeRaw ?? '').toLowerCase();

  if (!ft && !tt) return true;

  const forward = fid === m && tid === p && ft === mt && tt === pt;
  const backward = fid === p && tid === m && ft === pt && tt === mt;
  return forward || backward;
}

const formatSeenTimeAgo = (dateString) => {
  if (!dateString) return 'Seen';
  const parsed = parseBackendDate(dateString);
  if (!parsed) return 'Seen';
  const ts = parsed.getTime();
  if (Number.isNaN(ts)) return 'Seen';

  const diffMs = Date.now() - ts;
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));

  if (diffMins < 1) return 'Seen just now';
  if (diffMins < 60) return `Seen ${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Seen ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Seen ${diffDays}d ago`;
};

const QUICK_MESSAGE_TEMPLATES = [
  'Hi, How are you?',
  "It's a pleasure to connect",
  'What time are you arriving at the summit?',
  'Do you want to schedule a small meeting?',
  'Tell me about your company?',
  'I look forward to meeting you at the summit!',
  'Do you have any questions?',
];

/** Backend allows up to 8 MB (see Mobile_Model::saveChatAttachmentFile) */
const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function resolveChatRecipient(thread) {
  if (!thread) return null;
  const toIdValue = thread.user_id || thread.id;
  const toId = Number(toIdValue);
  if (!toId || Number.isNaN(toId)) return null;
  const rawType =
    thread.user_type ||
    thread.userType ||
    (thread.delegate_id != null && thread.sponsor_id == null ? 'delegate' : null) ||
    (thread.sponsor_id != null && thread.delegate_id == null ? 'sponsor' : null);
  const finalToType = rawType != null && rawType !== '' ? String(rawType).trim().toLowerCase() : '';
  if (!finalToType || (finalToType !== 'delegate' && finalToType !== 'sponsor')) return null;
  return { toId, finalToType };
}

export const MessageDetailScreen = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [, setSeenTicker] = useState(0);
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
  const [isUploading, setIsUploading] = useState(false);
  /** In-app lightbox for chat images `{ uri, name? }` */
  const [imagePreview, setImagePreview] = useState(null);
  const [isSavingImage, setIsSavingImage] = useState(false);

  // Debug: Log params when they change
  useEffect(() => {
    console.log('📋 MessageDetailScreen params changed:', {
      allParams: params,
      returnTo: params?.returnTo,
      hasThread: !!params?.thread,
    });
  }, [params]);

  // Parse thread from params (expo-router may pass string or string[])
  const thread = useMemo(() => {
    const raw = params?.thread;
    const json = Array.isArray(raw) ? raw[0] : raw;
    if (!json || typeof json !== 'string') return null;
    try {
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }, [params?.thread]);

  const getThreadTarget = useCallback(() => {
    if (!thread) return { targetId: null, targetType: null, profileName: 'Unknown', profileImage: null };

    const safe = (v) => (v === undefined || v === null ? '' : String(v).trim());
    const lower = (v) => safe(v).toLowerCase();

    const meId = safe(currentUserId);
    const meType = lower(loginType);

    const threadUserId = safe(thread.user_id || thread.userId || thread.id);
    const threadUserType = lower(thread.user_type || thread.userType);

    const fromId = safe(thread.from_id || thread.fromId);
    const toId = safe(thread.to_id || thread.toId);
    const fromType = lower(thread.from_type || thread.fromType);
    const toType = lower(thread.to_type || thread.toType);

    let targetId = threadUserId;
    let targetType = threadUserType;

    // If thread mistakenly points to the current user, try to derive the other side.
    if (meId && targetId && targetId === meId) {
      if (fromId && toId) {
        if (fromId === meId) {
          targetId = toId;
          targetType = toType || targetType;
        } else if (toId === meId) {
          targetId = fromId;
          targetType = fromType || targetType;
        }
      }
    }

    // If still missing type but we know our type and target isn't us, assume opposite only when safe.
    if (!targetType && targetId && meId && targetId !== meId) {
      // In this app chats can be sponsor<->sponsor too, so don't force opposite.
      targetType = threadUserType || null;
    }

    // Fallback name/image
    const profileName = thread.name || thread.user_name || thread.userName || 'Unknown';
    const profileImage = thread.avatar || thread.user_image || thread.userImage || null;

    return { targetId: targetId || null, targetType: targetType || null, profileName, profileImage };
  }, [thread, currentUserId, loginType]);

  // Get to_id from thread for fetching messages (numeric — must match API / DB)
  const toId = useMemo(() => {
    if (!thread) return null;
    const v = thread.user_id ?? thread.id;
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, [thread?.user_id, thread?.id]);

  // Other participant type (required by API — delegate/sponsor ids can overlap)
  const chatPeerType = useMemo(() => {
    const t = String(thread?.user_type || thread?.userType || '').toLowerCase();
    return t === 'delegate' || t === 'sponsor' ? t : null;
  }, [thread?.user_type, thread?.userType]);

  const chatMessagesArg = useMemo(
    () => (toId && chatPeerType ? { toId, toType: chatPeerType } : null),
    [toId, chatPeerType]
  );

  // Must include user_type: delegate/sponsor ids can match across tables (sponsor 977 ≠ delegate 977).
  const stableThreadKey = useMemo(() => {
    if (!toId || !chatPeerType) return null;
    return `${String(toId)}:${chatPeerType}`;
  }, [toId, chatPeerType]);

  // Fetch messages with specific user based on login type
  const shouldSkipDelegateMessages = !toId || !isDelegate || !chatPeerType;
  const shouldSkipSponsorMessages = !toId || !isSponsor || !chatPeerType;

  const {
    data: delegateMessagesData,
    isLoading: isLoadingDelegateMessages,
    error: delegateMessagesError,
    refetch: refetchDelegateMessages,
  } = useGetDelegateChatMessagesQuery(chatMessagesArg, {
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
  } = useGetSponsorChatMessagesQuery(chatMessagesArg, {
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

  // Opening the chat loads messages; API marks incoming as read. Refetch list so badges match DB.
  const hasOpenedChat = useRef(false);
  const currentOpenKey = useRef(null);

  useEffect(() => {
    if (isFocused && toId && thread && chatPeerType) {
      const openKey = `${String(toId)}:${chatPeerType}`;
      if (!hasOpenedChat.current || currentOpenKey.current !== openKey) {
        hasOpenedChat.current = true;
        currentOpenKey.current = openKey;
        if (refetchMessages) {
          refetchMessages();
        }
        const t = setTimeout(() => {
          dispatch(api.util.invalidateTags(['Messages']));
        }, 500);
        return () => clearTimeout(t);
      }
    } else {
      hasOpenedChat.current = false;
      currentOpenKey.current = null;
    }
    return undefined;
  }, [isFocused, toId, chatPeerType, thread, refetchMessages, dispatch]);

  /** True if this WS payload is for the open DM (both participants + types). */
  const websocketMatchesOpenThread = useCallback(
    (data) => {
      if (!toId || !chatPeerType || !currentUserId || !loginType) return false;
      const meId = String(currentUserId).trim();
      const meType = String(loginType).toLowerCase();
      const peerId = String(toId).trim();
      const peerType = String(chatPeerType).toLowerCase();

      const fid = String(data?.from_id ?? data?.fromId ?? '').trim();
      const tid = String(data?.to_id ?? data?.toId ?? '').trim();
      const ftype = String(data?.from_type ?? data?.fromType ?? '').toLowerCase();
      const ttype = String(data?.to_type ?? data?.toType ?? '').toLowerCase();

      const involvesPeer =
        (fid === peerId && (!ftype || ftype === peerType)) ||
        (tid === peerId && (!ttype || ttype === peerType));
      const involvesMe =
        (fid === meId && (!ftype || ftype === meType)) ||
        (tid === meId && (!ttype || ttype === meType));

      return involvesPeer && involvesMe;
    },
    [toId, chatPeerType, currentUserId, loginType]
  );

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
      if (websocketMatchesOpenThread(data) && refetchMessages) {
        refetchMessages();
      }
    });

    // Listen for message updates
    const unsubscribeMessageUpdate = websocketManager.on('message_update', (data) => {
      console.log('💬 Message update via WebSocket:', data);
      if (websocketMatchesOpenThread(data) && refetchMessages) {
        refetchMessages();
      }
    });

    // Cleanup
    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageUpdate();
    };
  }, [isFocused, toId, chatPeerType, user, refetchMessages, websocketMatchesOpenThread]);

  // Initialize messages from API data
  useEffect(() => {
    if (!thread) {
      initializedRef.current = false;
      threadIdRef.current = null;
      lastProcessedMessagesRef.current = null;
      setMessages([]);
      return;
    }

    if (!stableThreadKey) {
      initializedRef.current = false;
      lastProcessedMessagesRef.current = null;
      setMessages([]);
      return;
    }

    // Composite key so sponsor #N and delegate #N are different threads
    if (threadIdRef.current !== stableThreadKey) {
      initializedRef.current = false;
      lastProcessedMessagesRef.current = null;
      threadIdRef.current = stableThreadKey;
      setMessages([]);
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

    // Reject payloads that belong to another DM (stale RTK result after navigation)
    if (
      messagesArray.length > 0 &&
      currentUserId &&
      toId != null &&
      chatPeerType &&
      loginType
    ) {
      const allMatch = messagesArray.every((msg) =>
        chatRowMatchesOpenThread(msg, currentUserId, loginType, toId, chatPeerType)
      );
      if (!allMatch) {
        console.warn('MessageDetailScreen: ignoring chat payload — not for this thread', {
          openThread: `${toId}:${chatPeerType}`,
          me: `${currentUserId}:${loginType}`,
          sampleRow: messagesArray[0],
        });
        return;
      }
    }

    // Always process messages when API data is available
    if (messagesData && !isLoadingMessages) {
      const dataLength = messagesArray.length;
      
      // Create a more accurate key using last message ID and timestamp to detect new messages
      const lastMessage = dataLength > 0 ? messagesArray[dataLength - 1] : null;
      const lastMessageId = lastMessage ? String(lastMessage.id || '') : '';
      const lastMessageTime = lastMessage ? (lastMessage.date || lastMessage.created_at || lastMessage.timestamp || '') : '';
      const dataKey = `${stableThreadKey}-${dataLength}-${lastMessageId}-${lastMessageTime}`;
      
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
            
            const mt = String(msg.message_type || msg.messageType || 'text').toLowerCase();
            let messageType = mt === 'image' || mt === 'file' ? mt : 'text';
            const attachmentUrl = msg.attachment_url || msg.attachmentUrl || null;
            if (attachmentUrl && messageType === 'text') {
              if (/\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(attachmentUrl)) messageType = 'image';
              else if (/\.pdf(\?|#|$)/i.test(attachmentUrl)) messageType = 'file';
            }
            return {
              id: String(msg.id || msg.message_id || `msg-${index}-${Date.now()}`),
              sender: sender,
              text: msg.message || msg.text || msg.content || '',
              messageType,
              attachmentUrl,
              attachmentName: msg.attachment_name || msg.attachmentName || null,
              time: formatMessageTime(msg.date || msg.created_at || msg.timestamp || msg.time),
              isRead: String(msg.is_read ?? msg.isRead ?? 0) === '1',
              readAt:
                msg.read_at ||
                msg.readAt ||
                msg.seen_at ||
                msg.updated_at ||
                null,
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
            id: `last-${stableThreadKey}`,
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
  }, [toId, chatPeerType, stableThreadKey, thread, isLoadingMessages, currentUserId, loginType, messagesData, user]);

  const uploadChatAttachment = useCallback(
    async ({ uri, name, mimeType }) => {
      const recipient = resolveChatRecipient(thread);
      if (!recipient) {
        Alert.alert('Error', 'Unable to determine recipient.');
        return;
      }
      const caption = inputValue.trim();
      const form = new FormData();
      form.append('to_id', String(recipient.toId));
      form.append('to_type', recipient.finalToType);
      if (caption) form.append('message', caption);
      form.append('attachment', {
        uri,
        name: name || 'attachment.jpg',
        type: mimeType || 'application/octet-stream',
      });

      setIsUploading(true);
      try {
        const result = isDelegate
          ? await sendDelegateMessage(form).unwrap()
          : await sendSponsorMessage(form).unwrap();

        if (result?.success && result?.data) {
          const d = result.data;
          const sentMessage = {
            id: String(d.id || Date.now()),
            sender: 'me',
            text: d.message || caption || '',
            messageType: d.message_type || (d.attachment_url ? 'image' : 'text'),
            attachmentUrl: d.attachment_url || null,
            attachmentName: d.attachment_name || null,
            time: formatMessageTime(d.date || new Date().toISOString()),
            isRead: String(d?.is_read ?? 0) === '1',
            readAt: null,
          };
          setMessages((prev) => [...prev, sentMessage]);
          setInputValue('');
          setTimeout(() => refetchMessages?.(), 500);
        } else {
          Alert.alert('Error', result?.message || 'Upload failed');
        }
      } catch (error) {
        if (error?.status === 'PARSING_ERROR') {
          setInputValue('');
          setTimeout(() => refetchMessages?.(), 500);
          return;
        }
        const errMsg = error?.data?.message || error?.message || 'Upload failed';
        Alert.alert('Error', errMsg);
      } finally {
        setIsUploading(false);
      }
    },
    [thread, currentUserId, loginType, inputValue, isDelegate, sendDelegateMessage, sendSponsorMessage, refetchMessages]
  );

  const pickImageFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    if (asset.fileSize && asset.fileSize > MAX_CHAT_ATTACHMENT_BYTES) {
      Alert.alert('File too large', 'Maximum size is 8 MB.');
      return;
    }
    const ext = asset.mimeType?.includes('png') ? 'png' : asset.mimeType?.includes('webp') ? 'webp' : 'jpg';
    await uploadChatAttachment({
      uri: asset.uri,
      name: `photo.${ext}`,
      mimeType: asset.mimeType || 'image/jpeg',
    });
  }, [uploadChatAttachment]);

  const pickImageFromCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    await uploadChatAttachment({
      uri: asset.uri,
      name: 'photo.jpg',
      mimeType: asset.mimeType || 'image/jpeg',
    });
  }, [uploadChatAttachment]);

  const pickPdf = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    const uri = asset?.uri ?? result.uri;
    if (!uri) return;
    const size = asset?.size ?? result.size;
    if (size && size > MAX_CHAT_ATTACHMENT_BYTES) {
      Alert.alert('File too large', 'Maximum size is 8 MB.');
      return;
    }
    await uploadChatAttachment({
      uri,
      name: asset?.name || result.name || 'document.pdf',
      mimeType: asset?.mimeType || 'application/pdf',
    });
  }, [uploadChatAttachment]);

  const handleAttachPress = useCallback(() => {
    Alert.alert('Attach', 'Send a photo or PDF (max 8 MB)', [
      { text: 'Photo library', onPress: () => pickImageFromLibrary() },
      { text: 'Camera', onPress: () => pickImageFromCamera() },
      { text: 'PDF', onPress: () => pickPdf() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImageFromLibrary, pickImageFromCamera, pickPdf]);

  const closeImagePreview = useCallback(() => setImagePreview(null), []);

  const openChatImagePreview = useCallback((uri, name) => {
    if (uri) setImagePreview({ uri, name: name || null });
  }, []);

  const handleDownloadPreviewImage = useCallback(async () => {
    if (!imagePreview?.uri) return;
    setIsSavingImage(true);
    try {
      const rawName =
        imagePreview.name ||
        imagePreview.uri.split('/').pop()?.split('?')[0] ||
        `chat_${Date.now()}.jpg`;
      const safe = String(rawName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'image.jpg';
      const dest = `${FileSystem.cacheDirectory}dl_${Date.now()}_${safe}`;

      const token = await AsyncStorage.getItem('auth_token');
      const cleanToken = token ? token.trim().replace(/^["']|["']$/g, '') : '';
      const authHeaders = cleanToken ? { Authorization: `Bearer ${cleanToken}` } : {};

      const writeFetchToFile = async () => {
        const res = await fetch(imagePreview.uri, { headers: authHeaders });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const ab = await res.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        const b64 = btoa(binary);
        await FileSystem.writeAsStringAsync(dest, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return dest;
      };

      let localUri = dest;
      try {
        const dl = await FileSystem.downloadAsync(imagePreview.uri, dest, { headers: authHeaders });
        if (dl.status < 200 || dl.status >= 300) {
          throw new Error(`Download HTTP ${dl.status}`);
        }
        localUri = dl.uri;
      } catch (firstErr) {
        console.warn('downloadAsync failed, trying fetch', firstErr);
        localUri = await writeFetchToFile();
      }

      const ext = safe.split('.').pop()?.toLowerCase() || 'jpg';
      const mime =
        ext === 'png'
          ? 'image/png'
          : ext === 'gif'
            ? 'image/gif'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/jpeg';
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: mime,
          dialogTitle: 'Save or share image',
        });
      } else {
        Alert.alert('Downloaded', 'Image saved to app cache.');
      }
    } catch (e) {
      console.warn('Download image failed', e);
      Alert.alert('Error', 'Could not download image. Check your connection and try again.');
    } finally {
      setIsSavingImage(false);
    }
  }, [imagePreview]);

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

    const recipient = resolveChatRecipient(thread);
    if (!recipient) {
      Alert.alert('Error', 'Unable to determine recipient type. Please go back and try again.');
      console.error('Missing or invalid user_type in thread:', thread);
      return;
    }

    const { toId, finalToType } = recipient;

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
          messageType: 'text',
          attachmentUrl: null,
          attachmentName: null,
          time: formatMessageTime(result.data.date || new Date().toISOString()),
          isRead: String(result?.data?.is_read ?? 0) === '1',
          readAt:
            result?.data?.read_at ||
            result?.data?.readAt ||
            result?.data?.seen_at ||
            null,
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
          messageType: 'text',
          attachmentUrl: null,
          attachmentName: null,
          time: formatMessageTime(new Date().toISOString()),
          isRead: false,
          readAt: null,
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
  const filteredQuickTemplates = useMemo(() => {
    const keyword = inputValue.trim().toLowerCase();
    if (!keyword) return [];
    return QUICK_MESSAGE_TEMPLATES.filter((template) => template.toLowerCase().includes(keyword));
  }, [inputValue]);
  const lastSeenOutgoingMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg?.sender === 'me' && msg?.isRead) {
        return msg.id;
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeenTicker((prev) => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Android: `softwareKeyboardLayoutMode: "resize"` (app.json) shrinks the window — do not add extra keyboard padding (that caused a gap above the keyboard). Only scroll the thread when the keyboard opens.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return () => sub.remove();
  }, []);

  const renderMessage = ({ item }) => {
    const isMe = item.sender === 'me';
    const preview = String(item.text || '').substring(0, 20);
    console.log(`💬 Rendering message: sender="${item.sender}", isMe=${isMe}, text="${preview}"`);

    const openPdfExternal = () => {
      if (item.attachmentUrl) Linking.openURL(item.attachmentUrl);
    };

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
            {item.messageType === 'image' && item.attachmentUrl ? (
              <TouchableOpacity
                onPress={() => openChatImagePreview(item.attachmentUrl, item.attachmentName)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: item.attachmentUrl }}
                  style={styles.bubbleImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : null}
            {item.messageType === 'file' && item.attachmentUrl ? (
              <TouchableOpacity onPress={openPdfExternal} activeOpacity={0.85}>
                <Text style={[styles.bubbleFileLabel, isMe && styles.bubbleFileLabelMe]}>
                  📎 {item.attachmentName || 'PDF'}
                </Text>
                <Text style={[styles.bubbleFileHint, isMe && styles.bubbleFileHintMe]}>Tap to open</Text>
              </TouchableOpacity>
            ) : null}
            {(item.text || '').trim().length > 0 ? (
              <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
            ) : null}
          </View>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{item.time}</Text>
          {isMe && item.id === lastSeenOutgoingMessageId && item.isRead ? (
            <Text style={styles.seenText}>{formatSeenTimeAgo(item.readAt)}</Text>
          ) : null}
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
        if (router.canGoBack()) {
          try {
            console.log('🔙 Fallback: trying router.back()');
            router.back();
          } catch (backError) {
            console.error('❌ Router.back() also failed:', backError);
          }
        } else {
          try {
            router.push('/(drawer)/messages');
          } catch (e2) {
            console.error('❌ Fallback navigation failed:', e2);
          }
        }
      }
    }
    
    // If no returnTo param, go back only when history exists (avoids GO_BACK unhandled warning)
    if (router.canGoBack()) {
      try {
        console.log('🔙 Trying router.back()');
        router.back();
      } catch (error) {
        console.warn('⚠️ router.back() failed, navigating to messages screen');
        try {
          router.push('/(drawer)/messages');
        } catch (navError) {
          console.error('❌ Navigation failed:', navError);
        }
      }
    } else {
      try {
        console.log('🔙 No back stack — navigating to messages screen');
        router.push('/(drawer)/messages');
      } catch (navError) {
        console.error('❌ Navigation failed:', navError);
      }
    }
  }, [navigation, params?.returnTo, params?.returnSponsor, params?.returnDelegate]);

  const handleOpenProfile = useCallback(() => {
    const { targetId, targetType, profileName, profileImage } = getThreadTarget();
    if (!targetId) {
      Alert.alert('Error', 'Invalid profile information');
      return;
    }
    const currentReturnTo = Array.isArray(params?.returnTo) ? params.returnTo[0] : params?.returnTo;

    const userType = String(targetType || '').toLowerCase();
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
    if (Platform.OS !== 'android') return undefined;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (imagePreview) {
        setImagePreview(null);
        return true;
      }
      handleBack();
      return true;
    });

    return () => backHandler.remove();
  }, [handleBack, imagePreview]);

  // Top safe area is handled inside `Header` (paddingTop: insets.top + gradient). Do NOT use 'top' here or you get a white strip above the header.
  const safeAreaEdges = ['bottom'];

  if (!thread) {
    return (
      <SafeAreaView style={styles.container} edges={safeAreaEdges}>
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
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={0}
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

        {filteredQuickTemplates.length > 0 && (
          <View style={styles.quickTemplatesContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickTemplatesScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {filteredQuickTemplates.map((template) => (
                <TouchableOpacity
                  key={template}
                  activeOpacity={0.8}
                  style={styles.quickTemplateChip}
                  onPress={() => setInputValue(template)}
                >
                  <Text style={styles.quickTemplateChipText}>{template}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View
          style={[
            styles.inputBar,
            {
              paddingHorizontal: SIZES.paddingHorizontal,
              paddingBottom: 10,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.attachButton, (isSending || isUploading) && styles.attachButtonDisabled]}
            onPress={handleAttachPress}
            disabled={isSending || isUploading}
          >
            <Text style={styles.attachText}>＋</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
            value={inputValue}
            onChangeText={setInputValue}
            editable={!isSending && !isUploading}
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.sendButton, (isSending || isUploading || !inputValue.trim()) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={isSending || isUploading || !inputValue.trim()}
          >
            {isSending || isUploading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={!!imagePreview}
        transparent
        animationType="fade"
        onRequestClose={closeImagePreview}
      >
        <View style={[styles.imagePreviewRoot, { paddingTop: insets.top }]}>
          <View style={styles.imagePreviewToolbar}>
            <Pressable
              onPress={closeImagePreview}
              hitSlop={12}
              style={styles.imagePreviewToolbarBtn}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
            >
              <Icon name="x" size={26} color={colors.white} />
            </Pressable>
            <Pressable
              onPress={handleDownloadPreviewImage}
              disabled={isSavingImage}
              style={[styles.imagePreviewToolbarBtn, styles.imagePreviewDownloadRow]}
              accessibilityRole="button"
              accessibilityLabel="Download or share image"
            >
              {isSavingImage ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Icon name="download" size={22} color={colors.white} />
                  <Text style={styles.imagePreviewDownloadLabel}>Download</Text>
                </>
              )}
            </Pressable>
          </View>
          {imagePreview ? (
            <View style={styles.imagePreviewBody}>
              <Image
                source={{ uri: imagePreview.uri }}
                style={{
                  width: SCREEN_WIDTH - 24,
                  height: Math.min(SCREEN_HEIGHT * 0.78, SCREEN_WIDTH * 1.2),
                }}
                resizeMode="contain"
              />
            </View>
          ) : null}
        </View>
      </Modal>
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
    quickTemplatesContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.white,
      paddingTop: 8,
      paddingBottom: 4,
    },
    quickTemplatesScrollContent: {
      paddingHorizontal: SIZES.paddingHorizontal,
      gap: 8,
    },
    quickTemplateChip: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.gray100,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    quickTemplateChipText: {
      color: colors.text,
      fontSize: 13,
      maxWidth: 260,
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
    bubbleImage: {
      width: 220,
      height: 180,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.gray200,
    },
    bubbleFileLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    bubbleFileLabelMe: {
      color: colors.white,
    },
    bubbleFileHint: {
      fontSize: 12,
      color: colors.textMuted,
    },
    bubbleFileHintMe: {
      color: 'rgba(255,255,255,0.85)',
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
    seenText: {
      marginTop: 2,
      fontSize: 11,
      color: colors.textMuted,
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
    attachButtonDisabled: {
      opacity: 0.45,
    },
    imagePreviewRoot: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.94)',
    },
    imagePreviewToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    imagePreviewToolbarBtn: {
      padding: 8,
      borderRadius: 8,
    },
    imagePreviewDownloadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    imagePreviewDownloadLabel: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    imagePreviewBody: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 24,
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

