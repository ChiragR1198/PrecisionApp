import Icon from '@expo/vector-icons/Feather';
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
  useGetDelegateEventServicesQuery,
  useGetDelegateMeetingRequestOutcomesQuery,
  useGetDelegateMeetingTimesQuery,
  useGetEventSponsorQuery,
  useGetPresenceOnlineQuery,
  useGetSponsorMeetingRequestOutcomesQuery,
  useGetSponsorMeetingTimesQuery,
  useSendDelegateMeetingRequestMutation,
  useSendSponsorMeetingRequestMutation,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';
import { exportCsvNative } from '../../utils/exportCsvNative';
import { normalizeEventIdForApi } from '../../utils/parseEventId';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

const UserIcon = Icons.User;
const ChatIcon = ({ color = colors.icon, size = 24 }) => (
  <MaterialCommunityIcons name="chat" size={size} color={color} />
);

function escapeCsvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build CSV for delegate rows currently shown (filters / sort / online apply). */
function buildDelegatesCsv(rows) {
  const headers = [
    'ID',
    'Name',
    'Company',
    'Job Title',
    'Email',
    'Phone',
    'Website',
    'Location',
    'Online',
    'Meeting request',
  ];
  const lines = [headers.map(escapeCsvField).join(',')];
  for (const item of rows) {
    const meeting =
      item.requestOutcome === 'accepted'
        ? 'Accepted'
        : item.requestOutcome === 'declined'
          ? 'Declined'
          : item.hasRequest
            ? 'Pending'
            : '';
    lines.push(
      [
        item.id,
        item.name,
        item.company ?? '',
        item.partnerType ?? '',
        item.email ?? '',
        item.phone ?? '',
        item.website ?? '',
        item.location ?? '',
        item.isOnline ? 'Yes' : 'No',
        meeting,
      ]
        .map(escapeCsvField)
        .join(',')
    );
  }
  return lines.join('\r\n');
}

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

/** Two-letter initials from company name (Sponsors list avatar fallback). */
function getCompanyInitials(company) {
  const s = String(company || '').trim();
  if (!s) return '·';
  const parts = s.split(/[\s,&]+/).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    const a = parts[0][0] || '';
    const b = parts[1][0] || '';
    return `${a}${b}`.toUpperCase();
  }
  if (s.length >= 2) return s.slice(0, 2).toUpperCase();
  return `${s[0]}`.toUpperCase();
}

