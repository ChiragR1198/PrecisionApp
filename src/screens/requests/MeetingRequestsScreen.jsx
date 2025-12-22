import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
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
import { useGetMeetingRequestsQuery, useUpdateMeetingRequestMutation } from '../../store/api';

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
  const { data: requestsData, isLoading, error, refetch } = useGetMeetingRequestsQuery();
  const [updateMeetingRequest] = useUpdateMeetingRequestMutation();
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
  
  const requests = useMemo(() => {
    let list = [];
    const response = requestsData;
    
    // Handle different response formats
    if (Array.isArray(response?.data)) {
      list = response.data;
    } else if (Array.isArray(response)) {
      list = response;
    } else if (Array.isArray(response?.data?.data)) {
      list = response.data.data;
    }
    
    // Transform to expected format
    return list.map((item) => ({
      id: String(item.id),
      name: item.sponsor_name || 'Unknown',
      company: item.sponsor_company || '',
      type: item.from === 'sponsor' ? 'Sponsor' : 'Delegate',
      avatar: UserAvatar,
      currentAction: item.is_accepted ? Number(item.is_accepted) : null,
      raw: item,
    }));
  }, [requestsData]);

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
      await updateMeetingRequest({
        id: meetingRequestId,
        status: action === 1 ? 'accepted' : 'rejected',
      }).unwrap();
      
      refetch();
    } catch (e) {
      console.error('Error updating meeting request action:', e);
    }
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

  const renderContact = ({ item }) => (
    <View style={styles.contactRow}>
      <View style={[styles.avatarWrapper, { width: SIZES.avatarSize, height: SIZES.avatarSize, borderRadius: SIZES.avatarSize / 2 }]}>
        <Image source={item.avatar} style={styles.avatarImage} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactCompany}>{item.company}</Text>
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
          onPress={() => {
              handleAction(item, 2);
          }}
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
          onPress={() => {
              handleAction(item, 1);
          }}
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
    <SafeAreaView style={styles.container} edges={['top']}>

      <Header
        title="Meeting Requests"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
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
            keyExtractor={(item) => item.id}
            renderItem={renderContact}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={[
              styles.listContent,
              filteredContacts.length === 0 && { flex: 1, alignItems: 'center', justifyContent: 'center' },
            ]}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No meeting requests found.</Text>
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
                        const payload = {
                          contact_id: selectedContact.id,
                          priority: selectedPriority.toLowerCase(),
                        };
                        console.log('Sending meeting request payload:', payload);
                        await updateMeetingRequest({
                          id: payload.contact_id,
                          status: payload.priority,
                        }).unwrap();
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.white,
    borderColor: colors.border,
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
});

export default MeetingRequestsScreen;

