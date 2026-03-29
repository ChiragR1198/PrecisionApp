import Icon from '@expo/vector-icons/Feather';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { SearchBar } from '../../components/common/SearchBar';
import { Icons } from '../../constants/icons';
import { colors, radius } from '../../constants/theme';
import {
  useGetDelegateAttendeesQuery,
  useGetDelegateMeetingRequestOutcomesQuery,
  useGetDelegateMeetingRequestsQuery,
  useGetDelegateMeetingTimesQuery,
  useGetPresenceOnlineQuery,
  useGetSponsorAllAttendeesQuery,
  useGetSponsorMeetingRequestOutcomesQuery,
  useGetSponsorMeetingRequestsQuery,
  useGetSponsorMeetingTimesQuery,
  useGetSponsorServicesQuery,
  useSendDelegateMeetingRequestMutation,
  useSendSponsorMeetingRequestMutation,
} from '../../store/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearAuth } from '../../store/slices/authSlice';

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

function formatMeetingTimeShort(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${min} ${ampm}`;
}

function formatMeetingDateDisplay(raw) {
  if (!raw) return '';
  const s = String(raw).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, d] = s.split('-');
    return `${d}/${mo}/${y}`;
  }
  return String(raw);
}

function pickOutcomeInfo(map, attendee, isDelegate) {
  if (!map || !(map instanceof Map) || map.size === 0) return null;
  const raw = attendee && typeof attendee === 'object' ? attendee : {};
  const candidateKeys = isDelegate
    ? [raw.id, raw.user_id, raw.sponsor_id, raw.sponsorId, raw.member_id, raw.sponsor_user_id]
    : [raw.id, raw.user_id, raw.delegate_id, raw.delegateId, raw.member_id];
  for (const c of candidateKeys) {
    if (c == null || c === '') continue;
    const n = Number(c);
    if (!Number.isFinite(n)) continue;
    const info = map.get(n) ?? map.get(String(n));
    if (info && typeof info === 'object' && (info.flag === 1 || info.flag === 2)) return info;
  }
  return null;
}

function pickOutcomeFlag(map, attendee, isDelegate) {
  const info = pickOutcomeInfo(map, attendee, isDelegate);
  return info?.flag ?? null;
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

const AttendeeRow = React.memo(function AttendeeRow({
  item,
  SIZES,
  styles,
  onOpenDetails,
  onOpenRequest,
}) {
  const showOnline = Boolean(item.isOnline);
  const availabilityLabel = showOnline ? 'Online' : '';

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
      style={[styles.row, rowHighlight]}
      activeOpacity={0.8}
      onPress={() => onOpenDetails(item)}
    >
      <View
        style={[
          styles.avatar,
          {
            width: SIZES.avatarSize,
            height: SIZES.avatarSize,
            borderRadius: SIZES.avatarSize / 2,
          },
        ]}
      >
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={{
              width: SIZES.avatarSize,
              height: SIZES.avatarSize,
              borderRadius: SIZES.avatarSize / 2,
            }}
            resizeMode="cover"
          />
        ) : (
          <UserIcon size={SIZES.avatarSize * 0.5} />
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.role}
        </Text>
        <View style={styles.rowMetaBottom}>
          <Text style={styles.rowMeta1} numberOfLines={1}>
            {item.company}
          </Text>
          {availabilityLabel ? (
            <View style={[styles.availabilityPill, styles.availabilityPillAvailable]}>
              <View style={[styles.availabilityDot, styles.availabilityDotAvailable]} />
              <Text style={styles.availabilityText}>{availabilityLabel}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.requestColumn}>
        <TouchableOpacity
          style={requestBtnStyle}
          activeOpacity={0.85}
          onPress={(e) => {
            e.stopPropagation();
            if (!requestDisabled) onOpenRequest(item);
          }}
          disabled={requestDisabled}
        >
          <Text style={requestTextStyle} numberOfLines={1} ellipsizeMode="tail">
            {requestLabel}
          </Text>
        </TouchableOpacity>
        {item.requestOutcome === 'accepted' && item.meetingWhenLabel ? (
          <Text style={styles.meetingScheduleBelowButton} numberOfLines={2}>
            {item.meetingWhenLabel}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export const AttendeesScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { selectedEventDateFrom, selectedEventDateTo, selectedEventId } = useAppSelector((state) => state.event);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';

  const currentUserNumericId = useMemo(() => {
    const n = Number(user?.id ?? user?.user_id ?? user?.delegate_id ?? user?.sponsor_id);
    return Number.isFinite(n) ? n : null;
  }, [user]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryDebounced, setSearchQueryDebounced] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [draftSelectedServices, setDraftSelectedServices] = useState([]);
  const [locallyRequestedIds, setLocallyRequestedIds] = useState([]);
  const [localPriorityMap, setLocalPriorityMap] = useState({});
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // 'all' | 'online'

  useEffect(() => {
    setAvailabilityFilter((prev) => {
      if (prev === 'available') return 'online';
      if (prev === 'unavailable') return 'all';
      return prev;
    });
  }, []);

  // Must be declared before meeting-times queries
  const [meetingTimesParams, setMeetingTimesParams] = useState(null);
  
  // Conditionally fetch attendees based on user type
  const { 
    data: delegateAttendeesData, 
    isLoading: delegateLoading,
    isFetching: delegateAttendeesFetching,
    error: delegateError, 
    refetch: delegateRefetch 
  } = useGetDelegateAttendeesQuery(undefined, {
    skip: !isAuthenticated || !user || !isDelegate, // Skip for sponsors
    refetchOnMountOrArgChange: true,
  });

  // For sponsors, pass selectedServices to filter attendees by service
  const { 
    data: sponsorAttendeesData, 
    isLoading: sponsorLoading,
    isFetching: sponsorAttendeesFetching,
    error: sponsorError, 
    refetch: sponsorRefetch 
  } = useGetSponsorAllAttendeesQuery(selectedServices.length > 0 ? selectedServices : undefined, {
    skip: !isAuthenticated || !user || isDelegate, // Skip for delegates
    refetchOnMountOrArgChange: true,
  });
  
  const attendeesData = isDelegate ? delegateAttendeesData : sponsorAttendeesData;
  const isLoading = isDelegate ? delegateLoading : sponsorLoading;
  const isFetchingAttendees = isDelegate ? delegateAttendeesFetching : sponsorAttendeesFetching;
  const error = isDelegate ? delegateError : sponsorError;
  const refetch = isDelegate ? delegateRefetch : sponsorRefetch;
  
  const [createDelegateMeetingRequest] = useSendDelegateMeetingRequestMutation();
  const [createSponsorMeetingRequest] = useSendSponsorMeetingRequestMutation();
  const createMeetingRequest = isDelegate ? createDelegateMeetingRequest : createSponsorMeetingRequest;
  
  // Fetch meeting requests to check which attendees already have requests
  const { 
    data: delegateMeetingRequestsData,
    refetch: refetchDelegateMeetingRequests
  } = useGetDelegateMeetingRequestsQuery(undefined, {
    skip: !isAuthenticated || !user || !isDelegate,
    refetchOnMountOrArgChange: true,
  });
  
  const { 
    data: sponsorMeetingRequestsData,
    refetch: refetchSponsorMeetingRequests
  } = useGetSponsorMeetingRequestsQuery(undefined, {
    skip: !isAuthenticated || !user || isDelegate,
    refetchOnMountOrArgChange: true,
  });
  
  const meetingRequestsData = isDelegate ? delegateMeetingRequestsData : sponsorMeetingRequestsData;
  const refetchMeetingRequests = isDelegate ? refetchDelegateMeetingRequests : refetchSponsorMeetingRequests;

  const rawEventId = user?.event_id ?? user?.events?.[0]?.id ?? selectedEventId ?? 27;
  const eventId = (typeof rawEventId === 'number' && Number.isFinite(rawEventId) && rawEventId > 0)
    ? rawEventId
    : (Number(rawEventId) || 27);

  const { data: presenceOnlineData } = useGetPresenceOnlineQuery(
    { event_id: eventId, window: 120 },
    {
      skip: !isAuthenticated || !user || !Number.isFinite(Number(eventId)) || Number(eventId) <= 0,
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

  const {
    data: delegateOutcomesData,
    refetch: refetchDelegateOutcomes,
    isFetching: isFetchingDelegateOutcomes,
  } = useGetDelegateMeetingRequestOutcomesQuery(
    { event_id: eventId },
    {
      skip: !isAuthenticated || !user || !isDelegate,
      refetchOnMountOrArgChange: true,
    }
  );
  const {
    data: sponsorOutcomesData,
    refetch: refetchSponsorOutcomes,
    isFetching: isFetchingSponsorOutcomes,
  } = useGetSponsorMeetingRequestOutcomesQuery(
    { event_id: eventId },
    {
      skip: !isAuthenticated || !user || isDelegate,
      refetchOnMountOrArgChange: true,
    }
  );
  const meetingOutcomesData = isDelegate ? delegateOutcomesData : sponsorOutcomesData;
  const refetchMeetingOutcomes = isDelegate ? refetchDelegateOutcomes : refetchSponsorOutcomes;
  const isFetchingOutcomes = isDelegate ? isFetchingDelegateOutcomes : isFetchingSponsorOutcomes;

  const attendeeOutcomeInfoMap = useMemo(() => {
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
      if (flag == null) return;
      const date = row?.date ?? row?.meeting_date ?? null;
      const time =
        row?.time ?? row?.meeting_time_from ?? row?.meeting_time_to ?? row?.meeting_time ?? null;
      const entry = { flag, date, time };
      map.set(id, entry);
      map.set(String(id), entry);
    });
    return map;
  }, [meetingOutcomesData, isDelegate]);

  useFocusEffect(
    useCallback(() => {
      refetchMeetingOutcomes();
      refetchMeetingRequests();
    }, [refetchMeetingOutcomes, refetchMeetingRequests])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        refetchMeetingOutcomes();
        refetchMeetingRequests();
      }
    });
    return () => sub.remove();
  }, [refetchMeetingOutcomes, refetchMeetingRequests]);
  
  // --- requestedAttendeeIds: ONLY outgoing (I requested them), NOT inbox (they requested me) ---
  // meeting-request APIs return INCOMING: delegate inbox = sponsors who requested delegate;
  // sponsor inbox = delegates who requested sponsor. Using those would wrongly mark "Requested"
  // on people who requested us. So we use only local optimistic state (this session).
  const requestedAttendeeIds = useMemo(() => {
    return new Set(locallyRequestedIds.filter((id) => Number.isFinite(id)));
  }, [locallyRequestedIds]);

  // --- attendeePriorityMap: priority for OUR sent requests only (local optimistic state) ---
  const attendeePriorityMap = useMemo(() => {
    const map = new Map();
    Object.entries(localPriorityMap || {}).forEach(([id, text]) => {
      const n = Number(id);
      if (Number.isFinite(n) && text) map.set(n, text);
    });
    return map;
  }, [localPriorityMap]);
  
  // Fetch sponsor services for filter (ensure valid number to avoid NaN → 403)
  const todayDate = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

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
    error: delegateMeetingTimesError,
    refetch: refetchDelegateMeetingTimes,
  } = useGetDelegateMeetingTimesQuery(meetingTimesParams || {}, {
    skip: !isAuthenticated || !user || !isDelegate || !meetingTimesParams,
  });

  const {
    data: sponsorMeetingTimesData,
    isLoading: sponsorMeetingTimesLoading,
    error: sponsorMeetingTimesError,
    refetch: refetchSponsorMeetingTimes,
  } = useGetSponsorMeetingTimesQuery(meetingTimesParams || {}, {
    skip: !isAuthenticated || !user || isDelegate || !meetingTimesParams,
  });

  const meetingTimesData = isDelegate ? delegateMeetingTimesData : sponsorMeetingTimesData;
  const meetingTimesLoading = isDelegate ? delegateMeetingTimesLoading : sponsorMeetingTimesLoading;
  const refetchMeetingTimes = isDelegate ? refetchDelegateMeetingTimes : refetchSponsorMeetingTimes;

  const meetingSlotGroups = useMemo(() => {
    if (!meetingTimesData) return [];

    // Normalize possible response shapes:
    // A) { success, data: { "YYYY-MM-DD": [...] }, dates: [...] }
    // B) { success, data: { success, data: { "YYYY-MM-DD": [...] }, dates: [...] } }
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
      if (s.includes(' ')) return s.split(' ')[1] || s; // "YYYY-MM-DD HH:MM:SS" -> "HH:MM:SS"
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

    // fallback for array-based responses (API returns { data: [{ meeting_from, meeting_to }, ...] })
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

  const { 
    data: sponsorServicesData, 
    isLoading: servicesLoading 
  } = useGetSponsorServicesQuery(eventId, {
    skip: !isAuthenticated || !user || isDelegate, // Skip for delegates
    refetchOnMountOrArgChange: true,
  });
  
  // Handle authentication errors - redirect to login
  useEffect(() => {
    if (error && (error.status === 401 || error.status === 'NO_TOKEN' || error.status === 403 || error.status === 'AUTH_REQUIRED')) {
      dispatch(clearAuth());
      setTimeout(() => {
        router.replace('/login');
      }, 0);
    }
  }, [error, dispatch]);
  
  const listLabel = useMemo(() => (isDelegate ? 'Sponsors' : 'Delegates'), [isDelegate]);
  const listLabelLower = useMemo(() => listLabel.toLowerCase(), [listLabel]);

  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return `Failed to load ${listLabelLower}.`;
  }, [error, listLabelLower]);

  const attendees = useMemo(() => {
    return attendeesData?.data || attendeesData || [];
  }, [attendeesData]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('Name (A to Z)');
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState('1st');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isRequestSuccess, setIsRequestSuccess] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;
  const [modalStep, setModalStep] = useState('priority'); // 'priority' | 'time' — single modal, no nesting (fixes Android)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
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
        title: getResponsiveValue({ android: 15, ios: 16, tablet: 17, default: 15 }),
        body: getResponsiveValue({ android: 13, ios: 14, tablet: 14, default: 13 }),
        filterHeight: getResponsiveValue({ android: 46, ios: 48, tablet: 48, default: 46 }),
        avatarSize: getResponsiveValue({ android: 53, ios: 54, tablet: 55, default: 53 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  // Filter options - use API data for sponsors, hardcoded for delegates
  const sponsorServices = useMemo(() => {
    if (!sponsorServicesData) return [];
    // Handle API response structure: { services: [...] } or direct array
    const services = sponsorServicesData?.services || sponsorServicesData?.data || sponsorServicesData || [];
    return Array.isArray(services) ? services : [];
  }, [sponsorServicesData]);

  const FILTER_OPTIONS = useMemo(() => {
    if (isDelegate) {
      // For delegates, use hardcoded options (or empty if not needed)
      return [];
    }
    // For sponsors, use services from API (no "All Services" option for multi-select)
    const services = sponsorServices.map((service) => {
      // Handle both object and string formats
      return typeof service === 'string' ? service : (service.name || service.title || service.service || '');
    }).filter(Boolean);
    return services;
  }, [isDelegate, sponsorServices]);

  const SORT_OPTIONS = useMemo(() => (
    [
      'Name (A to Z)',
      'Name (Z to A)',
      'Company (A to Z)',
      'Company (Z to A)',
      'Role (A to Z)',
      'Role (Z to A)',
      'Newest',
      'Oldest',
    ]
  ), []);

  // Transform API data to UI format
  // NOTE: We keep the full original attendee object (...attendee)
  // so that ANY field coming from backend (present or future)
  // is available in the app (e.g. address, bio, linkedin_url, etc.)
  const DATA = useMemo(() => {
    if (!attendees || attendees.length === 0) return [];
    return attendees.map((attendee) => {
      // Avoid cloning/spreading the full object for every attendee (big perf win on large lists).
      const id = attendee?.id;
      const name =
        attendee?.name ||
        attendee?.full_name ||
        attendee?.fullName ||
        attendee?.delegate_name ||
        'Unknown';
      const role = attendee?.job_title || '';
      const company = attendee?.company || '';
      const nameKey = String(name || '').toLowerCase();
      const roleKey = String(role || '').toLowerCase();
      const companyKey = String(company || '').toLowerCase();

      const numericId = Number(
        id ?? attendee?.user_id ?? attendee?.sponsor_id ?? attendee?.delegate_id
      ) || Number(id);
      const hasLocalRequest = Number.isFinite(numericId) && locallyRequestedIds.includes(numericId);
      const availability = String(attendee?.status || '').toLowerCase();
      const mappedPriorityText = attendeePriorityMap.get(numericId) || null;
      const priorityText = localPriorityMap[numericId] || mappedPriorityText || null;

      const outcomeInfo =
        pickOutcomeInfo(attendeeOutcomeInfoMap, attendee, isDelegate) ??
        (Number.isFinite(numericId)
          ? attendeeOutcomeInfoMap.get(numericId) ?? attendeeOutcomeInfoMap.get(String(numericId))
          : null);
      const outcomeFlag = outcomeInfo?.flag ?? null;
      const requestOutcome =
        outcomeFlag === 1 ? 'accepted' : outcomeFlag === 2 ? 'declined' : null;
      const meetingWhenLabel =
        requestOutcome === 'accepted' && (outcomeInfo?.date || outcomeInfo?.time)
          ? [
              outcomeInfo?.date ? formatMeetingDateDisplay(outcomeInfo.date) : null,
              outcomeInfo?.time ? formatMeetingTimeShort(outcomeInfo.time) : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : '';

      const hasPendingRequest =
        !requestOutcome &&
        (hasLocalRequest || requestedAttendeeIds.has(numericId));

      const isCurrentUser =
        currentUserNumericId != null &&
        Number.isFinite(numericId) &&
        currentUserNumericId === numericId;
      const inPresence =
        (isDelegate && presenceSponsorSet.has(numericId)) ||
        (!isDelegate && presenceDelegateSet.has(numericId));
      const isOnline = Boolean(isCurrentUser || inPresence);

      return {
        id,
        name,
        full_name: attendee?.full_name || attendee?.fullName || '',
        role,
        company,
        service:
          attendee?.service ||
          attendee?.service_name ||
          attendee?.service_title ||
          'All Services',
        email: attendee?.email || '',
        phone: attendee?.mobile || '',
        image: attendee?.image || null,
        address: attendee?.address || attendee?.Address || '',
        bio: attendee?.bio || '',
        linkedin: attendee?.linkedin_url || attendee?.linkedin || '',
        status: attendee?.status,
        availability,
        isCurrentUser,
        isOnline,
        // Precomputed keys for fast search/sort
        _nameKey: nameKey,
        _roleKey: roleKey,
        _companyKey: companyKey,
        _searchText: `${nameKey} ${roleKey} ${companyKey}`,
        // Pending = sent but no accept/decline yet. Accepted/Declined come from outcomes API.
        hasRequest: hasPendingRequest,
        requestOutcome,
        meetingWhenLabel,
        priorityText,
        // Keep raw available (used only when navigating/details)
        raw: attendee,
      };
    });
  }, [
    attendees,
    requestedAttendeeIds,
    locallyRequestedIds,
    attendeePriorityMap,
    localPriorityMap,
    attendeeOutcomeInfoMap,
    isDelegate,
    currentUserNumericId,
    presenceDelegateSet,
    presenceSponsorSet,
  ]);

  // Important perf detail:
  // - Sorting can be O(n log n); don't re-sort on every search keystroke.
  // - We sort only when DATA or sortBy changes, then apply cheap filter for search.
  const sortedData = useMemo(() => {
    if (!DATA || DATA.length === 0) return [];
    const sorted = [...DATA];
    switch (sortBy) {
      case 'Name (Z to A)':
        sorted.sort((a, b) => String(b?._nameKey || '').localeCompare(String(a?._nameKey || '')));
        break;
      case 'Company (A to Z)':
        sorted.sort((a, b) => String(a?._companyKey || '').localeCompare(String(b?._companyKey || '')));
        break;
      case 'Company (Z to A)':
        sorted.sort((a, b) => String(b?._companyKey || '').localeCompare(String(a?._companyKey || '')));
        break;
      case 'Role (A to Z)':
        sorted.sort((a, b) => String(a?._roleKey || '').localeCompare(String(b?._roleKey || '')));
        break;
      case 'Role (Z to A)':
        sorted.sort((a, b) => String(b?._roleKey || '').localeCompare(String(a?._roleKey || '')));
        break;
      case 'Newest':
        // API doesn't provide date field, so sort by ID (newest = higher ID)
        sorted.sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
        break;
      case 'Oldest':
        // API doesn't provide date field, so sort by ID (oldest = lower ID)
        sorted.sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
        break;
      case 'Name (A to Z)':
      default:
        sorted.sort((a, b) => String(a?._nameKey || '').localeCompare(String(b?._nameKey || '')));
        break;
    }
    return sorted;
  }, [sortBy, DATA]);

  const filteredData = useMemo(() => {
    const q = searchQueryDebounced.trim().toLowerCase();

    const matchesSearch = (a) =>
      !q || (a?._searchText || '').includes(q);

    const matchesAvailability = (a) => {
      if (availabilityFilter === 'all') return true;
      if (availabilityFilter === 'online') {
        return Boolean(a?.isOnline);
      }
      return true;
    };

    return sortedData.filter((a) => matchesSearch(a) && matchesAvailability(a));
  }, [searchQueryDebounced, sortedData, availabilityFilter]);

  const openModal = useCallback((attendee) => {
    const attendeeId = attendee?.id ? Number(attendee.id) : null;
    const existingPriority = attendeeId ? attendeePriorityMap.get(attendeeId) : null;
    setSelectedPriority(existingPriority || '1st');
    setSelectedAttendee(attendee);
    setIsSendingRequest(false);
    setIsRequestSuccess(false);
    setSelectedTimeSlot(null);
    setModalStep('priority');
    setIsModalVisible(true);
  }, [attendeePriorityMap]);

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
        if (finished) {
          setSelectedAttendee(null);
        }
      });
    }
  }, [isModalVisible, modalAnim, selectedAttendee]);

  const openTimeModal = useCallback(() => {
    if (!selectedAttendee) return;

    const raw = Number(eventId);
    const effectiveEventId = (Number.isFinite(raw) && raw > 0) ? raw : 27;
    const date = meetingDate;
    const dateFrom = selectedEventDateFrom ? String(selectedEventDateFrom).slice(0, 10) : null;
    const dateTo = selectedEventDateTo ? String(selectedEventDateTo).slice(0, 10) : null;

    const params = { event_id: effectiveEventId, date };
    if (dateFrom && dateTo) {
      params.date_from = dateFrom;
      params.date_to = dateTo;
      if (isDelegate && selectedAttendee?.id) params.target_sponsor_id = Number(selectedAttendee.id);
      if (!isDelegate && selectedAttendee?.id) params.target_delegate_id = Number(selectedAttendee.id);
    }

    setMeetingTimesParams(params);
    setSelectedTimeSlot(null);
    setModalStep('time');
  }, [selectedAttendee, eventId, meetingDate, selectedEventDateFrom, selectedEventDateTo, isDelegate]);

  const closeTimeModal = useCallback(() => {
    setModalStep('priority');
  }, []);

  // Default slot when meeting-times API returns no slots (e.g. staging)
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
      // Validate attendee ID
      if (!selectedAttendee.id) {
        Alert.alert('Error', `Invalid ${isDelegate ? 'sponsor' : 'delegate'} ID`);
        return;
      }

      // Show loader
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

      // API expects meeting_date, meeting_time_from, meeting_time_to
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

      // Optimistically mark this attendee as requested for immediate visual feedback
      const numericId = Number(selectedAttendee.id);
      setLocallyRequestedIds((prev) => {
        if (prev.includes(numericId)) return prev;
        return [...prev, numericId];
      });
      setLocalPriorityMap((prev) => ({
        ...prev,
        [numericId]: selectedPriority,
      }));

      // Refetch meeting requests to update priority map
      if (refetchMeetingRequests) {
        refetchMeetingRequests();
      }

      // Show success message (stay in same modal)
      setIsSendingRequest(false);
      setIsRequestSuccess(true);
      setModalStep('priority');
    } catch (e) {
      console.error('Error sending meeting request:', e);
      setIsSendingRequest(false);
      setIsRequestSuccess(false);
      Alert.alert('Error', e?.data?.message || e?.message || 'Failed to send meeting request');
    }
  };

  // Debounce search to avoid filtering/sorting on every keystroke (big lists).
  useEffect(() => {
    const t = setTimeout(() => setSearchQueryDebounced(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const onOpenDetails = useCallback((item) => {
    const payload = item?.raw ? { ...item.raw, ...item } : item;
    if (payload?.raw) delete payload.raw;

    // Navigate based on login type:
    // - Delegate user viewing sponsors -> use DelegateDetails-style UI (profileType: 'sponsor')
    // - Sponsor user viewing delegates -> delegate details screen (param: delegate)
    if (isDelegate) {
      router.push({
        pathname: '/delegate-details',
        params: {
          delegate: JSON.stringify(payload),
          profileType: 'sponsor',
          returnTo: 'attendees',
          eventDateFrom: selectedEventDateFrom || '',
        },
      });
    } else {
      router.push({
        pathname: '/delegate-details',
        params: {
          delegate: JSON.stringify(payload),
          returnTo: 'attendees',
          eventDateFrom: selectedEventDateFrom || '',
        },
      });
    }
  }, [isDelegate, selectedEventDateFrom]);

  const onOpenRequest = openModal;

  const onRefreshAttendees = useCallback(() => {
    refetch();
    refetchMeetingOutcomes();
    refetchMeetingRequests();
  }, [refetch, refetchMeetingOutcomes, refetchMeetingRequests]);

  const renderItem = useCallback(
    ({ item }) => (
      <AttendeeRow
        item={item}
        SIZES={SIZES}
        styles={styles}
        onOpenDetails={onOpenDetails}
        onOpenRequest={onOpenRequest}
      />
    ),
    [SIZES, styles, onOpenDetails, onOpenRequest]
  );

  const itemSeparator = useCallback(() => <View style={styles.separator} />, [styles.separator]);

  // Estimated fixed height (we clamp name to 1 line); helps FlatList virtualization.
  const ITEM_HEIGHT = useMemo(() => Math.round(SIZES.avatarSize + 32), [SIZES.avatarSize]);
  const getItemLayout = useCallback(
    (_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }),
    [ITEM_HEIGHT]
  );

  const openFilter = useCallback(() => {
    setDraftSelectedServices(selectedServices);
    setIsFilterOpen(true);
  }, [selectedServices]);

  const applyFilter = useCallback(() => {
    setSelectedServices(draftSelectedServices);
    setIsFilterOpen(false);
  }, [draftSelectedServices]);

  const clearDraftFilter = useCallback(() => {
    setDraftSelectedServices([]);
  }, []);

  const draftSelectedSet = useMemo(
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

  const renderServiceItem = useCallback(
    ({ item: opt }) => {
      const isSelected = draftSelectedSet.has(opt);
      return (
        <TouchableOpacity
          key={opt}
          style={[styles.modalItem, isSelected && styles.modalItemActive]}
          activeOpacity={0.9}
          onPress={() => toggleDraftService(opt)}
        >
          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>{opt}</Text>
          {isSelected ? <Icon name="check" size={16} color={colors.primary} /> : <View style={styles.checkboxUnchecked} />}
        </TouchableOpacity>
      );
    },
    [draftSelectedSet, styles, toggleDraftService]
  );

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header 
          title={isDelegate ? 'Event Sponsors' : 'Event Delegates'} 
          leftIcon="menu" 
          onLeftPress={() => navigation.openDrawer?.()} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{`Loading ${listLabelLower}...`}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header 
          title={isDelegate ? 'Event Sponsors' : 'Event Delegates'} 
          leftIcon="menu" 
          onLeftPress={() => navigation.openDrawer?.()} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header 
        title={isDelegate ? 'Event Sponsors' : 'Event Delegates'} 
        leftIcon="menu" 
        onLeftPress={() => navigation.openDrawer?.()} 
        iconSize={SIZES.headerIconSize} 
      />

      <View style={styles.contentWrap}>
        <View style={styles.content}>
          {/* Search, Filter (sponsors only), and Sort in same row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBarWrapper}>
              <SearchBar
                placeholder={`Search ${listLabelLower}...`}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchBarInline}
              />
            </View>
            {/* {!isDelegate && ( */}
              <TouchableOpacity
                style={[styles.filterIconBtn, selectedServices.length > 0 && styles.filterIconBtnActive]}
                activeOpacity={0.8}
                onPress={openFilter}
              >
                <Icon name="filter" size={18} color={colors.white} />
              </TouchableOpacity>
            {/* )} */}
            <TouchableOpacity
              style={styles.filterIconBtn}
              activeOpacity={0.8}
              onPress={() => setIsSortOpen(true)}
            >
              <Icon name="sliders" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Advanced Filters: All | Online (logged-in user always shows as Online with green dot) */}
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
            <View style={styles.countDot} />
            <Text style={styles.countText}>{`${String(filteredData.length)} ${listLabel.toUpperCase()}`}</Text>
          </View>

          {filteredData.length > 0 ? (
            <FlatList
              data={filteredData}
              keyExtractor={(item) =>
                `${String(item.id)}-${item.requestOutcome ?? 'n'}-${item.hasRequest ? 'p' : 'o'}`
              }
              renderItem={renderItem}
              ItemSeparatorComponent={itemSeparator}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              updateCellsBatchingPeriod={50}
              windowSize={7}
              getItemLayout={getItemLayout}
              extraData={[sortBy, attendeeOutcomeInfoMap.size]}
              refreshControl={
                <RefreshControl
                  refreshing={!isLoading && (isFetchingAttendees || isFetchingOutcomes)}
                  onRefresh={onRefreshAttendees}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                  progressViewOffset={Platform.OS === 'android' ? 8 : undefined}
                />
              }
            />
          ) : (
            <View style={styles.emptyState}>
              <Icon name="users" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `No ${listLabelLower} found`
                  : `No ${listLabelLower} available`}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery 
                  ? 'Try a different search term or clear the search.'
                  : 'Check back later for attendee information.'}
              </Text>
            </View>
          )}
        </View>
      </View>
      {/* Filter modal */}
      <Modal transparent animationType="fade" visible={isFilterOpen} onRequestClose={() => setIsFilterOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropPressable} activeOpacity={1} onPress={() => setIsFilterOpen(false)} />
          <View style={styles.modalCenterWrap}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Service</Text>
              {servicesLoading && isDelegate === false ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.modalLoadingText}>Loading services...</Text>
                </View>
              ) : FILTER_OPTIONS.length === 0 ? (
                <View style={styles.modalLoadingContainer}>
                  <Text style={styles.modalLoadingText}>No services available</Text>
                </View>
              ) : (
                <FlatList
                  style={styles.modalList}
                  contentContainerStyle={styles.modalListContent}
                  data={FILTER_OPTIONS}
                  keyExtractor={(opt) => String(opt)}
                  renderItem={renderServiceItem}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={12}
                  windowSize={7}
                  extraData={draftSelectedServices}
                />
              )}
              <View style={styles.modalButtonRow2}>
                {draftSelectedServices.length > 0 && (
                  <TouchableOpacity 
                    onPress={clearDraftFilter}
                    activeOpacity={0.8} 
                    style={[styles.modalCloseBtn, styles.modalClearBtn]}
                  >
                    <Text style={[styles.modalCloseText, styles.modalClearText]}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={applyFilter} activeOpacity={0.8} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      {/* Sort modal */}
      <Modal transparent animationType="fade" visible={isSortOpen} onRequestClose={() => setIsSortOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropPressable} activeOpacity={1} onPress={() => setIsSortOpen(false)} />
          <View style={styles.modalCenterWrap}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Sort By</Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} showsVerticalScrollIndicator>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.modalItem, sortBy === opt && styles.modalItemActive]}
                    activeOpacity={0.9}
                    onPress={() => { setSortBy(opt); setIsSortOpen(false); }}
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
              <TouchableOpacity onPress={() => setIsSortOpen(false)} activeOpacity={0.8} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Meeting Request Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isModalVisible || !!selectedAttendee}
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
              {modalStep === 'time' ? (
                <>
                  <TouchableOpacity style={styles.modalHeaderSide} onPress={closeTimeModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton, { marginTop: 8 }]} onPress={closeTimeModal} activeOpacity={0.85}>
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
                            const isActive = selectedTimeSlot && selectedTimeSlot.date === it.date && selectedTimeSlot.fromFull === it.fromFull && selectedTimeSlot.to === it.to;
                            return (
                              <TouchableOpacity
                                key={key}
                                style={[styles.priorityChip, isActive && styles.priorityChipActive, { marginVertical: 4 }]}
                                onPress={() => setSelectedTimeSlot(isActive ? null : it)}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.priorityChipText, isActive && styles.priorityChipTextActive]}>{it.to ? `${it.from} to ${it.to}` : it.from}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </ScrollView>
                    <View style={styles.separator3}/>
                    <View style={styles.modalButtonRow}>
                      <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeTimeModal}>
                        <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.primaryButton, (!selectedTimeSlot || isSendingRequest) && { opacity: 0.6 }]}
                        onPress={() => { if (!selectedTimeSlot) return; handleSendMeetingRequest(selectedTimeSlot); }}
                        disabled={!selectedTimeSlot || isSendingRequest}
                      >
                        {isSendingRequest ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Send Request</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            ) : selectedAttendee && (
              <>
                {isRequestSuccess ? (
                  // Success State
                  <View style={styles.successContainer}>
                    <View style={styles.successIconContainer}>
                      <Icon name="check-circle" size={64} color={colors.primary} />
                    </View>
                    <Text style={styles.successTitle}>Request Sent Successfully!</Text>
                    <Text style={styles.successMessage}>
                      Your meeting request has been sent to {isDelegate ? selectedAttendee.name : (selectedAttendee.full_name || selectedAttendee.name)}.
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
                ) : isSendingRequest ? (
                  // Loading State
                  <View style={styles.loadingContainerModal}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingTextModal}>Sending request...</Text>
                  </View>
                ) : (
                  // Normal Form State
                  <>
                    <View style={styles.modalContactRow}>
                      <View style={styles.modalAvatar}>
                        {selectedAttendee.image ? (
                          <Image 
                            source={{ uri: selectedAttendee.image }} 
                            style={styles.avatarImage} 
                          />
                        ) : (
                          <View style={[styles.avatarImage, { backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' }]}>
                            <UserIcon size={24} color={colors.textMuted} />
                          </View>
                        )}
                      </View>
                      <View style={styles.modalContactInfo}>
                        <Text style={styles.modalContactName}>
                          {isDelegate
                            ? selectedAttendee.name
                            : (selectedAttendee.full_name || selectedAttendee.name)}
                        </Text>
                        <Text style={styles.modalContactCompany}>{selectedAttendee.company}</Text>
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
                    <View style={styles.separator3}/>
                    <View style={styles.modalButtonRow}>
                      <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                        <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.primaryButton]}
                        onPress={openTimeModal}
                      >
                        <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Select Time</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
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
  contentWrap: {
    flex: 1,
    paddingBottom: 14,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: 8,
  },
  searchBar: {
    marginTop: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  searchBarWrapper: {
    flex: 1,
    height: SIZES.filterHeight,
  },
  searchBarInline: {
    height: SIZES.filterHeight,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  selectServiceBtn: {
    flex: 1,
    backgroundColor: colors.white,
    height: SIZES.filterHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  selectServiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectServiceText: {
    color: colors.text,
    fontSize: 14,
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
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  countDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  countText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
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
  listContent: {
    paddingBottom: 130,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  rowRequested: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.6)',
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
  avatar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
    fontWeight: '600',
  },
  rowMeta1: {
    fontSize: 13,
    color: colors.primary,
  },
  rowMetaBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  requestButton: {
    alignSelf: 'flex-end',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 152,
    maxWidth: '100%',
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
    fontSize: SIZES.body,
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
  requestColumn: {
    flexShrink: 0,
    alignItems: 'flex-end',
    marginLeft: 6,
    maxWidth: '52%',
    gap: 4,
  },
  meetingScheduleBelowButton: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 13,
  },
  availabilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.gray100,
  },
  availabilityPillAvailable: {
    backgroundColor: '#DCFCE7',
  },
  availabilityPillUnavailable: {
    backgroundColor: '#FEE2E2',
  },
  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray400 || '#9CA3AF',
    marginRight: 4,
  },
  availabilityDotAvailable: {
    backgroundColor: '#16A34A',
  },
  availabilityDotUnavailable: {
    backgroundColor: '#DC2626',
  },
  availabilityText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  // Modal styles (aligned with EventOverview)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdropPressable: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalCenterWrap: {
    width: '100%',
    paddingHorizontal: 24,
  },
  modalCard: {
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
  modalTitle: {
    fontSize: SIZES.title,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: isTablet ? 460 : 360,
  },
  modalListContent: {
    paddingVertical: 6,
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
  modalButtonRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  modalCloseBtn: {
    flex: 1,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(138, 52, 144, 0.12)',
    alignItems: 'center',
  },
  modalClearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  modalCloseText: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalClearText: {
    color: '#EF4444',
  },
  modalLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
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
    paddingHorizontal: 32,
  },
  // Meeting Request Modal styles
  modalBackdrop2: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
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

export default AttendeesScreen;


