import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Share,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Bill } from '../hooks/useBills';
import { useBillVotes } from '../hooks/useBillVotes';
import { useBillDivisions } from '../hooks/useBillDivisions';
import { useReactions } from '../hooks/useReactions';
import { useUser } from '../context/UserContext';
import { useSubscription } from '../hooks/useSubscription';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { StatusBadge } from '../components/StatusBadge';
import { PartyBadge } from '../components/PartyBadge';
import { ReactionButtons } from '../components/ReactionButtons';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { trackEngagement } from '../hooks/useEngagementScore';
import { BillShareCard } from '../components/ShareCards';
import { captureAndShare } from '../utils/shareContent';
import { useFollow } from '../hooks/useFollow';
import { useTheme } from '../context/ThemeContext';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { track } from '../lib/analytics';
import { SHADOWS } from '../constants/design';

interface Argument {
  id: string;
  side: 'for' | 'against';
  argument_text: string;
}

// ─── Chamber badge ────────────────────────────────────────────────────────────

function ChamberBadge({ chamber }: { chamber: string | null }) {
  const { colors } = useTheme();
  if (!chamber) return null;
  const raw = chamber.toLowerCase();
  const label = raw.includes('senate') ? 'Senate' : raw.includes('house') ? 'House' : null;
  if (!label) return null;
  return (
    <View style={[styles.chamberBadge, { backgroundColor: colors.cardAlt }]}>
      <Text style={[styles.chamberText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ aye, no, absent }: { aye: number; no: number; absent: number }) {
  const { colors } = useTheme();
  const total = aye + no + absent;
  if (total === 0) return null;
  const ayePct = Math.round((aye / total) * 100);
  const noPct = Math.round((no / total) * 100);
  const absPct = 100 - ayePct - noPct;

  return (
    <View style={styles.voteSection}>
      {/* Bar */}
      <View style={[styles.voteBar, { backgroundColor: colors.cardAlt }]}>
        {aye > 0 && <View style={[styles.voteSegment, { flex: aye, backgroundColor: '#00843D' }]} />}
        {no > 0 && <View style={[styles.voteSegment, { flex: no, backgroundColor: '#DC3545' }]} />}
        {absent > 0 && <View style={[styles.voteSegment, { flex: absent, backgroundColor: colors.borderStrong }]} />}
      </View>
      {/* Legend */}
      <View style={styles.voteLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00843D' }]} />
          <Text style={[styles.legendLabel, { color: colors.textBody }]}>Aye</Text>
          <Text style={[styles.legendValue, { color: colors.text }]}>{aye} ({ayePct}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#DC3545' }]} />
          <Text style={[styles.legendLabel, { color: colors.textBody }]}>No</Text>
          <Text style={[styles.legendValue, { color: colors.text }]}>{no} ({noPct}%)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.legendLabel, { color: colors.textBody }]}>Absent</Text>
          <Text style={[styles.legendValue, { color: colors.text }]}>{absent} ({absPct}%)</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanDivisionTitle(name: string): string {
  return name.replace(/^Bills?\s*[—\-]\s*/i, '').trim();
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function BillDetailScreen({ route, navigation }: any) {
  const { bill: billParam, billId } = route.params as { bill?: Bill; billId?: string };
  const [bill, setBill] = useState<Bill | null>(billParam ?? null);

  useEffect(() => {
    if (!bill && billId) {
      supabase.from('bills').select('*').eq('id', billId).single()
        .then(({ data }) => { if (data) setBill(data as Bill); });
    }
  }, [billId]);

  const { postcode, user } = useUser();
  const { isPro } = useSubscription(user?.id);

  // Track engagement on mount
  useEffect(() => {
    if (bill) {
      track('bill_detail_view', { bill_id: bill.id, title: bill.short_title || bill.title }, 'BillDetail');
      if (user) trackEngagement(user.id, 'bill_read', bill.categories?.[0]);
    }
  }, [bill?.id, user?.id]);

  const { votes, loading: votesLoading } = useBillVotes(bill?.id ?? '');
  const { divisions: relatedDivisions, loading: divisionsLoading } = useBillDivisions(bill ?? ({} as Bill));
  const { likes, dislikes, userReaction, react } = useReactions('bill', bill?.id ?? '');
  const { member: myMP } = useElectorateByPostcode(postcode);
  const { following: bookmarked, toggle: toggleBookmark } = useFollow('bill', bill?.id ?? '');
  const { colors } = useTheme();
  const { requireAuth, authSheetProps } = useAuthGate();

  if (!bill) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <SkeletonLoader width="100%" height={200} />
      </SafeAreaView>
    );
  }

  const [args, setArgs] = useState<Argument[]>([]);
  const [argsLoading, setArgsLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('bill_arguments')
      .select('id,side,argument_text')
      .eq('bill_id', bill.id)
      .then(({ data }) => {
        setArgs((data as Argument[]) || []);
        setArgsLoading(false);
      });
  }, [bill.id]);

  const forArgs = args.filter(a => a.side === 'for');
  const againstArgs = args.filter(a => a.side === 'against');

  const ayeVotes = votes.filter(v => v.vote === 'aye').length;
  const noVotes = votes.filter(v => v.vote === 'no').length;
  const absentVotes = votes.filter(v => v.vote === 'absent' || v.vote === 'abstain').length;
  const totalVotes = votes.length;

  const divAyeTotal = relatedDivisions.reduce((s, d) => s + (d.aye_votes || 0), 0);
  const divNoTotal  = relatedDivisions.reduce((s, d) => s + (d.no_votes  || 0), 0);

  // Find user's MP's vote on this bill
  const myMPVote = myMP
    ? votes.find(v => v.member_id === myMP.id)
    : null;

  const billCardRef = useRef<any>(null);
  const [showBillCard, setShowBillCard] = useState(false);

  useEffect(() => {
    if (showBillCard) {
      captureAndShare(billCardRef, 'bill', bill.id, user?.id)
        .finally(() => setShowBillCard(false));
    }
  }, [showBillCard]);

  const handleShare = () => {
    setShowBillCard(true);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return timeAgo(iso);
  };

  const voteColour = (v: string) => {
    if (v === 'aye') return '#00843D';
    if (v === 'no') return '#DC3545';
    return '#9aabb8';
  };

  const voteLabel = (v: string) =>
    v === 'aye' ? 'AYE' : v === 'no' ? 'NO' : v.toUpperCase();

  const chamberRaw = bill.chamber_introduced || (bill as any).origin_chamber || '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ── Nav bar ────────────────────────────────────────── */}
      <View style={[styles.navBar, { backgroundColor: colors.background }]}>
        <Pressable
          style={[styles.navBtn, { backgroundColor: colors.cardAlt }]}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.navRight}>
          <Pressable style={[styles.navBtn, { backgroundColor: colors.cardAlt }]} onPress={() => requireAuth('save this bill', toggleBookmark)} hitSlop={8}>
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={bookmarked ? '#00843D' : colors.text}
            />
          </Pressable>
          <Pressable style={[styles.navBtn, { backgroundColor: colors.cardAlt }]} onPress={handleShare} hitSlop={8}>
            <Ionicons
              name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
              size={22}
              color={colors.text}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { if (billId) { supabase.from('bills').select('*').eq('id', billId).single().then(({ data }) => { if (data) setBill(data as Bill); }); } }} tintColor="#00843D" />}
      >
        {/* ── Title block ────────────────────────────────── */}
        <View style={styles.titleBlock}>
          <View style={styles.badgeRow}>
            <StatusBadge status={bill.current_status || bill.status} />
            <ChamberBadge chamber={chamberRaw} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{bill.title}</Text>

          {/* Dates */}
          <View style={styles.metaRow}>
            {bill.date_introduced && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={13} color="#9aabb8" />
                <Text style={styles.metaText}>
                  Introduced {formatDate(bill.date_introduced)}
                </Text>
              </View>
            )}
            {bill.last_updated && (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color="#9aabb8" />
                <Text style={styles.metaText}>
                  Updated {formatDate(bill.last_updated)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Lifecycle Timeline ───────────────────────────── */}
        {(() => {
          const STAGES = [
            { key: 'introduced', label: 'Introduced' },
            { key: 'committee', label: 'Committee' },
            { key: 'debate', label: 'Debate' },
            { key: 'voted', label: 'Voted' },
            { key: 'outcome', label: 'Outcome' },
          ];
          const status = (bill.current_status || bill.status || '').toLowerCase();
          const getStageIndex = (): number => {
            if (status.includes('assent') || status.includes('act')) return 5;
            if (status.includes('passed') || status.includes('defeated') || status.includes('withdrawn') || status.includes('lapsed')) return 4;
            if (status.includes('third') || status.includes('vote') || status.includes('division')) return 3;
            if (status.includes('second') || status.includes('debate') || status.includes('reading')) return 2;
            if (status.includes('committee') || status.includes('referred') || status.includes('inquiry')) return 1;
            if (status.includes('introduced') || status.includes('first')) return 0;
            return 0;
          };
          const currentStage = getStageIndex();
          const isFinal = currentStage >= 4;
          const isPassed = status.includes('passed') || status.includes('assent') || status.includes('act');

          return (
            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {STAGES.map((stage, i) => {
                  const isActive = i <= currentStage;
                  const isCurrent = i === currentStage || (isFinal && i === 4);
                  const dotColor = isFinal && i === 4
                    ? (isPassed ? '#00843D' : '#DC3545')
                    : isActive ? '#00843D' : '#E5E7EB';
                  return (
                    <View key={stage.key} style={{ alignItems: 'center', flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                        {i > 0 && (
                          <View style={{ flex: 1, height: 3, backgroundColor: isActive ? '#00843D' : '#E5E7EB', borderRadius: 2 }} />
                        )}
                        <View style={{
                          width: isCurrent ? 14 : 10,
                          height: isCurrent ? 14 : 10,
                          borderRadius: 7,
                          backgroundColor: dotColor,
                          borderWidth: isCurrent ? 2 : 0,
                          borderColor: isFinal && i === 4 ? (isPassed ? '#00843D' : '#DC3545') : '#00843D',
                        }} />
                        {i < STAGES.length - 1 && (
                          <View style={{ flex: 1, height: 3, backgroundColor: i < currentStage ? '#00843D' : '#E5E7EB', borderRadius: 2 }} />
                        )}
                      </View>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: isCurrent ? '700' : '500',
                        color: isActive ? '#1A1A1A' : '#9CA3AF',
                        marginTop: 4,
                        textAlign: 'center',
                      }}>
                        {i === 4 && isFinal ? (isPassed ? 'Passed' : 'Failed') : stage.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

        {/* ── Plain English Summary ──────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.cardInner, styles.summaryCard]}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={15} color="#00843D" />
              <Text style={styles.cardTitle}>Plain English Summary</Text>
            </View>
            {bill.summary_plain ? (
              <Text style={[styles.summaryText, { color: colors.text }]}>{decodeHtml(bill.summary_plain)}</Text>
            ) : bill.summary_full ? (
              <>
                <Text style={styles.summaryFallbackNote}>
                  Plain-English summary not yet available. Here's the official summary:
                </Text>
                <Text style={[styles.summaryText, { color: colors.text }]}>{decodeHtml(bill.summary_full)}</Text>
              </>
            ) : (
              <View style={styles.comingSoon}>
                <Ionicons name="document-outline" size={20} color="#9aabb8" />
                <Text style={styles.comingSoonText}>
                  No plain-English summary available for this bill.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Who This Affects ─────────────────────────────── */}
        {(() => {
          const IMPACT_TAGS: Record<string, { keywords: string[]; label: string; icon: string }> = {
            renters: { keywords: ['rent', 'tenant', 'lease', 'housing', 'build-to-rent'], label: 'Renters', icon: 'home-outline' },
            homeowners: { keywords: ['mortgage', 'property', 'stamp duty', 'home owner', 'homeowner'], label: 'Homeowners', icon: 'business-outline' },
            parents: { keywords: ['child', 'parent', 'family', 'childcare', 'school', 'parental'], label: 'Parents & Families', icon: 'people-outline' },
            students: { keywords: ['student', 'university', 'tafe', 'education', 'hecs', 'scholarship'], label: 'Students', icon: 'school-outline' },
            retirees: { keywords: ['pension', 'superannuation', 'super', 'retire', 'aged care', 'elder'], label: 'Retirees', icon: 'heart-outline' },
            workers: { keywords: ['wage', 'worker', 'employment', 'workplace', 'industrial', 'union', 'fair work'], label: 'Workers', icon: 'hammer-outline' },
            smallbiz: { keywords: ['small business', 'startup', 'entrepreneur', 'sme', 'gst', 'abn'], label: 'Small Business', icon: 'storefront-outline' },
            environment: { keywords: ['climate', 'emission', 'environment', 'renewable', 'carbon', 'pollution'], label: 'Environment', icon: 'leaf-outline' },
            health: { keywords: ['health', 'medical', 'hospital', 'medicare', 'pharmaceutical', 'mental health'], label: 'Healthcare', icon: 'medkit-outline' },
            veterans: { keywords: ['veteran', 'defence', 'military', 'service member', 'dva'], label: 'Veterans', icon: 'shield-outline' },
          };
          const text = ((bill.title || '') + ' ' + (bill.summary_plain || '') + ' ' + (bill.summary_full || '')).toLowerCase();
          const matched = Object.entries(IMPACT_TAGS)
            .filter(([_, tag]) => tag.keywords.some(kw => text.includes(kw)))
            .map(([_, tag]) => tag);

          if (matched.length === 0) return null;

          return (
            <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 10, letterSpacing: 0.3 }}>WHO THIS AFFECTS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {matched.map(tag => (
                  <View key={tag.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 }}>
                    <Ionicons name={tag.icon as any} size={14} color="#00843D" />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#166534' }}>{tag.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* ── Key Arguments ──────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Arguments</Text>
          {argsLoading ? (
            <>
              <SkeletonLoader height={72} borderRadius={10} style={{ marginBottom: 8 }} />
              <SkeletonLoader height={72} borderRadius={10} />
            </>
          ) : forArgs.length === 0 && againstArgs.length === 0 ? (
            <View style={[styles.argsPlaceholder, { backgroundColor: colors.cardAlt }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
              <Text style={[styles.argsPlaceholderText, { color: colors.textMuted }]}>
                Arguments for this bill haven't been compiled yet.
              </Text>
            </View>
          ) : (
            <>
              {forArgs.map((a, i) => (
                <View key={a.id ?? i} style={{ flexDirection: 'row', gap: 12, backgroundColor: '#E8F5EE', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#00843D' }}>
                  <Ionicons name="checkmark-circle" size={18} color="#00843D" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#00843D', letterSpacing: 0.5, marginBottom: 4 }}>FOR</Text>
                    <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>{a.argument_text}</Text>
                  </View>
                </View>
              ))}
              {againstArgs.map((a, i) => (
                <View key={a.id ?? i} style={{ flexDirection: 'row', gap: 12, backgroundColor: '#FDECEA', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#DC3545' }}>
                  <Ionicons name="close-circle" size={18} color="#DC3545" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#DC3545', letterSpacing: 0.5, marginBottom: 4 }}>AGAINST</Text>
                    <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>{a.argument_text}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* ── AI Impact Analysis (Pro) ────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>AI Impact Analysis</Text>
          {isPro ? (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={styles.proPlaceholder}>Analysis coming soon for this bill.</Text>
            </View>
          ) : (
            <View style={styles.proGate}>
              <Ionicons name="star" size={32} color="#D4A843" />
              <Text style={[styles.proGateTitle, { color: colors.text }]}>Verity Pro</Text>
              <Text style={[styles.proGateBody, { color: colors.textBody }]}>
                See how this bill could affect your electorate, industry, and cost of living.
              </Text>
              <Pressable style={styles.proGateBtn} onPress={() => navigation.navigate('Subscription')}>
                <Text style={styles.proGateBtnText}>Unlock with Verity Pro</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── How Parliament Voted ───────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>How Parliament Voted</Text>
          {divisionsLoading ? (
            <SkeletonLoader height={80} borderRadius={10} />
          ) : relatedDivisions.length > 0 ? (
            <>
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.cardInner}>
                  {/* Numbers flanking the bar */}
                  <View style={styles.divBarRow}>
                    <View style={styles.divBarSide}>
                      <Text style={styles.divAyeNum}>{divAyeTotal}</Text>
                      <Text style={styles.divBarLabel}>Ayes</Text>
                    </View>
                    <View style={[styles.divBarTrack, { backgroundColor: colors.cardAlt }]}>
                      <View style={styles.divBarInner}>
                        {divAyeTotal + divNoTotal > 0 && (
                          <View style={[styles.divBarAye, { flex: divAyeTotal }]} />
                        )}
                        {divNoTotal > 0 && (
                          <View style={[styles.divBarNo, { flex: divNoTotal }]} />
                        )}
                      </View>
                    </View>
                    <View style={[styles.divBarSide, { alignItems: 'flex-end' }]}>
                      <Text style={styles.divNoNum}>{divNoTotal}</Text>
                      <Text style={styles.divBarLabel}>Noes</Text>
                    </View>
                  </View>
                  {/* Verdict */}
                  <View style={styles.divVerdictRow}>
                    <View style={[divAyeTotal > divNoTotal ? styles.passedBadge : styles.failedBadge, { backgroundColor: divAyeTotal > divNoTotal ? colors.greenBg : colors.redBg }]}>
                      <Text style={divAyeTotal > divNoTotal ? styles.passedText : styles.failedText}>
                        {divAyeTotal > divNoTotal ? 'PASSED' : 'NOT PASSED'}
                      </Text>
                    </View>
                    <Text style={styles.voteTotal}>
                      {relatedDivisions.length} division{relatedDivisions.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </View>
              {relatedDivisions.map(d => {
                const passed = d.aye_votes > d.no_votes;
                return (
                  <View key={d.id} style={[styles.divisionRow, { backgroundColor: colors.card }]}>
                    <View style={styles.divisionMeta}>
                      <Text style={styles.divisionDate}>
                        {timeAgo(d.date)}
                      </Text>
                      <View style={[passed ? styles.passedBadge : styles.failedBadge, { backgroundColor: passed ? colors.greenBg : colors.redBg }]}>
                        <Text style={passed ? styles.passedText : styles.failedText}>
                          {passed ? 'PASSED' : 'NOT PASSED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.divisionTitle, { color: colors.text }]} numberOfLines={2}>
                      {cleanDivisionTitle(d.name)}
                    </Text>
                    <Text style={styles.divisionCounts}>
                      Aye {d.aye_votes} · No {d.no_votes}
                    </Text>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={[styles.argsPlaceholder, { backgroundColor: colors.cardAlt }]}>
              <Ionicons name="information-circle-outline" size={20} color="#9aabb8" />
              <Text style={styles.argsPlaceholderText}>
                No recorded divisions for this bill yet.
              </Text>
            </View>
          )}
        </View>

        {/* ── Your MP's Vote ─────────────────────────────── */}
        {myMP && totalVotes > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your MP's Vote</Text>
            {myMPVote ? (
              <View
                style={[
                  styles.mpVoteCard,
                  { borderLeftColor: voteColour(myMPVote.vote), backgroundColor: colors.card },
                ]}
              >
                <View style={styles.mpVoteInfo}>
                  <Text style={[styles.mpVoteName, { color: colors.text }]}>
                    {myMP.first_name} {myMP.last_name}
                  </Text>
                  {myMP.party && (
                    <PartyBadge
                      name={myMP.party.short_name || myMP.party.abbreviation}
                      colour={myMP.party.colour}
                      size="sm"
                    />
                  )}
                </View>
                <View
                  style={[
                    styles.mpVoteBadge,
                    { backgroundColor: voteColour(myMPVote.vote) + '18' },
                  ]}
                >
                  <Text
                    style={[
                      styles.mpVoteLabel,
                      { color: voteColour(myMPVote.vote) },
                    ]}
                  >
                    {voteLabel(myMPVote.vote)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.surface }]}>
                <Text style={styles.emptyStateText}>
                  {myMP.first_name} {myMP.last_name}'s vote on this bill isn't recorded yet.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Write to MP ─────────────────────────────────── */}
        {myMP && (
          <Pressable
            style={[styles.writeToMPRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('WriteToMP', {
              member: myMP,
              fromBill: myMPVote ? {
                title: bill.title,
                vote: myMPVote.vote,
                date: (myMPVote as any).date ?? null,
              } : undefined,
            })}
          >
            <Ionicons name="mail-outline" size={16} color="#00843D" />
            <Text style={[styles.writeToMPText, { color: colors.text }]}>
              {myMPVote
                ? `Your MP voted ${myMPVote.vote.toUpperCase()} — tell ${myMP.first_name} what you think`
                : `Write to ${myMP.first_name} ${myMP.last_name} about this bill`}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </Pressable>
        )}

        {/* ── Reactions ──────────────────────────────────── */}
        <View style={[styles.reactionsSection, { backgroundColor: colors.card }]}>
          <Text style={[styles.reactionsLabel, { color: colors.textBody }]}>Was this useful?</Text>
          <ReactionButtons
            likes={likes}
            dislikes={dislikes}
            userReaction={userReaction}
            onLike={() => requireAuth('react to this bill', () => react('like'))}
            onDislike={() => requireAuth('react to this bill', () => react('dislike'))}
          />
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Hidden bill share card */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={billCardRef}>
          {showBillCard && (
            <BillShareCard
              title={bill.title}
              status={bill.current_status || bill.status}
              summaryPlain={bill.summary_plain}
              ayeVotes={divAyeTotal}
              noVotes={divNoTotal}
            />
          )}
        </View>
      </View>
      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFBFC' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 20 },

  // Nav
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navRight: { flexDirection: 'row', gap: 8 },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Title block
  titleBlock: { marginBottom: 20 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  chamberBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chamberText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a2332',
    lineHeight: 30,
    marginBottom: 12,
  },
  metaRow: { gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#9aabb8' },

  // Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    ...SHADOWS.sm,
    overflow: 'hidden',
  },
  cardInner: { padding: 16 },
  summaryCard: { borderLeftWidth: 4, borderLeftColor: '#00843D' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00843D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryFallbackNote: {
    fontSize: 12,
    color: '#9aabb8',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    color: '#1a2332',
    lineHeight: 24,
  },
  comingSoon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  comingSoonText: {
    flex: 1,
    fontSize: 14,
    color: '#9aabb8',
    lineHeight: 20,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: '#F9FAFB',
  },

  // Section
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a2332',
    marginBottom: 12,
  },

  // Arguments
  argCard: {
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    marginBottom: 8,
    gap: 6,
  },
  forCard: { backgroundColor: '#F0FBF5', borderLeftColor: '#00843D' },
  againstCard: { backgroundColor: '#FEF2F2', borderLeftColor: '#DC3545' },
  argLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  argLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  forLabel: { color: '#00843D' },
  againstLabel: { color: '#DC3545' },
  argText: { fontSize: 14, color: '#1a2332', lineHeight: 21 },

  // Vote bar
  voteSection: { gap: 12 },
  voteBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  voteSegment: { height: '100%' },
  voteLegend: { gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 13, color: '#5a6a7a', width: 50 },
  legendValue: { fontSize: 13, color: '#1a2332', fontWeight: '600' },
  voteTotal: {
    fontSize: 12,
    color: '#9aabb8',
    marginTop: 8,
    textAlign: 'right',
  },

  // My MP's vote
  mpVoteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  mpVoteInfo: { gap: 6 },
  mpVoteName: { fontSize: 15, fontWeight: '700', color: '#1a2332' },
  mpVoteBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  mpVoteLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Empty / placeholder state
  emptyState: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 16,
  },
  emptyStateText: {
    flex: 1,
    fontSize: 14,
    color: '#9aabb8',
    lineHeight: 20,
  },
  argsPlaceholder: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  argsPlaceholderText: {
    flex: 1,
    fontSize: 14,
    color: '#9aabb8',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  // Aggregate vote bar (How Parliament Voted)
  divBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  divBarSide: { alignItems: 'flex-start', minWidth: 36 },
  divAyeNum: { fontSize: 18, fontWeight: '800', color: '#00843D' },
  divNoNum: { fontSize: 18, fontWeight: '800', color: '#DC3545' },
  divBarLabel: { fontSize: 10, color: '#9aabb8', marginTop: 1 },
  divBarTrack: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  divBarInner: { flex: 1, flexDirection: 'row', height: '100%' },
  divBarAye: { backgroundColor: '#00843D' },
  divBarNo: { backgroundColor: '#DC3545' },
  divVerdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Pro gating
  proGate: {
    backgroundColor: '#fffbeb', borderRadius: 14, padding: 20, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#fde68a',
  },
  proGateTitle: { fontSize: 17, fontWeight: '800', color: '#1a2332' },
  proGateBody: { fontSize: 14, color: '#5a6a7a', textAlign: 'center', lineHeight: 20 },
  proGateBtn: {
    marginTop: 4, backgroundColor: '#00843D', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  proGateBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  proPlaceholder: { fontSize: 14, color: '#9aabb8', fontStyle: 'italic' },

  // Division rows
  divisionRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    ...SHADOWS.sm,
    gap: 4,
  },
  divisionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  divisionDate: { fontSize: 11, color: '#9aabb8' },
  divisionTitle: { fontSize: 13, color: '#1a2332', lineHeight: 18 },
  divisionCounts: { fontSize: 11, color: '#9aabb8' },
  passedBadge: { backgroundColor: '#e8f5ee', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  passedText: { fontSize: 10, fontWeight: '700', color: '#00843D' },
  failedBadge: { backgroundColor: '#fdecea', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  failedText: { fontSize: 10, fontWeight: '700', color: '#d32f2f' },

  // Write to MP
  writeToMPRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  writeToMPText: { flex: 1, fontSize: 14, fontWeight: '500' },

  // Reactions
  reactionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  reactionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5a6a7a',
  },
});
