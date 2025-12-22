import Icon from '@expo/vector-icons/Feather';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { colors } from '../../constants/theme';
import { useGetAgendaDetailsQuery } from '../../store/api';

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

// Helper function to format date
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return { date: '', dayName: '' };
  const date = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    date: `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
    dayName: days[date.getDay()],
  };
};

export const AgendaDetailScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  
  const { data: agendaData, isLoading, error, refetch } = useGetAgendaDetailsQuery(
    params?.agendaId,
    { skip: !params?.agendaId }
  );
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

  // Transform agenda item data for display
  const agendaItem = useMemo(() => {
    if (!selectedAgendaItem) {
      return {
        id: null,
        title: 'Loading...',
        time: '',
        description: '',
        location: '',
        date: '',
        dayName: '',
        category: 'Session',
        speakers: [],
      };
    }

    const dateFormatted = formatDateDisplay(selectedAgendaItem.date);
    return {
      id: selectedAgendaItem.id,
      title: selectedAgendaItem.title || 'Untitled Session',
      time: formatTime(selectedAgendaItem.time),
      description: selectedAgendaItem.description || '',
      location: selectedAgendaItem.location || selectedAgendaItem.venue || '',
      locationDetails: '',
      date: dateFormatted.date,
      dayName: dateFormatted.dayName,
      category: 'Session',
      speakers: [],
    };
  }, [selectedAgendaItem]);

  const descriptionText = agendaItem.description || 'No description available.';

  // Description expand state and long-desc boolean.
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const isLongDescription = (descriptionText?.length || 0) > 220;

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

  // Update SpeakerCard to match image
  const SpeakerCard = ({ speaker, isLast }) => (
    <TouchableOpacity style={[ styles.speakerCard, isLast && { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 }]} activeOpacity={0.8}>
      <View style={styles.speakerAvatar}>
        <View style={styles.avatarPlaceholder}>
          <UserIcon />
        </View>
      </View>
      <View style={styles.speakerInfo}>
        <Text style={styles.speakerName}>{speaker.name}</Text>
        <Text style={styles.speakerTitle}>{speaker.title}</Text>
      </View>
      <ChevronRightIcon />
    </TouchableOpacity>
  );

  const TopicTag = ({ topic }) => (
    <View style={styles.topicTag}>
      <Text style={styles.topicTagText}>{topic}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header 
          title="Agenda Detail" 
          leftIcon="arrow-left" 
          onLeftPress={() => router.push('/agenda')} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading agenda details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header 
          title="Agenda Detail" 
          leftIcon="arrow-left" 
          onLeftPress={() => router.push('/agenda')} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header 
        title="Agenda Detail" 
        leftIcon="arrow-left" 
        onLeftPress={() => router.push('/agenda')} 
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
              <Text style={styles.categoryTagText}>{agendaItem.category}</Text>
            </View>
            
            <Text style={styles.eventTitle}>{agendaItem.title}</Text>
            
            <View style={styles.timeContainer}>
              <ClockIcon />
              <Text style={styles.timeText}>{agendaItem.time}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Details Card */}
          <View style={styles.detailsCard}>
            {/* Date and Location */}
            <View style={styles.detailRow}>
              <View style={styles.iconBackground}>
                <CalendarIcon />
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailTitle}>{agendaItem.date}</Text>
                <Text style={styles.detailSubtitle}>{agendaItem.dayName}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.iconBackground}>
                <MapPinIcon />
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailTitle}>{agendaItem.location}</Text>
                <Text style={styles.detailSubtitle}>{agendaItem.locationDetails}</Text>
              </View>
            </View>

            {/* Speakers Section - Only show if speakers exist */}
            {agendaItem.speakers && agendaItem.speakers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Speakers</Text>
                {agendaItem.speakers.map((speaker, index) => (
                  <SpeakerCard key={speaker.id} speaker={speaker} isLast={index === agendaItem.speakers.length - 1} />
                ))}
              </View>
            )}

            {/* Description Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descriptionText}>
                {isDescExpanded ? descriptionText : descriptionText.substring(0, 200) + (descriptionText.length > 200 ? '...' : '')}
              </Text>

              {isLongDescription ? (
                <TouchableOpacity
                  style={{ marginTop: 12 }}
                  activeOpacity={0.8}
                  onPress={() => setIsDescExpanded((v) => !v)}
                >
                  <Text style={styles.readMore}>
                    {isDescExpanded ? 'Show Less' : 'Read More'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

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
    paddingHorizontal: SIZES.paddingHorizontal * 1.5,
    marginTop: SIZES.contentOverlap,
  },
  eventBanner: {
    marginTop: SIZES.sectionSpacing - 15,
    minHeight: SIZES.bannerMinHeight + 10,
    justifyContent: 'flex-start',
  },
  bannerContent: {
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingVertical: SIZES.sectionSpacing,
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
    marginBottom: 12,
    paddingRight: SIZES.paddingHorizontal * 2,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: SIZES.body,
    fontWeight: '500',
    color: colors.white,
    marginLeft: 8,
  },
  detailsCard: {
    backgroundColor: colors.white,
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
  descriptionText: {
    fontSize: SIZES.body,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 24,
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
