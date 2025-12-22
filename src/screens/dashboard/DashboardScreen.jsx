import Icon from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
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
import { useGetEventsQuery } from '../../store/api';
import { useAppSelector } from '../../store/hooks';

// Icon Components
const CalendarIcon = Icons.Calendar;
const ChevronDownIcon = Icons.ChevronDown;
const MapPinIcon = Icons.MapPin;
const CalendarIconPrimary = Icons.CalendarPrimary;
const ListIcon = Icons.List;
const UsersIcon = Icons.Users;
const SponsorsIcon = Icons.Briefcase;

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

const MainEventBanner = ({ styles, SIZES, event }) => {
  const dynamicBannerTitleSize = getDynamicFontSize(event?.title, SIZES.mainEventTitleSize, 16);
  
  return (
    <View style={styles.mainEventBannerContainer}>
      <ImageBackground
        source={require('../../assets/images/background.jpeg')}
        style={styles.mainEventBannerImage}
        imageStyle={styles.mainEventBannerImageStyle}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(138, 52, 144, 0.92)', 'rgba(107, 39, 112, 0.92)', 'rgba(88, 28, 135, 0.90)']}
          style={styles.mainEventBanner}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={[styles.mainEventTitle, { fontSize: dynamicBannerTitleSize }]} numberOfLines={3} ellipsizeMode="tail">{event?.title}</Text>
          {event?.date ? <Text style={styles.mainEventDate}>{event.date}</Text> : null}
          {event?.location ? (
            <View style={styles.mainEventLocation}>
              <MapPinIcon size={SIZES.mapPinSize} />
              <Text style={styles.mainEventLocationText}>{event.location}</Text>
            </View>
          ) : null}
        </LinearGradient>
      </ImageBackground>
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

  const { data: eventsData, isLoading, error, refetch } = useGetEventsQuery();
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return 'Failed to load events.';
  }, [error]);
  const { user } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);
  const [selectedEventIndex, setSelectedEventIndex] = useState(0);

  // Transform API event data to display format
  const EVENTS = useMemo(() => {
    const events = eventsData?.data || eventsData || [];
    return events.map(event => ({
      id: event.id,
      title: event.title || 'Untitled Event',
      date: formatDate(event.date_from, event.date_to),
      location: event.location || event.venue || '',
      date_from: event.date_from,
      date_to: event.date_to,
    }));
  }, [eventsData]);

  const selectedEvent = EVENTS[selectedEventIndex] || null;

  const handleEventSelect = (index) => {
    setSelectedEventIndex(index);
    setIsEventDropdownOpen(false);
  };

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
        quickActionCardSize:    getResponsiveValue({ android: '48%', ios: '48%', tablet: 200, default: '48%' }),
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
    console.log(`${action} pressed`);
    // Navigate to respective screens
    switch(action) {
      case 'Event':
        if (selectedEvent?.id) {
          router.push({ pathname: '/my-event', params: { selectedEventIndex: String(selectedEventIndex), eventId: String(selectedEvent.id) } });
        } else {
          router.push({ pathname: '/my-event', params: { selectedEventIndex: String(selectedEventIndex) } });
        }
        break;
      case 'Agenda':
        router.push('/agenda');
        break;
      case 'Attendees':
        router.push('/attendees');
        break;
      case 'Sponsors':
      case 'Delegate':
        router.push('/sponsors');
        break;
      default:
        break;
    }
  };

  const quickActions = useMemo(() => [
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
      title: 'Attendees',
      subtitle: 'Connect with people',
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
  ], [SIZES.quickActionIconInner, isDelegate]);

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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
      <SafeAreaView style={styles.container} edges={['top']}>
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
      <SafeAreaView style={styles.container} edges={['top']}>
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
    <SafeAreaView style={styles.container} edges={['top']}>
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
  },
  mainEventBannerImage: {
    width: '100%',
  },
  mainEventBannerImageStyle: {
    borderRadius: radius.lg,
  },
  mainEventBanner: {
    borderRadius: radius.lg,
    paddingHorizontal: SIZES.paddingHorizontal + 8,
    paddingVertical: isTablet ? 70 : 60,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isTablet ? 280 : 220,
  },
  mainEventTitle: {
    fontSize: SIZES.mainEventTitleSize,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: SIZES.paddingHorizontal,
  },
  mainEventDate: {
    fontSize: SIZES.mainEventDateSize,
    fontWeight: '500',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 35,
  },
  mainEventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainEventLocationText: {
    fontSize: SIZES.mainEventDateSize - 2,
    fontWeight: '400',
    color: colors.white,
    marginLeft: 6,
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
    height: isTablet ? SIZES.quickActionCardSize : 140,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.paddingHorizontal,
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
  },
  quickActionSubtitle: {
    fontSize: SIZES.headerTitleSize - 4,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: (SIZES.headerTitleSize - 7) * 1.4,
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

