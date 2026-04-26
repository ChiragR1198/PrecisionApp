import Icon from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
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
import { Icons } from '../../constants/icons';
import { colors, radius } from '../../constants/theme';
import {
  useGetDelegateEventSponsorLogosQuery,
  useGetDelegateEventsQuery,
  useGetSponsorEventSponsorLogosQuery,
  useGetSponsorEventsQuery,
} from '../../store/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearAuth } from '../../store/slices/authSlice';
import { setSelectedEvent } from '../../store/slices/eventSlice';
import { normalizeWebcoverSlideUris } from '../../utils/eventWebcoverSlides';
import { normalizeWebsiteUrl } from '../../utils/normalizeWebsiteUrl';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { stripHtml } from '../../utils/stripHtml';

// Icon Components
const CalendarIcon = Icons.Calendar;
const ChevronDownIcon = Icons.ChevronDown;
const MapPinIcon = Icons.MapPin;
const CalendarIconPrimary = Icons.CalendarPrimary;
const ListIcon = Icons.List;
const UsersIcon = Icons.Users;
const SponsorsIcon = Icons.Briefcase;

/** Match `sponsorLogoChip` width (72) + marginRight (10) for auto-scroll / getItemLayout */
const SPONSOR_LOGO_STRIDE = 72 + 10;
const SPONSOR_AUTO_SCROLL_INTERVAL_MS = 3200;
const SPONSOR_RESUME_AFTER_MODAL_MS = 2800;
const SPONSOR_RESUME_AFTER_DRAG_MS = 4500;

