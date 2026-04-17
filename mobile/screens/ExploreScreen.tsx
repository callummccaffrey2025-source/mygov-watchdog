import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, Modal, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '../components/SearchBar';
import { CategoryChip } from '../components/CategoryChip';
import { BillCard } from '../components/BillCard';
import { MemberCard } from '../components/MemberCard';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useMembers, Member } from '../hooks/useMembers';
import { useBills } from '../hooks/useBills';
import { useParties, Party } from '../hooks/useParties';
import { useMemberVotes } from '../hooks/useMemberVotes';
import { useVotes } from '../hooks/useVotes';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../hooks/useSubscription';
import { useCouncils } from '../hooks/useCouncils';
import { useStateMembers, useStateBills } from '../hooks/useStateParliament';
import { useTheme } from '../context/ThemeContext';
import { EmptyState } from '../components/EmptyState';
import { track } from '../lib/analytics';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { useNewsStories, NewsStory } from '../hooks/useNewsStories';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/timeAgo';

const PartyCard = ({ party, onPress }: { party: Party; onPress: () => void }) => {
  const colour = party.colour || '#9aabb8';
  const label = party.short_name || party.abbreviation || party.name;
  const initials = label.length <= 3
    ? label.toUpperCase()
    : label.split(' ').map((w: string) => w[0] ?? '').filter(Boolean).join('').toUpperCase().slice(0, 3) || label[0].toUpperCase();
  return (
    <Pressable style={[styles.partyCard, { backgroundColor: colour + '18' }]} onPress={onPress}>
      <View style={[styles.partyBand, { backgroundColor: colour }]}>
        <Text style={styles.partyInitials}>{initials}</Text>
      </View>
      <Text style={[styles.partyName, { color: colour }]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
};

// ─── Verify Claims ────────────────────────────────────────────────────────────

function VerifyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [mpSearch, setMpSearch] = useState('');
  const [selectedMP, setSelectedMP] = useState<Member | null>(null);
  const [billSearch, setBillSearch] = useState('');
  const [aiVerdict, setAiVerdict] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { members } = useMembers(mpSearch.length > 1 ? { search: mpSearch, limit: 8 } : { limit: 0 });
  const { votes, loading: votesLoading } = useMemberVotes(selectedMP?.id || null);
  const { votes: divVotes, loading: divLoading } = useVotes(selectedMP?.id || null);

  const filteredVotes = billSearch.length > 1
    ? votes.filter(v => v.bill?.title.toLowerCase().includes(billSearch.toLowerCase()))
    : votes.slice(0, 20);

  const keyword = billSearch.toLowerCase();
  const divMatches = billSearch.length > 1
    ? divVotes.filter(v =>
        (v.division?.name || '').toLowerCase().includes(keyword)
      )
    : [];
  const ayeCount = divMatches.filter(v => v.vote_cast === 'aye').length;
  const noCount = divMatches.filter(v => v.vote_cast === 'no').length;
  const total = ayeCount + noCount;
  const top3Div = divMatches.slice(0, 3);
  const showVerdict = divMatches.length > 0;

  // ── AI verdict (debounced, falls back silently on Edge Function error) ──
  React.useEffect(() => {
    if (!selectedMP || divMatches.length === 0 || billSearch.length < 2) {
      setAiVerdict(null);
      setAiLoading(false);
      return;
    }
    let cancelled = false;
    setAiLoading(true);
    const timer = setTimeout(async () => {
      const mpName = `${selectedMP.first_name} ${selectedMP.last_name}`;
      const votesPayload = divMatches.slice(0, 5).map(v => ({
        name: v.division?.name ?? 'Unknown division',
        vote: v.vote_cast ?? '',
        date: v.division?.date ?? undefined,
      }));
      try {
        const { data, error } = await supabase.functions.invoke('verify-claim', {
          body: { mpName, claim: billSearch, votes: votesPayload },
        });
        if (cancelled) return;
        if (error || !data?.verdict) {
          setAiVerdict(null);
        } else {
          setAiVerdict(data.verdict);
        }
      } catch {
        if (!cancelled) setAiVerdict(null);
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedMP?.id, billSearch, divMatches.length]);

  const voteColour = (vote: string) =>
    vote === 'aye' ? '#00843D' : vote === 'no' ? '#DC3545' : '#9aabb8';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[verifyStyles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[verifyStyles.header, { borderBottomColor: colors.border }]}>
          <View style={verifyStyles.headerLeft}>
            <Ionicons name="shield-checkmark" size={20} color="#00843D" />
            <Text style={[verifyStyles.title, { color: colors.text }]}>Verify a Claim</Text>
          </View>
          <Pressable onPress={() => { onClose(); setSelectedMP(null); setMpSearch(''); setBillSearch(''); }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {!selectedMP ? (
          <View style={verifyStyles.content}>
            <Text style={[verifyStyles.label, { color: colors.textBody }]}>Search for an MP or Senator</Text>
            <TextInput
              style={[verifyStyles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={mpSearch}
              onChangeText={setMpSearch}
              placeholder='e.g. "Did Albanese vote for housing?"'
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {members.map(m => (
                <Pressable key={m.id} style={[verifyStyles.memberRow, { borderBottomColor: colors.border }]} onPress={() => setSelectedMP(m)}>
                  <View style={[verifyStyles.dot, { backgroundColor: m.party?.colour || '#9aabb8' }]} />
                  <View>
                    <Text style={[verifyStyles.memberName, { color: colors.text }]}>{m.first_name} {m.last_name}</Text>
                    <Text style={[verifyStyles.memberSub, { color: colors.textMuted }]}>{m.party?.short_name} · {m.electorate?.name}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={verifyStyles.content}>
            <Pressable style={verifyStyles.backRow} onPress={() => setSelectedMP(null)}>
              <Ionicons name="arrow-back" size={16} color="#00843D" />
              <Text style={verifyStyles.backText}>Change MP</Text>
            </Pressable>
            <Text style={[verifyStyles.mpName, { color: colors.text }]}>{selectedMP.first_name} {selectedMP.last_name}</Text>
            <TextInput
              style={[verifyStyles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={billSearch}
              onChangeText={setBillSearch}
              placeholder="Search by bill topic..."
              placeholderTextColor={colors.textMuted}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {votesLoading ? (
                <Text style={[verifyStyles.loading, { color: colors.textMuted }]}>Loading votes...</Text>
              ) : (
                <>
                  {/* AI verdict card — silently hides on Edge Function failure */}
                  {showVerdict && selectedMP && (aiLoading || aiVerdict) && (
                    <View style={verifyStyles.aiCard}>
                      <View style={verifyStyles.aiCardHeader}>
                        <View style={verifyStyles.aiCardHeaderLeft}>
                          <Ionicons name="sparkles" size={14} color="#00843D" />
                          <Text style={verifyStyles.aiCardLabel}>AI ANALYSIS</Text>
                        </View>
                        {aiLoading && (
                          <Text style={verifyStyles.aiCardThinking}>Thinking…</Text>
                        )}
                      </View>
                      {aiVerdict ? (
                        <Text style={[verifyStyles.aiCardVerdict, { color: colors.text }]}>
                          {aiVerdict}
                        </Text>
                      ) : null}
                      {aiVerdict ? (
                        <Text style={verifyStyles.aiCardFooter}>Powered by Claude Haiku 4.5</Text>
                      ) : null}
                    </View>
                  )}
                  {showVerdict && selectedMP ? (
                    <View style={[verifyStyles.verdictCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {/* MP name row */}
                      <View style={verifyStyles.verdictMpRow}>
                        <View style={verifyStyles.verdictInitials}>
                          <Text style={verifyStyles.verdictInitialsText}>
                            {selectedMP.first_name[0]}{selectedMP.last_name[0]}
                          </Text>
                        </View>
                        <View>
                          <Text style={[verifyStyles.verdictMpName, { color: colors.text }]}>
                            {selectedMP.first_name} {selectedMP.last_name}
                          </Text>
                          <Text style={[verifyStyles.verdictMpSub, { color: colors.textMuted }]}>
                            {selectedMP.party?.name ?? ''} · {selectedMP.electorate?.name ?? ''}
                          </Text>
                        </View>
                      </View>
                      {/* Summary */}
                      <Text style={[verifyStyles.verdictSummary, { color: colors.textBody }]}>
                        Based on {total} recorded votes on "{billSearch.trim()}":
                      </Text>
                      {/* Bar */}
                      {total > 0 && (
                        <View style={verifyStyles.verdictBarRow}>
                          <View style={verifyStyles.verdictBarTrack}>
                            <View style={[verifyStyles.verdictBarAye, { flex: ayeCount }]} />
                            <View style={[verifyStyles.verdictBarNo, { flex: noCount }]} />
                          </View>
                          <Text style={verifyStyles.verdictBarLabel}>
                            AYE {ayeCount} · NO {noCount}
                          </Text>
                        </View>
                      )}
                      {/* Top votes */}
                      {top3Div.length > 0 && (
                        <>
                          <Text style={[verifyStyles.verdictTopLabel, { color: colors.textMuted }]}>Top votes:</Text>
                          {top3Div.map((v, i) => (
                            <View key={i} style={verifyStyles.verdictVoteRow}>
                              <View style={[verifyStyles.verdictVotePill, { backgroundColor: v.vote_cast === 'aye' ? '#00843D18' : '#DC354518' }]}>
                                <Text style={[verifyStyles.verdictVotePillText, { color: v.vote_cast === 'aye' ? '#00843D' : '#DC3545' }]}>
                                  {(v.vote_cast ?? '').toUpperCase()}
                                </Text>
                              </View>
                              <Text style={[verifyStyles.verdictVoteTitle, { color: colors.textBody }]} numberOfLines={1}>
                                {v.division?.name ?? 'Unknown division'}
                              </Text>
                            </View>
                          ))}
                        </>
                      )}
                      {/* Disclaimer */}
                      <Text style={[verifyStyles.verdictDisclaimer, { color: colors.textMuted }]}>
                        ⚠ Based on division voting records only. May not capture the full picture.
                      </Text>
                    </View>
                  ) : null}
                  {filteredVotes.length === 0 && !showVerdict ? (
                    <Text style={[verifyStyles.empty, { color: colors.textMuted }]}>No votes found{billSearch ? ` for "${billSearch}"` : ''}.</Text>
                  ) : (
                    filteredVotes.map(v => (
                      <View key={v.id} style={[verifyStyles.voteRow, { borderBottomColor: colors.border }]}>
                        <View style={[verifyStyles.voteBadge, { backgroundColor: voteColour(v.vote) }]}>
                          <Text style={verifyStyles.voteLabel}>{v.vote.toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[verifyStyles.billTitle, { color: colors.text }]} numberOfLines={2}>
                            {v.bill?.title || 'Unknown bill'}
                          </Text>
                          <Text style={[verifyStyles.voteDate, { color: colors.textMuted }]}>
                            {timeAgo(v.created_at)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const verifyStyles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg + 4, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: { fontSize: FONT_SIZE.subtitle + 1, fontWeight: FONT_WEIGHT.bold },
  content: { flex: 1, padding: SPACING.lg },
  label: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, marginBottom: SPACING.sm + 2 },
  input: { borderRadius: BORDER_RADIUS.md + 2, paddingHorizontal: SPACING.md + 2, paddingVertical: SPACING.md, fontSize: FONT_SIZE.body, marginBottom: SPACING.md, borderWidth: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  memberName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  memberSub: { fontSize: FONT_SIZE.small - 1, marginTop: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2, marginBottom: SPACING.md },
  backText: { fontSize: FONT_SIZE.small + 1, color: '#00843D', fontWeight: FONT_WEIGHT.semibold },
  mpName: { fontSize: FONT_SIZE.subtitle + 1, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md },
  loading: { fontSize: FONT_SIZE.small + 1, textAlign: 'center', marginTop: SPACING.lg + 4 },
  empty: { fontSize: FONT_SIZE.small + 1, textAlign: 'center', marginTop: SPACING.lg + 4 },
  voteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, paddingVertical: SPACING.sm + 2, borderBottomWidth: 1 },
  voteBadge: { borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs, minWidth: 48, alignItems: 'center', marginTop: 2 },
  voteLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' },
  billTitle: { fontSize: FONT_SIZE.small + 1, lineHeight: 19 },
  voteDate: { fontSize: FONT_SIZE.caption, marginTop: 2 },
  verdictCard: {
    borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.md + 2, marginBottom: SPACING.md,
  },
  verdictMpRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm + 2, marginBottom: SPACING.sm + 2 },
  verdictInitials: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#00843D18', justifyContent: 'center', alignItems: 'center',
  },
  verdictInitialsText: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold, color: '#00843D' },
  verdictMpName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  verdictMpSub: { fontSize: FONT_SIZE.small - 1, marginTop: 1 },
  verdictSummary: { fontSize: FONT_SIZE.small + 1, marginBottom: SPACING.sm },
  verdictBarRow: { marginBottom: SPACING.sm + 2 },
  verdictBarTrack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: SPACING.xs },
  verdictBarAye: { backgroundColor: '#00843D' },
  verdictBarNo: { backgroundColor: '#DC3545' },
  verdictBarLabel: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold },
  verdictTopLabel: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.semibold, textTransform: 'uppercase', marginBottom: SPACING.xs + 2 },
  verdictVoteRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  verdictVotePill: { borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: SPACING.xs + 2, paddingVertical: 2 },
  verdictVotePillText: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  verdictVoteTitle: { flex: 1, fontSize: FONT_SIZE.small },
  verdictDisclaimer: { fontSize: FONT_SIZE.small - 1, marginTop: SPACING.sm, lineHeight: 16 },
  // AI verdict card — green accent kept intentionally
  aiCard: {
    backgroundColor: '#E8F5EE',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md + 2,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: '#00843D',
  },
  aiCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  aiCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  aiCardLabel: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#00843D', letterSpacing: 0.8 },
  aiCardThinking: { fontSize: FONT_SIZE.caption, fontStyle: 'italic' },
  aiCardVerdict: { fontSize: FONT_SIZE.small + 1, lineHeight: 21 },
  aiCardFooter: { fontSize: 10, marginTop: SPACING.sm },
});

// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'housing', label: 'Housing', icon: '🏠' },
  { key: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { key: 'economy', label: 'Economy', icon: '💰' },
  { key: 'climate', label: 'Climate', icon: '🌿' },
  { key: 'immigration', label: 'Immigration', icon: '✈️' },
  { key: 'defence', label: 'Defence', icon: '🛡️' },
  { key: 'education', label: 'Education', icon: '📚' },
  { key: 'cost_of_living', label: 'Cost of Living', icon: '🛒' },
  { key: 'indigenous',      label: 'Indigenous Affairs', icon: '🪃' },
  { key: 'technology',      label: 'Technology',          icon: '💻' },
  { key: 'agriculture',     label: 'Agriculture',         icon: '🌾' },
  { key: 'infrastructure',  label: 'Infrastructure',      icon: '🚧' },
  { key: 'foreign_policy',  label: 'Foreign Policy',      icon: '🌏' },
  { key: 'justice',         label: 'Justice',             icon: '⚖️' },
];

const TOPIC_BORDER_COLORS: Record<string, string> = {
  housing: '#712B13',
  healthcare: '#DC2626',
  economy: '#2563EB',
  climate: '#059669',
  immigration: '#72243E',
  defence: '#7C3AED',
  education: '#EA580C',
  cost_of_living: '#633806',
  indigenous: '#712B13',
  technology: '#0891B2',
  agriculture: '#27500A',
  infrastructure: '#444441',
  foreign_policy: '#0C447C',
  justice: '#444441',
};

const STATES = ['Federal', 'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export function ExploreScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeState, setActiveState] = useState('Federal');
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);
  const { user } = useUser();
  const { isPro } = useSubscription(user?.id);
  const { councils } = useCouncils();

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.length > 1) track('search_performed', { query }, 'Explore');
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const hasQuery = debouncedQuery.length > 1;
  const isNSW = activeState === 'NSW';
  const isStateFilter = activeState !== 'Federal';

  const { members, loading: membersLoading } = useMembers(
    hasQuery && !isStateFilter ? { search: debouncedQuery, limit: 5 } : { limit: 0 }
  );
  const { bills, loading: billsLoading } = useBills(
    hasQuery && !isStateFilter ? { search: debouncedQuery, limit: 10 } : { limit: 0 }
  );

  const { members: stateMembers, loading: stateMembersLoading } = useStateMembers(
    isNSW ? 'NSW' : '',
    hasQuery ? debouncedQuery : undefined
  );
  const { bills: stateBills, loading: stateBillsLoading } = useStateBills(
    isNSW ? 'NSW' : '',
    hasQuery ? debouncedQuery : undefined
  );
  const { stories: newsStories, loading: newsLoading } = useNewsStories(
    undefined, undefined,
    hasQuery && !isStateFilter ? debouncedQuery : undefined
  );
  const { parties: allParties, loading: partiesLoading } = useParties();
  // Only show parties with a colour (the 9 seeded major parties, not role placeholders)
  const PARTY_PRIORITY = ['labor', 'liberal', 'greens', 'nationals'];
  const parties = allParties.filter(p => p.colour).sort((a, b) => {
    const aKey = (a.name + ' ' + (a.short_name || '')).toLowerCase();
    const bKey = (b.name + ' ' + (b.short_name || '')).toLowerCase();
    const aIdx = PARTY_PRIORITY.findIndex(p => aKey.includes(p));
    const bIdx = PARTY_PRIORITY.findIndex(p => bKey.includes(p));
    const aRank = aIdx === -1 ? 99 : aIdx;
    const bRank = bIdx === -1 ? 99 : bIdx;
    return aRank - bRank;
  });

  const filteredParties = hasQuery
    ? parties.filter(p => {
        const q = debouncedQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.short_name || '').toLowerCase().includes(q) ||
          (p.abbreviation || '').toLowerCase().includes(q)
        );
      })
    : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00843D" />}
      >
        <Text style={[styles.title, { color: colors.text }]}>Explore</Text>

        {/* Verify a Claim card */}
        <Pressable
          style={{ backgroundColor: '#00843D', borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          onPress={() => setVerifyVisible(true)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#ffffff25', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="shield-checkmark" size={20} color="#ffffff" />
            </View>
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Verify a Claim</Text>
              <Text style={{ fontSize: 12, color: '#ffffffcc', marginTop: 2 }}>Search any MP's actual voting record</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </Pressable>

        <VerifyModal visible={verifyVisible} onClose={() => setVerifyVisible(false)} />

        <SearchBar value={query} onChangeText={setQuery} placeholder="Search MPs, bills, parties..." />

        {/* State filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
          {STATES.map(s => (
            <CategoryChip key={s} label={s} active={activeState === s} onPress={() => setActiveState(s)} />
          ))}
        </ScrollView>

        {isStateFilter && !isNSW ? (
          /* Coming soon for non-NSW states */
          <View style={[styles.comingSoonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="time-outline" size={32} color="#c4cdd5" />
            <Text style={[styles.comingSoonTitle, { color: colors.text }]}>{activeState} Parliament</Text>
            <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>
              State parliament data for {activeState} is coming soon.
            </Text>
          </View>
        ) : isNSW ? (
          /* NSW Parliament */
          <View>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>NSW Members</Text>
              {stateMembersLoading ? (
                [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={10} style={{ marginBottom: 8 }} />)
              ) : stateMembers.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>{hasQuery ? `No members matching "${debouncedQuery}"` : 'No members found.'}</Text>
              ) : (
                stateMembers.map(m => (
                  <View key={m.id} style={[styles.stateMemberRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.stateMemberAvatar, { backgroundColor: colors.greenBg }]}>
                      <Text style={styles.stateMemberInitial}>
                        {(m.first_name?.[0] ?? m.name[0]).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stateMemberName, { color: colors.text }]}>{m.name}</Text>
                      <Text style={[styles.stateMemberSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {[m.party, m.electorate, m.chamber].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>NSW Bills</Text>
              {stateBillsLoading ? (
                [1, 2, 3].map(i => <SkeletonLoader key={i} height={72} borderRadius={10} style={{ marginBottom: 8 }} />)
              ) : stateBills.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>{hasQuery ? `No bills matching "${debouncedQuery}"` : 'No bills found.'}</Text>
              ) : (
                stateBills.map(b => (
                  <View key={b.id} style={[styles.stateBillRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.stateBillChamberBadge, { backgroundColor: colors.cardAlt }]}>
                      <Text style={[styles.stateBillChamberText, { color: colors.textBody }]}>
                        {b.chamber === 'Legislative Assembly' ? 'LA' : b.chamber === 'Legislative Council' ? 'LC' : 'NSW'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stateBillTitle, { color: colors.text }]} numberOfLines={2}>{b.title}</Text>
                      {b.status ? <Text style={[styles.stateBillStatus, { color: colors.textMuted }]} numberOfLines={1}>{b.status}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : hasQuery ? (
          /* Federal Search Results */
          <View>
            {filteredParties.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Parties</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partyRow}>
                  {filteredParties.map(party => (
                    <PartyCard key={party.id} party={party} onPress={() => navigation.navigate('PartyProfile', { party })} />
                  ))}
                </ScrollView>
              </View>
            )}
            {members.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>MPs & Senators</Text>
                {members.map(m => (
                  <MemberCard key={m.id} member={m} onPress={() => navigation.navigate('MemberProfile', { member: m })} />
                ))}
              </View>
            )}
            {bills.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Bills</Text>
                {bills.map(b => (
                  <BillCard key={b.id} bill={b} onPress={() => navigation.navigate('BillDetail', { bill: b })} />
                ))}
              </View>
            )}
            {newsStories.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>News Stories</Text>
                {newsStories.slice(0, 3).map(story => (
                  <Pressable
                    key={story.id}
                    style={({ pressed }) => [
                      styles.newsResultRow,
                      { backgroundColor: colors.surface, opacity: pressed ? 0.92 : 1 },
                    ]}
                    onPress={() => navigation.navigate('NewsStoryDetail', { story })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.newsResultHeadline, { color: colors.text }]} numberOfLines={2}>{story.headline}</Text>
                      <Text style={[styles.newsResultMeta, { color: colors.textMuted }]}>
                        {story.article_count} sources · {story.category || 'News'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
                {newsStories.length > 3 && (
                  <Pressable onPress={() => navigation.navigate('News')}>
                    <Text style={styles.seeAll}>See all news →</Text>
                  </Pressable>
                )}
              </View>
            )}
            {filteredParties.length === 0 && members.length === 0 && bills.length === 0 && newsStories.length === 0 && !membersLoading && !billsLoading && !newsLoading && (
              <EmptyState
                icon="🔍"
                title="No results found"
                subtitle={`Try a different search term`}
              />
            )}
          </View>
        ) : (
          /* Federal Browse */
          <View>
            {/* Parties */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Parties</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partyRow}>
                {partiesLoading
                  ? [1, 2, 3].map(i => <SkeletonLoader key={i} width={90} height={90} borderRadius={12} style={{ marginRight: 10 }} />)
                  : parties.map(party => (
                    <PartyCard key={party.id} party={party} onPress={() => navigation.navigate('PartyProfile', { party })} />
                  ))
                }
              </ScrollView>
            </View>

            {/* Browse by Topic */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse by Topic</Text>
              <View style={styles.grid}>
                {CATEGORIES.map(cat => (
                  <Pressable
                    key={cat.key}
                    style={[styles.catCard, { backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: TOPIC_BORDER_COLORS[cat.key] || '#6C757D' }]}
                    onPress={() => navigation.navigate('TopicBills', { category: cat.key, label: cat.label })}
                  >
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <Text style={[styles.catLabel, { color: colors.text }]}>{cat.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Compare MPs */}
            <Pressable
              style={{ backgroundColor: '#EEF2FF', borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              onPress={() => navigation.navigate('CompareMPs')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#4338CA20', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="people-outline" size={20} color="#4338CA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#4338CA' }}>Compare MPs</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>See who's more accountable</Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#4338CA" />
            </Pressable>

            {/* Promise Tracker */}
            <Pressable
              style={{ backgroundColor: '#00843D', borderRadius: 14, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              onPress={() => navigation.navigate('PromiseTracker')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#ffffff25', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="clipboard-outline" size={20} color="#ffffff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>Promise Tracker</Text>
                  <Text style={{ fontSize: 12, color: '#ffffffcc', marginTop: 2 }}>Are they keeping their promises?</Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </Pressable>

            {/* Export Data (Pro) */}
            {isPro ? (
              <View style={[styles.proCard, { backgroundColor: colors.greenBg }]}>
                <Text style={[styles.proCardText, { color: colors.textMuted }]}>CSV export coming soon.</Text>
              </View>
            ) : (
              <View style={styles.proGate}>
                <Text style={styles.proGateIcon}>👑</Text>
                <Text style={[styles.proGateTitle, { color: colors.text }]}>Export Data</Text>
                <Text style={[styles.proGateBody, { color: colors.textBody }]}>
                  Download voting records and bill data as CSV.
                </Text>
                <Pressable style={styles.proGateBtn} onPress={() => navigation.navigate('Subscription')}>
                  <Text style={styles.proGateBtnText}>Unlock with Verity Pro</Text>
                </Pressable>
              </View>
            )}

            {/* Local Councils */}
            {councils.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Local Councils</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={councils}
                  keyExtractor={c => c.id}
                  contentContainerStyle={{ gap: 10 }}
                  renderItem={({ item: c }) => (
                    <Pressable
                      style={[styles.councilCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => navigation.navigate('Council', { council: c })}
                    >
                      <View style={[styles.councilStateBadge, { backgroundColor: colors.cardAlt }]}>
                        <Text style={[styles.councilStateText, { color: colors.textBody }]}>{c.state}</Text>
                      </View>
                      <Text style={[styles.councilName, { color: colors.text }]} numberOfLines={2}>{c.name}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: SPACING.lg + 4, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.lg },
  filters: { marginTop: SPACING.md, marginBottom: SPACING.lg + 4 },
  filtersContent: { paddingBottom: SPACING.xs },
  section: { marginBottom: SPACING.xxl - 4 },
  sectionTitle: { fontSize: FONT_SIZE.subtitle + 1, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md },
  partyRow: { gap: SPACING.sm + 2 },
  partyCard: { width: 92, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', ...SHADOWS.sm },
  partyBand: { height: 56, alignItems: 'center', justifyContent: 'center' },
  partyInitials: { fontSize: FONT_SIZE.subtitle + 1, fontWeight: FONT_WEIGHT.bold, color: '#ffffff', letterSpacing: 1 },
  partyName: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, textAlign: 'center', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm + 2 },
  catCard: {
    width: '47%',
    borderRadius: BORDER_RADIUS.md + 2,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  catIcon: { fontSize: 28 },
  catLabel: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold },
  empty: { textAlign: 'center', marginTop: 40, fontSize: FONT_SIZE.body },

  // News search results
  newsResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  newsResultHeadline: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.semibold, lineHeight: 19 },
  newsResultMeta: { fontSize: FONT_SIZE.small - 1, marginTop: 3 },
  seeAll: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#00843D', textAlign: 'center', marginTop: SPACING.sm },

  // Pro gating
  proGate: {
    backgroundColor: '#fffbeb', borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg + 4, alignItems: 'center',
    gap: SPACING.sm, borderWidth: 1, borderColor: '#fde68a', marginBottom: SPACING.sm,
  },
  proGateIcon: { fontSize: 28 },
  proGateTitle: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold },
  proGateBody: { fontSize: FONT_SIZE.small, textAlign: 'center', lineHeight: 19 },
  proGateBtn: { marginTop: SPACING.xs, backgroundColor: '#00843D', borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg + 4, paddingVertical: SPACING.sm + 2 },
  proGateBtnText: { color: '#ffffff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.small + 1 },
  proCard: { borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.lg, marginBottom: SPACING.sm },
  proCardText: { fontSize: FONT_SIZE.small + 1, fontStyle: 'italic' },
  councilCard: {
    width: 130, borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.md, gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  councilStateBadge: { alignSelf: 'flex-start', borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  councilStateText: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  councilName: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, lineHeight: 18 },

  // Coming soon
  comingSoonCard: {
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg + 2, padding: 36, marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  comingSoonTitle: { fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold },
  comingSoonText: { fontSize: FONT_SIZE.small + 1, textAlign: 'center', lineHeight: 20 },

  // State member rows
  stateMemberRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm + 2, borderBottomWidth: 1,
  },
  stateMemberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#e8f5ee', alignItems: 'center', justifyContent: 'center',
  },
  stateMemberInitial: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold, color: '#00843D' },
  stateMemberName: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.semibold },
  stateMemberSub: { fontSize: FONT_SIZE.small - 1, marginTop: 1 },

  // State bill rows
  stateBillRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm + 2,
    paddingVertical: SPACING.sm + 2, borderBottomWidth: 1,
  },
  stateBillChamberBadge: {
    borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 7, paddingVertical: 3,
    marginTop: 1, minWidth: 30, alignItems: 'center',
  },
  stateBillChamberText: { fontSize: 10, fontWeight: FONT_WEIGHT.bold },
  stateBillTitle: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, lineHeight: 18 },
  stateBillStatus: { fontSize: FONT_SIZE.caption, marginTop: 2 },

  // Verify card
  verifyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  verifyLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  verifyIconWrap: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md + 2, justifyContent: 'center', alignItems: 'center' },
  verifyTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  verifySub: { fontSize: FONT_SIZE.small - 1, marginTop: 1 },
});
