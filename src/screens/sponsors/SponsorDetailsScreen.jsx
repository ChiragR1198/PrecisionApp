import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import { useSendDelegateMeetingRequestMutation, useSendSponsorMeetingRequestMutation } from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const MailIcon = ({ color = colors.primary, size = 22 }) => (
  <MaterialIcons name="email" size={size} color={color} />
);

const PhoneIcon = ({ color = colors.primary, size = 18 }) => (
  <FontAwesome5 name="phone-alt" size={size} color={color} />
);

const PhoneIcon2 = ({ color = colors.textMuted, size = 20 }) => (
  <Feather name="phone" size={size} color={color} />
);

const GlobeIcon = ({ color = colors.primary, size = 20 }) => (
  <FontAwesome5 name="globe" size={size} color={color} />
);

const MapPinIcon = ({ color = colors.primary, size = 22 }) => (
  <MaterialIcons name="location-pin" size={size} color={color} />
);

const MessageCircleIcon = ({ color = colors.white, size = 20 }) => (
  <MaterialCommunityIcons name="chat" size={size} color={color} />
);

const CalendarIcon = ({ color = colors.white, size = 20 }) => (
  <MaterialIcons name="event-available" size={size} color={color} />
);

const CopyIcon = ({ color = colors.textMuted, size = 20 }) => (
  <AntDesign name="copy" size={size} color={color} />
);

const ExternalLinkIcon = ({ color = colors.textMuted, size = 20 }) => (
  <Octicons name="link-external" size={size} color={color} />
);

const NavigationIcon = ({ color = colors.textMuted, size = 20 }) => (
  <Ionicons name="navigate-circle" size={size} color={color} />
);

const UserIcon = ({ color = colors.primary, size = 30 }) => (
  <MaterialIcons name="contact-page" size={size} color={color} />
);

const InfoIcon = ({ color = colors.primary, size = 24 }) => (
  <Ionicons name="information-circle" size={size} color={color} />
);

const BuildingIcon = ({ color = colors.white, size = 18 }) => (
  <MaterialIcons name="business" size={size} color={color} />
);

const CpuIcon = ({ color = colors.white, size = 16 }) => (
  <MaterialCommunityIcons name="chip" size={size} color={color} />
);

// Color palettes for delegates (same as SponsorsScreen)
const LOGO_COLORS = [
  '#EEF2FF', '#E6FFFA', '#FFF7ED', '#F5F3FF', '#FDF2F8',
  '#ECFEFF', '#F0FDFA', '#FEF3C7', '#E0E7FF', '#FCE7F3',
  '#D1FAE5', '#DBEAFE', '#F3E8FF', '#FED7AA', '#FDE68A',
  '#CFFAFE', '#E0F2FE', '#F5D0FE', '#FBCFE8', '#FECACA',
];

