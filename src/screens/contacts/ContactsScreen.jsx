import Icon from '@expo/vector-icons/Feather';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SectionList,
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
import {
  useDeleteDelegateContactMutation,
  useDeleteSponsorContactMutation,
  useGetDelegateContactsQuery,
  useGetSponsorContactsQuery,
} from '../../store/api';
import { useAppSelector } from '../../store/hooks';

const DeleteIcon = ({ size = 18, color = '#EF4444' }) => <FontAwesome name="trash" size={size} color={color} />;

export const ContactsScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleteConfirmationModalVisible, setIsDeleteConfirmationModalVisible] = useState(false);
  const [isDeleteSuccessModalVisible, setIsDeleteSuccessModalVisible] = useState(false);
  const [isDeleteErrorModalVisible, setIsDeleteErrorModalVisible] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const isSponsor = loginType === 'sponsor';
  const currentUserId = String(user?.id || user?.user_id || user?.delegate_id || user?.sponsor_id || '');
  
  // Fetch contacts for both delegate and sponsor
  const shouldSkip = !isAuthenticated || !user || (!isDelegate && !isSponsor);
  
  const {
    data: delegateContactsData,
    isLoading: isLoadingDelegateContacts,
    error: delegateContactsError,
    refetch: refetchDelegateContacts,
  } = useGetDelegateContactsQuery(undefined, {
    skip: shouldSkip || !isDelegate,
    refetchOnMountOrArgChange: true,
  });

  const {
    data: sponsorContactsData,
    isLoading: isLoadingSponsorContacts,
    error: sponsorContactsError,
    refetch: refetchSponsorContacts,
  } = useGetSponsorContactsQuery(undefined, {
    skip: shouldSkip || !isSponsor,
    refetchOnMountOrArgChange: true,
  });

  const contactsData = isDelegate ? delegateContactsData : sponsorContactsData;
  const isLoading = isDelegate ? isLoadingDelegateContacts : isLoadingSponsorContacts;
  const error = isDelegate ? delegateContactsError : sponsorContactsError;
  const refetch = isDelegate ? refetchDelegateContacts : refetchSponsorContacts;

  const [deleteDelegateContact, { isLoading: isDeletingDelegate }] = useDeleteDelegateContactMutation();
  const [deleteSponsorContact, { isLoading: isDeletingSponsor }] = useDeleteSponsorContactMutation();
  const isDeleting = isDeletingDelegate || isDeletingSponsor;
  
  const [localContacts, setLocalContacts] = useState([]);

  React.useEffect(() => {
    const loadLocal = async () => {
      try {
        if (!loginType || !currentUserId) {
          setLocalContacts([]);
          return;
        }
        const cacheKey = `scanned_contacts_cache_${loginType}_${currentUserId}`;
        const stored = await AsyncStorage.getItem(cacheKey);
        const parsed = stored ? JSON.parse(stored) : [];
        setLocalContacts(Array.isArray(parsed) ? parsed : []);
      } catch {
        setLocalContacts([]);
      }
    };
    loadLocal();
  }, [loginType, currentUserId, isAuthenticated]);

  const contacts = useMemo(() => {
    const apiData = contactsData?.data || contactsData || [];
    const apiList = Array.isArray(apiData) ? apiData : [];
    const localList = Array.isArray(localContacts) ? localContacts : [];

    const byEmail = new Map();
    [...localList, ...apiList].forEach((c) => {
      const key = String(c?.email || '').toLowerCase().trim();
      if (!key) return;
      // Prefer API version over local when both exist
      if (!byEmail.has(key) || !c?._local) byEmail.set(key, c);
    });
    return Array.from(byEmail.values());
  }, [contactsData, localContacts]);

  const { SIZES, isTablet } = useMemo(() => {
    const isTabletDevice = SCREEN_WIDTH >= 768;
    const getValue = ({ tablet, default: defaultValue }) => (isTabletDevice && tablet !== undefined ? tablet : defaultValue);
    return {
      SIZES: {
        headerIconSize: getValue({ tablet: 26, default: 22 }),
        contentMaxWidth: getValue({ tablet: 640, default: '100%' }),
        paddingHorizontal: getValue({ tablet: 24, default: 16 }),
        cardSpacing: getValue({ tablet: 16, default: 12 }),
        avatar: getValue({ tablet: 48, default: 42 }),
      },
      isTablet: isTabletDevice,
    };
  }, [SCREEN_WIDTH]);

  const styles = useMemo(() => createStyles(SIZES, isTablet), [SIZES, isTablet]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter((contact) => {
      const name = String(contact?.name || '').toLowerCase();
      const phone = String(contact?.phone || '').toLowerCase();
      const email = String(contact?.email || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
  }, [contacts, searchQuery]);

  const sections = useMemo(() => {
    const grouped = filteredContacts.reduce((acc, contact) => {
      const letter = String(contact?.name || '?').charAt(0).toUpperCase();
      if (!acc.has(letter)) acc.set(letter, []);
      acc.get(letter).push(contact);
      return acc;
    }, new Map());

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({
        title,
        data: data.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name)),
      }));
  }, [filteredContacts]);

  const handleDelete = (contact) => {
    if (!contact || !contact.id) {
      console.error('Invalid contact for deletion');
      return;
    }

    // Show confirmation modal
    setSelectedContact(contact);
    setIsDeleteConfirmationModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedContact || !selectedContact.id) {
      return;
    }

    setIsDeleteConfirmationModalVisible(false);

    try {
      const contactId = selectedContact.id;
      const deletedEmail = String(selectedContact.email || '').toLowerCase().trim();

      if (isDelegate) {
        await deleteDelegateContact({ contact_id: contactId }).unwrap();
      } else {
        await deleteSponsorContact({ contact_id: contactId }).unwrap();
      }

      // Remove matching entry from scanned QR cache so the row disappears immediately (API + local merge)
      try {
        if (loginType && currentUserId) {
          const cacheKey = `scanned_contacts_cache_${loginType}_${currentUserId}`;
          const stored = await AsyncStorage.getItem(cacheKey);
          const existing = stored ? JSON.parse(stored) : [];
          if (Array.isArray(existing) && existing.length > 0) {
            const idStr = String(contactId);
            const next = existing.filter((c) => {
              const sameId = c?.id != null && String(c.id) === idStr;
              const sameEmail =
                deletedEmail &&
                String(c?.email || '')
                  .toLowerCase()
                  .trim() === deletedEmail;
              return !sameId && !sameEmail;
            });
            await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
            setLocalContacts(next);
          }
        }
      } catch (e) {
        console.warn('Contacts: failed to update local scan cache after delete', e?.message || e);
      }

      // Refetch contacts to update the list
      await refetch();

      // Show success modal
      setIsDeleteSuccessModalVisible(true);

      // Clear selected contact
      setSelectedContact(null);
    } catch (error) {
      console.error('Error deleting contact:', error);
      const errorMsg = error?.data?.message || error?.message || 'Failed to delete contact. Please try again.';
      setErrorMessage(errorMsg);
      setIsDeleteErrorModalVisible(true);
      setSelectedContact(null);
    }
  };

  const renderContact = ({ item }) => (
    <View style={styles.contactRow}>
      <View
        style={[
          styles.avatar,
          {
            width: SIZES.avatar,
            height: SIZES.avatar,
            borderRadius: SIZES.avatar / 2,
            backgroundColor: item.color || colors.primary,
          },
        ]}
      >
        <Text style={styles.avatarText}>{item.initials || '?'}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.name}</Text>
        <Text style={styles.contactPhone}>{item.phone}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]} 
        onPress={() => handleDelete(item)} 
        activeOpacity={0.7}
        disabled={isDeleting}
      >
        <DeleteIcon />
      </TouchableOpacity>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Contacts"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
      />

      <View style={styles.body}>
        {!isDelegate && !isSponsor ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Contacts Not Available</Text>
            {/* <Text style={styles.emptySubtitle}>Only delegate users can view and manage contacts.</Text> */}
          </View>
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Error Loading Contacts</Text>
            <Text style={styles.emptySubtitle}>
              {error?.data?.message || error?.message || 'Failed to load contacts. Please try again.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.searchWrap}>
              <SearchBar
                placeholder="Search contacts"
                value={searchQuery}
                onChangeText={setSearchQuery}
                containerStyle={styles.searchContainer}
              />
              <Text style={styles.countText}>{`${filteredContacts.length} contacts`}</Text>
            </View>

            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id?.toString() || `${item.name}-${item.phone}`}
              renderItem={renderContact}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                { paddingHorizontal: SIZES.paddingHorizontal },
                sections.length === 0 && { flex: 1 },
              ]}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No contacts yet</Text>
                  <Text style={styles.emptySubtitle}>Scan a QR code and add it to your contacts.</Text>
                </View>
              }
            />
          </>
        )}
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isDeleteConfirmationModalVisible}
        onRequestClose={() => setIsDeleteConfirmationModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsDeleteConfirmationModalVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.confirmationIconContainer}>
              <Icon name="alert-triangle" size={64} color="#FBBF24" />
            </View>
            <Text style={styles.modalTitle}>Delete Contact</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete {selectedContact?.name}?
            </Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => {
                  setIsDeleteConfirmationModalVisible(false);
                  setSelectedContact(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonDanger}
                onPress={handleConfirmDelete}
                activeOpacity={0.8}
                disabled={isDeleting}
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  style={styles.modalButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.modalButtonDangerText}>Delete</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Success Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isDeleteSuccessModalVisible}
        onRequestClose={() => setIsDeleteSuccessModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsDeleteSuccessModalVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.successIconContainer}>
              <Icon name="check-circle" size={64} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Contact Deleted</Text>
            <Text style={styles.modalMessage}>
              Contact has been deleted successfully!
            </Text>
            <TouchableOpacity
              style={styles.modalButtonPrimary}
              onPress={() => setIsDeleteSuccessModalVisible(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={colors.gradient}
                style={styles.modalButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.modalButtonPrimaryText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Error Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={isDeleteErrorModalVisible}
        onRequestClose={() => setIsDeleteErrorModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsDeleteErrorModalVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.errorIconContainer}>
              <Icon name="alert-circle" size={64} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalMessage}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={styles.modalButtonDanger}
              onPress={() => setIsDeleteErrorModalVisible(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.modalButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.modalButtonDangerText}>OK</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (SIZES, isTablet) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    body: {
      flex: 1,
      backgroundColor: '#F9FAFB',
    },
    searchWrap: {
      width: '100%',
      maxWidth: SIZES.contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: SIZES.paddingHorizontal,
      paddingTop: 16,
      paddingBottom: 8,
    },
    searchContainer: {
      marginBottom: 10,
    },
    countText: {
      fontSize: isTablet ? 16 : 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    listContent: {
      paddingBottom: 40,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: SIZES.cardSpacing,
      marginBottom: 6,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    avatar: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 16,
    },
    contactInfo: {
      flex: 1,
      marginLeft: 14,
    },
    contactName: {
      fontWeight: '600',
      fontSize: isTablet ? 16 : 15,
      color: colors.text,
    },
    contactPhone: {
      color: colors.textSecondary,
      marginTop: 2,
    },
    deleteButton: {
      padding: 6,
      borderRadius: radius.sm,
    },
    deleteButtonDisabled: {
      opacity: 0.5,
    },
    emptyState: {
      alignItems: 'center',
      marginTop: 60,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    emptySubtitle: {
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.white,
      borderRadius: 20,
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    confirmationIconContainer: {
      marginBottom: 16,
    },
    successIconContainer: {
      marginBottom: 16,
    },
    errorIconContainer: {
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    modalMessage: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
      paddingHorizontal: 8,
    },
    modalButtonRow: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-between',
    },
    modalButtonSecondary: {
      flex: 1,
      height: 48,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white,
      marginRight: 6,
    },
    modalButtonSecondaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    modalButtonPrimary: {
      width: '100%',
      height: 48,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    modalButtonDanger: {
      flex: 1,
      height: 48,
      borderRadius: radius.md,
      overflow: 'hidden',
      marginLeft: 6,
    },
    modalButtonGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonPrimaryText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.white,
    },
    modalButtonDangerText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.white,
    },
  });

export default ContactsScreen;