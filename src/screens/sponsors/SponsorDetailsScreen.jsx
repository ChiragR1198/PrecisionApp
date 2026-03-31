import AntDesign from '@expo/vector-icons/AntDesign';
import Icon from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Octicons from '@expo/vector-icons/Octicons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
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
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import {
  useGetDelegateAttendeesQuery,
  useGetDelegateMeetingRequestOutcomesQuery,
  useGetDelegateMeetingTimesQuery,
  useGetSponsorAllAttendeesQuery,
  useGetSponsorMeetingRequestOutcomesQuery,
  useGetSponsorMeetingTimesQuery,
  useSendDelegateMeetingRequestMutation,
  useSendDelegateMeetingRequestToDelegateMutation,
  useSendSponsorMeetingRequestMutation,
  useSendSponsorMeetingRequestToSponsorMutation,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const meetingRed = '#DC2626';

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

const MailIcon = ({ color = colors.primary, size = 22 }) => (
  <MaterialIcons name="email" size={size} color={color} />
);

const PhoneIcon = ({ color = colors.primary, size = 18 }) => (
  <FontAwesome5 name="phone-alt" size={size} color={color} />
);

const PhoneIcon2 = ({ color = colors.textMuted, size = 20 }) => (
  <Icon name="phone" size={size} color={color} />
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

const BuildingIcon = ({ color = colors.white, size = 18 }) => (
  <MaterialIcons name="business" size={size} color={color} />
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
  const insets = useSafeAreaInsets();
  const { user } = useAppSelector((state) => state.auth);
  const { selectedEventDateFrom, selectedEventDateTo, selectedEventId } = useAppSelector((state) => state.event);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const [priority, setPriority] = useState('1st');
  const [hasRequested, setHasRequested] = useState(false);
  const [requestedPriorityText, setRequestedPriorityText] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isRequestSuccess, setIsRequestSuccess] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [modalStep, setModalStep] = useState('priority');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [meetingTimesParams, setMeetingTimesParams] = useState(null);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [createDelegateMeetingRequest] = useSendDelegateMeetingRequestMutation();
  const [createDelegateMeetingRequestToDelegate] = useSendDelegateMeetingRequestToDelegateMutation();
  const [createSponsorMeetingRequest] = useSendSponsorMeetingRequestMutation();
  const [createSponsorMeetingRequestToSponsor] = useSendSponsorMeetingRequestToSponsorMutation();
  // Actual mutation selection depends on whether we are viewing a sponsor or delegate profile.
  // We do that inside `handleSendMeetingRequest()` (after `isDelegateProfile` is computed).

  const rawEventId = user?.event_id ?? user?.events?.[0]?.id ?? selectedEventId ?? 27;
  const eventId =
    typeof rawEventId === 'number' && Number.isFinite(rawEventId) && rawEventId > 0
      ? rawEventId
      : Number(rawEventId) || 27;

  const {
    data: delegateOutcomesData,
    refetch: refetchDelegateOutcomes,
  } = useGetDelegateMeetingRequestOutcomesQuery(
    { event_id: eventId },
    { skip: !user || !isDelegate, refetchOnMountOrArgChange: true }
  );
  const {
    data: sponsorOutcomesData,
    refetch: refetchSponsorOutcomes,
  } = useGetSponsorMeetingRequestOutcomesQuery(
    { event_id: eventId },
    { skip: !user || isDelegate, refetchOnMountOrArgChange: true }
  );
  const meetingOutcomesData = isDelegate ? delegateOutcomesData : sponsorOutcomesData;
  const refetchMeetingOutcomes = isDelegate ? refetchDelegateOutcomes : refetchSponsorOutcomes;

  useFocusEffect(
    useCallback(() => {
      refetchMeetingOutcomes();
    }, [refetchMeetingOutcomes])
  );

  const {
    data: delegateMeetingTimesData,
    isLoading: delegateMeetingTimesLoading,
  } = useGetDelegateMeetingTimesQuery(meetingTimesParams || {}, {
    skip: !user || !isDelegate || !meetingTimesParams,
  });

  const {
    data: sponsorMeetingTimesData,
    isLoading: sponsorMeetingTimesLoading,
  } = useGetSponsorMeetingTimesQuery(meetingTimesParams || {}, {
    skip: !user || isDelegate || !meetingTimesParams,
  });

  const meetingTimesData = isDelegate ? delegateMeetingTimesData : sponsorMeetingTimesData;
  const meetingTimesLoading = isDelegate ? delegateMeetingTimesLoading : sponsorMeetingTimesLoading;

  const defaultSponsor = useMemo(
    () => ({
      id: '',
      name: '',
      tier: '',
      logoBg: null,
      logoText: '',
      partnerType: '',
      email: '',
      phone: '',
      website: '',
      location: '',
      about: '',
      company: '',
      job_title: '',
      raw: {},
    }),
    []
  );

  // Use attendees directory to resolve full contact information when navigated from chat
  const { data: delegateAttendeesData } = useGetDelegateAttendeesQuery(undefined, {
    skip: !user || !isDelegate,
    refetchOnMountOrArgChange: true,
  });
  const { data: sponsorAllAttendeesData } = useGetSponsorAllAttendeesQuery(undefined, {
    skip: !user || isDelegate,
    refetchOnMountOrArgChange: true,
  });

  const sponsorFromParams = useMemo(() => {
    if (!params?.sponsor) return null;
    try {
      const parsed = JSON.parse(params.sponsor);
      return { ...defaultSponsor, ...parsed };
    } catch {
      return null;
    }
  }, [params?.sponsor, defaultSponsor]);

  const numericTargetId = useMemo(() => {
    const base = sponsorFromParams || defaultSponsor;
    return Number(base?.id ?? base?.raw?.id) || null;
  }, [sponsorFromParams, defaultSponsor]);

  const resolvedSponsorFromDirectory = useMemo(() => {
    if (!Number.isFinite(numericTargetId)) return null;

    const source = isDelegate ? delegateAttendeesData : sponsorAllAttendeesData;
    const list = Array.isArray(source?.data) ? source.data : Array.isArray(source) ? source : [];

    const findId = (row) => {
      const candidates = [
        row?.id,
        row?.user_id,
        row?.sponsor_id,
        row?.delegate_id,
        row?.member_id,
      ];
      for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n === numericTargetId) return n;
      }
      return null;
    };

    const match = list.find((row) => findId(row) === numericTargetId);
    if (!match) return null;

    const name =
      match?.name ||
      match?.user_name ||
      match?.full_name ||
      [match?.fname, match?.lname].filter(Boolean).join(' ') ||
      sponsorFromParams?.name ||
      '';

    const normalized = {
      id: String(numericTargetId),
      name,
      image: match?.image || match?.user_image || match?.avatar || sponsorFromParams?.image || null,
      company: match?.company || sponsorFromParams?.company || '',
      job_title: match?.job_title || match?.title || sponsorFromParams?.job_title || '',
      email: match?.email || sponsorFromParams?.email || '',
      phone: match?.mobile || match?.phone || sponsorFromParams?.phone || '',
      website: match?.website || match?.web || sponsorFromParams?.website || '',
      location: match?.address || match?.location || sponsorFromParams?.location || '',
      raw: match,
    };

    return normalized;
  }, [
    delegateAttendeesData,
    sponsorAllAttendeesData,
    isDelegate,
    numericTargetId,
    sponsorFromParams?.name,
    sponsorFromParams?.image,
    sponsorFromParams?.company,
    sponsorFromParams?.job_title,
    sponsorFromParams?.email,
    sponsorFromParams?.phone,
    sponsorFromParams?.website,
    sponsorFromParams?.location,
  ]);

  // Get sponsor data from params and enrich from directory
  const sponsor = useMemo(() => {
    const parsed = sponsorFromParams || defaultSponsor;
    const enriched = resolvedSponsorFromDirectory ? { ...parsed, ...resolvedSponsorFromDirectory } : parsed;
    const raw = enriched?.raw || {};

    // Prefer backend biography/company_information for sponsor profiles
    if (!enriched.about || enriched.about.trim().length === 0) {
      const backendAbout = raw.biography || raw.company_information || '';
      if (backendAbout) {
        enriched.about = backendAbout;
      }
    }
    
    // If logoBg is not set (for delegates), generate it from ID
    if (!enriched.logoBg && enriched.id) {
      enriched.logoBg = getColorFromString(String(enriched.id), LOGO_COLORS);
    }

    // Clean about text if it contains HTML (in case raw data is passed)
    if (enriched.about && typeof enriched.about === 'string') {
      if (enriched.about.includes('<')) {
        enriched.about = enriched.about
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
        !enriched.about ||
        enriched.about.length < 10 ||
        enriched.about.toLowerCase().includes('doctype')
      ) {
        enriched.about = '';
      }
    }

    return enriched;
  }, [defaultSponsor, sponsorFromParams, resolvedSponsorFromDirectory]);

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

  // numericTargetId is computed above from params; keep existing usages by referencing sponsor.id below

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

  const requestOutcome = useMemo(() => {
    const merged = sponsor?.raw ? { ...sponsor, ...sponsor.raw } : sponsor;
    const flag =
      pickOutcomeFlag(attendeeOutcomeMap, merged, isDelegate) ??
      (Number.isFinite(numericTargetId)
        ? attendeeOutcomeMap.get(numericTargetId) ?? attendeeOutcomeMap.get(String(numericTargetId))
        : null);
    return flag === 1 ? 'accepted' : flag === 2 ? 'declined' : null;
  }, [attendeeOutcomeMap, sponsor, isDelegate, numericTargetId]);

  const hasPendingRequest = useMemo(() => {
    // `hasRequest` is a legacy flag coming from sponsor/delegate lists.
    // It is reliable for delegate->sponsor and sponsor->delegate flows, but not for delegate->delegate
    // when this screen is reused to show a delegate profile.
    const legacyHasRequest = isDelegate && isDelegateProfile ? false : Boolean(sponsor?.hasRequest);
    return !requestOutcome && (hasRequested || legacyHasRequest);
  }, [requestOutcome, hasRequested, sponsor?.hasRequest, isDelegate, isDelegateProfile]);

  const canBookMeeting = useMemo(
    // SponsorDetailsScreen is reused for both sponsor profiles and delegate profiles.
    // When current user is a delegate, we allow booking for both:
    // - delegate -> sponsor
    // - delegate -> delegate
    // When current user is a sponsor, we allow booking only for delegate profiles.
    () => true,
    [isDelegate, isDelegateProfile]
  );

  const meetingRequestLabel = useMemo(() => {
    if (!canBookMeeting) return 'Book a meeting';
    if (requestOutcome === 'accepted') return 'Accepted';
    if (requestOutcome === 'declined') return 'Declined';
    if (hasPendingRequest) {
      return requestedPriorityText ? `Requested (${requestedPriorityText})` : 'Requested';
    }
    return 'Book a meeting';
  }, [requestOutcome, hasPendingRequest, requestedPriorityText, canBookMeeting]);

  const meetingRequestDisabled =
    !canBookMeeting || requestOutcome === 'accepted' || hasPendingRequest;

  useEffect(() => {
    // Avoid disabling the button incorrectly for delegate->delegate profiles.
    if (isDelegate && isDelegateProfile) return;
    if (sponsor && typeof sponsor.hasRequest !== 'undefined') {
      setHasRequested(Boolean(sponsor.hasRequest));
      if (sponsor.priorityText && typeof sponsor.priorityText === 'string') {
        setPriority(sponsor.priorityText);
        setRequestedPriorityText(sponsor.priorityText);
      } else if (sponsor.priority && typeof sponsor.priority === 'number') {
        const mapped =
          sponsor.priority === 1 ? '1st' : sponsor.priority === 2 ? '2nd' : '1st';
        setPriority(mapped);
        setRequestedPriorityText(mapped);
      }
    }
  }, [sponsor, isDelegate, isDelegateProfile]);

  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const meetingDate = useMemo(() => {
    const raw = params?.eventDateFrom || selectedEventDateFrom;
    if (!raw) return todayDate;
    const s = String(raw);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return todayDate;
  }, [params?.eventDateFrom, selectedEventDateFrom, todayDate]);

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

    if (meetingTimesData?.data && typeof meetingTimesData.data === 'object' && !Array.isArray(meetingTimesData.data)) {
      const dates = Array.isArray(meetingTimesData?.dates)
        ? meetingTimesData.dates
        : Object.keys(meetingTimesData.data || {});

      return (dates || [])
        .map((dateKey) => {
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
                toFull,
              };
            })
            .filter(Boolean);

          return { date: dateKey, dateLabel: formatDateDDMMYYYY(dateKey), items };
        })
        .filter((g) => g.items.length > 0);
    }

    const arr = Array.isArray(meetingTimesData?.data)
      ? meetingTimesData.data
      : Array.isArray(meetingTimesData)
        ? meetingTimesData
        : Array.isArray(meetingTimesData?.data?.data)
          ? meetingTimesData.data.data
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

    return items.length
      ? [{ date: meetingDate, dateLabel: formatDateDDMMYYYY(meetingDate), items }]
      : [];
  }, [meetingTimesData, meetingDate]);

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
    const sponsorId = sponsor.id || sponsor.raw?.id;

    if (!sponsorId) {
      Alert.alert('Error', 'Invalid profile information');
      return;
    }

    const threadData = {
      id: String(sponsorId),
      user_id: Number(sponsorId),
      user_type: isDelegateProfile ? 'delegate' : 'sponsor',
      name: sponsor.name,
      user_name: sponsor.name,
      avatar: sponsor.image,
      user_image: sponsor.image,
      company: sponsor.company,
      email: sponsor.email,
    };

    router.push({
      pathname: '/message-detail',
      params: {
        thread: JSON.stringify(threadData),
        returnTo: 'sponsor-details',
        returnSponsor: JSON.stringify(sponsor),
      },
    });
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setIsSendingRequest(false);
    setIsRequestSuccess(false);
    setSelectedTimeSlot(null);
    setModalStep('priority');
  };

  const openMeetingModal = () => {
    if (meetingRequestDisabled) return;
    setIsModalVisible(true);
    setIsSendingRequest(false);
    setIsRequestSuccess(false);
    setSelectedTimeSlot(null);
    setModalStep('priority');
  };

  const openTimeModal = () => {
    if (!sponsor || !sponsor.id) return;

    const raw = Number(eventId);
    const effectiveEventId = Number.isFinite(raw) && raw > 0 ? raw : 27;
    const date = meetingDate;
    const dateFrom = selectedEventDateFrom ? String(selectedEventDateFrom).slice(0, 10) : null;
    const dateTo = selectedEventDateTo ? String(selectedEventDateTo).slice(0, 10) : null;

    const timeParams = { event_id: effectiveEventId, date };
    // Time-slot filtering needs to know who the booking target is:
    // - delegate viewing sponsor profile => exclude booked slots for that sponsor
    // - delegate viewing delegate profile => exclude booked slots for that delegate
    // - sponsor viewing delegate profile => exclude booked slots for that delegate
    if (isDelegate) {
      if (isDelegateProfile) timeParams.target_delegate_id = Number(sponsor.id);
      else timeParams.target_sponsor_id = Number(sponsor.id);
    } else {
      if (isDelegateProfile) timeParams.target_delegate_id = Number(sponsor.id);
      else timeParams.target_sponsor_id = Number(sponsor.id);
    }

    if (dateFrom && dateTo) {
      timeParams.date_from = dateFrom;
      timeParams.date_to = dateTo;
    }

    setMeetingTimesParams(timeParams);
    setSelectedTimeSlot(null);
    setModalStep('time');
  };

  const closeTimeModal = () => {
    setModalStep('priority');
  };

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
    try {
      if (!sponsor.id || sponsor.id === '') {
        Alert.alert('Error', `Invalid ${isDelegate ? 'sponsor' : 'delegate'} ID`);
        return;
      }

      setIsSendingRequest(true);

      const priorityMap = { '1st': 1, '2nd': 2 };
      const priorityValue = priorityMap[priority] || 1;

      const effectiveSlot = slot || getDefaultSlot();
      const meetingDateVal = effectiveSlot?.date || meetingDate || todayDate;
      const meetingTimeFrom = effectiveSlot?.fromFull || (effectiveSlot?.from ? `${effectiveSlot.from}:00` : null);
      const meetingTimeTo = effectiveSlot?.toFull || (effectiveSlot?.to ? `${effectiveSlot.to}:00` : null);

      if (!meetingTimeFrom || !meetingTimeTo) {
        Alert.alert('Error', 'Please select a valid time slot');
        setIsSendingRequest(false);
        return;
      }

      let payload;
      if (isDelegate) {
        // Delegate is the logged-in user, and `sponsor` variable represents the profile we are viewing.
        // - Viewing sponsor profile (delegate -> sponsor): backend expects `sponsor_id`
        // - Viewing delegate profile (delegate -> delegate): backend expects `delegate_id`
        payload = isDelegateProfile
          ? {
              delegate_id: Number(sponsor.id),
              event_id: Number(eventId || 27),
              priority: priorityValue,
              meeting_date: meetingDateVal,
              meeting_time_from: meetingTimeFrom,
              meeting_time_to: meetingTimeTo,
              message: '',
            }
          : {
              sponsor_id: Number(sponsor.id),
              event_id: Number(eventId || 27),
              priority: priorityValue,
              meeting_date: meetingDateVal,
              meeting_time_from: meetingTimeFrom,
              meeting_time_to: meetingTimeTo,
              message: '',
            };
      } else {
        // Sponsor login:
        // - viewing delegate profile -> sponsor -> delegate (existing)
        // - viewing sponsor profile -> sponsor -> sponsor (new)
        payload = isDelegateProfile
          ? {
              delegate_id: Number(sponsor.id),
              event_id: Number(eventId || 27),
              priority: priorityValue,
              meeting_date: meetingDateVal,
              meeting_time_from: meetingTimeFrom,
              meeting_time_to: meetingTimeTo,
              message: '',
            }
          : {
              sponsor_id: Number(sponsor.id),
              event_id: Number(eventId || 27),
              priority: priorityValue,
              meeting_date: meetingDateVal,
              meeting_time_from: meetingTimeFrom,
              meeting_time_to: meetingTimeTo,
              message: '',
            };
      }

      const requestMutationFn = !isDelegate
        ? (isDelegateProfile ? createSponsorMeetingRequest : createSponsorMeetingRequestToSponsor)
        : isDelegateProfile
          ? createDelegateMeetingRequestToDelegate
          : createDelegateMeetingRequest;

      await requestMutationFn(payload).unwrap();

      setModalStep('priority');
      setHasRequested(true);
      setRequestedPriorityText(priority);
      setIsRequestSuccess(true);
      setSelectedTimeSlot(null);
      refetchMeetingOutcomes();
    } catch (e) {
      console.error('Error sending meeting request:', e);
      Alert.alert('Error', e?.data?.message || e?.message || 'Failed to send meeting request');
    } finally {
      setIsSendingRequest(false);
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

            {!!sponsor?.name && (
              <View style={styles.actionRow}>
                {canBookMeeting && (
                  <TouchableOpacity
                    style={[
                      styles.bookMeetingButton,
                      requestOutcome === 'accepted' && styles.bookMeetingButtonAccepted,
                      requestOutcome === 'declined' && styles.bookMeetingButtonDeclined,
                      hasPendingRequest && styles.bookMeetingButtonDisabled,
                    ]}
                    onPress={openMeetingModal}
                    activeOpacity={0.85}
                    disabled={meetingRequestDisabled}
                  >
                    <View style={styles.bookMeetingLeftIcon}>
                      <Icon name="users" size={18} color={colors.white} />
                    </View>
                    <Text
                      style={[
                        styles.bookMeetingText,
                        (requestOutcome === 'accepted' || requestOutcome === 'declined') &&
                          styles.bookMeetingTextState,
                        hasPendingRequest && styles.bookMeetingTextDisabled,
                      ]}
                    >
                      {meetingRequestLabel}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
                    <Icon
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

      {!!sponsor?.name && (
        <View
          style={[
            styles.bottomButtonContainer,
            { bottom: 0, paddingBottom: Math.max(insets.bottom, 0) + 16 },
          ]}
        >
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
      )}

      <Modal transparent animationType="fade" visible={isModalVisible} onRequestClose={closeModal}>
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
            ) : isRequestSuccess ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <Icon name="check-circle" size={64} color={colors.primary} />
                </View>
                <Text style={styles.successTitle}>Request Sent Successfully!</Text>
                <Text style={styles.successMessage}>
                  Your meeting request has been sent to {sponsor?.name || 'this attendee'}.
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
                    {sponsor?.image ? (
                      <Image source={{ uri: sponsor.image }} style={styles.avatarImage} />
                    ) : (
                      <View
                        style={[
                          styles.avatarImage,
                          { backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
                        ]}
                      >
                        <Icon name="user" size={24} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.modalContactInfo}>
                    <Text style={styles.modalContactName}>{sponsor?.name || '—'}</Text>
                    <Text style={styles.modalContactCompany}>{sponsor?.company || '—'}</Text>
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
                  <TouchableOpacity style={[styles.modalButton, styles.primaryButton]} onPress={openTimeModal} activeOpacity={0.85}>
                    <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Select Time</Text>
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
  bookMeetingButtonAccepted: {
    backgroundColor: '#22C55E',
    opacity: 1,
  },
  bookMeetingButtonDeclined: {
    backgroundColor: '#EF4444',
    opacity: 1,
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
  bookMeetingTextState: {
    color: colors.white,
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

export default SponsorDetailsScreen;

