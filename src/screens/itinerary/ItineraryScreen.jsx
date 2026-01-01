import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { SearchBar } from '../../components/common/SearchBar';
import { colors, radius } from '../../constants/theme';
import { useGetDelegateItineraryQuery, useGetSponsorItineraryQuery } from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const FILTERS = ['All Days', 'Today', 'Tomorrow'];

// Format date to readable format (e.g., "March 15, 2025")
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    return dateString;
  }
};

// Format time from HH:MM:SS to HH:MM AM/PM
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

// Get icon based on priority or default
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
  const { user } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const isSponsor = loginType === 'sponsor';

  // Fetch itinerary based on user type
  const { data: delegateItineraryData, isLoading: delegateLoading, error: delegateError } = useGetDelegateItineraryQuery(undefined, {
    skip: !isDelegate,
    refetchOnMountOrArgChange: true,
  });

  const { data: sponsorItineraryData, isLoading: sponsorLoading, error: sponsorError } = useGetSponsorItineraryQuery(undefined, {
    skip: !isSponsor,
    refetchOnMountOrArgChange: true,
  });

  const isLoading = isDelegate ? delegateLoading : sponsorLoading;
  const error = isDelegate ? delegateError : sponsorError;
  const itineraryData = isDelegate ? delegateItineraryData : sponsorItineraryData;

  const { SIZES, isTablet } = useMemo(() => {
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
        cardPadding: getValue({ tablet: 16, default: 14 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  // Map API data to UI format and group by date
  const itinerary = useMemo(() => {
    if (!itineraryData?.data || !Array.isArray(itineraryData.data)) return [];

    // Group items by date
    const groupedByDate = {};
    itineraryData.data.forEach((item) => {
      const date = item.date || '';
      if (!date) return;

      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }

      // Get delegate/sponsor info (handle both delegate and sponsor fields)
      const fullName = 
        item.delegate_full_name || 
        item.sponsor_full_name ||
        `${(item.delegate_fname || item.sponsor_fname || '')} ${(item.delegate_lname || item.sponsor_lname || '')}`.trim() ||
        item.name ||
        'Unknown';
      
      const company = item.delegate_company || item.sponsor_company || item.company || '';
      const jobTitle = item.delegate_job_title || item.sponsor_job_title || item.job_title || '';
      const time = formatTime(item.time);
      const priority = item.priority || '1';
      const tableNo = item.table_no || '';

      // Build subtitle
      let subtitle = '';
      if (company) subtitle += company;
      if (jobTitle) subtitle += (subtitle ? ' • ' : '') + jobTitle;
      if (tableNo) subtitle += (subtitle ? ' • ' : '') + `Table ${tableNo}`;
      if (!subtitle) subtitle = 'Meeting';

      groupedByDate[date].push({
        id: String(item.id),
        title: fullName,
        subtitle,
        icon: getEventIcon(priority),
        time,
        date,
        priority,
      });
    });

    // Convert to array format and sort by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return Object.keys(groupedByDate)
      .sort()
      .map((date, index) => {
        const dateObj = new Date(date);
        const formattedDate = formatDate(date);
        return {
          id: `day-${date}`,
          day: formattedDate,
          date: date,
          dateObj,
          events: groupedByDate[date].sort((a, b) => {
            // Sort events by time
            const timeA = a.time || '';
            const timeB = b.time || '';
            return timeA.localeCompare(timeB);
          }),
        };
      });
  }, [itineraryData]);

  const filteredItinerary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return itinerary.filter((day) => {
      // Apply date filter
      if (activeFilter === 'Today') {
        const dayDate = new Date(day.date);
        dayDate.setHours(0, 0, 0, 0);
        if (dayDate.getTime() !== today.getTime()) return false;
      } else if (activeFilter === 'Tomorrow') {
        const dayDate = new Date(day.date);
        dayDate.setHours(0, 0, 0, 0);
        if (dayDate.getTime() !== tomorrow.getTime()) return false;
      }

      // Apply search filter
      if (!q) return true;
      return day.events.some(
        (event) =>
          event.title.toLowerCase().includes(q) ||
          event.subtitle.toLowerCase().includes(q)
      );
    });
  }, [activeFilter, searchQuery, itinerary]);

  const renderEvent = ({ item }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventIcon}>
        <Text style={styles.eventIconText}>{item.icon}</Text>
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventSubtitle}>{item.subtitle}</Text>
        <Text style={styles.eventTime}>{item.time}</Text>
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
            <ActivityIndicator size="large" color={colors.primary} />
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
                    {renderEvent({ item: event })}
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
    </SafeAreaView>
  );
};

const createStyles = (SIZES) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: SIZES.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: SIZES.paddingHorizontal,
      paddingTop: 12,
    },
    searchBar: {
      marginTop: 12,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    filterChip: {
      borderRadius: radius.pill,
      backgroundColor: colors.gray100,
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
    },
    filterText: {
      fontWeight: '600',
      color: colors.text,
    },
    filterTextActive: {
      color: colors.white,
    },
    listContent: {
      paddingBottom: 40,
      gap: 24,
    },
    daySection: {
      gap: 12,
    },
    dayHeader: {
      marginBottom: 4,
    },
    dayTitle: {
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    dayDivider: {
      width: 40,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    eventWrapper: {
      marginBottom: 12,
    },
    eventCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SIZES.cardPadding,
      borderRadius: 16,
    },
    eventIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: 'rgba(138, 52, 144, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    eventIconText: {
      fontSize: 20,
    },
    eventInfo: {
      flex: 1,
    },
    eventTitle: {
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    eventSubtitle: {
      color: colors.textMuted,
      marginBottom: 6,
    },
    eventTime: {
      fontWeight: '600',
      color: colors.primary,
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
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyText: {
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
  });

export default ItineraryScreen;

