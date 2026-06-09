import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { VoteShareCard, HypocrisyShareCard } from '../components/ShareCards';
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
import { getIndustryLabel, getIndustryColor } from '../constants/industryColors';
import { useContradictions } from '../hooks/useContradictions';
import { useHypocrisyIndex } from '../hooks/useHypocrisyIndex';
import { useDonationVoteLinks } from '../hooks/useDonationVoteLinks';
import { useVoteMoneySummary } from '../hooks/useVoteMoneyLinks';
import { VoteMoneyCard } from '../components/VoteMoneyCard';
import { useRepresentationGap } from '../hooks/useRepresentationGap';
import { RepresentationGapCard } from '../components/RepresentationGapCard';
import { useDecisiveVotes } from '../hooks/useDecisiveVotes';
import { DecisiveVotesCard } from '../components/DecisiveVotesCard';
import { ContradictionCard } from '../components/ContradictionCard';
import { RebellionCard } from '../components/RebellionCard';
import { useElectorateDemographics } from '../hooks/useElectorateDemographics';
import { useGovernmentContracts } from '../hooks/useGovernmentContracts';
import { spacing, radius, elevation, colors as tokenColors } from '../theme/tokens';
import { PressableScale, AppText } from '../components/ui';
import { supabase } from '../lib/supabase';
import { findBillIdForDivision } from '../lib/divisionToBill';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { useVotePrediction } from '../hooks/useVotePrediction';
import { GuessReveal } from '../components/GuessReveal';
import { useCivicEvents } from '../hooks/useCivicEvents';
import { useMPDiscourse } from '../hooks/usePublicSentiment';
import { useStatsMetrics, findMetric } from '../hooks/useStatsMetrics';
import { MPReceiptCard } from '../components/MPReceiptCard';

const PROCEDURAL_PREFIXES = ['Business —', 'Motions —', 'Procedure', 'Adjournment', 'Business of the Senate', 'Business of the House'];

function cleanDivisionTitle(name: string): string {
  return name.replace(/^Bills?\s*[—\-]\s*/i, '').trim();
}

function isProcedural(name: string): boolean {
  return PROCEDURAL_PREFIXES.some(p => name.startsWith(p));
}

const DONATION_VOTE_KEYWORDS: Record<string, string[]> = {
  mining: ['mining', 'mineral', 'resources', 'coal', 'gas', 'petroleum', 'offshore'],
  property: ['housing', 'property', 'construction', 'planning', 'building', 'rent', 'home'],
  finance: ['banking', 'financial', 'credit', 'superannuation', 'insurance', 'prudential'],
  unions: ['workplace', 'industrial', 'fair work', 'employment', 'worker', 'bargaining'],
  pharmacy: ['health', 'medical', 'pharmaceutical', 'therapeutic', 'medicare', 'hospital'],
  health: ['health', 'medical', 'hospital', 'medicare'],
  tech: ['technology', 'digital', 'cyber', 'data', 'telecom', 'broadband', 'online'],
  telecom: ['technology', 'digital', 'telecom', 'broadband', 'online'],
  energy: ['energy', 'electricity', 'renewable', 'emissions', 'carbon', 'climate'],
  fossil_fuels: ['energy', 'gas', 'petroleum', 'offshore', 'emissions'],
  agriculture: ['agriculture', 'farm', 'rural', 'water', 'drought', 'biosecurity'],
  gambling: ['gambling', 'wagering', 'gaming', 'betting'],
  media: ['media', 'broadcast', 'press', 'journalism'],
  defence: ['defence', 'military', 'security', 'veteran'],
  transport: ['transport', 'aviation', 'shipping', 'freight', 'infrastructure'],
  education: ['education', 'university', 'school', 'training'],
  retail: ['consumer', 'retail', 'competition'],
};

type TabId = 'overview' | 'votes' | 'speeches' | 'more';

