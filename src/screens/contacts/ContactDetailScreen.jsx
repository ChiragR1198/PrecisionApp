import Icon from '@expo/vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import { normalizeWebsiteUrl } from '../../utils/normalizeWebsiteUrl';

function paramStr(raw, key) {
  const v = raw?.[key];
  if (v == null) return '';
  return String(Array.isArray(v) ? v[0] : v);
}

function initialsFromName(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase().slice(0, 2);
  }
  return s.slice(0, 2).toUpperCase() || '?';
}

function FieldBlock({ icon, label, children }) {
  return (
    <View style={fieldStyles.row}>
      <View style={fieldStyles.iconWrap}>
        <Icon name={icon} size={20} color={colors.primary} />
      </View>
      <View style={fieldStyles.body}>
        <Text style={fieldStyles.label} allowFontScaling={false} maxFontSizeMultiplier={1.1}>
          {label}
        </Text>
        {children}
      </View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 36,
    paddingTop: 2,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
});

export const ContactDetailScreen = () => {
  const raw = useLocalSearchParams();

  const contact = useMemo(
    () => ({
      name: paramStr(raw, 'name'),
      email: paramStr(raw, 'email'),
      phone: paramStr(raw, 'phone'),
      company: paramStr(raw, 'company'),
      role: paramStr(raw, 'role'),
      linkedin_url: paramStr(raw, 'linkedin_url') || paramStr(raw, 'linkedinUrl'),
    }),
    [raw]
  );

  const displayName = contact.name?.trim() ? contact.name.trim() : 'Contact';
  const linkedIn = String(contact.linkedin_url || '').trim().replace(/\s/g, '');

  const openLinkedIn = async () => {
    const url = normalizeWebsiteUrl(linkedIn);
    if (!url) return;
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    } catch {
      Linking.openURL(url);
    }
  };

  const val = (s) => {
    const t = String(s || '').trim();
    if (!t) {
      return (
        <Text style={styles.valueMuted} allowFontScaling={false} maxFontSizeMultiplier={1.1}>
          —
        </Text>
      );
    }
    return (
      <Text style={styles.value} allowFontScaling={false} maxFontSizeMultiplier={1.15}>
        {t}
      </Text>
    );
  };

  /** Drawer + expo-router: `router.back()` often lands on dashboard instead of Contacts. */
  const goBackToContacts = useCallback(() => {
    try {
      router.replace('/(drawer)/contacts');
    } catch {
      try {
        router.push('/(drawer)/contacts');
      } catch {
        router.back();
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackToContacts();
        return true;
      });
      return () => sub.remove();
    }, [goBackToContacts])
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Contact details"
        leftIcon="back"
        onLeftPress={goBackToContacts}
        showNotificationBell={false}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText} allowFontScaling={false} maxFontSizeMultiplier={1}>
              {initialsFromName(displayName)}
            </Text>
          </View>
          <Text style={styles.heroName} allowFontScaling={false} maxFontSizeMultiplier={1.15}>
            {displayName}
          </Text>

          <View style={styles.divider} />

          <FieldBlock icon="briefcase" label="Role">
            {val(contact.role)}
          </FieldBlock>
          <View style={styles.rowDivider} />
          <FieldBlock icon="layers" label="Company">
            {val(contact.company)}
          </FieldBlock>
          <View style={styles.rowDivider} />
          <FieldBlock icon="mail" label="Email">
            {val(contact.email)}
          </FieldBlock>
          <View style={styles.rowDivider} />
          <FieldBlock icon="phone" label="Phone">
            {val(contact.phone)}
          </FieldBlock>
          <View style={styles.rowDivider} />

          <FieldBlock icon="link" label="LinkedIn">
            {linkedIn ? (
              <Pressable
                onPress={openLinkedIn}
                style={({ pressed }) => [styles.linkedInPress, pressed && styles.linkedInPressed]}
              >
                <Text style={styles.linkedInText}>{linkedIn.replace(/^https?:\/\//i, '')}</Text>
                <Icon name="external-link" size={16} color={colors.primary} style={styles.externalIcon} />
              </Pressable>
            ) : (
              <Text style={styles.valueMuted} allowFontScaling={false} maxFontSizeMultiplier={1.1}>
                Not available
              </Text>
            )}
          </FieldBlock>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarLarge: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarLargeText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 18,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray100,
    marginVertical: 12,
    marginLeft: 44,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 22,
  },
  valueMuted: {
    fontSize: 16,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  linkedInPress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  linkedInPressed: {
    opacity: 0.75,
  },
  linkedInText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
    textDecorationLine: 'underline',
    lineHeight: 22,
    minWidth: 0,
  },
  externalIcon: {
    marginTop: 3,
  },
});

export default ContactDetailScreen;
