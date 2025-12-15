import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
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

const CpuIcon = ({ color = colors.white, size = 16 }) => (
  <MaterialCommunityIcons name="chip" size={size} color={color} />
);

export const SponsorDetailsScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const navigation = useNavigation();

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
    return params?.sponsor ? { ...defaultSponsor, ...JSON.parse(params.sponsor) } : defaultSponsor;
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
        logoSize: getResponsiveValue({ android: 80, ios: 80, tablet: 90, default: 80 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const handleStartChat = () => {
    // Implement chat functionality
    console.log('Start chat with', sponsor.name);
  };

  const handleCopyEmail = () => {
    Linking.openURL(`mailto:${sponsor.email}`).catch(() => {
      Alert.alert('Error', 'Could not open email client');
    });
  };

  const handleCall = () => {
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header 
        title="Sponsors Details" 
        leftIcon="arrow-left" 
        onLeftPress={() => navigation.goBack?.()} 
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
            <View style={[styles.logoContainer, { width: SIZES.logoSize, height: SIZES.logoSize, borderRadius: radius.md }]}>
              <View style={[styles.logo, { backgroundColor: sponsor.logoBg, width: SIZES.logoSize - 8, height: SIZES.logoSize - 8, borderRadius: radius.md - 2 }]}>
                <Text style={styles.logoText}>{sponsor.logoText}</Text>
              </View>
            </View>
            <Text style={styles.sponsorName}>{sponsor.name}</Text>
            <View style={styles.partnerBadge}>
              {/* <CpuIcon /> */}
              <Text style={styles.partnerBadgeText}>{sponsor.partnerType}</Text>
            </View>
          </LinearGradient>

          {/* Contact Information Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UserIcon />
              <Text style={styles.sectionTitle}>Contact Information</Text>
            </View>
            <View style={styles.contactCard}>
              <ContactItem
                icon={MailIcon}
                label="Email"
                value={sponsor.email}
                actionIcon={CopyIcon}
                onAction={handleCopyEmail}
              />
              <ContactItem
                icon={PhoneIcon}
                label="Phone"
                value={sponsor.phone}
                actionIcon={PhoneIcon2}
                onAction={handleCall}
              />
              <ContactItem
                icon={GlobeIcon}
                label="Website"
                value={sponsor.website}
                actionIcon={ExternalLinkIcon}
                onAction={handleOpenWebsite}
              />
              <ContactItem
                icon={MapPinIcon}
                label="Location"
                value={sponsor.location}
                actionIcon={NavigationIcon}
                onAction={handleOpenLocation}
              />
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <InfoIcon />
              <Text style={styles.sectionTitle}>About</Text>
            </View>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutText}>{sponsor.about}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Start Chat Button */}
      <View style={styles.bottomButtonContainer}>
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
    padding: SIZES.paddingHorizontal * 1.5,
    alignItems: 'center',
    marginTop: SIZES.sectionSpacing - 12,
    marginBottom: SIZES.sectionSpacing,
    minHeight: 200,
    justifyContent: 'center',
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 12,
    textAlign: 'center',
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
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.white,
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
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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

