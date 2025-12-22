import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { colors, radius } from '../../constants/theme';
import { useGetAllDelegatesQuery } from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const ChatIcon = ({ color = colors.icon, size = 24 }) => (
  <MaterialCommunityIcons name="chat" size={size} color={color} />
);

const TIER_STYLES = {
  'Platinum Sponsor': { bg: 'rgba(167, 139, 250, 0.15)', text: '#6D28D9' },
  'Gold Sponsor': { bg: 'rgba(250, 204, 21, 0.18)', text: '#A16207' },
  'Silver Sponsor': { bg: 'rgba(148, 163, 184, 0.18)', text: '#475569' },
  'Bronze Sponsor': { bg: 'rgba(251, 146, 60, 0.15)', text: '#C2410C' },
};

// Color palettes for delegates
const LOGO_COLORS = [
  '#EEF2FF', '#E6FFFA', '#FFF7ED', '#F5F3FF', '#FDF2F8',
  '#ECFEFF', '#F0FDFA', '#FEF3C7', '#E0E7FF', '#FCE7F3',
  '#D1FAE5', '#DBEAFE', '#F3E8FF', '#FED7AA', '#FDE68A',
  '#CFFAFE', '#E0F2FE', '#F5D0FE', '#FBCFE8', '#FECACA',
];

