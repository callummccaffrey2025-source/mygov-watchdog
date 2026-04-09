import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Share, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Member } from '../hooks/useMembers';
import { useVotes } from '../hooks/useVotes';
import { usePostsByMember } from '../hooks/useOfficialPosts';
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
import { captureAndShare } from '../utils/shareContent';
import { DivisionVote } from '../hooks/useVotes';
import { useFollow } from '../hooks/useFollow';
import { useTheme } from '../context/ThemeContext';
import { SHADOWS } from '../constants/design';
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
      supabase
        .from('members')
        .select('*, party:parties(name,short_name,colour,abbreviation), electorate:electorates(name,state)')
        .eq('id', memberId)
        .single()
        .then(({ data }) => { if (data) setMember(data as Member); });
    }
  }, [memberId]);

  const [activeTab, setActiveTab] = useState<'posts' | 'votes' | 'about' | 'funding' | 'speeches'>('posts');
  const [fundingView, setFundingView] = useState<'party' | 'personal'>('party');
  const [visibleCount, setVisibleCount] = useState(20);
  const { votes, loading: votesLoading } = useVotes(member?.id ?? null);

  useEffect(() => { setVisibleCount(20); }, [member?.id]);
  const { posts, loading: postsLoading } = usePostsByMember(member?.id);
  const { official } = useVerifiedOfficial(member?.id);
  const { user } = useUser();
  const isOwner = !!user && !!official && official.user_id === user.id;
  const { isPro } = useSubscription(user?.id);
  const { donations, loading: donationsLoading, totalAmount } = usePartyDonations(member?.party_id ?? undefined);
  const { donations: indDonations, total: indTotal, loading: indLoading } = useIndividualDonations(member?.id);
  const { current: committees, loading: committeesLoading } = useCommittees(member?.id);
  const { entries: hansardEntries, loading: hansardLoading } = useHansard(member?.id);

  const party = member?.party;
  const partyColour = party?.colour || '#9aabb8';
  const displayName = member ? `${member.first_name} ${member.last_name}` : '';

  const ayeCount = votes.filter(v => v.vote_cast === 'aye').length;
  const totalVotes = votes.length;

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
      <ScrollView showsVerticalScrollIndicator={false}>

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
            <View style={styles.ministerialBadge}>
              <Ionicons name="briefcase-outline" size={12} color="#5a6a7a" />
              <Text style={styles.ministerialBadgeText}>{member.ministerial_role}</Text>
            </View>
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

        {/* Share + Follow row */}
        <View style={styles.actionRow}>
          <Pressable style={styles.reportCardBtn} onPress={() => setShareReport(true)}>
            <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={15} color="#00843D" />
            <Text style={styles.reportCardBtnText}>Share Report Card</Text>
          </Pressable>
          <Pressable
            style={[styles.followBtn, { backgroundColor: followingMP ? '#00843D' : colors.background }, followingMP && styles.followBtnActive]}
            onPress={toggleFollow}
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

        {/* Write to MP */}
        <Pressable
          style={[styles.writeBtn, { borderColor: '#00843D' }]}
          onPress={() => navigation.navigate('WriteToMP', { member })}
        >
          <Ionicons name="mail-outline" size={16} color="#00843D" />
          <Text style={styles.writeBtnText}>Write to {member.first_name}</Text>
        </Pressable>

        {/* Advanced Analytics (Pro) */}
        {isPro ? (
          <View style={styles.proCard}>
            <Text style={styles.proCardText}>Advanced Analytics coming soon for this MP.</Text>
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

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          <Pressable style={[styles.tab, activeTab === 'posts' && styles.activeTab]} onPress={() => setActiveTab('posts')}>
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>Posts</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'votes' && styles.activeTab]} onPress={() => setActiveTab('votes')}>
            <Text style={[styles.tabText, activeTab === 'votes' && styles.activeTabText]}>Votes</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'about' && styles.activeTab]} onPress={() => setActiveTab('about')}>
            <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>About</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'funding' && styles.activeTab]} onPress={() => setActiveTab('funding')}>
            <Text style={[styles.tabText, activeTab === 'funding' && styles.activeTabText]}>Funding</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'speeches' && styles.activeTab]} onPress={() => setActiveTab('speeches')}>
            <Text style={[styles.tabText, activeTab === 'speeches' && styles.activeTabText]}>Speeches</Text>
          </Pressable>
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'posts' ? (
            postsLoading
              ? [1, 2, 3].map(i => <SkeletonLoader key={i} height={120} borderRadius={14} style={{ marginBottom: 10 }} />)
              : posts.length === 0
                ? <Text style={styles.empty}>This MP hasn't posted yet.</Text>
                : posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onPress={() => navigation.navigate('PostDetail', { post })}
                    />
                  ))
          ) : activeTab === 'votes' ? (
            votesLoading ? (
              [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
            ) : votes.length === 0 ? (
              <Text style={styles.empty}>No voting records available yet.</Text>
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
                          <Text style={styles.voteDate}>
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
                    <Text style={styles.showMoreText}>
                      Show {Math.min(20, votes.length - visibleCount)} more votes
                    </Text>
                  </Pressable>
                )}
              </>
            )
          ) : activeTab === 'funding' ? (
            <View>
              {/* Funding sub-toggle */}
              <View style={[styles.fundingToggle, { backgroundColor: colors.cardAlt }]}>
                <Pressable
                  style={[styles.fundingToggleBtn, fundingView === 'party' && styles.fundingToggleBtnActive, fundingView === 'party' && { backgroundColor: colors.card }]}
                  onPress={() => setFundingView('party')}
                >
                  <Text style={[styles.fundingToggleBtnText, fundingView === 'party' && styles.fundingToggleBtnTextActive, fundingView === 'party' && { color: colors.text }]}>
                    Party Funding
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.fundingToggleBtn, fundingView === 'personal' && styles.fundingToggleBtnActive, fundingView === 'personal' && { backgroundColor: colors.card }]}
                  onPress={() => setFundingView('personal')}
                >
                  <Text style={[styles.fundingToggleBtnText, fundingView === 'personal' && styles.fundingToggleBtnTextActive, fundingView === 'personal' && { color: colors.text }]}>
                    Personal Donations
                  </Text>
                </Pressable>
              </View>

              {fundingView === 'party' ? (
                donationsLoading ? (
                  [1, 2, 3].map(i => <SkeletonLoader key={i} height={60} borderRadius={8} style={{ marginBottom: 8 }} />)
                ) : (
                  <View>
                    <Text style={styles.fundingSubhead}>
                      Party donations — {member.party?.short_name || member.party?.name || ''}
                    </Text>
                    {donations.length === 0 ? (
                      <Text style={styles.empty}>No donation data available.</Text>
                    ) : (
                      <>
                        {donations.map(d => (
                          <View key={d.id} style={[styles.donationRow, { borderBottomColor: colors.border }]}>
                            <View style={styles.donationLeft}>
                              <Text style={[styles.donorName, { color: colors.text }]} numberOfLines={2}>{d.donor_name}</Text>
                              <Text style={styles.donorFY}>{d.financial_year}</Text>
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
                        <Text style={styles.fundingFooter}>
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
                    <Text style={styles.fundingSubhead}>
                      Donations to {member.first_name} {member.last_name}
                    </Text>
                    {indDonations.length === 0 ? (
                      <View style={styles.fundingEmptyState}>
                        <Ionicons name="receipt-outline" size={24} color="#c4cdd5" />
                        <Text style={styles.fundingEmptyText}>No personal donation records found.</Text>
                        <Text style={styles.fundingEmptySubtext}>
                          Most donations are made directly to parties. Individual disclosures appear when donors report donations to a specific candidate or MP.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {indDonations.map(d => (
                          <View key={d.id} style={[styles.donationRow, { borderBottomColor: colors.border }]}>
                            <View style={styles.donationLeft}>
                              <Text style={[styles.donorName, { color: colors.text }]} numberOfLines={2}>{d.donor_name}</Text>
                              <Text style={styles.donorFY}>{d.financial_year}</Text>
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
                        <Text style={styles.fundingFooter}>
                          Total declared: ${indTotal.toLocaleString('en-AU')} · Source: AEC
                        </Text>
                      </>
                    )}
                  </View>
                )
              )}
            </View>
          ) : activeTab === 'speeches' ? (
            hansardLoading ? (
              [1, 2, 3].map(i => <SkeletonLoader key={i} height={80} borderRadius={10} style={{ marginBottom: 10 }} />)
            ) : hansardEntries.length === 0 ? (
              <View style={styles.speechEmptyState}>
                <Ionicons name="mic-outline" size={28} color="#c4cdd5" />
                <Text style={styles.speechEmptyText}>No recent speeches found.</Text>
                <Text style={styles.speechEmptySubtext}>Speeches appear once Hansard data is loaded for this MP.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.fundingSubhead}>Recent Speeches</Text>
                {hansardEntries.map(entry => (
                  <Pressable
                    key={entry.id}
                    style={[styles.speechCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => entry.source_url && Linking.openURL(entry.source_url)}
                  >
                    <View style={styles.speechHeader}>
                      <Text style={styles.speechDate}>
                        {timeAgo(entry.date)}
                      </Text>
                      {entry.source_url && <Ionicons name="open-outline" size={13} color="#9aabb8" />}
                    </View>
                    {entry.debate_topic ? (
                      <Text style={[styles.speechTopic, { color: colors.text }]} numberOfLines={1}>{entry.debate_topic}</Text>
                    ) : null}
                    {entry.excerpt ? (
                      <Text style={[styles.speechExcerpt, { color: colors.textBody }]} numberOfLines={3}>{decodeHtml(entry.excerpt)}</Text>
                    ) : null}
                  </Pressable>
                ))}
                <Text style={styles.fundingFooter}>Source: OpenAustralia / APH Hansard</Text>
              </>
            )
          ) : (
            <View style={styles.aboutSection}>
              <Text style={styles.aboutLabel}>Chamber</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>{member.chamber === 'senate' ? 'Senate' : 'House of Representatives'}</Text>
              {member.electorate && (
                <>
                  <Text style={styles.aboutLabel}>Electorate</Text>
                  <Text style={[styles.aboutValue, { color: colors.text }]}>{member.electorate.name}, {member.electorate.state}</Text>
                </>
              )}
              {member.ministerial_role && (
                <>
                  <Text style={styles.aboutLabel}>Current Role</Text>
                  <Text style={[styles.aboutValue, { color: colors.text }]}>{member.ministerial_role}</Text>
                </>
              )}
              {member.email && (
                <>
                  <Text style={styles.aboutLabel}>Email</Text>
                  <Text style={[styles.aboutValue, styles.link]} onPress={() => Linking.openURL(`mailto:${member.email}`)} >{member.email}</Text>
                </>
              )}
              {member.phone && (
                <>
                  <Text style={styles.aboutLabel}>Phone</Text>
                  <Text style={[styles.aboutValue, { color: colors.text }]}>{member.phone}</Text>
                </>
              )}

              {/* Committee memberships */}
              {committeesLoading ? (
                <SkeletonLoader height={20} borderRadius={4} style={{ marginTop: 16 }} />
              ) : committees.length > 0 ? (
                <>
                  <Text style={[styles.aboutLabel, { marginTop: 16 }]}>Current Committees</Text>
                  {committees.map(c => (
                    <View key={c.id} style={[styles.committeeRow, { borderBottomColor: colors.border }]}>
                      <View style={styles.committeeLeft}>
                        <Text style={[styles.committeeName, { color: colors.text }]}>{c.committee_name}</Text>
                        {c.committee_type && (
                          <Text style={styles.committeeType}>
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
            </View>
          )}
          {/* Claim profile link — only shown if not yet claimed */}
          {!official && (
            <Pressable
              style={styles.claimLink}
              onPress={() => navigation.navigate('ClaimProfile', { member })}
            >
              <Ionicons name="shield-checkmark-outline" size={14} color="#9aabb8" />
              <Text style={styles.claimLinkText}>Are you this MP? Claim your verified profile</Text>
            </Pressable>
          )}
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
            <MPReportCard
              mpName={displayName}
              mpPhotoUrl={member.photo_url}
              partyName={party?.short_name || party?.name || ''}
              partyColour={partyColour}
              electorateName={member.electorate?.name ?? null}
              ministerialRole={member.ministerial_role}
              totalVotes={totalVotes}
              ayeRate={totalVotes > 0 ? Math.round((ayeCount / totalVotes) * 100) : null}
              committeeCount={committees.length}
              topDonors={topDonors}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20 },
  back: { padding: 0 },
  shareBtn: { padding: 4 },
  hero: { alignItems: 'center', padding: 24, paddingBottom: 32, gap: 10, position: 'relative' },
  heroFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    flexDirection: 'column',
  },
  photoContainer: { borderRadius: 50, borderWidth: 3, overflow: 'hidden' },
  photo: { width: 96, height: 96 },
  photoPlaceholder: { width: 96, height: 96, justifyContent: 'center', alignItems: 'center' },
  initials: { fontSize: 32, fontWeight: '700' },
  nameVerifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 22, fontWeight: '800', color: '#1a2332' },
  electorate: { fontSize: 13, color: '#5a6a7a' },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  actionRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 10,
    marginBottom: 16, paddingHorizontal: 20,
  },
  reportCardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#00843D',
  },
  reportCardBtnText: { fontSize: 13, fontWeight: '700', color: '#00843D' },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#00843D',
    backgroundColor: '#ffffff',
  },
  followBtnActive: { backgroundColor: '#00843D' },
  followBtnText: { fontSize: 13, fontWeight: '700', color: '#00843D' },
  followBtnTextActive: { color: '#ffffff' },
  writeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 10,
  },
  writeBtnText: { fontSize: 14, fontWeight: '700', color: '#00843D' },
  voteShareBtn: { padding: 4, marginLeft: 4 },
  offscreen: { position: 'absolute', left: -9999, top: 0 },
  contactRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8f5ee', borderRadius: 10, padding: 12, justifyContent: 'center' },
  contactLabel: { fontSize: 14, color: '#00843D', fontWeight: '600' },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#e8ecf0' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#00843D' },
  tabText: { fontSize: 14, color: '#9aabb8', fontWeight: '500' },
  activeTabText: { color: '#00843D', fontWeight: '700' },
  tabContent: { padding: 20 },
  voteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
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
  voteBillTitle: { fontSize: 13, color: '#1a2332', lineHeight: 18 },
  voteMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  voteDate: { fontSize: 11, color: '#9aabb8' },
  rebelBadge: { fontSize: 10, color: '#b45309', backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, fontWeight: '700' },
  voteProceduralTitle: { fontSize: 12, color: '#9aabb8', lineHeight: 17 },
  showMoreBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  showMoreText: { fontSize: 13, color: '#00843D', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9aabb8', fontSize: 14, marginTop: 20 },
  proGate: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#fffbeb', borderRadius: 14,
    padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#fde68a',
  },
  proGateIcon: { fontSize: 28 },
  proGateTitle: { fontSize: 16, fontWeight: '800', color: '#1a2332' },
  proGateBody: { fontSize: 13, color: '#5a6a7a', textAlign: 'center', lineHeight: 19 },
  proGateBtn: { marginTop: 4, backgroundColor: '#00843D', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  proGateBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  proCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#f0faf4', borderRadius: 12, padding: 16 },
  proCardText: { fontSize: 14, color: '#9aabb8', fontStyle: 'italic' },
  aboutSection: { gap: 4 },
  aboutLabel: { fontSize: 12, color: '#9aabb8', fontWeight: '600', textTransform: 'uppercase', marginTop: 12 },
  aboutValue: { fontSize: 15, color: '#1a2332' },
  link: { color: '#00843D' },
  ministerialBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f0f2f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '90%' },
  ministerialBadgeText: { fontSize: 12, color: '#5a6a7a', fontWeight: '600', flexShrink: 1 },
  committeeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  committeeLeft: { flex: 1, marginRight: 8 },
  committeeName: { fontSize: 13, color: '#1a2332', lineHeight: 18 },
  committeeType: { fontSize: 11, color: '#9aabb8', marginTop: 1 },
  committeeRoleBadge: { backgroundColor: '#e8f5ee', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  committeeRoleText: { fontSize: 10, fontWeight: '700', color: '#00843D' },
  fundingToggle: { flexDirection: 'row', backgroundColor: '#f0f2f5', borderRadius: 10, padding: 3, marginBottom: 16 },
  fundingToggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  fundingToggleBtnActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  fundingToggleBtnText: { fontSize: 13, fontWeight: '600', color: '#9aabb8' },
  fundingToggleBtnTextActive: { color: '#1a2332' },
  fundingEmptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  fundingEmptyText: { fontSize: 14, color: '#9aabb8', fontWeight: '600' },
  fundingEmptySubtext: { fontSize: 12, color: '#c4cdd5', textAlign: 'center', lineHeight: 17, paddingHorizontal: 8 },
  fundingSubhead: { fontSize: 13, fontWeight: '700', color: '#9aabb8', textTransform: 'uppercase', marginBottom: 12 },
  donationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  donationLeft: { flex: 1, marginRight: 10 },
  donorName: { fontSize: 13, color: '#1a2332', lineHeight: 18 },
  donorFY: { fontSize: 11, color: '#9aabb8', marginTop: 2 },
  donationRight: { alignItems: 'flex-end', gap: 4 },
  donorTypeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  donorTypeText: { fontSize: 10, fontWeight: '700' },
  donorAmount: { fontSize: 14, fontWeight: '700', color: '#1a2332' },
  fundingFooter: { fontSize: 11, color: '#9aabb8', marginTop: 16, textAlign: 'center' },
  voteSummaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#e8f5ee', borderRadius: 10, padding: 12, marginBottom: 12,
  },
  voteSummaryText: { fontSize: 13, fontWeight: '600', color: '#1a2332' },
  speechEmptyState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  speechEmptyText: { fontSize: 14, color: '#9aabb8', fontWeight: '600' },
  speechEmptySubtext: { fontSize: 12, color: '#c4cdd5', textAlign: 'center', lineHeight: 17, paddingHorizontal: 8 },
  speechCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#f0f2f5',
    ...SHADOWS.sm,
  },
  speechHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  speechDate: { fontSize: 11, color: '#9aabb8', fontWeight: '600' },
  speechTopic: { fontSize: 13, fontWeight: '700', color: '#1a2332', marginBottom: 4 },
  speechExcerpt: { fontSize: 12, color: '#5a6a7a', lineHeight: 18 },
  claimLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    justifyContent: 'center', paddingVertical: 24,
  },
  claimLinkText: { fontSize: 13, color: '#9aabb8' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#00843D',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
});