export function MemberProfileScreen({ route, navigation }: any) {
  const { member: memberParam, memberId } = (route.params ?? {}) as { member?: Member; memberId?: string };
  const [member, setMember] = useState<Member | null>(memberParam ?? null);
  const [memberFailed, setMemberFailed] = useState(!memberParam && !memberId);

  useEffect(() => {
    if (!member && memberId) {
      (async () => {
        try {
          const { data } = await supabase
            .from('members')
            .select('*, party:parties!members_party_id_fkey(name,short_name,colour,abbreviation), electorate:electorates!members_electorate_id_fkey(name,state)')
            .eq('id', memberId)
            .maybeSingle();
          if (data) setMember(data as Member);
          else setMemberFailed(true);
        } catch {
          setMemberFailed(true);
        }
      })();
    }
  }, [memberId]);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [fundingView, setFundingView] = useState<'party' | 'personal'>('party');
  const [visibleCount, setVisibleCount] = useState(20);
  const [showMethodology, setShowMethodology] = useState(false);
  const { votes, loading: votesLoading } = useVotes(member?.id ?? null);
  const { data: hypocrisyData, loading: hypocrisyLoading } = useHypocrisyIndex(member?.id ?? null);
  // 'More'-tab hooks are gated on the active tab so opening a profile doesn't fan out 16 queries
  const { links: moneyVoteLinks } = useDonationVoteLinks(activeTab === 'more' ? member?.id ?? null : null);
  const { summary: voteMoneyData, loading: voteMoneyLoading } = useVoteMoneySummary(member?.id);
  const { records: repGapRecords } = useRepresentationGap(activeTab === 'votes' ? member?.id : undefined);
  const { votes: decisiveVotes, winningCount: decisiveWinning } = useDecisiveVotes(activeTab === 'votes' ? member?.id : undefined);
  const { data: discourseData, updatedAt: discourseUpdatedAt } = useMPDiscourse(member?.id);
  const { mpStats } = useStatsMetrics(member?.id, member?.electorate_id ?? undefined);

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
  const { grouped: interestsGrouped, interests: allInterests, loading: interestsLoading } = useRegisteredInterests(activeTab === 'more' ? member?.id : undefined);
  const { contradictions, loading: contradictionsLoading } = useContradictions({ memberId: activeTab === 'more' ? member?.id : undefined });
  const { demographics } = useElectorateDemographics(activeTab === 'more' ? member?.electorate_id ?? undefined : undefined);
  const { summary: contractSummary } = useGovernmentContracts(activeTab === 'more' ? member?.electorate_id ?? undefined : undefined);

  const party = member?.party;
  const partyColour = party?.colour || tokenColors.textMuted;
  const displayName = member ? `${member.first_name} ${member.last_name}` : '';

  const ayeCount = votes.filter(v => v.vote_cast === 'aye').length;
  const totalVotes = votes.length;
  const accountabilityScore = useAccountabilityScore(votes, hansardEntries, committees, party?.name);
  const participationIndex = useParticipationIndex(votes, hansardEntries, committees);
  const { guess: submitGuess, hasGuessed, accuracy: predictionAccuracy } = useVotePrediction(member?.id ?? null);
  const { log: logCivicEvent } = useCivicEvents();
  const [guessExpandedId, setGuessExpandedId] = useState<string | null>(null);

  // Share cards
  const voteCardRef = useRef<any>(null);
  const reportCardRef = useRef<any>(null);
  const hypocrisyCardRef = useRef<any>(null);
  const [shareVoteData, setShareVoteData] = useState<DivisionVote | null>(null);
  const [shareReport, setShareReport] = useState(false);
  const [shareReceipt, setShareReceipt] = useState(false);
  const receiptRef = useRef<any>(null);
  const [shareHypocrisy, setShareHypocrisy] = useState(false);

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

  useEffect(() => {
    if (shareReceipt && member) {
      captureAndShare(receiptRef, 'receipt', member.id, user?.id)
        .finally(() => setShareReceipt(false));
    }
  }, [shareReceipt]);

  useEffect(() => {
    if (shareHypocrisy && member) {
      captureAndShare(hypocrisyCardRef, 'hypocrisy_index', member.id, user?.id)
        .finally(() => setShareHypocrisy(false));
    }
  }, [shareHypocrisy]);

  // Top donors for report card
  const topDonors = useMemo(() => Array.from(
    indDonations.reduce((acc, d) => {
      acc.set(d.donor_name, (acc.get(d.donor_name) ?? 0) + Number(d.amount));
      return acc;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name), [indDonations]);

  const rebelVotes = useMemo(() => votes.filter(v => v.rebelled), [votes]);

  // Donation-vs-voting analysis (heavy: scans all votes per donor industry)
  const donationVoteAnalysis = useMemo(() => {
    const donorSource = indDonations.length > 0 ? indDonations : donations;
    const donorAgg = new Map<string, { amount: number; industry: string | null }>();
    for (const d of donorSource) {
      const existing = donorAgg.get(d.donor_name);
      donorAgg.set(d.donor_name, {
        amount: (existing?.amount ?? 0) + Number(d.amount),
        industry: d.industry ?? existing?.industry ?? null,
      });
    }
    const topDonorsWithIndustry = Array.from(donorAgg.entries())
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5)
      .map(([name, { amount, industry }]) => ({ name, amount, industry }))
      .filter(d => d.industry && d.industry !== 'individual' && d.industry !== 'unidentified');

    if (topDonorsWithIndustry.length === 0) return null;

    const industryVotes: Record<string, { aye: number; no: number }> = {};
    for (const donor of topDonorsWithIndustry) {
      if (!donor.industry || industryVotes[donor.industry]) continue;
      const keywords = DONATION_VOTE_KEYWORDS[donor.industry] || [];
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
    return { topDonorsWithIndustry, industryVotes };
  }, [indDonations, donations, votes]);

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
  const recentVotes = useMemo(() => votes
    .filter(v => !isProcedural(v.division?.name || ''))
    .slice(0, 3), [votes]);

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'votes', label: 'Votes' },
    { id: 'speeches', label: 'Speeches' },
    { id: 'more', label: 'More' },
  ];

  if (!member) {
    if (memberFailed) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="person-circle-outline" size={40} color={colors.textMuted} />
          <AppText variant="heading" style={{ marginTop: spacing.md }}>MP not found</AppText>
          <AppText variant="body" color="textMuted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
            This profile couldn't be loaded. It may have been removed or the link is out of date.
          </AppText>
          <PressableScale onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Go back" style={{ marginTop: spacing.lg }}>
            <AppText variant="body" style={{ color: tokenColors.accent, fontWeight: '600' }}>Go back</AppText>
          </PressableScale>
        </SafeAreaView>
      );
    }
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
                    .select('*, party:parties!members_party_id_fkey(name,short_name,colour,abbreviation), electorate:electorates!members_electorate_id_fkey(name,state)')
                    .eq('id', memberId)
                    .maybeSingle();
                  if (data) setMember(data as Member);
                } catch {}
              }
            }}
            tintColor={tokenColors.accent}
          />
        }
      >
        {/* ───── 1. HERO HEADER ───── */}
        <View style={{ backgroundColor: partyColour + '1A', paddingBottom: spacing.xxl }}>
          {/* Nav: back + share/bookmark */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
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
                onPress={() => setShareReceipt(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Share MP receipt"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="receipt-outline" size={18} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Avatar — 120px circle, white border, shadow */}
          <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
            <View style={{
              width: 120, height: 120, borderRadius: 60,
              borderWidth: 3, borderColor: '#FFFFFF',
              overflow: 'hidden',
              ...elevation.md,
            }}>
              {member.photo_url ? (
                <Image source={{ uri: member.photo_url }} style={{ width: 120, height: 120 }} contentFit="cover" accessibilityLabel={`Photo of ${displayName}`} />
              ) : (
                <View style={{ width: 120, height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: partyColour + '33' }}>
                  <AppText variant="display" style={{ color: partyColour }}>
                    {member.first_name[0]}{member.last_name[0]}
                  </AppText>
                </View>
              )}
            </View>

            {/* Name in H1 */}
            <AppText variant="title" style={{ color: colors.text, marginTop: spacing.lg, textAlign: 'center' }}>{displayName}</AppText>

            {/* Party + electorate in Caption */}
            <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
              {party?.short_name || party?.name || ''}{member.electorate ? ` · ${member.electorate.name}` : ''}{member.electorate?.state ? ` · ${member.electorate.state}` : ''}
            </AppText>

            {/* Ministerial role as green badge */}
            {member.ministerial_role && (
              <View style={{
                backgroundColor: tokenColors.success + '1A',
                borderRadius: 6,
                paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                marginTop: spacing.sm,
              }}>
                <AppText variant="caption" style={{ color: tokenColors.success, fontWeight: '600' }}>
                  {member.ministerial_role}
                </AppText>
              </View>
            )}
          </View>

          {/* ───── STATS ROW — horizontal pill badges ───── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing.xl }}
          >
            <View style={{ backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' }}>
              <AppText variant="body" style={{ fontWeight: '600' }} tabular>{totalVotes}</AppText>
              <AppText variant="caption" color="textMuted">Votes</AppText>
            </View>
            <View style={{ backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' }}>
              <AppText variant="body" style={{ fontWeight: '600' }} tabular>{hansardEntries.length}</AppText>
              <AppText variant="caption" color="textMuted">Speeches</AppText>
            </View>
            <View style={{ backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' }}>
              <AppText variant="body" style={{ fontWeight: '600' }} tabular>{committees.length}</AppText>
              <AppText variant="caption" color="textMuted">Committees</AppText>
            </View>
            {participationIndex.independenceRate > 0 && (
              <View style={{ backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: 'center' }}>
                <AppText variant="body" style={{ fontWeight: '600' }} tabular>{participationIndex.independenceRate}%</AppText>
                <AppText variant="caption" color="textMuted">Rebellion</AppText>
              </View>
            )}
          </ScrollView>
        </View>

        {/* ───── 2. PRIMARY CTA ROW ───── */}
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md, backgroundColor: colors.background }}>
          <PressableScale
            onPress={() => requireAuth('follow this MP', toggleFollow)}
            accessibilityRole="button"
            accessibilityLabel={followingMP ? `Unfollow ${displayName}` : `Follow ${displayName}`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: followingMP ? '#006B31' : tokenColors.accent,
              borderRadius: radius.pill,
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons name={followingMP ? 'eye' : 'eye-outline'} size={16} color={tokenColors.textInverse} />
            <AppText variant="label" style={{ color: tokenColors.textInverse }}>
              {followingMP ? 'Watching' : 'Watch'}
            </AppText>
          </PressableScale>
          <PressableScale
            onPress={() => requireAuth('write to your MP', () => navigation.navigate('WriteToMP', { member }))}
            accessibilityRole="button"
            accessibilityLabel={`Write to ${member.first_name}`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: colors.background,
              borderRadius: radius.pill,
              paddingVertical: spacing.md,
              borderWidth: 1.5,
              borderColor: tokenColors.accent,
            }}
          >
            <Ionicons name="mail-outline" size={16} color={tokenColors.accent} />
            <AppText variant="label" style={{ color: tokenColors.accent }}>
              Write to {member.first_name}
            </AppText>
          </PressableScale>
          <PressableScale
            onPress={() => navigation.navigate('MatchResult', { memberId: member.id })}
            accessibilityRole="button"
            accessibilityLabel={`Match with ${member.first_name}`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: colors.background,
              borderRadius: radius.pill,
              paddingVertical: spacing.md,
              borderWidth: 1.5,
              borderColor: tokenColors.accent,
            }}
          >
            <Ionicons name="git-compare-outline" size={16} color={tokenColors.accent} />
            <AppText variant="label" style={{ color: tokenColors.accent }}>
              Match
            </AppText>
          </PressableScale>
        </View>

        {/* ───── 3. PARTICIPATION INDEX SECTION ───── */}
        {!votesLoading && (
          <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <AppText variant="heading" style={{ color: colors.text }}>Participation Index</AppText>
              <PressableScale onPress={handleShareParticipation} accessibilityRole="button" accessibilityLabel="Share participation index" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Ionicons name="share-outline" size={16} color={tokenColors.accent} />
                <AppText variant="label" style={{ color: tokenColors.accent }}>Share</AppText>
              </PressableScale>
            </View>
            <AppText variant="caption" color="textMuted" style={{ marginBottom: spacing.lg }}>
              Parliamentary participation from public APH records. Not a judgment of effectiveness or virtue.
            </AppText>

            {/* ───── 4. CONTEXT CARD ───── */}
            {isMinisterOrChair && (
              <View style={{ backgroundColor: tokenColors.accentMuted, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, flexDirection: 'row', gap: spacing.sm }}>
                <Ionicons name="briefcase-outline" size={16} color={tokenColors.accent} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <AppText variant="label" style={{ color: tokenColors.accent, marginBottom: spacing.xs }}>
                    {member.ministerial_role ? 'Read these numbers with ministerial context' : 'Committee leadership context'}
                  </AppText>
                  <AppText variant="caption" style={{ color: tokenColors.accent }}>
                    {member.ministerial_role
                      ? `${member.first_name} runs a department as ${member.ministerial_role}. Ministers typically give fewer speeches and can miss divisions for cabinet duties. Their "party loyalty" is structural, not voluntary.`
                      : `${member.first_name} chairs ${participationIndex.chairCount} committee${participationIndex.chairCount !== 1 ? 's' : ''}. Committee chairs spend significant time in hearings and inquiries rather than the main chamber.`
                    }
                  </AppText>
                </View>
              </View>
            )}

            {/* Low sample warning */}
            {participationIndex.isLowSample && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: tokenColors.warning + '1A', borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md }}>
                <Ionicons name="information-circle" size={14} color={tokenColors.warning} />
                <AppText variant="caption" style={{ flex: 1, color: tokenColors.warning }}>
                  Small sample ({participationIndex.totalVotes} votes) — these numbers will change as more data is recorded.
                </AppText>
              </View>
            )}

            {/* ───── 5. FOUR STAT CARDS (2x2) ───── */}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.md, padding: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                  <Ionicons name="checkmark-done-outline" size={12} color={tokenColors.textMuted} />
                  <AppText variant="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Attendance</AppText>
                </View>
                <AppText variant="display" tabular style={{ color: colors.text }}>{participationIndex.attendanceRate}%</AppText>
                <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>of {participationIndex.totalVotes} recorded votes</AppText>
              </View>
              <View style={{ flex: 1, backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.md, padding: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                  <Ionicons name="mic-outline" size={12} color={tokenColors.textMuted} />
                  <AppText variant="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Activity</AppText>
                </View>
                <AppText variant="display" tabular style={{ color: colors.text }}>{participationIndex.parliamentaryActivity}</AppText>
                <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>{participationIndex.speechesCount} speeches · {participationIndex.questionsCount} questions</AppText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.md, padding: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                  <Ionicons name="git-branch-outline" size={12} color={tokenColors.textMuted} />
                  <AppText variant="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Independence</AppText>
                </View>
                <AppText variant="display" tabular style={{ color: colors.text }}>{participationIndex.independenceRate}%</AppText>
                <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>{participationIndex.rebelVotes === 1 ? 'crossed floor once' : `crossed floor ${participationIndex.rebelVotes} times`}</AppText>
              </View>
              <View style={{ flex: 1, backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.md, padding: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                  <Ionicons name="people-outline" size={12} color={tokenColors.textMuted} />
                  <AppText variant="caption" color="textMuted" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Committees</AppText>
                </View>
                <AppText variant="display" tabular style={{ color: colors.text }}>{participationIndex.committeeCount}</AppText>
                <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>{participationIndex.chairCount > 0 ? `${participationIndex.chairCount} as chair/deputy` : 'member roles'}</AppText>
              </View>
            </View>

            {/* ───── 6. METHODOLOGY FOOTER BAR ───── */}
            <PressableScale
              onPress={() => setShowMethodology(true)}
              accessibilityRole="button"
              accessibilityLabel="View methodology"
              style={{ backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <AppText variant="caption" color="textMuted">Methodology v1.0 · Wilson 95% CI</AppText>
              <AppText variant="caption" style={{ color: tokenColors.accent }}>How we calculate →</AppText>
            </PressableScale>
          </View>
        )}

        {/* ───── 6b. REBELLION CARD ───── */}
        {!votesLoading && member && party && (
          <RebellionCard
            memberId={member.id}
            memberName={displayName}
            partyName={party.short_name || party.name}
            userId={user?.id}
            onPressRebellion={async (divisionId) => {
              // Divisions aren't bills — resolve to the actual bill before navigating
              const billId = await findBillIdForDivision(divisionId);
              if (billId) navigation.navigate('BillDetail', { billId });
            }}
          />
        )}

        {/* ───── 7. TAB BAR ───── */}
        <View style={{ borderBottomWidth: 0.5, borderBottomColor: tokenColors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
            {TABS.map(tab => (
              <PressableScale
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                accessibilityRole="button"
                accessibilityLabel={`${tab.label} tab`}
                style={{
                  height: 48,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.lg,
                  borderBottomWidth: activeTab === tab.id ? 3 : 0,
                  borderBottomColor: activeTab === tab.id ? tokenColors.success : 'transparent',
                }}
              >
                <AppText variant="label" style={{ color: activeTab === tab.id ? tokenColors.success : tokenColors.textMuted }}>
                  {tab.label}
                </AppText>
              </PressableScale>
            ))}
          </ScrollView>
        </View>

        {/* ───── TAB CONTENT ───── */}
        <View style={{ padding: spacing.xl }}>

          {/* ═══════ OVERVIEW TAB ═══════ */}
          {activeTab === 'overview' && (
            <>
              {/* ───── 8. RECENT VOTES SECTION ───── */}
              <View style={{ marginBottom: spacing.xl }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <AppText variant="heading" style={{ color: colors.text }}>Recent votes</AppText>
                  <PressableScale onPress={() => setActiveTab('votes')} accessibilityRole="button" accessibilityLabel={`View all ${totalVotes} votes`}>
                    <AppText variant="label" tabular style={{ color: tokenColors.accent }}>All {totalVotes} →</AppText>
                  </PressableScale>
                </View>

                {votesLoading ? (
                  [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={16} style={{ marginBottom: 8 }} />)
                ) : recentVotes.length === 0 ? (
                  <AppText variant="label" style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl }}>No recent votes recorded.</AppText>
                ) : (
                  <View style={{ backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.md, overflow: 'hidden' }}>
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
                            paddingHorizontal: spacing.lg,
                            paddingVertical: spacing.md,
                            borderBottomWidth: idx < recentVotes.length - 1 ? 0.5 : 0,
                            borderBottomColor: tokenColors.border,
                          }}
                        >
                          <View style={{ flex: 1, marginRight: spacing.md }}>
                            <AppText variant="callout" style={{ color: colors.text }} numberOfLines={2}>{title}</AppText>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                              <AppText variant="caption" color="textMuted">
                                {v.division?.date ? timeAgo(v.division.date) : ''}
                              </AppText>
                              {v.rebelled && (
                                <AppText variant="caption" style={{ color: tokenColors.warning, backgroundColor: tokenColors.warning + '1A', borderRadius: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 1 }}>Crossed floor</AppText>
                              )}
                            </View>
                          </View>
                          <View style={{
                            backgroundColor: isAye ? tokenColors.success + '1A' : isNo ? tokenColors.danger + '1A' : tokenColors.surfaceMuted,
                            borderRadius: radius.sm,
                            paddingHorizontal: spacing.sm,
                            paddingVertical: spacing.xs,
                          }}>
                            <AppText variant="caption" tabular style={{
                              fontWeight: '700',
                              color: isAye ? tokenColors.success : isNo ? tokenColors.danger : colors.textMuted,
                            }}>
                              {isAye ? 'Aye' : isNo ? 'No' : v.vote_cast || '\u2014'}
                            </AppText>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>


              {/* ───── HYPOCRISY INDEX ───── */}
              {hypocrisyLoading ? (
                <View style={{ marginBottom: spacing.xl }}>
                  <SkeletonLoader height={200} borderRadius={16} />
                </View>
              ) : hypocrisyData?.status === 'scored' ? (
                <View style={{ marginBottom: spacing.xl }}>
                  <View style={{
                    backgroundColor: colors.card, borderRadius: radius.md,
                    overflow: 'hidden', ...elevation.sm,
                  }}>
                    {/* Section header */}
                    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <AppText variant="caption" style={{ color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Consistency Index</AppText>
                      </View>
                      <Pressable onPress={() => setShareHypocrisy(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share Consistency Index">
                        <Ionicons name="share-outline" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>

                    <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                      {/* Score */}
                      <AppText variant="display" tabular style={{
                        fontSize: 48, lineHeight: 52,
                        color: (hypocrisyData.overall_score ?? 0) > 66 ? tokenColors.danger : (hypocrisyData.overall_score ?? 0) > 33 ? tokenColors.warning : tokenColors.success,
                      }}>
                        {hypocrisyData.overall_score}
                      </AppText>
                      <AppText variant="caption" tabular style={{ color: colors.textMuted, marginBottom: spacing.md }}>
                        #{hypocrisyData.rank_among_mps} of {hypocrisyData.total_mps_scored} MPs
                      </AppText>

                      {/* Top 3 topics */}
                      {(hypocrisyData.top_topics ?? []).slice(0, 3).map((topic, i) => (
                        <View key={topic.policy_id ?? i} style={{ width: '100%', marginBottom: spacing.md }}>
                          {/* Topic pill */}
                          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
                            <View style={{ backgroundColor: '#FCE4EC', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#C2185B' }}>{topic.policy_name}</Text>
                            </View>
                          </View>

                          {/* Position bar */}
                          <View style={{ marginVertical: 4 }}>
                            <View style={{ height: 6, backgroundColor: tokenColors.surfaceMuted, borderRadius: 3, position: 'relative' }}>
                              <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: tokenColors.borderStrong }} />
                              <View style={{
                                position: 'absolute', left: `${(((topic.stated_position ?? 0) + 1) / 2) * 100}%`,
                                top: -4, width: 12, height: 12, borderRadius: 6,
                                backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#fff', marginLeft: -6,
                              }} />
                              <View style={{
                                position: 'absolute', left: `${(((topic.voting_position ?? 0) + 1) / 2) * 100}%`,
                                top: -4, width: 12, height: 12, borderRadius: 6,
                                backgroundColor: tokenColors.danger, borderWidth: 2, borderColor: '#fff', marginLeft: -6,
                              }} />
                            </View>
                            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 6 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB' }} />
                                <Text style={{ fontSize: 9, color: tokenColors.textMuted }}>Said</Text>
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tokenColors.danger }} />
                                <Text style={{ fontSize: 9, color: tokenColors.textMuted }}>Voted</Text>
                              </View>
                            </View>
                          </View>

                          {/* They said */}
                          {topic.speech_excerpt && (
                            <View style={{ backgroundColor: '#FFF0D6', borderRadius: 8, padding: 10, marginTop: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400E', marginBottom: 2 }}>They said:</Text>
                              <Text style={{ fontSize: 12, fontStyle: 'italic', color: '#1F2937', lineHeight: 18 }} numberOfLines={2}>
                                "{decodeHtml(topic.speech_excerpt)}"
                              </Text>
                            </View>
                          )}

                          {/* They voted */}
                          {topic.example_vote && (
                            <View style={{ backgroundColor: tokenColors.surfaceMuted, borderRadius: 8, padding: 10, marginTop: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: tokenColors.textMuted, marginBottom: 2 }}>They voted:</Text>
                              <Text style={{ fontSize: 12, color: tokenColors.textPrimary, lineHeight: 18 }} numberOfLines={2}>
                                {topic.example_vote.division_name}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <View style={{
                                  backgroundColor: topic.example_vote.vote === 'aye' ? tokenColors.accentMuted : topic.example_vote.vote === 'no' ? tokenColors.danger + '18' : tokenColors.surfaceMuted,
                                  borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2,
                                }}>
                                  <Text style={{
                                    fontSize: 11, fontWeight: '700',
                                    color: topic.example_vote.vote === 'aye' ? tokenColors.success : topic.example_vote.vote === 'no' ? tokenColors.danger : tokenColors.textMuted,
                                  }}>
                                    {topic.example_vote.vote === 'aye' ? 'Aye' : topic.example_vote.vote === 'no' ? 'No' : topic.example_vote.vote}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 10, color: tokenColors.textMuted }}>{topic.example_vote.date}</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      ))}

                      {/* See full breakdown */}
                      <PressableScale
                        onPress={() => navigation.navigate('HypocrisyDetail', { memberId: member!.id, memberName: `${member!.first_name} ${member!.last_name}` })}
                        style={{
                          backgroundColor: tokenColors.accent, borderRadius: radius.pill, paddingHorizontal: spacing.xl,
                          paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm,
                        }}
                        accessibilityRole="button"
                      >
                        <AppText variant="label" style={{ color: tokenColors.onAccent }}>See full breakdown</AppText>
                        <Ionicons name="arrow-forward" size={16} color={tokenColors.onAccent} />
                      </PressableScale>
                    </View>
                  </View>
                </View>
              ) : hypocrisyData?.status === 'insufficient_data' ? (
                <View style={{ marginBottom: spacing.xl }}>
                  <View style={{
                    backgroundColor: colors.card, borderRadius: radius.md,
                    padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    ...elevation.sm,
                  }}>
                    <Ionicons name="analytics-outline" size={20} color={colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Consistency Index</Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                        Not enough data yet. {hypocrisyData.speeches_classified ?? 0} speeches classified, {hypocrisyData.votes_linked ?? 0} votes linked.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* ───── 8b. VOTE × MONEY CARD ───── */}
              <VoteMoneyCard
                summary={voteMoneyData}
                loading={voteMoneyLoading}
                memberFirstName={member?.first_name || ''}
              />

              {/* ───── 9. SECONDARY CHIPS ROW ───── */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl }}>
                <PressableScale
                  onPress={() => setShowMethodology(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Read methodology"
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: tokenColors.accentMuted, borderRadius: radius.sm, paddingVertical: spacing.md }}
                >
                  <Ionicons name="book-outline" size={15} color={tokenColors.accent} />
                  <AppText variant="label" style={{ color: tokenColors.accent }}>Read methodology</AppText>
                </PressableScale>
              </View>

              {/* ───── 10. SOURCES FOOTER ───── */}
              <View style={{ backgroundColor: tokenColors.surfaceMuted, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg }}>
                <AppText variant="caption" color="textMuted">
                  Sources — Parliament of Australia · OpenAustralia · AEC
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
                  {votes[0]?.division?.date ? (
                    <>
                      <AppText variant="caption" color="textMuted">Latest vote {timeAgo(votes[0].division.date)}</AppText>
                      <AppText variant="caption" color="textMuted">·</AppText>
                    </>
                  ) : null}
                  <PressableScale onPress={() => Linking.openURL('mailto:corrections@verity.run')} accessibilityRole="button" accessibilityLabel="Report an issue via email">
                    <AppText variant="caption" style={{ color: tokenColors.accent }}>Report an issue</AppText>
                  </PressableScale>
                </View>
              </View>

              {/* ───── IN THE CONVERSATION (public discourse from /last30days) ───── */}
              {discourseData && discourseData.sentiment_summary && discourseData.best_takes?.length > 0 && (
                <View style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
                  <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>In the conversation</AppText>
                  <View style={{
                    backgroundColor: tokenColors.surface,
                    borderRadius: radius.md,
                    padding: spacing.lg,
                    ...elevation.sm,
                  }}>
                    {/* Top public reaction */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md }}>
                      <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: tokenColors.accentMuted, justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Ionicons name="chatbubbles-outline" size={16} color={tokenColors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, color: colors.text, fontStyle: 'italic', lineHeight: 21 }} numberOfLines={4}>
                          &ldquo;{decodeHtml(discourseData.best_takes[0])}&rdquo;
                        </Text>
                        {discourseData.sources_searched?.length > 0 && (
                          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: spacing.xs }}>
                            {discourseData.sources_searched.slice(0, 3).join(', ')}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Summary line */}
                    <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19 }} numberOfLines={3}>
                      {discourseData.sentiment_summary.slice(0, 200)}
                    </Text>

                    {/* Timestamp */}
                    {discourseUpdatedAt && (
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: spacing.sm }}>
                        Updated {timeAgo(discourseUpdatedAt)}
                      </Text>
                    )}
                  </View>
                </View>
              )}

            </>
          )}

          {/* ═══════ VOTES TAB ═══════ */}
          {activeTab === 'votes' && (
            <>
              {votesLoading ? (
                [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
              ) : votes.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md }}>
                  <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                  <AppText variant="heading" style={{ color: colors.text }}>No voting records yet</AppText>
                  <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center' }}>Votes will appear as division data is recorded.</Text>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: tokenColors.accentMuted, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md }}>
                    <Ionicons name="stats-chart" size={16} color={tokenColors.accent} />
                    <AppText variant="label" tabular style={{ color: colors.text }}>
                      Voted in {totalVotes} division{totalVotes !== 1 ? 's' : ''}{totalVotes > 0 ? ` · ${Math.round((ayeCount / totalVotes) * 100)}% aye rate` : ''}
                    </AppText>
                  </View>

                  {/* Representation Gap */}
                  <RepresentationGapCard
                    records={repGapRecords}
                    memberFirstName={member?.first_name || ''}
                    electorateName={member?.electorate?.name || ''}
                  />

                  <DecisiveVotesCard
                    votes={decisiveVotes}
                    winningCount={decisiveWinning}
                    memberFirstName={member?.first_name || ''}
                  />

                  {/* Prediction accuracy banner */}
                  {predictionAccuracy.total > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, paddingHorizontal: spacing.sm }}>
                      <Ionicons name="bulb-outline" size={14} color={colors.green} />
                      <Text style={{ fontSize: 13, color: colors.textMuted }}>
                        You've predicted {predictionAccuracy.correct} of {predictionAccuracy.total} votes correctly ({predictionAccuracy.rate}%)
                      </Text>
                    </View>
                  )}

                  {votes.slice(0, visibleCount).map(v => {
                    const rawName = v.division?.name || 'Unknown division';
                    const procedural = isProcedural(rawName);
                    const title = cleanDivisionTitle(rawName);
                    const isAye = v.vote_cast === 'aye';
                    const isNo = v.vote_cast === 'no';
                    const divId = v.division?.id;
                    const isGuessExpanded = guessExpandedId === v.id;
                    const existingPrediction = divId ? hasGuessed(divId) : null;
                    const showGuessPrompt = divId && !procedural && !existingPrediction?.was_correct;
                    return (
                      <View key={v.id} style={{ marginBottom: spacing.sm + 2 }}>
                        <View style={{ borderRadius: radius.sm + 2, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, ...elevation.sm }}>
                          <View style={{ width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', flexShrink: 0, backgroundColor: isAye ? colors.greenBg : isNo ? colors.redBg : colors.cardAlt }}>
                            <Ionicons
                              name={isAye ? 'checkmark' : isNo ? 'close' : 'remove'}
                              size={16}
                              color={isAye ? tokenColors.success : isNo ? '#d32f2f' : tokenColors.textMuted}
                            />
                          </View>
                          <Pressable style={{ flex: 1 }} onPress={() => showGuessPrompt ? setGuessExpandedId(isGuessExpanded ? null : v.id) : undefined}>
                            <Text style={procedural ? { fontSize: 13 - 1, lineHeight: 17, color: colors.textMuted } : { fontSize: 13, lineHeight: 18, color: colors.text }} numberOfLines={2}>{title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
                              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                {v.division?.date ? timeAgo(v.division.date) : ''}
                              </Text>
                              {v.rebelled && (
                                <Text style={{ fontSize: 10, color: '#b45309', backgroundColor: '#fef3c7', borderRadius: radius.sm - 2, paddingHorizontal: 6, paddingVertical: 1, fontWeight: '700' }}>Crossed floor</Text>
                              )}
                              {showGuessPrompt && !isGuessExpanded && !existingPrediction && (
                                <Text style={{ fontSize: 10, color: tokenColors.success, fontWeight: '600' }}>Guess</Text>
                              )}
                              {existingPrediction?.was_correct === true && (
                                <Ionicons name="checkmark-circle" size={12} color={tokenColors.accent} />
                              )}
                              {existingPrediction?.was_correct === false && (
                                <Ionicons name="close-circle" size={12} color={tokenColors.danger} />
                              )}
                            </View>
                          </Pressable>
                          <Pressable onPress={() => setShareVoteData(v)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share this vote" style={{ padding: spacing.xs, marginLeft: spacing.xs }}>
                            <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={15} color="#9aabb8" />
                          </Pressable>
                        </View>
                        {/* GuessReveal expanded below the vote row */}
                        {isGuessExpanded && divId && (
                          <View style={{ marginTop: spacing.xs }}>
                            <GuessReveal
                              divisionId={divId}
                              divisionName={title}
                              mpName={displayName}
                              existingPrediction={existingPrediction}
                              onGuess={async (dId, g) => {
                                const result = await submitGuess(dId, g);
                                if (result) {
                                  logCivicEvent('prediction_made', { division_id: dId, member_id: member?.id, guess: g });
                                  if (!result.wasCorrect) {
                                    logCivicEvent('prediction_revealed', { division_id: dId, was_correct: false, surprise: true });
                                  }
                                }
                                return result;
                              }}
                              onShare={() => {
                                logCivicEvent('share_generated', { type: 'mirror', division_id: divId, member_id: member?.id });
                              }}
                            />
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {votes.length > visibleCount && (
                    <Pressable onPress={() => setVisibleCount(c => c + 20)} accessibilityRole="button" accessibilityLabel={`Show ${Math.min(20, votes.length - visibleCount)} more votes`} style={{ alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.green }}>
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
                <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md }}>
                  <Ionicons name="mic-outline" size={48} color={colors.textMuted} />
                  <AppText variant="heading" style={{ color: colors.text }}>No recent speeches</AppText>
                  <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center' }}>Speeches appear once Hansard data is loaded for this MP.</Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: spacing.md }}>Recent Speeches</Text>
                  {hansardEntries.map(entry => (
                    <Pressable
                      key={entry.id}
                      onPress={() => entry.source_url && Linking.openURL(entry.source_url)}
                      accessibilityRole="button"
                      accessibilityLabel={`View speech${entry.debate_topic ? `: ${entry.debate_topic}` : ''}`}
                      style={{ borderRadius: radius.sm + 2, padding: spacing.md + 2, marginBottom: spacing.sm + 2, backgroundColor: colors.card, ...elevation.sm }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                          {timeAgo(entry.date)}
                        </Text>
                        {entry.source_url && <Ionicons name="open-outline" size={13} color={colors.textMuted} />}
                      </View>
                      {entry.debate_topic ? (
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs }} numberOfLines={1}>{entry.debate_topic}</Text>
                      ) : null}
                      {entry.excerpt ? (
                        <Text style={{ fontSize: 13 - 1, lineHeight: 18, color: colors.textBody }} numberOfLines={3}>{decodeHtml(entry.excerpt)}</Text>
                      ) : null}
                    </Pressable>
                  ))}
                  <Text style={{ fontSize: 11, marginTop: spacing.lg, textAlign: 'center', color: colors.textMuted }}>Source: OpenAustralia / APH Hansard</Text>
                </>
              )}
            </>
          )}


          {/* ═══════ MORE TAB ═══════ */}
          {activeTab === 'more' && (
            <>
              {/* ── About ── */}
              <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>About</AppText>
              <View style={{ marginBottom: spacing.xl }}>
                <View style={{ gap: spacing.xs }}>
                  <Text style={{ fontSize: 13 - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.md }}>Chamber</Text>
                  <Text style={{ fontSize: 15, color: colors.text }}>{member.chamber === 'senate' ? 'Senate' : 'House of Representatives'}</Text>
                  {member.electorate && (
                    <>
                      <Text style={{ fontSize: 13 - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.md }}>Electorate</Text>
                      <Text style={{ fontSize: 15, color: colors.text }}>{member.electorate.name}, {member.electorate.state}</Text>
                    </>
                  )}
                  {member.ministerial_role && (
                    <>
                      <Text style={{ fontSize: 13 - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.md }}>Current Role</Text>
                      <Text style={{ fontSize: 15, color: colors.text }}>{member.ministerial_role}</Text>
                    </>
                  )}
                  {member.email && (
                    <>
                      <Text style={{ fontSize: 13 - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.md }}>Email</Text>
                      <Text style={{ fontSize: 15, color: colors.green }} onPress={() => Linking.openURL(`mailto:${member.email}`)}>{member.email}</Text>
                    </>
                  )}
                  {member.phone && (
                    <>
                      <Text style={{ fontSize: 13 - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.md }}>Phone</Text>
                      <Text style={{ fontSize: 15, color: colors.text }}>{member.phone}</Text>
                    </>
                  )}
                </View>

                {/* Committee memberships */}
                {committeesLoading ? (
                  <SkeletonLoader height={20} borderRadius={4} style={{ marginTop: 16 }} />
                ) : committees.length > 0 ? (
                  <>
                    <Text style={{ fontSize: 13 - 1, fontWeight: '600', textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.lg }}>Current Committees</Text>
                    {committees.map(c => (
                      <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text }}>{c.committee_name}</Text>
                          {c.committee_type && (
                            <Text style={{ fontSize: 11, marginTop: 1, color: colors.textMuted }}>
                              {c.committee_type.charAt(0).toUpperCase() + c.committee_type.slice(1)}
                            </Text>
                          )}
                        </View>
                        {c.role !== 'member' && (
                          <View style={{ backgroundColor: '#e8f5ee', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: tokenColors.success }}>
                              {c.role.charAt(0).toUpperCase() + c.role.slice(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                ) : null}
              </View>

              {/* ── Donations & Voting ── */}
              {moneyVoteLinks.length > 0 && (
                <View style={{ marginBottom: spacing.xl }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm }}>
                    Donations & Voting
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 18 }}>
                    Industry donors and related legislation votes. Correlation, not causation.
                  </Text>
                  {moneyVoteLinks.map((link, idx) => {
                    const isAye = link.vote_cast === 'aye';
                    const isNo = link.vote_cast === 'no';
                    return (
                      <View key={idx} style={{
                        backgroundColor: colors.card, borderRadius: radius.md,
                        padding: spacing.md, marginBottom: spacing.sm,
                        ...elevation.sm,
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 }} numberOfLines={1}>
                            {link.donor_name}
                          </Text>
                          <View style={{ backgroundColor: colors.surface, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
                              ${link.total_donated >= 1000 ? `${(link.total_donated / 1000).toFixed(0)}k` : link.total_donated.toLocaleString()}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6 }}>
                          {link.donor_industry} donor
                        </Text>
                        <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: spacing.sm }}>
                          <Text style={{ fontSize: 12, color: colors.text, lineHeight: 18 }} numberOfLines={2}>
                            {link.related_bill_title}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <View style={{
                              backgroundColor: isAye ? tokenColors.accentMuted : isNo ? tokenColors.danger + '18' : tokenColors.surfaceMuted,
                              borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2,
                            }}>
                              <Text style={{
                                fontSize: 11, fontWeight: '700',
                                color: isAye ? tokenColors.success : isNo ? tokenColors.danger : tokenColors.textMuted,
                              }}>
                                Voted {isAye ? 'Aye' : isNo ? 'No' : link.vote_cast}
                              </Text>
                            </View>
                            {link.vote_date && <Text style={{ fontSize: 10, color: tokenColors.textMuted }}>{link.vote_date}</Text>}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ── Funding ── */}
              <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>Funding</AppText>
              <View style={{ marginBottom: spacing.xl }}>
                {/* Funding sub-toggle */}
                <View style={{ flexDirection: 'row', borderRadius: radius.sm, padding: 3, marginBottom: spacing.lg, backgroundColor: colors.cardAlt }}>
                  <Pressable
                    onPress={() => setFundingView('party')}
                    accessibilityRole="button"
                    accessibilityLabel="Show party funding"
                    style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm + 2, ...(fundingView === 'party' ? { backgroundColor: colors.card, ...elevation.sm } : {}) }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: fundingView === 'party' ? colors.text : colors.textMuted }}>Party Funding</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFundingView('personal')}
                    accessibilityRole="button"
                    accessibilityLabel="Show personal donations"
                    style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm + 2, ...(fundingView === 'personal' ? { backgroundColor: colors.card, ...elevation.sm } : {}) }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: fundingView === 'personal' ? colors.text : colors.textMuted }}>Personal Donations</Text>
                  </Pressable>
                </View>

                {fundingView === 'party' ? (
                  donationsLoading ? (
                    [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
                  ) : (
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: spacing.md }}>
                        Party donations — {member.party?.short_name || member.party?.name || ''}
                      </Text>
                      {donations.length === 0 ? (
                        <Text style={{ textAlign: 'center', fontSize: 13 + 1, marginTop: spacing.lg + 4, color: colors.textMuted }}>No donation data available.</Text>
                      ) : (
                        <>
                          {donations.map(d => (
                            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                              <View style={{ flex: 1, marginRight: spacing.sm + 2 }}>
                                <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text }} numberOfLines={2}>{d.donor_name}</Text>
                                <Text style={{ fontSize: 11, marginTop: 2, color: colors.textMuted }}>{d.financial_year}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                                <View style={{ borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: d.donor_type === 'union' ? '#e8f0fe' : d.donor_type === 'corporation' ? colors.cardAlt : colors.greenBg }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: d.donor_type === 'union' ? '#0066CC' : d.donor_type === 'corporation' ? colors.textBody : tokenColors.success }}>
                                    {DONOR_TYPE_LABELS[d.donor_type]}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 13 + 1, fontWeight: '700', color: colors.text }}>${Number(d.amount).toLocaleString('en-AU')}</Text>
                              </View>
                            </View>
                          ))}
                          <Text style={{ fontSize: 11, marginTop: spacing.lg, textAlign: 'center', color: colors.textMuted }}>
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
                      <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: spacing.md }}>
                        Donations to {member.first_name} {member.last_name}
                      </Text>
                      {indDonations.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                          <Ionicons name="receipt-outline" size={24} color={colors.borderStrong} />
                          <Text style={{ fontSize: 13 + 1, fontWeight: '600', color: colors.textMuted }}>No personal donation records found.</Text>
                          <Text style={{ fontSize: 13 - 1, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing.sm, color: colors.textMuted }}>
                            Most donations are made directly to parties. Individual disclosures appear when donors report donations to a specific candidate or MP.
                          </Text>
                        </View>
                      ) : (
                        <>
                          {indDonations.map(d => (
                            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                              <View style={{ flex: 1, marginRight: spacing.sm + 2 }}>
                                <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text }} numberOfLines={2}>{d.donor_name}</Text>
                                <Text style={{ fontSize: 11, marginTop: 2, color: colors.textMuted }}>{d.financial_year}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                                <View style={{ borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: d.donor_type === 'union' ? '#e8f0fe' : d.donor_type === 'corporation' ? colors.cardAlt : colors.greenBg }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: d.donor_type === 'union' ? '#0066CC' : d.donor_type === 'corporation' ? colors.textBody : tokenColors.success }}>
                                    {DONOR_TYPE_LABELS[d.donor_type ?? ''] ?? (d.donor_type || 'Other')}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 13 + 1, fontWeight: '700', color: colors.text }}>${Number(d.amount).toLocaleString('en-AU')}</Text>
                              </View>
                            </View>
                          ))}
                          <Text style={{ fontSize: 11, marginTop: spacing.lg, textAlign: 'center', color: colors.textMuted }}>
                            Total declared: ${indTotal.toLocaleString('en-AU')} · Source: AEC
                          </Text>
                        </>
                      )}
                    </View>
                  )
                )}

                {/* ── Donation vs Voting Analysis ── */}
                {donationVoteAnalysis && (() => {
                  const { topDonorsWithIndustry, industryVotes } = donationVoteAnalysis;
                  return (
                    <View style={{ marginTop: spacing.xl }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg }}>
                        <Ionicons name="git-compare-outline" size={18} color="#4338CA" />
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Donations vs Voting</Text>
                      </View>
                      <Text style={{ fontSize: 13, color: tokenColors.textMuted, lineHeight: 19, marginBottom: spacing.lg }}>
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
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: getIndustryColor(donor.industry) }} />
                                    <Text style={{ fontSize: 12, color: tokenColors.textMuted }}>{getIndustryLabel(donor.industry)}</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>${donor.amount.toLocaleString('en-AU')}</Text>
                            </View>
                            {iv ? (
                              <View style={{ backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10, marginTop: 4 }}>
                                <Text style={{ fontSize: 13, color: '#4338CA', lineHeight: 18 }}>
                                  Voted <Text style={{ fontWeight: '700', color: '#059669' }}>YES</Text> on {iv.aye} and{' '}
                                  <Text style={{ fontWeight: '700', color: tokenColors.danger }}>NO</Text> on {iv.no}{' '}
                                  {getIndustryLabel(donor.industry).toLowerCase()}-related bill{iv.aye + iv.no !== 1 ? 's' : ''}
                                </Text>
                              </View>
                            ) : (
                              <Text style={{ fontSize: 12, color: tokenColors.textMuted, marginTop: 4, fontStyle: 'italic' }}>No related votes found</Text>
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
                            message: `${displayName} received $${totalFromIndustry.toLocaleString('en-AU')} from ${getIndustryLabel(topDonor.industry)}. See how they voted on related legislation.\n\nTrack every MP's donors and votes on Verity — verity.run`,
                          });
                        }}
                      >
                        <Ionicons name="share-outline" size={16} color={tokenColors.accent} />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: tokenColors.success }}>Share this analysis</Text>
                      </Pressable>
                      <Text style={{ fontSize: 11, color: tokenColors.textMuted, textAlign: 'center', lineHeight: 16, marginTop: 4, paddingHorizontal: 8 }}>
                        Correlation between donations and votes does not imply causation. All data from AEC declarations and APH voting records.
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* ── Registered Interests ── */}
              <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>Registered Interests</AppText>
              <View style={{ marginBottom: spacing.xl }}>
                {interestsLoading ? (
                  [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={10} style={{ marginBottom: 10 }} />)
                ) : allInterests.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                    <Ionicons name="document-text-outline" size={28} color={colors.borderStrong} />
                    <Text style={{ fontSize: 13 + 1, fontWeight: '600', color: colors.textMuted }}>No registered interests on file.</Text>
                    <Text style={{ fontSize: 13 - 1, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing.sm, color: colors.textMuted }}>
                      {member.chamber === 'house'
                        ? 'House of Representatives interest data is sourced from PDF registers and is not yet available for this member.'
                        : 'Interest declarations will appear once filed with the Senate.'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: colors.textMuted, marginBottom: spacing.md }}>
                      Declared Financial Interests ({allInterests.length})
                    </Text>
                    {Object.entries(interestsGrouped).map(([category, items]) => (
                      <View key={category} style={{ marginBottom: spacing.md }}>
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
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                            {category} ({items.length})
                          </Text>
                        </View>
                        {items.map(item => (
                          <View key={item.id} style={{ borderRadius: radius.sm + 2, padding: spacing.md + 2, marginBottom: 6, backgroundColor: colors.card, ...elevation.sm }}>
                            <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 18 }}>
                              {decodeHtml(item.description)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                    {allInterests[0]?.source_url && (
                      <Pressable onPress={() => Linking.openURL(allInterests[0].source_url!)} accessibilityRole="button" accessibilityLabel="View Senate Register of Interests source">
                        <Text style={{ fontSize: 11, marginTop: spacing.lg, textAlign: 'center', color: colors.green }}>
                          Source: Senate Register of Interests
                        </Text>
                      </Pressable>
                    )}
                    {allInterests[0]?.date_registered && (
                      <Text style={{ fontSize: 11, textAlign: 'center', color: colors.textMuted, marginTop: 4 }}>
                        Last updated: {allInterests[0].date_registered}
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* ── Demographics ── */}
              {demographics && member.electorate && (
                <>
                  <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>
                    {member.electorate.name} Demographics
                  </AppText>
                  <View style={{ marginBottom: spacing.xl }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: spacing.sm }}>Census 2021</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {demographics.median_household_income_weekly != null && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>Median Household Income</Text>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>${Math.round(demographics.median_household_income_weekly * 52).toLocaleString()}/yr</Text>
                        </View>
                      )}
                      {demographics.median_age != null && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>Median Age</Text>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{demographics.median_age}</Text>
                        </View>
                      )}
                      {demographics.median_rent_weekly != null && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>Median Rent</Text>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>${demographics.median_rent_weekly}/wk</Text>
                        </View>
                      )}
                      {demographics.pct_renting != null && (
                        <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                          <Text style={{ fontSize: 11, color: colors.textMuted }}>Renters</Text>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{demographics.pct_renting}%</Text>
                        </View>
                      )}
                    </View>
                    {demographics.top_industries && demographics.top_industries.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Top Industries</Text>
                        {demographics.top_industries.slice(0, 3).map((ind: any, idx: number) => (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, color: colors.text }}>{ind.name}</Text>
                            </View>
                            <View style={{ backgroundColor: colors.green + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green }}>{Math.round(Number(ind.pct) || 0)}%</Text>
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
                  <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>
                    Federal Contracts in {member.electorate.name}
                  </AppText>
                  <View style={{ marginBottom: spacing.xl }}>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, flex: 1 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>Total Value (30d)</Text>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                          ${contractSummary.total_value >= 1000000
                            ? `${(contractSummary.total_value / 1000000).toFixed(1)}M`
                            : contractSummary.total_value >= 1000
                              ? `${(contractSummary.total_value / 1000).toFixed(0)}K`
                              : contractSummary.total_value.toLocaleString()}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, flex: 1 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>Contracts</Text>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{contractSummary.contract_count}</Text>
                      </View>
                    </View>
                    {contractSummary.top_agencies.length > 0 && (
                      <>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Top Agencies</Text>
                        {contractSummary.top_agencies.slice(0, 3).map((a: any, idx: number) => (
                          <Text key={idx} style={{ fontSize: 11, color: colors.textBody, marginBottom: 2 }}>
                            {a.agency} ({a.count})
                          </Text>
                        ))}
                      </>
                    )}
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' }}>
                      Source: AusTender. Contracts linked by supplier postcode.
                    </Text>
                  </View>
                </>
              )}

              {/* ── Watchlist / Contradictions ── */}
              <AppText variant="heading" style={{ color: colors.text, marginBottom: spacing.md }}>Watchlist</AppText>
              <View style={{ marginBottom: spacing.xl }}>
                {contradictionsLoading ? (
                  [1, 2, 3].map(i => <SkeletonLoader key={i} height={100} borderRadius={14} style={{ marginBottom: 10 }} />)
                ) : contradictions.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                    <Ionicons name="shield-checkmark-outline" size={28} color={colors.borderStrong} />
                    <Text style={{ fontSize: 13 + 1, fontWeight: '600', color: colors.textMuted }}>No contradictions found</Text>
                    <Text style={{ fontSize: 13 - 1, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing.sm, color: colors.textMuted }}>
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
              partyLoyalty={totalVotes > 0 ? Math.round(((totalVotes - rebelVotes.length) / totalVotes) * 100) : 0}
              topDonors={Array.from(
                indDonations.reduce((acc, d) => {
                  acc.set(d.donor_name, (acc.get(d.donor_name) ?? 0) + Number(d.amount));
                  return acc;
                }, new Map<string, number>())
              ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, amount]) => ({ name, amount }))}
            />
          )}
        </View>
        <View ref={hypocrisyCardRef}>
          {shareHypocrisy && hypocrisyData?.status === 'scored' && (
            <HypocrisyShareCard
              mpName={displayName}
              mpPhotoUrl={member.photo_url}
              partyName={party?.short_name || party?.name || ''}
              partyColour={partyColour}
              electorate={member.electorate?.name ?? ''}
              score={hypocrisyData.overall_score ?? 0}
              rank={hypocrisyData.rank_among_mps ?? 0}
              totalMps={hypocrisyData.total_mps_scored ?? 0}
              topTopic={hypocrisyData.top_topics?.[0] ?? null}
            />
          )}
        </View>
        <View ref={receiptRef}>
          {shareReceipt && member && (
            <MPReceiptCard
              mpName={displayName}
              partyName={party?.short_name || party?.name || ''}
              partyColour={partyColour}
              electorateName={member.electorate?.name ?? ''}
              items={[
                { label: 'Attendance', value: findMetric(mpStats, 'attendance_rate')?.display_value || `${participationIndex.attendanceRate}%` },
                { label: 'Party loyalty', value: findMetric(mpStats, 'party_loyalty_rate')?.display_value || `${totalVotes > 0 ? Math.round(((totalVotes - rebelVotes.length) / totalVotes) * 100) : 0}%` },
                { label: 'Floor crossings', value: findMetric(mpStats, 'floor_crossings')?.display_value || `${rebelVotes.length}`, highlight: rebelVotes.length > 0 },
                { label: 'Votes this term', value: findMetric(mpStats, 'votes_cast')?.display_value || `${totalVotes}` },
                { label: 'Speeches', value: `${hansardEntries.length}` },
                ...(indDonations.length > 0 ? [{
                  label: 'Top donor',
                  value: `$${Math.round(Number(indDonations[0]?.amount) || 0).toLocaleString()}`,
                  highlight: true,
                }] : []),
              ]}
              publicTake={discourseData?.best_takes?.[0]?.replace(/\s*—\s*u\/.*$/, '') || undefined}
              publicTakeSource={discourseData?.sources_searched?.slice(0, 2).join(', ') || undefined}
              date={new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                <Text style={{ fontSize: 13, fontWeight: '600', color: tokenColors.success, marginTop: 8 }}>
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