const BADGE_COLORS = [
  { bg: 'rgba(138, 52, 144, 0.15)', text: '#8A3490' },
  { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' },
  { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E' },
  { bg: 'rgba(249, 115, 22, 0.15)', text: '#F97316' },
  { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7' },
  { bg: 'rgba(236, 72, 153, 0.15)', text: '#EC4899' },
  { bg: 'rgba(14, 165, 233, 0.15)', text: '#0EA5E9' },
  { bg: 'rgba(20, 184, 166, 0.15)', text: '#14B8A6' },
  { bg: 'rgba(234, 179, 8, 0.15)', text: '#EAB308' },
  { bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444' },
  { bg: 'rgba(139, 92, 246, 0.15)', text: '#8B5CF6' },
  { bg: 'rgba(244, 63, 94, 0.15)', text: '#F43F5E' },
  { bg: 'rgba(6, 182, 212, 0.15)', text: '#06B6D4' },
  { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' },
  { bg: 'rgba(217, 119, 6, 0.15)', text: '#D97706' },
  { bg: 'rgba(220, 38, 127, 0.15)', text: '#DC267F' },
  { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366F1' },
  { bg: 'rgba(251, 146, 60, 0.15)', text: '#FB923C' },
  { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E' },
  { bg: 'rgba(147, 51, 234, 0.15)', text: '#9333EA' },
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

const SPONSORS = [
  { 
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
  },
  { 
    id: '2', 
    name: 'InnovateHub', 
    tier: 'Silver Sponsor', 
    logoBg: '#E6FFFA', 
    logoText: 'IH',
    partnerType: 'Innovation Partner',
    email: 'info@innovatehub.com',
    phone: '+1 (555) 234-5678',
    website: 'www.innovatehub.com',
    location: 'New York, NY',
    about: 'InnovateHub is a dynamic innovation platform connecting startups with enterprise partners. We foster collaboration and drive technological advancement through strategic partnerships and cutting-edge solutions.',
  },
  { 
    id: '3', 
    name: 'Digital Dynamics', 
    tier: 'Bronze Sponsor', 
    logoBg: '#FFF7ED', 
    logoText: 'DD',
    partnerType: 'Digital Solutions Partner',
    email: 'hello@digitaldynamics.com',
    phone: '+1 (555) 345-6789',
    website: 'www.digitaldynamics.com',
    location: 'Austin, TX',
    about: 'Digital Dynamics provides comprehensive digital transformation services, helping businesses modernize their operations and achieve sustainable growth in the digital age.',
  },
  { 
    id: '4', 
    name: 'CloudTech Systems', 
    tier: 'Platinum Sponsor', 
    logoBg: '#F5F3FF', 
    logoText: 'CT',
    partnerType: 'Cloud Infrastructure Partner',
    email: 'contact@cloudtech.com',
    phone: '+1 (555) 456-7890',
    website: 'www.cloudtech.com',
    location: 'Seattle, WA',
    about: 'CloudTech Systems is a premier cloud infrastructure provider, delivering scalable and secure cloud solutions to enterprises worldwide. Our expertise spans across cloud migration, DevOps, and managed services.',
  },
  { 
    id: '5', 
    name: 'StartupBase', 
    tier: 'Bronze Sponsor', 
    logoBg: '#FDF2F8', 
    logoText: 'SB',
    partnerType: 'Startup Ecosystem Partner',
    email: 'info@startupbase.com',
    phone: '+1 (555) 567-8901',
    website: 'www.startupbase.com',
    location: 'Boston, MA',
    about: 'StartupBase is a vibrant startup ecosystem platform that connects entrepreneurs, investors, and mentors. We provide resources, networking opportunities, and support to help startups thrive.',
  },
  { 
    id: '6', 
    name: 'NextGen Partners', 
    tier: 'Silver Sponsor', 
    logoBg: '#ECFEFF', 
    logoText: 'NP',
    partnerType: 'Strategic Partner',
    email: 'contact@nextgenpartners.com',
    phone: '+1 (555) 678-9012',
    website: 'www.nextgenpartners.com',
    location: 'Chicago, IL',
    about: 'NextGen Partners specializes in strategic business partnerships and investment opportunities. We help companies scale through innovative collaboration and strategic alliances.',
  },
  { 
    id: '7', 
    name: 'FutureTech Labs', 
    tier: 'Gold Sponsor', 
    logoBg: '#F0FDFA', 
    logoText: 'FL',
    partnerType: 'Research & Development Partner',
    email: 'info@futuretechlabs.com',
    phone: '+1 (555) 789-0123',
    website: 'www.futuretechlabs.com',
    location: 'San Jose, CA',
    about: 'FutureTech Labs is at the forefront of emerging technologies, conducting cutting-edge research in AI, machine learning, and quantum computing. We bridge the gap between research and practical applications.',
  },
  { 
    id: '8', 
    name: 'QuantumWorks', 
    tier: 'Platinum Sponsor', 
    logoBg: '#EEF2FF', 
    logoText: 'QW',
    partnerType: 'Quantum Technology Partner',
    email: 'contact@quantumworks.com',
    phone: '+1 (555) 890-1234',
    website: 'www.quantumworks.com',
    location: 'Los Angeles, CA',
    about: 'QuantumWorks is pioneering the future of quantum computing and quantum technologies. We develop quantum solutions for complex problems and partner with organizations to explore quantum applications.',
  },
];

export const SponsorsScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  
  const { data: delegatesData, isLoading, error } = useGetAllDelegatesQuery(undefined, {
    skip: !isDelegate,
  });
  
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return 'Failed to load delegates.';
  }, [error]);

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
        sectionSpacing: getResponsiveValue({ android: 20, ios: 24, tablet: 26, default: 22 }),
        cardSpacing: getResponsiveValue({ android: 12, ios: 14, tablet: 16, default: 12 }),
        body: getResponsiveValue({ android: 13, ios: 14, tablet: 15, default: 13 }),
        title: getResponsiveValue({ android: 18, ios: 19, tablet: 21, default: 18 }),
        cardHeight: getResponsiveValue({ android: 78, ios: 80, tablet: 86, default: 78 }),
        logoSize: getResponsiveValue({ android: 54, ios: 56, tablet: 60, default: 54 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  // Map API delegates to the sponsor card shape
  const delegates = useMemo(() => {
    if (!isDelegate || !delegatesData) return [];
    const list = Array.isArray(delegatesData?.data) ? delegatesData.data : Array.isArray(delegatesData) ? delegatesData : [];
    return list.map((d) => {
      const fullName =
        d.full_name ||
        `${d.fname || ''} ${d.lname || ''}`.trim() ||
        d.name ||
        '';
      const name = fullName || 'Unknown';
      const initials = name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase())
        .slice(0, 2)
        .join('') || 'DL';
      const delegateId = String(d.id);
      const logoBg = getColorFromString(delegateId, LOGO_COLORS);
      const badgeColor = getColorFromString(delegateId + name, BADGE_COLORS);
      return {
        id: delegateId,
        name,
        tier: 'Delegate',
        logoBg,
        logoText: initials,
        image: d.image || null,
        partnerType: d.job_title || '',
        email: d.email || '',
        phone: d.mobile || '',
        website: d.linkedin_url || '',
        location: d.address || '',
        about: d.bio || '',
        company: d.company || '',
        badgeColor,
        raw: d,
      };
    });
  }, [isDelegate, delegatesData]);

  const filteredSponsors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const baseList = isDelegate ? delegates : SPONSORS;
    if (!q) return baseList;
    return baseList.filter((sponsor) => sponsor.name.toLowerCase().includes(q));
  }, [searchQuery, isDelegate, delegates]);

  const renderSponsor = ({ item }) => {
    const tierStyle = TIER_STYLES[item.tier] || { bg: colors.gray100, text: colors.text };
    // Use delegate-specific badge color if available, otherwise use tier style
    const badgeStyle = item.badgeColor || tierStyle;
    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8}
        onPress={() => {
          router.push({
            pathname: '/sponsor-details',
            params: {
              sponsor: JSON.stringify(item)
            }
          });
        }}
      >
        <View style={styles.logoWrapper}>
          <View
            style={[
              styles.logo,
              { backgroundColor: item.logoBg, width: SIZES.logoSize, height: SIZES.logoSize, borderRadius: radius.md },
            ]}
          >
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={{ width: SIZES.logoSize, height: SIZES.logoSize, borderRadius: radius.md }}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.logoText}>{item.logoText}</Text>
            )}
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
            <Text style={[styles.badgeText, { color: badgeStyle.text }]}>{item.company || item.tier}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.chatButton} 
          activeOpacity={0.7}
          onPress={(e) => {
            e.stopPropagation();
            // Create thread object for MessageDetailScreen
            const thread = {
              id: item.id,
              name: item.name,
              status: 'Online',
              avatar: item.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=${encodeURIComponent(item.logoBg?.replace('#', '') || '8A3490')}&color=fff&size=200`,
              messages: [], // Empty messages array - will start a new conversation
            };
            router.push({
              pathname: '/message-detail',
              params: {
                thread: JSON.stringify(thread)
              }
            });
          }}
        >
          <ChatIcon color={colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // The content and contentWrap styles are restructured to ensure FlatList fills and scrolls
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title={isDelegate ? 'Delegate' : 'Event Sponsors'}
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
      />

      <KeyboardAvoidingView
        style={styles.contentWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={60}
      >
        <View style={styles.content}>
          <SearchBar
            placeholder={isDelegate ? 'Search delegates...' : 'Search sponsors...'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
          />
          <Text style={styles.countText}>
            {isDelegate
              ? `${filteredSponsors.length} delegates found`
              : `${filteredSponsors.length} sponsors found`}
          </Text>
        </View>
        {isLoading ? (
          <View style={[styles.listContent, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
            <Text style={styles.countText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={[styles.listContent, { alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: 32 }]}>
            <Text style={[styles.countText, { color: colors.textMuted }]}>{errorMessage}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredSponsors}
            keyExtractor={(item) => item.id}
            renderItem={renderSponsor}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={[
              styles.listContent,
              filteredSponsors.length === 0 && { flex: 1 },
              { paddingHorizontal: SIZES.paddingHorizontal }
            ]}
            bounces={true}
            style={{ flex: 1, backgroundColor: '#F9FAFB' }}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (SIZES) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentWrap: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: 12,
    backgroundColor: '#F9FAFB',
    zIndex: 2,
  },
  searchBar: {
    marginTop: 12,
  },
  countText: {
    fontSize: SIZES.body + 2,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 40,
    paddingTop: 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    minHeight: SIZES.cardHeight,
    borderWidth: 2,
    borderColor: "#F3F4F6",
  },
  separator: {
    height: 12,
  },
  logoWrapper: {
    marginRight: 12,
  },
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: SIZES.title - 2,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: SIZES.body,
    fontWeight: '600',
  },
  chatButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SponsorsScreen;