/** Display string from API only — formatted on backend (`date_display`). */
/** Unwrap RTK response for event-sponsor-logos list */
function extractEventSponsorLogosList(response) {
  if (response == null) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

const getEventDateDisplayFromApi = (event) => {
  const v = event?.date_display;
  if (v == null) return '';
  const s = String(v).trim();
  return s;
};

// Helper function to calculate dynamic font size based on title length
const getDynamicFontSize = (title, baseSize, minSize = 12) => {
  if (!title) return baseSize;
  const titleLength = title.length;
  
  // Adjust font size based on length
  if (titleLength > 60) {
    return Math.max(minSize, baseSize - 4);
  } else if (titleLength > 45) {
    return Math.max(minSize, baseSize - 3);
  } else if (titleLength > 30) {
    return Math.max(minSize, baseSize - 2);
  } else if (titleLength > 20) {
    return Math.max(minSize, baseSize - 1);
  }
  return baseSize;
};

// Update: make CurrentEventCard controlled with dropdown
const CurrentEventCard = ({ styles, SIZES, selectedEvent, selectedIndex, isOpen, onToggle, onSelect, options }) => {
  const dynamicTitleSize = getDynamicFontSize(selectedEvent?.title, SIZES.headerTitleSize, 11);
  
  return (
    <TouchableOpacity style={[styles.currentEventCard, isOpen && styles.currentEventCardOpen]} activeOpacity={0.9} onPress={onToggle}>
      <View style={styles.currentEventContent}>
        <View style={styles.currentEventIcon}>
          <CalendarIcon size={SIZES.currentEventIconSize} />
        </View>
        <View style={styles.currentEventText}>
          <Text style={[styles.currentEventTitle, { fontSize: dynamicTitleSize }]} numberOfLines={2} ellipsizeMode="tail">{selectedEvent?.title}</Text>
          <Text style={styles.currentEventSubtitle}>Current Event</Text>
        </View>
        <View style={styles.currentEventChevron}>
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={SIZES.chevronSize} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

/** Use DB `venu_details` (address) for maps; include `location` (venu_title) when both exist for better search results. */
const getMapSearchQueryForEvent = (event) => {
  const details = String(event?.venueDetails ?? '').trim();
  const title = String(event?.location ?? '').trim();
  if (details && title) return `${title}, ${details}`;
  if (details) return details;
  if (title) return title;
  return '';
};

const LOCAL_BANNER_BG = require('../../assets/images/dashboard-banner.jpg');

/**
 * Slides: `webcover_slides[]` from backend (config/event_webcover.php), then API banner + listing if unique.
 */
function buildEventBannerSlides(event) {
  const localSlide = { kind: 'local', source: LOCAL_BANNER_BG };
  const seen = new Set();
  const remoteSlides = [];

  const pushUri = (raw) => {
    if (raw == null || raw === '') return;
    const u = resolveMediaUrl(String(raw).trim());
    if (u && !seen.has(u)) {
      seen.add(u);
      remoteSlides.push({ kind: 'uri', uri: u });
    }
  };

  for (const u of normalizeWebcoverSlideUris(event?.webcover_slides)) {
    if (u && !seen.has(u)) {
      seen.add(u);
      remoteSlides.push({ kind: 'uri', uri: u });
    }
  }
  pushUri(event?.banner_image);
  pushUri(event?.event_image);

  if (remoteSlides.length === 0) return [localSlide, localSlide];
  if (remoteSlides.length === 1) return [remoteSlides[0], localSlide];
  return remoteSlides;
}

const BANNER_AUTO_MS = 5500;

const MainEventBanner = ({ styles, SIZES, event }) => {
  const { width: winW } = useWindowDimensions();
  const h = SIZES.isTablet ? 288 : 236;
  const dynamicBannerTitleSize = getDynamicFontSize(event?.title, SIZES.mainEventTitleSize, 16);
  const mapQuery = getMapSearchQueryForEvent(event);
  const canOpenMap = mapQuery.length > 0;
  const venueTitle = String(event?.location ?? '').trim();
  const venueAddress = String(event?.venueDetails ?? '').trim();
  const showVenueBlock = venueTitle.length > 0 || venueAddress.length > 0;
  const listRef = useRef(null);
  const slideIndexRef = useRef(0);
  const estW = Math.max(1, winW - SIZES.paddingHorizontal * 3);
  const [bannerW, setBannerW] = useState(estW);
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = useMemo(
    () => buildEventBannerSlides(event),
    [event?.id, event?.webcover_slides, event?.banner_image, event?.event_image]
  );

  const openVenueInMaps = async () => {
    if (!canOpenMap) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.warn('Open maps failed', e);
    }
  };

  const goToSlide = React.useCallback(
    (nextIdx, animated = true) => {
      const n = slides.length ? ((nextIdx % slides.length) + slides.length) % slides.length : 0;
      slideIndexRef.current = n;
      setSlideIndex(n);
      const w = Math.round(bannerW);
      if (listRef.current && w > 0) {
        try {
          listRef.current.scrollToOffset({ offset: n * w, animated });
        } catch (err) {
          console.warn('banner scrollToOffset', err);
        }
      }
    },
    [slides.length, bannerW]
  );

  useEffect(() => {
    slideIndexRef.current = 0;
    setSlideIndex(0);
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      } catch (_) {}
    });
  }, [event?.id]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const t = setInterval(() => {
      goToSlide(slideIndexRef.current + 1, true);
    }, BANNER_AUTO_MS);
    return () => clearInterval(t);
  }, [slides.length, bannerW, goToSlide]);

  const onBannerLayout = (e) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && Math.abs(w - bannerW) > 1) setBannerW(w);
  };

  const onMomentumScrollEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = Math.round(bannerW);
    if (w <= 0) return;
    const i = Math.min(slides.length - 1, Math.max(0, Math.round(x / w)));
    slideIndexRef.current = i;
    setSlideIndex(i);
  };

  useEffect(() => {
    const w = Math.round(bannerW);
    if (w <= 0 || !listRef.current) return;
    const i = slideIndexRef.current;
    try {
      listRef.current.scrollToOffset({ offset: i * w, animated: false });
    } catch (_) {}
  }, [bannerW]);

  const showArrows = slides.length > 1;
  const itemW = Math.round(bannerW);

  const renderSlide = React.useCallback(
    ({ item: slide }) => (
      <View style={[styles.mainEventBannerPage, { width: itemW || estW, height: h }]}>
        {slide.kind === 'local' ? (
          <ExpoImage
            source={slide.source}
            style={styles.mainEventBannerPageImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <ExpoImage
            source={{ uri: slide.uri }}
            style={styles.mainEventBannerPageImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={150}
            allowDownscaling={false}
          />
        )}
      </View>
    ),
    [itemW, estW, h, styles.mainEventBannerPage, styles.mainEventBannerPageImage]
  );

  return (
    <View style={[styles.mainEventBannerContainer, { minHeight: h }]} onLayout={onBannerLayout}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(_, idx) => `banner-${event?.id ?? 'e'}-${idx}`}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: itemW || estW,
          offset: (itemW || estW) * index,
          index,
        })}
        renderItem={renderSlide}
        style={[styles.mainEventBannerScroll, { height: h }]}
        extraData={itemW}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Hit-through overlay so horizontal swipe works on sides; arrows + text stay tappable */}
      <View style={styles.mainEventBannerOverlayWrap} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(25, 10, 45, 0.06)', 'rgba(40, 16, 62, 0.16)', 'rgba(28, 10, 48, 0.38)']}
          locations={[0, 0.42, 1]}
          style={[styles.mainEventBannerOverlayTint, { minHeight: h }]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
        />
        {showArrows ? (
          <>
            <TouchableOpacity
              style={[styles.bannerArrow, styles.bannerArrowLeft]}
              onPress={() => goToSlide(slideIndexRef.current - 1)}
              activeOpacity={0.85}
              hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Previous banner image"
            >
              <View style={styles.bannerArrowInner}>
                <Icon name="chevron-left" size={22} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bannerArrow, styles.bannerArrowRight]}
              onPress={() => goToSlide(slideIndexRef.current + 1)}
              activeOpacity={0.85}
              hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Next banner image"
            >
              <View style={styles.bannerArrowInner}>
                <Icon name="chevron-right" size={22} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        <View style={styles.mainEventBannerTextBlock} pointerEvents="box-none">
          <Text style={[styles.mainEventTitle, { fontSize: dynamicBannerTitleSize }]} numberOfLines={3} ellipsizeMode="tail">
            {event?.title}
          </Text>
          {event?.date ? <Text style={styles.mainEventDate}>{event.date}</Text> : null}
          {showVenueBlock ? (
            canOpenMap ? (
              <TouchableOpacity
                style={styles.mainEventLocation}
                onPress={openVenueInMaps}
                activeOpacity={0.75}
                accessibilityRole="link"
                accessibilityLabel={`Open map for ${mapQuery}`}
              >
                <View style={styles.mainEventMapPinWrap}>
                  <MapPinIcon size={SIZES.mapPinSize} />
                </View>
                <View style={styles.mainEventLocationTextCol}>
                  {venueTitle ? (
                    <Text style={[styles.mainEventLocationText, styles.mainEventLocationTextLink]}>
                      {venueTitle}
                    </Text>
                  ) : null}
                  {venueAddress ? (
                    <Text
                      style={[styles.mainEventVenueAddress, venueTitle && styles.mainEventVenueAddressBelow]}
                    >
                      {venueAddress}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.mainEventLocation}>
                <View style={styles.mainEventMapPinWrap}>
                  <MapPinIcon size={SIZES.mapPinSize} />
                </View>
                <View style={styles.mainEventLocationTextCol}>
                  {venueTitle ? (
                    <Text style={styles.mainEventLocationText}>{venueTitle}</Text>
                  ) : null}
                  {venueAddress ? (
                    <Text
                      style={[styles.mainEventVenueAddress, venueTitle && styles.mainEventVenueAddressBelow]}
                    >
                      {venueAddress}
                    </Text>
                  ) : null}
                </View>
              </View>
            )
          ) : null}
        </View>
      </View>
    </View>
  );
};

