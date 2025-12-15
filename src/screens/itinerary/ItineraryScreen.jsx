import React, { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
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

const FILTERS = ['All Days', 'Today', 'Tomorrow'];

const ITINERARY = [
  {
    id: 'day1',
    day: 'Day 1 - March 15, 2025',
    events: [
      {
        id: 'event1',
        title: 'Opening Keynote',
        subtitle: 'Main Auditorium',
        icon: '🎤',
        time: '9:00 AM - 10:00 AM',
      },
      {
        id: 'event2',
        title: 'Panel Discussion',
        subtitle: 'Future of Technology • Hall A',
        icon: '🧩',
        time: '10:30 AM - 12:00 PM',
      },
      {
        id: 'event3',
        title: 'Networking Lunch',
        subtitle: 'Connect with attendees • Room B1',
        icon: '🥗',
        time: '12:00 PM - 1:30 PM',
      },
    ],
  },
  {
    id: 'day2',
    day: 'Day 2 - March 16, 2025',
    events: [
      {
        id: 'event4',
        title: 'Workshop: AI Development',
        subtitle: 'Hands-on coding session • Cafeteria',
        icon: '💻',
        time: '9:00 AM - 11:30 AM',
      },
      {
        id: 'event5',
        title: 'Awards Ceremony',
        subtitle: 'Recognition of achievements • Lab C2',
        icon: '🏆',
        time: '2:00 PM - 3:30 PM',
      },
    ],
  },
];

export const ItineraryScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Days');

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

  const filteredItinerary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ITINERARY.filter((day, index) => {
      if (activeFilter === 'Today' && index !== 0) return false;
      if (activeFilter === 'Tomorrow' && index !== 1) return false;
      if (!q) return true;
      return day.events.some(
        (event) =>
          event.title.toLowerCase().includes(q) ||
          event.subtitle.toLowerCase().includes(q)
      );
    });
  }, [activeFilter, searchQuery]);

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
    <SafeAreaView style={styles.container} edges={['top']}>
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
  });

export default ItineraryScreen;

