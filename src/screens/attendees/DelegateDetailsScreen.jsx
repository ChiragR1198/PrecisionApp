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
import { useSendDelegateMeetingRequestMutation, useSendSponsorMeetingRequestMutation } from '../../store/api';
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

export const DelegateDetailsScreen = () => {
  const navigation = useNavigation();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [priority, setPriority] = useState('1st');
  const { user } = useAppSelector((state) => state.auth);
  
  // Modal states for meeting request
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isRequestSuccess, setIsRequestSuccess] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;

  // Determine user type
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';

  // Use appropriate mutation based on user type
  const [createDelegateMeetingRequest] = useSendDelegateMeetingRequestMutation();
  const [createSponsorMeetingRequest] = useSendSponsorMeetingRequestMutation();
  const createMeetingRequest = isDelegate ? createDelegateMeetingRequest : createSponsorMeetingRequest;

  // Get delegate data from params
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
    
    // For expo-router with drawer navigation, explicitly navigate to attendees screen
    try {
      console.log('🔙 Navigating to attendees screen');
      router.push('/(drawer)/attendees');
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      // Fallback: try router.back()
      try {
        console.log('🔙 Fallback: trying router.back()');
        router.back();
      } catch (backError) {
        console.error('❌ Router.back() also failed:', backError);
      }
    }
  }, []);

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
  };

  const handleSendMeetingRequest = async () => {
    try {
      // Validate attendee ID
      if (!delegate.id || delegate.id === '') {
        Alert.alert('Error', `Invalid ${isDelegate ? 'sponsor' : 'delegate'} ID`);
        return;
      }

      // Open modal with loading state
      setIsModalVisible(true);
      setIsSendingRequest(true);
      setIsRequestSuccess(false);

      // Map priority text to number: 1st=1, 2nd=2
      const priorityMap = { '1st': 1, '2nd': 2 };
      const priorityValue = priorityMap[priority] || 1;

      // Get current date and time
      const now = new Date();
      const date = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const time = now.toTimeString().split(' ')[0]; // Format: HH:MM:SS

      // Use different parameter names based on user type
      const payload = isDelegate
        ? {
            sponsor_id: Number(delegate.id),
            event_id: Number(user?.event_id || 27),
            priority: priorityValue,
            date: date,
            time: time,
            message: '',
          }
        : {
            delegate_id: Number(delegate.id),
            event_id: Number(user?.event_id || 27),
            priority: priorityValue,
            date: date,
            time: time,
            message: '',
          };

      await createMeetingRequest(payload).unwrap();

      // Show success state
      setIsSendingRequest(false);
      setIsRequestSuccess(true);
    } catch (e) {
      console.error('Error sending meeting request:', e);
      setIsSendingRequest(false);
      setIsRequestSuccess(false);
      Alert.alert('Error', e?.data?.message || e?.message || 'Failed to send meeting request');
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
    const phoneNumber = delegate.phone.replace(/\D/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
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

  const PriorityButton = ({ label, isSelected, onPress }) => (
    <TouchableOpacity
      style={[styles.priorityButton, isSelected && styles.priorityButtonSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.priorityButtonText, isSelected && styles.priorityButtonTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
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
        title="Delegate Details" 
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

            <TouchableOpacity style={styles.startChatButton} onPress={handleStartChat} activeOpacity={0.8}>
              <LinearGradient
                colors={colors.gradient}
                style={styles.startChatGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MessageCircleIcon />
                <Text style={styles.startChatText}>Start Chat</Text>
              </LinearGradient>
            </TouchableOpacity>
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
              {delegate.phone && (
                <ContactItem
                  icon={PhoneIcon}
                  value={delegate.phone}
                  actionIcon={PhoneIcon}
                  onAction={handleCall}
                />
              )}
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

          {/* Select Priority Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Priority</Text>
            <View style={styles.priorityContainer}>
              <PriorityButton
                label="1st"
                isSelected={priority === '1st'}
                onPress={() => setPriority('1st')}
              />
              <PriorityButton
                label="2nd"
                isSelected={priority === '2nd'}
                onPress={() => setPriority('2nd')}
              />
            </View>
          </View>

          {/* Send Request Button */}
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.sendRequestButton} 
              onPress={handleSendMeetingRequest} 
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradient}
                style={styles.sendRequestGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.sendRequestText}>Send Request</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

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

      {/* Meeting Request Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isModalVisible}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalBackdrop2} edges={['bottom']}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={closeModal}
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
              <Text style={styles.modalTitle2}>Send Meeting Request</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {isRequestSuccess ? (
              // Success State
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <Icon name="check-circle" size={64} color={colors.primary} />
                </View>
                <Text style={styles.successTitle}>Request Sent Successfully!</Text>
                <Text style={styles.successMessage}>
                  Your meeting request has been sent to {isDelegate ? delegate.name : (delegate.full_name || delegate.name)}.
                </Text>
                <View style={styles.successButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton, styles.successButton]}
                    onPress={closeModal}
                  >
                    <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Loading State
              <View style={styles.loadingContainerModal}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingTextModal}>Sending request...</Text>
              </View>
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
  startChatButton: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: 8,
  },
  startChatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
  },
  startChatText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.white,
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
  priorityContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityButton: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  priorityButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.text,
  },
  priorityButtonTextSelected: {
    color: colors.white,
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
  sendRequestButton: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  sendRequestGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  sendRequestText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.white,
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

