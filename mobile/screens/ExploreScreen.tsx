import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Modal, TextInput, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import { spacing, radius, elevation, typography } from '../theme/tokens';
import { AppText } from '../components/ui/AppText';
import { PressableScale } from '../components/ui/PressableScale';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/timeAgo';

const PartyCard = ({ party, onPress }: { party: Party; onPress: () => void }) => {
  const colour = party.colour || '#9aabb8';
  const label = party.short_name || party.abbreviation || party.name;
  const initials = label.length <= 3
    ? label.toUpperCase()
    : label.split(' ').map((w: string) => w[0] ?? '').filter(Boolean).join('').toUpperCase().slice(0, 3) || label[0].toUpperCase();
  return (
    <PressableScale
      style={{ width: 92, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colour + '18', ...elevation.sm }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${party.name} party profile`}
    >
      <View style={{ height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: colour }}>
        <AppText variant="heading" style={{ color: '#ffffff', letterSpacing: 1 }}>{initials}</AppText>
      </View>
      <AppText variant="caption" style={{ color: colour, fontWeight: '700', textAlign: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }} numberOfLines={2}>{label}</AppText>
    </PressableScale>
  );
};

// ─── Verify Claims ────────────────────────────────────────────────────────────

function VerifyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { user } = useUser();
  const [mpSearch, setMpSearch] = useState('');
  const [selectedMP, setSelectedMP] = useState<Member | null>(null);
  const [billSearch, setBillSearch] = useState('');
  const [aiVerdict, setAiVerdict] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const { members } = useMembers(mpSearch.length > 1 ? { search: mpSearch, limit: 8 } : { limit: 0 });
  const { votes, loading: votesLoading } = useMemberVotes(selectedMP?.id || null);
  const { votes: divVotes, loading: divLoading } = useVotes(selectedMP?.id || null);

  const filteredVotes = billSearch.length > 1
    ? votes.filter(v => v.bill?.title.toLowerCase().includes(billSearch.toLowerCase()))
    : votes.slice(0, 20);

  // Improved keyword matching: split into words, match if ANY word appears in division name
  const keywords = billSearch.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const divMatches = keywords.length > 0
    ? divVotes.filter(v => {
        const name = (v.division?.name || '').toLowerCase();
        return keywords.some(kw => name.includes(kw));
      })
    : [];
  const ayeCount = divMatches.filter(v => v.vote_cast === 'aye').length;
  const noCount = divMatches.filter(v => v.vote_cast === 'no').length;
  const total = ayeCount + noCount;
  const top3Div = divMatches.slice(0, 3);
  const showVerdict = divMatches.length > 0;

  // ── AI verdict (debounced, with error feedback) ──
  React.useEffect(() => {
    if (!selectedMP || divMatches.length === 0 || billSearch.length < 2) {
      setAiVerdict(null);
      setAiLoading(false);
      setAiError(null);
      return;
    }
    if (!user) {
      setAiError(null);
      setAiLoading(false);
      return;
    }
    let cancelled = false;
    setAiLoading(true);
    setAiError(null);
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
        if (error) {
          const errMsg = typeof error === 'object' && error.message ? error.message : String(error);
          if (errMsg.includes('Rate limit')) {
            setAiError('Daily limit reached (10 claims/day). Try again tomorrow.');
          } else {
            setAiError(null);
          }
          setAiVerdict(null);
        } else if (!data?.verdict) {
          setAiVerdict(null);
        } else {
          setAiVerdict(data.verdict);
        }
      } catch {
        if (!cancelled) { setAiVerdict(null); setAiError(null); }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedMP?.id, billSearch, divMatches.length, user?.id]);

  const voteColour = (vote: string) =>
    vote === 'aye' ? colors.green : vote === 'no' ? colors.red : colors.textMuted;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="shield-checkmark" size={20} color={colors.green} />
            <AppText variant="heading" style={{ color: colors.text }}>Verify a Claim</AppText>
          </View>
          <PressableScale onPress={() => { onClose(); setSelectedMP(null); setMpSearch(''); setBillSearch(''); }} accessibilityRole="button" accessibilityLabel="Close verify a claim">
            <Ionicons name="close" size={24} color={colors.text} />
          </PressableScale>
        </View>

        {!selectedMP ? (
          <View style={{ flex: 1, padding: spacing.lg }}>
            <AppText variant="label" style={{ color: colors.textBody, marginBottom: spacing.sm }}>Search for an MP or Senator</AppText>
            <TextInput
              style={{ borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: typography.body.fontSize, marginBottom: spacing.md, borderWidth: 1, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
              value={mpSearch}
              onChangeText={setMpSearch}
              placeholder='e.g. "Did Albanese vote for housing?"'
              placeholderTextColor={colors.textMuted}
              autoFocus
              accessibilityLabel="Search for an MP or Senator"
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {members.map(m => (
                <PressableScale key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }} onPress={() => setSelectedMP(m)} accessibilityRole="button" accessibilityLabel={`Select ${m.first_name} ${m.last_name}`}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.party?.colour || colors.textMuted }} />
                  <View>
                    <AppText variant="callout" style={{ color: colors.text }}>{m.first_name} {m.last_name}</AppText>
                    <AppText variant="caption" style={{ color: colors.textMuted, marginTop: 1 }}>{m.party?.short_name} · {m.electorate?.name}</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={{ flex: 1, padding: spacing.lg }}>
            <PressableScale style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }} onPress={() => setSelectedMP(null)} accessibilityRole="button" accessibilityLabel="Change MP">
              <Ionicons name="arrow-back" size={16} color={colors.green} />
              <AppText variant="label" style={{ color: colors.green }}>Change MP</AppText>
            </PressableScale>
            <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>{selectedMP.first_name} {selectedMP.last_name}</AppText>
            <TextInput
              style={{ borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: typography.body.fontSize, marginBottom: spacing.md, borderWidth: 1, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }}
              value={billSearch}
              onChangeText={setBillSearch}
              placeholder="Search by bill topic..."
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Search by bill topic"
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {votesLoading ? (
                <AppText variant="callout" style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>Loading votes...</AppText>
              ) : (
                <>
                  {/* AI verdict card */}
                  {showVerdict && selectedMP && (aiLoading || aiVerdict || aiError) && (
                    <View style={{ backgroundColor: colors.greenBg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.green }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <Ionicons name="sparkles" size={14} color={colors.green} />
                          <AppText variant="caption" style={{ color: colors.green, fontWeight: '700', letterSpacing: 0.8 }}>AI ANALYSIS</AppText>
                        </View>
                        {aiLoading && (
                          <AppText variant="caption" style={{ fontStyle: 'italic' }}>Thinking...</AppText>
                        )}
                      </View>
                      {aiError ? (
                        <AppText variant="callout" style={{ color: colors.red }}>{aiError}</AppText>
                      ) : aiVerdict ? (
                        <>
                          <AppText variant="callout" style={{ color: colors.text, lineHeight: 21 }}>{aiVerdict}</AppText>
                          <AppText variant="caption" style={{ marginTop: spacing.sm, fontSize: 10 }}>AI-generated analysis by Claude. Not a fact-check. Verify with official records.</AppText>
                        </>
                      ) : null}
                    </View>
                  )}
                  {/* Sign in prompt for AI analysis */}
                  {showVerdict && !user && (
                    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.textMuted }}>
                      <AppText variant="callout" style={{ color: colors.textMuted }}>
                        Sign in to get AI-powered analysis of this claim.
                      </AppText>
                    </View>
                  )}
                  {showVerdict && selectedMP ? (
                    <Card style={{ marginBottom: spacing.md }}>
                      {/* MP name row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenBg, justifyContent: 'center', alignItems: 'center' }}>
                          <AppText variant="callout" style={{ fontWeight: '700', color: colors.green }}>
                            {selectedMP.first_name[0]}{selectedMP.last_name[0]}
                          </AppText>
                        </View>
                        <View>
                          <AppText variant="callout" style={{ fontWeight: '700', color: colors.text }}>
                            {selectedMP.first_name} {selectedMP.last_name}
                          </AppText>
                          <AppText variant="caption" style={{ color: colors.textMuted, marginTop: 1 }}>
                            {selectedMP.party?.name ?? ''} · {selectedMP.electorate?.name ?? ''}
                          </AppText>
                        </View>
                      </View>
                      {/* Summary */}
                      <AppText variant="callout" style={{ color: colors.textBody, marginBottom: spacing.sm }}>
                        Based on {total} recorded votes on "{billSearch.trim()}":
                      </AppText>
                      {/* Bar */}
                      {total > 0 && (
                        <View style={{ marginBottom: spacing.sm }}>
                          <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: spacing.xs }}>
                            <View style={{ flex: ayeCount, backgroundColor: colors.green }} />
                            <View style={{ flex: noCount, backgroundColor: colors.red }} />
                          </View>
                          <AppText variant="label">AYE {ayeCount} · NO {noCount}</AppText>
                        </View>
                      )}
                      {/* Top votes */}
                      {top3Div.length > 0 && (
                        <>
                          <AppText variant="caption" style={{ color: colors.textMuted, textTransform: 'uppercase', marginBottom: spacing.xs }}>Top votes:</AppText>
                          {top3Div.map((v, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                              <View style={{ borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 2, backgroundColor: v.vote_cast === 'aye' ? colors.green + '18' : colors.red + '18' }}>
                                <AppText variant="caption" style={{ fontWeight: '700', color: v.vote_cast === 'aye' ? colors.green : colors.red }}>
                                  {(v.vote_cast ?? '').toUpperCase()}
                                </AppText>
                              </View>
                              <AppText variant="label" style={{ flex: 1, color: colors.textBody }} numberOfLines={1}>
                                {v.division?.name ?? 'Unknown division'}
                              </AppText>
                            </View>
                          ))}
                        </>
                      )}
                      {/* Disclaimer */}
                      <AppText variant="caption" style={{ color: colors.textMuted, marginTop: spacing.sm }}>
                        Based on division voting records only. May not capture the full picture.
                      </AppText>
                    </Card>
                  ) : null}
                  {filteredVotes.length === 0 && !showVerdict ? (
                    <View style={{ alignItems: 'center', paddingTop: spacing.xl }}>
                      <Ionicons name="search-outline" size={32} color={colors.textMuted} />
                      <AppText variant="callout" style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg }}>
                        {billSearch.length > 1
                          ? `No voting records match "${billSearch}". Try broader terms like "health", "tax", or "climate".`
                          : `Enter a topic to check ${selectedMP?.first_name}'s voting record.`}
                      </AppText>
                    </View>
                  ) : (
                    filteredVotes.map(v => (
                      <View key={v.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minWidth: 48, alignItems: 'center', marginTop: 2, backgroundColor: voteColour(v.vote) }}>
                          <AppText variant="caption" style={{ fontWeight: '700', color: '#ffffff' }}>{v.vote.toUpperCase()}</AppText>
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText variant="callout" style={{ color: colors.text, lineHeight: 19 }} numberOfLines={2}>
                            {v.bill?.title || 'Unknown bill'}
                          </AppText>
                          <AppText variant="caption" style={{ color: colors.textMuted, marginTop: 2 }}>
                            {timeAgo(v.created_at)}
                          </AppText>
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
  // verify a claim removed — Verity is not a fact-checker
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        <AppText variant="title" style={{ color: colors.text, marginBottom: spacing.lg }}>Explore</AppText>

        <SearchBar value={query} onChangeText={setQuery} placeholder="Search MPs, bills, parties..." />

        {/* State filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md, marginBottom: spacing.xl }} contentContainerStyle={{ paddingBottom: spacing.xs }}>
          {STATES.map(s => (
            <CategoryChip key={s} label={s} active={activeState === s} onPress={() => setActiveState(s)} />
          ))}
        </ScrollView>

        {isStateFilter && !isNSW ? (
          <Card style={{ alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xxxl, marginTop: spacing.sm }}>
            <Ionicons name="business-outline" size={32} color={colors.textMuted} />
            <AppText variant="heading" style={{ color: colors.text }}>{activeState} Parliament</AppText>
            <AppText variant="callout" style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
              State parliament data for {activeState} is not yet available. Verity currently covers Federal and NSW parliaments.
            </AppText>
          </Card>
        ) : isNSW ? (
          /* NSW Parliament */
          <View>
            <View style={{ marginBottom: spacing.xxl }}>
              <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>NSW Members</AppText>
              {stateMembersLoading ? (
                [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={10} style={{ marginBottom: spacing.sm }} />)
              ) : stateMembers.length === 0 ? (
                <AppText variant="body" style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>{hasQuery ? `No members matching "${debouncedQuery}"` : 'No members found.'}</AppText>
              ) : (
                stateMembers.map(m => (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center' }}>
                      <AppText variant="callout" style={{ fontWeight: '700', color: colors.green }}>
                        {(m.first_name?.[0] ?? m.name[0]).toUpperCase()}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="callout" style={{ color: colors.text }}>{m.name}</AppText>
                      <AppText variant="caption" style={{ color: colors.textMuted, marginTop: 1 }} numberOfLines={1}>
                        {[m.party, m.electorate, m.chamber].filter(Boolean).join(' · ')}
                      </AppText>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={{ marginBottom: spacing.xxl }}>
              <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>NSW Bills</AppText>
              {stateBillsLoading ? (
                [1, 2, 3].map(i => <SkeletonLoader key={i} height={72} borderRadius={10} style={{ marginBottom: spacing.sm }} />)
              ) : stateBills.length === 0 ? (
                <AppText variant="body" style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>{hasQuery ? `No bills matching "${debouncedQuery}"` : 'No bills found.'}</AppText>
              ) : (
                stateBills.map(b => (
                  <View key={b.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3, marginTop: 1, minWidth: 30, alignItems: 'center', backgroundColor: colors.cardAlt }}>
                      <AppText variant="caption" style={{ fontWeight: '700', color: colors.textBody, fontSize: 10 }}>
                        {b.chamber === 'Legislative Assembly' ? 'LA' : b.chamber === 'Legislative Council' ? 'LC' : 'NSW'}
                      </AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" style={{ color: colors.text, lineHeight: 18 }} numberOfLines={2}>{b.title}</AppText>
                      {b.status ? <AppText variant="caption" style={{ color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{b.status}</AppText> : null}
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
              <View style={{ marginBottom: spacing.xxl }}>
                <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>Parties</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {filteredParties.map(party => (
                    <PartyCard key={party.id} party={party} onPress={() => navigation.navigate('PartyProfile', { party })} />
                  ))}
                </ScrollView>
              </View>
            )}
            {members.length > 0 && (
              <View style={{ marginBottom: spacing.xxl }}>
                <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>MPs & Senators</AppText>
                {members.map(m => (
                  <MemberCard key={m.id} member={m} onPress={() => navigation.navigate('MemberProfile', { member: m })} />
                ))}
              </View>
            )}
            {bills.length > 0 && (
              <View style={{ marginBottom: spacing.xxl }}>
                <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>Bills</AppText>
                {bills.map(b => (
                  <BillCard key={b.id} bill={b} onPress={() => navigation.navigate('BillDetail', { bill: b })} />
                ))}
              </View>
            )}
            {filteredParties.length === 0 && members.length === 0 && bills.length === 0 && !membersLoading && !billsLoading && (
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
            <View style={{ marginBottom: spacing.xxl }}>
              <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>Parties</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {partiesLoading
                  ? [1, 2, 3].map(i => <SkeletonLoader key={i} width={90} height={90} borderRadius={12} style={{ marginRight: 10 }} />)
                  : parties.map(party => (
                    <PartyCard key={party.id} party={party} onPress={() => navigation.navigate('PartyProfile', { party })} />
                  ))
                }
              </ScrollView>
            </View>

            {/* Browse by Topic */}
            <View style={{ marginBottom: spacing.xxl }}>
              <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>Browse by Topic</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {CATEGORIES.map(cat => (
                  <PressableScale
                    key={cat.key}
                    style={{
                      width: '47%',
                      borderRadius: radius.md,
                      padding: spacing.lg,
                      alignItems: 'center',
                      gap: spacing.sm,
                      backgroundColor: colors.surface,
                      borderLeftWidth: 4,
                      borderLeftColor: TOPIC_BORDER_COLORS[cat.key] || '#6C757D',
                      ...elevation.sm,
                    }}
                    onPress={() => navigation.navigate('TopicBills', { category: cat.key, label: cat.label })}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${cat.label} bills`}
                  >
                    <AppText style={{ fontSize: 28 }}>{cat.icon}</AppText>
                    <AppText variant="label" style={{ color: colors.text }}>{cat.label}</AppText>
                  </PressableScale>
                ))}
              </View>
            </View>


            {/* Export Data (Pro) */}
            {isPro ? (
              <Card style={{ marginBottom: spacing.sm, backgroundColor: colors.greenBg }}>
                <AppText variant="callout" style={{ color: colors.textMuted, fontStyle: 'italic' }}>CSV export is not yet available.</AppText>
              </Card>
            ) : (
              <Card style={{ alignItems: 'center', gap: spacing.sm, borderColor: colors.borderStrong, marginBottom: spacing.sm }}>
                <Ionicons name="diamond-outline" size={28} color={colors.green} style={{ marginBottom: spacing.xs }} />
                <AppText variant="heading" style={{ color: colors.text, fontSize: typography.callout.fontSize }}>Export Data</AppText>
                <AppText variant="callout" style={{ color: colors.textBody, textAlign: 'center', lineHeight: 19 }}>
                  Download voting records and bill data as CSV.
                </AppText>
                <PressableScale
                  style={{ marginTop: spacing.xs, backgroundColor: colors.green, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}
                  onPress={() => navigation.navigate('Subscription')}
                  accessibilityRole="button"
                  accessibilityLabel="Unlock with Verity Pro"
                >
                  <AppText variant="label" style={{ color: '#ffffff' }}>Unlock with Verity Pro</AppText>
                </PressableScale>
              </Card>
            )}

            {/* Local Councils */}
            {councils.length > 0 && (
              <View style={{ marginBottom: spacing.xxl }}>
                <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>Local Councils</AppText>
                <FlashList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={councils}
                  keyExtractor={c => c.id}
                  contentContainerStyle={{ gap: 10 }}
                  renderItem={({ item: c }) => (
                    <Card onPress={() => navigation.navigate('Council', { council: c })} style={{ width: 130, gap: spacing.sm }} padded={true}>
                      <View style={{ alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: colors.cardAlt }}>
                        <AppText variant="caption" style={{ fontWeight: '700', color: colors.textBody }}>{c.state}</AppText>
                      </View>
                      <AppText variant="label" style={{ color: colors.text, lineHeight: 18 }} numberOfLines={2}>{c.name}</AppText>
                    </Card>
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

