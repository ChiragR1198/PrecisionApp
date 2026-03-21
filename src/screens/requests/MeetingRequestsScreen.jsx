import Icon from '@expo/vector-icons/Feather';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserAvatar from '../../assets/images/user.png';
import { Header } from '../../components/common/Header';
import { SearchBar } from '../../components/common/SearchBar';
import { colors, radius } from '../../constants/theme';
import {
  useDelegateMeetingRequestActionMutation,
  useGetDelegateMeetingRequestsQuery,
  useGetSponsorMeetingRequestsQuery,
  useSponsorMeetingRequestActionMutation
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

/** Normalize API shapes: { data: [] }, { data: { data: [] } }, { data: { records: [] } }, etc. */
function extractMeetingRequestsList(response) {
  if (response == null) return [];
  if (Array.isArray(response)) return response;

  const candidates = [
    response.data,
    response?.data?.data,
    response?.data?.records,
    response?.data?.items,
    response?.data?.meetings,
    response?.data?.list,
    response?.records,
    response?.items,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  return [];
}

// const FILTERS = ['All', 'Sponsors', 'Delegates']; // Filters disabled as per request

// Static dummy contacts list (now unused; kept for reference only)
// const CONTACTS = [
//   {
//     id: '1',
//     name: 'Sarah Johnson',
//     company: 'Tech Solutions Inc.',
//     type: 'Sponsor',
//     avatar: UserAvatar,
//   },
//   ...
// ];

export const MeetingRequestsScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const { user } = useAppSelector((state) => state.auth);
  const { selectedEventId } = useAppSelector((state) => state.event);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';

  const rawEventId = user?.event_id ?? user?.events?.[0]?.id ?? selectedEventId ?? 27;
  const eventId = (typeof rawEventId === 'number' && Number.isFinite(rawEventId) && rawEventId > 0)
    ? rawEventId
    : (Number(rawEventId) || 27);

  // Use appropriate hook based on user type
  const {
    data: delegateRequestsData,
    isLoading: isLoadingDelegate,
    isFetching: isFetchingDelegate,
    error: delegateError,
    refetch: refetchDelegate,
  } = useGetDelegateMeetingRequestsQuery({ event_id: eventId }, { skip: !isDelegate });
  const {
    data: sponsorRequestsData,
    isLoading: isLoadingSponsor,
    isFetching: isFetchingSponsor,
    error: sponsorError,
    refetch: refetchSponsor,
  } = useGetSponsorMeetingRequestsQuery({ event_id: eventId }, { skip: isDelegate });
  
  const requestsData = isDelegate ? delegateRequestsData : sponsorRequestsData;
  const isLoading = isDelegate ? isLoadingDelegate : isLoadingSponsor;
  const error = isDelegate ? delegateError : sponsorError;
  const refetch = isDelegate ? refetchDelegate : refetchSponsor;
  const isFetching = isDelegate ? isFetchingDelegate : isFetchingSponsor;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // App background se wapas aane par list refresh (taake nayi requests dikhen)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        refetch();
      }
    });
    return () => sub.remove();
  }, [refetch]);
  
  // Use appropriate mutation based on user type
  const [updateDelegateMeetingRequest] = useDelegateMeetingRequestActionMutation();
  const [updateSponsorMeetingRequest] = useSponsorMeetingRequestActionMutation();
  const updateMeetingRequest = isDelegate ? updateDelegateMeetingRequest : updateSponsorMeetingRequest;
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error?.data?.message) return error.data.message;
    if (error?.message) return error.message;
    if (error?.status) return `Error ${error.status}`;
    return 'Failed to load meeting requests.';
  }, [error]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState('Medium');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;
  
  // Track action updates locally for immediate UI feedback
  const [actionUpdates, setActionUpdates] = useState({});
  
  // States for action success modal (similar to AttendeesScreen)
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isActionSuccess, setIsActionSuccess] = useState(false);
  const [actionResult, setActionResult] = useState({ actionText: '', contactName: '' });
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const actionModalAnim = useRef(new Animated.Value(0)).current;
  
  const requests = useMemo(() => {
    const list = extractMeetingRequestsList(requestsData);

    if (__DEV__ && requestsData && list.length === 0) {
      const hasPayload =
        requestsData &&
        typeof requestsData === 'object' &&
        Object.keys(requestsData).length > 0;
      if (hasPayload) {
        console.warn(
          '[MeetingRequests] API returned data but no list array was found. Keys:',
          Object.keys(requestsData)
        );
      }
    }

    // Transform to expected format based on user type
    return list.map((item) => {
      const itemId = String(item.id ?? item.meeting_request_id ?? '');
      // Get locally updated action if exists, otherwise use API data
      const localAction = actionUpdates[itemId];
      const apiAction = item.is_accepted !== null && item.is_accepted !== undefined ? Number(item.is_accepted) : null;
      const currentAction = localAction !== undefined ? localAction : apiAction;
      
      // For delegate: shows sponsor info (who sent request to delegate)
      // For sponsor: shows delegate info (who sent request to sponsor)
      if (isDelegate) {
        // Delegate inbox: sponsor-related rows (server shape may vary)
        return {
          id: itemId || `row-${item.sponsor_id ?? ''}-${item.delegate_id ?? ''}`,
          name: item.sponsor_name || item.name || 'Unknown Sponsor',
          company: item.sponsor_company || item.company || '',
          type:
            item.from === 'sponsor'
              ? 'Sponsor'
              : item.from === 'delegate'
                ? 'Delegate'
                : 'Sponsor',
          avatar: item.sponsor_image ? { uri: item.sponsor_image } : UserAvatar,
          currentAction: currentAction,
          raw: item,
        };
      } else {
        // Sponsor viewing requests - show delegate info
        // API response has: delegate_full_name or delegate_fname + delegate_lname, delegate_company, delegate_image
        const delegateName = item.delegate_full_name || 
          (item.delegate_fname && item.delegate_lname ? `${item.delegate_fname} ${item.delegate_lname}`.trim() : null) ||
          item.delegate_name || 
          item.name || 
          'Unknown Delegate';
        return {
          id: itemId || `row-${item.delegate_id ?? ''}`,
          name: delegateName,
          company: item.delegate_company || item.company || '',
          type: item.from === 'delegate' ? 'Delegate' : 'Sponsor',
          avatar:
            item.delegate_image || item.delegate_avatar || item.image
              ? { uri: item.delegate_image || item.delegate_avatar || item.image }
              : UserAvatar,
          currentAction: currentAction,
          raw: item,
        };
      }
    });
  }, [requestsData, isDelegate, actionUpdates]);

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
        cardSpacing: getResponsiveValue({ android: 12, ios: 14, tablet: 16, default: 12 }),
        avatarSize: getResponsiveValue({ android: 55, ios: 54, tablet: 60, default: 52 }),
        body: getResponsiveValue({ android: 13, ios: 14, tablet: 15, default: 13 }),
        title: getResponsiveValue({ android: 17, ios: 18, tablet: 19, default: 17 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);


  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((contact) => {
      const name = contact.name?.toLowerCase() || '';
      const company = contact.company?.toLowerCase() || '';
      const matchesSearch = !q || name.includes(q) || company.includes(q);
      return matchesSearch;
    });
  }, [searchQuery, requests]);

  const handleAction = async (item, action) => {
    try {
      const meetingRequestId = Number(item?.raw?.id || item.id);
      if (!meetingRequestId || isNaN(meetingRequestId)) {
        Alert.alert('Error', 'Invalid meeting request ID');
        return;
      }
      
      const itemId = String(item.id || meetingRequestId);
      
      // API expects: 1 for approve, 2 for reject
      const actionValue = action === 1 ? 1 : 2;
      const actionText = action === 1 ? 'accepted' : 'declined';
      const contactName = item.name || 'Contact';
      
      // Show loading modal
      setIsActionLoading(true);
      setIsActionSuccess(false);
      setActionResult({ actionText, contactName });
      setIsActionModalVisible(true);
      
      // Optimistically update UI immediately
      setActionUpdates((prev) => ({
        ...prev,
        [itemId]: actionValue,
      }));
      
      await updateMeetingRequest({
        meeting_request_id: meetingRequestId,
        action: actionValue,
      }).unwrap();
      
      // Show success state - ensure actionResult is preserved
      setIsActionLoading(false);
      setIsActionSuccess(true);
      // Re-set actionResult to ensure it's available
      setActionResult({ actionText, contactName });
      refetch();
    } catch (e) {
      console.error('Error updating meeting request action:', e);
      console.error('Error details:', e?.data || e?.message || e);
      
      // Revert optimistic update on error
      const itemId = String(item.id || item?.raw?.id);
      setActionUpdates((prev) => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
      
      // Close modal and show error alert
      setIsActionLoading(false);
      setIsActionSuccess(false);
      setIsActionModalVisible(false);
      Alert.alert('Error', e?.data?.message || e?.message || 'Failed to update meeting request');
    }
  };
  
  const closeActionModal = () => {
    setIsActionModalVisible(false);
    setIsActionLoading(false);
    setIsActionSuccess(false);
  };

  const openModal = (contact) => {
    setSelectedPriority('Medium');
    setSelectedContact(contact);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
  };

  useEffect(() => {
    if (isModalVisible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else if (selectedContact) {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setSelectedContact(null);
        }
      });
    }
  }, [isModalVisible, modalAnim, selectedContact]);
  
  // Animation for action success modal
  useEffect(() => {
    if (isActionModalVisible) {
      Animated.spring(actionModalAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else {
      Animated.timing(actionModalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isActionModalVisible, actionModalAnim]);

  const renderContact = ({ item }) => (
    <View style={styles.contactRow}>
      <View style={[styles.avatarWrapper, { width: SIZES.avatarSize, height: SIZES.avatarSize, borderRadius: SIZES.avatarSize / 2 }]}>
        <Image source={item.avatar} style={styles.avatarImage} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        {item.company ? <Text style={styles.contactCompany}>{item.company}</Text> : null}
        <View style={[styles.typeBadge, item.type === 'Sponsor' ? styles.sponsorBadge : styles.delegateBadge]}>
          <Text style={[styles.typeBadgeText, item.type === 'Sponsor' ? styles.sponsorBadgeText : styles.delegateBadgeText]}>
            {item.type}
          </Text>
        </View>
      </View>
      {/*
      <TouchableOpacity
        style={styles.requestButton}
        activeOpacity={0.85}
        onPress={() => openModal(item)}
      >
        <Text style={styles.requestButtonText}>Request</Text>
      </TouchableOpacity>
      */}

      {/* New Accept / Decline buttons */}
      {/** Default: dono outline. Press hone par jis pe action hua ho,
       *  us button ka background fill ho jayega.
       */}
      {(() => {
        const isAccepted = item.currentAction === 1;
        const isDeclined = item.currentAction === 2;

        const acceptLabel = isAccepted ? 'Accepted' : 'Accept';
        const declineLabel = isDeclined ? 'Declined' : 'Decline';

        return (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isDeclined && styles.declineButtonActive,
              ]}
              activeOpacity={0.85}
              onPress={() => handleAction(item, 2)}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  isDeclined && styles.declineButtonTextActive,
                ]}
              >
                {declineLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isAccepted && styles.acceptButtonActive,
              ]}
              activeOpacity={0.85}
              onPress={() => handleAction(item, 1)}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  isAccepted && styles.acceptButtonTextActive,
                ]}
              >
                {acceptLabel}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      <Header
        title="Meeting Requests"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
        right={
          <TouchableOpacity
            onPress={() => refetch()}
            disabled={isFetching}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Refresh meeting requests"
            activeOpacity={0.7}
          >
            <Icon
              name="refresh-cw"
              size={Math.max(20, (SIZES.headerIconSize || 22) - 2)}
              color={colors.white}
              style={{ opacity: isFetching ? 0.5 : 1 }}
            />
          </TouchableOpacity>
        }
      />

      <View style={styles.contentWrap}>
        <View style={styles.content}>
          <SearchBar
            placeholder="Search contacts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
          />
        </View>
        {isLoading ? (
          <View style={[styles.listContent, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={styles.loadingText}>Loading meeting requests...</Text>
          </View>
        ) : error ? (
          <View style={[styles.listContent, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item, index) => String(item.id || `mr-${index}`)}
            renderItem={renderContact}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={() => refetch()}
                colors={[colors.primary]}
                tintColor={colors.primary}
                progressViewOffset={Platform.OS === 'android' ? 8 : undefined}
              />
            }
            contentContainerStyle={[
              styles.listContent,
              filteredContacts.length === 0 && { flex: 1, alignItems: 'center', justifyContent: 'center' },
            ]}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No meeting requests found.</Text>
                <Text style={styles.emptyHint}>
                  {isDelegate
                    ? 'Jo request aapne sponsor ko bheji hai, woh sponsor ke login par “Meeting Requests” mein dikhegi. Yahan woh entries aayengi jo server is delegate inbox endpoint par bhejta hai.'
                    : 'Jo delegates ne aapko meeting request bheji hai, woh yahan dikhengi. Neeche kheench kar refresh bhi kar sakte ho.'}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={isModalVisible || !!selectedContact}
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalOverlay, { opacity: modalAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          </Animated.View>
          <Animated.View
            style={[
              styles.modalCard,
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Meeting Request</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedContact && (
              <>
                <View style={styles.modalContactRow}>
                  <View style={styles.modalAvatar}>
                    <Image source={selectedContact.avatar} style={styles.avatarImage} />
                  </View>
                  <View style={styles.modalContactInfo}>
                    <Text style={styles.modalContactName}>{selectedContact.name}</Text>
                    <Text style={styles.modalContactCompany}>{selectedContact.company}</Text>
                  </View>
                  <View style={[styles.modalTypeBadge, selectedContact.type === 'Sponsor' ? styles.sponsorBadge : styles.delegateBadge]}>
                    <Text style={[styles.modalTypeBadgeText, selectedContact.type === 'Sponsor' ? styles.sponsorBadgeText : styles.delegateBadgeText]}>
                      {selectedContact.type}
                    </Text>
                  </View>
                </View>

                <Text style={styles.priorityLabel}>Select Priority</Text>
                <View style={styles.priorityRow}>
                  {['Low', 'Medium', 'High'].map((level) => {
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
                <View style={styles.separator2}/>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                    <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton]}
                    onPress={async () => {
                      if (!selectedContact) return;
                      try {
                        // Note: This modal functionality seems unused based on the commented code above
                        // Keeping it for potential future use but it may need different implementation
                        closeModal();
                      } catch (error) {
                        console.error('Error sending meeting request:', error);
                      } finally {
                        closeModal();
                      }
                    }}
                  >
                    <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Send Request</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Action Success Modal - Similar to AttendeesScreen */}
      <Modal
        transparent
        animationType="fade"
        visible={isActionModalVisible || isActionLoading || isActionSuccess}
        onRequestClose={closeActionModal}
      >
        <SafeAreaView style={styles.modalBackdrop2} edges={['bottom']}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={closeActionModal}
          />
          <Animated.View
            style={[
              styles.modalCard2,
              {
                transform: [
                  {
                    translateY: actionModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [300, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalHeader2}>
              <Text style={styles.modalTitle2}>
                {isActionSuccess ? 'Meeting Request' : 'Processing'}
              </Text>
              <TouchableOpacity onPress={closeActionModal}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            {isActionSuccess ? (
              // Success State
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <Icon name="check-circle" size={64} color={colors.primary} />
                </View>
                <Text style={styles.successTitle}>Success</Text>
                <View style={{ marginVertical: 8, paddingHorizontal: 16 }}>
                  <Text style={styles.successMessage} numberOfLines={0}>
                    Meeting request {actionResult?.actionText || 'processed'} successfully
                  </Text>
                </View>
                <View style={styles.successButtonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.primaryButton, styles.successButton]}
                    onPress={closeActionModal}
                  >
                    <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : isActionLoading ? (
              // Loading State
              <View style={styles.loadingContainerModal}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingTextModal}>
                  {actionResult.actionText === 'accepted' ? 'Accepting request...' : 'Declining request...'}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (SIZES) => StyleSheet.create({
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
    paddingTop: 12,
  },
  searchBar: {
    marginTop: 12,
  },
  loadingText: {
    marginTop: 12,
    fontSize: SIZES.body,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: SIZES.body,
    color: '#DC2626',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  // Filter styles commented out as per request
  // filtersRow: {
  //   flexDirection: 'row',
  //   gap: 10,
  //   marginBottom: 12,
  // },
  // filterChip: {
  //   paddingHorizontal: 18,
  //   paddingVertical: 8,
  //   borderRadius: radius.pill,
  //   backgroundColor: colors.gray100,
  // },
  // filterChipActive: {
  //   backgroundColor: colors.primary,
  // },
  // filterChipText: {
  //   fontSize: SIZES.body,
  //   color: colors.text,
  //   fontWeight: '600',
  // },
  // filterChipTextActive: {
  //   color: colors.white,
  // },
  listContent: {
    paddingBottom: 30,
  },
  emptyWrap: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyHint: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    paddingHorizontal: SIZES.paddingHorizontal,
  },
  separator: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  separator2: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    opacity: 0.5,
  },
  avatarWrapper: {
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: SIZES.title,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  contactCompany: {
    fontSize: SIZES.body,
    color: colors.textMuted,
    marginBottom: 6,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sponsorBadge: {
    backgroundColor: 'rgba(82, 165, 255, 0.16)',
  },
  sponsorBadgeText: {
    color: '#2563EB',
  },
  delegateBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
  },
  delegateBadgeText: {
    color: '#059669',
  },
  typeBadgeText: {
    fontSize: SIZES.body - 1,
    fontWeight: '600',
  },
  // Old single button styles (kept for reference)
  // requestButton: {
  //   backgroundColor: colors.primary,
  //   borderRadius: radius.pill,
  //   paddingHorizontal: 18,
  //   paddingVertical: 10,
  // },
  // requestButtonText: {
  //   color: colors.white,
  //   fontWeight: '600',
  // },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 90, // Fixed width for both buttons
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.white,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: SIZES.body,
    fontWeight: '600',
    color: colors.text,
  },
  acceptButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  acceptButtonTextActive: {
    color: colors.white,
  },
  declineButtonActive: {
    backgroundColor: '#EF4444', // red
    borderColor: '#EF4444',
  },
  declineButtonTextActive: {
    color: colors.white,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
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
  modalTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  modalTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
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
  // Action Success Modal styles (similar to AttendeesScreen)
  modalBackdrop2: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalCard2: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
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
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#1F2937', // Explicit dark color to ensure visibility
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 0,
    lineHeight: 22,
    fontWeight: '500',
    minHeight: 22,
  },
  successButtonContainer: {
    width: '100%',
    marginTop: 8,
  },
  successButton: {
    flex: 0,
  },
  loadingContainerModal: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingTextModal: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
});

export default MeetingRequestsScreen;

