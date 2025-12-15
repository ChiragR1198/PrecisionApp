import Icon from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  PixelRatio,
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
import { SearchBar } from '../../components/common/SearchBar';
import { colors, radius } from '../../constants/theme';

console.log('Platform:', Platform.OS);
console.log('Screen:', Dimensions.get('window'));
console.log('Pixel Ratio:', PixelRatio.get());

const ChevronRightIcon = ({ color = colors.primary, size = 20 }) => (
  <Icon name="chevron-right" size={size} color={color} />
);

const UserIcon = ({ color = colors.white, size = 18 }) => (
  <Icon name="user" size={size} color={color} />
);

export const AttendeesScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('Name (A to Z)');

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
        title: getResponsiveValue({ android: 15, ios: 16, tablet: 17, default: 15 }),
        body: getResponsiveValue({ android: 13, ios: 14, tablet: 14, default: 13 }),
        filterHeight: getResponsiveValue({ android: 46, ios: 48, tablet: 48, default: 46 }),
        avatarSize: getResponsiveValue({ android: 53, ios: 54, tablet: 55, default: 53 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  // Filter options and sample data (can be wired to API later)
  const FILTER_OPTIONS = useMemo(() => (
    [
      'All Services',
      'Product',
      'Development',
      'Marketing',
      'Design',
      'Sales',
      'Data',
    ]
  ), []);

  const SORT_OPTIONS = useMemo(() => (
    [
      'Name (A to Z)',
      'Name (Z to A)',
      'Company (A to Z)',
      'Company (Z to A)',
      'Role (A to Z)',
      'Role (Z to A)',
      'Newest',
      'Oldest',
    ]
  ), []);

  const DATA = useMemo(() => ([
    { 
      id: '1', 
      name: 'Sarah Johnson', 
      role: 'Senior Product Manager', 
      company: 'TechCorp Solutions', 
      service: 'Product', 
      joinedAt: '2025-03-10',
      email: 'sarah.johnson@techcorp.com',
      phone: '+1 (555) 123-4567',
      linkedin: 'linkedin.com/in/sarahjohnson',
      industry: 'Technology & Software',
      yearsOfExperience: '8+ years',
      location: 'San Francisco, CA',
    },
    { 
      id: '2', 
      name: 'Michael Chen', 
      role: 'Lead Developer', 
      company: 'InnovateLab', 
      service: 'Development', 
      joinedAt: '2025-03-14',
      email: 'michael.chen@innovatelab.com',
      phone: '+1 (555) 234-5678',
      linkedin: 'linkedin.com/in/michaelchen',
      industry: 'Technology & Software',
      yearsOfExperience: '10+ years',
      location: 'New York, NY',
    },
    { 
      id: '3', 
      name: 'Emily Rodriguez', 
      role: 'Marketing Director', 
      company: 'BrandForward Agency', 
      service: 'Marketing', 
      joinedAt: '2025-03-09',
      email: 'emily.rodriguez@brandforward.com',
      phone: '+1 (555) 345-6789',
      linkedin: 'linkedin.com/in/emilyrodriguez',
      industry: 'Marketing & Advertising',
      yearsOfExperience: '7+ years',
      location: 'Los Angeles, CA',
    },
    { 
      id: '4', 
      name: 'David Park', 
      role: 'UX Designer', 
      company: 'CreativeStudio', 
      service: 'Design', 
      joinedAt: '2025-03-12',
      email: 'david.park@creativestudio.com',
      phone: '+1 (555) 456-7890',
      linkedin: 'linkedin.com/in/davidpark',
      industry: 'Design & Creative',
      yearsOfExperience: '6+ years',
      location: 'Seattle, WA',
    },
    { 
      id: '5', 
      name: 'Lisa Thompson', 
      role: 'Sales Manager', 
      company: 'GlobalSales Co.', 
      service: 'Sales', 
      joinedAt: '2025-03-08',
      email: 'lisa.thompson@globalsales.com',
      phone: '+1 (555) 567-8901',
      linkedin: 'linkedin.com/in/lisathompson',
      industry: 'Sales & Business Development',
      yearsOfExperience: '9+ years',
      location: 'Chicago, IL',
    },
    { 
      id: '6', 
      name: 'Alex Kumar', 
      role: 'Data Analyst', 
      company: 'DataInsights Ltd.', 
      service: 'Data', 
      joinedAt: '2025-03-15',
      email: 'alex.kumar@datainsights.com',
      phone: '+1 (555) 678-9012',
      linkedin: 'linkedin.com/in/alexkumar',
      industry: 'Data & Analytics',
      yearsOfExperience: '5+ years',
      location: 'Austin, TX',
    },
  ]), []);

  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = DATA;
    if (selectedService && selectedService !== 'All Services') {
      base = base.filter((a) => a.service === selectedService);
    }
    if (q) {
      base = base.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.company.toLowerCase().includes(q)
      );
    }
    // Apply sorting
    const sorted = [...base];
    switch (sortBy) {
      case 'Name (Z to A)':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'Company (A to Z)':
        sorted.sort((a, b) => String(a.company || '').localeCompare(String(b.company || '')));
        break;
      case 'Company (Z to A)':
        sorted.sort((a, b) => String(b.company || '').localeCompare(String(a.company || '')));
        break;
      case 'Role (A to Z)':
        sorted.sort((a, b) => String(a.role || '').localeCompare(String(b.role || '')));
        break;
      case 'Role (Z to A)':
        sorted.sort((a, b) => String(b.role || '').localeCompare(String(a.role || '')));
        break;
      case 'Newest':
        sorted.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
        break;
      case 'Oldest':
        sorted.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
        break;
      case 'Name (A to Z)':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [searchQuery, selectedService, sortBy, DATA]);

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.row} 
      activeOpacity={0.8} 
      onPress={() => {
        router.push({
          pathname: '/delegate-details',
          params: {
            delegate: JSON.stringify(item)
          }
        });
      }}
    >
      <View style={[styles.avatar, { width: SIZES.avatarSize, height: SIZES.avatarSize, borderRadius: SIZES.avatarSize / 2 }]}>
       <UserIcon size={SIZES.avatarSize * 0.5} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{item.role}</Text>
        <Text style={[styles.rowMeta1]} numberOfLines={1}>{item.company}</Text>
      </View>
      <ChevronRightIcon />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header 
        title="Attendees" 
        leftIcon="menu" 
        onLeftPress={() => navigation.openDrawer?.()} 
        iconSize={SIZES.headerIconSize} 
      />

      <View style={styles.contentWrap}>
        <View style={styles.content}>
          <SearchBar
            placeholder="Search attendees..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
          />

          <View style={styles.filtersRow}>
            <TouchableOpacity style={styles.selectServiceBtn} activeOpacity={0.8} onPress={() => setIsFilterOpen(true)}>
              <View style={styles.selectServiceContent}>
                <Text style={styles.selectServiceText}>{selectedService || 'Select Service'}</Text>
                <Icon name="chevron-down" size={16} color={colors.text} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterIconBtn} activeOpacity={0.8} onPress={() => setIsSortOpen(true)}>
              <Icon name="sliders" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.countRow}>
            <View style={styles.countDot} />
            <Text style={styles.countText}>{String(filteredData.length)} ATTENDEES</Text>
          </View>

          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
      {/* Filter modal */}
      <Modal transparent animationType="fade" visible={isFilterOpen} onRequestClose={() => setIsFilterOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropPressable} activeOpacity={1} onPress={() => setIsFilterOpen(false)} />
          <View style={styles.modalCenterWrap}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Service</Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} showsVerticalScrollIndicator>
                {FILTER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.modalItem, selectedService === opt && styles.modalItemActive]}
                    activeOpacity={0.9}
                    onPress={() => { setSelectedService(opt === 'All Services' ? null : opt); setIsFilterOpen(false); }}
                  >
                    <Text style={[styles.modalItemText, selectedService === opt && styles.modalItemTextActive]}>{opt}</Text>
                    {selectedService === opt || (opt === 'All Services' && !selectedService) ? (
                      <Icon name="check" size={16} color={colors.primary} />
                    ) : (
                      <View />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={() => setIsFilterOpen(false)} activeOpacity={0.8} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Sort modal */}
      <Modal transparent animationType="fade" visible={isSortOpen} onRequestClose={() => setIsSortOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropPressable} activeOpacity={1} onPress={() => setIsSortOpen(false)} />
          <View style={styles.modalCenterWrap}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Sort By</Text>
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent} showsVerticalScrollIndicator>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.modalItem, sortBy === opt && styles.modalItemActive]}
                    activeOpacity={0.9}
                    onPress={() => { setSortBy(opt); setIsSortOpen(false); }}
                  >
                    <Text style={[styles.modalItemText, sortBy === opt && styles.modalItemTextActive]}>{opt}</Text>
                    {sortBy === opt ? (
                      <Icon name="check" size={16} color={colors.primary} />
                    ) : (
                      <View />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={() => setIsSortOpen(false)} activeOpacity={0.8} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
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
  contentWrap: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: SIZES.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: SIZES.paddingHorizontal,
    paddingTop: 8,
  },
  searchBar: {
    marginTop: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  selectServiceBtn: {
    flex: 1,
    backgroundColor: colors.white,
    height: SIZES.filterHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  selectServiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectServiceText: {
    color: colors.text,
    fontSize: 14,
  },
  filterIconBtn: {
    width: SIZES.filterHeight,
    height: SIZES.filterHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  countDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  countText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  listContent: {
    paddingBottom: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  avatar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
    fontWeight: '600',
  },
  rowMeta1: {
    fontSize: 13,
    color: colors.primary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  // Modal styles (aligned with EventOverview)
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
  modalTitle: {
    fontSize: SIZES.title,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: isTablet ? 460 : 360,
  },
  modalListContent: {
    paddingVertical: 6,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemActive: {
    backgroundColor: 'transparent',
  },
  modalItemText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.text,
  },
  modalItemTextActive: {
    color: colors.primary,
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
});

export default AttendeesScreen;


