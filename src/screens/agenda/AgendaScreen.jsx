import Icon from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { SearchBar } from '../../components/common/SearchBar';
import { Icons } from '../../constants/icons';
import { colors } from '../../constants/theme';
import { useGetAgendaQuery } from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const MapPinIcon = Icons.MapPin;
const UserIcon = Icons.User;

// Helper function to format time from "08:00:00" to "8:00 AM"
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// Helper function to format date
const formatDate = (dateStr) => {
  if (!dateStr) return { dayLabel: '', day: '', date: '' };
  const date = new Date(dateStr);
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return {
    dayLabel: days[date.getDay()],
    day: date.getDate().toString(),
    date: dateStr,
  };
};

// Helper function to group agenda by time of day
const groupAgendaByTime = (agendaItems) => {
  const morning = [];
  const afternoon = [];
  const evening = [];

  agendaItems.forEach((item) => {
    const hour = parseInt(item.time?.split(':')[0] || '0', 10);
    if (hour < 12) {
      morning.push(item);
    } else if (hour < 17) {
      afternoon.push(item);
    } else {
      evening.push(item);
    }
  });

  return { morning, afternoon, evening };
};

// Helpers to clean HTML descriptions returned by API
const stripHtml = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : '');
const decodeEntities = (s) => (typeof s === 'string'
  ? s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x2F;/g, '/')
  : '');
const normalizeWhitespace = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');

