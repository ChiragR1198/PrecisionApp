import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  SectionList,
  StatusBar,
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
import { contactStore } from '../../store/contactStore';

const DeleteIcon = ({ size = 18, color = '#EF4444' }) => <FontAwesome name="trash" size={size} color={color} />;

export const ContactsScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState(contactStore.getContacts());

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

  useEffect(() => {
    const unsubscribe = contactStore.subscribe((nextContacts) => {
      setContacts(nextContacts);
    });
    return unsubscribe;
  }, []);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (contact) => contact.name.toLowerCase().includes(query) || contact.phone.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  const sections = useMemo(() => {
    const grouped = filteredContacts.reduce((acc, contact) => {
      const letter = contact.name.charAt(0).toUpperCase();
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

  const handleDelete = (id) => {
    contactStore.removeContact(id);
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
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)} activeOpacity={0.7}>
        <DeleteIcon />
      </TouchableOpacity>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Header
        title="Contacts"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
        iconSize={SIZES.headerIconSize}
      />

      <View style={styles.body}>
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
          keyExtractor={(item) => item.id}
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
      </View>
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
  });

export default ContactsScreen;

