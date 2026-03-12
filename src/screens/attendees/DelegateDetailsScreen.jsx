import Icon from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import {
  useGetDelegateMeetingTimesQuery,
  useGetSponsorMeetingTimesQuery,
  useSendDelegateMeetingRequestMutation,
  useSendSponsorMeetingRequestMutation,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const UserIcon = ({ color = colors.white, size = 18 }) => (
  <Icon name="user" size={size} color={color} />
);

const MailIcon = ({ color = colors.textMuted, size = 18 }) => (
  <Icon name="mail" size={size} color={color} />
);

const PhoneIcon = ({ color = colors.textMuted, size = 18 }) => (
  <Icon name="phone" size={size} color={color} />
);

const LinkedinIcon = ({ color = colors.textMuted, size = 18 }) => (
  <Icon name="linkedin" size={size} color={color} />
);

const MessageCircleIcon = ({ color = colors.white, size = 20 }) => (
  <MaterialCommunityIcons name="chat" size={size} color={color} />
);

const CopyIcon = ({ color = colors.textMuted, size = 16 }) => (
  <Icon name="copy" size={size} color={color} />
);

const ExternalLinkIcon = ({ color = colors.textMuted, size = 16 }) => (
  <Icon name="external-link" size={size} color={color} />
);

const meetingRed = '#DC2626';

export const DelegateDetailsScreen = () => {
  const navigation = useNavigation();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [priority, setPriority] = useState('1st');
  const { user } = useAppSelector((state) => state.auth);
  const { selectedEventDateFrom } = useAppSelector((state) => state.event);
  const [hasRequested, setHasRequested] = useState(false);
  const [requestedPriorityText, setRequestedPriorityText] = useState(null);
  
  // Modal states for meeting request
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isRequestSuccess, setIsRequestSuccess] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [isTimeModalVisible, setIsTimeModalVisible] = useState(false);
  // selected slot shape: { date: 'YYYY-MM-DD', from: 'HH:MM', to: 'HH:MM', fromFull: 'HH:MM:SS' }
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [meetingTimesParams, setMeetingTimesParams] = useState(null);

  // Determine user type
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';

  // Use appropriate mutation based on user type
  const [createDelegateMeetingRequest] = useSendDelegateMeetingRequestMutation();
  const [createSponsorMeetingRequest] = useSendSponsorMeetingRequestMutation();
  const createMeetingRequest = isDelegate ? createDelegateMeetingRequest : createSponsorMeetingRequest;

  const eventId = user?.event_id || user?.events?.[0]?.id || 27;
  const todayDate = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  const meetingDate = useMemo(() => {
    const raw = params?.eventDateFrom || selectedEventDateFrom;
    if (!raw) return todayDate;
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return todayDate;
  }, [params?.eventDateFrom, selectedEventDateFrom, todayDate]);

  const {
    data: delegateMeetingTimesData,
    isLoading: delegateMeetingTimesLoading,
    error: delegateMeetingTimesError,
    refetch: refetchDelegateMeetingTimes,
  } = useGetDelegateMeetingTimesQuery(meetingTimesParams || {}, {
    skip: !user || !isDelegate || !meetingTimesParams,
  });

  const {
    data: sponsorMeetingTimesData,
    isLoading: sponsorMeetingTimesLoading,
    error: sponsorMeetingTimesError,
    refetch: refetchSponsorMeetingTimes,
  } = useGetSponsorMeetingTimesQuery(meetingTimesParams || {}, {
    skip: !user || isDelegate || !meetingTimesParams,
  });

  const meetingTimesData = isDelegate ? delegateMeetingTimesData : sponsorMeetingTimesData;
  const meetingTimesLoading = isDelegate ? delegateMeetingTimesLoading : sponsorMeetingTimesLoading;
  const refetchMeetingTimes = isDelegate ? refetchDelegateMeetingTimes : refetchSponsorMeetingTimes;

  const meetingSlotGroups = useMemo(() => {
    if (!meetingTimesData) return [];

    const formatDateDDMMYYYY = (yyyyMmDd) => {
      if (!yyyyMmDd) return '';
      const [y, m, d] = String(yyyyMmDd).slice(0, 10).split('-');
      if (!y || !m || !d) return String(yyyyMmDd);
      return `${d}-${m}-${y}`;
    };

    const pickTimePart = (value) => {
      if (!value) return '';
      const s = String(value);
      // "YYYY-MM-DD HH:MM:SS" -> "HH:MM:SS"
      if (s.includes(' ')) return s.split(' ')[1] || s;
      return s;
    };

    const toHHMM = (hhmmss) => {
      const s = String(hhmmss || '');
      return s.length >= 5 ? s.slice(0, 5) : s;
    };

    // API shape (from logs): { data: { "YYYY-MM-DD": [ {meeting_from,...} ] }, dates: [...] }
    if (meetingTimesData?.data && typeof meetingTimesData.data === 'object' && !Array.isArray(meetingTimesData.data)) {
      const dates = Array.isArray(meetingTimesData?.dates)
        ? meetingTimesData.dates
        : Object.keys(meetingTimesData.data || {});

      return (dates || []).map((dateKey) => {
        const rawSlots = meetingTimesData.data?.[dateKey] || [];
        const items = (Array.isArray(rawSlots) ? rawSlots : [])
          .map((slot) => {
            const fromFull = pickTimePart(slot?.meeting_from);
            const toFull = pickTimePart(slot?.meeting_to);
            const from = toHHMM(fromFull);
            const to = toHHMM(toFull);
            if (!from || !to) return null;
            return {
              id: slot?.id ?? `${dateKey}-${fromFull}-${toFull}`,
              date: dateKey,
              from,
              to,
              fromFull,
            };
          })
          .filter(Boolean);

        return {
          date: dateKey,
          dateLabel: formatDateDDMMYYYY(dateKey),
          items,
        };
      }).filter((g) => g.items.length > 0);
    }

    // Fallback: older array-based responses
    const arr = Array.isArray(meetingTimesData?.data)
      ? meetingTimesData.data
      : Array.isArray(meetingTimesData)
        ? meetingTimesData
        : Array.isArray(meetingTimesData?.data?.data)
          ? meetingTimesData.data.data
          : [];

    const items = arr
      .map((slot) => {
        if (typeof slot === 'string') {
          const t = slot.slice(0, 5);
          return { id: slot, date: meetingDate, from: t, to: '', fromFull: slot };
        }
        const rawTime = slot?.time || slot?.time_slot || slot?.label || null;
        if (!rawTime) return null;
        const fromFull = pickTimePart(rawTime);
        return { id: rawTime, date: meetingDate, from: toHHMM(fromFull), to: '', fromFull };
      })
      .filter(Boolean);

    return items.length
      ? [{ date: meetingDate, dateLabel: meetingDate, items }]
      : [];
  }, [meetingTimesData, meetingDate]);

  useEffect(() => {
    if (meetingTimesParams) {
      console.log('🕒 Meeting times params (DelegateDetailsScreen):', meetingTimesParams);
      console.log('🕒 Meeting times data (DelegateDetailsScreen):', JSON.stringify(meetingTimesData, null, 2));
      if (delegateMeetingTimesError || sponsorMeetingTimesError) {
        console.log('🕒 Meeting times error (DelegateDetailsScreen):', delegateMeetingTimesError || sponsorMeetingTimesError);
      }
    }
  }, [meetingTimesParams, meetingTimesData, delegateMeetingTimesError, sponsorMeetingTimesError]);

  // Determine which profile type we are showing (default: delegate)
  const profileType = useMemo(() => {
    const rawType = params?.profileType;
    if (!rawType) return 'delegate';
    const t = String(rawType).toLowerCase();
    return t === 'sponsor' ? 'sponsor' : 'delegate';
  }, [params?.profileType]);
  const isSponsorProfile = profileType === 'sponsor';

  // Get delegate data from params (also used for sponsor profiles coming from Attendees list)
  const delegate = useMemo(() => {
    if (!params?.delegate) {
      return {
        id: '',
        name: 'No Data',
        role: '',
        company: '',
        service: '',
        email: '',
        phone: '',
        linkedin: '',
        address: '',
        bio: '',
        image: null,
      };
    }

    const parsedDelegate = JSON.parse(params.delegate);
    return parsedDelegate;
  }, [params]);

  // If this profile already has a meeting request (from AttendeesScreen/API),
  // initialise the requested state and priority so the UI shows it as already sent.
  useEffect(() => {
    if (delegate && typeof delegate.hasRequest !== 'undefined') {
      setHasRequested(Boolean(delegate.hasRequest));

      // Try to initialise priority from incoming data (e.g. '1st', '2nd')
      if (delegate.priorityText && typeof delegate.priorityText === 'string') {
        setPriority(delegate.priorityText);
        setRequestedPriorityText(delegate.priorityText);
      } else if (delegate.priority && typeof delegate.priority === 'number') {
        const mapped =
          delegate.priority === 1 ? '1st' :
          delegate.priority === 2 ? '2nd' :
          '1st';
        setPriority(mapped);
        setRequestedPriorityText(mapped);
      }
    }
  }, [delegate]);

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
        sectionSpacing: getResponsiveValue({ android: 22, ios: 24, tablet: 26, default: 22 }),
        cardSpacing: getResponsiveValue({ android: 12, ios: 14, tablet: 18, default: 12 }),
        title: getResponsiveValue({ android: 18, ios: 19, tablet: 21, default: 18 }),
        body: getResponsiveValue({ android: 14, ios: 15, tablet: 15, default: 14 }),
        profileSize: getResponsiveValue({ android: 100, ios: 100, tablet: 120, default: 100 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  // Modal animation
  useEffect(() => {
    if (isModalVisible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isModalVisible, modalAnim]);

  // Handle back navigation (both header back button and hardware back button)
  const handleBack = useCallback(() => {
    console.log('🔙 DelegateDetailsScreen: handleBack called');

    const rawReturnTo = params?.returnTo;
    const targetPath = rawReturnTo ? `/(drawer)/${rawReturnTo}` : null;

    try {
      if (targetPath) {
        console.log('🔙 Navigating to', targetPath);
        router.push(targetPath);
      } else {
        console.log('🔙 No explicit returnTo, using router.back()');
        router.back();
      }
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      // Fallback: try router.back() one more time
      try {
        console.log('🔙 Fallback: trying router.back()');
        router.back();
      } catch (backError) {
        console.error('❌ Router.back() also failed:', backError);
      }
    }
  }, [params?.returnTo]);

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      console.log('🔙 Setting up Android BackHandler (DelegateDetailsScreen)');
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        console.log('🔙 Hardware back button pressed (DelegateDetailsScreen)');
        handleBack();
        return true; // Prevent default behavior (exit app)
      });

      return () => {
        console.log('🔙 Removing BackHandler (DelegateDetailsScreen)');
        backHandler.remove();
      };
    }
  }, [handleBack]);

  const closeModal = () => {
    setIsModalVisible(false);
    setIsSendingRequest(false);
    setIsRequestSuccess(false);
    setSelectedTimeSlot(null);
  };

  const openMeetingModal = () => {
    if (hasRequested) return;
    setIsModalVisible(true);
    setIsSendingRequest(false);
    setIsRequestSuccess(false);
    setSelectedTimeSlot(null);
  };

  const openTimeModal = () => {
    if (!delegate || !delegate.id) return;

    const effectiveEventId = Number(eventId || 27);
    const date = meetingDate;

    setMeetingTimesParams({
      event_id: effectiveEventId,
      date,
    });
    setIsTimeModalVisible(true);
    setSelectedTimeSlot(null);
  };

  const closeTimeModal = () => {
    setIsTimeModalVisible(false);
  };

  const handleSendMeetingRequest = async (slot) => {
    try {
      // Validate attendee ID
      if (!delegate.id || delegate.id === '') {
        Alert.alert('Error', `Invalid ${isDelegate ? 'sponsor' : 'delegate'} ID`);
        return;
      }

      setIsSendingRequest(true);

      // Map priority text to number: 1st=1, 2nd=2
      const priorityMap = { '1st': 1, '2nd': 2 };
      const priorityValue = priorityMap[priority] || 1;

      const now = new Date();
      const date = slot?.date || meetingDate || todayDate;
      const time =
        slot?.fromFull ||
        (slot?.from ? `${slot.from}:00` : null) ||
        now.toTimeString().split(' ')[0]; // Fallback: HH:MM:SS

      // Use different parameter names based on user type
      const payload = isDelegate
        ? {
            sponsor_id: Number(delegate.id),
            event_id: Number(eventId || 27),
            priority: priorityValue,
            date: date,
            time: time,
            message: '',
          }
        : {
            delegate_id: Number(delegate.id),
            event_id: Number(eventId || 27),
            priority: priorityValue,
            date: date,
            time: time,
            message: '',
          };

      await createMeetingRequest(payload).unwrap();

      setIsTimeModalVisible(false);
      setHasRequested(true);
      setRequestedPriorityText(priority);
      setIsRequestSuccess(true);
      setSelectedTimeSlot(null);
    } catch (e) {
      console.error('Error sending meeting request:', e);
      Alert.alert('Error', e?.data?.message || e?.message || 'Failed to send meeting request');
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleStartChat = () => {
    if (!delegate || !delegate.id) {
      Alert.alert('Error', 'Invalid delegate information');
      return;
    }

    // Construct thread object for MessageDetailScreen
    const thread = {
      id: delegate.id,
      user_id: delegate.id,
      name: delegate.name || delegate.full_name || 'Unknown',
      user_name: delegate.name || delegate.full_name || 'Unknown',
      avatar: delegate.image || null,
      user_image: delegate.image || null,
      user_type: isDelegate ? 'sponsor' : 'delegate', // If current user is delegate, chatting with sponsor, and vice versa
      // Optional: include last message if available
      last_message: null,
      last_message_date: null,
    };

    router.push({
      pathname: '/message-detail',
      params: {
        thread: JSON.stringify(thread),
        returnTo: 'delegate-details', // Track where we came from
        returnDelegate: JSON.stringify(delegate), // Pass delegate data to navigate back
      },
    });
  };

  const handleCopyEmail = () => {
    Linking.openURL(`mailto:${delegate.email}`).catch(() => {
      Alert.alert('Error', 'Could not open email client');
    });
  };

  const handleCall = () => {
    // Delegate phone numbers must not be dialed or exposed from the app
    return;
  };

  const handleOpenLinkedIn = () => {
    const linkedinUrl = delegate.linkedin.startsWith('http') 
      ? delegate.linkedin 
      : `https://${delegate.linkedin}`;
    Linking.openURL(linkedinUrl).catch(() => {
      Alert.alert('Error', 'Could not open LinkedIn profile');
    });
  };

  const ContactItem = ({ icon: IconComponent, label, value, actionIcon: ActionIcon, onAction }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactLeft}>
        <View style={styles.contactIconContainer}>
          <IconComponent />
        </View>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
      {ActionIcon && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <ActionIcon />
        </TouchableOpacity>
      )}
    </View>
  );

  const DetailRow = ({ label, value }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header 
        title={isSponsorProfile ? 'Sponsor Details' : 'Delegatee Details'} 
        leftIcon="arrow-left" 
        onLeftPress={handleBack}
        iconSize={SIZES.headerIconSize} 
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.content}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={[styles.profilePicture, { width: SIZES.profileSize, height: SIZES.profileSize, borderRadius: SIZES.profileSize / 2 }]}>
              {delegate.image ? (
                <Image
                  source={{ uri: delegate.image }}
                  style={{ width: SIZES.profileSize, height: SIZES.profileSize, borderRadius: SIZES.profileSize / 2 }}
                  resizeMode="cover"
                />
              ) : (
                <UserIcon size={SIZES.profileSize * 0.5} />
              )}
            </View>
            <Text style={styles.delegateName}>{delegate.name}</Text>
            <Text style={styles.delegateRole}>{delegate.role}</Text>
            <Text style={styles.delegateCompany}>{delegate.company}</Text>

            {/* Action row: Book a meeting (left) + Start chat icon (right) */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.bookMeetingButton, hasRequested && styles.bookMeetingButtonDisabled]}
                onPress={openMeetingModal}
                activeOpacity={0.85}
                disabled={hasRequested}
              >
                <View style={styles.bookMeetingLeftIcon}>
                  <Icon name="users" size={18} color={colors.white} />
                </View>
                <Text style={[styles.bookMeetingText, hasRequested && styles.bookMeetingTextDisabled]}>
                  {hasRequested
                    ? requestedPriorityText
                      ? `Requested (${requestedPriorityText})`
                      : 'Requested'
                    : 'Book a meeting'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.chatIconButton} onPress={handleStartChat} activeOpacity={0.85}>
                <LinearGradient
                  colors={colors.gradient}
                  style={styles.chatIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <MessageCircleIcon />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {delegate.name === 'No Data' ? (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No delegate information available</Text>
            </View>
          ) : (
            <>
              {/* Contact Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactCard}>
              {delegate.email && (
                <ContactItem
                  icon={MailIcon}
                  value={delegate.email}
                  actionIcon={CopyIcon}
                  onAction={handleCopyEmail}
                />
              )}
              {/* Delegate phone numbers must not be visible in the app */}
              {delegate.linkedin && (
                <ContactItem
                  icon={LinkedinIcon}
                  value={delegate.linkedin}
                  actionIcon={ExternalLinkIcon}
                  onAction={handleOpenLinkedIn}
                />
              )}
            </View>
          </View>

          {/* Bio Section */}
          {(() => {
            const cleanedBio = delegate.bio
              ? delegate.bio
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<\/p>/gi, '\n\n')
                  .replace(/<[^>]*>/g, '')
                  .replace(/\s+/g, ' ')
                  .trim()
              : '';

            return cleanedBio ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bio</Text>
                <View style={styles.bioCard}>
                  <Text style={styles.bioText}>{cleanedBio}</Text>
                </View>
              </View>
            ) : null;
          })()}

          {/* Address Section */}
          {delegate.address && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <View style={styles.addressCard}>
                <DetailRow label="Location" value={delegate.address} />
              </View>
            </View>
          )}

              {/* Details Section */}
              {/* <View style={styles.section}>
                <Text style={styles.sectionTitle}>Details</Text>
                <View style={styles.detailsCard}>
                  <DetailRow label="Industry" value={delegate.industry} />
                  <DetailRow label="Years of Experience" value={delegate.yearsOfExperience} />
                  <DetailRow label="Location" value={delegate.location} />
                </View>
              </View> */}
            </>
          )}
        </View>
      </ScrollView>

      {/* Priority Modal (like AttendeesScreen) */}
      <Modal
        transparent
        animationType="fade"
        visible={isModalVisible}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalBackdrop2} edges={['bottom']}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <Animated.View
            style={[
              styles.modalCard2,
              {
                transform: [
                  {
                    translateY: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalHeader2}>
              <Text style={styles.modalTitle2}>Send Meeting Request</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {isRequestSuccess ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <Icon name="check-circle" size={64} color={colors.primary} />
                </View>
                <Text style={styles.successTitle}>Request Sent Successfully!</Text>
                <Text style={styles.successMessage}>
                  Your meeting request has been sent to {delegate?.name || delegate?.full_name || 'this attendee'}.
                </Text>
                <View style={styles.successButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton, styles.successButton]}
                    onPress={closeModal}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : isSendingRequest ? (
              <View style={styles.loadingContainerModal}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingTextModal}>Sending request...</Text>
              </View>
            ) : (
              <>
                <View style={styles.modalContactRow}>
                  <View style={styles.modalAvatar}>
                    {delegate?.image ? (
                      <Image source={{ uri: delegate.image }} style={styles.avatarImage} />
                    ) : (
                      <View
                        style={[
                          styles.avatarImage,
                          { backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
                        ]}
                      >
                        <UserIcon size={24} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.modalContactInfo}>
                    <Text style={styles.modalContactName}>
                      {delegate?.name || delegate?.full_name || '—'}
                    </Text>
                    <Text style={styles.modalContactCompany}>{delegate?.company || '—'}</Text>
                  </View>
                </View>

                <Text style={styles.priorityLabel}>Select Priority</Text>
                <View style={styles.priorityRow}>
                  {['1st', '2nd'].map((level) => {
                    const isActive = priority === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.priorityChip, isActive && styles.priorityChipActive]}
                        onPress={() => setPriority(level)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.priorityChipText, isActive && styles.priorityChipTextActive]}>{level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.separator3} />
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal} activeOpacity={0.85}>
                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton]}
                    onPress={openTimeModal}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Select Time</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </SafeAreaView>
      </Modal>

      {/* Time Slot Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isTimeModalVisible}
        onRequestClose={closeTimeModal}
      >
        <SafeAreaView style={styles.modalBackdrop2} edges={['bottom']}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={closeTimeModal}
          />
          <Animated.View
            style={[
              styles.modalCard2,
              {
                transform: [
                  {
                    translateY: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalHeader2}>
              <Text style={styles.modalTitle2}>Select Time Slot</Text>
              <TouchableOpacity onPress={closeTimeModal}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {meetingTimesLoading ? (
              <View style={styles.loadingContainerModal}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingTextModal}>Loading time slots...</Text>
              </View>
            ) : meetingSlotGroups.length === 0 ? (
              <View style={styles.loadingContainerModal}>
                <Text style={styles.loadingTextModal}>No time slots available.</Text>
              </View>
            ) : (
              <>
                <ScrollView
                  style={{ maxHeight: 260 }}
                  contentContainerStyle={{ paddingVertical: 4 }}
                  showsVerticalScrollIndicator
                >
                  {meetingSlotGroups.map((group) => (
                    <View key={group.date} style={styles.slotGroup}>
                      <Text style={styles.slotGroupTitle}>{group.dateLabel}</Text>
                      {group.items.map((it) => {
                        const key = `${it.date}-${it.fromFull || it.from}-${it.to}`;
                        const isActive =
                          selectedTimeSlot &&
                          selectedTimeSlot.date === it.date &&
                          selectedTimeSlot.fromFull === it.fromFull &&
                          selectedTimeSlot.to === it.to;
                        return (
                          <TouchableOpacity
                            key={key}
                            style={[styles.priorityChip, isActive && styles.priorityChipActive, { marginVertical: 4 }]}
                            onPress={() => setSelectedTimeSlot(isActive ? null : it)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.priorityChipText, isActive && styles.priorityChipTextActive]}>
                              {it.to ? `${it.from} to ${it.to}` : it.from}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.separator3}/>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeTimeModal}>
                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.primaryButton,
                      (!selectedTimeSlot || isSendingRequest) && { opacity: 0.6 },
                    ]}
                    onPress={() => {
                      if (!selectedTimeSlot) return;
                      handleSendMeetingRequest(selectedTimeSlot);
                    }}
                    disabled={!selectedTimeSlot || isSendingRequest}
                  >
                    {isSendingRequest ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Send Request</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (SIZES, isTablet) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: 8,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: SIZES.sectionSpacing,
    marginBottom: SIZES.sectionSpacing,
  },
  profilePicture: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  delegateName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  delegateRole: {
    fontSize: SIZES.body + 2,
    color: colors.textMuted,
    marginBottom: 4,
    textAlign: 'center',
  },
  delegateCompany: {
    fontSize: SIZES.body,
    color: colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  bookMeetingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: meetingRed,
  },
  bookMeetingButtonDisabled: {
    backgroundColor: colors.gray200,
    opacity: 0.9,
  },
  bookMeetingLeftIcon: {
    width: 22,
    alignItems: 'center',
  },
  bookMeetingText: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: colors.white,
  },
  bookMeetingTextDisabled: {
    color: colors.textMuted,
  },
  chatIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  chatIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: SIZES.sectionSpacing,
  },
  sectionTitle: {
    fontSize: SIZES.title,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: SIZES.paddingHorizontal / 2,
  },
  contactCard: {
    padding: SIZES.paddingHorizontal / 2,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  bioCard: {
    padding: SIZES.paddingHorizontal / 2,
  },
  bioText: {
    fontSize: SIZES.body,
    color: colors.text,
    lineHeight: 20,
  },
  addressCard: {
    padding: SIZES.paddingHorizontal / 2,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    fontSize: SIZES.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactIconContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  contactValue: {
    fontSize: SIZES.body,
    color: colors.text,
    flex: 1,
  },
  detailsCard: {
    padding: SIZES.paddingHorizontal / 2,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: SIZES.body - 1,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.text,
  },
  // Meeting Request Modal styles
  modalBackdrop2: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard2: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34, // Add extra padding at bottom for safe area
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalHeader2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle2: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeText: {
    fontSize: 20,
    color: colors.textMuted,
  },
  modalContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    marginBottom: 16,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  modalContactInfo: {
    flex: 1,
  },
  modalContactName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalContactCompany: {
    fontSize: 13,
    color: colors.textMuted,
  },
  priorityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priorityChip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  priorityChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  priorityChipText: {
    color: colors.text,
    fontWeight: '600',
  },
  priorityChipTextActive: {
    color: colors.white,
  },
  separator3: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    opacity: 0.5,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontWeight: '600',
  },
  cancelButtonText: {
    color: colors.text,
  },
  primaryButtonText: {
    color: colors.white,
  },
  slotGroup: {
    marginBottom: 8,
  },
  slotGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  successButtonContainer: {
    width: '100%',
    marginTop: 8,
  },
  successButton: {
    flex: 0,
  },
  loadingContainerModal: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingTextModal: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
});

export default DelegateDetailsScreen;

