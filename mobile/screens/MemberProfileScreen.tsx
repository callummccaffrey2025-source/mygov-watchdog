import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Linking, Share, Platform, RefreshControl, Modal } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Member } from '../hooks/useMembers';
import { useVotes } from '../hooks/useVotes';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../hooks/useSubscription';
import { usePartyDonations, DONOR_TYPE_LABELS } from '../hooks/useDonations';
import { useIndividualDonations } from '../hooks/useIndividualDonations';
import { useCommittees } from '../hooks/useCommittees';
import { useHansard } from '../hooks/useHansard';
import { PartyBadge } from '../components/PartyBadge';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { VoteShareCard } from '../components/ShareCards';
import { MPReportShareCard } from '../components/MPReportShareCard';
import { captureAndShare } from '../utils/shareContent';
import { DivisionVote } from '../hooks/useVotes';
import { useFollow } from '../hooks/useFollow';
import { useTheme } from '../context/ThemeContext';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { track } from '../lib/analytics';
import { trackEvent } from '../lib/engagementTracker';
import { useAccountabilityScore, useParticipationIndex } from '../hooks/useAccountabilityScore';
import { useRegisteredInterests } from '../hooks/useRegisteredInterests';
import { useContradictions } from '../hooks/useContradictions';
import { ContradictionCard } from '../components/ContradictionCard';
import { RebellionCard } from '../components/RebellionCard';
import { useElectorateDemographics } from '../hooks/useElectorateDemographics';
import { useGovernmentContracts } from '../hooks/useGovernmentContracts';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { supabase } from '../lib/supabase';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';

const PROCEDURAL_PREFIXES = ['Business —', 'Motions —', 'Procedure', 'Adjournment', 'Business of the Senate', 'Business of the House'];

function cleanDivisionTitle(name: string): string {
  return name.replace(/^Bills?\s*[—\-]\s*/i, '').trim();
}

function isProcedural(name: string): boolean {
  return PROCEDURAL_PREFIXES.some(p => name.startsWith(p));
}

type TabId = 'overview' | 'votes' | 'speeches' | 'more';

