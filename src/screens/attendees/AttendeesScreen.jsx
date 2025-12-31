import Icon from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { SearchBar } from '../../components/common/SearchBar';
import { Icons } from '../../constants/icons';
import { colors, radius } from '../../constants/theme';
import {
  useGetDelegateAttendeesQuery,
  useGetSponsorAllAttendeesQuery,
  useGetSponsorServicesQuery,
  useSendDelegateMeetingRequestMutation,
  useSendSponsorMeetingRequestMutation
} from '../../store/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearAuth } from '../../store/slices/authSlice';

const UserIcon = Icons.User;

const AttendeeRow = React.memo(function AttendeeRow({
  item,
  SIZES,
  styles,
  onOpenDetails,
  onOpenRequest,
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => onOpenDetails(item)}
    >
      <View
        style={[
          styles.avatar,
          {
            width: SIZES.avatarSize,
            height: SIZES.avatarSize,
            borderRadius: SIZES.avatarSize / 2,
          },
        ]}
      >
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={{
              width: SIZES.avatarSize,
              height: SIZES.avatarSize,
              borderRadius: SIZES.avatarSize / 2,
            }}
            resizeMode="cover"
          />
        ) : (
          <UserIcon size={SIZES.avatarSize * 0.5} />
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.role}
        </Text>
        <Text style={[styles.rowMeta1]} numberOfLines={1}>
          {item.company}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.requestButton}
        activeOpacity={0.85}
        onPress={(e) => {
          e.stopPropagation();
          onOpenRequest(item);
        }}
      >
        <Text style={styles.requestButtonText}>Request</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export const AttendeesScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryDebounced, setSearchQueryDebounced] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [draftSelectedServices, setDraftSelectedServices] = useState([]);
  
  // Conditionally fetch attendees based on user type
  const { 
    data: delegateAttendeesData, 
    isLoading: delegateLoading, 
    error: delegateError, 
    refetch: delegateRefetch 
  } = useGetDelegateAttendeesQuery(undefined, {
    skip: !isAuthenticated || !user || !isDelegate, // Skip for sponsors
    refetchOnMountOrArgChange: true,
  });
  
  // For sponsors, pass selectedServices to filter attendees by service
  const { 
    data: sponsorAttendeesData, 
    isLoading: sponsorLoading, 
    error: sponsorError, 
    refetch: sponsorRefetch 
  } = useGetSponsorAllAttendeesQuery(selectedServices.length > 0 ? selectedServices : undefined, {
    skip: !isAuthenticated || !user || isDelegate, // Skip for delegates
    refetchOnMountOrArgChange: true,
  });
  
  const attendeesData = isDelegate ? delegateAttendeesData : sponsorAttendeesData;
  const isLoading = isDelegate ? delegateLoading : sponsorLoading;
  const error = isDelegate ? delegateError : sponsorError;
  const refetch = isDelegate ? delegateRefetch : sponsorRefetch;
  
  const [createDelegateMeetingRequest] = useSendDelegateMeetingRequestMutation();
  const [createSponsorMeetingRequest] = useSendSponsorMeetingRequestMutation();
  const createMeetingRequest = isDelegate ? createDelegateMeetingRequest : createSponsorMeetingRequest;
  
  // Fetch sponsor services for filter
  const eventId = user?.event_id || user?.events?.[0]?.id || 27;
  const { 
    data: sponsorServicesData, 
    isLoading: servicesLoading 
  } = useGetSponsorServicesQuery(eventId, {
    skip: !isAuthenticated || !user || isDelegate, // Skip for delegates
    refetchOnMountOrArgChange: true,
  });
  
  // Handle authentication errors - redirect to login
  useEffect(() => {
    if (error && (error.status === 401 || error.status === 'NO_TOKEN' || error.status === 403 || error.status === 'AUTH_REQUIRED')) {
      console.log('🚪 Auth error detected - redirecting to login. Status:', error.status);
      dispatch(clearAuth());
      setTimeout(() => {
        router.replace('/login');
      }, 0);
    }
  }, [error, dispatch]);
  
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return 'Failed to load attendees.';
  }, [error]);

  const attendees = useMemo(() => {
    return attendeesData?.data || attendeesData || [];
  }, [attendeesData]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('Name (A to Z)');
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState('1st');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;
  


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

  // Filter options - use API data for sponsors, hardcoded for delegates
  const sponsorServices = useMemo(() => {
    if (!sponsorServicesData) return [];
    // Handle API response structure: { services: [...] } or direct array
    const services = sponsorServicesData?.services || sponsorServicesData?.data || sponsorServicesData || [];
    return Array.isArray(services) ? services : [];
  }, [sponsorServicesData]);

  const FILTER_OPTIONS = useMemo(() => {
    if (isDelegate) {
      // For delegates, use hardcoded options (or empty if not needed)
      return [];
    }
    // For sponsors, use services from API (no "All Services" option for multi-select)
    const services = sponsorServices.map((service) => {
      // Handle both object and string formats
      return typeof service === 'string' ? service : (service.name || service.title || service.service || '');
    }).filter(Boolean);
    return services;
  }, [isDelegate, sponsorServices]);

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

  // Transform API data to UI format
  // NOTE: We keep the full original attendee object (...attendee)
  // so that ANY field coming from backend (present or future)
  // is available in the app (e.g. address, bio, linkedin_url, etc.)
  const DATA = useMemo(() => {
    if (!attendees || attendees.length === 0) return [];
    return attendees.map((attendee) => {
      // Avoid cloning/spreading the full object for every attendee (big perf win on large lists).
      const id = attendee?.id;
      const name =
        attendee?.name ||
        attendee?.full_name ||
        attendee?.fullName ||
        attendee?.delegate_name ||
        'Unknown';
      const role = attendee?.job_title || '';
      const company = attendee?.company || '';
      const nameKey = String(name || '').toLowerCase();
      const roleKey = String(role || '').toLowerCase();
      const companyKey = String(company || '').toLowerCase();

      return {
        id,
        name,
        full_name: attendee?.full_name || attendee?.fullName || '',
        role,
        company,
        service:
          attendee?.service ||
          attendee?.service_name ||
          attendee?.service_title ||
          'All Services',
        email: attendee?.email || '',
        phone: attendee?.mobile || '',
        image: attendee?.image || null,
        address: attendee?.address || attendee?.Address || '',
        bio: attendee?.bio || '',
        linkedin: attendee?.linkedin_url || attendee?.linkedin || '',
        status: attendee?.status,
        // Precomputed keys for fast search/sort
        _nameKey: nameKey,
        _roleKey: roleKey,
        _companyKey: companyKey,
        _searchText: `${nameKey} ${roleKey} ${companyKey}`,
        // Keep raw available (used only when navigating/details)
        raw: attendee,
      };
    });
  }, [attendees]);

  // Important perf detail:
  // - Sorting can be O(n log n); don't re-sort on every search keystroke.
  // - We sort only when DATA or sortBy changes, then apply cheap filter for search.
  const sortedData = useMemo(() => {
    const sorted = [...DATA];
    switch (sortBy) {
      case 'Name (Z to A)':
        sorted.sort((a, b) => String(b?._nameKey || '').localeCompare(String(a?._nameKey || '')));
        break;
      case 'Company (A to Z)':
        sorted.sort((a, b) => String(a?._companyKey || '').localeCompare(String(b?._companyKey || '')));
        break;
      case 'Company (Z to A)':
        sorted.sort((a, b) => String(b?._companyKey || '').localeCompare(String(a?._companyKey || '')));
        break;
      case 'Role (A to Z)':
        sorted.sort((a, b) => String(a?._roleKey || '').localeCompare(String(b?._roleKey || '')));
        break;
      case 'Role (Z to A)':
        sorted.sort((a, b) => String(b?._roleKey || '').localeCompare(String(a?._roleKey || '')));
        break;
      case 'Newest':
        // API doesn't provide date field, so sort by ID (newest = higher ID)
        sorted.sort((a, b) => (Number(b?.id) || 0) - (Number(a?.id) || 0));
        break;
      case 'Oldest':
        // API doesn't provide date field, so sort by ID (oldest = lower ID)
        sorted.sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0));
        break;
      case 'Name (A to Z)':
      default:
        sorted.sort((a, b) => String(a?._nameKey || '').localeCompare(String(b?._nameKey || '')));
        break;
    }
    return sorted;
  }, [sortBy, DATA]);

  const filteredData = useMemo(() => {
    const q = searchQueryDebounced.trim().toLowerCase();
    if (!q) return sortedData;
    // Service filtering is handled by API, so we don't filter here.
    return sortedData.filter((a) => (a?._searchText || '').includes(q));
  }, [searchQueryDebounced, sortedData]);

  const openModal = useCallback((attendee) => {
    setSelectedPriority('1st');
    setSelectedAttendee(attendee);
    setIsModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  useEffect(() => {
    if (isModalVisible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else if (selectedAttendee) {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setSelectedAttendee(null);
        }
      });
    }
  }, [isModalVisible, modalAnim, selectedAttendee]);

  const handleSendMeetingRequest = async () => {
    if (!selectedAttendee) return;

    try {
      // Validate attendee ID
      if (!selectedAttendee.id) {
        Alert.alert('Error', `Invalid ${isDelegate ? 'sponsor' : 'delegate'} ID`);
        return;
      }

      const priorityMap = { '1st': 1, '2nd': 2, '3rd': 3 };
      const priorityValue = priorityMap[selectedPriority] || 1;

      // Get current date and time
      const now = new Date();
      const date = now.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const time = now.toTimeString().split(' ')[0]; // Format: HH:MM:SS

      // Use different parameter names based on user type
      const requestData = isDelegate
        ? {
            sponsor_id: Number(selectedAttendee.id),
            event_id: Number(user?.event_id || 27),
            priority: priorityValue,
            date: date,
            time: time,
            message: '',
          }
        : {
            delegate_id: Number(selectedAttendee.id),
            event_id: Number(user?.event_id || 27),
            priority: priorityValue,
            date: date,
            time: time,
            message: '',
          };

      await createMeetingRequest(requestData).unwrap();

      Alert.alert('Success', 'Meeting request sent successfully');
      closeModal();
    } catch (e) {
      console.error('Error sending meeting request:', e);
      Alert.alert('Error', e?.data?.message || e?.message || 'Failed to send meeting request');
    }
  };

  // Debounce search to avoid filtering/sorting on every keystroke (big lists).
  useEffect(() => {
    const t = setTimeout(() => setSearchQueryDebounced(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const onOpenDetails = useCallback((item) => {
    const payload = item?.raw ? { ...item.raw, ...item } : item;
    if (payload?.raw) delete payload.raw;
    router.push({
      pathname: '/delegate-details',
      params: {
        delegate: JSON.stringify(payload),
      },
    });
  }, []);

  const onOpenRequest = openModal;

  const renderItem = useCallback(
    ({ item }) => (
      <AttendeeRow
        item={item}
        SIZES={SIZES}
        styles={styles}
        onOpenDetails={onOpenDetails}
        onOpenRequest={onOpenRequest}
      />
    ),
    [SIZES, styles, onOpenDetails, onOpenRequest]
  );

  const itemSeparator = useCallback(() => <View style={styles.separator} />, [styles.separator]);

  // Estimated fixed height (we clamp name to 1 line); helps FlatList virtualization.
  const ITEM_HEIGHT = useMemo(() => Math.round(SIZES.avatarSize + 32), [SIZES.avatarSize]);
  const getItemLayout = useCallback(
    (_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }),
    [ITEM_HEIGHT]
  );

  const openFilter = useCallback(() => {
    setDraftSelectedServices(selectedServices);
    setIsFilterOpen(true);
  }, [selectedServices]);

  const applyFilter = useCallback(() => {
    setSelectedServices(draftSelectedServices);
    setIsFilterOpen(false);
  }, [draftSelectedServices]);

  const clearDraftFilter = useCallback(() => {
    setDraftSelectedServices([]);
  }, []);

  const draftSelectedSet = useMemo(
    () => new Set(Array.isArray(draftSelectedServices) ? draftSelectedServices : []),
    [draftSelectedServices]
  );

  const toggleDraftService = useCallback((opt) => {
    setDraftSelectedServices((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const set = new Set(prevArr);
      if (set.has(opt)) set.delete(opt);
      else set.add(opt);
      return Array.from(set);
    });
  }, []);

  const renderServiceItem = useCallback(
    ({ item: opt }) => {
      const isSelected = draftSelectedSet.has(opt);
      return (
        <TouchableOpacity
          key={opt}
          style={[styles.modalItem, isSelected && styles.modalItemActive]}
          activeOpacity={0.9}
          onPress={() => toggleDraftService(opt)}
        >
          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>{opt}</Text>
          {isSelected ? <Icon name="check" size={16} color={colors.primary} /> : <View style={styles.checkboxUnchecked} />}
        </TouchableOpacity>
      );
    },
    [draftSelectedSet, styles, toggleDraftService]
  );

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header 
          title="Attendees" 
          leftIcon="menu" 
          onLeftPress={() => navigation.openDrawer?.()} 
          iconSize={SIZES.headerIconSize} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading attendees...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show error state
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header 
          title="Attendees" 
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
          {/* Search, Filter (sponsors only), and Sort in same row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBarWrapper}>
              <SearchBar
                placeholder="Search attendees..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchBarInline}
              />
            </View>
            {!isDelegate && (
              <TouchableOpacity
                style={[styles.filterIconBtn, selectedServices.length > 0 && styles.filterIconBtnActive]}
                activeOpacity={0.8}
                onPress={openFilter}
              >
                <Icon name="filter" size={18} color={colors.white} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.filterIconBtn}
              activeOpacity={0.8}
              onPress={() => setIsSortOpen(true)}
            >
              <Icon name="sliders" size={18} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.countRow}>
            <View style={styles.countDot} />
            <Text style={styles.countText}>{String(filteredData.length)} ATTENDEES</Text>
          </View>

          {filteredData.length > 0 ? (
            <FlatList
              data={filteredData}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              ItemSeparatorComponent={itemSeparator}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              updateCellsBatchingPeriod={50}
              windowSize={7}
              getItemLayout={getItemLayout}
            />
          ) : (
            <View style={styles.emptyState}>
              <Icon name="users" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No attendees found' : 'No attendees available'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery 
                  ? 'Try a different search term or clear the search.'
                  : 'Check back later for attendee information.'}
              </Text>
            </View>
          )}
        </View>
      </View>
      {/* Filter modal */}
      <Modal transparent animationType="fade" visible={isFilterOpen} onRequestClose={() => setIsFilterOpen(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalBackdropPressable} activeOpacity={1} onPress={() => setIsFilterOpen(false)} />
          <View style={styles.modalCenterWrap}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Service</Text>
              {servicesLoading && isDelegate === false ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.modalLoadingText}>Loading services...</Text>
                </View>
              ) : FILTER_OPTIONS.length === 0 ? (
                <View style={styles.modalLoadingContainer}>
                  <Text style={styles.modalLoadingText}>No services available</Text>
                </View>
              ) : (
                <FlatList
                  style={styles.modalList}
                  contentContainerStyle={styles.modalListContent}
                  data={FILTER_OPTIONS}
                  keyExtractor={(opt) => String(opt)}
                  renderItem={renderServiceItem}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={12}
                  maxToRenderPerBatch={12}
                  windowSize={7}
                  extraData={draftSelectedServices}
                />
              )}
              <View style={styles.modalButtonRow2}>
                {draftSelectedServices.length > 0 && (
                  <TouchableOpacity 
                    onPress={clearDraftFilter}
                    activeOpacity={0.8} 
                    style={[styles.modalCloseBtn, styles.modalClearBtn]}
                  >
                    <Text style={[styles.modalCloseText, styles.modalClearText]}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={applyFilter} activeOpacity={0.8} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>Apply</Text>
                </TouchableOpacity>
              </View>
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

      {/* Meeting Request Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isModalVisible || !!selectedAttendee}
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop2}>
          <Animated.View style={[styles.modalOverlay, { opacity: modalAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          </Animated.View>
          <Animated.View
            style={[
              styles.modalCard2,
              {
                transform: [
                  {
                    translateY: modalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalHeader2}>
              <Text style={styles.modalTitle2}>Send Meeting Request</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedAttendee && (
              <>
                <View style={styles.modalContactRow}>
                  <View style={styles.modalAvatar}>
                    {selectedAttendee.image ? (
                      <Image 
                        source={{ uri: selectedAttendee.image }} 
                        style={styles.avatarImage} 
                      />
                    ) : (
                      <View style={[styles.avatarImage, { backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' }]}>
                        <UserIcon size={24} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.modalContactInfo}>
                    <Text style={styles.modalContactName}>
                      {isDelegate
                        ? selectedAttendee.name
                        : (selectedAttendee.full_name || selectedAttendee.name)}
                    </Text>
                    <Text style={styles.modalContactCompany}>{selectedAttendee.company}</Text>
                  </View>
                </View>

                <Text style={styles.priorityLabel}>Select Priority</Text>
                <View style={styles.priorityRow}>
                  {['1st', '2nd'].map((level) => {
                    const isActive = selectedPriority === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[styles.priorityChip, isActive && styles.priorityChipActive]}
                        onPress={() => setSelectedPriority(level)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.priorityChipText, isActive && styles.priorityChipTextActive]}>{level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.separator3}/>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton]}
                    onPress={handleSendMeetingRequest}
                  >
                    <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Send Request</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
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
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 12,
  },
  searchBarWrapper: {
    flex: 1,
    height: SIZES.filterHeight,
  },
  searchBarInline: {
    height: SIZES.filterHeight,
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
  filterIconBtnActive: {
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.white,
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
  requestButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  requestButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: SIZES.body,
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
  checkboxUnchecked: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalButtonRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  modalCloseBtn: {
    flex: 1,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(138, 52, 144, 0.12)',
    alignItems: 'center',
  },
  modalClearBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  modalCloseText: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalClearText: {
    color: '#EF4444',
  },
  modalLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
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
  // Meeting Request Modal styles
  modalBackdrop2: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard2: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle2: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeText: {
    fontSize: 20,
    color: colors.textMuted,
  },
  modalContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    marginBottom: 16,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  modalContactInfo: {
    flex: 1,
  },
  modalContactName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalContactCompany: {
    fontSize: 13,
    color: colors.textMuted,
  },
  priorityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  priorityChip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  priorityChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  priorityChipText: {
    color: colors.text,
    fontWeight: '600',
  },
  priorityChipTextActive: {
    color: colors.white,
  },
  separator3: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    opacity: 0.5,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontWeight: '600',
  },
  cancelButtonText: {
    color: colors.text,
  },
  primaryButtonText: {
    color: colors.white,
  },
});

export default AttendeesScreen;


