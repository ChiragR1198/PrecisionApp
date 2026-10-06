import Icon from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/common/Header';
import { MatchScoreRing } from '../../components/matches/MatchScoreRing';
import { colors, radius } from '../../constants/theme';
import { useGetMatchesQuery } from '../../store/api';
import { useAppSelector } from '../../store/hooks';
import { withDerivedMatchScore } from '../../utils/deriveMatchScore';
import { normalizeEventIdForApi } from '../../utils/parseEventId';
import { stripHtml } from '../../utils/stripHtml';

const SORT_OPTIONS = [
  { key: 'match', label: 'Match %' },
  { key: 'name_asc', label: 'Name A–Z' },
  { key: 'name_desc', label: 'Name Z–A' },
  { key: 'company', label: 'Company A–Z' },
];

function sanitizeInterestLabel(value) {
  const s = stripHtml(value == null ? '' : String(value)).trim();
  if (!s) return '';
  if (/[<>]/.test(s) || /<!doctype|<html|<body/i.test(s)) return '';
  return s;
}

function extractMatchesList(response) {
  if (response == null) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

function extractFocusAreas(response) {
  if (response == null) return [];
  if (Array.isArray(response.focus_areas)) return response.focus_areas;
  if (Array.isArray(response?.data?.focus_areas)) return response.data.focus_areas;
  return [];
}

const MatchCard = React.memo(function MatchCard({ item, onPress, cardWidth }) {
  const related = (Array.isArray(item.related_interests) ? item.related_interests : [])
    .map(sanitizeInterestLabel)
    .filter(Boolean);
  if (related.length === 0) {
    return null;
  }
  const relatedText = related.join(', ');

  return (
    <Pressable
      style={[styles.matchCard, { width: cardWidth }]}
      onPress={() => onPress(item)}
      android_ripple={{ color: 'rgba(138, 52, 144, 0.08)' }}
    >
      <View style={styles.matchCardInner}>
        <MatchScoreRing score={item.match_score} size={58} stroke={4} />
        <View style={styles.matchCardBody}>
          <Text style={styles.matchName} numberOfLines={1}>
            {item.name || '—'}
          </Text>
          <Text style={styles.matchRole} numberOfLines={1}>
            {item.job_title || '—'}
          </Text>
          {!!item.company && (
            <Text style={styles.matchCompany} numberOfLines={1}>
              {item.company}
            </Text>
          )}
          <View style={styles.relatedRow}>
            <MaterialCommunityIcons name="star-four-points" size={13} color={colors.primary} />
            <Text style={styles.relatedText} numberOfLines={2}>
              Related interests: {relatedText}
            </Text>
          </View>
          {item.is_online ? (
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Available now — reach out while they&apos;re online</Text>
            </View>
          ) : null}
        </View>
        <Icon name="chevron-right" size={20} color={colors.gray300} />
      </View>
    </Pressable>
  );
});

export const MatchesScreen = () => {
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAppSelector((state) => state.auth);
  const { selectedEventId } = useAppSelector((state) => state.event);
  const isSponsorUser = String(user?.user_type || user?.login_type || '').toLowerCase() === 'sponsor';
  const [activeTab, setActiveTab] = useState(isSponsorUser ? 'delegate' : 'exhibitor');
  const [scoreFilter, setScoreFilter] = useState('all'); // all | excellent | strong | potential
  const [topicFilter, setTopicFilter] = useState('all');
  const [sortKey, setSortKey] = useState('match'); // match | name_asc | name_desc | company
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const eventId = normalizeEventIdForApi(selectedEventId ?? user?.event_id ?? user?.events?.[0]?.id);
  const matchType = activeTab === 'exhibitor' ? 'exhibitor' : 'delegate';

  const {
    data: matchesPayload,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetMatchesQuery(
    eventId != null ? { event_id: eventId, type: matchType } : undefined,
    { skip: eventId == null, refetchOnMountOrArgChange: true }
  );

  const matches = useMemo(() => {
    const list = extractMatchesList(matchesPayload);
    const focus = extractFocusAreas(matchesPayload);
    return list.map((m) => withDerivedMatchScore(m, focus));
  }, [matchesPayload]);
  const focusAreas = useMemo(() => extractFocusAreas(matchesPayload), [matchesPayload]);
  const profileIncomplete = Boolean(
    matchesPayload?.profile_incomplete === true || matchesPayload?.viewer_eligible === false
  );
  const displayFocusAreas = focusAreas.length > 0
    ? focusAreas
    : [profileIncomplete ? 'Profile incomplete — ask admin to fill match fields' : 'Complete your profile to unlock focus areas'];

  const topicOptions = useMemo(() => {
    const set = new Set();
    matches.forEach((m) => {
      (Array.isArray(m.related_interests) ? m.related_interests : []).forEach((t) => {
        const s = sanitizeInterestLabel(t);
        if (s) set.add(s);
      });
    });
    return ['all', ...Array.from(set).slice(0, 12)];
  }, [matches]);

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((o) => o.key === sortKey)?.label || 'Match %',
    [sortKey]
  );

  const filteredMatches = useMemo(() => {
    const filtered = matches.filter((m) => {
      const score = Number(m.match_score) || 0;
      const band = String(m.match_band || '').toLowerCase();
      if (scoreFilter === 'excellent' && !(score >= 85 || band === 'excellent')) return false;
      if (scoreFilter === 'strong' && !(score >= 70 || band === 'strong' || band === 'excellent')) return false;
      if (scoreFilter === 'potential' && !(score >= 55 || ['potential', 'strong', 'excellent'].includes(band))) {
        return false;
      }
      if (topicFilter !== 'all') {
        const related = (Array.isArray(m.related_interests) ? m.related_interests : []).map(sanitizeInterestLabel);
        if (!related.includes(topicFilter)) return false;
      }
      return true;
    });

    const byName = (a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    const byCompany = (a, b) =>
      String(a.company || '').localeCompare(String(b.company || ''), undefined, { sensitivity: 'base' });
    const byScore = (a, b) => (Number(b.match_score) || 0) - (Number(a.match_score) || 0);

    const sorted = [...filtered];
    if (sortKey === 'name_asc') {
      sorted.sort(byName);
    } else if (sortKey === 'name_desc') {
      sorted.sort((a, b) => byName(b, a));
    } else if (sortKey === 'company') {
      sorted.sort((a, b) => {
        const c = byCompany(a, b);
        return c !== 0 ? c : byScore(a, b);
      });
    } else {
      sorted.sort((a, b) => {
        const s = byScore(a, b);
        return s !== 0 ? s : byName(a, b);
      });
    }
    return sorted;
  }, [matches, scoreFilter, topicFilter, sortKey]);

  const cardWidth = screenWidth - 32;

  const openMatchProfile = useCallback(
    (item) => {
      if (!item?.id) return;
      const profileType = item.profile_type === 'sponsor' ? 'sponsor' : 'delegate';
      const related = Array.isArray(item.related_interests) ? item.related_interests.join('|') : '';
      const payload = {
        id: item.id,
        name: item.name,
        job_title: item.job_title,
        role: item.job_title,
        company: item.company,
        image: item.image,
        bio: item.bio,
        company_logo: item.company_logo,
        company_website_url: item.company_website_url,
        location: item.location,
        profile_type: item.profile_type,
      };
      router.push({
        pathname: '/delegate-details',
        params: {
          delegate: JSON.stringify(payload),
          profileType,
          fromMatches: '1',
          matchScore: String(item.match_score ?? ''),
          matchLabel: item.match_label ?? '',
          relatedInterests: related,
          isOnline: item.is_online ? '1' : '0',
          matchSaved: item.saved ? '1' : '0',
          returnTo: 'matches',
        },
      });
    },
    []
  );

  const tabLabel = activeTab === 'exhibitor' ? 'exhibitors' : 'delegates';
  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    return error?.data?.message || error?.error || 'Unable to load matches';
  }, [error]);

  const scoreFilters = [
    { key: 'all', label: 'All' },
    { key: 'excellent', label: 'Excellent' },
    { key: 'strong', label: 'Strong+' },
    { key: 'potential', label: 'Potential+' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Header
        title="Matches"
        leftIcon="menu"
        onLeftPress={() => navigation.openDrawer?.()}
      />

      <FlatList
        data={filteredMatches}
        keyExtractor={(item) => `${item.profile_type || 'user'}-${item.id}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={['#9B4DA3', '#7A2E84']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <View style={styles.bannerIconWrap}>
                <MaterialCommunityIcons name="star-four-points" size={22} color={colors.white} />
              </View>
              <Text style={styles.bannerTitle}>AI Matchmaking</Text>
              <Text style={styles.bannerSubtitle}>Powered by interest affinity scoring</Text>
              <Text style={styles.focusHeading}>Your focus areas</Text>
              <View style={styles.chipRow}>
                {displayFocusAreas.map((chip) => (
                  <View key={chip} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {chip}
                    </Text>
                  </View>
                ))}
              </View>
            </LinearGradient>

            {profileIncomplete ? (
              <View style={styles.incompleteBanner}>
                <Icon name="alert-circle" size={18} color="#B45309" />
                <Text style={styles.incompleteText}>
                  Match profile incomplete. Ask admin to fill company type, goals, topics/solutions and enable match consent.
                </Text>
              </View>
            ) : null}

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'delegate' && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab('delegate');
                  setScoreFilter('all');
                  setTopicFilter('all');
                }}
                activeOpacity={0.85}
              >
                <Icon name="users" size={16} color={activeTab === 'delegate' ? colors.white : colors.textMuted} />
                <Text style={[styles.tabText, activeTab === 'delegate' && styles.tabTextActive]}>Delegates</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'exhibitor' && styles.tabBtnActive]}
                onPress={() => {
                  setActiveTab('exhibitor');
                  setScoreFilter('all');
                  setTopicFilter('all');
                }}
                activeOpacity={0.85}
              >
                <Icon name="briefcase" size={16} color={activeTab === 'exhibitor' ? colors.white : colors.textMuted} />
                <Text style={[styles.tabText, activeTab === 'exhibitor' && styles.tabTextActive]}>Exhibitors</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Score</Text>
            <View style={styles.filterRow}>
              {scoreFilters.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, scoreFilter === f.key && styles.filterChipActive]}
                  onPress={() => setScoreFilter(f.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterChipText, scoreFilter === f.key && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {topicOptions.length > 1 ? (
              <>
                <Text style={styles.filterLabel}>Topic</Text>
                <View style={styles.filterRow}>
                  {topicOptions.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.filterChip, topicFilter === t && styles.filterChipActive]}
                      onPress={() => setTopicFilter(t)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.filterChipText, topicFilter === t && styles.filterChipTextActive]} numberOfLines={1}>
                        {t === 'all' ? 'All topics' : t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.listMetaRow}>
              <Text style={styles.listMetaLeft}>
                {filteredMatches.length} recommended {tabLabel}
                {filteredMatches.length !== matches.length ? ` (of ${matches.length})` : ''}
              </Text>
              <TouchableOpacity
                style={styles.sortRow}
                onPress={() => setSortMenuOpen(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.sortText}>Sorted by {sortLabel}</Text>
                <Icon name="chevron-down" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : null}

            {errorMessage && !isLoading ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <MatchCard item={item} onPress={openMatchProfile} cardWidth={cardWidth} />
        )}
        ListEmptyComponent={
          !isLoading && !errorMessage ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="star-four-points-outline" size={40} color={colors.gray300} />
              <Text style={styles.emptyTitle}>
                {profileIncomplete ? 'Complete match profile' : matches.length > 0 ? 'No matches for these filters' : 'No matches yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {profileIncomplete
                  ? 'Admin must fill AI Matchmaking fields (consent, company type, topics/solutions) for your account.'
                  : matches.length > 0
                    ? 'Try clearing score or topic filters.'
                    : isSponsorUser && activeTab === 'exhibitor'
                      ? 'Other exhibitors with match profiles will appear here. Pull to refresh after admin saves.'
                      : 'Complete your profile priorities to improve recommendations.'}
              </Text>
              {(scoreFilter !== 'all' || topicFilter !== 'all') && matches.length > 0 ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => {
                    setScoreFilter('all');
                    setTopicFilter('all');
                  }}
                >
                  <Text style={styles.retryText}>Clear filters</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null
        }
      />

      <Modal
        visible={sortMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortMenuOpen(false)}
      >
        <Pressable style={styles.sortModalOverlay} onPress={() => setSortMenuOpen(false)}>
          <Pressable style={styles.sortModalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sortModalTitle}>Sort by</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortOptionRow, active && styles.sortOptionRowActive]}
                  onPress={() => {
                    setSortKey(opt.key);
                    setSortMenuOpen(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {active ? <Icon name="check" size={18} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  banner: {
    borderRadius: radius.lg,
    padding: 18,
    marginTop: 8,
    marginBottom: 16,
  },
  bannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bannerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginBottom: 14,
  },
  focusHeading: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  incompleteBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
  },
  incompleteText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 17,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  filterChipActive: {
    backgroundColor: 'rgba(138, 52, 144, 0.12)',
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.white,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listMetaLeft: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    paddingRight: 8,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  sortText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sortModalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sortModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sortOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  sortOptionRowActive: {
    backgroundColor: '#F3E8F5',
  },
  sortOptionText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  matchCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  matchCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  matchCardBody: {
    flex: 1,
    minWidth: 0,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  matchRole: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 2,
  },
  matchCompany: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 6,
  },
  relatedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 4,
  },
  relatedText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  onlineText: {
    flex: 1,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  errorWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  errorText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  retryText: {
    color: colors.white,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
