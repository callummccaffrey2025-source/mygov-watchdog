/**
 * Representation Index — national leaderboard of MP electorate-alignment.
 * Prompt 9: transparent scoring, sample guards, show-your-working drill-down.
 *
 * index_publish_ready = false — leaderboard renders in-app with coverage
 * labelling, but not externally-citable until coverage is credible.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useRepresentationIndex, RepIndexEntry } from '../hooks/useRepresentationIndex';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, PARTY_COLORS } from '../constants/design';

const GREEN = '#00843D';

function partyColor(party: string): string {
  if (party === 'ALP' || party === 'Labor') return PARTY_COLORS.ALP;
  if (party === 'LNP' || party === 'Liberal' || party === 'LP' || party === 'NP') return PARTY_COLORS.LNP;
  if (party === 'GRN' || party === 'Greens' || party === 'AG') return PARTY_COLORS.GRN;
  if (party === 'ONP') return PARTY_COLORS.ONP;
  if (party === 'IND') return PARTY_COLORS.IND;
  return PARTY_COLORS.OTH;
}

type SortKey = 'rank' | 'score_asc';

export function RepresentationIndexScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { index, loading, error, refresh, minSample, minIssues } = useRepresentationIndex();
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('rank');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (sortBy === 'score_asc') return [...index].sort((a, b) => a.alignment_score - b.alignment_score);
    return index; // already sorted by rank (desc score)
  }, [index, sortBy]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const renderItem = useCallback(({ item }: { item: RepIndexEntry }) => {
    const pc = partyColor(item.party);
    const isExpanded = expandedId === item.member_id;
    const scoreColor = item.alignment_score >= 70 ? GREEN : item.alignment_score >= 40 ? '#EAB308' : '#DC3545';

    return (
      <View style={[styles.row, { backgroundColor: colors.card }, SHADOWS.sm]}>
        <Pressable
          onPress={() => setExpandedId(isExpanded ? null : item.member_id)}
          style={styles.rowMain}
        >
          {/* Rank */}
          <View style={styles.rankCol}>
            <Text style={[styles.rankText, { color: colors.textMuted }]}>#{item.rank}</Text>
          </View>

          {/* Photo */}
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={[styles.photo, { borderColor: pc }]} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: pc + '22', borderColor: pc }]}>
              <Text style={[styles.initials, { color: pc }]}>
                {item.member_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </Text>
            </View>
          )}

          {/* Name + electorate */}
          <View style={styles.infoCol}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.member_name}</Text>
            <Text style={[styles.electorate, { color: colors.textMuted }]} numberOfLines={1}>
              {item.electorate} · {item.party}
            </Text>
          </View>

          {/* Score */}
          <View style={styles.scoreCol}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{item.alignment_score}%</Text>
            <Text style={[styles.scoreMeta, { color: colors.textMuted }]}>
              {item.issues_covered} issues
            </Text>
          </View>

          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </Pressable>

        {/* Expanded: show-your-working */}
        {isExpanded && (
          <View style={[styles.expanded, { borderTopColor: colors.border }]}>
            <Text style={[styles.expandedTitle, { color: colors.text }]}>Issue Breakdown</Text>
            <Text style={[styles.expandedMeta, { color: colors.textMuted }]}>
              Based on {item.sample_size}+ respondents in {item.electorate}
            </Text>

            {item.contributing_issues.map(issue => (
              <View key={issue.issue_slug} style={styles.issueRow}>
                <View style={styles.issueInfo}>
                  <Text style={[styles.issueName, { color: colors.text }]}>{issue.issue_name}</Text>
                  <Text style={[styles.issueDetail, { color: colors.textMuted }]}>
                    Electorate: {issue.electorate_stance > 0 ? 'Support' : 'Oppose'} · MP: {issue.mp_lean > 0 ? 'Support' : 'Oppose'}
                  </Text>
                </View>
                <View style={[
                  styles.alignBadge,
                  { backgroundColor: issue.aligned ? GREEN + '15' : '#DC3545' + '15' },
                ]}>
                  <Ionicons
                    name={issue.aligned ? 'checkmark' : 'close'}
                    size={14}
                    color={issue.aligned ? GREEN : '#DC3545'}
                  />
                </View>
              </View>
            ))}

            {/* Navigate to MP profile */}
            <Pressable
              onPress={() => nav.navigate('MemberProfile', { memberId: item.member_id })}
              style={({ pressed }) => [styles.viewProfileBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.viewProfileText}>View full profile</Text>
              <Ionicons name="arrow-forward" size={14} color={GREEN} />
            </Pressable>
          </View>
        )}
      </View>
    );
  }, [expandedId, colors, nav]);

  const keyExtractor = useCallback((item: RepIndexEntry) => item.member_id, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Representation Index</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>
            How often your MP votes with their electorate
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Coverage banner */}
      <View style={[styles.coverageBanner, { backgroundColor: GREEN + '10' }]}>
        <Ionicons name="information-circle-outline" size={16} color={GREEN} />
        <Text style={[styles.coverageText, { color: GREEN }]}>
          {index.length > 0
            ? `${index.length} of 151 MPs scored · min ${minSample} respondents · ${minIssues}+ issues each`
            : 'Not enough local data yet to score MPs — contribute by setting your stances'}
        </Text>
      </View>

      {/* Sort toggle */}
      {index.length > 0 && (
        <View style={styles.sortRow}>
          <Pressable
            onPress={() => setSortBy(sortBy === 'rank' ? 'score_asc' : 'rank')}
            style={[styles.sortButton, { backgroundColor: colors.card }]}
          >
            <Ionicons name="swap-vertical" size={14} color={colors.textMuted} />
            <Text style={[styles.sortLabel, { color: colors.textMuted }]}>
              {sortBy === 'rank' ? 'Most aligned first' : 'Least aligned first'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Loading */}
      {loading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: '#DC3545' }]}>{error}</Text>
          <Pressable onPress={refresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!loading && !error && index.length === 0 && (
        <View style={styles.center}>
          <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Building the index</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            We need at least {minSample} people in each electorate to set their stances on {minIssues}+ issues before we can score MPs. Set your stances to help build the picture.
          </Text>
        </View>
      )}

      {/* Leaderboard */}
      {!loading && index.length > 0 && (
        <FlatList
          data={sorted}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + SPACING.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
          windowSize={5}
          maxToRenderPerBatch={10}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold },
  headerSub: { fontSize: FONT_SIZE.small, marginTop: 2 },
  coverageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  coverageText: { flex: 1, fontSize: FONT_SIZE.small, lineHeight: 18 },
  sortRow: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  sortLabel: { fontSize: FONT_SIZE.small },
  row: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  rankCol: { width: 32, alignItems: 'center' },
  rankText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  photo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  photoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold },
  infoCol: { flex: 1 },
  name: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  electorate: { fontSize: FONT_SIZE.small, marginTop: 2 },
  scoreCol: { alignItems: 'flex-end' },
  scoreValue: { fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  scoreMeta: { fontSize: FONT_SIZE.caption, marginTop: 1 },
  expanded: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderTopWidth: 0.5,
    gap: SPACING.sm,
  },
  expandedTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, marginTop: SPACING.md },
  expandedMeta: { fontSize: FONT_SIZE.small, marginBottom: SPACING.xs },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  issueInfo: { flex: 1, marginRight: SPACING.sm },
  issueName: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium },
  issueDetail: { fontSize: FONT_SIZE.caption, marginTop: 1 },
  alignBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  viewProfileText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: '#00843D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl },
  errorText: { fontSize: FONT_SIZE.body, textAlign: 'center' },
  retryBtn: { marginTop: SPACING.md, padding: SPACING.md },
  retryText: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: '#00843D' },
  emptyTitle: { fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, marginTop: SPACING.lg },
  emptyBody: { fontSize: FONT_SIZE.body, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22 },
});
