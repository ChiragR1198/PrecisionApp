import Icon from '@expo/vector-icons/Feather';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { Icons } from '../../constants/icons';
import { colors } from '../../constants/theme';
import {
  AGENDA_CARD_SURFACE_COLORS,
  agendaCardBorderStyle,
  agendaSectionAccentFromTime,
  agendaSurfaceIndexForId,
} from '../../utils/agendaCardSurface';
import {
  useCheckInAgendaSessionMutation,
  useGetAgendaCheckInStatusQuery,
  useGetAgendaItemQuery,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

/** Must match truncation below; was 220 vs 200 and hid "Read More" for 201–220 char descriptions. */
const DESCRIPTION_PREVIEW_LEN = 200;

const ClockIcon = ({ color = colors.white, size = 20 }) => (
  <MaterialCommunityIcons name="clock" size={size} color={color} />
);

const CalendarIcon = ({ color = colors.white, size = 18 }) => (
    <Ionicons name="calendar-clear-sharp" size={size} color={color} />
);

const MapPinIcon = ({ color = colors.white, size = 18 }) => (
    <FontAwesome6 name="map-location-dot" size={size} color={color} />
);

const UserIcon = Icons.User;
const ChevronRightIcon = Icons.ChevronRight;

// Helper function to format time from "08:00:00" to "8:00 AM"
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Helper function to format date (timezone-safe for "YYYY-MM-DD")
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return { date: '', dayName: '' };

  const s = String(dateStr).slice(0, 10);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // If backend already sent display-safe values, prefer them (handled elsewhere).
  // For raw "YYYY-MM-DD", compute using UTC to avoid locale shifting.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const utc = new Date(Date.UTC(y, mo, d));
    return {
      date: `${months[utc.getUTCMonth()]} ${utc.getUTCDate()}, ${utc.getUTCFullYear()}`,
      dayName: days[utc.getUTCDay()],
    };
  }

  // Fallback for other formats
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return { date: '', dayName: '' };
  return {
    date: `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
    dayName: days[date.getDay()],
  };
};

// Helpers to clean HTML descriptions returned by API
const stripHtml = (s) => {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, ' ');
};
const decodeEntities = (s) => {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&bull;/gi, '•')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&#x2F;/g, '/');
};
const normalizeWhitespace = (s) => {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};

/** Remove leading "Speaker:" / first paragraph that duplicates `speaker.name` (API HTML mirrors `data.speaker`). */
const stripDuplicateSpeakerFromDescription = (cleanText, speaker) => {
  if (!speaker?.name || typeof cleanText !== 'string') return cleanText;
  const name = String(speaker.name).trim();
  let t = cleanText.trim();
  const blocks = t.split(/\n\n+/);
  const out = [];
  let removedNameBlock = false;
  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;
    const low = b.replace(/\s+/g, ' ').toLowerCase();
    if (low === 'speaker:' || low === 'speaker') continue;
    if (!removedNameBlock && b.startsWith(name)) {
      removedNameBlock = true;
      continue;
    }
    out.push(block.trim());
  }
  return out.join('\n\n').trim();
};

export const AgendaDetailScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const { data: agendaData, isLoading, error, refetch } = useGetAgendaItemQuery(
    params?.agendaId,
    { skip: !params?.agendaId }
  );

  const [checkInAgendaSession, { isLoading: isCheckingIn }] = useCheckInAgendaSessionMutation();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isCheckInInfoModalVisible, setIsCheckInInfoModalVisible] = useState(false);

  const { data: checkInStatus } = useGetAgendaCheckInStatusQuery(params?.agendaId, {
    skip: !params?.agendaId,
  });

  const { selectedEventDateFrom } = useAppSelector((state) => state.event);

  useEffect(() => {
    // Reset when navigating between different agenda items,
    // so only the current session's button becomes disabled.
    setIsCheckedIn(false);
  }, [params?.agendaId]);

  useEffect(() => {
    const checked = checkInStatus?.data?.checked_in;
    if (checked) setIsCheckedIn(true);
  }, [checkInStatus?.data?.checked_in]);

  // Handle back navigation (both header back button and hardware back button)
  const handleBack = useCallback(() => {
    // For expo-router with drawer navigation, explicitly navigate to agenda screen
    // router.back() sometimes doesn't work properly with drawer navigator
    try {
      // Get eventId from params to preserve it when navigating back
      const eventId = params?.eventId || null;
      if (eventId) {
        router.push({
          pathname: '/(drawer)/agenda',
          params: { eventId: String(eventId) }
        });
      } else {
        router.push('/(drawer)/agenda');
      }
    } catch (error) {
      console.error('❌ Navigation failed:', error);
      // Last resort: try router.back()
      try {
        router.back();
      } catch (backError) {
        console.error('❌ Router.back() also failed:', backError);
      }
    }
  }, [params?.eventId]);

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
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return 'Failed to load agenda details.';
  }, [error]);
  
  const selectedAgendaItem = useMemo(() => {
    return agendaData?.data || agendaData || null;
  }, [agendaData]);

  // Create optimistic/initial data from params if available (for instant display)
  const initialData = useMemo(() => {
    if (params?.initialTitle || params?.initialTime || params?.initialDate) {
      const dateFormatted = params?.initialDate ? formatDateDisplay(params.initialDate) : { date: '', dayName: '' };
      return {
        id: params?.agendaId || null,
        title: params?.initialTitle || 'Untitled Session',
        time: params?.initialTime ? formatTime(params.initialTime) : '',
        description: params?.initialDescription ? normalizeWhitespace(decodeEntities(stripHtml(params.initialDescription))) : '',
        location: params?.initialLocation || '',
        locationDetails: '',
        date: dateFormatted.date,
        dayName: dateFormatted.dayName,
        category: 'Session',
        speaker: null,
        speakers: [],
      };
    }
    return null;
  }, [params]);

  // Transform agenda item data for display
  const agendaItem = useMemo(() => {
    // If we have API data, use it (preferred)
    if (selectedAgendaItem) {
      const dateFormatted = selectedAgendaItem?.date_display
        ? { date: selectedAgendaItem.date_display, dayName: selectedAgendaItem?.day_name || '' }
        : formatDateDisplay(selectedAgendaItem.date);
      const rawSp = selectedAgendaItem.speaker;
      const speaker =
        rawSp && typeof rawSp === 'object' && (rawSp.id != null || rawSp.name || selectedAgendaItem.speaker_id)
          ? {
              id: rawSp.id ?? selectedAgendaItem.speaker_id,
              name: rawSp.name || '',
              company: rawSp.company || '',
              job_title: rawSp.job_title || '',
              image: rawSp.image || '',
              type: (rawSp.type || selectedAgendaItem.speaker_type || 'delegate').toLowerCase(),
            }
          : null;
      const fullDesc = normalizeWhitespace(decodeEntities(stripHtml(selectedAgendaItem.description || '')));
      const description = speaker ? stripDuplicateSpeakerFromDescription(fullDesc, speaker) : fullDesc;
      return {
        id: selectedAgendaItem.id,
        title: selectedAgendaItem.title || 'Untitled Session',
        time: selectedAgendaItem?.time_display || formatTime(selectedAgendaItem.time),
        description,
        location: selectedAgendaItem.location || selectedAgendaItem.venue || '',
        locationDetails: '',
        date: dateFormatted.date,
        dayName: dateFormatted.dayName,
        category: 'Session',
        speaker,
        speakers: [],
      };
    }
    
    // If we have initial data from params, use it for optimistic UI
    if (initialData) {
      return initialData;
    }
    
    // Fallback to loading state
    return {
      id: null,
      title: 'Loading...',
      time: '',
      description: '',
      location: '',
      date: '',
      dayName: '',
      category: 'Session',
      speaker: null,
      speakers: [],
    };
  }, [selectedAgendaItem, initialData]);

  const openSpeakerProfile = useCallback(() => {
    const sp = agendaItem.speaker;
    if (!sp?.id) return;
    const st = sp.type || 'delegate';
    const eventDateFrom = selectedEventDateFrom || '';
    if (st === 'sponsor') {
      router.push({
        pathname: '/sponsor-details',
        params: {
          sponsor: JSON.stringify({
            id: sp.id,
            name: sp.name,
            company: sp.company,
            job_title: sp.job_title,
            image: sp.image,
          }),
          returnTo: 'agenda-detail',
          eventDateFrom,
        },
      });
      return;
    }
    router.push({
      pathname: '/delegate-details',
      params: {
        delegate: JSON.stringify({
          id: sp.id,
          name: sp.name,
          company: sp.company,
          job_title: sp.job_title,
          role: sp.job_title,
          image: sp.image,
        }),
        returnTo: 'agenda-detail',
        eventDateFrom,
      },
    });
  }, [agendaItem.speaker, selectedEventDateFrom]);

  const canCheckIn = useMemo(() => {
    // Timezone-safe: backend returns can_check_in based on server/event-local time.
    return Boolean(checkInStatus?.data?.can_check_in);
  }, [checkInStatus?.data?.can_check_in]);

  const checkInBlockedMessage = useMemo(() => {
    const availableFrom = checkInStatus?.data?.available_from_display;
    const sessionStart = checkInStatus?.data?.session_start_display;
    if (availableFrom) {
      return `Check-in opens 20 minutes before the session starts. Please try again at ${availableFrom}.`;
    }
    if (sessionStart) {
      return `Check-in opens 20 minutes before the session starts. Please try again closer to ${sessionStart}.`;
    }
    return 'Check-in opens 20 minutes before the session starts. Please try again shortly before the session begins.';
  }, [checkInStatus?.data?.available_from_display, checkInStatus?.data?.session_start_display]);

  const handleCheckIn = useCallback(async () => {
    if (!params?.agendaId) return;

    if (!canCheckIn) {
      setIsCheckInInfoModalVisible(true);
      return;
    }

    // Optimistic disable to prevent double-taps.
    setIsCheckedIn(true);
    try {
      const res = await checkInAgendaSession({
        agenda_id: Number(params.agendaId),
      }).unwrap();
      if (!res?.success) setIsCheckedIn(false);
    } catch (e) {
      // keep silent; existing app has global API error toast
      setIsCheckedIn(false);
    }
  }, [params?.agendaId, canCheckIn, checkInBlockedMessage, checkInAgendaSession]);

  const descriptionText = agendaItem.description || '';

  // Description expand state and long-desc boolean.
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  useEffect(() => {
    setIsDescExpanded(false);
  }, [params?.agendaId]);

  const isLongDescription = (descriptionText?.length || 0) > DESCRIPTION_PREVIEW_LEN;

  const displayedDescription = useMemo(() => {
    if (!descriptionText.trim()) return '';
    return isDescExpanded
      ? descriptionText
      : descriptionText.substring(0, DESCRIPTION_PREVIEW_LEN) +
        (descriptionText.length > DESCRIPTION_PREVIEW_LEN ? '...' : '');
  }, [descriptionText, isDescExpanded]);

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
        bannerMinHeight: getResponsiveValue({ android: 190, ios: 200, tablet: 230, default: 190 }),
        contentOverlap: getResponsiveValue({ android: -38, ios: -40, tablet: -40, default: -38 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const detailCardColors = useMemo(() => {
    const id = agendaItem.id ?? params?.agendaId;
    const rawTime =
      selectedAgendaItem?.time != null && String(selectedAgendaItem.time).trim() !== ''
        ? String(selectedAgendaItem.time)
        : params?.initialTime
          ? String(params.initialTime)
          : '';
    return {
      surface: AGENDA_CARD_SURFACE_COLORS[agendaSurfaceIndexForId(id)],
      accent: agendaSectionAccentFromTime(rawTime),
    };
  }, [agendaItem.id, params?.agendaId, params?.initialTime, selectedAgendaItem?.time]);

  // Update SpeakerCard to match image
  const SpeakerCard = ({ speaker, isLast }) => (
    <View style={[ styles.speakerCard, isLast && { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 } ]}>
      <View style={styles.speakerAvatar}>
        <View style={styles.avatarPlaceholder}>
          <UserIcon />
        </View>
      </View>
      <View style={styles.speakerInfo}>
        <Text selectable style={styles.speakerName}>{speaker.name}</Text>
        <Text selectable style={styles.speakerTitle}>{speaker.title}</Text>
      </View>
      <ChevronRightIcon />
    </View>
  );

  const TopicTag = ({ topic }) => (
    <View style={styles.topicTag}>
      <Text selectable style={styles.topicTagText}>{topic}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header 
          title="Agenda Detail" 
          leftIcon="arrow-left" 
          onLeftPress={() => {
            handleBack();
          }} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text selectable style={styles.loadingText}>Loading agenda details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <Header 
          title="Agenda Detail" 
          leftIcon="arrow-left" 
          onLeftPress={() => {
            handleBack();
          }} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.textMuted} />
          <Text selectable style={styles.errorText}>{errorMessage}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <Header 
        title="Agenda Detail" 
        leftIcon="arrow-left" 
        onLeftPress={() => {
          handleBack();
        }} 
        iconSize={SIZES.headerIconSize} 
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false} 
        bounces={false}
      >
        {/* Event Banner - Full Width */}
        <LinearGradient
          colors={colors.gradient2}
          style={styles.eventBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.bannerContent}>
            <View style={styles.categoryTag}>
              <Text selectable style={styles.categoryTagText}>{agendaItem.category}</Text>
            </View>
            
            <Text selectable style={styles.eventTitle} numberOfLines={0}>{agendaItem.title}</Text>
            
            {agendaItem.time && (
              <View style={styles.timeContainer}>
                <ClockIcon />
                <Text selectable style={styles.timeText}>{agendaItem.time}</Text>

                <TouchableOpacity
                  style={[
                    styles.checkInButton,
                    (!canCheckIn || isCheckingIn || isCheckedIn) && styles.checkInButtonDisabled,
                  ]}
                  activeOpacity={0.85}
                  onPress={handleCheckIn}
                  // Keep tappable when blocked so we can show the popup message.
                  disabled={isCheckingIn || isCheckedIn}
                >
                  {isCheckingIn ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.checkInButtonText}>
                      {isCheckedIn ? "I'm in this session" : "I'm in this session"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Details Card — same surface + left accent as list cards */}
          <View
            style={[
              styles.detailsCard,
              { backgroundColor: detailCardColors.surface },
              agendaCardBorderStyle(detailCardColors.accent),
            ]}
          >
            {/* Date and Location */}
            {agendaItem.date && (
              <View style={styles.detailRow}>
                <View style={styles.iconBackground}>
                  <CalendarIcon />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text selectable style={styles.detailTitle}>{agendaItem.date}</Text>
                  {agendaItem.dayName && (
                    <Text selectable style={styles.detailSubtitle}>{agendaItem.dayName}</Text>
                  )}
                </View>
              </View>
            )}

            {agendaItem.location && (
              <View style={styles.detailRow}>
                <View style={styles.iconBackground}>
                  <MapPinIcon />
                </View>
                <View style={styles.detailTextContainer}>
                  <Text selectable style={styles.detailTitle}>{agendaItem.location}</Text>
                  {agendaItem.locationDetails && (
                    <Text selectable style={styles.detailSubtitle}>{agendaItem.locationDetails}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Speakers Section - Only show if speakers exist */}
            {agendaItem.speakers && agendaItem.speakers.length > 0 && (
              <View style={styles.section}>
                <Text selectable style={styles.sectionTitle}>Speakers</Text>
                {agendaItem.speakers.map((speaker, index) => (
                  <SpeakerCard key={speaker.id} speaker={speaker} isLast={index === agendaItem.speakers.length - 1} />
                ))}
              </View>
            )}

            {/* Description: optional speaker (API) + body text; speaker name links to profile */}
            {(agendaItem.speaker?.name || (agendaItem.description && agendaItem.description.trim() !== '')) && (
              <View style={styles.section}>
                <Text selectable style={styles.sectionTitle}>Description</Text>
                {agendaItem.speaker?.name ? (
                  <View style={styles.speakerHighlightBlock}>
                    <View style={styles.speakerLabelRow}>
                      <Text
                        selectable
                        accessibilityRole="text"
                        accessibilityLabel={`Speaker: ${agendaItem.speaker.name}`}
                      >
                        <Text style={styles.descriptionText}>Speaker: </Text>
                        <Text
                          style={styles.speakerNameLink}
                          onPress={openSpeakerProfile}
                          accessibilityRole="link"
                          accessibilityLabel={`Open profile for ${agendaItem.speaker.name}`}
                        >
                          {agendaItem.speaker.name}
                        </Text>
                      </Text>
                    </View>
                    {(agendaItem.speaker.job_title || agendaItem.speaker.company) ? (
                      <Text selectable style={styles.speakerMetaLine}>
                        {[agendaItem.speaker.job_title, agendaItem.speaker.company].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {descriptionText.trim() !== '' ? (
                  <>
                    {/*
                      Read-only TextInput (visually plain) so iOS/Android show selection handles.
                      Plain Text+selectable often only offers a single “Copy” without drag handles.
                    */}
                    <TextInput
                      style={[styles.descriptionText, styles.descriptionSelectField]}
                      value={displayedDescription}
                      editable={false}
                      multiline
                      scrollEnabled={false}
                      textAlignVertical="top"
                      underlineColorAndroid="transparent"
                      selectTextOnFocus={false}
                      caretHidden
                    />
                    {isLongDescription ? (
                      <Text
                        style={[styles.readMore, { marginTop: 12 }]}
                        onPress={() => setIsDescExpanded((v) => !v)}
                        accessibilityRole="button"
                        accessibilityLabel={isDescExpanded ? 'Show less description' : 'Read more description'}
                      >
                        {isDescExpanded ? 'Show Less' : 'Read More'}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            )}

            {/* Key Topics Section */}
            {/* <View style={styles.section}>
              <Text style={styles.sectionTitle}>Key Topics</Text>
              <View style={styles.topicsContainer}>
                {agendaItem.keyTopics.map((topic, index) => (
                  <TopicTag key={index} topic={topic} />
                ))}
              </View>
            </View> */}
          </View>
        </View>
      </ScrollView>

      {/* Themed modal (like Profile update success) */}
      <Modal
        transparent
        animationType="fade"
        visible={isCheckInInfoModalVisible}
        onRequestClose={() => setIsCheckInInfoModalVisible(false)}
      >
        <View style={styles.checkInModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsCheckInInfoModalVisible(false)}
          />
          <View style={styles.checkInModalCard}>
            <Text selectable style={styles.checkInModalTitle}>Check-in not available yet</Text>
            <Text selectable style={styles.checkInModalMessage}>{checkInBlockedMessage}</Text>
            <TouchableOpacity
              style={styles.checkInModalButton}
              onPress={() => setIsCheckInInfoModalVisible(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradient}
                style={styles.checkInModalButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.checkInModalButtonText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
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
    paddingBottom: 30,
    flexGrow: 1,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal * 1.5,
    marginTop: SIZES.contentOverlap,
  },
  eventBanner: {
    marginTop: SIZES.sectionSpacing - 15,
    minHeight: SIZES.bannerMinHeight + 10,
    justifyContent: 'flex-start',
    width: '100%',
    paddingBottom: 30,
    overflow: 'visible',
  },
  bannerContent: {
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: SIZES.sectionSpacing,
    paddingBottom: SIZES.sectionSpacing + 10,
    width: '100%',
  },
  categoryTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  categoryTagText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  eventTitle: {
    fontSize: isTablet ? 26 : 20,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 16,
    width: '100%',
    lineHeight: isTablet ? 32 : 26,
    paddingRight: 0,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  timeText: {
    fontSize: SIZES.body,
    fontWeight: '500',
    color: colors.white,
    marginLeft: 8,
    marginRight: 12,
  },
  checkInButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    marginTop: 8,
  },
  checkInButtonDisabled: {
    opacity: 0.55,
  },
  checkInButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Themed modal styles (match ProfileScreen look & feel)
  checkInModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  checkInModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  checkInModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  checkInModalMessage: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  checkInModalButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  checkInModalButtonGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInModalButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  detailsCard: {
    borderRadius: 16,
    padding: SIZES.paddingHorizontal * 1.5,
    paddingHorizontal: SIZES.paddingHorizontal * 2,
    marginBottom: SIZES.sectionSpacing,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  detailSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textMuted,
  },

  // Sections
  section: {
    marginBottom: SIZES.sectionSpacing,
    borderTopWidth: 1,
    borderTopColor: colors.gray300,
    paddingTop: SIZES.sectionSpacing,
  },
  sectionTitle: {
    fontSize: SIZES.title,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },

  // Speakers
  speakerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingBottom: 16,
  },
  speakerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  speakerInfo: {
    flex: 1,
  },
  speakerName: {
    fontSize: SIZES.title - 2,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  speakerTitle: {
    fontSize: SIZES.body,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 20,
  },

  // Description
  speakerHighlightBlock: {
    marginBottom: 12,
  },
  speakerLabelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  speakerNameLink: {
    fontSize: SIZES.body,
    fontWeight: '700',
    color: colors.primary,
    lineHeight: 24,
    textDecorationLine: 'underline',
  },
  speakerMetaLine: {
    fontSize: SIZES.body - 1,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 22,
    marginTop: 4,
  },
  descriptionText: {
    fontSize: SIZES.body,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 24,
  },
  /** No border/background — matches plain Text; enables native selection handles */
  descriptionSelectField: {
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        // Avoid extra inset that looks like a text field
        paddingVertical: 0,
      },
      android: {
        paddingVertical: 0,
        includeFontPadding: false,
      },
    }),
  },
  readMore: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },

  // Key Topics
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  topicTag: {
    backgroundColor: 'rgba(138, 52, 144, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  topicTagText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },

  // Add icon background style
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
});

export default AgendaDetailScreen;