export const AgendaScreen = () => {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { user } = useAppSelector((state) => state.auth);
  const { selectedEventId } = useAppSelector((state) => state.event);
  
  // Priority: route params > Redux store > user.event_id
  // Also handle comma-separated eventIds by taking the first one
  const eventId = useMemo(() => {
    let id = params?.eventId || selectedEventId || user?.event_id;
    
    // If eventId is a comma-separated string, take the first one
    if (id && typeof id === 'string' && id.includes(',')) {
      id = id.split(',')[0].trim();
    }
    
    // Convert to number if it's a valid number string
    if (id && !isNaN(Number(id))) {
      return Number(id);
    }
    
    return id || null;
  }, [params?.eventId, selectedEventId, user?.event_id]);
  
  // API endpoint format: /agenda/{eventId}
  // Pass eventId to get agenda for the selected event
  const { data: agendaResponse, isLoading, error, refetch } = useGetAgendaQuery(eventId, {
    skip: !eventId,
  });
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return 'Failed to load agenda.';
  }, [error]);

  console.log('eventId', eventId);
  console.log('agendaResponse', agendaResponse);
  
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const agenda = useMemo(() => {
    return agendaResponse?.data || agendaResponse || [];
  }, [agendaResponse]);

  // Responsive sizes
  const SIZES = {
    headerIconSize: 22,
    contentMaxWidth: '100%',
    paddingHorizontal: 16,
    sectionSpacing: 22,
    cardSpacing: 12,
    title: 15,
    body: 13,
    dateSelectorHeight: 56,
  };
  const isTablet = false;

  // Get unique dates from agenda
  const dates = useMemo(() => {
    const uniqueDates = [...new Set(agenda.map(item => item.date))].sort();
    return uniqueDates.map((dateStr, index) => {
      const formatted = formatDate(dateStr);
      return {
        id: index,
        label: formatted.dayLabel,
        day: formatted.day,
        date: dateStr,
      };
    });
  }, [agenda]);

  // Filter agenda by selected date and transform data
  const agendaData = useMemo(() => {
    if (!agenda || agenda.length === 0) return { morning: [], afternoon: [], evening: [] };
    
    const selectedDateStr = dates[selectedDateIndex]?.date;
    if (!selectedDateStr) return { morning: [], afternoon: [], evening: [] };

    const filteredItems = agenda
      .filter(item => item.date === selectedDateStr)
      .map(item => ({
        id: item.id,
        title: item.title || 'Untitled Session',
        time: formatTime(item.time),
        description: normalizeWhitespace(decodeEntities(stripHtml(item.description || ''))),
        location: item.location || item.venue || '',
        date: item.date,
        event_id: item.event_id,
      }));

    return groupAgendaByTime(filteredItems);
  }, [agenda, selectedDateIndex, dates]);

  const filteredAgendaData = useMemo(() => {
    if (!searchQuery.trim()) return agendaData;
    
    const query = searchQuery.toLowerCase();
    const filterItems = (items) => 
      items.filter(item => 
        (item.title || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        (item.location || '').toLowerCase().includes(query)
      );
    
    return {
      morning: filterItems(agendaData.morning),
      afternoon: filterItems(agendaData.afternoon),
      evening: filterItems(agendaData.evening),
    };
  }, [searchQuery, agendaData]);

const hasAnyResults = useMemo(() => {
    return (
      filteredAgendaData.morning.length > 0 ||
      filteredAgendaData.afternoon.length > 0 ||
      filteredAgendaData.evening.length > 0
    );
  }, [filteredAgendaData]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const AgendaCard = ({ item, sectionColor }) => (
    <TouchableOpacity 
      style={styles.agendaCard} 
      onPress={() => {
        router.push({
          pathname: '/agenda-detail',
          params: {
            agendaId: item.id.toString()
          }
        });
      }}
      activeOpacity={0.8}
    >
      <View style={styles.agendaCardHeader}>
        <Text style={styles.agendaCardTitle}>{item.title}</Text>
      </View>
      
      <Text style={styles.agendaTime}>{item.time}</Text>
      
      {item.description ? (
        <Text style={styles.agendaDescription}
          numberOfLines={2}
          ellipsizeMode="tail">{item.description}</Text>
      ) : null}
      
      <View style={styles.agendaFooter}>
        {item.location ? (
          <View style={styles.locationContainer}>
            <MapPinIcon size={12} />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const AgendaSection = ({ title, items, sectionColor }) => (
    <View style={styles.agendaSection}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIndicator, { backgroundColor: sectionColor }]} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {items.length > 0 ? (
        items.map((item) => (
          <AgendaCard key={item.id} item={item} sectionColor={sectionColor} />
        ))
      ) : (
        <Text style={{ color: colors.gray500, fontSize: 14 }}>
          No sessions in this section.
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      <Header 
        title="Agenda" 
        leftIcon="menu" 
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize} 
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false} 
        bounces={false}
      >
        <View style={styles.content}>
          {/* Date Selector - always visible; shows inline spinner on selected pill while loading */}
          <View style={styles.dateSelector}>
            {(dates.length > 0 ? dates : [{ id: 0, label: 'DAY', day: '' }]).map((date) => (
              <TouchableOpacity
                key={date.id}
                style={[
                  styles.dateButton,
                  selectedDateIndex === date.id && styles.dateButtonSelected
                ]}
                onPress={() => dates.length > 0 && setSelectedDateIndex(date.id)}
                disabled={dates.length === 0}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.dateButtonDayText,
                  selectedDateIndex === date.id && styles.dateButtonDayTextSelected
                ]}>
                  {date.label}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[
                    styles.dateButtonDateText,
                    selectedDateIndex === date.id && styles.dateButtonDateTextSelected
                  ]}>
                    {date.day || ''}
                  </Text>
                  {isLoading && selectedDateIndex === date.id ? (
                    <ActivityIndicator
                      size="small"
                      color={selectedDateIndex === date.id ? colors.primary : colors.white}
                      style={{ marginLeft: 8 }}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          
          {/* Error State */}
          {error && !isLoading && (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={48} color={colors.textMuted} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Search Bar */}
          <SearchBar
            placeholder="Search agenda items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Agenda Sections: now handle loading/error inside this area */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading agenda...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={48} color={colors.textMuted} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : hasAnyResults ? (
            <>
              <AgendaSection 
                title="Morning" 
                items={filteredAgendaData.morning} 
                sectionColor="#FACC15" 
              />
              <AgendaSection 
                title="Afternoon" 
                items={filteredAgendaData.afternoon} 
                sectionColor="#FB923C" 
              />
              <AgendaSection 
                title="Evening" 
                items={filteredAgendaData.evening} 
                sectionColor="#C084FC" 
              />
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Icon name={searchQuery ? "search" : "calendar"} size={22} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No results found' : 'No agenda items for this date'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Try a different keyword or clear the search.'
                  : 'Select a different date or check back later.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
  },
  
  dateSelector: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 50,
    padding: 5,
    marginTop: SIZES.sectionSpacing - 10,
    marginBottom: SIZES.cardSpacing,
    height: SIZES.dateSelectorHeight,
    alignItems: 'center',
  },
  dateButton: {
    flex: 1,
    height: SIZES.dateSelectorHeight - 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    paddingVertical: 10,
  },
  dateButtonSelected: {
    backgroundColor: colors.white,
  },
  dateButtonDayText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 2,
  },
  dateButtonDayTextSelected: {
    color: colors.primary,
  },
  dateButtonDateText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
  },
  dateButtonDateTextSelected: {
    color: colors.primary,
  },


  // Agenda Sections
  agendaSection: {
    marginBottom: SIZES.sectionSpacing,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIndicator: {
    width: 8,
    height: 32,
    borderRadius: 9999,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: SIZES.title - 1,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 26,
  },

  // Agenda Cards
  agendaCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray100,
    padding: 17,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  agendaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  agendaCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
    flex: 1,
  },
  durationBadge: {
    backgroundColor: colors.gray100,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.gray500,
    lineHeight: 14,
  },
  agendaTime: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
    lineHeight: 16,
    marginBottom: 8,
  },
  agendaDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.gray600,
    lineHeight: 16,
    marginBottom: 16,
  },
  agendaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speakerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  speakerName: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.gray700,
    lineHeight: 18,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.gray500,
    lineHeight: 15,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.gray600,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default AgendaScreen;
