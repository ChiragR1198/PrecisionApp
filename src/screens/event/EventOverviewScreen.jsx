import Icon from '@expo/vector-icons/Feather';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ImageBackground, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import { eventService } from '../../services/api/eventService';

const CalendarIcon = ({ color = colors.white, size = 20 }) => (
  <Icon name="calendar" size={size} color={color} />
);

const MapPinIcon = ({ color = colors.white, size = 14 }) => (
  <Icon name="map-pin" size={size} color={color} />
);

// Helper function to format date
const formatDate = (dateFrom, dateTo) => {
  if (!dateFrom) return '';
  
  const formatDateString = (dateStr) => {
    const date = new Date(dateStr);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  if (dateTo && dateFrom !== dateTo) {
    return `${formatDateString(dateFrom)} - ${formatDateString(dateTo)}`;
  }
  return formatDateString(dateFrom);
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

// Helper function to strip HTML tags and clean text
const stripHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

// Helper function to split description into paragraphs
const splitIntoParagraphs = (text) => {
  if (!text) return [];
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
};

// Hook to animate counter from 0 to target value
const useAnimatedCounter = (targetValue, duration = 2000, startAnimation = true) => {
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!startAnimation) {
      setCount(0);
      return;
    }

    // Extract numeric value from string like "190+" or "4+"
    const numericValue = parseInt(targetValue?.toString().replace(/\D/g, '') || '0', 10);
    const suffix = targetValue?.toString().match(/[^0-9]/g)?.join('') || '';

    if (numericValue === 0) {
      setCount(0);
      return;
    }

    setCount(0);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(numericValue * easeOutQuart);

      setCount(currentValue);

      if (progress < 1) {
        intervalRef.current = requestAnimationFrame(animate);
      } else {
        setCount(numericValue);
      }
    };

    intervalRef.current = requestAnimationFrame(animate);

    return () => {
      if (intervalRef.current) {
        cancelAnimationFrame(intervalRef.current);
      }
    };
  }, [targetValue, duration, startAnimation]);

  // Extract suffix from original value
  const suffix = targetValue?.toString().match(/[^0-9]/g)?.join('') || '';
  return count + suffix;
};