// Quick Action Card Component
const QuickActionCard = ({ 
  title, 
  subtitle, 
  icon, 
  iconColor, 
  backgroundColor, 
  styles, 
  SIZES,
  onPress 
}) => (
  <TouchableOpacity style={styles.quickActionCard} onPress={onPress} activeOpacity={1}>
    <View style={styles.quickActionContent}>
      <View style={[styles.quickActionIcon, { backgroundColor }]}> 
        {icon}
      </View>
      <Text style={styles.quickActionTitle}>{title}</Text>
      <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
    </View>
  </TouchableOpacity>
);

// Main DashboardScreen Component
export const DashboardScreen = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const scrollViewRef = useRef(null);
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  
  // Fetch events based on user type
  // Delegate: use /delegate/events
  // Sponsor: use /sponsor/events
  const { data: delegateEventsData, isLoading: delegateLoading, error: delegateError, refetch: delegateRefetch } = useGetDelegateEventsQuery(undefined, {
    skip: !isAuthenticated || !user || !isDelegate, // Skip for sponsors
    refetchOnMountOrArgChange: true,
  });
  
  const { data: sponsorEventsData, isLoading: sponsorLoading, error: sponsorError, refetch: sponsorRefetch } = useGetSponsorEventsQuery(undefined, {
    skip: !isAuthenticated || !user || isDelegate, // Skip for delegates
    refetchOnMountOrArgChange: true,
  });
  
  // Use appropriate data based on user type
  const eventsData = isDelegate ? delegateEventsData : sponsorEventsData;
  const isLoading = isDelegate ? delegateLoading : sponsorLoading;
  const error = isDelegate ? delegateError : sponsorError;
  const refetch = isDelegate ? delegateRefetch : sponsorRefetch;
  
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return 'Failed to load events.';
  }, [error]);
  
  // Check for auth errors and redirect to login
  useEffect(() => {
    if (error && (error.status === 401 || error.status === 'NO_TOKEN' || error.status === 403 || error.status === 'AUTH_REQUIRED')) {
      // Token expired, invalid, or permission denied - redirect to login
      dispatch(clearAuth());
      // Use setTimeout to ensure navigation happens after component is mounted
      setTimeout(() => {
        try {
          router.replace('/login');
        } catch (navError) {
          console.warn('⚠️ Navigation error:', navError);
        }
      }, 100);
    }
  }, [error, dispatch]);
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);

  // Transform API event data to display format
  const EVENTS = useMemo(() => {
    if (!eventsData) {
      return [];
    }

    // Handle different API response structures
    let events = [];

    // Case 1: eventsData.data is an array (most common)
    if (Array.isArray(eventsData.data)) {
      events = eventsData.data;
    }
    // Case 2: eventsData itself is an array
    else if (Array.isArray(eventsData)) {
      events = eventsData;
    }
    // Case 3: eventsData.data is a single object
    else if (eventsData.data && typeof eventsData.data === 'object' && !Array.isArray(eventsData.data)) {
      events = [eventsData.data];
    }
    // Case 4: eventsData is a single object
    else if (eventsData && typeof eventsData === 'object' && !Array.isArray(eventsData) && eventsData.id) {
      events = [eventsData];
    }

    if (events.length === 0) {
      return [];
    }

    // Remove duplicates based on event ID (handle both string and number IDs)
    const seenIds = new Set();
    const uniqueEvents = events.filter((event) => {
      if (!event || !event.id) {
        return false;
      }
      // Normalize ID to string for comparison
      const eventId = String(event.id);
      if (seenIds.has(eventId)) {
        return false; // Duplicate, filter it out
      }
      seenIds.add(eventId);
      return true;
    });

    // Transform to display format
    const transformed = uniqueEvents.map((ev) => ({
      id: ev.id,
      title: ev.title || 'Untitled Event',
      date: getEventDateDisplayFromApi(ev),
      location: ev.location || ev.venue || '',
      venueDetails: (() => {
        const raw = ev.venue_details ?? ev.venu_details;
        if (raw == null || String(raw).trim() === '') return '';
        return stripHtml(String(raw)).trim();
      })(),
      date_from: ev.date_from,
      date_to: ev.date_to,
      banner_image: ev.banner_image ?? null,
      event_image: ev.image ?? null,
      category_id: ev.category_id,
      webcover_slides: Array.isArray(ev.webcover_slides) ? ev.webcover_slides : [],
      categoryId: ev.categoryId,
    }));

    return transformed;
  }, [eventsData, isDelegate]);

  const selectedEvent = EVENTS[selectedEventIndex] || null;

  const [sponsorLogoModal, setSponsorLogoModal] = useState(null);

  const eventIdForLogos = useMemo(() => {
    if (!selectedEvent?.id) return null;
    const raw = selectedEvent.id;
    const n =
      typeof raw === 'string' && raw.includes(',')
        ? Number(String(raw).split(',')[0].trim())
        : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectedEvent?.id]);

  const logosQuerySkip = !isAuthenticated || !user || eventIdForLogos == null;

  const { data: delegateLogoPayload } = useGetDelegateEventSponsorLogosQuery(eventIdForLogos, {
    skip: logosQuerySkip || !isDelegate,
  });
  const { data: sponsorLogoPayload } = useGetSponsorEventSponsorLogosQuery(eventIdForLogos, {
    skip: logosQuerySkip || isDelegate,
  });

  const sponsorLogosList = useMemo(() => {
    const payload = isDelegate ? delegateLogoPayload : sponsorLogoPayload;
    return extractEventSponsorLogosList(payload);
  }, [isDelegate, delegateLogoPayload, sponsorLogoPayload]);

  const sponsorLogosFlatListRef = useRef(null);
  const sponsorLogoScrollIndexRef = useRef(0);
  const sponsorAutoScrollPausedRef = useRef(false);
  const sponsorResumeTimerRef = useRef(null);

  const clearSponsorResumeTimer = useCallback(() => {
    if (sponsorResumeTimerRef.current) {
      clearTimeout(sponsorResumeTimerRef.current);
      sponsorResumeTimerRef.current = null;
    }
  }, []);

  const pauseSponsorAutoScroll = useCallback(() => {
    sponsorAutoScrollPausedRef.current = true;
    clearSponsorResumeTimer();
  }, [clearSponsorResumeTimer]);

  const scheduleResumeSponsorAutoScroll = useCallback(
    (ms) => {
      clearSponsorResumeTimer();
      sponsorResumeTimerRef.current = setTimeout(() => {
        sponsorResumeTimerRef.current = null;
        sponsorAutoScrollPausedRef.current = false;
      }, ms);
    },
    [clearSponsorResumeTimer]
  );

  useEffect(() => {
    if (sponsorLogoModal != null) {
      pauseSponsorAutoScroll();
      return () => clearSponsorResumeTimer();
    }
    scheduleResumeSponsorAutoScroll(SPONSOR_RESUME_AFTER_MODAL_MS);
    return () => clearSponsorResumeTimer();
  }, [sponsorLogoModal, pauseSponsorAutoScroll, scheduleResumeSponsorAutoScroll, clearSponsorResumeTimer]);

  useEffect(() => {
    if (sponsorLogosList.length <= 1) return undefined;
    const id = setInterval(() => {
      if (sponsorAutoScrollPausedRef.current) return;
      const n = sponsorLogosList.length;
      const next = (sponsorLogoScrollIndexRef.current + 1) % n;
      sponsorLogoScrollIndexRef.current = next;
      sponsorLogosFlatListRef.current?.scrollToIndex({
        index: next,
        animated: true,
        viewPosition: 0,
      });
    }, SPONSOR_AUTO_SCROLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [sponsorLogosList.length]);

  const handleEventSelect = (index) => {
    setSelectedEventIndex(index);
    setIsEventDropdownOpen(false);
    // Update Redux store with selected event
    const event = EVENTS[index];
    if (event?.id) {
      // Ensure eventId is a number (not a comma-separated string)
      const eventId = typeof event.id === 'string' && event.id.includes(',') 
        ? Number(event.id.split(',')[0].trim())
        : Number(event.id);
      dispatch(setSelectedEvent({ eventId, index, dateFrom: event?.date_from, dateTo: event?.date_to }));
    }
  };

  // Update Redux store when events are loaded and initial selection is made
  useEffect(() => {
    if (EVENTS.length > 0 && selectedEventIndex >= 0 && selectedEventIndex < EVENTS.length) {
      const event = EVENTS[selectedEventIndex];
      if (event?.id) {
        // Ensure eventId is a number (not a comma-separated string)
        const eventId = typeof event.id === 'string' && event.id.includes(',') 
          ? Number(event.id.split(',')[0].trim())
          : Number(event.id);
        dispatch(setSelectedEvent({ eventId, index: selectedEventIndex, dateFrom: event?.date_from, dateTo: event?.date_to }));
      }
    }
  }, [EVENTS, selectedEventIndex, dispatch]);

  // Platform-aware Responsive SIZES
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
        iconSize:               getResponsiveValue({ android: 17, ios: 17, tablet: 19, default: 17 }),
        headerHeight:           getResponsiveValue({ android: 78, ios: 82, tablet: 88, default: 78 }),
        headerIconSize:         getResponsiveValue({ android: 22, ios: 23, tablet: 25, default: 22 }),
        headerTitleSize:        getResponsiveValue({ android: 15, ios: 17, tablet: 18, default: 16 }),
        currentEventCardHeight: getResponsiveValue({ android: 65, ios: 65, tablet: 83, default: 78 }),
        currentEventIconSize:   getResponsiveValue({ android: 19, ios: 19, tablet: 21, default: 19 }),
        chevronSize:            getResponsiveValue({ android: 15, ios: 16, tablet: 17, default: 15 }),
        mainEventTitleSize:     getResponsiveValue({ android: 22, ios: 23, tablet: 22, default: 22 }),
        mainEventDateSize:      getResponsiveValue({ android: 15, ios: 15, tablet: 15, default: 15 }),
        mapPinSize:             getResponsiveValue({ android: 13, ios: 14, tablet: 14, default: 13 }),
        quickActionTitleSize:   getResponsiveValue({ android: 16, ios: 17, tablet: 18, default: 16 }),
        quickActionCardSize:    getResponsiveValue({ android: '48%', ios: '47%', tablet: 200, default: '48%' }),
        quickActionIconSize:    getResponsiveValue({ android: 54, ios: 55, tablet: 58, default: 54 }),
        quickActionIconInner:   getResponsiveValue({ android: 22, ios: 23, tablet: 25, default: 22 }),
        contentMaxWidth:        getResponsiveValue({ android: '100%', ios: '100%', tablet: 600, default: '100%' }),
        paddingHorizontal:      getResponsiveValue({ android: 16, ios: 18, tablet: 20, default: 16 }),
        paddingVertical:        getResponsiveValue({ android: 18, ios: 20, tablet: 22, default: 18 }),
        cardSpacing:            getResponsiveValue({ android: 12, ios: 14, tablet: 18, default: 12 }),
        sectionSpacing:         getResponsiveValue({ android: 20, ios: 24, tablet: 26, default: 22 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  // Memoized styles for performance
  const styles = useMemo(() => createStyles(SIZES, isTablet, SCREEN_HEIGHT), [
    SIZES,
    isTablet,
    SCREEN_HEIGHT,
  ]);

  const handleQuickAction = (action) => {
    // Navigate to respective screens with eventId if available
    const params = {};
    if (selectedEvent?.id) {
      params.eventId = String(selectedEvent.id);
    }
    if (selectedEventIndex !== undefined && selectedEventIndex !== null) {
      params.selectedEventIndex = String(selectedEventIndex);
    }
    
    switch(action) {
      case 'Scan Attendees':
        router.push({
          pathname: '/profile',
          params: { openQrScan: '1', scanReturnTo: 'dashboard' },
        });
        break;
      case 'Event':
        router.push({ pathname: '/my-event', params });
        break;
      case 'Agenda':
        router.push({ pathname: '/agenda', params: Object.keys(params).length > 0 ? params : undefined });
        break;
      case 'Event Sponsors':
      case 'Attendees':
        router.push({ pathname: '/attendees', params: Object.keys(params).length > 0 ? params : undefined });
        break;
      case 'Sponsors':
      case 'Delegate':
        router.push({ pathname: '/sponsors', params: Object.keys(params).length > 0 ? params : undefined });
        break;
      case 'Future Summits': {
        const fsParams = { ...params };
        const rawEid = selectedEvent?.id;
        if (rawEid != null && rawEid !== '') {
          const eid =
            typeof rawEid === 'string' && rawEid.includes(',')
              ? String(rawEid).split(',')[0].trim()
              : rawEid;
          fsParams.eventId = String(eid);
        }
        router.push({
          pathname: '/future-summits',
          params: Object.keys(fsParams).length > 0 ? fsParams : undefined,
        });
        break;
      }
      default:
        break;
    }
  };

  const quickActions = useMemo(() => [
    {
      title: 'Scan Attendees',
      subtitle: 'QR code → save contact',
      icon: <Icon name="maximize" size={SIZES.quickActionIconInner} color={colors.primary} />,
      iconColor: colors.primary,
      backgroundColor: 'rgba(138, 52, 144, 0.08)',
    },
    {
      title: 'Event',
      subtitle: 'Event details',
      icon: <CalendarIconPrimary size={SIZES.quickActionIconInner} />,
      iconColor: colors.primary,
      backgroundColor: 'rgba(138, 52, 144, 0.1)',
    },
    {
      title: 'Agenda',
      subtitle: 'Schedule & sessions',
      icon: <ListIcon size={SIZES.quickActionIconInner + 4} />,
      iconColor: '#3B82F6',
      backgroundColor: '#EFF6FF',
    },
    {
      title: isDelegate ? 'Event Sponsors' : 'Attendees',
      subtitle: isDelegate ? 'View event sponsors' : 'View attendees',
      icon: <UsersIcon size={SIZES.quickActionIconInner} />,
      iconColor: '#22C55E',
      backgroundColor: '#F0FDF4',
    },
    {
      title: isDelegate ? 'Delegate' : 'Sponsors',
      subtitle: isDelegate ? 'View delegates' : 'Event partners',
      icon: <SponsorsIcon size={SIZES.quickActionIconInner} />,
      iconColor: '#F97316',
      backgroundColor: '#FFF7ED',
    },
    {
      title: 'Future Summits',
      subtitle: 'Upcoming conference partners',
      icon: <Icon name="layers" size={SIZES.quickActionIconInner} color={colors.primary} />,
      iconColor: colors.primary,
      backgroundColor: 'rgba(138, 52, 144, 0.07)',
    },
  ], [SIZES.quickActionIconInner, isDelegate]);

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header
          title="Dashboard"
          leftIcon="menu"
          onLeftPress={() => navigation.openDrawer?.()}
          iconSize={SIZES.headerIconSize}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header
          title="Dashboard"
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

  // Show empty state
  if (EVENTS.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header
          title="Dashboard"
          leftIcon="menu"
          onLeftPress={() => navigation.openDrawer?.()}
          iconSize={SIZES.headerIconSize}
        />
        <View style={styles.errorContainer}>
          <Icon name="calendar" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>No events available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header */}
      <Header
        title="Dashboard"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
      />

      {/* Main Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        nestedScrollEnabled
      >
        <View style={styles.content}>
          {/* Current Event Card */}
          <CurrentEventCard 
            styles={styles} 
            SIZES={SIZES} 
            selectedEvent={selectedEvent}
            selectedIndex={selectedEventIndex}
            isOpen={isEventDropdownOpen}
            onToggle={() => setIsEventDropdownOpen((v) => !v)}
            onSelect={handleEventSelect}
            options={EVENTS}
          />

          {/* Main Event Banner */}
          <MainEventBanner styles={styles} SIZES={SIZES} event={selectedEvent} />

          {sponsorLogosList.length > 0 ? (
            <View style={styles.sponsorLogosSection}>
              <Text style={styles.sponsorLogosTitle}>Event Sponsors</Text>
              <FlatList
                ref={sponsorLogosFlatListRef}
                key={eventIdForLogos != null ? `sponsor-logos-${eventIdForLogos}` : 'sponsor-logos'}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                data={sponsorLogosList}
                keyExtractor={(item) => String(item.id ?? item.title)}
                contentContainerStyle={styles.sponsorLogosScrollContent}
                style={styles.sponsorLogosScroll}
                getItemLayout={(_, index) => ({
                  length: SPONSOR_LOGO_STRIDE,
                  offset: SPONSOR_LOGO_STRIDE * index,
                  index,
                })}
                onScrollBeginDrag={pauseSponsorAutoScroll}
                onMomentumScrollEnd={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const idx = Math.round(x / SPONSOR_LOGO_STRIDE);
                  const max = sponsorLogosList.length - 1;
                  sponsorLogoScrollIndexRef.current = Math.max(0, Math.min(max, idx));
                  scheduleResumeSponsorAutoScroll(SPONSOR_RESUME_AFTER_DRAG_MS);
                }}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    sponsorLogosFlatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: true,
                      viewPosition: 0,
                    });
                  }, 350);
                }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.sponsorLogoChip}
                    onPressIn={pauseSponsorAutoScroll}
                    onPress={() => setSponsorLogoModal(item)}
                    activeOpacity={0.85}
                  >
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.sponsorLogoImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.sponsorLogoPlaceholder}>
                        <Text style={styles.sponsorLogoPlaceholderText} numberOfLines={3}>
                          {item.title || '—'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          ) : null}

          {/* Quick Actions Section */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <QuickActionCard
                  key={index}
                  title={action.title}
                  subtitle={action.subtitle}
                  icon={action.icon}
                  iconColor={action.iconColor}
                  backgroundColor={action.backgroundColor}
                  styles={styles}
                  SIZES={SIZES}
                  onPress={() => handleQuickAction(action.title)}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Event selection modal */}
      <Modal transparent animationType="fade" visible={sponsorLogoModal != null} onRequestClose={() => setSponsorLogoModal(null)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropPressable} activeOpacity={1} onPress={() => setSponsorLogoModal(null)} />
          <View style={styles.modalCenterWrap}>
            <View style={styles.sponsorLogoModalCard}>
              <View style={styles.sponsorLogoModalAccent} />
              <View style={styles.sponsorLogoModalHeader}>
                {sponsorLogoModal?.image_url ? (
                  <Image source={{ uri: sponsorLogoModal.image_url }} style={styles.sponsorLogoModalThumb} resizeMode="contain" />
                ) : (
                  <View style={[styles.sponsorLogoModalThumb, styles.sponsorLogoModalThumbPlaceholder]} />
                )}
                <Text style={styles.sponsorLogoModalName} numberOfLines={3}>
                  {sponsorLogoModal?.title || '—'}
                </Text>
              </View>
              <ScrollView style={styles.sponsorLogoModalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.sponsorLogoModalLabel}>Company Description</Text>
                <Text style={styles.sponsorLogoModalDesc}>
                  {sponsorLogoModal?.company_description && String(sponsorLogoModal.company_description).trim()
                    ? sponsorLogoModal.company_description
                    : '—'}
                </Text>
                <Text style={styles.sponsorLogoModalLabel}>Company Website</Text>
                {normalizeWebsiteUrl(sponsorLogoModal?.website_url) ? (
                  <TouchableOpacity
                    onPress={() => {
                      const href = normalizeWebsiteUrl(sponsorLogoModal?.website_url);
                      if (href) Linking.openURL(href).catch(() => {});
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.sponsorLogoModalLink}>{sponsorLogoModal?.website_url}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.sponsorLogoModalDesc}>—</Text>
                )}
              </ScrollView>
              <TouchableOpacity style={styles.sponsorLogoModalClose} onPress={() => setSponsorLogoModal(null)} activeOpacity={0.8}>
                <Text style={styles.sponsorLogoModalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={isEventDropdownOpen} onRequestClose={() => setIsEventDropdownOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropPressable} activeOpacity={1} onPress={() => setIsEventDropdownOpen(false)} />
          <View style={styles.modalCenterWrap}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Event</Text>
              <ScrollView style={styles.dropdownModalList} contentContainerStyle={styles.dropdownModalListContent} showsVerticalScrollIndicator>
                {EVENTS.map((opt, idx) => {
                  const modalTitleSize = getDynamicFontSize(opt.title, SIZES.headerTitleSize - 1, 11);
                  return (
                    <TouchableOpacity key={opt.id || idx} style={[styles.modalItem, idx === selectedEventIndex && styles.modalItemActive]} activeOpacity={0.9} onPress={() => handleEventSelect(idx)}>
                      <Text style={[styles.modalItemTitle, idx === selectedEventIndex && styles.modalItemTitleActive, { fontSize: modalTitleSize }]} numberOfLines={2} ellipsizeMode="tail">{opt.title}</Text>
                      {opt.date ? <Text style={[styles.modalItemSubtitle, idx === selectedEventIndex && styles.modalItemSubtitleActive]}>{opt.date}</Text> : null}
                      {opt.location ? <Text style={styles.modalItemLocation}>{opt.location}</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity onPress={() => setIsEventDropdownOpen(false)} activeOpacity={0.8} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Responsive Styles Factory
const createStyles = (SIZES, isTablet, SCREEN_HEIGHT) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: SIZES.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.paddingHorizontal,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.headerTitleSize + 3,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal*1.5,
  },
  currentEventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: SIZES.sectionSpacing,
    marginBottom: SIZES.cardSpacing,
    position: 'relative',
  },
  currentEventCardOpen: {
    backgroundColor: 'rgba(138, 52, 144, 0.04)',
    borderColor: colors.primary,
  },
  currentEventContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.paddingHorizontal,
    height: SIZES.currentEventCardHeight,
  },
  currentEventIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  currentEventText: {
    flex: 1,
  },
  currentEventTitle: {
    fontSize: SIZES.headerTitleSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  currentEventSubtitle: {
    fontSize: SIZES.headerTitleSize - 4,
    fontWeight: '400',
    color: colors.textMuted,
  },
  currentEventChevron: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(138, 52, 144, 0.12)'
  },
  // Modal styles
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
  modalCloseBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(138, 52, 144, 0.12)'
  },
  modalCloseText: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: SIZES.headerTitleSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  dropdownModalList: {
    maxHeight: Math.min(SCREEN_HEIGHT * 0.55, isTablet ? 460 : 360),
  },
  dropdownModalListContent: {
    paddingVertical: 6,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemActive: {
    backgroundColor: 'transparent',
  },
  modalItemTitle: {
    fontSize: SIZES.headerTitleSize - 1,
    fontWeight: '700',
    color: colors.text,
  },
  modalItemTitleActive: {
    color: colors.primary,
  },
  modalItemSubtitle: {
    fontSize: SIZES.headerTitleSize - 6,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: 2,
  },
  modalItemSubtitleActive: {
    color: colors.primaryDark,
  },
  modalItemLocation: {
    fontSize: SIZES.headerTitleSize - 6,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: 2,
  },
  mainEventBannerContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: SIZES.sectionSpacing * 1.5,
    position: 'relative',
  },
  mainEventBannerScroll: {
    width: '100%',
  },
  mainEventBannerPage: {
    overflow: 'hidden',
  },
  mainEventBannerPageImage: {
    width: '100%',
    height: '100%',
  },
  mainEventBannerOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
    zIndex: 5,
    elevation: 4,
  },
  mainEventBannerOverlayTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
  },
  mainEventBannerTextBlock: {
    position: 'absolute',
    left: 50,
    right: 50,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Math.min(8, SIZES.paddingHorizontal),
  },
  bannerArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    zIndex: 20,
    elevation: 10,
  },
  bannerArrowInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  bannerArrowLeft: {
    left: 8,
  },
  bannerArrowRight: {
    right: 8,
  },
  mainEventTitle: {
    fontSize: SIZES.mainEventTitleSize,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: SIZES.paddingHorizontal,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  mainEventDate: {
    fontSize: SIZES.mainEventDateSize,
    fontWeight: '500',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  mainEventLocation: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  mainEventMapPinWrap: {
    paddingTop: 3,
  },
  mainEventLocationTextCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 6,
  },
  mainEventLocationText: {
    fontSize: SIZES.mainEventDateSize - 2,
    fontWeight: '500',
    color: colors.white,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  mainEventVenueAddress: {
    fontSize: SIZES.mainEventDateSize - 3,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  mainEventVenueAddressBelow: {
    marginTop: 4,
  },
  mainEventLocationTextLink: {
    textDecorationLine: 'underline',
  },
  sponsorLogosSection: {
    marginBottom: SIZES.sectionSpacing,
  },
  sponsorLogosTitle: {
    fontSize: SIZES.quickActionTitleSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  sponsorLogosScroll: {
    marginHorizontal: -4,
  },
  sponsorLogosScrollContent: {
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: SIZES.paddingHorizontal,
    alignItems: 'center',
  },
  sponsorLogoChip: {
    width: 72,
    height: 56,
    marginRight: 10,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  sponsorLogoImage: {
    width: '100%',
    height: '100%',
  },
  sponsorLogoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sponsorLogoPlaceholderText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  sponsorLogoModalCard: {
    alignSelf: 'center',
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxWidth: isTablet ? 560 : 420,
    overflow: 'hidden',
  },
  sponsorLogoModalAccent: {
    height: 4,
    width: '100%',
    backgroundColor: colors.primary,
  },
  sponsorLogoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: colors.gray50,
    gap: 12,
  },
  sponsorLogoModalThumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sponsorLogoModalThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorLogoModalName: {
    flex: 1,
    fontSize: SIZES.headerTitleSize,
    fontWeight: '700',
    color: colors.text,
  },
  sponsorLogoModalBody: {
    maxHeight: Math.min(SCREEN_HEIGHT * 0.42, 320),
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sponsorLogoModalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
    marginTop: 10,
  },
  sponsorLogoModalDesc: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },
  sponsorLogoModalLink: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
    marginBottom: 8,
  },
  sponsorLogoModalClose: {
    alignSelf: 'flex-end',
    marginHorizontal: 16,
    marginBottom: 14,
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.gray200,
  },
  sponsorLogoModalCloseText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  quickActionsSection: {
    marginBottom: SIZES.sectionSpacing,
  },
  quickActionsTitle: {
    fontSize: SIZES.quickActionTitleSize,
    fontWeight: '600',
    color: colors.text,
    marginBottom: SIZES.cardSpacing,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SIZES.cardSpacing,
  },
  quickActionCard: {
    width: typeof SIZES.quickActionCardSize === 'string' ? SIZES.quickActionCardSize : SIZES.quickActionCardSize,
    minHeight: isTablet ? SIZES.quickActionCardSize : 140,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: SIZES.cardSpacing,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingVertical: 12,
  },
  quickActionIcon: {
    width: SIZES.quickActionIconSize,
    height: SIZES.quickActionIconSize,
    borderRadius: SIZES.quickActionIconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: SIZES.headerTitleSize - 1,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
    width: '100%',
  },
  quickActionSubtitle: {
    fontSize: SIZES.headerTitleSize - 4,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: Math.round((SIZES.headerTitleSize - 4) * 1.35),
    width: '100%',
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
});

