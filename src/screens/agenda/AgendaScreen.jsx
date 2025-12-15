import Icon from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { SearchBar } from '../../components/common/SearchBar';
import { colors } from '../../constants/theme';
import { commonSizes, useResponsiveSizes } from '../../hooks/useResponsiveSizes';

const MapPinIcon = ({ color = colors.gray500, size = 12 }) => (
  <Icon name="map-pin" size={size} color={color} />
);

const UserIcon = ({ color = colors.gray500, size = 24 }) => (
  <Icon name="user" size={size} color={color} />
);

export const AgendaScreen = () => {
  const navigation = useNavigation();
  const [selectedDate, setSelectedDate] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Use responsive sizes hook
  const { SIZES, isTablet } = useResponsiveSizes({
    headerIconSize: commonSizes.headerIconSize,
    contentMaxWidth: commonSizes.contentMaxWidth,
    paddingHorizontal: commonSizes.paddingHorizontal,
    sectionSpacing: commonSizes.sectionSpacing,
    cardSpacing: commonSizes.cardSpacing,
    title: commonSizes.title,
    body: commonSizes.body,
    dateSelectorHeight: { android: 56, ios: 58, tablet: 60, default: 56 },
  });

  const dates = [
    { id: 0, label: 'MON', day: '15' },
    { id: 1, label: 'TUE', day: '16' },
    { id: 2, label: 'WED', day: '17' },
    { id: 3, label: 'THU', day: '18' },
  ];

  const agendaData = useMemo(() => ({
    morning: [
      {
        id: 1,
        title: 'Opening Keynote',
        duration: '60 min',
        time: '9:00 - 10:00 AM',
        description: 'Welcome address and industry overview by CEO',
        location: 'Main Auditorium',
        speakerAvatar: true,
      },
      {
        id: 2,
        title: 'Product Demo Session by John Doe & Jane Smith (CEO & CTO)',
        duration: '60 min',
        time: '9:00 - 10:00 AM',
        description: `Live demonstration of our latest product features and capabilities as well as a Q&A session with the CEO and CTO of the company. This session will be moderated by the CEO of the company. The CEO will be available for a Q&A session after the demonstration. The session will be followed by a networking break. 

        This session aims to offer an in-depth exploration of our most recent technological advancements, emphasizing not only practical use-cases but also development decisions that led to the final product. Attendees will witness step-by-step walkthroughs of major features, with live interaction and demos prepared by the lead engineering team. The goal is to demystify the user experience, highlight critical differentiators from competitor solutions, and give concrete examples of how our product addresses real-world challenges in efficiency, scalability, and integration. 

        The CEO will open the session with a short address discussing the company’s vision for innovation and commitment to customer-centric product development. Following the address, the CTO will present a technical deep-dive into two new core modules now available in the latest release. You’ll learn about design choices, open questions the team addressed along the way, and how customer feedback influenced functionality and support.

        Throughout the demonstration, attendees are encouraged to submit their questions via the event app or by raising a hand in the audience. After the formal demonstration, there will be a dedicated Q&A period where the CEO and CTO will answer questions regarding roadmap, challenges, technical specifics, and customer adoption.

        Specific focus topics will include: 
        - The architecture and security enhancements of the major platform update;
        - How the product integrates with various cloud services;
        - The new user personalization and analytics dashboard;
        - Streamlined onboarding for enterprise teams;
        - Recent real-world case studies that illustrate tangible results for key clients.

        As a highlight, the product team will invite a select customer to join the stage and share their perspective and experience with the product, focusing on ease of use and implementation feedback. This segment will allow attendees to directly hear from their peers and expand their understanding of deployment best practices.

        The session will conclude with remarks from the CTO outlining the next steps in the company’s innovation journey, inviting all feedback and participation in future beta programs. This event is designed to be highly interactive, informative, and to foster direct connections between customers and the leadership team.

        After the Q&A, everyone is encouraged to join the networking break in the Demo Hall, where product managers, engineers, and customer success representatives will be available for one-on-one discussions, further demonstrations, and to gather feedback on both the session and the product. Refreshments, product literature, and exclusive event swag will be provided.

        Whether you are a new customer interested in seeing our product capabilities first-hand, a long-time partner eager to understand the direction we’re heading, or an enthusiast hoping for a technical deep-dive, this session is structured to provide maximum value. Attendees will leave with not only a comprehensive understanding of what makes our latest product iteration unique but also with new contacts, fresh insights, and the opportunity to influence future updates.
        `,
        location: 'Demo Hall',
      },
    ],
    afternoon: [
      {
        id: 3,
        title: 'Panel Discussion',
        duration: '60 min',
        time: '9:00 - 10:00 AM',
        description: 'Industry experts discuss future trends and challenges',
        location: 'Conference Room A',
      },
      {
        id: 4,
        title: 'Networking Break',
        duration: '60 min',
        time: '9:00 - 10:00 AM',
        description: 'Connect with fellow attendees over coffee and refreshments',
        location: 'Lobby Area',
      },
    ],
    evening: [
      {
        id: 5,
        title: 'Closing Ceremony',
        duration: '45 min',
        time: '5:00 PM',
        description: 'Awards presentation and closing remarks',
        location: 'Main Auditorium',
      },
    ],
  }), []);

  const filteredAgendaData = useMemo(() => {
    if (!searchQuery.trim()) return agendaData;
    
    const query = searchQuery.toLowerCase();
    const filterItems = (items) => 
        items.filter(item => 
            item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query)
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
            agendaItem: JSON.stringify(item)
          }
        });
      }}
      activeOpacity={0.8}
    >
      <View style={styles.agendaCardHeader}>
        <Text style={styles.agendaCardTitle}>{item.title}</Text>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{item.duration}</Text>
        </View>
      </View>
      
      <Text style={styles.agendaTime}>{item.time}</Text>
      
      <Text style={styles.agendaDescription}
        numberOfLines={2}
        ellipsizeMode="tail">{item.description}</Text>
      
      <View style={styles.agendaFooter}>
        {item.speaker && (
          <View style={styles.speakerContainer}>
            <View style={styles.speakerAvatar}>
              <UserIcon size={24} color={colors.gray500} />
            </View>
            <Text style={styles.speakerName}>{item.speaker}</Text>
          </View>
        )}
        
        <View style={styles.locationContainer}>
          <MapPinIcon size={12} />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
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
          {/* Date Selector */}
          <View style={styles.dateSelector}>
            {dates.map((date) => (
              <TouchableOpacity
                key={date.id}
                style={[
                  styles.dateButton,
                  selectedDate === date.id && styles.dateButtonSelected
                ]}
                onPress={() => setSelectedDate(date.id)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.dateButtonDayText,
                  selectedDate === date.id && styles.dateButtonDayTextSelected
                ]}>
                  {date.label}
                </Text>
                <Text style={[
                  styles.dateButtonDateText,
                  selectedDate === date.id && styles.dateButtonDateTextSelected
                ]}>
                  {date.day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Bar */}
          <SearchBar
            placeholder="Search agenda items..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Agenda Sections */}
          {hasAnyResults ? (
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
                <Icon name="search" size={22} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different keyword or clear the search.
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
});

export default AgendaScreen;