export const EventOverviewScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  // State for events and event details
  const [events, setEvents] = useState([]);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState(null);
  const [shouldAnimateStats, setShouldAnimateStats] = useState(false);
  
  const initialSelectedIndex = Number.isFinite(Number(params?.selectedEventIndex)) ? Number(params.selectedEventIndex) : 0;
  const [selectedEventIndex, setSelectedEventIndex] = useState(initialSelectedIndex);
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);

  // Fetch all events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // Fetch event details when selection changes
  useEffect(() => {
    if (events.length > 0 && events[selectedEventIndex]) {
      setShouldAnimateStats(false);
      fetchEventDetails(events[selectedEventIndex].id);
    }
  }, [selectedEventIndex, events]);

  // Start animation when event details are loaded
  useEffect(() => {
    if (selectedEventDetails && !isLoadingDetails) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        setShouldAnimateStats(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selectedEventDetails, isLoadingDetails]);

  // Reset and restart animation when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset animation state when screen comes into focus
      setShouldAnimateStats(false);
      
      // Restart animation if event details are already loaded
      if (selectedEventDetails && !isLoadingDetails) {
        const timer = setTimeout(() => {
          setShouldAnimateStats(true);
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [selectedEventDetails, isLoadingDetails])
  );

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await eventService.getAllEvents();
      
      if (result.success) {
        setEvents(result.data || []);
        if (result.data && result.data.length > 0) {
          // Fetch details for the first/selected event
          fetchEventDetails(result.data[selectedEventIndex]?.id || result.data[0].id);
        }
      } else {
        setError(result.error || 'Failed to load events');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while loading events');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEventDetails = async (eventId) => {
    if (!eventId) return;
    
    try {
      setIsLoadingDetails(true);
      const result = await eventService.getEventById(eventId);
      
      if (result.success) {
        setSelectedEventDetails(result.data);
      } else {
        console.error('Failed to fetch event details:', result.error);
      }
    } catch (err) {
      console.error('Error fetching event details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleEventSelect = (index) => {
    setSelectedEventIndex(index);
    setIsEventDropdownOpen(false);
  };

  // Transform API event data to display format
  const selectedEvent = useMemo(() => {
    if (!events[selectedEventIndex]) return null;
    
    const event = events[selectedEventIndex];
    return {
      id: event.id,
      title: event.title || 'Untitled Event',
      date: formatDate(event.date_from, event.date_to),
      location: event.location || event.venue || '',
      date_from: event.date_from,
      date_to: event.date_to,
    };
  }, [events, selectedEventIndex]);

  // Get about paragraphs from event description
  const ABOUT_PARAGRAPHS = useMemo(() => {
    if (!selectedEventDetails?.description) return [];
    const cleanText = stripHtml(selectedEventDetails.description);
    return splitIntoParagraphs(cleanText);
  }, [selectedEventDetails]);

  // Get truncated text for preview (max 120 characters)
  const PREVIEW_TEXT = useMemo(() => {
    if (ABOUT_PARAGRAPHS.length === 0) return '';
    const fullText = ABOUT_PARAGRAPHS.join(' ');
    if (fullText.length <= 300) return fullText;
    return fullText.substring(0, 300).trim() + '...';
  }, [ABOUT_PARAGRAPHS]);

  // Check if Read More should be shown (if content is long enough)
  const shouldShowReadMore = useMemo(() => {
    if (ABOUT_PARAGRAPHS.length === 0) return false;
    const fullText = ABOUT_PARAGRAPHS.join(' ');
    // Show Read More if content is longer than 120 characters
    return fullText.length > 300;
  }, [ABOUT_PARAGRAPHS]);

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
        headerIconSize:         getResponsiveValue({ android: 22, ios: 23, tablet: 25, default: 22 }),
        headerTitleSize:        getResponsiveValue({ android: 15, ios: 17, tablet: 18, default: 16 }),
        currentEventCardHeight: getResponsiveValue({ android: 65, ios: 65, tablet: 83, default: 78 }),
        currentEventIconSize:   getResponsiveValue({ android: 19, ios: 19, tablet: 21, default: 19 }),
        chevronSize:            getResponsiveValue({ android: 15, ios: 16, tablet: 17, default: 15 }),
        contentMaxWidth:        getResponsiveValue({ android: '100%', ios: '100%', tablet: 600, default: '100%' }),
        paddingHorizontal:      getResponsiveValue({ android: 16, ios: 18, tablet: 20, default: 16 }),
        sectionSpacing:         getResponsiveValue({ android: 22, ios: 24, tablet: 26, default: 22 }),
        cardSpacing:            getResponsiveValue({ android: 12, ios: 14, tablet: 18, default: 12 }),
        title:                  getResponsiveValue({ android: 15, ios: 16, tablet: 17, default: 15 }),
        body:                   getResponsiveValue({ android: 13, ios: 14, tablet: 14, default: 13 }),
        statSize:               getResponsiveValue({ android: 22, ios: 23, tablet: 23, default: 22 }),
        bannerMinHeight:        getResponsiveValue({ android: 210, ios: 220, tablet: 250, default: 210 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Event Overview" leftIcon="menu" onLeftPress={() => navigation.openDrawer?.()} iconSize={SIZES.headerIconSize} />
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Event Overview" leftIcon="menu" onLeftPress={() => navigation.openDrawer?.()} iconSize={SIZES.headerIconSize} />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchEvents}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show empty state
  if (events.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Event Overview" leftIcon="menu" onLeftPress={() => navigation.openDrawer?.()} iconSize={SIZES.headerIconSize} />
        <View style={styles.errorContainer}>
          <Icon name="calendar" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>No events available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Event Overview" leftIcon="menu" onLeftPress={() => navigation.openDrawer?.()} iconSize={SIZES.headerIconSize} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.content}>
          <TouchableOpacity style={[styles.currentEventCard, isEventDropdownOpen && styles.currentEventCardActive]} activeOpacity={0.9} onPress={() => setIsEventDropdownOpen(true)}>
            <View style={styles.currentEventContent}>
              <View style={styles.currentEventIcon}><CalendarIcon size={SIZES.currentEventIconSize} /></View>
              <View style={styles.currentEventText}>
                <Text style={[styles.currentEventTitle, { fontSize: getDynamicFontSize(selectedEvent?.title, SIZES.headerTitleSize, 11) }]} numberOfLines={2} ellipsizeMode="tail">{selectedEvent?.title || 'Loading...'}</Text>
                <Text style={styles.currentEventSubtitle}>Current Event</Text>
              </View>
              <View style={styles.currentEventChevron}>
                <Icon name={isEventDropdownOpen ? 'chevron-up' : 'chevron-down'} size={SIZES.chevronSize} color={colors.primary} />
              </View>
            </View>
          </TouchableOpacity>

          {isLoadingDetails ? (
            <View style={styles.loadingDetailsContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingDetailsText}>Loading event details...</Text>
            </View>
          ) : (
            <>
              <View style={styles.bannerContainer}>
                <ImageBackground source={require('../../assets/images/background.jpeg')} style={styles.bannerImage} imageStyle={styles.bannerImageStyle}>
                  <LinearGradient colors={['rgba(138, 52, 144, 0.92)', 'rgba(107, 39, 112, 0.92)', 'rgba(88, 28, 135, 0.90)']} style={styles.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.bannerHeaderRow}>
                      <View style={styles.badge}><Text style={styles.badgeText}>Current Event</Text></View>
                    </View>
                    <Text style={[styles.bannerTitle, { fontSize: getDynamicFontSize(selectedEvent?.title, isTablet ? 32 : 24, 16) }]} numberOfLines={3} ellipsizeMode="tail">{selectedEvent?.title || 'Loading...'}</Text>
                    {selectedEvent?.date ? (
                      <View style={styles.bannerMetaRow}>
                        <Icon name="calendar" size={14} color="#FFFFFF" />
                        <Text style={styles.bannerMetaText}>{selectedEvent.date}</Text>
                      </View>
                    ) : null}
                    {selectedEvent?.location ? (
                      <View style={styles.bannerMetaRow}>
                        <MapPinIcon size={12} />
                        <Text style={styles.bannerMetaText}>{selectedEvent.location}</Text>
                      </View>
                    ) : null}
                  </LinearGradient>
                </ImageBackground>
              </View>

          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Event Statistics</Text>
            <View style={styles.statsGrid}>
              <StatCard value="190+" label="Speakers" icon="mic" startAnimation={shouldAnimateStats} />
              <StatCard value="4+" label="Panel Discussions" icon="sliders" startAnimation={shouldAnimateStats} />
              <StatCard value="30+" label="Event Attendance" icon="users" startAnimation={shouldAnimateStats} />
            </View>
            <View style={[styles.statsGrid, { marginTop: SIZES.cardSpacing }]}>
              <StatCard value="170+" label="Meetings" icon="calendar" startAnimation={shouldAnimateStats} />
              <StatCard value="20+" label="Exhibition Booths" icon="briefcase" startAnimation={shouldAnimateStats} />
              <StatCard value="12+" label="Networking Hours" icon="clock" startAnimation={shouldAnimateStats} />
            </View>
          </View>

              <View style={styles.aboutSection}>
                <Text style={styles.sectionTitle}>About This Event</Text>
                <View style={styles.aboutCard}>
                  {ABOUT_PARAGRAPHS.length > 0 ? (
                    <>
                      {isAboutExpanded ? (
                        ABOUT_PARAGRAPHS.map((para, idx) => (
                          <Text key={idx} style={[styles.aboutText, idx > 0 && { marginTop: 8 }]}>{para}</Text>
                        ))
                      ) : (
                        <Text style={styles.aboutText}>{PREVIEW_TEXT}</Text>
                      )}
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
                            size={16} 
                            color={colors.primary} 
                            style={styles.readMoreIcon}
                          />
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <Text style={styles.aboutText}>No description available for this event.</Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Event selection modal */}
      <Modal transparent animationType="fade" visible={isEventDropdownOpen} onRequestClose={() => setIsEventDropdownOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropPressable} activeOpacity={1} onPress={() => setIsEventDropdownOpen(false)} />
          <View style={styles.modalCenterWrap}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Event</Text>
              <ScrollView style={styles.dropdownModalList} contentContainerStyle={styles.dropdownModalListContent} showsVerticalScrollIndicator>
                {events.map((event, idx) => {
                  const eventDate = formatDate(event.date_from, event.date_to);
                  const eventLocation = event.location || event.venue || '';
                  const modalTitleSize = getDynamicFontSize(event.title, SIZES.title, 11);
                  return (
                    <TouchableOpacity key={event.id || idx} style={[styles.modalItem, idx === selectedEventIndex && styles.modalItemActive]} activeOpacity={0.9} onPress={() => handleEventSelect(idx)}>
                      <Text style={[styles.modalItemTitle, idx === selectedEventIndex && styles.modalItemTitleActive, { fontSize: modalTitleSize }]} numberOfLines={2} ellipsizeMode="tail">{event.title || 'Untitled Event'}</Text>
                      {eventDate ? <Text style={[styles.modalItemSubtitle, idx === selectedEventIndex && styles.modalItemSubtitleActive]}>{eventDate}</Text> : null}
                      {eventLocation ? <Text style={styles.modalItemLocation}>{eventLocation}</Text> : null}
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

const StatCard = ({ value, label, icon, startAnimation }) => {
  const animatedValue = useAnimatedCounter(value, 2000, startAnimation);
  
  return (
    <View style={statStyles.cardContainer}>
      <View style={statStyles.iconRow}>
        {icon ? (
          <View style={statStyles.iconBadge}>
            <Icon name={icon} size={16} color={colors.primary} />
          </View>
        ) : <View />}
        <Text style={statStyles.valueText}>{animatedValue}</Text>
      </View>
      <Text style={statStyles.labelText}>{label}</Text>
    </View>
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
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal * 1.5,
  },
  currentEventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: SIZES.sectionSpacing,
    marginBottom: SIZES.cardSpacing,
  },
  currentEventCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(138, 52, 144, 0.04)'
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
  currentEventHelper: {
    marginTop: 4,
    fontSize: 12,
    color: colors.icon,
  },
  currentEventChevron: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(138, 52, 144, 0.12)'
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
  bannerContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: SIZES.sectionSpacing * 1.5,
  },
  bannerImage: {
    width: '100%',
  },
  bannerImageStyle: {
    borderRadius: radius.lg,
  },
  banner: {
    minHeight: SIZES.bannerMinHeight,
    borderRadius: radius.lg,
    paddingHorizontal: SIZES.paddingHorizontal + 8,
    paddingTop: isTablet ? 25 : 26,
    paddingBottom: isTablet ? 18 : 14,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 10,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  bannerTitle: {
    color: colors.white,
    fontSize: isTablet ? 32 : 24,
    fontWeight: '700',
    marginBottom: 10,
    paddingTop: isTablet ? 80 : 40,
  },
  bannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  bannerHeaderRow: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bannerMetaText: {
    color: colors.white,
    fontSize: 13,
    marginLeft: 6,
  },
  bannerVenue: {
    color: colors.white,
    fontSize: 14,
    marginTop: 10,
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
    fontSize: SIZES.title,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  dropdownModalList: {
    maxHeight: isTablet ? 460 : 360,
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
    fontSize: SIZES.title,
    fontWeight: '700',
    color: colors.text,
  },
  modalItemTitleActive: {
    color: colors.primary,
  },
  modalItemSubtitle: {
    fontSize: SIZES.body,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: 2,
  },
  modalItemSubtitleActive: {
    color: colors.primaryDark,
  },
  modalItemLocation: {
    fontSize: SIZES.body,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: 2,
  },
  statsSection: {
    marginBottom: SIZES.sectionSpacing,
  },
  sectionTitle: {
    fontSize: SIZES.title,
    fontWeight: '600',
    color: colors.text,
    marginBottom: SIZES.cardSpacing,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SIZES.cardSpacing,
  },
  aboutSection: {
    marginBottom: SIZES.sectionSpacing,
  },
  aboutCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: SIZES.paddingHorizontal,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  aboutText: {
    fontSize: SIZES.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
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
  loadingDetailsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDetailsText: {
    marginTop: 8,
    fontSize: 13,
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

const statStyles = StyleSheet.create({
  cardContainer: {
    width: '31.5%',
    backgroundColor: 'rgba(138, 52, 144, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(138, 52, 144, 0.18)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  valueText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'right',
  },
  labelText: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 6,
    textAlign: 'left',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBadge: {
    backgroundColor: 'rgba(138, 52, 144, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default EventOverviewScreen;


