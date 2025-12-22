import Icon from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
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
import { useCreateMeetingRequestMutation } from '../../store/api';
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
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const [priority, setPriority] = useState('1st');
  const { user } = useAppSelector((state) => state.auth);
  const [createMeetingRequest] = useCreateMeetingRequestMutation();

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

  const handleSendMeetingRequest = async () => {
    try {
      // Map priority text to number: 1st=1, 2nd=2
      const priorityMap = { '1st': 1, '2nd': 2 };
      const priorityValue = priorityMap[priority] || 1;

      // Prepare payload
      const payload = {
        sponsor_id: Number(delegate.id),
        priority: priorityValue,
        event_id: Number(user?.event_id || 27),
      };

      await createMeetingRequest(payload).unwrap();

      Alert.alert('Success', 'Meeting request sent successfully');
    } catch (e) {
      console.error('Error sending meeting request:', e);
      Alert.alert('Error', e.message || 'Failed to send meeting request');
    }
  };

  const handleStartChat = () => {
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header 
        title="Delegate Details" 
        leftIcon="arrow-left" 
        onLeftPress={() => router.push('/attendees')}
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
});

export default DelegateDetailsScreen;