export function MemberProfileScreen({ route, navigation }: any) {
  const { member: memberParam, memberId } = (route.params ?? {}) as { member?: Member; memberId?: string };
  const [member, setMember] = useState<Member | null>(memberParam ?? null);

  useEffect(() => {
    if (!member && memberId) {
      (async () => {
        try {
          const { data } = await supabase
            .from('members')
            .select('*, party:parties(name,short_name,colour,abbreviation), electorate:electorates(name,state)')
            .eq('id', memberId)
            .maybeSingle();
          if (data) setMember(data as Member);
        } catch {
          // Network failure — caller sees initial state
        }
      })();
    }
  }, [memberId]);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [fundingView, setFundingView] = useState<'party' | 'personal'>('party');
  const [visibleCount, setVisibleCount] = useState(20);
  const [showMethodology, setShowMethodology] = useState(false);
  const { votes, loading: votesLoading } = useVotes(member?.id ?? null);

  useEffect(() => {
    setVisibleCount(20);
    if (member) {
      track('mp_profile_view', { member_id: member.id, name: `${member.first_name} ${member.last_name}` }, 'MemberProfile');
      trackEvent('mp_view', { member_id: member.id });
    }
  }, [member?.id]);
  const { user } = useUser();
  const { isPro } = useSubscription(user?.id);
  const { donations, loading: donationsLoading, totalAmount } = usePartyDonations(member?.party_id ?? undefined);
  const { donations: indDonations, total: indTotal, loading: indLoading } = useIndividualDonations(member?.id);
  const { current: committees, loading: committeesLoading } = useCommittees(member?.id);
  const { entries: hansardEntries, loading: hansardLoading } = useHansard(member?.id);
  const { grouped: interestsGrouped, interests: allInterests, loading: interestsLoading } = useRegisteredInterests(member?.id);
  const { contradictions, loading: contradictionsLoading } = useContradictions({ memberId: member?.id });
  const { demographics } = useElectorateDemographics(member?.electorate_id ?? undefined);
  const { summary: contractSummary } = useGovernmentContracts(member?.electorate_id ?? undefined);

  const party = member?.party;
  const partyColour = party?.colour || '#9aabb8';
  const displayName = member ? `${member.first_name} ${member.last_name}` : '';

  const ayeCount = votes.filter(v => v.vote_cast === 'aye').length;
  const totalVotes = votes.length;
  const accountabilityScore = useAccountabilityScore(votes, hansardEntries, committees, party?.name);
  const participationIndex = useParticipationIndex(votes, hansardEntries, committees);

  // Share cards
  const voteCardRef = useRef<any>(null);
  const reportCardRef = useRef<any>(null);
  const [shareVoteData, setShareVoteData] = useState<DivisionVote | null>(null);
  const [shareReport, setShareReport] = useState(false);

  useEffect(() => {
    if (shareVoteData) {
      captureAndShare(voteCardRef, 'mp_vote', shareVoteData.id, user?.id)
        .finally(() => setShareVoteData(null));
    }
  }, [shareVoteData]);

  useEffect(() => {
    if (shareReport && member) {
      captureAndShare(reportCardRef, 'mp_report_card', member.id, user?.id)
        .finally(() => setShareReport(false));
    }
  }, [shareReport]);

  // Top donors for report card
  const topDonors = Array.from(
    indDonations.reduce((acc, d) => {
      acc.set(d.donor_name, (acc.get(d.donor_name) ?? 0) + Number(d.amount));
      return acc;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const { following: followingMP, toggle: toggleFollow } = useFollow('member', member?.id ?? '');
  const { colors } = useTheme();
  const { requireAuth, authSheetProps } = useAuthGate();

  const handleShare = () => {
    const ayeRate = totalVotes > 0 ? `${Math.round((ayeCount / totalVotes) * 100)}% aye rate` : '';
    Share.share({
      message: `${displayName} (${member?.party?.short_name || member?.party?.name || ''})${member?.electorate ? ` — ${member.electorate.name}` : ''}${ayeRate ? ` · ${ayeRate}` : ''}\nView their full voting record on Verity.`,
    });
  };

  const handleShareParticipation = () => {
    Share.share({
      message:
        `${displayName} on the Verity Participation Index:\n\n` +
        `Attendance: ${participationIndex.attendanceRate}%\n` +
        `Speeches: ${participationIndex.speechesCount}\n` +
        `Questions: ${participationIndex.questionsCount}\n` +
        `Independence (crossed floor): ${participationIndex.independenceRate}%\n` +
        `Committees: ${participationIndex.committeeCount}${participationIndex.chairCount > 0 ? ` (${participationIndex.chairCount} as chair/deputy)` : ''}\n\n` +
        `Based on ${participationIndex.totalVotes} recorded votes from public APH records.\n` +
        `Track your MP at verity.run`,
    });
  };

  const isMinisterOrChair = !!(member?.ministerial_role || participationIndex.chairCount > 0);

  // Recent substantive votes for overview tab
  const recentVotes = votes
    .filter(v => !isProcedural(v.division?.name || ''))
    .slice(0, 3);

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'votes', label: 'Votes' },
    { id: 'speeches', label: 'Speeches' },
    { id: 'more', label: 'More' },
  ];

  if (!member) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <SkeletonLoader width="100%" height={200} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={async () => {
              if (memberId) {
                try {
                  const { data } = await supabase
                    .from('members')
                    .select('*, party:parties(name,short_name,colour,abbreviation), electorate:electorates(name,state)')
                    .eq('id', memberId)
                    .maybeSingle();
                  if (data) setMember(data as Member);
                } catch {}
              }
            }}
            tintColor="#00843D"
          />
        }
      >
        {/* ───── 1. PINK HEADER ───── */}
        <View style={{ backgroundColor: partyColour + '18', paddingBottom: SPACING.xl }}>
          {/* Nav: back + share/bookmark */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg }}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <Pressable
                onPress={handleShare}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Share MP profile"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={18} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => setShareReport(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Share report card"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="bookmark-outline" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Avatar */}
          <View style={{ alignItems: 'center', marginTop: SPACING.lg }}>
            <View style={{ borderRadius: 48, borderWidth: 3, borderColor: partyColour, overflow: 'hidden' }}>
              {member.photo_url ? (
                <Image source={{ uri: member.photo_url }} style={{ width: 96, height: 96 }} accessibilityLabel={`Photo of ${displayName}`} />
              ) : (
                <View style={{ width: 96, height: 96, justifyContent: 'center', alignItems: 'center', backgroundColor: partyColour + '33' }}>
                  <Text style={{ fontSize: 32, fontWeight: '700', color: partyColour }}>
                    {member.first_name[0]}{member.last_name[0]}
                  </Text>
                </View>
              )}
            </View>

            {/* Name + verified */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{displayName}</Text>
              <Ionicons name="checkmark-circle" size={20} color="#1D9BF0" />
            </View>

            {/* Ministerial role */}
            {member.ministerial_role && (
              <Text style={{ fontSize: 15, fontWeight: '600', color: partyColour, marginTop: 2, textAlign: 'center', paddingHorizontal: 20 }} numberOfLines={2}>
                {member.ministerial_role}
              </Text>
            )}

            {/* Party badge */}
            {party && <View style={{ marginTop: SPACING.sm }}><PartyBadge name={party.name} colour={party.colour} /></View>}

            {/* Meta */}
            {member.electorate && (
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, marginTop: SPACING.xs }}>
                {member.electorate.name} · {member.chamber === 'senate' ? 'Senator' : 'MP'} · {member.electorate.state}
              </Text>
            )}
          </View>
        </View>

        {/* ───── 2. PRIMARY CTA ROW ───── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: SPACING.lg + 4, paddingVertical: SPACING.lg, gap: SPACING.md, backgroundColor: colors.background }}>
          <Pressable
            onPress={() => requireAuth('follow this MP', toggleFollow)}
            accessibilityRole="button"
            accessibilityLabel={followingMP ? `Unfollow ${displayName}` : `Follow ${displayName}`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: SPACING.sm,
              backgroundColor: followingMP ? '#006B31' : '#00843D',
              borderRadius: 100,
              paddingVertical: SPACING.md,
            }}
          >
            <Ionicons name={followingMP ? 'heart' : 'heart-outline'} size={16} color="#ffffff" />
            <Text style={{ fontSize: FONT_SIZE.small + 1, fontWeight: '600', color: '#ffffff' }}>
              {followingMP ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => requireAuth('write to your MP', () => navigation.navigate('WriteToMP', { member }))}
            accessibilityRole="button"
            accessibilityLabel={`Write to ${member.first_name}`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: SPACING.sm,
              backgroundColor: colors.background,
              borderRadius: 100,
              paddingVertical: SPACING.md,
              borderWidth: 1.5,
              borderColor: '#00843D',
            }}
          >
            <Ionicons name="mail-outline" size={16} color="#00843D" />
            <Text style={{ fontSize: FONT_SIZE.small + 1, fontWeight: '600', color: '#00843D' }}>
              Write to {member.first_name}
            </Text>
          </Pressable>
        </View>

        {/* ───── 3. PARTICIPATION INDEX SECTION ───── */}
        {!votesLoading && (
          <View style={{ paddingHorizontal: SPACING.lg + 4, marginBottom: SPACING.lg }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Participation Index</Text>
              <Pressable onPress={handleShareParticipation} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share participation index" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="share-outline" size={16} color="#00843D" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>Share</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: SPACING.lg, lineHeight: 17 }}>
              Parliamentary participation from public APH records. Not a judgment of effectiveness or virtue.
            </Text>

            {/* ───── 4. CONTEXT CARD ───── */}
            {isMinisterOrChair && (
              <View style={{ backgroundColor: '#E7EEFF', borderRadius: 16, padding: SPACING.lg, marginBottom: SPACING.lg, flexDirection: 'row', gap: SPACING.sm }}>
                <Ionicons name="briefcase-outline" size={16} color="#4338CA" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#4338CA', marginBottom: 2 }}>
                    {member.ministerial_role ? 'Read these numbers with ministerial context' : 'Committee leadership context'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#3730A3', lineHeight: 17 }}>
                    {member.ministerial_role
                      ? `${member.first_name} runs a department as ${member.ministerial_role}. Ministers typically give fewer speeches and can miss divisions for cabinet duties. Their "party loyalty" is structural, not voluntary.`
                      : `${member.first_name} chairs ${participationIndex.chairCount} committee${participationIndex.chairCount !== 1 ? 's' : ''}. Committee chairs spend significant time in hearings and inquiries rather than the main chamber.`
                    }
                  </Text>
                </View>
              </View>
            )}

            {/* Low sample warning */}
            {participationIndex.isLowSample && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginBottom: SPACING.md }}>
                <Ionicons name="information-circle" size={14} color="#D97706" />
                <Text style={{ flex: 1, fontSize: 12, color: '#92400E' }}>
                  Small sample ({participationIndex.totalVotes} votes) — these numbers will change as more data is recorded.
                </Text>
              </View>
            )}

            {/* ───── 5. FOUR STAT CARDS (2x2) ───── */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1, backgroundColor: '#F5F3EE', borderRadius: 16, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Ionicons name="checkmark-done-outline" size={12} color="#6B7280" />
                  <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>Attendance</Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>{participationIndex.attendanceRate}%</Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>of {participationIndex.totalVotes} recorded votes</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#F5F3EE', borderRadius: 16, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Ionicons name="mic-outline" size={12} color="#6B7280" />
                  <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>Activity</Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>{participationIndex.parliamentaryActivity}</Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{participationIndex.speechesCount} speeches · {participationIndex.questionsCount} questions</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: SPACING.md }}>
              <View style={{ flex: 1, backgroundColor: '#F5F3EE', borderRadius: 16, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Ionicons name="git-branch-outline" size={12} color="#6B7280" />
                  <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>Independence</Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>{participationIndex.independenceRate}%</Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{participationIndex.rebelVotes === 1 ? 'crossed floor once' : `crossed floor ${participationIndex.rebelVotes} times`}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#F5F3EE', borderRadius: 16, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <Ionicons name="people-outline" size={12} color="#6B7280" />
                  <Text style={{ fontSize: 10.5, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>Committees</Text>
                </View>
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>{participationIndex.committeeCount}</Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{participationIndex.chairCount > 0 ? `${participationIndex.chairCount} as chair/deputy` : 'member roles'}</Text>
              </View>
            </View>

            {/* ───── 6. METHODOLOGY FOOTER BAR ───── */}
            <Pressable
              onPress={() => setShowMethodology(true)}
              accessibilityRole="button"
              accessibilityLabel="View methodology"
              style={{ backgroundColor: '#F5F3EE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Methodology v1.0 · Wilson 95% CI</Text>
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#00843D' }}>How we calculate →</Text>
            </Pressable>
          </View>
        )}

        {/* ───── 6b. REBELLION CARD ───── */}
        {!votesLoading && member && party && (
          <RebellionCard
            memberId={member.id}
            memberName={displayName}
            partyName={party.short_name || party.name}
            userId={user?.id}
            onPressRebellion={(divisionId) => {
              const vote = votes.find(v => v.division?.id === divisionId);
              if (vote?.division) {
                navigation.navigate('BillDetail', { billId: vote.division.id });
              }
            }}
          />
        )}

        {/* ───── 7. TAB BAR ───── */}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.sm }}>
            {TABS.map(tab => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                accessibilityRole="button"
                accessibilityLabel={`${tab.label} tab`}
                style={{
                  paddingVertical: SPACING.md + 2,
                  paddingHorizontal: SPACING.lg,
                  borderBottomWidth: activeTab === tab.id ? 2 : 0,
                  borderBottomColor: activeTab === tab.id ? '#00843D' : 'transparent',
                }}
              >
                <Text style={{ fontSize: FONT_SIZE.small + 1, fontWeight: '500', color: activeTab === tab.id ? '#00843D' : colors.textMuted }}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ───── TAB CONTENT ───── */}
        <View style={{ padding: SPACING.lg + 4 }}>

          {/* ═══════ OVERVIEW TAB ═══════ */}
          {activeTab === 'overview' && (
            <>
              {/* ───── 8. RECENT VOTES SECTION ───── */}
              <View style={{ marginBottom: SPACING.xl }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
                  <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: '700', color: colors.text }}>Recent votes</Text>
                  <Pressable onPress={() => setActiveTab('votes')} hitSlop={8} accessibilityRole="button" accessibilityLabel={`View all ${totalVotes} votes`}>
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '600', color: '#00843D' }}>All {totalVotes} →</Text>
                  </Pressable>
                </View>

                {votesLoading ? (
                  [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={16} style={{ marginBottom: 8 }} />)
                ) : recentVotes.length === 0 ? (
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, textAlign: 'center', paddingVertical: SPACING.xl }}>No recent votes recorded.</Text>
                ) : (
                  <View style={{ backgroundColor: '#F5F3EE', borderRadius: 16, overflow: 'hidden' }}>
                    {recentVotes.map((v, idx) => {
                      const rawName = v.division?.name || 'Unknown division';
                      const title = cleanDivisionTitle(rawName);
                      const isAye = v.vote_cast === 'aye';
                      const isNo = v.vote_cast === 'no';
                      return (
                        <View
                          key={v.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: SPACING.lg,
                            paddingVertical: SPACING.md + 2,
                            borderBottomWidth: idx < recentVotes.length - 1 ? 0.5 : 0,
                            borderBottomColor: '#E5E2DB',
                          }}
                        >
                          <View style={{ flex: 1, marginRight: SPACING.md }}>
                            <Text style={{ fontSize: 14.5, fontWeight: '500', color: colors.text }} numberOfLines={2}>{title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 3 }}>
                              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                                {v.division?.date ? timeAgo(v.division.date) : ''}
                              </Text>
                              {v.rebelled && (
                                <Text style={{ fontSize: 10, color: '#b45309', backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, fontWeight: '700' }}>Crossed floor</Text>
                              )}
                            </View>
                          </View>
                          <View style={{
                            backgroundColor: isAye ? 'rgba(0,132,61,0.12)' : isNo ? 'rgba(220,38,38,0.12)' : colors.cardAlt,
                            borderRadius: 6,
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                          }}>
                            <Text style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color: isAye ? '#00843D' : isNo ? '#DC2626' : colors.textMuted,
                            }}>
                              {isAye ? 'Aye' : isNo ? 'No' : v.vote_cast || '—'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>


              {/* ───── 9. SECONDARY CHIPS ROW ───── */}
              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xl }}>
                <Pressable
                  onPress={() => setShowMethodology(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Read methodology"
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#E7EEFF', borderRadius: 10, paddingVertical: SPACING.md }}
                >
                  <Ionicons name="book-outline" size={15} color="#4F46E5" />
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '600', color: '#4F46E5' }}>Read methodology</Text>
                </Pressable>
              </View>

              {/* ───── 10. SOURCES FOOTER ───── */}
              <View style={{ backgroundColor: '#F5F3EE', borderRadius: 16, padding: SPACING.lg, marginBottom: SPACING.lg }}>
                <Text style={{ fontSize: 12, color: '#6B7280', lineHeight: 18 }}>
                  Sources — Parliament of Australia · OpenAustralia · AEC
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Updated {timeAgo(new Date().toISOString())}</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>·</Text>
                  <Pressable onPress={() => Linking.openURL('mailto:corrections@verity.run')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Report an issue via email">
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#00843D' }}>Report an issue</Text>
                  </Pressable>
                </View>
              </View>

            </>
          )}

          {/* ═══════ VOTES TAB ═══════ */}
          {activeTab === 'votes' && (
            <>
              {votesLoading ? (
                [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
              ) : votes.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md }}>
                  <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                  <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>No voting records yet</Text>
                  <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center' }}>Votes will appear as division data is recorded.</Text>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: colors.greenBg, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md }}>
                    <Ionicons name="stats-chart" size={16} color="#00843D" />
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '600', color: colors.text }}>
                      Voted in {totalVotes} division{totalVotes !== 1 ? 's' : ''}{totalVotes > 0 ? ` · ${Math.round((ayeCount / totalVotes) * 100)}% aye rate` : ''}
                    </Text>
                  </View>
                  {votes.slice(0, visibleCount).map(v => {
                    const rawName = v.division?.name || 'Unknown division';
                    const procedural = isProcedural(rawName);
                    const title = cleanDivisionTitle(rawName);
                    const isAye = v.vote_cast === 'aye';
                    const isNo = v.vote_cast === 'no';
                    return (
                      <View key={v.id} style={{ borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm + 2, backgroundColor: colors.card, ...SHADOWS.sm }}>
                        <View style={{ width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', flexShrink: 0, backgroundColor: isAye ? colors.greenBg : isNo ? colors.redBg : colors.cardAlt }}>
                          <Ionicons
                            name={isAye ? 'checkmark' : isNo ? 'close' : 'remove'}
                            size={16}
                            color={isAye ? '#00843D' : isNo ? '#d32f2f' : '#9aabb8'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={procedural ? { fontSize: FONT_SIZE.small - 1, lineHeight: 17, color: colors.textMuted } : { fontSize: FONT_SIZE.small, lineHeight: 18, color: colors.text }} numberOfLines={2}>{title}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 }}>
                            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                              {v.division?.date ? timeAgo(v.division.date) : ''}
                            </Text>
                            {v.rebelled && (
                              <Text style={{ fontSize: 10, color: '#b45309', backgroundColor: '#fef3c7', borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: 6, paddingVertical: 1, fontWeight: '700' }}>Crossed floor</Text>
                            )}
                          </View>
                        </View>
                        <Pressable onPress={() => setShareVoteData(v)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share this vote" style={{ padding: SPACING.xs, marginLeft: SPACING.xs }}>
                          <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={15} color="#9aabb8" />
                        </Pressable>
                      </View>
                    );
                  })}
                  {votes.length > visibleCount && (
                    <Pressable onPress={() => setVisibleCount(c => c + 20)} accessibilityRole="button" accessibilityLabel={`Show ${Math.min(20, votes.length - visibleCount)} more votes`} style={{ alignItems: 'center', paddingVertical: SPACING.md, marginTop: SPACING.xs }}>
                      <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '600', color: colors.green }}>
                        Show {Math.min(20, votes.length - visibleCount)} more votes
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </>
          )}

          {/* ═══════ SPEECHES TAB ═══════ */}
          {activeTab === 'speeches' && (
            <>
              {hansardLoading ? (
                [1, 2, 3].map(i => <SkeletonLoader key={i} height={80} borderRadius={10} style={{ marginBottom: 10 }} />)
              ) : hansardEntries.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md }}>
                  <Ionicons name="mic-outline" size={48} color={colors.textMuted} />
                  <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>No recent speeches</Text>
                  <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center' }}>Speeches appear once Hansard data is loaded for this MP.</Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: SPACING.md }}>Recent Speeches</Text>
                  {hansardEntries.map(entry => (
                    <Pressable
                      key={entry.id}
                      onPress={() => entry.source_url && Linking.openURL(entry.source_url)}
                      accessibilityRole="button"
                      accessibilityLabel={`View speech${entry.debate_topic ? `: ${entry.debate_topic}` : ''}`}
                      style={{ borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.md + 2, marginBottom: SPACING.sm + 2, backgroundColor: colors.card, ...SHADOWS.sm }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
                        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: '600', color: colors.textMuted }}>
                          {timeAgo(entry.date)}
                        </Text>
                        {entry.source_url && <Ionicons name="open-outline" size={13} color={colors.textMuted} />}
                      </View>
                      {entry.debate_topic ? (
                        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '700', color: colors.text, marginBottom: SPACING.xs }} numberOfLines={1}>{entry.debate_topic}</Text>
                      ) : null}
                      {entry.excerpt ? (
                        <Text style={{ fontSize: FONT_SIZE.small - 1, lineHeight: 18, color: colors.textBody }} numberOfLines={3}>{decodeHtml(entry.excerpt)}</Text>
                      ) : null}
                    </Pressable>
                  ))}
                  <Text style={{ fontSize: FONT_SIZE.caption, marginTop: SPACING.lg, textAlign: 'center', color: colors.textMuted }}>Source: OpenAustralia / APH Hansard</Text>
                </>
              )}
            </>
          )}


          {/* ═══════ MORE TAB ═══════ */}
          {activeTab === 'more' && (
            <>
              {/* ── About ── */}
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: '700', color: colors.text, marginBottom: SPACING.md }}>About</Text>
              <View style={{ marginBottom: SPACING.xl }}>
                <View style={{ gap: SPACING.xs }}>
                  <Text style={{ fontSize: FONT_SIZE.small - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: SPACING.md }}>Chamber</Text>
                  <Text style={{ fontSize: FONT_SIZE.body, color: colors.text }}>{member.chamber === 'senate' ? 'Senate' : 'House of Representatives'}</Text>
                  {member.electorate && (
                    <>
                      <Text style={{ fontSize: FONT_SIZE.small - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: SPACING.md }}>Electorate</Text>
                      <Text style={{ fontSize: FONT_SIZE.body, color: colors.text }}>{member.electorate.name}, {member.electorate.state}</Text>
                    </>
                  )}
                  {member.ministerial_role && (
                    <>
                      <Text style={{ fontSize: FONT_SIZE.small - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: SPACING.md }}>Current Role</Text>
                      <Text style={{ fontSize: FONT_SIZE.body, color: colors.text }}>{member.ministerial_role}</Text>
                    </>
                  )}
                  {member.email && (
                    <>
                      <Text style={{ fontSize: FONT_SIZE.small - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: SPACING.md }}>Email</Text>
                      <Text style={{ fontSize: FONT_SIZE.body, color: colors.green }} onPress={() => Linking.openURL(`mailto:${member.email}`)}>{member.email}</Text>
                    </>
                  )}
                  {member.phone && (
                    <>
                      <Text style={{ fontSize: FONT_SIZE.small - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: SPACING.md }}>Phone</Text>
                      <Text style={{ fontSize: FONT_SIZE.body, color: colors.text }}>{member.phone}</Text>
                    </>
                  )}
                </View>

                {/* Committee memberships */}
                {committeesLoading ? (
                  <SkeletonLoader height={20} borderRadius={4} style={{ marginTop: 16 }} />
                ) : committees.length > 0 ? (
                  <>
                    <Text style={{ fontSize: FONT_SIZE.small - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: SPACING.lg }}>Current Committees</Text>
                    {committees.map(c => (
                      <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ flex: 1, marginRight: SPACING.sm }}>
                          <Text style={{ fontSize: FONT_SIZE.small, lineHeight: 18, color: colors.text }}>{c.committee_name}</Text>
                          {c.committee_type && (
                            <Text style={{ fontSize: FONT_SIZE.caption, marginTop: 1, color: colors.textMuted }}>
                              {c.committee_type.charAt(0).toUpperCase() + c.committee_type.slice(1)}
                            </Text>
                          )}
                        </View>
                        {c.role !== 'member' && (
                          <View style={{ backgroundColor: '#e8f5ee', borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#00843D' }}>
                              {c.role.charAt(0).toUpperCase() + c.role.slice(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                ) : null}
              </View>

              {/* ── Funding ── */}
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: '700', color: colors.text, marginBottom: SPACING.md }}>Funding</Text>
              <View style={{ marginBottom: SPACING.xl }}>
                {/* Funding sub-toggle */}
                <View style={{ flexDirection: 'row', borderRadius: BORDER_RADIUS.md, padding: 3, marginBottom: SPACING.lg, backgroundColor: colors.cardAlt }}>
                  <Pressable
                    onPress={() => setFundingView('party')}
                    accessibilityRole="button"
                    accessibilityLabel="Show party funding"
                    style={{ flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm + 2, ...(fundingView === 'party' ? { backgroundColor: colors.card, ...SHADOWS.sm } : {}) }}
                  >
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '600', color: fundingView === 'party' ? colors.text : colors.textMuted }}>Party Funding</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFundingView('personal')}
                    accessibilityRole="button"
                    accessibilityLabel="Show personal donations"
                    style={{ flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm + 2, ...(fundingView === 'personal' ? { backgroundColor: colors.card, ...SHADOWS.sm } : {}) }}
                  >
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '600', color: fundingView === 'personal' ? colors.text : colors.textMuted }}>Personal Donations</Text>
                  </Pressable>
                </View>

                {fundingView === 'party' ? (
                  donationsLoading ? (
                    [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
                  ) : (
                    <View>
                      <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: SPACING.md }}>
                        Party donations — {member.party?.short_name || member.party?.name || ''}
                      </Text>
                      {donations.length === 0 ? (
                        <Text style={{ textAlign: 'center', fontSize: FONT_SIZE.small + 1, marginTop: SPACING.lg + 4, color: colors.textMuted }}>No donation data available.</Text>
                      ) : (
                        <>
                          {donations.map(d => (
                            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                              <View style={{ flex: 1, marginRight: SPACING.sm + 2 }}>
                                <Text style={{ fontSize: FONT_SIZE.small, lineHeight: 18, color: colors.text }} numberOfLines={2}>{d.donor_name}</Text>
                                <Text style={{ fontSize: FONT_SIZE.caption, marginTop: 2, color: colors.textMuted }}>{d.financial_year}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: SPACING.xs }}>
                                <View style={{ borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, backgroundColor: d.donor_type === 'union' ? '#e8f0fe' : d.donor_type === 'corporation' ? colors.cardAlt : colors.greenBg }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: d.donor_type === 'union' ? '#0066CC' : d.donor_type === 'corporation' ? colors.textBody : '#00843D' }}>
                                    {DONOR_TYPE_LABELS[d.donor_type]}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: FONT_SIZE.small + 1, fontWeight: '700', color: colors.text }}>${Number(d.amount).toLocaleString('en-AU')}</Text>
                              </View>
                            </View>
                          ))}
                          <Text style={{ fontSize: FONT_SIZE.caption, marginTop: SPACING.lg, textAlign: 'center', color: colors.textMuted }}>
                            Total declared: ${totalAmount.toLocaleString('en-AU')} · Source: AEC
                          </Text>
                        </>
                      )}
                    </View>
                  )
                ) : (
                  indLoading ? (
                    [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
                  ) : (
                    <View>
                      <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: SPACING.md }}>
                        Donations to {member.first_name} {member.last_name}
                      </Text>
                      {indDonations.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm }}>
                          <Ionicons name="receipt-outline" size={24} color={colors.borderStrong} />
                          <Text style={{ fontSize: FONT_SIZE.small + 1, fontWeight: '600', color: colors.textMuted }}>No personal donation records found.</Text>
                          <Text style={{ fontSize: FONT_SIZE.small - 1, textAlign: 'center', lineHeight: 17, paddingHorizontal: SPACING.sm, color: colors.textMuted }}>
                            Most donations are made directly to parties. Individual disclosures appear when donors report donations to a specific candidate or MP.
                          </Text>
                        </View>
                      ) : (
                        <>
                          {indDonations.map(d => (
                            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                              <View style={{ flex: 1, marginRight: SPACING.sm + 2 }}>
                                <Text style={{ fontSize: FONT_SIZE.small, lineHeight: 18, color: colors.text }} numberOfLines={2}>{d.donor_name}</Text>
                                <Text style={{ fontSize: FONT_SIZE.caption, marginTop: 2, color: colors.textMuted }}>{d.financial_year}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: SPACING.xs }}>
                                <View style={{ borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, backgroundColor: d.donor_type === 'union' ? '#e8f0fe' : d.donor_type === 'corporation' ? colors.cardAlt : colors.greenBg }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: d.donor_type === 'union' ? '#0066CC' : d.donor_type === 'corporation' ? colors.textBody : '#00843D' }}>
                                    {DONOR_TYPE_LABELS[d.donor_type ?? ''] ?? (d.donor_type || 'Other')}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: FONT_SIZE.small + 1, fontWeight: '700', color: colors.text }}>${Number(d.amount).toLocaleString('en-AU')}</Text>
                              </View>
                            </View>
                          ))}
                          <Text style={{ fontSize: FONT_SIZE.caption, marginTop: SPACING.lg, textAlign: 'center', color: colors.textMuted }}>
                            Total declared: ${indTotal.toLocaleString('en-AU')} · Source: AEC
                          </Text>
                        </>
                      )}
                    </View>
                  )
                )}

                {/* ── Donation vs Voting Analysis ── */}
                {(() => {
                  const INDUSTRY_KEYWORDS: Record<string, string[]> = {
                    'Mining & Resources': ['mining', 'bhp', 'rio tinto', 'fortescue', 'woodside', 'santos', 'mineral', 'resources', 'coal', 'iron ore'],
                    'Property & Construction': ['property', 'construction', 'real estate', 'developer', 'lendlease', 'stockland', 'mirvac', 'housing', 'building'],
                    'Banking & Finance': ['bank', 'financial', 'westpac', 'commonwealth bank', 'anz', 'nab', 'macquarie', 'insurance', 'asx'],
                    'Unions': ['union', 'awu', 'cfmeu', 'sda', 'hsu', 'nurses', 'teachers', 'workers', 'actu', 'amwu'],
                    'Pharmaceuticals & Health': ['pharma', 'medical', 'health', 'pfizer', 'csl', 'hospital', 'therapeutic'],
                    'Technology': ['technology', 'tech', 'software', 'digital', 'data', 'cyber', 'telstra', 'optus'],
                    'Energy': ['energy', 'gas', 'oil', 'solar', 'wind', 'agl', 'origin energy', 'electricity'],
                    'Agriculture': ['agriculture', 'farm', 'cattle', 'grain', 'dairy', 'pastoral', 'national farmers'],
                    'Gambling': ['gambling', 'wagering', 'crown', 'star', 'tabcorp', 'sportsbet', 'gaming'],
                    'Media': ['media', 'news corp', 'nine', 'seven', 'foxtel', 'broadcast'],
                  };

                  const VOTE_KEYWORDS: Record<string, string[]> = {
                    'Mining & Resources': ['mining', 'mineral', 'resources', 'coal', 'gas', 'petroleum', 'offshore'],
                    'Property & Construction': ['housing', 'property', 'construction', 'planning', 'building', 'rent', 'home'],
                    'Banking & Finance': ['banking', 'financial', 'credit', 'superannuation', 'insurance', 'prudential'],
                    'Unions': ['workplace', 'industrial', 'fair work', 'employment', 'worker', 'bargaining'],
                    'Pharmaceuticals & Health': ['health', 'medical', 'pharmaceutical', 'therapeutic', 'medicare', 'hospital'],
                    'Technology': ['technology', 'digital', 'cyber', 'data', 'telecom', 'broadband', 'online'],
                    'Energy': ['energy', 'electricity', 'renewable', 'emissions', 'carbon', 'climate'],
                    'Agriculture': ['agriculture', 'farm', 'rural', 'water', 'drought', 'biosecurity'],
                    'Gambling': ['gambling', 'wagering', 'gaming', 'betting'],
                    'Media': ['media', 'broadcast', 'press', 'journalism'],
                  };

                  const donorSource = indDonations.length > 0 ? indDonations : donations;
                  const donorAgg = new Map<string, { amount: number; type: string | null }>();
                  for (const d of donorSource) {
                    const existing = donorAgg.get(d.donor_name);
                    donorAgg.set(d.donor_name, {
                      amount: (existing?.amount ?? 0) + Number(d.amount),
                      type: d.donor_type ?? existing?.type ?? null,
                    });
                  }
                  const topDonorsWithIndustry = Array.from(donorAgg.entries())
                    .sort((a, b) => b[1].amount - a[1].amount)
                    .slice(0, 5)
                    .map(([name, { amount, type }]) => {
                      const nameLower = name.toLowerCase();
                      let industry: string | null = null;
                      for (const [ind, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
                        if (keywords.some(kw => nameLower.includes(kw))) {
                          industry = ind;
                          break;
                        }
                      }
                      if (!industry && type === 'union') industry = 'Unions';
                      return { name, amount, industry };
                    })
                    .filter(d => d.industry);

                  if (topDonorsWithIndustry.length === 0) return null;

                  const industryVotes: Record<string, { aye: number; no: number }> = {};
                  for (const donor of topDonorsWithIndustry) {
                    if (!donor.industry || industryVotes[donor.industry]) continue;
                    const keywords = VOTE_KEYWORDS[donor.industry] || [];
                    let aye = 0;
                    let no = 0;
                    for (const v of votes) {
                      const divName = (v.division?.name || '').toLowerCase();
                      if (keywords.some(kw => divName.includes(kw))) {
                        if (v.vote_cast === 'aye') aye++;
                        else if (v.vote_cast === 'no') no++;
                      }
                    }
                    if (aye + no > 0) industryVotes[donor.industry] = { aye, no };
                  }

                  return (
                    <View style={{ marginTop: SPACING.xl }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.lg }}>
                        <Ionicons name="git-compare-outline" size={18} color="#4338CA" />
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Donations vs Voting</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: SPACING.lg }}>
                        Showing how {member.first_name} {member.last_name} voted on bills related to their donors' industries.
                      </Text>

                      {topDonorsWithIndustry.map((donor, i) => {
                        const iv = donor.industry ? industryVotes[donor.industry] : null;
                        return (
                          <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>{donor.name}</Text>
                                {donor.industry && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4338CA' }} />
                                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{donor.industry}</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>${donor.amount.toLocaleString('en-AU')}</Text>
                            </View>
                            {iv ? (
                              <View style={{ backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10, marginTop: 4 }}>
                                <Text style={{ fontSize: 13, color: '#4338CA', lineHeight: 18 }}>
                                  Voted <Text style={{ fontWeight: '700', color: '#059669' }}>YES</Text> on {iv.aye} and{' '}
                                  <Text style={{ fontWeight: '700', color: '#DC2626' }}>NO</Text> on {iv.no}{' '}
                                  {donor.industry?.toLowerCase()}-related bill{iv.aye + iv.no !== 1 ? 's' : ''}
                                </Text>
                              </View>
                            ) : (
                              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' }}>No related votes found</Text>
                            )}
                          </View>
                        );
                      })}

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Share donations vs voting analysis"
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 10 }}
                        onPress={() => {
                          const topDonor = topDonorsWithIndustry[0];
                          const totalFromIndustry = topDonorsWithIndustry
                            .filter(d => d.industry === topDonor.industry)
                            .reduce((s, d) => s + d.amount, 0);
                          Share.share({
                            message: `${displayName} received $${totalFromIndustry.toLocaleString('en-AU')} from ${topDonor.industry}. See how they voted on related legislation.\n\nTrack every MP's donors and votes on Verity — verity.run`,
                          });
                        }}
                      >
                        <Ionicons name="share-outline" size={16} color="#00843D" />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#00843D' }}>Share this analysis</Text>
                      </Pressable>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16, marginTop: 4, paddingHorizontal: 8 }}>
                        Correlation between donations and votes does not imply causation. All data from AEC declarations and APH voting records.
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* ── Registered Interests ── */}
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: '700', color: colors.text, marginBottom: SPACING.md }}>Registered Interests</Text>
              <View style={{ marginBottom: SPACING.xl }}>
                {interestsLoading ? (
                  [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={10} style={{ marginBottom: 10 }} />)
                ) : allInterests.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm }}>
                    <Ionicons name="document-text-outline" size={28} color={colors.borderStrong} />
                    <Text style={{ fontSize: FONT_SIZE.small + 1, fontWeight: '600', color: colors.textMuted }}>No registered interests on file.</Text>
                    <Text style={{ fontSize: FONT_SIZE.small - 1, textAlign: 'center', lineHeight: 17, paddingHorizontal: SPACING.sm, color: colors.textMuted }}>
                      {member.chamber === 'house'
                        ? 'House of Representatives interest data is sourced from PDF registers and is not yet available for this member.'
                        : 'Interest declarations will appear once filed with the Senate.'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: SPACING.md }}>
                      Declared Financial Interests ({allInterests.length})
                    </Text>
                    {Object.entries(interestsGrouped).map(([category, items]) => (
                      <View key={category} style={{ marginBottom: SPACING.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Ionicons
                            name={
                              category === 'Shareholdings' ? 'trending-up-outline' :
                              category === 'Real Estate' ? 'home-outline' :
                              category === 'Gifts' ? 'gift-outline' :
                              category === 'Directorships' ? 'briefcase-outline' :
                              category === 'Sponsored Travel & Hospitality' ? 'airplane-outline' :
                              category === 'Family & Business Trusts' ? 'people-outline' :
                              category === 'Liabilities' ? 'card-outline' :
                              category === 'Other Income Sources' ? 'cash-outline' :
                              'document-outline'
                            }
                            size={15}
                            color={colors.green}
                          />
                          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: '600', color: colors.text }}>
                            {category} ({items.length})
                          </Text>
                        </View>
                        {items.map(item => (
                          <View key={item.id} style={{ borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.md + 2, marginBottom: 6, backgroundColor: colors.card, ...SHADOWS.sm }}>
                            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, lineHeight: 18 }}>
                              {decodeHtml(item.description)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                    {allInterests[0]?.source_url && (
                      <Pressable onPress={() => Linking.openURL(allInterests[0].source_url!)} accessibilityRole="button" accessibilityLabel="View Senate Register of Interests source">
                        <Text style={{ fontSize: FONT_SIZE.caption, marginTop: SPACING.lg, textAlign: 'center', color: colors.green }}>
                          Source: Senate Register of Interests
                        </Text>
                      </Pressable>
                    )}
                    {allInterests[0]?.date_registered && (
                      <Text style={{ fontSize: FONT_SIZE.caption, textAlign: 'center', color: colors.textMuted, marginTop: 4 }}>
                        Last updated: {allInterests[0].date_registered}
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* ── Demographics ── */}
              {demographics && member.electorate && (
                <>
                  <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: '700', color: colors.text, marginBottom: SPACING.md }}>
                    {member.electorate.name} Demographics
                  </Text>
                  <View style={{ marginBottom: SPACING.xl }}>
                    <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginBottom: SPACING.sm }}>Census 2021</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {demographics.median_household_income_weekly != null && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Median Household Income</Text>
                          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: '700', color: colors.text }}>${Math.round(demographics.median_household_income_weekly * 52).toLocaleString()}/yr</Text>
                        </View>
                      )}
                      {demographics.median_age != null && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Median Age</Text>
                          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: '700', color: colors.text }}>{demographics.median_age}</Text>
                        </View>
                      )}
                      {demographics.median_rent_weekly != null && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Median Rent</Text>
                          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: '700', color: colors.text }}>${demographics.median_rent_weekly}/wk</Text>
                        </View>
                      )}
                      {demographics.pct_renting != null && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Renters</Text>
                          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: '700', color: colors.text }}>{demographics.pct_renting}%</Text>
                        </View>
                      )}
                    </View>
                    {demographics.top_industries && demographics.top_industries.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginBottom: 4 }}>Top Industries</Text>
                        {demographics.top_industries.slice(0, 3).map((ind: any, idx: number) => (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.text }}>{ind.name}</Text>
                            </View>
                            <View style={{ backgroundColor: colors.green + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: '600', color: colors.green }}>{ind.pct}%</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* ── Government Contracts ── */}
              {contractSummary.contract_count > 0 && member.electorate && (
                <>
                  <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: '700', color: colors.text, marginBottom: SPACING.md }}>
                    Federal Contracts in {member.electorate.name}
                  </Text>
                  <View style={{ marginBottom: SPACING.xl }}>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, flex: 1 }}>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Total Value (30d)</Text>
                        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: '700', color: colors.text }}>
                          ${contractSummary.total_value >= 1000000
                            ? `${(contractSummary.total_value / 1000000).toFixed(1)}M`
                            : contractSummary.total_value >= 1000
                              ? `${(contractSummary.total_value / 1000).toFixed(0)}K`
                              : contractSummary.total_value.toLocaleString()}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, flex: 1 }}>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Contracts</Text>
                        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: '700', color: colors.text }}>{contractSummary.contract_count}</Text>
                      </View>
                    </View>
                    {contractSummary.top_agencies.length > 0 && (
                      <>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginBottom: 4 }}>Top Agencies</Text>
                        {contractSummary.top_agencies.slice(0, 3).map((a: any, idx: number) => (
                          <Text key={idx} style={{ fontSize: FONT_SIZE.caption, color: colors.textBody, marginBottom: 2 }}>
                            {a.agency} ({a.count})
                          </Text>
                        ))}
                      </>
                    )}
                    <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' }}>
                      Source: AusTender. Contracts linked by supplier postcode.
                    </Text>
                  </View>
                </>
              )}

              {/* ── Watchlist / Contradictions ── */}
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: '700', color: colors.text, marginBottom: SPACING.md }}>Watchlist</Text>
              <View style={{ marginBottom: SPACING.xl }}>
                {contradictionsLoading ? (
                  [1, 2, 3].map(i => <SkeletonLoader key={i} height={100} borderRadius={14} style={{ marginBottom: 10 }} />)
                ) : contradictions.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm }}>
                    <Ionicons name="shield-checkmark-outline" size={28} color={colors.borderStrong} />
                    <Text style={{ fontSize: FONT_SIZE.small + 1, fontWeight: '600', color: colors.textMuted }}>No contradictions found</Text>
                    <Text style={{ fontSize: FONT_SIZE.small - 1, textAlign: 'center', lineHeight: 17, paddingHorizontal: SPACING.sm, color: colors.textMuted }}>
                      Verity monitors this MP's statements against their parliamentary record.
                    </Text>
                  </View>
                ) : (
                  contradictions.map(c => (
                    <ContradictionCard
                      key={c.id}
                      contradiction={c}
                      onPress={(id) => navigation.navigate('ContradictionDetail', { contradictionId: id })}
                    />
                  ))
                )}
              </View>

            </>
          )}
        </View>
      </ScrollView>

      {/* Hidden share card containers — offscreen, captured by react-native-view-shot */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={voteCardRef}>
          {shareVoteData && (
            <VoteShareCard
              mpName={displayName}
              mpPhotoUrl={member.photo_url}
              partyName={party?.short_name || party?.name || ''}
              partyColour={partyColour}
              divisionName={cleanDivisionTitle(shareVoteData.division?.name || '')}
              voteCast={shareVoteData.vote_cast}
              date={shareVoteData.division?.date ?? null}
            />
          )}
        </View>
        <View ref={reportCardRef}>
          {shareReport && (
            <MPReportShareCard
              mpName={displayName}
              mpPhotoUrl={member.photo_url}
              partyName={party?.short_name || party?.name || ''}
              partyColour={partyColour}
              electorateName={member.electorate?.name ?? null}
              accountabilityScore={accountabilityScore.overall}
              attendance={accountabilityScore.attendance}
              totalVotes={totalVotes}
              speeches={hansardEntries.length}
              partyLoyalty={totalVotes > 0 ? Math.round(((totalVotes - votes.filter(v => v.rebelled).length) / totalVotes) * 100) : 0}
              topDonors={Array.from(
                indDonations.reduce((acc, d) => {
                  acc.set(d.donor_name, (acc.get(d.donor_name) ?? 0) + Number(d.amount));
                  return acc;
                }, new Map<string, number>())
              ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, amount]) => ({ name, amount }))}
            />
          )}
        </View>
      </View>


      {/* Methodology Modal */}
      <Modal visible={showMethodology} transparent animationType="slide" onRequestClose={() => setShowMethodology(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setShowMethodology(false)}
          accessibilityRole="button"
          accessibilityLabel="Close methodology"
        >
          <Pressable
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' }}
            onPress={e => e.stopPropagation()}
            accessibilityRole="button"
            accessibilityLabel="Methodology content"
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Methodology</Text>
              <Pressable onPress={() => setShowMethodology(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close methodology">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>What we measure</Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 14 }}>
                The Verity Participation Index tracks four separate dimensions of parliamentary behaviour from public APH division records, Hansard transcripts, and committee listings. We report each dimension independently rather than collapsing them into a single number. A single composite score would hide editorial choices inside a weighted formula, so we don't use one.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>The four dimensions</Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 6 }}>
                <Text style={{ fontWeight: '600' }}>Attendance</Text> — percentage of recorded divisions where the MP voted aye or no. Abstentions and absences lower this number. Paired absences (formal agreements with an opposition MP) are excluded from the denominator.
              </Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 6 }}>
                <Text style={{ fontWeight: '600' }}>Activity</Text> — count of Hansard-recorded speeches and questions. Note: senior ministers typically give fewer speeches because they run departments.
              </Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 6 }}>
                <Text style={{ fontWeight: '600' }}>Independence</Text> — percentage of substantive votes where the MP crossed the floor (voted against party majority). Independence can reflect conscience or grandstanding — the number alone can't tell you which.
              </Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 14 }}>
                <Text style={{ fontWeight: '600' }}>Committees</Text> — current committee memberships. Chair and deputy-chair roles are flagged because committee work is radically undervalued in most public political coverage.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>What we don't measure</Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 14 }}>
                Party room decisions, cabinet deliberations, constituency casework, and private policy negotiation. Approximately 85% of political work happens outside the chamber and is not publicly recorded.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Confidence</Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 14 }}>
                MPs with fewer than 20 recorded votes are flagged as low sample. Their numbers will shift materially as more data accrues. Treat early-term MPs with wider error bars.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Data sources</Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 14 }}>
                Australian Parliament House division records (aph.gov.au), Hansard transcripts via OpenAustralia, committee listings from APH. All underlying data is public.
              </Text>

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>Changelog</Text>
              <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 14 }}>
                April 2026 — v1: Replaced composite "Accountability Score" with four separate dimensions following methodology review. Added low-sample flag. Added "what we can't see" disclosure.
              </Text>

              <Pressable onPress={() => Linking.openURL('https://verity.run/methodology')} accessibilityRole="button" accessibilityLabel="Read the full methodology page">
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D', marginTop: 8 }}>
                  Read the full methodology page →
                </Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}
