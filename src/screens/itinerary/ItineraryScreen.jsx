import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { SearchBar } from '../../components/common/SearchBar';
import { colors, radius } from '../../constants/theme';
import {
  useDelegateDeleteItineraryMeetingMutation,
  useDelegateModifyItineraryMeetingMutation,
  useGetDelegateItineraryQuery,
  useGetDelegateMeetingLocationsQuery,
  useGetDelegateMeetingTimesQuery,
  useGetSponsorItineraryQuery,
  useGetSponsorMeetingLocationsQuery,
  useGetSponsorMeetingTimesQuery,
  useSponsorDeleteItineraryMeetingMutation,
  useSponsorModifyItineraryMeetingMutation
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const FILTERS = ['All Days', 'Today', 'Tomorrow'];

const parseApiDate = (dateString) => {
  if (!dateString) return null;
  const raw = String(dateString).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = parseApiDate(dateString);
    if (!date) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    return dateString;
  }
};

const formatTime = (timeString) => {
  if (!timeString) return '';
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch (e) {
    return timeString;
  }
};

/** Compare time strings from API vs slot (handles 7:30 vs 07:30:00) */
const normalizeHisComparable = (t) => {
  if (t == null || t === '') return '';
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return s;
  const h = String(Number(m[1])).padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const ss = (m[3] != null ? m[3] : '00').padStart(2, '0');
  return `${h}:${mm}:${ss}`;
};

/**
 * Same slot normalization as meeting request (SponsorDetailsScreen).
 */
const buildMeetingSlotGroups = (meetingTimesData, meetingDateYmd) => {
  if (!meetingTimesData) return [];

  const pickTimePart = (value) => {
    if (!value) return '';
    const str = String(value);
    if (str.includes(' ')) return str.split(' ')[1] || str;
    return str;
  };

  const toHHMM = (hhmmss) => {
    const s = String(hhmmss || '').trim();
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

  const formatDateDDMMYYYY = (yyyyMmDd) => {
    if (!yyyyMmDd) return '';
    const [y, mo, d] = String(yyyyMmDd).slice(0, 10).split('-');
    if (!y || !mo || !d) return String(yyyyMmDd);
    return `${d}-${mo}-${y}`;
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
              toFull
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

  const d = meetingDateYmd || '';
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
        return { id: slot?.id ?? rawTime, date: d, from: toHHMM(t), to: '', fromFull: t };
      }
      return {
        id: slot?.id ?? `${d}-${fromFull}-${toFull}`,
        date: d,
        from,
        to,
        fromFull,
        toFull
      };
    })
    .filter(Boolean);

  return items.length ? [{ date: d, dateLabel: formatDateDDMMYYYY(d), items }] : [];
};

const normalizeYmd = (dateRaw) => {
  if (!dateRaw) return '';
  const s = String(dateRaw).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
};

