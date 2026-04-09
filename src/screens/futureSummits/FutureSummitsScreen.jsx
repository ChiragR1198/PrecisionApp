import Icon from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { colors, radius } from '../../constants/theme';
import { useGetUpcomingEventsQuery } from '../../store/api';
import { stripHtml } from '../../utils/stripHtml';

export const FutureSummitsScreen = () => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const params = useLocalSearchParams();
  const rawId = params?.eventId ?? params?.event_id;
  const eventIdNum = useMemo(() => {
    if (rawId == null || rawId === '') return null;
    const n = Number(String(rawId).split(',')[0].trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [rawId]);

  const { data, isLoading, isFetching, error, refetch } = useGetUpcomingEventsQuery(eventIdNum, {
    skip: eventIdNum == null,
  });

  const items = Array.isArray(data?.data) ? data.data : [];
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const padding = SCREEN_WIDTH >= 768 ? 20 : 16;
  const styles = useMemo(() => createStyles(padding), [padding]);

  const descriptionPlain = useMemo(() => stripHtml(selected?.description ?? ''), [selected]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Future Summits"
        leftIcon="back"
        onLeftPress={() => router.back()}
        iconSize={22}
      />

      {eventIdNum == null ? (
        <View style={styles.centered}>
          <Icon name="calendar" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No event selected</Text>
          <Text style={styles.emptySub}>
            Open Future Summits from the dashboard after selecting an event.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load upcoming events.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {items.length === 0 ? (
            <View style={styles.centeredFlat}>
              <Text style={styles.emptySub}>No upcoming events in this category.</Text>
            </View>
          ) : (
            items.map((item) => (
              <Pressable
                key={String(item.id)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => setSelected(item)}
                android_ripple={{ color: 'rgba(138, 52, 144, 0.12)' }}
              >
                <LinearGradientCard />
                <View style={styles.cardInner}>
                  <Text style={styles.cardTitle} numberOfLines={3} selectable>
                    {item.display_name || item.sort_title || item.title || '—'}
                  </Text>
                  {item.date_display ? (
                    <View style={styles.dateRow}>
                      <View style={styles.dateIconWrap}>
                        <Icon name="calendar" size={17} color={colors.primary} />
                      </View>
                      <Text style={styles.cardDate} selectable>
                        {item.date_display}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
          {isFetching && !isLoading && !refreshing ? (
            <Text style={styles.refreshHint}>Updating…</Text>
          ) : null}
        </ScrollView>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={selected != null}
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <View style={styles.modalCard} pointerEvents="box-none">
            <Text style={styles.modalTitle} numberOfLines={4} selectable>
              {selected?.display_name || selected?.title || '—'}
            </Text>
            {(selected?.date_display_long || selected?.date_display) ? (
              <Text style={styles.modalDate} selectable>
                {selected.date_display_long || selected.date_display}
              </Text>
            ) : null}
            <Text style={styles.modalDescLabel}>Description</Text>
            <TextInput
              style={styles.modalDescInput}
              value={descriptionPlain || '—'}
              editable={false}
              multiline
              scrollEnabled
              textAlignVertical="top"
              selectTextOnFocus={false}
            />
            <Text style={styles.copyHint}>Long-press text above to select and copy</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelected(null)} activeOpacity={0.85}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

/** Thin top accent bar without adding expo-linear-gradient dependency to this screen. */
function LinearGradientCard() {
  return <View style={stylesStatic.accentBar} />;
}

const stylesStatic = StyleSheet.create({
  accentBar: {
    height: 5,
    width: '100%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});

function createStyles(padding) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: padding,
      paddingTop: 12,
      paddingBottom: 28,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    centeredFlat: {
      paddingVertical: 32,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 12,
      textAlign: 'center',
    },
    emptySub: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 20,
    },
    errorText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 16,
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
    },
    retryBtnText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 15,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: radius.lg,
      marginBottom: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#1a0a24',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        android: { elevation: 4 },
      }),
    },
    cardPressed: {
      opacity: Platform.OS === 'ios' ? 0.96 : 1,
    },
    cardInner: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 24,
      letterSpacing: -0.2,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 12,
    },
    dateIconWrap: {
      width: 28,
      paddingTop: 2,
      alignItems: 'center',
    },
    cardDate: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
      marginLeft: 4,
    },
    refreshHint: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 20,
      maxHeight: '82%',
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
      }),
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    modalDate: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
      lineHeight: 20,
    },
    modalDescLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 16,
      marginBottom: 8,
    },
    modalDescInput: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 24,
      minHeight: 140,
      maxHeight: 280,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
    },
    copyHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
    },
    modalClose: {
      marginTop: 16,
      alignSelf: 'center',
      paddingVertical: 12,
      paddingHorizontal: 28,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
    },
    modalCloseText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: 16,
    },
  });
}