// Generate consistent color based on string hash
const getColorFromString = (str, colorArray) => {
  if (!str) return colorArray[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorArray[Math.abs(hash) % colorArray.length];
};

export const SponsorDetailsScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const { user } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const insets = useSafeAreaInsets();
  const [isBookingMeeting, setIsBookingMeeting] = useState(false);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [createDelegateMeetingRequest] = useSendDelegateMeetingRequestMutation();
  const [createSponsorMeetingRequest] = useSendSponsorMeetingRequestMutation();

  // Get sponsor data from params or use default
  const sponsor = useMemo(() => {
    const defaultSponsor = {
      id: '1',
      name: 'TechCorp Solutions',
      tier: 'Gold Sponsor',
      logoBg: '#EEF2FF',
      logoText: 'TC',
      partnerType: 'Technology Partner',
      email: 'contact@techcorp.com',
      phone: '+1 (555) 123-4567',
      website: 'www.techcorp.com',
      location: 'San Francisco, CA',
      about: 'TechCorp Solutions is a leading technology company specializing in innovative software solutions for enterprise clients. We\'ve been partnering with events like this for over 5 years, helping connect businesses with cutting-edge technology and digital transformation strategies.',
    };

    // If params exist, merge with default
    const parsed = params?.sponsor ? { ...defaultSponsor, ...JSON.parse(params.sponsor) } : defaultSponsor;
    const raw = parsed?.raw || {};

    // Prefer backend biography/company_information for sponsor profiles
    if (!parsed.about || parsed.about.trim().length === 0) {
      const backendAbout = raw.biography || raw.company_information || '';
      if (backendAbout) {
        parsed.about = backendAbout;
      }
    }
    
    // If logoBg is not set (for delegates), generate it from ID
    if (!parsed.logoBg && parsed.id) {
      parsed.logoBg = getColorFromString(String(parsed.id), LOGO_COLORS);
    }

    // Clean about text if it contains HTML (in case raw data is passed)
    if (parsed.about && typeof parsed.about === 'string') {
      if (parsed.about.includes('<')) {
        parsed.about = parsed.about
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      // If cleaned text is empty or just DOCTYPE, set to empty
      if (
        !parsed.about ||
        parsed.about.length < 10 ||
        parsed.about.toLowerCase().includes('doctype')
      ) {
        parsed.about = '';
      }
    }

    return parsed;
  }, [params]);

  const ABOUT_TEXT = useMemo(() => (sponsor?.about || '').trim(), [sponsor]);
  const PREVIEW_ABOUT_TEXT = useMemo(() => {
    if (!ABOUT_TEXT) return '';
    if (ABOUT_TEXT.length <= 280) return ABOUT_TEXT;
    return `${ABOUT_TEXT.slice(0, 280).trim()}...`;
  }, [ABOUT_TEXT]);
  const shouldShowReadMore = useMemo(
    () => ABOUT_TEXT.length > 280,
    [ABOUT_TEXT]
  );

  const isDelegateProfile = useMemo(() => {
    const tier = String(sponsor?.tier || '').toLowerCase();
    if (tier === 'delegate') return true;
    // Fallback heuristics when tier isn't present
    const raw = sponsor?.raw || {};
    return Boolean(raw?.linkedin_url || raw?.fname || raw?.lname);
  }, [sponsor]);

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
        logoSize: getResponsiveValue({ android: 80, ios: 80, tablet: 90, default: 80 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  // Handle back navigation (both header back button and hardware back button)
  const handleBack = useCallback(() => {
    const returnTo = params?.returnTo;
    const returnThread = params?.returnThread;
    const returnToFromThread = params?.returnToFromThread;

    if (returnTo === 'message-detail' && returnThread) {
      try {
        router.push({
          pathname: '/message-detail',
          params: {
            thread: returnThread,
            returnTo: returnToFromThread || 'messages',
          },
        });
        return;
      } catch (error) {
        console.error('❌ Navigation to message-detail failed:', error);
      }
    }

    // Respect explicit return target when provided
    const targetPath =
      returnTo === 'attendees'
        ? '/(drawer)/attendees'
        : returnTo === 'messages'
          ? '/(drawer)/messages'
        : '/(drawer)/sponsors';

    try {
      router.push(targetPath);
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      try {
        router.back();
      } catch (backError) {
        console.error('❌ Router.back() also failed:', backError);
      }
    }
  }, [params?.returnTo]);

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true; // Prevent default behavior (exit app)
      });

      return () => {
        backHandler.remove();
      };
    }
  }, [handleBack]);

  const handleStartChat = () => {
    // Prepare thread data for MessageDetailScreen
    // MessageDetailScreen expects: user_id, user_type, name, avatar/user_image
    // Since this is SponsorDetailsScreen, the recipient is always a sponsor
    const sponsorId = sponsor.id || sponsor.raw?.id;
    
    if (!sponsorId) {
      Alert.alert('Error', 'Invalid sponsor information');
      return;
    }

    const threadData = {
      id: String(sponsorId),
      user_id: Number(sponsorId), // Use sponsor ID as user_id (must be number for API)
      user_type: 'sponsor', // Recipient is always a sponsor in this screen
      name: sponsor.name,
      user_name: sponsor.name,
      avatar: sponsor.image,
      user_image: sponsor.image,
      // Include any other fields that might be useful
      company: sponsor.company,
      email: sponsor.email,
    };

    // Navigate to MessageDetailScreen with returnTo parameter and original sponsor data
    router.push({
      pathname: '/message-detail',
      params: {
        thread: JSON.stringify(threadData),
        returnTo: 'sponsor-details', // Track where we came from
        returnSponsor: JSON.stringify(sponsor), // Pass sponsor data to navigate back
      },
    });
  };

  const handleBookMeeting = async () => {
    const targetId = sponsor?.id || sponsor?.raw?.id;

    if (!targetId) {
      Alert.alert('Error', 'Invalid profile information');
      return;
    }

    try {
      if (isBookingMeeting) return;
      setIsBookingMeeting(true);

      const now = new Date();
      const meeting_date = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const meeting_time_from = now.toTimeString().split(' ')[0]; // HH:MM:SS
      const endMs = now.getTime() + 15 * 60 * 1000;
      const meeting_time_to = new Date(endMs).toTimeString().split(' ')[0]; // HH:MM:SS (+15 min)

      // Delegate -> Sponsor booking (when viewing a sponsor profile)
      if (isDelegate && !isDelegateProfile) {
        await createDelegateMeetingRequest({
          sponsor_id: Number(targetId),
          event_id: Number(user?.event_id || 27),
          priority: 1,
          meeting_date,
          meeting_time_from,
          meeting_time_to,
          message: '',
        }).unwrap();
      }
      // Sponsor -> Delegate booking (when viewing a delegate profile)
      else if (!isDelegate && isDelegateProfile) {
        await createSponsorMeetingRequest({
          delegate_id: Number(targetId),
          event_id: Number(user?.event_id || 27),
          priority: 1,
          meeting_date,
          meeting_time_from,
          meeting_time_to,
          message: '',
        }).unwrap();
      } else {
        Alert.alert('Not available', 'Meeting booking is not available for this profile type.');
        return;
      }

      Alert.alert('Success', `Meeting request sent to ${sponsor?.name || 'delegate'}.`);
    } catch (e) {
      console.error('Error sending meeting request:', e);
      Alert.alert('Error', e?.data?.message || e?.message || 'Failed to send meeting request');
    } finally {
      setIsBookingMeeting(false);
    }
  };

  const handleCopyEmail = () => {
    Linking.openURL(`mailto:${sponsor.email}`).catch(() => {
      Alert.alert('Error', 'Could not open email client');
    });
  };

  const handleCall = () => {
    // Do not allow calling when viewing a delegate profile
    if (!sponsor.phone || isDelegateProfile) return;
    const phoneNumber = sponsor.phone.replace(/\D/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleOpenWebsite = () => {
    const websiteUrl = sponsor.website.startsWith('http') 
      ? sponsor.website 
      : `https://${sponsor.website}`;
    Linking.openURL(websiteUrl).catch(() => {
      Alert.alert('Error', 'Could not open website');
    });
  };

  const handleOpenLocation = () => {
    const locationUrl = `https://maps.google.com/?q=${encodeURIComponent(sponsor.location)}`;
    Linking.openURL(locationUrl).catch(() => {
      Alert.alert('Error', 'Could not open maps');
    });
  };

  const ContactItem = ({ icon: IconComponent, label, value, actionIcon: ActionIcon, onAction }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactLeft}>
        <View style={styles.contactIconContainer}>
          <IconComponent />
        </View>
        <View style={styles.contactTextContainer}>
          <Text style={styles.contactValue}>{value}</Text>
          <Text style={styles.contactLabel}>{label}</Text>
        </View>
      </View>
      {ActionIcon && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <ActionIcon />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header 
        title={isDelegateProfile ? 'Delegate Details' : 'Sponsor Details'} 
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
          {/* Sponsor Profile Section */}
          <LinearGradient
            colors={colors.gradient}
            style={styles.profileCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.logoContainer, { width: SIZES.logoSize + 8, height: SIZES.logoSize + 8, borderRadius: (SIZES.logoSize + 8) / 2 }]}>
              <View style={[styles.logo, { backgroundColor: sponsor.logoBg, width: SIZES.logoSize + 8, height: SIZES.logoSize + 8, borderRadius: (SIZES.logoSize + 8) / 2 }]}>
                {sponsor.image ? (
                  <Image
                    source={{ uri: sponsor.image }}
                    style={{ width: SIZES.logoSize, height: SIZES.logoSize, borderRadius: SIZES.logoSize / 2 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.logoText}>{sponsor.logoText}</Text>
                )}
              </View>
            </View>
            <Text style={styles.sponsorName}>{sponsor.name}</Text>
            {sponsor.partnerType && (
              <Text style={[styles.partnerBadgeText]}>{sponsor.partnerType}</Text>
            )}
            {sponsor.company && (
              <View style={styles.companyBadge}>
                <BuildingIcon size={16} />
                <Text style={styles.companyText}>{sponsor.company}</Text>
              </View>
            )}

            {/* Book a Meeting (Sponsor + Delegate profiles) */}
            {/* {!!sponsor?.name && (
              <View style={styles.bookMeetingRow}>
                <TouchableOpacity
                  style={styles.bookMeetingButton}
                  onPress={handleBookMeeting}
                  activeOpacity={0.85}
                  disabled={isBookingMeeting}
                >
                  <LinearGradient
                    colors={['#DC2626', '#B91C1C']}
                    style={styles.bookMeetingGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {isBookingMeeting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <CalendarIcon />
                    )}
                    <Text style={styles.bookMeetingText}>Book a Meeting</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bookMeetingQuickButton}
                  onPress={handleBookMeeting}
                  activeOpacity={0.85}
                  disabled={isBookingMeeting}
                >
                  <View style={styles.bookMeetingQuickInner}>
                    <MaterialIcons name="person-add" size={18} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </View>
            )} */}
          </LinearGradient>

          {/* Contact Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UserIcon />
              <Text style={styles.sectionTitle}>Contact Information</Text>
            </View>
            <View style={styles.contactCard}>
              {sponsor.email && (
                <ContactItem
                  icon={MailIcon}
                  label="Email"
                  value={sponsor.email}
                  actionIcon={CopyIcon}
                  onAction={handleCopyEmail}
                />
              )}
              {sponsor.phone && !isDelegateProfile && (
                <ContactItem
                  icon={PhoneIcon}
                  label="Phone"
                  value={sponsor.phone}
                  actionIcon={PhoneIcon2}
                  onAction={handleCall}
                />
              )}
              {sponsor.website && (
                <ContactItem
                  icon={GlobeIcon}
                  label="Website"
                  value={sponsor.website}
                  actionIcon={ExternalLinkIcon}
                  onAction={handleOpenWebsite}
                />
              )}
              {sponsor.location && (
                <ContactItem
                  icon={MapPinIcon}
                  label="Location"
                  value={sponsor.location}
                  actionIcon={NavigationIcon}
                  onAction={handleOpenLocation}
                />
              )}
            </View>
          </View>

          {/* About Section with inline Read More */}
          {ABOUT_TEXT && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <InfoIcon />
                <Text style={styles.sectionTitle}>About</Text>
              </View>
              <View style={styles.aboutCard}>
                <Text style={styles.aboutText}>
                  {isAboutExpanded ? ABOUT_TEXT : PREVIEW_ABOUT_TEXT}
                </Text>
                {shouldShowReadMore && (
                  <TouchableOpacity
                    style={styles.readMoreButton}
                    activeOpacity={0.8}
                    onPress={() => setIsAboutExpanded((v) => !v)}
                  >
                    <Text style={styles.readMoreText}>
                      {isAboutExpanded ? 'Show Less' : 'Read More'}
                    </Text>
                    <Feather
                      name={isAboutExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.primary}
                      style={styles.readMoreIcon}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Start Chat Button */}
      <View style={[styles.bottomButtonContainer, { bottom: 0, paddingBottom: Math.max(insets.bottom, 0) + 16 }]}>
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
    paddingBottom: 100,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: 8,
  },
  profileCard: {
    borderRadius: radius.lg,
    paddingVertical: SIZES.paddingHorizontal * 1.8,
    paddingHorizontal: SIZES.paddingHorizontal * 1.5,
    alignItems: 'center',
    marginTop: SIZES.sectionSpacing - 12,
    marginBottom: SIZES.sectionSpacing,
    minHeight: 220,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
    marginBottom: 8,
  },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  sponsorName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  companyText: {
    fontSize: SIZES.body,
    fontWeight: '500',
    color: colors.white,
    opacity: 0.95,
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    gap: 6,
  },
  partnerBadgeText: {
    fontSize: SIZES.body - 1,
    fontWeight: '400',
    color: colors.white,
    textAlign: 'center',
    opacity: 0.95,
    marginBottom: 16,
  },
  bookMeetingRow: {
    width: '100%',
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  bookMeetingButton: {
    flex: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  bookMeetingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
  },
  bookMeetingText: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: colors.white,
  },
  bookMeetingQuickButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookMeetingQuickInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17, 24, 39, 0.08)',
  },
  section: {
    marginBottom: SIZES.sectionSpacing,
    paddingHorizontal: SIZES.paddingHorizontal / 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
    paddingHorizontal: SIZES.paddingHorizontal / 2,
  },
  sectionTitle: {
    fontSize: SIZES.title,
    fontWeight: '700',
    color: colors.text,
  },
  contactCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(138, 52, 144, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactTextContainer: {
    flex: 1,
  },
  contactValue: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.text,
    
  },
  contactLabel: {
    fontSize: SIZES.body - 2,
    color: colors.textMuted,
    
  },
  aboutCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: SIZES.paddingHorizontal / 2,
  },
  aboutText: {
    fontSize: SIZES.body,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 22,
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 12,
  },
  readMoreText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
    marginRight: 4,
  },
  readMoreIcon: {
    marginLeft: 2,
  },
  bottomButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    // bottom and paddingBottom will be set dynamically based on safe area insets
  },
  startChatButton: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  startChatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  startChatText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.white,
  },
});

export default SponsorDetailsScreen;