/** Inclusive list of calendar days between event date_from and date_to (YYYY-MM-DD). */
const enumerateEventDates = (dateFromStr, dateToStr) => {
  let from = (dateFromStr && String(dateFromStr).trim().slice(0, 10)) || '';
  let to = (dateToStr && String(dateToStr).trim().slice(0, 10)) || '';
  if (!from && !to) return [];
  if (!from) from = to;
  if (!to) to = from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];

  let d0 = parseApiDate(from);
  let d1 = parseApiDate(to);
  if (!d0 || !d1) return [];
  d0.setHours(0, 0, 0, 0);
  d1.setHours(0, 0, 0, 0);
  if (d0.getTime() > d1.getTime()) {
    const t = d0;
    d0 = d1;
    d1 = t;
  }

  const out = [];
  const cur = new Date(d0.getTime());
  while (cur <= d1) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const ymd = `${y}-${m}-${d}`;
    out.push({
      ymd,
      label: cur.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

const normalizeMeetingLocationLabel = (rawLabel, rawOther) => {
  const label = String(rawLabel ?? '').trim();
  const other = String(rawOther ?? '').trim();
  if (!label && !other) return '';
  if (label.toLowerCase() === 'other') return other || 'Other';
  return label || other;
};

const getEventIcon = (priority) => {
  const icons = ['📅', '🎤', '💼', '🤝', '🍽️', '🏆', '💡', '🎯'];
  const priorityNum = parseInt(priority, 10) || 1;
  return icons[(priorityNum - 1) % icons.length];
};

export const ItineraryScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Days');
  const [modifyOpen, setModifyOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);
  const [meetingDate, setMeetingDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [locationOther, setLocationOther] = useState('');
  const slotUserPickedRef = useRef(false);

  const { user } = useAppSelector((state) => state.auth);
  const { selectedEventId, selectedEventDateFrom, selectedEventDateTo } = useAppSelector((state) => state.event);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const isSponsor = loginType === 'sponsor';

  const {
    data: delegateItineraryData,
    isLoading: delegateLoading,
    error: delegateError,
    refetch: refetchDelegateItinerary
  } = useGetDelegateItineraryQuery(selectedEventId ? { event_id: Number(selectedEventId) } : undefined, {
    skip: !isDelegate,
    refetchOnMountOrArgChange: true
  });

  const {
    data: sponsorItineraryData,
    isLoading: sponsorLoading,
    error: sponsorError,
    refetch: refetchSponsorItinerary
  } = useGetSponsorItineraryQuery(selectedEventId ? { event_id: Number(selectedEventId) } : undefined, {
    skip: !isSponsor,
    refetchOnMountOrArgChange: true
  });

  /** Sponsor/other party changes are not pushed to this device — refetch when screen is focused or app resumes. */
  const refetchItinerary = useCallback(() => {
    if (isDelegate) refetchDelegateItinerary();
    else if (isSponsor) refetchSponsorItinerary();
  }, [isDelegate, isSponsor, refetchDelegateItinerary, refetchSponsorItinerary]);

  useFocusEffect(
    useCallback(() => {
      refetchItinerary();
    }, [refetchItinerary])
  );

  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        refetchItinerary();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [refetchItinerary]);

  const { data: delegateMeetingLocationsData } = useGetDelegateMeetingLocationsQuery(undefined, {
    skip: !isDelegate,
    refetchOnMountOrArgChange: true
  });
  const { data: sponsorMeetingLocationsData } = useGetSponsorMeetingLocationsQuery(undefined, {
    skip: !isSponsor,
    refetchOnMountOrArgChange: true
  });

  const meetingTimesParams = useMemo(() => {
    if (!modifyOpen || !editMeeting || !meetingDate) return null;
    const ymd = meetingDate.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const raw = Number(selectedEventId);
    const event_id = Number.isFinite(raw) && raw > 0 ? raw : 27;
    const p = { event_id, date: ymd };
    if (isDelegate) {
      const sid = editMeeting.sponsorId;
      if (sid != null && Number.isFinite(Number(sid))) p.target_sponsor_id = Number(sid);
    } else if (isSponsor) {
      const uid = user?.id != null ? Number(user.id) : null;
      const did = editMeeting.delegateId;
      const sid = editMeeting.sponsorId;
      if (uid != null && did != null && sid != null) {
        if (Number(sid) === uid) {
          p.target_delegate_id = Number(did);
        } else if (Number(did) === uid) {
          p.target_sponsor_id = Number(sid);
        } else {
          p.target_delegate_id = Number(did);
        }
      } else if (did != null && Number.isFinite(Number(did))) {
        p.target_delegate_id = Number(did);
      }
    }
    return p;
  }, [modifyOpen, editMeeting, meetingDate, selectedEventId, isDelegate, isSponsor, user?.id]);

  const { data: delegateMeetingTimesData, isLoading: delegateTimesLoading } = useGetDelegateMeetingTimesQuery(
    meetingTimesParams || {},
    {
      skip: !isDelegate || !meetingTimesParams
    }
  );
  const { data: sponsorMeetingTimesData, isLoading: sponsorTimesLoading } = useGetSponsorMeetingTimesQuery(
    meetingTimesParams || {},
    {
      skip: !isSponsor || !meetingTimesParams
    }
  );

  const meetingTimesData = isDelegate ? delegateMeetingTimesData : sponsorMeetingTimesData;
  const meetingTimesLoading = isDelegate ? delegateTimesLoading : sponsorTimesLoading;

  const meetingSlotGroups = useMemo(
    () => buildMeetingSlotGroups(meetingTimesData, meetingDate.trim().slice(0, 10)),
    [meetingTimesData, meetingDate]
  );

  const slotsForSelectedDate = useMemo(() => {
    const d = meetingDate.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return [];
    const g = meetingSlotGroups.find((x) => x.date === d);
    return g?.items ?? [];
  }, [meetingSlotGroups, meetingDate]);

  const [delegateDeleteItinerary, { isLoading: delegateDeleting }] = useDelegateDeleteItineraryMeetingMutation();
  const [delegateModifyItinerary, { isLoading: delegateModifying }] = useDelegateModifyItineraryMeetingMutation();
  const [sponsorDeleteItinerary, { isLoading: sponsorDeleting }] = useSponsorDeleteItineraryMeetingMutation();
  const [sponsorModifyItinerary, { isLoading: sponsorModifying }] = useSponsorModifyItineraryMeetingMutation();

  const deleteItinerary = isDelegate ? delegateDeleteItinerary : sponsorDeleteItinerary;
  const modifyItinerary = isDelegate ? delegateModifyItinerary : sponsorModifyItinerary;
  const actionBusy = isDelegate ? delegateDeleting || delegateModifying : sponsorDeleting || sponsorModifying;

  useEffect(() => {
    if (!modifyOpen || !editMeeting || meetingTimesLoading) return;
    const items = slotsForSelectedDate;
    if (!items.length) {
      if (!slotUserPickedRef.current) setSelectedTimeSlot(null);
      return;
    }
    if (slotUserPickedRef.current) return;
    const d = meetingDate.trim().slice(0, 10);
    if (d !== editMeeting.dateYmd) return;
    const raw = String(editMeeting.rawTime || '');
    const rawTo = String(editMeeting.rawTimeTo || '');
    const match = items.find(
      (it) =>
        it.toFull &&
        normalizeHisComparable(it.fromFull) === normalizeHisComparable(raw) &&
        normalizeHisComparable(it.toFull) === normalizeHisComparable(rawTo)
    );
    if (match) setSelectedTimeSlot(match);
  }, [modifyOpen, editMeeting, meetingTimesLoading, slotsForSelectedDate, meetingDate]);

  const onMeetingDateChange = useCallback((text) => {
    setMeetingDate(text);
    setSelectedTimeSlot(null);
    slotUserPickedRef.current = false;
  }, []);

  const eventDayOptions = useMemo(() => {
    const fromStore = enumerateEventDates(selectedEventDateFrom, selectedEventDateTo);
    if (fromStore.length > 0) return fromStore;
    if (modifyOpen && editMeeting?.dateYmd) {
      const ymd = normalizeYmd(editMeeting.dateYmd);
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        const dt = parseApiDate(ymd);
        return [
          {
            ymd,
            label: dt
              ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : ymd
          }
        ];
      }
    }
    return [];
  }, [selectedEventDateFrom, selectedEventDateTo, modifyOpen, editMeeting?.dateYmd]);

  const onSelectEventDay = useCallback(
    (ymd) => {
      const next = String(ymd).trim().slice(0, 10);
      const cur = meetingDate.trim().slice(0, 10);
      if (next === cur) return;
      setMeetingDate(next);
      setSelectedTimeSlot(null);
      slotUserPickedRef.current = false;
    },
    [meetingDate]
  );

  const isLoading = isDelegate ? delegateLoading : sponsorLoading;
  const error = isDelegate ? delegateError : sponsorError;
  const itineraryData = isDelegate ? delegateItineraryData : sponsorItineraryData;

  const meetingLocationOptions = useMemo(() => {
    const source = isDelegate ? delegateMeetingLocationsData : sponsorMeetingLocationsData;
    const raw = Array.isArray(source?.data) ? source.data : Array.isArray(source) ? source : [];
    return raw
      .map((item) => {
        const id = Number(item?.id ?? item?.meeting_location_option_id ?? item?.value);
        if (!Number.isFinite(id) || id <= 0) return null;
        const key = String(item?.key ?? item?.option_key ?? '').trim().toLowerCase();
        const label = String(item?.label ?? item?.name ?? item?.title ?? '').trim();
        return {
          id,
          key,
          label: label || `Option ${id}`,
          isOther: Boolean(item?.is_other) || key === 'other' || label.toLowerCase() === 'other'
        };
      })
      .filter(Boolean);
  }, [isDelegate, delegateMeetingLocationsData, sponsorMeetingLocationsData]);

  const selectedLocationOpt = useMemo(
    () => meetingLocationOptions.find((o) => o.id === Number(locationId)) || null,
    [meetingLocationOptions, locationId]
  );
  const requiresLocationOther = Boolean(selectedLocationOpt?.isOther);

  const { SIZES } = useMemo(() => {
    const isTabletDevice = SCREEN_WIDTH >= 768;
    const getValue = ({ tablet, default: defaultValue }) => {
      if (isTabletDevice && tablet !== undefined) return tablet;
      return defaultValue;
    };

    return {
      SIZES: {
        headerIconSize: getValue({ tablet: 25, default: 22 }),
        contentMaxWidth: getValue({ tablet: 620, default: '100%' }),
        paddingHorizontal: getValue({ tablet: 22, default: 16 }),
        cardPadding: getValue({ tablet: 16, default: 14 })
      }
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES), [SIZES]);

  const itineraryItems = useMemo(() => {
    const d = itineraryData;
    if (!d) return [];
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.data?.data)) return d.data.data;
    if (Array.isArray(d?.items)) return d.items;
    if (Array.isArray(d?.results)) return d.results;
    return [];
  }, [itineraryData]);

  const itinerary = useMemo(() => {
    if (!itineraryItems.length) return [];

    const groupedByDate = {};
    itineraryItems.forEach((item) => {
      const date = item.date || item.meeting_date || item.schedule_date || '';
      const groupKey = date || '__no_date__';
      if (!groupedByDate[groupKey]) groupedByDate[groupKey] = [];

      const sponsorName =
        item.sponsor_full_name ||
        item.sponsor_name ||
        item.sponsor ||
        `${(item.sponsor_fname || '')} ${(item.sponsor_lname || '')}`.trim();
      const delegateName =
        item.delegate_full_name ||
        item.delegate_name ||
        item.delegate ||
        `${(item.delegate_fname || '')} ${(item.delegate_lname || '')}`.trim();

      const fullName =
        (isDelegate ? sponsorName : delegateName) || sponsorName || delegateName || item.full_name || item.name || 'Unknown';

      const company =
        (isDelegate ? item.sponsor_company || item.company : item.delegate_company || item.company) || '';
      const jobTitle =
        (isDelegate ? item.sponsor_job_title || item.job_title : item.delegate_job_title || item.job_title) || '';
      const rawTime = (item.time || item.meeting_time || item.time_from || '').toString();
      const rawTimeTo = (item.time_to || item.meeting_time_to || '').toString();
      const time = formatTime(rawTime);
      const timeEnd = rawTimeTo ? formatTime(rawTimeTo) : '';
      const timeLine = timeEnd ? `${time} – ${timeEnd}` : time;
      const priority = item.priority || '1';
      const tableNo = item.table_no || '';
      const meetingLocation = normalizeMeetingLocationLabel(
        item.meeting_location_label ?? item.location_label ?? item.meeting_location,
        item.meeting_location_other ?? item.location_other
      );

      let subtitle = '';
      if (company) subtitle += company;
      if (jobTitle) subtitle += (subtitle ? ' • ' : '') + jobTitle;
      if (tableNo) subtitle += (subtitle ? ' • ' : '') + `Table ${tableNo}`;
      if (meetingLocation) subtitle += (subtitle ? ' • ' : '') + `Meeting Location: ${meetingLocation}`;
      if (!subtitle) subtitle = 'Meeting';

      const dateYmd = normalizeYmd(date);

      groupedByDate[groupKey].push({
        id: String(item.id),
        title: fullName,
        subtitle,
        icon: getEventIcon(priority),
        time: timeLine,
        rawTime,
        rawTimeTo,
        date,
        dateYmd,
        priority,
        sponsorId: item.sponsor_id != null ? Number(item.sponsor_id) : null,
        delegateId: item.delegate_id != null ? Number(item.delegate_id) : null,
        meetingLocationOptionId:
          item.meeting_location_option_id != null ? Number(item.meeting_location_option_id) : null,
        meetingLocationOther: item.meeting_location_other != null ? String(item.meeting_location_other) : ''
      });
    });

    return Object.keys(groupedByDate)
      .sort()
      .map((date) => {
        const isNoDate = date === '__no_date__';
        const dateObj = isNoDate ? null : parseApiDate(date);
        const formattedDate = isNoDate ? 'Itinerary' : formatDate(date);
        return {
          id: `day-${date}`,
          day: formattedDate,
          date: isNoDate ? '' : date,
          dateObj,
          events: groupedByDate[date].sort((a, b) => {
            const timeA = (a?.rawTime || '').toString();
            const timeB = (b?.rawTime || '').toString();
            return timeA.localeCompare(timeB);
          })
        };
      });
  }, [itineraryItems, isDelegate]);

  const filteredItinerary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return itinerary.filter((day) => {
      if (activeFilter === 'Today') {
        const dayDate = parseApiDate(day.date);
        if (!dayDate) return false;
        dayDate.setHours(0, 0, 0, 0);
        if (dayDate.getTime() !== today.getTime()) return false;
      } else if (activeFilter === 'Tomorrow') {
        const dayDate = parseApiDate(day.date);
        if (!dayDate) return false;
        dayDate.setHours(0, 0, 0, 0);
        if (dayDate.getTime() !== tomorrow.getTime()) return false;
      }

      if (!q) return true;
      return day.events.some(
        (event) => event.title.toLowerCase().includes(q) || event.subtitle.toLowerCase().includes(q)
      );
    });
  }, [activeFilter, searchQuery, itinerary]);

  const openModify = useCallback((ev) => {
    slotUserPickedRef.current = false;
    setEditMeeting(ev);
    setMeetingDate(ev.dateYmd || normalizeYmd(ev.date) || '');
    setSelectedTimeSlot(null);
    setLocationId(ev.meetingLocationOptionId != null ? String(ev.meetingLocationOptionId) : '');
    setLocationOther(ev.meetingLocationOther || '');
    setModifyOpen(true);
  }, []);

  const closeModify = useCallback(() => {
    setModifyOpen(false);
    setEditMeeting(null);
    setSelectedTimeSlot(null);
    slotUserPickedRef.current = false;
  }, []);

  const onConfirmDelete = useCallback(
    (ev) => {
      Alert.alert(
        'Remove meeting',
        'Remove this confirmed meeting from your itinerary? The other participant will also no longer see it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await deleteItinerary({ meeting_request_id: Number(ev.id) }).unwrap();
                if (res?.success === false) {
                  Alert.alert('Could not delete', res?.message || 'Please try again.');
                }
              } catch (e) {
                const msg = e?.data?.message || e?.message || 'Please try again.';
                Alert.alert('Could not delete', msg);
              }
            }
          }
        ]
      );
    },
    [deleteItinerary]
  );

  const onSaveModify = useCallback(async () => {
    if (!editMeeting) return;
    const id = Number(editMeeting.id);
    const optId = Number(locationId);
    if (!meetingDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate.trim())) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD for the meeting date.');
      return;
    }
    if (!selectedTimeSlot?.fromFull || !selectedTimeSlot?.toFull) {
      Alert.alert('Time slot', 'Choose one of the available time slots for this date.');
      return;
    }
    if (!Number.isFinite(optId) || optId <= 0) {
      Alert.alert('Location required', 'Select a meeting location.');
      return;
    }
    if (requiresLocationOther && !locationOther.trim()) {
      Alert.alert('Details required', 'Enter details for the selected location.');
      return;
    }

    const body = {
      meeting_request_id: id,
      meeting_date: meetingDate.trim(),
      meeting_time_from: String(selectedTimeSlot.fromFull).trim(),
      meeting_time_to: String(selectedTimeSlot.toFull).trim(),
      meeting_location_option_id: optId,
      meeting_location_other: requiresLocationOther ? locationOther.trim() : ''
    };

    try {
      const res = await modifyItinerary(body).unwrap();
      if (res?.success === false) {
        Alert.alert('Could not update', res?.message || 'Please try again.');
        return;
      }
      closeModify();
    } catch (e) {
      const msg = e?.data?.message || e?.message || 'Please try again.';
      Alert.alert('Could not update', msg);
    }
  }, [
    editMeeting,
    meetingDate,
    selectedTimeSlot,
    locationId,
    locationOther,
    requiresLocationOther,
    modifyItinerary,
    closeModify
  ]);

  const renderEvent = (event) => (
    <View style={styles.eventCard}>
      <View style={styles.eventIcon}>
        <Text style={styles.eventIconText}>{event.icon}</Text>
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventSubtitle}>{event.subtitle}</Text>
        <Text style={styles.eventTime}>{event.time}</Text>
        <View style={styles.eventActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openModify(event)}
            activeOpacity={0.85}
            disabled={actionBusy}
          >
            <Text style={styles.actionBtnText}>Modify</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => onConfirmDelete(event)}
            activeOpacity={0.85}
            disabled={actionBusy}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title='Itinerary'
        leftIcon='menu'
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
      />

      <View style={styles.content}>
        <SearchBar
          placeholder='Search events'
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />

        <View style={styles.filterRow}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{filter}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color={colors.primary} />
            <Text style={styles.loadingText}>Loading itinerary...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {error?.data?.message || error?.message || 'Failed to load itinerary'}
            </Text>
          </View>
        ) : filteredItinerary.length > 0 ? (
          <FlatList
            data={filteredItinerary}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.daySection}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{item.day}</Text>
                  <View style={styles.dayDivider} />
                </View>
                {item.events.map((event) => (
                  <View key={event.id} style={styles.eventWrapper}>
                    {renderEvent(event)}
                  </View>
                ))}
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No itinerary items found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Your itinerary will appear here'}
            </Text>
          </View>
        )}
      </View>

      <Modal visible={modifyOpen} animationType='slide' transparent onRequestClose={closeModify}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modify meeting</Text>
            <Text style={styles.modalHint}>Update date, time slot, or location. Both participants see the change.</Text>
            <ScrollView keyboardShouldPersistTaps='handled' showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Event day</Text>
              <Text style={styles.slotSubhint}>Select the day, then choose a time slot.</Text>
              {eventDayOptions.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.eventDayScroll}
                  contentContainerStyle={styles.eventDayScrollContent}
                >
                  {eventDayOptions.map((day) => {
                    const active = meetingDate.trim().slice(0, 10) === day.ymd;
                    return (
                      <TouchableOpacity
                        key={day.ymd}
                        style={[styles.eventDayChip, active && styles.eventDayChipActive]}
                        onPress={() => onSelectEventDay(day.ymd)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.eventDayChipTitle, active && styles.eventDayChipTitleActive]} numberOfLines={2}>
                          {day.label}
                        </Text>
                        <Text style={[styles.eventDayChipYmd, active && styles.eventDayChipYmdActive]}>{day.ymd}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <>
                  <Text style={styles.slotSubhint}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.textField}
                    value={meetingDate}
                    onChangeText={onMeetingDateChange}
                    placeholder='2026-04-10'
                    autoCapitalize='none'
                    autoCorrect={false}
                  />
                </>
              )}
              <Text style={styles.fieldLabel}>Time slot</Text>
              {meetingTimesLoading ? (
                <View style={styles.slotLoading}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.slotLoadingText}>Loading time slots...</Text>
                </View>
              ) : slotsForSelectedDate.length === 0 ? (
                <Text style={styles.noSlotsText}>
                  No time slots for this date. Adjust the date or ensure the other participant is selected for slot
                  availability.
                </Text>
              ) : (
                <ScrollView
                  style={styles.timeSlotScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps='handled'
                  showsVerticalScrollIndicator
                >
                  {slotsForSelectedDate.map((it) => {
                    const isActive =
                      selectedTimeSlot &&
                      normalizeHisComparable(selectedTimeSlot.fromFull) === normalizeHisComparable(it.fromFull) &&
                      normalizeHisComparable(selectedTimeSlot.toFull) === normalizeHisComparable(it.toFull);
                    const label = it.to ? `${it.from} to ${it.to}` : it.from;
                    const key = `${it.date}-${it.fromFull}-${it.toFull}`;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.timeSlotChip, isActive && styles.timeSlotChipActive]}
                        onPress={() => {
                          slotUserPickedRef.current = true;
                          setSelectedTimeSlot(isActive ? null : it);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.timeSlotChipText, isActive && styles.timeSlotChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              <Text style={styles.fieldLabel}>Location</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.locScroll}>
                {meetingLocationOptions.map((opt) => {
                  const active = String(locationId) === String(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.locChip, active && styles.locChipActive]}
                      onPress={() => setLocationId(String(opt.id))}
                    >
                      <Text style={[styles.locChipText, active && styles.locChipTextActive]} numberOfLines={2}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {requiresLocationOther ? (
                <>
                  <Text style={styles.fieldLabel}>Location details</Text>
                  <TextInput
                    style={[styles.textField, styles.textFieldMultiline]}
                    value={locationOther}
                    onChangeText={setLocationOther}
                    placeholder='Enter details'
                    multiline
                  />
                </>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={closeModify} disabled={actionBusy}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSave,
                  (actionBusy ||
                    meetingTimesLoading ||
                    slotsForSelectedDate.length === 0 ||
                    !selectedTimeSlot) &&
                    styles.modalSaveDisabled
                ]}
                onPress={onSaveModify}
                disabled={
                  actionBusy ||
                  meetingTimesLoading ||
                  slotsForSelectedDate.length === 0 ||
                  !selectedTimeSlot
                }
              >
                {actionBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (SIZES) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: SIZES.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: SIZES.paddingHorizontal,
      paddingTop: 12
    },
    searchBar: {
      marginTop: 12
    },
    filterRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16
    },
    filterChip: {
      borderRadius: radius.pill,
      backgroundColor: colors.gray100,
      paddingHorizontal: 18,
      paddingVertical: 8
    },
    filterChipActive: {
      backgroundColor: colors.primary
    },
    filterText: {
      fontWeight: '600',
      color: colors.text
    },
    filterTextActive: {
      color: colors.white
    },
    listContent: {
      paddingBottom: 40,
      gap: 24
    },
    daySection: {
      gap: 12
    },
    dayHeader: {
      marginBottom: 4
    },
    dayTitle: {
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4
    },
    dayDivider: {
      width: 40,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.primary
    },
    eventWrapper: {
      marginBottom: 12
    },
    eventCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SIZES.cardPadding,
      borderRadius: 16
    },
    eventIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: 'rgba(138, 52, 144, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12
    },
    eventIconText: {
      fontSize: 20
    },
    eventInfo: {
      flex: 1
    },
    eventTitle: {
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4
    },
    eventSubtitle: {
      color: colors.textMuted,
      marginBottom: 6
    },
    eventTime: {
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 10
    },
    eventActions: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap'
    },
    actionBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.gray100,
      borderWidth: 1,
      borderColor: colors.border
    },
    actionBtnDanger: {
      backgroundColor: 'rgba(220, 53, 69, 0.08)',
      borderColor: 'rgba(220, 53, 69, 0.35)'
    },
    actionBtnText: {
      fontWeight: '600',
      fontSize: 13,
      color: colors.text
    },
    actionBtnDangerText: {
      color: '#c62828'
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40
    },
    loadingText: {
      marginTop: 16,
      fontSize: 14,
      color: colors.textMuted
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 40
    },
    errorText: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center'
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center'
    },
    emptySubtext: {
      marginTop: 8,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 32
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: 20
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      maxHeight: '90%',
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center'
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6
    },
    modalHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 14
    },
    slotSubhint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 8
    },
    slotLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12
    },
    slotLoadingText: {
      fontSize: 14,
      color: colors.textMuted
    },
    noSlotsText: {
      fontSize: 13,
      color: colors.textMuted,
      paddingVertical: 10,
      lineHeight: 18
    },
    timeSlotScroll: {
      maxHeight: 220,
      marginBottom: 8
    },
    timeSlotChip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.gray100,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8
    },
    timeSlotChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    timeSlotChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text
    },
    timeSlotChipTextActive: {
      color: colors.white
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
      marginTop: 10
    },
    textField: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background
    },
    textFieldMultiline: {
      minHeight: 72,
      textAlignVertical: 'top'
    },
    locScroll: {
      marginTop: 4,
      marginBottom: 4,
      maxHeight: 44
    },
    locChip: {
      marginRight: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.gray100,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: 200
    },
    locChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    locChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text
    },
    locChipTextActive: {
      color: colors.white
    },
    eventDayScroll: {
      marginBottom: 10,
      maxHeight: 88
    },
    eventDayScrollContent: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: 4,
      paddingRight: 8
    },
    eventDayChip: {
      minWidth: 112,
      maxWidth: 160,
      marginRight: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.gray100,
      borderWidth: 1,
      borderColor: colors.border
    },
    eventDayChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    eventDayChipTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text
    },
    eventDayChipTitleActive: {
      color: colors.white
    },
    eventDayChipYmd: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
      marginTop: 4
    },
    eventDayChipYmdActive: {
      color: 'rgba(255,255,255,0.9)'
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 16,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border
    },
    modalCancel: {
      paddingVertical: 10,
      paddingHorizontal: 16
    },
    modalCancelText: {
      fontWeight: '600',
      color: colors.textMuted,
      fontSize: 16
    },
    modalSave: {
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 22,
      borderRadius: radius.pill,
      minWidth: 100,
      alignItems: 'center'
    },
    modalSaveDisabled: {
      opacity: 0.6
    },
    modalSaveText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 16
    }
  });

export default ItineraryScreen;
