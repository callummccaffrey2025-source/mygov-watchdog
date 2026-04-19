import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Share, Platform, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Member } from '../hooks/useMembers';
import { useVotes } from '../hooks/useVotes';
import { usePostsByMember } from '../hooks/useOfficialPosts';
import { useMemberStatements, MemberStatement } from '../hooks/useRepresentativeUpdates';
import { useVerifiedOfficial } from '../hooks/useVerifiedOfficial';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../hooks/useSubscription';
import { usePartyDonations, DONOR_TYPE_LABELS } from '../hooks/useDonations';
import { useIndividualDonations } from '../hooks/useIndividualDonations';
import { useCommittees } from '../hooks/useCommittees';
import { useHansard } from '../hooks/useHansard';
import { PartyBadge } from '../components/PartyBadge';
import { StatBox } from '../components/StatBox';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { PostCard } from '../components/PostCard';
import { VoteShareCard, MPReportCard } from '../components/ShareCards';
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
import { AccountabilityScoreCard } from '../components/AccountabilityScore';
import { useRegisteredInterests } from '../hooks/useRegisteredInterests';
import { useContradictions } from '../hooks/useContradictions';
import { ContradictionCard } from '../components/ContradictionCard';
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

export function MemberProfileScreen({ route, navigation }: any) {
  const { member: memberParam, memberId } = route.params as { member?: Member; memberId?: string };
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

  const [activeTab, setActiveTab] = useState<'posts' | 'votes' | 'statements' | 'about' | 'funding' | 'speeches' | 'interests' | 'watchlist'>('posts');
  const [expandedStatements, setExpandedStatements] = useState<Set<number>>(new Set());
  const [fundingView, setFundingView] = useState<'party' | 'personal'>('party');
  const [visibleCount, setVisibleCount] = useState(20);
  const { votes, loading: votesLoading } = useVotes(member?.id ?? null);

  useEffect(() => {
    setVisibleCount(20);
    if (member) {
      track('mp_profile_view', { member_id: member.id, name: `${member.first_name} ${member.last_name}` }, 'MemberProfile');
      trackEvent('mp_view', { member_id: member.id });
    }
  }, [member?.id]);
  const { posts, loading: postsLoading } = usePostsByMember(member?.id);
  const { official } = useVerifiedOfficial(member?.id);
  const { user } = useUser();
  const isOwner = !!user && !!official && official.user_id === user.id;
  const { isPro } = useSubscription(user?.id);
  const { donations, loading: donationsLoading, totalAmount } = usePartyDonations(member?.party_id ?? undefined);
  const { donations: indDonations, total: indTotal, loading: indLoading } = useIndividualDonations(member?.id);
  const { current: committees, loading: committeesLoading } = useCommittees(member?.id);
  const { entries: hansardEntries, loading: hansardLoading } = useHansard(member?.id);
  const { statements, loading: statementsLoading } = useMemberStatements(member?.id ?? null);
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
  const voteCardRef  = useRef<any>(null);
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

  // Top donors for report card (already sorted by amount DESC from hook)
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

  if (!member) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <SkeletonLoader width="100%" height={200} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={false} onRefresh={async () => { if (memberId) { try { const { data } = await supabase.from('members').select('*, party:parties(name,short_name,colour,abbreviation), electorate:electorates(name,state)').eq('id', memberId).maybeSingle(); if (data) setMember(data as Member); } catch {} } }} tintColor="#00843D" />}>

        {/* Back button + share */}
        <View style={styles.navRow}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable style={styles.shareBtn} onPress={handleShare} hitSlop={8}>
            <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={20} color={colors.textBody} />
          </Pressable>
        </View>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: partyColour + '18' }]}>
          <View style={[styles.photoContainer, { borderColor: partyColour }]}>
            {member.photo_url ? (
              <Image source={{ uri: member.photo_url }} style={styles.photo} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: partyColour + '33' }]}>
                <Text style={[styles.initials, { color: partyColour }]}>
                  {member.first_name[0]}{member.last_name[0]}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.nameVerifiedRow}>
            <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
            <Ionicons name="checkmark-circle" size={20} color="#1D9BF0" />
          </View>
          {member.ministerial_role && (
            <Text style={{ fontSize: 15, fontWeight: '600', color: partyColour, marginTop: 2, textAlign: 'center', paddingHorizontal: 20 }} numberOfLines={2}>
              {member.ministerial_role}
            </Text>
          )}
          {party && <PartyBadge name={party.name} colour={party.colour} />}
          {member.electorate && (
            <Text style={[styles.electorate, { color: colors.textBody }]}>
              {member.electorate.name} · {member.chamber === 'senate' ? 'Senator' : 'MP'} · {member.electorate.state}
            </Text>
          )}
          {/* Gradient fade to background */}
          <View pointerEvents="none" style={styles.heroFade}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }} />
            <View style={{ flex: 1, backgroundColor: colors.background + '40' }} />
            <View style={{ flex: 1, backgroundColor: colors.background + '80' }} />
            <View style={{ flex: 1, backgroundColor: colors.background + 'BF' }} />
            <View style={{ flex: 1, backgroundColor: colors.background }} />
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StatBox value={`${totalVotes}`} label="Bills Voted" />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatBox value={totalVotes > 0 ? `${Math.round(ayeCount / totalVotes * 100)}%` : '—'} label="Aye Rate" />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <StatBox value={member.chamber === 'senate' ? 'Senate' : 'House'} label="Chamber" />
        </View>

        {/* Ministerial-role context — read metrics through this lens */}
        {member.ministerial_role && (
          <View style={{ marginHorizontal: 20, marginBottom: 10, backgroundColor: '#EEF2FF', borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8 }}>
            <Ionicons name="briefcase-outline" size={16} color="#4338CA" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#4338CA', marginBottom: 2 }}>
                Read these numbers with ministerial context
              </Text>
              <Text style={{ fontSize: 12, color: '#3730A3', lineHeight: 17 }}>
                {member.first_name} runs a department as {member.ministerial_role}. Ministers typically give fewer speeches and can miss divisions for cabinet duties. Their "party loyalty" is structural, not voluntary.
              </Text>
            </View>
          </View>
        )}

        {/* Participation Index — four separate dimensions, not a single score */}
        {!votesLoading && (
          <AccountabilityScoreCard
            score={participationIndex}
            mpName={displayName}
            partyColour={partyColour}
          />
        )}

        {/* Share + Follow row */}
        <View style={styles.actionRow}>
          <Pressable style={styles.reportCardBtn} onPress={() => setShareReport(true)}>
            <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={15} color="#00843D" />
            <Text style={styles.reportCardBtnText}>Share Report Card</Text>
          </Pressable>
          <Pressable
            style={[styles.followBtn, { backgroundColor: followingMP ? '#00843D' : colors.background }, followingMP && styles.followBtnActive]}
            onPress={() => requireAuth('follow this MP', toggleFollow)}
          >
            <Ionicons
              name={followingMP ? 'heart' : 'heart-outline'}
              size={15}
              color={followingMP ? '#ffffff' : '#00843D'}
            />
            <Text style={[styles.followBtnText, followingMP && styles.followBtnTextActive]}>
              {followingMP ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        </View>

        {/* Compare button */}
        <Pressable
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 20, marginBottom: 8, borderRadius: 10, paddingVertical: 10, backgroundColor: '#EEF2FF' }}
          onPress={() => navigation.navigate('CompareMPs', { member })}
        >
          <Ionicons name="people-outline" size={16} color="#4338CA" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#4338CA' }}>Compare with another MP</Text>
        </Pressable>

        {/* Write to MP */}
        <Pressable
          style={[styles.writeBtn, { borderColor: '#00843D' }]}
          onPress={() => requireAuth('write to your MP', () => navigation.navigate('WriteToMP', { member }))}
        >
          <Ionicons name="mail-outline" size={16} color="#00843D" />
          <Text style={styles.writeBtnText}>Write to {member.first_name}</Text>
        </Pressable>

        {/* Advanced Analytics (Pro) */}
        {isPro ? (
          <View style={[styles.proCard, { backgroundColor: colors.greenBg }]}>
            <Text style={[styles.proCardText, { color: colors.textMuted }]}>Advanced Analytics coming soon for this MP.</Text>
          </View>
        ) : (
          <View style={styles.proGate}>
            <Ionicons name="star" size={32} color="#D4A843" />
            <Text style={[styles.proGateTitle, { color: colors.text }]}>Advanced Analytics</Text>
            <Text style={[styles.proGateBody, { color: colors.textBody }]}>
              Compare this MP's voting record against their party line and electorate demographics.
            </Text>
            <Pressable style={styles.proGateBtn} onPress={() => navigation.navigate('Subscription')}>
              <Text style={styles.proGateBtnText}>Unlock with Verity Pro</Text>
            </Pressable>
          </View>
        )}

        {/* Contact */}
        <View style={styles.contactRow}>
          {member.email && (
            <Pressable style={styles.contactBtn} onPress={() => Linking.openURL(`mailto:${member.email}`)}>
              <Ionicons name="mail" size={20} color="#00843D" />
              <Text style={styles.contactLabel}>Email</Text>
            </Pressable>
          )}
          {member.phone && (
            <Pressable style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${member.phone}`)}>
              <Ionicons name="call" size={20} color="#00843D" />
              <Text style={styles.contactLabel}>Phone</Text>
            </Pressable>
          )}
        </View>

        {/* Tabs (horizontal scroll — now 6 entries) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
          contentContainerStyle={{ paddingHorizontal: 4 }}
        >
          <Pressable style={[styles.tab, { paddingHorizontal: 16 }, activeTab === 'posts' && styles.activeTab]} onPress={() => setActiveTab('posts')}>
            <Text style={[styles.tabText, { color: activeTab === 'posts' ? colors.green : colors.textMuted }]}>Posts</Text>
          </Pressable>
          <Pressable style={[styles.tab, { paddingHorizontal: 16 }, activeTab === 'votes' && styles.activeTab]} onPress={() => setActiveTab('votes')}>
            <Text style={[styles.tabText, { color: activeTab === 'votes' ? colors.green : colors.textMuted }]}>Votes</Text>
          </Pressable>
          <Pressable style={[styles.tab, { paddingHorizontal: 16 }, activeTab === 'statements' && styles.activeTab]} onPress={() => setActiveTab('statements')}>
            <Text style={[styles.tabText, { color: activeTab === 'statements' ? colors.green : colors.textMuted }]}>Statements</Text>
          </Pressable>
          <Pressable style={[styles.tab, { paddingHorizontal: 16 }, activeTab === 'about' && styles.activeTab]} onPress={() => setActiveTab('about')}>
            <Text style={[styles.tabText, { color: activeTab === 'about' ? colors.green : colors.textMuted }]}>About</Text>
          </Pressable>
          <Pressable style={[styles.tab, { paddingHorizontal: 16 }, activeTab === 'funding' && styles.activeTab]} onPress={() => setActiveTab('funding')}>
            <Text style={[styles.tabText, { color: activeTab === 'funding' ? colors.green : colors.textMuted }]}>Funding</Text>
          </Pressable>
          <Pressable style={[styles.tab, { paddingHorizontal: 16 }, activeTab === 'speeches' && styles.activeTab]} onPress={() => setActiveTab('speeches')}>
            <Text style={[styles.tabText, { color: activeTab === 'speeches' ? colors.green : colors.textMuted }]}>Speeches</Text>
          </Pressable>
          <Pressable style={[styles.tab, { paddingHorizontal: 16 }, activeTab === 'interests' && styles.activeTab]} onPress={() => setActiveTab('interests')}>
            <Text style={[styles.tabText, { color: activeTab === 'interests' ? colors.green : colors.textMuted }]}>Interests</Text>
          </Pressable>
          <Pressable style={[styles.tab, { paddingHorizontal: 16 }, activeTab === 'watchlist' && styles.activeTab]} onPress={() => setActiveTab('watchlist')}>
            <Text style={[styles.tabText, { color: activeTab === 'watchlist' ? colors.green : colors.textMuted }]}>Watchlist</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.tabContent}>
          {activeTab === 'posts' ? (
            <>
              <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 4, alignItems: 'flex-start' }}>
                <Ionicons name="shield-checkmark-outline" size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '500', color: colors.textMuted, lineHeight: 15 }}>
                  Verity only displays statements where attribution can be verified through the original source. Posts attributed to multiple ministers in scraped feeds are excluded until manually verified.
                </Text>
              </View>
              {postsLoading
                ? [1, 2, 3].map(i => <SkeletonLoader key={i} height={120} borderRadius={14} style={{ marginBottom: 10 }} />)
                : posts.length === 0
                  ? <Text style={[styles.empty, { color: colors.textMuted }]}>This MP hasn't posted yet.</Text>
                  : posts.map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onPress={() => navigation.navigate('PostDetail', { post })}
                      />
                    ))}
            </>
          ) : activeTab === 'votes' ? (
            votesLoading ? (
              [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
            ) : votes.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>No voting records available yet.</Text>
            ) : (
              <>
                <View style={[styles.voteSummaryCard, { backgroundColor: colors.greenBg }]}>
                  <Ionicons name="stats-chart" size={16} color="#00843D" />
                  <Text style={[styles.voteSummaryText, { color: colors.text }]}>
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
                    <View key={v.id} style={[styles.voteCard, { backgroundColor: colors.card }]}>
                      <View style={[styles.voteCardIcon, { backgroundColor: isAye ? colors.greenBg : isNo ? colors.redBg : colors.cardAlt }]}>
                        <Ionicons
                          name={isAye ? 'checkmark' : isNo ? 'close' : 'remove'}
                          size={16}
                          color={isAye ? '#00843D' : isNo ? '#d32f2f' : '#9aabb8'}
                        />
                      </View>
                      <View style={styles.voteInfo}>
                        <Text style={[procedural ? styles.voteProceduralTitle : styles.voteBillTitle, procedural ? { color: colors.textMuted } : { color: colors.text }]} numberOfLines={2}>{title}</Text>
                        <View style={styles.voteMeta}>
                          <Text style={[styles.voteDate, { color: colors.textMuted }]}>
                            {v.division?.date ? timeAgo(v.division.date) : ''}
                          </Text>
                          {v.rebelled && (
                            <Text style={styles.rebelBadge}>Crossed floor</Text>
                          )}
                        </View>
                      </View>
                      <Pressable
                        style={styles.voteShareBtn}
                        onPress={() => setShareVoteData(v)}
                        hitSlop={8}
                      >
                        <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={15} color="#9aabb8" />
                      </Pressable>
                    </View>
                  );
                })}
                {votes.length > visibleCount && (
                  <Pressable style={styles.showMoreBtn} onPress={() => setVisibleCount(c => c + 20)}>
                    <Text style={[styles.showMoreText, { color: colors.green }]}>
                      Show {Math.min(20, votes.length - visibleCount)} more votes
                    </Text>
                  </Pressable>
                )}
              </>
            )
          ) : activeTab === 'statements' ? (
            <>
              <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 4, alignItems: 'flex-start' }}>
                <Ionicons name="link-outline" size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '500', color: colors.textMuted, lineHeight: 15 }}>
                  Every statement links to its original source on an official government or party site. Statements without a verified source URL are never displayed.
                </Text>
              </View>
              {statementsLoading ? (
                [1, 2, 3].map(i => <SkeletonLoader key={i} height={120} borderRadius={14} style={{ marginBottom: 10 }} />)
              ) : statements.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 12 }}>
                  <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
                  <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
                    No statements yet
                  </Text>
                  <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center', lineHeight: 22 }}>
                    Verity scrapes official media releases daily. Verified statements from {member.first_name} will appear here once published.
                  </Text>
                </View>
              ) : (
                statements.map((s: MemberStatement) => {
                  const isExpanded = expandedStatements.has(s.id);
                  const [firstLine, ...rest] = s.content.split('\n\n');
                  const title = firstLine.trim();
                  const body = rest.join('\n\n').trim() || title;
                  const displayBody = (isExpanded || body.length <= 200)
                    ? body
                    : body.slice(0, 200).trimEnd() + '…';
                  const canExpand = body.length > 200;
                  const dateStr = s.published_at
                    ? new Date(s.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';

                  return (
                    <View
                      key={s.id}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 14,
                        padding: 16,
                        marginHorizontal: 16,
                        marginBottom: 12,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.04,
                        shadowRadius: 3,
                        elevation: 1,
                      }}
                    >
                      {/* Date + source badge row */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>{dateStr}</Text>
                        <View style={{ backgroundColor: colors.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#00843D', letterSpacing: 0.4 }}>
                            OFFICIAL RELEASE
                          </Text>
                        </View>
                      </View>

                      {/* Title */}
                      {title && title !== body && (
                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 21, marginBottom: 6 }}>
                          {title}
                        </Text>
                      )}

                      {/* Body (truncated with expand) */}
                      <Text style={{ fontSize: 14, color: colors.textBody, lineHeight: 20 }}>
                        {displayBody}
                      </Text>

                      {canExpand && (
                        <Pressable
                          onPress={() => setExpandedStatements(prev => {
                            const next = new Set(prev);
                            if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                            return next;
                          })}
                          style={{ marginTop: 6, alignSelf: 'flex-start' }}
                          hitSlop={8}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.green }}>
                            {isExpanded ? 'Show less' : 'Show more'}
                          </Text>
                        </Pressable>
                      )}

                      {/* Source link — always present because DB NOT NULL enforces it */}
                      <Pressable
                        onPress={() => Linking.openURL(s.source_url)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}
                        hitSlop={8}
                      >
                        <Ionicons name="open-outline" size={13} color={colors.green} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.green }}>
                          View original source
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </>
          ) : activeTab === 'funding' ? (
            <View>
              {/* Funding sub-toggle */}
              <View style={[styles.fundingToggle, { backgroundColor: colors.cardAlt }]}>
                <Pressable
                  style={[styles.fundingToggleBtn, fundingView === 'party' && styles.fundingToggleBtnActive, fundingView === 'party' && { backgroundColor: colors.card }]}
                  onPress={() => setFundingView('party')}
                >
                  <Text style={[styles.fundingToggleBtnText, { color: fundingView === 'party' ? colors.text : colors.textMuted }]}>
                    Party Funding
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.fundingToggleBtn, fundingView === 'personal' && styles.fundingToggleBtnActive, fundingView === 'personal' && { backgroundColor: colors.card }]}
                  onPress={() => setFundingView('personal')}
                >
                  <Text style={[styles.fundingToggleBtnText, { color: fundingView === 'personal' ? colors.text : colors.textMuted }]}>
                    Personal Donations
                  </Text>
                </Pressable>
              </View>

              {fundingView === 'party' ? (
                donationsLoading ? (
                  [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
                ) : (
                  <View>
                    <Text style={[styles.fundingSubhead, { color: colors.textMuted }]}>
                      Party donations — {member.party?.short_name || member.party?.name || ''}
                    </Text>
                    {donations.length === 0 ? (
                      <Text style={[styles.empty, { color: colors.textMuted }]}>No donation data available.</Text>
                    ) : (
                      <>
                        {donations.map(d => (
                          <View key={d.id} style={[styles.donationRow, { borderBottomColor: colors.border }]}>
                            <View style={styles.donationLeft}>
                              <Text style={[styles.donorName, { color: colors.text }]} numberOfLines={2}>{d.donor_name}</Text>
                              <Text style={[styles.donorFY, { color: colors.textMuted }]}>{d.financial_year}</Text>
                            </View>
                            <View style={styles.donationRight}>
                              <View style={[styles.donorTypeBadge, { backgroundColor: d.donor_type === 'union' ? '#e8f0fe' : d.donor_type === 'corporation' ? colors.cardAlt : colors.greenBg }]}>
                                <Text style={[styles.donorTypeText, { color: d.donor_type === 'union' ? '#0066CC' : d.donor_type === 'corporation' ? colors.textBody : '#00843D' }]}>
                                  {DONOR_TYPE_LABELS[d.donor_type]}
                                </Text>
                              </View>
                              <Text style={[styles.donorAmount, { color: colors.text }]}>${Number(d.amount).toLocaleString('en-AU')}</Text>
                            </View>
                          </View>
                        ))}
                        <Text style={[styles.fundingFooter, { color: colors.textMuted }]}>
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
                    <Text style={[styles.fundingSubhead, { color: colors.textMuted }]}>
                      Donations to {member.first_name} {member.last_name}
                    </Text>
                    {indDonations.length === 0 ? (
                      <View style={styles.fundingEmptyState}>
                        <Ionicons name="receipt-outline" size={24} color={colors.borderStrong} />
                        <Text style={[styles.fundingEmptyText, { color: colors.textMuted }]}>No personal donation records found.</Text>
                        <Text style={[styles.fundingEmptySubtext, { color: colors.textMuted }]}>
                          Most donations are made directly to parties. Individual disclosures appear when donors report donations to a specific candidate or MP.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {indDonations.map(d => (
                          <View key={d.id} style={[styles.donationRow, { borderBottomColor: colors.border }]}>
                            <View style={styles.donationLeft}>
                              <Text style={[styles.donorName, { color: colors.text }]} numberOfLines={2}>{d.donor_name}</Text>
                              <Text style={[styles.donorFY, { color: colors.textMuted }]}>{d.financial_year}</Text>
                            </View>
                            <View style={styles.donationRight}>
                              <View style={[styles.donorTypeBadge, { backgroundColor: d.donor_type === 'union' ? '#e8f0fe' : d.donor_type === 'corporation' ? colors.cardAlt : colors.greenBg }]}>
                                <Text style={[styles.donorTypeText, { color: d.donor_type === 'union' ? '#0066CC' : d.donor_type === 'corporation' ? colors.textBody : '#00843D' }]}>
                                  {DONOR_TYPE_LABELS[d.donor_type ?? ''] ?? (d.donor_type || 'Other')}
                                </Text>
                              </View>
                              <Text style={[styles.donorAmount, { color: colors.text }]}>${Number(d.amount).toLocaleString('en-AU')}</Text>
                            </View>
                          </View>
                        ))}
                        <Text style={[styles.fundingFooter, { color: colors.textMuted }]}>
                          Total declared: ${indTotal.toLocaleString('en-AU')} · Source: AEC
                        </Text>
                      </>
                    )}
                  </View>
                )
              )}

              {/* ── Donation vs Voting Analysis ──────────────────── */}
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

                // Aggregate donors by name, detect industry
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

                // Find related votes per industry
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
                  <View style={{ marginTop: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <Ionicons name="git-compare-outline" size={18} color="#4338CA" />
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Donations vs Voting</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 16 }}>
                      Showing how {member.first_name} {member.last_name} voted on bills related to their donors' industries.
                    </Text>

                    {topDonorsWithIndustry.map((donor, i) => {
                      const iv = donor.industry ? industryVotes[donor.industry] : null;
                      return (
                        <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                          {/* Donor info */}
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

                          {/* Voting connection */}
                          {iv ? (
                            <View style={{ backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10, marginTop: 4 }}>
                              <Text style={{ fontSize: 13, color: '#4338CA', lineHeight: 18 }}>
                                Voted <Text style={{ fontWeight: '700', color: '#059669' }}>YES</Text> on {iv.aye} and{' '}
                                <Text style={{ fontWeight: '700', color: '#DC2626' }}>NO</Text> on {iv.no}{' '}
                                {donor.industry?.toLowerCase()}-related bill{iv.aye + iv.no !== 1 ? 's' : ''}
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' }}>
                              No related votes found
                            </Text>
                          )}
                        </View>
                      );
                    })}

                    {/* Share button */}
                    <Pressable
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

                    {/* Disclaimer */}
                    <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 16, marginTop: 4, paddingHorizontal: 8 }}>
                      Correlation between donations and votes does not imply causation. All data from AEC declarations and APH voting records.
                    </Text>
                  </View>
                );
              })()}
            </View>
          ) : activeTab === 'interests' ? (
            interestsLoading ? (
              [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={10} style={{ marginBottom: 10 }} />)
            ) : allInterests.length === 0 ? (
              <View style={styles.speechEmptyState}>
                <Ionicons name="document-text-outline" size={28} color={colors.borderStrong} />
                <Text style={[styles.speechEmptyText, { color: colors.textMuted }]}>No registered interests on file.</Text>
                <Text style={[styles.speechEmptySubtext, { color: colors.textMuted }]}>
                  {member.chamber === 'house'
                    ? 'House of Representatives interest data coming soon.'
                    : 'Interest declarations will appear once filed with the Senate.'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.fundingSubhead, { color: colors.textMuted }]}>
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
                      <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                        {category} ({items.length})
                      </Text>
                    </View>
                    {items.map(item => (
                      <View key={item.id} style={[styles.speechCard, { backgroundColor: colors.card, marginBottom: 6 }]}>
                        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, lineHeight: 18 }}>
                          {decodeHtml(item.description)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
                {allInterests[0]?.source_url && (
                  <Pressable onPress={() => Linking.openURL(allInterests[0].source_url!)}>
                    <Text style={[styles.fundingFooter, { color: colors.green }]}>
                      Source: Senate Register of Interests <Ionicons name="open-outline" size={11} color={colors.green} />
                    </Text>
                  </Pressable>
                )}
                {allInterests[0]?.date_registered && (
                  <Text style={[styles.fundingFooter, { color: colors.textMuted, marginTop: 4 }]}>
                    Last updated: {allInterests[0].date_registered}
                  </Text>
                )}
              </>
            )
          ) : activeTab === 'speeches' ? (
            hansardLoading ? (
              [1, 2, 3].map(i => <SkeletonLoader key={i} height={80} borderRadius={10} style={{ marginBottom: 10 }} />)
            ) : hansardEntries.length === 0 ? (
              <View style={styles.speechEmptyState}>
                <Ionicons name="mic-outline" size={28} color={colors.borderStrong} />
                <Text style={[styles.speechEmptyText, { color: colors.textMuted }]}>No recent speeches found.</Text>
                <Text style={[styles.speechEmptySubtext, { color: colors.textMuted }]}>Speeches appear once Hansard data is loaded for this MP.</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.fundingSubhead, { color: colors.textMuted }]}>Recent Speeches</Text>
                {hansardEntries.map(entry => (
                  <Pressable
                    key={entry.id}
                    style={[styles.speechCard, { backgroundColor: colors.card }]}
                    onPress={() => entry.source_url && Linking.openURL(entry.source_url)}
                  >
                    <View style={styles.speechHeader}>
                      <Text style={[styles.speechDate, { color: colors.textMuted }]}>
                        {timeAgo(entry.date)}
                      </Text>
                      {entry.source_url && <Ionicons name="open-outline" size={13} color={colors.textMuted} />}
                    </View>
                    {entry.debate_topic ? (
                      <Text style={[styles.speechTopic, { color: colors.text }]} numberOfLines={1}>{entry.debate_topic}</Text>
                    ) : null}
                    {entry.excerpt ? (
                      <Text style={[styles.speechExcerpt, { color: colors.textBody }]} numberOfLines={3}>{decodeHtml(entry.excerpt)}</Text>
                    ) : null}
                  </Pressable>
                ))}
                <Text style={[styles.fundingFooter, { color: colors.textMuted }]}>Source: OpenAustralia / APH Hansard</Text>
              </>
            )
          ) : activeTab === 'watchlist' ? (
            contradictionsLoading ? (
              [1, 2, 3].map(i => <SkeletonLoader key={i} height={100} borderRadius={14} style={{ marginBottom: 10 }} />)
            ) : contradictions.length === 0 ? (
              <View style={styles.speechEmptyState}>
                <Ionicons name="shield-checkmark-outline" size={28} color={colors.borderStrong} />
                <Text style={[styles.speechEmptyText, { color: colors.textMuted }]}>No contradictions found</Text>
                <Text style={[styles.speechEmptySubtext, { color: colors.textMuted }]}>
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
            )
          ) : (
            <View style={styles.aboutSection}>
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Chamber</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>{member.chamber === 'senate' ? 'Senate' : 'House of Representatives'}</Text>
              {member.electorate && (
                <>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Electorate</Text>
                  <Text style={[styles.aboutValue, { color: colors.text }]}>{member.electorate.name}, {member.electorate.state}</Text>
                </>
              )}
              {member.ministerial_role && (
                <>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Current Role</Text>
                  <Text style={[styles.aboutValue, { color: colors.text }]}>{member.ministerial_role}</Text>
                </>
              )}
              {member.email && (
                <>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Email</Text>
                  <Text style={[styles.aboutValue, styles.link, { color: colors.green }]} onPress={() => Linking.openURL(`mailto:${member.email}`)} >{member.email}</Text>
                </>
              )}
              {member.phone && (
                <>
                  <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>Phone</Text>
                  <Text style={[styles.aboutValue, { color: colors.text }]}>{member.phone}</Text>
                </>
              )}

              {/* Committee memberships */}
              {committeesLoading ? (
                <SkeletonLoader height={20} borderRadius={4} style={{ marginTop: 16 }} />
              ) : committees.length > 0 ? (
                <>
                  <Text style={[styles.aboutLabel, { marginTop: 16, color: colors.textMuted }]}>Current Committees</Text>
                  {committees.map(c => (
                    <View key={c.id} style={[styles.committeeRow, { borderBottomColor: colors.border }]}>
                      <View style={styles.committeeLeft}>
                        <Text style={[styles.committeeName, { color: colors.text }]}>{c.committee_name}</Text>
                        {c.committee_type && (
                          <Text style={[styles.committeeType, { color: colors.textMuted }]}>
                            {c.committee_type.charAt(0).toUpperCase() + c.committee_type.slice(1)}
                          </Text>
                        )}
                      </View>
                      {c.role !== 'member' && (
                        <View style={styles.committeeRoleBadge}>
                          <Text style={styles.committeeRoleText}>
                            {c.role.charAt(0).toUpperCase() + c.role.slice(1)}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </>
              ) : null}

              {/* Electorate Demographics (Census 2021) */}
              {demographics && member.electorate && (
                <View style={{ marginTop: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Ionicons name="people-outline" size={16} color={colors.green} />
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                      {member.electorate.name} Demographics
                    </Text>
                    <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>(Census 2021)</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {demographics.median_household_income_weekly != null && (
                      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Median Household Income</Text>
                        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>${Math.round(demographics.median_household_income_weekly * 52).toLocaleString()}/yr</Text>
                      </View>
                    )}
                    {demographics.median_age != null && (
                      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Median Age</Text>
                        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{demographics.median_age}</Text>
                      </View>
                    )}
                    {demographics.median_rent_weekly != null && (
                      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Median Rent</Text>
                        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>${demographics.median_rent_weekly}/wk</Text>
                      </View>
                    )}
                    {demographics.pct_renting != null && (
                      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, minWidth: '45%', flex: 1 }}>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Renters</Text>
                        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{demographics.pct_renting}%</Text>
                      </View>
                    )}
                  </View>
                  {demographics.top_industries && demographics.top_industries.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginBottom: 4 }}>Top Industries</Text>
                      {demographics.top_industries.slice(0, 3).map((ind, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.text }}>{ind.name}</Text>
                          </View>
                          <View style={{ backgroundColor: colors.green + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.green }}>{ind.pct}%</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Government Contracts in Electorate */}
              {contractSummary.contract_count > 0 && member.electorate && (
                <View style={{ marginTop: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Ionicons name="document-text-outline" size={16} color={colors.green} />
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                      Federal Contracts in {member.electorate.name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, flex: 1 }}>
                      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Total Value (30d)</Text>
                      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                        ${contractSummary.total_value >= 1000000
                          ? `${(contractSummary.total_value / 1000000).toFixed(1)}M`
                          : contractSummary.total_value >= 1000
                            ? `${(contractSummary.total_value / 1000).toFixed(0)}K`
                            : contractSummary.total_value.toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, flex: 1 }}>
                      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Contracts</Text>
                      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                        {contractSummary.contract_count}
                      </Text>
                    </View>
                  </View>
                  {contractSummary.top_agencies.length > 0 && (
                    <>
                      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginBottom: 4 }}>Top Agencies</Text>
                      {contractSummary.top_agencies.slice(0, 3).map((a, idx) => (
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
              )}
            </View>
          )}
          {/* Claim profile link — only shown if not yet claimed */}
          {!official && (
            <Pressable
              style={styles.claimLink}
              onPress={() => navigation.navigate('ClaimProfile', { member })}
            >
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.claimLinkText, { color: colors.textMuted }]}>Are you this MP? Claim your verified profile</Text>
            </Pressable>
          )}

          {/* About the data — what this profile does and doesn't capture */}
          <View style={{ marginHorizontal: 20, marginTop: 20, marginBottom: 32, backgroundColor: colors.surface, borderRadius: 12, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                About this data
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19 }}>
              This profile is built from public APH division records, Hansard transcripts, committee listings, and AEC donation returns. It does <Text style={{ fontWeight: '700' }}>not</Text> capture party room decisions, cabinet deliberations, constituency casework, backbench negotiation, or private conversations with colleagues. Roughly 85% of political work happens outside the chamber and is not publicly recorded.
            </Text>
            <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginTop: 8 }}>
              Paired absences (where an MP is absent by formal agreement with an opposition MP) are excluded from the attendance rate. Donation data links individual contributions to named politicians through AEC returns — it does not prove causation between a donation and a vote.
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 10, fontStyle: 'italic' }}>
              Something looks wrong? Tap "Claim profile" above or email corrections@verity.run.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Hidden share card containers — offscreen, captured by react-native-view-shot */}
      <View style={styles.offscreen} pointerEvents="none">
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

      {/* FAB — only visible to the verified owner */}
      {isOwner && (
        <Pressable
          style={styles.fab}
          onPress={() => navigation.navigate('CreatePost', { member, officialId: official?.id })}
        >
          <Ionicons name="create" size={24} color="#ffffff" />
        </Pressable>
      )}
      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg + 4, paddingTop: SPACING.lg + 4 },
  back: { padding: 0 },
  shareBtn: { padding: SPACING.xs },
  hero: { alignItems: 'center', padding: SPACING.xl, paddingBottom: SPACING.xxl, gap: SPACING.sm + 2, position: 'relative' },
  heroFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SPACING.xl,
    flexDirection: 'column',
  },
  photoContainer: { borderRadius: 50, borderWidth: 3, overflow: 'hidden' },
  photo: { width: 96, height: 96 },
  photoPlaceholder: { width: 96, height: 96, justifyContent: 'center', alignItems: 'center' },
  initials: { fontSize: 32, fontWeight: FONT_WEIGHT.bold },
  nameVerifiedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2 },
  name: { fontSize: 22, fontWeight: FONT_WEIGHT.bold },
  electorate: { fontSize: FONT_SIZE.small },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg + 4,
    marginHorizontal: SPACING.lg + 4,
    borderRadius: BORDER_RADIUS.md + 2,
    marginBottom: SPACING.lg,
  },
  statDivider: { width: 1, marginVertical: SPACING.xs },
  actionRow: {
    flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm + 2,
    marginBottom: SPACING.lg, paddingHorizontal: SPACING.lg + 4,
  },
  reportCardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: '#00843D',
  },
  reportCardBtnText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#00843D' },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: '#00843D',
  },
  followBtnActive: { backgroundColor: '#00843D' },
  followBtnText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#00843D' },
  followBtnTextActive: { color: '#ffffff' },
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + 2,
    marginHorizontal: SPACING.lg + 4,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    paddingVertical: SPACING.sm + 2,
  },
  writeBtnText: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold, color: '#00843D' },
  voteShareBtn: { padding: SPACING.xs, marginLeft: SPACING.xs },
  offscreen: { position: 'absolute', left: -9999, top: 0 },
  contactRow: { flexDirection: 'row', gap: SPACING.sm + 2, paddingHorizontal: SPACING.lg + 4, marginBottom: SPACING.lg + 4 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2, backgroundColor: '#e8f5ee', borderRadius: BORDER_RADIUS.md, padding: SPACING.md, justifyContent: 'center' },
  contactLabel: { fontSize: FONT_SIZE.small + 1, color: '#00843D', fontWeight: FONT_WEIGHT.semibold },
  tabs: { flexDirection: 'row', paddingHorizontal: SPACING.lg + 4, borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: SPACING.md + 2, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#00843D' },
  tabText: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.medium },
  activeTabText: { fontWeight: FONT_WEIGHT.bold },
  tabContent: { padding: SPACING.lg + 4 },
  voteCard: {
    borderRadius: BORDER_RADIUS.md + 2,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm + 2,
    ...SHADOWS.sm,
  },
  voteCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  voteInfo: { flex: 1 },
  voteBillTitle: { fontSize: FONT_SIZE.small, lineHeight: 18 },
  voteMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  voteDate: { fontSize: FONT_SIZE.caption },
  rebelBadge: { fontSize: 10, color: '#b45309', backgroundColor: '#fef3c7', borderRadius: BORDER_RADIUS.sm - 2, paddingHorizontal: SPACING.xs + 2, paddingVertical: 1, fontWeight: FONT_WEIGHT.bold },
  voteProceduralTitle: { fontSize: FONT_SIZE.small - 1, lineHeight: 17 },
  showMoreBtn: { alignItems: 'center', paddingVertical: SPACING.md, marginTop: SPACING.xs },
  showMoreText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold },
  empty: { textAlign: 'center', fontSize: FONT_SIZE.small + 1, marginTop: SPACING.lg + 4 },
  proGate: {
    marginHorizontal: SPACING.lg + 4, marginBottom: SPACING.lg, backgroundColor: '#fffbeb', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg + 4, alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: '#fde68a',
  },
  proGateIcon: { fontSize: 28 },
  proGateTitle: { fontSize: FONT_SIZE.subtitle - 1, fontWeight: FONT_WEIGHT.bold },
  proGateBody: { fontSize: FONT_SIZE.small, textAlign: 'center', lineHeight: 19 },
  proGateBtn: { marginTop: SPACING.xs, backgroundColor: '#00843D', borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg + 4, paddingVertical: SPACING.sm + 2 },
  proGateBtnText: { color: '#ffffff', fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.small + 1 },
  proCard: { marginHorizontal: SPACING.lg + 4, marginBottom: SPACING.lg, borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.lg },
  proCardText: { fontSize: FONT_SIZE.small + 1, fontStyle: 'italic' },
  aboutSection: { gap: SPACING.xs },
  aboutLabel: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.semibold, textTransform: 'uppercase', marginTop: SPACING.md },
  aboutValue: { fontSize: FONT_SIZE.body },
  link: {},
  ministerialBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: BORDER_RADIUS.sm + 2, paddingHorizontal: SPACING.sm + 2, paddingVertical: 5, maxWidth: '90%' },
  ministerialBadgeText: { fontSize: FONT_SIZE.small - 1, fontWeight: FONT_WEIGHT.semibold, flexShrink: 1 },
  committeeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1 },
  committeeLeft: { flex: 1, marginRight: SPACING.sm },
  committeeName: { fontSize: FONT_SIZE.small, lineHeight: 18 },
  committeeType: { fontSize: FONT_SIZE.caption, marginTop: 1 },
  committeeRoleBadge: { backgroundColor: '#e8f5ee', borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  committeeRoleText: { fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#00843D' },
  fundingToggle: { flexDirection: 'row', borderRadius: BORDER_RADIUS.md, padding: 3, marginBottom: SPACING.lg },
  fundingToggleBtn: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: BORDER_RADIUS.sm + 2 },
  fundingToggleBtnActive: { ...SHADOWS.sm },
  fundingToggleBtnText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold },
  fundingToggleBtnTextActive: {},
  fundingEmptyState: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  fundingEmptyText: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.semibold },
  fundingEmptySubtext: { fontSize: FONT_SIZE.small - 1, textAlign: 'center', lineHeight: 17, paddingHorizontal: SPACING.sm },
  fundingSubhead: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, textTransform: 'uppercase', marginBottom: SPACING.md },
  donationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm + 2, borderBottomWidth: 1 },
  donationLeft: { flex: 1, marginRight: SPACING.sm + 2 },
  donorName: { fontSize: FONT_SIZE.small, lineHeight: 18 },
  donorFY: { fontSize: FONT_SIZE.caption, marginTop: 2 },
  donationRight: { alignItems: 'flex-end', gap: SPACING.xs },
  donorTypeBadge: { borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  donorTypeText: { fontSize: 10, fontWeight: FONT_WEIGHT.bold },
  donorAmount: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.bold },
  fundingFooter: { fontSize: FONT_SIZE.caption, marginTop: SPACING.lg, textAlign: 'center' },
  voteSummaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  voteSummaryText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold },
  speechEmptyState: { alignItems: 'center', paddingVertical: SPACING.xxl - 4, gap: SPACING.sm },
  speechEmptyText: { fontSize: FONT_SIZE.small + 1, fontWeight: FONT_WEIGHT.semibold },
  speechEmptySubtext: { fontSize: FONT_SIZE.small - 1, textAlign: 'center', lineHeight: 17, paddingHorizontal: SPACING.sm },
  speechCard: {
    borderRadius: BORDER_RADIUS.md + 2, padding: SPACING.md + 2,
    marginBottom: SPACING.sm + 2,
    ...SHADOWS.sm,
  },
  speechHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  speechDate: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold },
  speechTopic: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.xs },
  speechExcerpt: { fontSize: FONT_SIZE.small - 1, lineHeight: 18 },
  claimLink: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs + 2,
    justifyContent: 'center', paddingVertical: SPACING.xl,
  },
  claimLinkText: { fontSize: FONT_SIZE.small },
  fab: {
    position: 'absolute', bottom: SPACING.xl, right: SPACING.xl,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#00843D',
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.lg,
  },
});