const SponsorListRow = React.memo(function SponsorListRow({
  item,
  SIZES,
  styles,
  onOpenDetails,
  onOpenRequest,
  onStartChat,
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

  const [avatarStage, setAvatarStage] = useState(0);
  useEffect(() => {
    setAvatarStage(0);
  }, [item.id, item.companyLogo, item.image]);

  // Prefer person photo, then company logo (if company logo is missing but image exists, image still shows).
  const firstAvatarUri = item.image || item.companyLogo || null;
  const secondAvatarUri =
    item.image && item.companyLogo ? (item.image === firstAvatarUri ? item.companyLogo : item.image) : null;

  const avatarUri =
    avatarStage === 0 ? firstAvatarUri : avatarStage === 1 ? secondAvatarUri : null;

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
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.logoImage}
              resizeMode="cover"
              onError={() => {
                if (avatarStage === 0 && secondAvatarUri) setAvatarStage(1);
                else setAvatarStage(2);
              }}
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
      {/*
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
      */}
      <TouchableOpacity
        style={styles.chatButton}
        activeOpacity={0.7}
        onPress={(e) => {
          e.stopPropagation();
          onStartChat(item);
        }}
      >
        <ChatIcon color={colors.primary} />
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
  const [searchQueryDebounced, setSearchQueryDebounced] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // 'all' | 'online'
  const [sortBy, setSortBy] = useState('Name (A to Z)');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [draftSelectedServices, setDraftSelectedServices] = useState([]);
  const [listCsvExporting, setListCsvExporting] = useState(false);
  const { user } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const isSponsor = loginType === 'sponsor';
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  const currentUserNumericId = useMemo(() => {
    const n = Number(user?.id ?? user?.user_id ?? user?.delegate_id ?? user?.sponsor_id);
    return Number.isFinite(n) ? n : null;
  }, [user]);

  useEffect(() => {
    const t = setTimeout(() => setSearchQueryDebounced(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const { selectedEventDateFrom, selectedEventDateTo, selectedEventId } = useAppSelector((state) => state.event);

  const rawEventId = selectedEventId ?? user?.event_id ?? user?.events?.[0]?.id ?? 27;
  const eventId = normalizeEventIdForApi(rawEventId) ?? 27;

  const { data: presenceOnlineData } = useGetPresenceOnlineQuery(
    { event_id: eventId, window: 120 },
    {
      skip:
        !isAuthenticated ||
        !user ||
        !(isDelegate || isSponsor) ||
        !Number.isFinite(Number(eventId)) ||
        Number(eventId) <= 0,
      pollingInterval: 30000,
    }
  );

  const presenceDelegateSet = useMemo(() => {
    const po = presenceOnlineData?.data ?? {};
    const ids = po.delegate_ids;
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.map((x) => Number(x)).filter(Number.isFinite));
  }, [presenceOnlineData]);

  const presenceSponsorSet = useMemo(() => {
    const po = presenceOnlineData?.data ?? {};
    const ids = po.sponsor_ids;
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.map((x) => Number(x)).filter(Number.isFinite));
  }, [presenceOnlineData]);

  const allDelegatesQueryArg = useMemo(() => {
    if (!isDelegate) return undefined;
    const o = { event_id: eventId };
    if (selectedServices.length > 0) o.services = selectedServices;
    return o;
  }, [isDelegate, eventId, selectedServices]);

  const {
    data: delegateEventServicesData,
    isFetching: delegateServicesFetching,
  } = useGetDelegateEventServicesQuery(eventId, {
    skip:
      !isAuthenticated ||
      !user ||
      !isDelegate ||
      !Number.isFinite(Number(eventId)) ||
      Number(eventId) <= 0,
  });

  // Fetch delegates (for delegate login); optional service filter via API (same as sponsor attendees)
  const { data: delegatesData, isLoading: delegatesLoading, error: delegatesError } = useGetAllDelegatesQuery(
    allDelegatesQueryArg,
    {
      skip: !isAuthenticated || !user || !isDelegate || !allDelegatesQueryArg,
    }
  );

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

  const todayDate = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const meetingDate = useMemo(() => {
    const raw = selectedEventDateFrom;
    if (!raw) return todayDate;
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
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
      const s = String(hhmmss || '').trim();
      // Accept "HH:MM", "HH:MM:SS"
      const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!m) return s;
      let h = Number(m[1]);
      const mm = m[2];
      if (!Number.isFinite(h)) return s;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      const hh = String(h).padStart(2, '0');
      return `${hh}:${mm} ${ampm}`;
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
        filterHeight: getResponsiveValue({ android: 46, ios: 48, tablet: 48, default: 46 }),
        body: getResponsiveValue({ android: 13, ios: 14, tablet: 15, default: 13 }),
        title: getResponsiveValue({ android: 18, ios: 19, tablet: 21, default: 18 }),
        cardHeight: getResponsiveValue({ android: 78, ios: 80, tablet: 86, default: 78 }),
        logoSize: getResponsiveValue({ android: 54, ios: 56, tablet: 60, default: 54 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const openServiceFilter = useCallback(() => {
    setDraftSelectedServices(Array.isArray(selectedServices) ? [...selectedServices] : []);
    setIsFilterOpen(true);
  }, [selectedServices]);

  const applyServiceFilter = useCallback(() => {
    setSelectedServices(Array.isArray(draftSelectedServices) ? [...draftSelectedServices] : []);
    setIsFilterOpen(false);
  }, [draftSelectedServices]);

  const clearDraftServiceFilter = useCallback(() => setDraftSelectedServices([]), []);

  const draftSelectedServiceSet = useMemo(
    () => new Set(Array.isArray(draftSelectedServices) ? draftSelectedServices : []),
    [draftSelectedServices]
  );

  const toggleDraftService = useCallback((opt) => {
    setDraftSelectedServices((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const set = new Set(prevArr);
      if (set.has(opt)) set.delete(opt);
      else set.add(opt);
      return Array.from(set);
    });
  }, []);

  const renderServiceFilterItem = useCallback(
    ({ item: opt }) => {
      const isSelected = draftSelectedServiceSet.has(opt);
      return (
        <TouchableOpacity
          style={[styles.modalItem, isSelected && styles.modalItemActive]}
          activeOpacity={0.9}
          onPress={() => toggleDraftService(opt)}
        >
          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>{opt}</Text>
          {isSelected ? (
            <Icon name="check" size={16} color={colors.primary} />
          ) : (
            <View style={styles.checkboxUnchecked} />
          )}
        </TouchableOpacity>
      );
    },
    [draftSelectedServiceSet, styles, toggleDraftService]
  );

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
      const personInitials =
        name
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0]?.toUpperCase())
          .slice(0, 2)
          .join('') || 'DL';
      const companyInitials = getCompanyInitials(d.company || name);
      const delegateId = String(d.id);
      const logoBg = getColorFromString(delegateId, LOGO_COLORS);
      const badgeColor = getColorFromString(delegateId + name, BADGE_COLORS);
      return {
        id: delegateId,
        name,
        tier: 'Delegate',
        logoBg,
        companyLogo: null,
        logoText: personInitials || companyInitials,
        image: resolveMediaUrl(d.image || d.user_image || d.avatar || d.profile_image || null),
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
    const list = Array.isArray(sponsorsData?.data)
      ? sponsorsData.data
      : Array.isArray(sponsorsData?.data?.data)
        ? sponsorsData.data.data
        : Array.isArray(sponsorsData)
          ? sponsorsData
          : [];
    const filtered = currentUserNumericId != null
      ? list.filter((s) => {
          const id = Number(s?.id);
          if (Number.isFinite(id) && id === currentUserNumericId) return false;
          if (s?.is_current_user === true || s?.is_current_user === 1 || s?.is_current_user === '1') return false;
          return true;
        })
      : list;

    return filtered.map((s) => {
      const name = s.name || s.full_name || 'Unknown';
      const personInitials =
        name
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0]?.toUpperCase())
          .slice(0, 2)
          .join('') || 'SP';
      const companyInitials = getCompanyInitials(s.company || name);
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
        companyLogo: resolveMediaUrl(s.company_logo || s.companyLogo || null),
        logoText: personInitials || companyInitials,
        image: resolveMediaUrl(s.image || s.user_image || s.avatar || s.profile_image || null),
        partnerType: s.job_title || '',
        email: s.email || '',
        phone: s.mobile || s.tel || '',
        website: '',
        location: '',
        about: s.biography || s.company_information || '',
        company: s.company || '',
        company_website_url: s.company_website_url || s.companyWebsiteUrl || '',
        badgeColor,
        raw: s,
      };
    });
  }, [isSponsor, sponsorsData, currentUserNumericId]);

  const SORT_OPTIONS = useMemo(
    () => [
      'Name (A to Z)',
      'Name (Z to A)',
      'Company (A to Z)',
      'Company (Z to A)',
      'Role (A to Z)',
      'Role (Z to A)',
      'Newest',
      'Oldest',
    ],
    []
  );

  const delegateServiceFilterOptions = useMemo(() => {
    if (!isDelegate) return [];
    const raw =
      delegateEventServicesData?.data ??
      delegateEventServicesData?.services ??
      delegateEventServicesData ??
      [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s) => (typeof s === 'string' ? s : s?.name || s?.title || s?.service || ''))
      .filter(Boolean);
  }, [isDelegate, delegateEventServicesData]);

  const filteredBeforeMeeting = useMemo(() => {
    const baseList = isDelegate ? delegates : isSponsor ? sponsors : SPONSORS;

    if (isDelegate) {
      let list = baseList;
      const q = searchQueryDebounced.trim().toLowerCase();
      if (q) {
        list = list.filter((s) => {
          const blob = `${s.name} ${s.company || ''} ${s.partnerType || ''}`.toLowerCase();
          return blob.includes(q);
        });
      }
      const withKeys = list.map((item) => {
        const numericId = Number(item.id);
        const nameKey = String(item.name || '').toLowerCase();
        const companyKey = String(item.company || '').toLowerCase();
        const roleKey = String(item.partnerType || '').toLowerCase();
        const isCurrentUser = currentUserNumericId != null && currentUserNumericId === numericId;
        const inPresence = presenceDelegateSet.has(numericId);
        const isOnline = Boolean(isCurrentUser || inPresence);
        return { ...item, _nameKey: nameKey, _companyKey: companyKey, _roleKey: roleKey, isOnline };
      });
      const sorted = [...withKeys];
      switch (sortBy) {
        case 'Name (Z to A)':
          sorted.sort((a, b) => String(b._nameKey || '').localeCompare(String(a._nameKey || '')));
          break;
        case 'Company (A to Z)':
          sorted.sort((a, b) => String(a._companyKey || '').localeCompare(String(b._companyKey || '')));
          break;
        case 'Company (Z to A)':
          sorted.sort((a, b) => String(b._companyKey || '').localeCompare(String(a._companyKey || '')));
          break;
        case 'Role (A to Z)':
          sorted.sort((a, b) => String(a._roleKey || '').localeCompare(String(b._roleKey || '')));
          break;
        case 'Role (Z to A)':
          sorted.sort((a, b) => String(b._roleKey || '').localeCompare(String(a._roleKey || '')));
          break;
        case 'Newest':
          sorted.sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
          break;
        case 'Oldest':
          sorted.sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
          break;
        case 'Name (A to Z)':
        default:
          sorted.sort((a, b) => String(a._nameKey || '').localeCompare(String(b._nameKey || '')));
          break;
      }
      return sorted.filter((a) => availabilityFilter === 'all' || a.isOnline);
    }
    
    if (isSponsor) {
      let list = baseList;
      const q = searchQueryDebounced.trim().toLowerCase();
      if (q) {
        list = list.filter((s) => {
          const blob = `${s.name} ${s.company || ''} ${s.partnerType || ''}`.toLowerCase();
          return blob.includes(q);
        });
      }

      const withKeys = list.map((item) => {
        const numericId = Number(item.id);
        const nameKey = String(item.name || '').toLowerCase();
        const companyKey = String(item.company || '').toLowerCase();
        const roleKey = String(item.partnerType || '').toLowerCase();
        const isCurrentUser = currentUserNumericId != null && currentUserNumericId === numericId;
        const inPresence = presenceSponsorSet.has(numericId);
        const isOnline = Boolean(isCurrentUser || inPresence);
        return { ...item, _nameKey: nameKey, _companyKey: companyKey, _roleKey: roleKey, isOnline };
      });

      const sorted = [...withKeys];
      switch (sortBy) {
        case 'Name (Z to A)':
          sorted.sort((a, b) => String(b._nameKey || '').localeCompare(String(a._nameKey || '')));
          break;
        case 'Company (A to Z)':
          sorted.sort((a, b) => String(a._companyKey || '').localeCompare(String(b._companyKey || '')));
          break;
        case 'Company (Z to A)':
          sorted.sort((a, b) => String(b._companyKey || '').localeCompare(String(a._companyKey || '')));
          break;
        case 'Role (A to Z)':
          sorted.sort((a, b) => String(a._roleKey || '').localeCompare(String(b._roleKey || '')));
          break;
        case 'Role (Z to A)':
          sorted.sort((a, b) => String(b._roleKey || '').localeCompare(String(a._roleKey || '')));
          break;
        case 'Newest':
          sorted.sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
          break;
        case 'Oldest':
          sorted.sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
          break;
        case 'Name (A to Z)':
        default:
          sorted.sort((a, b) => String(a._nameKey || '').localeCompare(String(b._nameKey || '')));
          break;
      }

      return sorted.filter((a) => availabilityFilter === 'all' || a.isOnline);
    }

    return baseList;
  }, [
    isDelegate,
    isSponsor,
    delegates,
    sponsors,
    searchQueryDebounced,
    sortBy,
    availabilityFilter,
    presenceDelegateSet,
    presenceSponsorSet,
    currentUserNumericId,
  ]);

  const listWithMeetingState = useMemo(() => {
    return filteredBeforeMeeting.map((item) => {
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
      const hasServerRequest = Boolean(attendee?.hasRequest);
      const rawServerMeetingId = attendee?.meetingId ?? attendee?.meeting_id;
      const hasServerMeetingId =
        rawServerMeetingId !== null &&
        rawServerMeetingId !== undefined &&
        rawServerMeetingId !== '' &&
        Number.isFinite(Number(rawServerMeetingId));
      const serverMeetingStatus = attendee?.meetingStatus ?? attendee?.meeting_status;
      const serverMeetingAccepted = attendee?.is_accepted ?? attendee?.meeting_is_accepted;
      const hasServerPendingFromMeetingFields =
        (hasServerMeetingId || (serverMeetingStatus != null && serverMeetingStatus !== '')) &&
        (serverMeetingAccepted == null || serverMeetingAccepted === '' || String(serverMeetingAccepted).toUpperCase() === 'NULL');
      const mappedPriorityText = attendeePriorityMap.get(numericId) || null;
      const backendPriorityText =
        typeof attendee?.priorityText === 'string' && attendee.priorityText.trim() !== ''
          ? attendee.priorityText.trim()
          : (Number(attendee?.priority ?? attendee?.meeting_priority) === 1
              ? '1st'
              : Number(attendee?.priority ?? attendee?.meeting_priority) === 2
                ? '2nd'
                : null);
      const priorityText = localPriorityMap[numericId] || mappedPriorityText || backendPriorityText || null;
      const hasPendingRequest =
        !requestOutcome &&
        (
          hasLocalRequest ||
          requestedAttendeeIds.has(numericId) ||
          hasServerRequest ||
          hasServerPendingFromMeetingFields
        );

      return {
        ...item,
        hasRequest: hasPendingRequest,
        requestOutcome,
        priorityText,
      };
    });
  }, [
    filteredBeforeMeeting,
    attendeeOutcomeMap,
    isDelegate,
    locallyRequestedIds,
    localPriorityMap,
    attendeePriorityMap,
    requestedAttendeeIds,
  ]);

  const handleDownloadListCsv = useCallback(async () => {
    if (!isDelegate && !isSponsor) return;
    const rows = listWithMeetingState;
    if (!rows.length) {
      Alert.alert(
        'No data',
        isDelegate ? 'There are no delegates to export.' : 'There are no sponsors to export.'
      );
      return;
    }
    const prefix = isDelegate ? 'delegates' : 'sponsors';
    const safeName = `${prefix}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    const dialogTitle = isDelegate ? 'Export delegates' : 'Export sponsors';
    try {
      setListCsvExporting(true);
      const csvBody = buildDelegatesCsv(rows);
      await exportCsvNative({
        csvBody,
        fileName: safeName,
        fallbackDialogTitle: dialogTitle,
      });
    } catch (e) {
      console.error('SponsorsScreen CSV export:', e);
      Alert.alert('Export failed', e?.message || 'Could not create the CSV file.');
    } finally {
      setListCsvExporting(false);
    }
  }, [isDelegate, isSponsor, listWithMeetingState]);

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
          ...(isDelegate && selectedServices.length > 0
            ? { delegateServicesFilter: JSON.stringify(selectedServices) }
            : {}),
        },
      });
    },
    [selectedEventDateFrom, isDelegate, selectedServices]
  );

  const onStartChat = useCallback(
    (item) => {
      const itemId = item?.id || item?.raw?.id;
      if (!itemId) {
        Alert.alert('Error', 'Invalid user information');
        return;
      }

      const recipientType = isDelegate ? 'delegate' : 'sponsor';
      const thread = {
        id: String(itemId),
        user_id: Number(itemId),
        user_type: recipientType,
        name: item?.name,
        user_name: item?.name,
        avatar: item?.image,
        user_image: item?.image,
        company: item?.company,
        email: item?.email,
      };

      router.push({
        pathname: '/message-detail',
        params: {
          thread: JSON.stringify(thread),
          returnTo: 'sponsors',
          returnItem: JSON.stringify(item),
        },
      });
    },
    [isDelegate]
  );

  const renderSponsor = useCallback(
    ({ item }) => (
      <SponsorListRow
        item={item}
        SIZES={SIZES}
        styles={styles}
        onOpenDetails={onOpenDetails}
        onOpenRequest={openModal}
        onStartChat={onStartChat}
      />
    ),
    [SIZES, styles, onOpenDetails, openModal, onStartChat]
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
        {isDelegate ? (
          <>
            <View style={styles.content}>
              <View style={styles.searchRow}>
                <View style={styles.searchBarWrapper}>
                  <SearchBar
                    placeholder="Search delegates..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchBarInline}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.filterIconBtn,
                    selectedServices.length > 0 && styles.filterIconBtnActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={openServiceFilter}
                >
                  <Icon name="filter" size={18} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.filterIconBtn}
                  activeOpacity={0.8}
                  onPress={() => setIsSortOpen(true)}
                >
                  <Icon name="sliders" size={18} color={colors.white} />
                </TouchableOpacity>
              </View>

              <View style={styles.advancedFiltersRow}>
                <Text style={styles.advancedFiltersLabel}>Status</Text>
                <View style={styles.advancedFiltersChips}>
                  {['all', 'online'].map((key) => {
                    const isActive = availabilityFilter === key;
                    const label = key === 'all' ? 'All' : 'Online';
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                        activeOpacity={0.8}
                        onPress={() => setAvailabilityFilter(key)}
                      >
                        <Text
                          style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.countRow}>
                <View style={styles.countRowLeft}>
                  <View style={styles.countDot} />
                  <Text style={styles.countLineText} numberOfLines={1}>
                    {`${String(listWithMeetingState.length)} DELEGATES`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.downloadCsvBtn,
                    (listCsvExporting || listWithMeetingState.length === 0) && styles.downloadCsvBtnDisabled,
                  ]}
                  onPress={handleDownloadListCsv}
                  disabled={listCsvExporting || listWithMeetingState.length === 0}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Download delegates as CSV"
                >
                  {listCsvExporting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Icon name="download" size={16} color={colors.primary} />
                      <Text style={styles.downloadCsvText}>CSV</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
                extraData={[sortBy, availabilityFilter, selectedServices, attendeeOutcomeMap.size]}
              />
            )}
          </>
        ) : (
          <>
            <View style={styles.content}>
              <View style={styles.searchRow}>
                <View style={styles.searchBarWrapper}>
                  <SearchBar
                    placeholder="Search sponsors..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchBarInline}
                  />
                </View>
                <TouchableOpacity
                  style={styles.filterIconBtn}
                  activeOpacity={0.8}
                  onPress={() => setIsSortOpen(true)}
                >
                  <Icon name="sliders" size={18} color={colors.white} />
                </TouchableOpacity>
              </View>

              <View style={styles.advancedFiltersRow}>
                <Text style={styles.advancedFiltersLabel}>Status</Text>
                <View style={styles.advancedFiltersChips}>
                  {['all', 'online'].map((key) => {
                    const isActive = availabilityFilter === key;
                    const label = key === 'all' ? 'All' : 'Online';
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                        activeOpacity={0.8}
                        onPress={() => setAvailabilityFilter(key)}
                      >
                        <Text
                          style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.countRow}>
                <View style={styles.countRowLeft}>
                  <View style={styles.countDot} />
                  <Text style={styles.countLineText} numberOfLines={1}>
                    {`${String(listWithMeetingState.length)} SPONSORS`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.downloadCsvBtn,
                    (listCsvExporting || listWithMeetingState.length === 0) && styles.downloadCsvBtnDisabled,
                  ]}
                  onPress={handleDownloadListCsv}
                  disabled={listCsvExporting || listWithMeetingState.length === 0}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Download sponsors as CSV"
                >
                  {listCsvExporting ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Icon name="download" size={16} color={colors.primary} />
                      <Text style={styles.downloadCsvText}>CSV</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
                extraData={[sortBy, availabilityFilter, attendeeOutcomeMap.size]}
              />
            )}
          </>
        )}
      </KeyboardAvoidingView>

      {(isDelegate || isSponsor) ? (
        <>
          <Modal
            transparent
            animationType="fade"
            visible={isDelegate && isFilterOpen}
            onRequestClose={() => setIsFilterOpen(false)}
          >
            <View style={styles.filterModalBackdrop}>
              <TouchableOpacity style={styles.filterModalBackdropPressable} activeOpacity={1} onPress={() => setIsFilterOpen(false)} />
              <View style={styles.filterModalCenterWrap}>
                <View style={styles.filterModalCard}>
                  <Text style={styles.filterModalTitle}>Select Service</Text>
                  {delegateServicesFetching && delegateServiceFilterOptions.length === 0 ? (
                    <View style={styles.filterModalEmpty}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.filterModalEmptyText, { marginTop: 12 }]}>Loading services...</Text>
                    </View>
                  ) : delegateServiceFilterOptions.length === 0 ? (
                    <View style={styles.filterModalEmpty}>
                      <Text style={styles.filterModalEmptyText}>No services available</Text>
                    </View>
                  ) : (
                    <FlatList
                      style={styles.filterModalList}
                      contentContainerStyle={styles.filterModalListContent}
                      data={delegateServiceFilterOptions}
                      keyExtractor={(opt) => String(opt)}
                      renderItem={renderServiceFilterItem}
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="handled"
                      initialNumToRender={12}
                      maxToRenderPerBatch={12}
                      windowSize={7}
                      extraData={draftSelectedServices}
                    />
                  )}
                  <View style={styles.filterModalButtonRow}>
                    {draftSelectedServices.length > 0 && (
                      <TouchableOpacity
                        onPress={clearDraftServiceFilter}
                        activeOpacity={0.8}
                        style={[styles.filterModalBtn, styles.filterModalBtnClear]}
                      >
                        <Text style={[styles.filterModalBtnText, styles.filterModalBtnTextClear]}>Clear All</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={applyServiceFilter} activeOpacity={0.8} style={styles.filterModalBtn}>
                      <Text style={styles.filterModalBtnText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
          <Modal transparent animationType="fade" visible={isSortOpen} onRequestClose={() => setIsSortOpen(false)}>
            <View style={styles.filterModalBackdrop}>
              <TouchableOpacity style={styles.filterModalBackdropPressable} activeOpacity={1} onPress={() => setIsSortOpen(false)} />
              <View style={styles.filterModalCenterWrap}>
                <View style={styles.filterModalCard}>
                  <Text style={styles.filterModalTitle}>Sort By</Text>
                  <ScrollView
                    style={styles.filterModalList}
                    contentContainerStyle={styles.filterModalListContent}
                    showsVerticalScrollIndicator
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.modalItem, sortBy === opt && styles.modalItemActive]}
                        activeOpacity={0.9}
                        onPress={() => {
                          setSortBy(opt);
                          setIsSortOpen(false);
                        }}
                      >
                        <Text style={[styles.modalItemText, sortBy === opt && styles.modalItemTextActive]}>{opt}</Text>
                        {sortBy === opt ? (
                          <Icon name="check" size={16} color={colors.primary} />
                        ) : (
                          <View />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity onPress={() => setIsSortOpen(false)} activeOpacity={0.8} style={styles.filterModalBtn}>
                    <Text style={styles.filterModalBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      ) : null}

      {/*
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
      */}
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
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  searchBarWrapper: {
    flex: 1,
    height: SIZES.filterHeight,
  },
  searchBarInline: {
    height: SIZES.filterHeight,
  },
  filterIconBtn: {
    width: SIZES.filterHeight,
    height: SIZES.filterHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconBtnActive: {
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.white,
  },
  advancedFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  advancedFiltersLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  advancedFiltersChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChip: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 14,
    gap: 10,
  },
  countRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  downloadCsvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  downloadCsvBtnDisabled: {
    opacity: 0.45,
  },
  downloadCsvText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  countDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  countLineText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  countText: {
    fontSize: SIZES.body + 2,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 16,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemActive: {
    backgroundColor: 'transparent',
  },
  modalItemText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.text,
  },
  modalItemTextActive: {
    color: colors.primary,
  },
  checkboxUnchecked: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  filterModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalBackdropPressable: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  filterModalCenterWrap: {
    width: '100%',
    paddingHorizontal: 24,
  },
  filterModalCard: {
    alignSelf: 'center',
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    maxWidth: isTablet ? 560 : 480,
  },
  filterModalTitle: {
    fontSize: SIZES.title - 3,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  filterModalList: {
    maxHeight: isTablet ? 460 : 360,
  },
  filterModalListContent: {
    paddingVertical: 6,
  },
  filterModalEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  filterModalEmptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  filterModalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  filterModalBtn: {
    flex: 1,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(138, 52, 144, 0.12)',
    alignItems: 'center',
  },
  filterModalBtnClear: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  filterModalBtnText: {
    color: colors.primary,
    fontWeight: '600',
  },
  filterModalBtnTextClear: {
    color: '#EF4444',
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
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.white,
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
  chatButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    paddingVertical: 6,
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

