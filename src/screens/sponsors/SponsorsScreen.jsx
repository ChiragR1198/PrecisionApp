import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { SearchBar } from '../../components/common/SearchBar';
import { Icons } from '../../constants/icons';
import { colors, radius } from '../../constants/theme';
import {
  useGetAllDelegatesQuery,
  useGetDelegateMeetingRequestOutcomesQuery,
  useGetDelegateMeetingTimesQuery,
  useGetEventSponsorQuery,
  useGetSponsorMeetingRequestOutcomesQuery,
  useGetSponsorMeetingTimesQuery,
  useSendDelegateMeetingRequestMutation,
  useSendSponsorMeetingRequestMutation,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const UserIcon = Icons.User;

function extractOutcomesList(response) {
  if (response == null) return [];
  if (Array.isArray(response)) return response;
  const candidates = [
    response.data,
    response?.data?.data,
    response?.data?.records,
    response?.data?.items,
    response?.data?.list,
    response?.data?.meetings,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function normalizeOutcomeAccepted(raw) {
  if (raw === true) return 1;
  if (raw === false) return 2;
  if (raw === 1 || raw === '1') return 1;
  if (raw === 2 || raw === '2') return 2;
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'true' || s === 'accepted' || s === 'accept' || s === '1') return 1;
  if (s === 'false' || s === 'declined' || s === 'reject' || s === 'rejected' || s === '2') return 2;
  const n = Number(raw);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return null;
}

function pickOutcomeFlag(map, attendee, viewerIsDelegate) {
  if (!map || !(map instanceof Map) || map.size === 0) return null;
  const raw = attendee && typeof attendee === 'object' ? attendee : {};
  const candidateKeys = viewerIsDelegate
    ? [raw.id, raw.user_id, raw.sponsor_id, raw.sponsorId, raw.member_id, raw.sponsor_user_id]
    : [raw.id, raw.user_id, raw.delegate_id, raw.delegateId, raw.member_id];
  for (const c of candidateKeys) {
    if (c == null || c === '') continue;
    const n = Number(c);
    if (!Number.isFinite(n)) continue;
    const flag = map.get(n) ?? map.get(String(n));
    if (flag === 1 || flag === 2) return flag;
  }
  return null;
}

const SponsorListRow = React.memo(function SponsorListRow({
  item,
  SIZES,
  styles,
  onOpenDetails,
  onOpenRequest,
}) {
  const tierStyle =
    {
      Delegate: { bg: colors.gray100, text: colors.text },
      Sponsor: { bg: colors.gray100, text: colors.text },
      'Event Sponsor': { bg: colors.gray100, text: colors.text },
    }[item.tier] || { bg: colors.gray100, text: colors.text };
  const badgeStyle = item.badgeColor || tierStyle;

  const requestLabel =
    item.requestOutcome === 'accepted'
      ? 'Accepted'
      : item.requestOutcome === 'declined'
        ? 'Declined'
        : item.hasRequest
          ? item.priorityText
            ? `Requested (${item.priorityText})`
            : 'Requested'
          : 'Request Meeting';

  const requestDisabled =
    item.requestOutcome === 'accepted' ||
    (item.hasRequest && item.requestOutcome !== 'declined');

  const rowHighlight =
    item.requestOutcome === 'accepted'
      ? styles.rowAccepted
      : item.requestOutcome === 'declined'
        ? styles.rowDeclined
        : item.hasRequest
          ? styles.rowRequested
          : null;

  const requestBtnStyle = [
    styles.requestButton,
    item.requestOutcome === 'accepted' && styles.requestButtonAccepted,
    item.requestOutcome === 'declined' && styles.requestButtonDeclined,
    item.hasRequest && !item.requestOutcome && styles.requestButtonDisabled,
  ];
  const requestTextStyle = [
    styles.requestButtonText,
    item.requestOutcome === 'accepted' && styles.requestButtonTextAccepted,
    item.requestOutcome === 'declined' && styles.requestButtonTextDeclined,
    item.hasRequest && !item.requestOutcome && styles.requestButtonTextDisabled,
  ];

  return (
    <TouchableOpacity
      style={[styles.card, rowHighlight]}
      activeOpacity={0.8}
      onPress={() => onOpenDetails(item)}
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
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
          <Text style={[styles.badgeText, { color: badgeStyle.text }]} numberOfLines={1}>
            {item.company || item.tier}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={requestBtnStyle}
        activeOpacity={0.85}
        onPress={(e) => {
          e.stopPropagation();
          if (!requestDisabled) onOpenRequest(item);
        }}
        disabled={requestDisabled}
      >
        <Text style={requestTextStyle}>{requestLabel}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

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
  const isSponsor = loginType === 'sponsor';
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { selectedEventDateFrom, selectedEventDateTo, selectedEventId } = useAppSelector((state) => state.event);

  const rawEventId = user?.event_id ?? user?.events?.[0]?.id ?? selectedEventId ?? 27;
  const eventId =
    typeof rawEventId === 'number' && Number.isFinite(rawEventId) && rawEventId > 0
      ? rawEventId
      : Number(rawEventId) || 27;

  // Fetch delegates (for delegate login)
  const { data: delegatesData, isLoading: delegatesLoading, error: delegatesError } = useGetAllDelegatesQuery(undefined, {
    skip: !isAuthenticated || !user || !isDelegate,
  });

  // Fetch event sponsors (for sponsor login)
  const { data: sponsorsData, isLoading: sponsorsLoading, error: sponsorsError } = useGetEventSponsorQuery(eventId, {
    skip: !isAuthenticated || !user || !isSponsor || !eventId,
  });

  const {
    data: delegateOutcomesData,
    refetch: refetchDelegateOutcomes,
  } = useGetDelegateMeetingRequestOutcomesQuery(
    { event_id: eventId },
    { skip: !isAuthenticated || !user || !isDelegate, refetchOnMountOrArgChange: true }
  );
  const {
    data: sponsorOutcomesData,
    refetch: refetchSponsorOutcomes,
  } = useGetSponsorMeetingRequestOutcomesQuery(
    { event_id: eventId },
    { skip: !isAuthenticated || !user || isDelegate, refetchOnMountOrArgChange: true }
  );
  const meetingOutcomesData = isDelegate ? delegateOutcomesData : sponsorOutcomesData;
  const refetchMeetingOutcomes = isDelegate ? refetchDelegateOutcomes : refetchSponsorOutcomes;

  const [createDelegateMeetingRequest] = useSendDelegateMeetingRequestMutation();
  const [createSponsorMeetingRequest] = useSendSponsorMeetingRequestMutation();
  const createMeetingRequest = isDelegate ? createDelegateMeetingRequest : createSponsorMeetingRequest;

  const [locallyRequestedIds, setLocallyRequestedIds] = useState([]);
  const [localPriorityMap, setLocalPriorityMap] = useState({});
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState('1st');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isRequestSuccess, setIsRequestSuccess] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [modalStep, setModalStep] = useState('priority');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [meetingTimesParams, setMeetingTimesParams] = useState(null);
  
  // Combine loading and error states
  const isLoading = isDelegate ? delegatesLoading : sponsorsLoading;
  const error = isDelegate ? delegatesError : sponsorsError;
  
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return isDelegate ? 'Failed to load delegates.' : 'Failed to load sponsors.';
  }, [error, isDelegate]);

  useFocusEffect(
    useCallback(() => {
      refetchMeetingOutcomes();
    }, [refetchMeetingOutcomes])
  );

  const attendeeOutcomeMap = useMemo(() => {
    const list = extractOutcomesList(meetingOutcomesData);
    const map = new Map();
    list.forEach((row) => {
      const id = isDelegate
        ? Number(row?.sponsor_id ?? row?.sponsorId ?? row?.sponsorID ?? row?.sponsor_user_id)
        : Number(row?.delegate_id ?? row?.delegateId ?? row?.delegateID ?? row?.user_id);
      if (!Number.isFinite(id)) return;
      const acceptRaw = row?.is_accepted ?? row?.isAccepted;
      const flag =
        acceptRaw != null && acceptRaw !== ''
          ? normalizeOutcomeAccepted(acceptRaw)
          : normalizeOutcomeAccepted(row?.status);
      if (flag != null) {
        map.set(id, flag);
        map.set(String(id), flag);
      }
    });
    return map;
  }, [meetingOutcomesData, isDelegate]);

  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const meetingDate = useMemo(() => {
    const raw = selectedEventDateFrom;
    if (!raw) return todayDate;
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return todayDate;
  }, [selectedEventDateFrom, todayDate]);

  const {
    data: delegateMeetingTimesData,
    isLoading: delegateMeetingTimesLoading,
  } = useGetDelegateMeetingTimesQuery(meetingTimesParams || {}, {
    skip: !isAuthenticated || !user || !isDelegate || !meetingTimesParams,
  });

  const {
    data: sponsorMeetingTimesData,
    isLoading: sponsorMeetingTimesLoading,
  } = useGetSponsorMeetingTimesQuery(meetingTimesParams || {}, {
    skip: !isAuthenticated || !user || isDelegate || !meetingTimesParams,
  });

  const meetingTimesData = isDelegate ? delegateMeetingTimesData : sponsorMeetingTimesData;
  const meetingTimesLoading = isDelegate ? delegateMeetingTimesLoading : sponsorMeetingTimesLoading;

  const meetingSlotGroups = useMemo(() => {
    if (!meetingTimesData) return [];

    const normalized =
      meetingTimesData?.data &&
      typeof meetingTimesData.data === 'object' &&
      !Array.isArray(meetingTimesData.data) &&
      meetingTimesData.data?.data &&
      typeof meetingTimesData.data.data === 'object'
        ? meetingTimesData.data
        : meetingTimesData;

    const formatDateDDMMYYYY = (yyyyMmDd) => {
      if (!yyyyMmDd) return '';
      const [y, m, d] = String(yyyyMmDd).slice(0, 10).split('-');
      if (!y || !m || !d) return String(yyyyMmDd);
      return `${d}-${m}-${y}`;
    };

    const pickTimePart = (value) => {
      if (!value) return '';
      const s = String(value);
      if (s.includes(' ')) return s.split(' ')[1] || s;
      return s;
    };

    const toHHMM = (hhmmss) => {
      const s = String(hhmmss || '');
      return s.length >= 5 ? s.slice(0, 5) : s;
    };

    const dataObj = normalized?.data;
    if (dataObj && typeof dataObj === 'object' && !Array.isArray(dataObj)) {
      const dates = Array.isArray(normalized?.dates)
        ? normalized.dates
        : Object.keys(dataObj || {});

      return (dates || [])
        .map((dateKey) => {
          const rawSlots = dataObj?.[dateKey] || [];
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
                toFull,
              };
            })
            .filter(Boolean);

          return { date: dateKey, dateLabel: formatDateDDMMYYYY(dateKey), items };
        })
        .filter((g) => g.items.length > 0);
    }

    const arr = Array.isArray(normalized?.data)
      ? normalized.data
      : Array.isArray(normalized)
        ? normalized
        : Array.isArray(normalized?.data?.data)
          ? normalized.data.data
          : [];

    const items = arr
      .map((slot) => {
        const fromFull = pickTimePart(slot?.meeting_from);
        const toFull = pickTimePart(slot?.meeting_to);
        const from = toHHMM(fromFull);
        const to = toHHMM(toFull);
        if (!from || !to) {
          const rawTime = slot?.time || slot?.time_slot || slot?.label || null;
          if (!rawTime) return null;
          const t = pickTimePart(rawTime);
          return { id: slot?.id ?? rawTime, date: meetingDate, from: toHHMM(t), to: '', fromFull: t };
        }
        return {
          id: slot?.id ?? `${meetingDate}-${fromFull}-${toFull}`,
          date: meetingDate,
          from,
          to,
          fromFull,
          toFull,
        };
      })
      .filter(Boolean);

    return items.length ? [{ date: meetingDate, dateLabel: formatDateDDMMYYYY(meetingDate), items }] : [];
  }, [meetingTimesData, meetingDate]);

  const requestedAttendeeIds = useMemo(
    () => new Set(locallyRequestedIds.filter((id) => Number.isFinite(id))),
    [locallyRequestedIds]
  );

  const attendeePriorityMap = useMemo(() => {
    const map = new Map();
    Object.entries(localPriorityMap || {}).forEach(([id, text]) => {
      const n = Number(id);
      if (Number.isFinite(n) && text) map.set(n, text);
    });
    return map;
  }, [localPriorityMap]);

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

  // Map API sponsors to the sponsor card shape
  const sponsors = useMemo(() => {
    if (!isSponsor || !sponsorsData) return [];
    const list = Array.isArray(sponsorsData?.data) ? sponsorsData.data : Array.isArray(sponsorsData) ? sponsorsData : [];
    return list.map((s) => {
      const name = s.name || s.full_name || 'Unknown';
      const initials = name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase())
        .slice(0, 2)
        .join('') || 'SP';
      const sponsorId = String(s.id);
      const logoBg = getColorFromString(sponsorId, LOGO_COLORS);
      const badgeColor = getColorFromString(sponsorId + name, BADGE_COLORS);
      
      // Determine tier based on company or use default
      const tier = s.company ? 'Sponsor' : 'Event Sponsor';
      
      return {
        id: sponsorId,
        name,
        tier,
        logoBg,
        logoText: initials,
        image: s.image || null,
        partnerType: s.job_title || '',
        email: s.email || '',
        phone: s.mobile || s.tel || '',
        website: '',
        location: '',
        about: s.biography || s.company_information || '',
        company: s.company || '',
        badgeColor,
        raw: s,
      };
    });
  }, [isSponsor, sponsorsData]);

  const filteredSponsors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const baseList = isDelegate ? delegates : isSponsor ? sponsors : SPONSORS;
    if (!q) return baseList;
    return baseList.filter((sponsor) => sponsor.name.toLowerCase().includes(q));
  }, [searchQuery, isDelegate, isSponsor, delegates, sponsors]);

  const listWithMeetingState = useMemo(() => {
    return filteredSponsors.map((item) => {
      const attendee = item.raw ? { ...item, ...item.raw } : item;
      const numericId = Number(item.id ?? item.raw?.id) || Number(item.id);
      const outcomeFlag =
        pickOutcomeFlag(attendeeOutcomeMap, attendee, isDelegate) ??
        (Number.isFinite(numericId)
          ? attendeeOutcomeMap.get(numericId) ?? attendeeOutcomeMap.get(String(numericId))
          : null);
      const requestOutcome =
        outcomeFlag === 1 ? 'accepted' : outcomeFlag === 2 ? 'declined' : null;
      const hasLocalRequest = Number.isFinite(numericId) && locallyRequestedIds.includes(numericId);
      const mappedPriorityText = attendeePriorityMap.get(numericId) || null;
      const priorityText = localPriorityMap[numericId] || mappedPriorityText || null;
      const hasPendingRequest =
        !requestOutcome && (hasLocalRequest || requestedAttendeeIds.has(numericId));

      return {
        ...item,
        hasRequest: hasPendingRequest,
        requestOutcome,
        priorityText,
      };
    });
  }, [
    filteredSponsors,
    attendeeOutcomeMap,
    isDelegate,
    locallyRequestedIds,
    localPriorityMap,
    attendeePriorityMap,
    requestedAttendeeIds,
  ]);

  const openModal = useCallback(
    (attendee) => {
      const attendeeId = attendee?.id ? Number(attendee.id) : null;
      const existingPriority = attendeeId ? attendeePriorityMap.get(attendeeId) : null;
      setSelectedPriority(existingPriority || '1st');
      setSelectedAttendee(attendee);
      setIsSendingRequest(false);
      setIsRequestSuccess(false);
      setSelectedTimeSlot(null);
      setModalStep('priority');
      setIsModalVisible(true);
    },
    [attendeePriorityMap]
  );

  const closeModal = useCallback(() => {
    setIsModalVisible(false);
    setIsSendingRequest(false);
    setIsRequestSuccess(false);
    setSelectedTimeSlot(null);
    setModalStep('priority');
  }, []);

  useEffect(() => {
    if (isModalVisible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else if (selectedAttendee) {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setSelectedAttendee(null);
      });
    }
  }, [isModalVisible, modalAnim, selectedAttendee]);

  const openTimeModal = useCallback(() => {
    if (!selectedAttendee) return;

    const raw = Number(eventId);
    const effectiveEventId = Number.isFinite(raw) && raw > 0 ? raw : 27;
    const date = meetingDate;
    const dateFrom = selectedEventDateFrom ? String(selectedEventDateFrom).slice(0, 10) : null;
    const dateTo = selectedEventDateTo ? String(selectedEventDateTo).slice(0, 10) : null;

    const timeParams = { event_id: effectiveEventId, date };
    if (dateFrom && dateTo) {
      timeParams.date_from = dateFrom;
      timeParams.date_to = dateTo;
      if (isDelegate && selectedAttendee?.id) timeParams.target_sponsor_id = Number(selectedAttendee.id);
      if (!isDelegate && selectedAttendee?.id) timeParams.target_delegate_id = Number(selectedAttendee.id);
    }

    setMeetingTimesParams(timeParams);
    setSelectedTimeSlot(null);
    setModalStep('time');
  }, [selectedAttendee, eventId, meetingDate, selectedEventDateFrom, selectedEventDateTo, isDelegate]);

  const closeTimeModal = useCallback(() => {
    setModalStep('priority');
  }, []);

  const getDefaultSlot = useCallback(() => {
    const d = meetingTimesParams?.date || meetingDate || todayDate;
    return {
      date: d,
      from: '09:00',
      to: '09:30',
      fromFull: '09:00:00',
      toFull: '09:30:00',
    };
  }, [meetingTimesParams?.date, meetingDate, todayDate]);

  const handleSendMeetingRequest = async (slot) => {
    if (!selectedAttendee) return;

    try {
      if (!selectedAttendee.id) {
        Alert.alert('Error', `Invalid ${isDelegate ? 'sponsor' : 'delegate'} ID`);
        return;
      }

      setIsSendingRequest(true);
      setIsRequestSuccess(false);

      const priorityMap = { '1st': 1, '2nd': 2, '3rd': 3 };
      const priorityValue = priorityMap[selectedPriority] || 1;

      const effectiveSlot = slot || getDefaultSlot();
      const meetingDateVal = effectiveSlot?.date || meetingTimesParams?.date || meetingDate || todayDate;
      const meetingTimeFrom = effectiveSlot?.fromFull || (effectiveSlot?.from ? `${effectiveSlot.from}:00` : null);
      const meetingTimeTo = effectiveSlot?.toFull || (effectiveSlot?.to ? `${effectiveSlot.to}:00` : null);

      if (!meetingTimeFrom || !meetingTimeTo) {
        Alert.alert('Error', 'Please select a valid time slot');
        setIsSendingRequest(false);
        return;
      }

      const requestData = isDelegate
        ? {
            sponsor_id: Number(selectedAttendee.id),
            event_id: Number(eventId || 27),
            priority: priorityValue,
            meeting_date: meetingDateVal,
            meeting_time_from: meetingTimeFrom,
            meeting_time_to: meetingTimeTo,
            message: '',
          }
        : {
            delegate_id: Number(selectedAttendee.id),
            event_id: Number(eventId || 27),
            priority: priorityValue,
            meeting_date: meetingDateVal,
            meeting_time_from: meetingTimeFrom,
            meeting_time_to: meetingTimeTo,
            message: '',
          };

      await createMeetingRequest(requestData).unwrap();

      const numericId = Number(selectedAttendee.id);
      setLocallyRequestedIds((prev) => (prev.includes(numericId) ? prev : [...prev, numericId]));
      setLocalPriorityMap((prev) => ({ ...prev, [numericId]: selectedPriority }));

      setIsSendingRequest(false);
      setIsRequestSuccess(true);
      setModalStep('priority');
      refetchMeetingOutcomes();
    } catch (e) {
      console.error('Error sending meeting request:', e);
      setIsSendingRequest(false);
      setIsRequestSuccess(false);
      Alert.alert('Error', e?.data?.message || e?.message || 'Failed to send meeting request');
    }
  };

  const onOpenDetails = useCallback(
    (item) => {
      router.push({
        pathname: '/sponsor-details',
        params: {
          sponsor: JSON.stringify(item),
          returnTo: 'sponsors',
          eventDateFrom: selectedEventDateFrom || '',
        },
      });
    },
    [selectedEventDateFrom]
  );

  const renderSponsor = useCallback(
    ({ item }) => (
      <SponsorListRow
        item={item}
        SIZES={SIZES}
        styles={styles}
        onOpenDetails={onOpenDetails}
        onOpenRequest={openModal}
      />
    ),
    [SIZES, styles, onOpenDetails, openModal]
  );

  // The content and contentWrap styles are restructured to ensure FlatList fills and scrolls
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
              ? `${listWithMeetingState.length} Delegates found`
              : `${listWithMeetingState.length} Sponsors found`}
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
            data={listWithMeetingState}
            keyExtractor={(item) =>
              `${String(item.id)}-${item.requestOutcome ?? 'n'}-${item.hasRequest ? 'p' : 'o'}`
            }
            renderItem={renderSponsor}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={[
              styles.listContent,
              listWithMeetingState.length === 0 && { flex: 1 },
              { paddingHorizontal: SIZES.paddingHorizontal },
            ]}
            bounces={true}
            style={{ flex: 1, backgroundColor: '#F9FAFB' }}
            keyboardShouldPersistTaps="handled"
            extraData={attendeeOutcomeMap.size}
          />
        )}
      </KeyboardAvoidingView>

      <Modal
        transparent
        animationType="fade"
        visible={isModalVisible || !!selectedAttendee}
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
              {modalStep === 'time' ? (
                <>
                  <TouchableOpacity
                    style={styles.modalHeaderSide}
                    onPress={closeTimeModal}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.closeText}>←</Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle2, styles.modalTitleCenter]}>Select Time Slot</Text>
                  <TouchableOpacity style={styles.modalHeaderSide} onPress={closeModal}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle2}>Send Meeting Request</Text>
                  <TouchableOpacity onPress={closeModal}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {modalStep === 'time' ? (
              <>
                {meetingTimesLoading ? (
                  <View style={styles.loadingContainerModal}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingTextModal}>Loading time slots...</Text>
                  </View>
                ) : meetingSlotGroups.length === 0 ? (
                  <View style={styles.loadingContainerModal}>
                    <Text style={styles.loadingTextModal}>No time slots available.</Text>
                    <Text style={[styles.loadingTextModal, { marginTop: 8, fontSize: 12 }]}>
                      You can still send a request with a default time.
                    </Text>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.primaryButton, { marginTop: 16, opacity: isSendingRequest ? 0.6 : 1 }]}
                      onPress={() => handleSendMeetingRequest(getDefaultSlot())}
                      disabled={isSendingRequest}
                      activeOpacity={0.85}
                    >
                      {isSendingRequest ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Send with Default Time</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton, { marginTop: 8 }]}
                      onPress={closeTimeModal}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Back</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator>
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
                    <View style={styles.separator3} />
                    <View style={styles.modalButtonRow}>
                      <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeTimeModal}>
                        <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Back</Text>
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
              </>
            ) : selectedAttendee && isRequestSuccess ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <MaterialCommunityIcons name="check-circle" size={64} color={colors.primary} />
                </View>
                <Text style={styles.successTitle}>Request Sent Successfully!</Text>
                <Text style={styles.successMessage}>
                  Your meeting request has been sent to {selectedAttendee?.name || 'this attendee'}.
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
            ) : selectedAttendee && isSendingRequest ? (
              <View style={styles.loadingContainerModal}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingTextModal}>Sending request...</Text>
              </View>
            ) : selectedAttendee ? (
              <>
                <View style={styles.modalContactRow}>
                  <View style={styles.modalAvatar}>
                    {selectedAttendee.image ? (
                      <Image source={{ uri: selectedAttendee.image }} style={styles.avatarImage} />
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
                    <Text style={styles.modalContactName}>{selectedAttendee.name}</Text>
                    <Text style={styles.modalContactCompany}>{selectedAttendee.company || '—'}</Text>
                  </View>
                </View>

                <Text style={styles.priorityLabel}>Select Priority</Text>
                <View style={styles.priorityRow}>
                  {['1st', '2nd'].map((level) => {
                    const isActive = selectedPriority === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.priorityChip, isActive && styles.priorityChipActive]}
                        onPress={() => setSelectedPriority(level)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.priorityChipText, isActive && styles.priorityChipTextActive]}>{level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.separator3} />
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.primaryButton]} onPress={openTimeModal} activeOpacity={0.85}>
                    <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Select Time</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
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
  rowAccepted: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  rowDeclined: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  rowRequested: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.6)',
  },
  requestButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 128,
  },
  requestButtonDisabled: {
    backgroundColor: colors.gray200 || '#E5E7EB',
    opacity: 0.7,
  },
  requestButtonAccepted: {
    backgroundColor: '#22C55E',
    opacity: 1,
  },
  requestButtonDeclined: {
    backgroundColor: '#EF4444',
    opacity: 1,
  },
  requestButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: SIZES.body - 1,
    textAlign: 'center',
  },
  requestButtonTextDisabled: {
    color: colors.textMuted || '#6B7280',
  },
  requestButtonTextAccepted: {
    color: colors.white,
  },
  requestButtonTextDeclined: {
    color: colors.white,
  },
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
    paddingBottom: 34,
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
  modalHeaderSide: {
    minWidth: 32,
  },
  modalTitleCenter: {
    flex: 1,
    textAlign: 'center',
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

export default SponsorsScreen;

