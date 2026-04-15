import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useDailyBrief, DailyBriefData } from '../hooks/useDailyBrief';
import { useVotes, DivisionVote } from '../hooks/useVotes';
import { Bill } from '../hooks/useBills';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { topicBg, topicText } from '../constants/topicColors';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { decodeHtml } from '../utils/decodeHtml';

// ─── Civic Facts ─────────────────────────────────────────────────────────────

const CIVIC_FACTS = [
  'Australia has compulsory voting — over 96% of eligible citizens voted in the 2022 federal election.',
  'A bill must pass both the House of Representatives and the Senate before it becomes law.',
  'The Prime Minister is not directly elected — they lead whichever party holds majority support in the House.',
  'Australia became a federation on 1 January 1901 when six British colonies united.',
  'The Senate has 76 senators — 12 from each state and 2 each from the ACT and NT.',
  'The House of Representatives has 151 members, each representing one electoral division.',
  'Senators serve six-year terms; half are elected every three years at a regular election.',
  'The Governor-General represents the King as Australia\'s head of state.',
  'A double dissolution can be called when the Senate twice rejects a bill from the House.',
  'Australia\'s Constitution can only be changed by a referendum requiring a national majority in four of six states.',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBriefDate(dateStr: string | undefined): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  return d.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function cleanDivisionName(raw: string): string {
  return raw
    .replace(/^[A-Za-z\s]+\s*[—–]\s*/i, '')
    .replace(
      /\s*[-;]\s*(first|second|third|fourth|consideration|agree|pass|against|final|bill as passed).*$/i,
      '',
    )
    .trim();
}

function getStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Active';
  const s = status.toLowerCase();
  if (s.includes('passed') || s.includes('assent')) return 'Passed';
  if (s.includes('defeated') || s.includes('withdrawn')) return 'Defeated';
  if (s.includes('introduced')) return 'Introduced';
  if (s.includes('reading')) return 'In debate';
  return 'Active';
}

function statusColor(label: string): string {
  switch (label) {
    case 'Passed':
      return '#16a34a';
    case 'Defeated':
      return '#DC3545';
    case 'Introduced':
      return '#2563eb';
    case 'In debate':
      return '#d97706';
    default:
      return '#6b7280';
  }
}

function getDayOfYear(): number {
  const now = new Date();
  return Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
}

// ─── Section Label ───────────────────────────────────────────────────────────

function SectionLabel({ label, colors }: { label: string; colors: any }) {
  return (
    <Text
      style={[
        styles.sectionLabel,
        { color: colors.textMuted },
      ]}
    >
      {label}
    </Text>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export function DailyBriefScreen({ route, navigation }: any) {
  const { colors, isDark } = useTheme();
  const { postcode } = useUser();
  const { electorate, member: myMP } = useElectorateByPostcode(postcode ?? null);

  const electorateName = electorate?.name ?? null;

  const { brief, billsToWatch, loading, generating, refresh } = useDailyBrief(
    electorateName,
    myMP?.first_name && myMP?.last_name
      ? `${myMP.first_name} ${myMP.last_name}`
      : null,
  );

  const { votes } = useVotes(myMP?.id ?? null);

  const dateLabel = formatBriefDate(brief?.date);
  const hasAI = !!brief?.ai_text;
  const todayFact = CIVIC_FACTS[getDayOfYear() % CIVIC_FACTS.length];

  // Recent votes (last 7 days)
  const recentVotes = useMemo(() => {
    if (!votes.length) return [];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return votes
      .filter((v) => v.division && new Date(v.division.date).getTime() > weekAgo)
      .slice(0, 5);
  }, [votes]);

  // ── Share handler ────────────────────────────────────────────────────────

  const handleShare = () => {
    if (!brief) return;
    let summaryText = '';
    if (hasAI) {
      summaryText = brief.ai_text!.what_happened.join(' ');
    } else {
      summaryText = (brief.stories ?? []).slice(0, 3).map((s) => s.headline).join(' ');
    }
    const truncated = summaryText.length > 200 ? summaryText.slice(0, 200) + '...' : summaryText;
    const message = `Here's what happened in Australian politics today — from Verity\n\n${truncated}\n\nGet Verity: https://verity.run`;
    Share.share({ message });
  };

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.green }]} edges={['top']}>
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Your Daily Brief</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={[styles.scrollContent, { backgroundColor: colors.background }]}>
          <View style={{ padding: SPACING.lg, gap: SPACING.lg }}>
            <SkeletonLoader width="60%" height={20} borderRadius={BORDER_RADIUS.sm} />
            <SkeletonLoader width="100%" height={80} borderRadius={BORDER_RADIUS.lg} />
            <SkeletonLoader width="100%" height={80} borderRadius={BORDER_RADIUS.lg} />
            <SkeletonLoader width="100%" height={80} borderRadius={BORDER_RADIUS.lg} />
            <SkeletonLoader width="40%" height={16} borderRadius={BORDER_RADIUS.sm} />
            <SkeletonLoader width="100%" height={120} borderRadius={BORDER_RADIUS.lg} />
            <SkeletonLoader width="100%" height={60} borderRadius={BORDER_RADIUS.lg} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Content ──────────────────────────────────────────────────────────────

  const whatHappened = hasAI
    ? brief!.ai_text!.what_happened.map((text, i) => ({
        text,
        category: brief!.stories?.[i]?.category ?? null,
        billId: brief!.stories?.[i]?.bill_id ?? null,
        sourceCount: brief!.stories?.length ?? 0,
      }))
    : (brief?.stories ?? []).slice(0, 3).map((s) => ({
        text: s.headline,
        category: s.category,
        billId: s.bill_id,
        sourceCount: 0,
      }));

  const oneThingToKnow = hasAI
    ? brief!.ai_text!.one_thing_to_know
    : todayFact;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.green }]} edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Your Daily Brief</Text>
          <Pressable
            onPress={handleShare}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="share-outline" size={22} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.headerDate}>{dateLabel}</Text>
        {electorateName ? (
          <Text style={styles.headerSubtitle}>
            Personalised for {electorateName}
          </Text>
        ) : null}
        {generating ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
            <Text style={styles.generatingText}>Personalising your brief...</Text>
          </View>
        ) : null}
      </View>

      {/* ── ScrollView ──────────────────────────────────────────────────── */}
      <ScrollView
        style={[styles.scrollContent, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={generating} onRefresh={() => refresh()} tintColor="#00843D" />}
      >
        {/* ── Section 1: What Happened ──────────────────────────────────── */}
        <SectionLabel label="WHAT HAPPENED" colors={colors} />

        {whatHappened.map((item, i) => (
          <Pressable
            key={i}
            onPress={() => {
              if (item.billId) {
                navigation.navigate('BillDetail', { billId: item.billId });
              }
            }}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.card,
                opacity: pressed && item.billId ? 0.92 : 1,
              },
              SHADOWS.sm,
            ]}
          >
            <View style={styles.storyRow}>
              {item.category ? (
                <View
                  style={[
                    styles.topicPill,
                    { backgroundColor: topicBg(item.category) },
                  ]}
                >
                  <Text
                    style={[
                      styles.topicPillText,
                      { color: topicText(item.category) },
                    ]}
                  >
                    {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.storyText, { color: colors.text }]}>
                {decodeHtml(item.text)}
              </Text>
            </View>
            {item.sourceCount > 0 ? (
              <Text style={[styles.sourceCount, { color: colors.textMuted }]}>
                {item.sourceCount} sources
              </Text>
            ) : null}
          </Pressable>
        ))}

        {/* ── Section 2: Your MP's Week ─────────────────────────────────── */}
        {myMP ? (
          <>
            <SectionLabel label="YOUR MP'S WEEK" colors={colors} />
            <View
              style={[
                styles.card,
                styles.mpCard,
                {
                  backgroundColor: isDark ? colors.card : '#f0faf4',
                  borderLeftColor: colors.green,
                },
                SHADOWS.sm,
              ]}
            >
              {/* MP header */}
              <View style={styles.mpHeader}>
                {myMP.photo_url ? (
                  <Image
                    source={{ uri: myMP.photo_url }}
                    style={styles.mpPhoto}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.mpPhoto,
                      styles.mpPhotoPlaceholder,
                      { backgroundColor: colors.cardAlt },
                    ]}
                  >
                    <Ionicons name="person" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.mpInfo}>
                  <Text style={[styles.mpName, { color: colors.text }]}>
                    {myMP.first_name} {myMP.last_name}
                  </Text>
                  <Text style={[styles.mpRole, { color: colors.textBody }]}>
                    {(myMP as any).ministerial_role || (myMP as any).party || ''}
                  </Text>
                </View>
              </View>

              {/* Vote count */}
              <Text style={[styles.mpVoteCount, { color: colors.textBody }]}>
                Voted on {recentVotes.length} bill{recentVotes.length !== 1 ? 's' : ''} this week
              </Text>

              {/* Recent votes */}
              {recentVotes.map((v, i) => (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    if (v.division?.id) {
                      navigation.navigate('BillDetail', { billId: v.division.id });
                    }
                  }}
                  style={({ pressed }) => [
                    styles.voteRow,
                    {
                      borderTopColor: colors.border,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.voteTitle, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {v.division?.name ? cleanDivisionName(decodeHtml(v.division.name)) : 'Vote'}
                  </Text>
                  <View
                    style={[
                      styles.voteBadge,
                      {
                        backgroundColor:
                          v.vote_cast?.toLowerCase() === 'aye'
                            ? colors.greenBg
                            : colors.redBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.voteBadgeText,
                        {
                          color:
                            v.vote_cast?.toLowerCase() === 'aye'
                              ? colors.green
                              : colors.red,
                        },
                      ]}
                    >
                      {v.vote_cast?.toUpperCase() || '—'}
                    </Text>
                  </View>
                </Pressable>
              ))}

              {/* Write to MP */}
              <Pressable
                onPress={() => navigation.navigate('WriteToMP', { member: myMP })}
                style={({ pressed }) => [
                  styles.writeLink,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text style={[styles.writeLinkText, { color: colors.green }]}>
                  Write to {myMP.first_name} {'\u2192'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* ── Section 3: Bills to Watch ─────────────────────────────────── */}
        {billsToWatch.length > 0 ? (
          <>
            <SectionLabel label="BILLS TO WATCH" colors={colors} />
            {billsToWatch.slice(0, 3).map((bill) => {
              const label = getStatusLabel(bill.current_status || bill.status);
              return (
                <Pressable
                  key={bill.id}
                  onPress={() =>
                    navigation.navigate('BillDetail', { billId: bill.id })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      opacity: pressed ? 0.92 : 1,
                    },
                    SHADOWS.sm,
                  ]}
                >
                  <View style={styles.billHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColor(label) + '18' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: statusColor(label) },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                    <Ionicons
                      name="star-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                  <Text
                    style={[styles.billTitle, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {decodeHtml(bill.short_title || bill.title)}
                  </Text>
                  {bill.summary_plain ? (
                    <Text
                      style={[styles.billSummary, { color: colors.textBody }]}
                      numberOfLines={2}
                    >
                      {bill.summary_plain}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </>
        ) : null}

        {/* ── Section 4: In Your Community ──────────────────────────────── */}
        {postcode ? (
          <>
            <SectionLabel label="IN YOUR COMMUNITY" colors={colors} />
            <Pressable
              onPress={() => navigation.navigate('Community')}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  opacity: pressed ? 0.92 : 1,
                },
                SHADOWS.sm,
              ]}
            >
              <View style={styles.communityInner}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={28}
                  color={colors.green}
                  style={{ marginRight: SPACING.md }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.communityText, { color: colors.text }]}>
                    View community discussions in your electorate
                  </Text>
                  <Text style={[styles.communityLink, { color: colors.green }]}>
                    Join the conversation {'\u2192'}
                  </Text>
                </View>
              </View>
            </Pressable>
          </>
        ) : null}

        {/* ── Section 5: One Thing to Know ───────────────────────────────── */}
        <SectionLabel label="ONE THING TO KNOW" colors={colors} />
        <View
          style={[
            styles.card,
            styles.factCard,
            {
              backgroundColor: isDark ? colors.card : '#f0faf4',
              borderLeftColor: colors.green,
            },
            SHADOWS.sm,
          ]}
        >
          <Ionicons
            name="bulb-outline"
            size={18}
            color={colors.green}
            style={{ marginBottom: SPACING.xs }}
          />
          <Text style={[styles.factText, { color: colors.text }]}>
            {oneThingToKnow}
          </Text>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Text style={[styles.footerMuted, { color: colors.textMuted }]}>
            Generated by Verity AI{' '}
            {brief?.created_at
              ? new Date(brief.created_at).toLocaleTimeString('en-AU', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })
              : '7:00 am AEST'}
          </Text>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [
              styles.shareButton,
              {
                borderColor: colors.green,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Ionicons
              name="share-outline"
              size={18}
              color={colors.green}
              style={{ marginRight: SPACING.sm }}
            />
            <Text style={[styles.shareButtonText, { color: colors.green }]}>
              Share your brief
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.bold,
    color: '#fff',
  },
  headerDate: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
    color: '#fff',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.medium,
    color: 'rgba(255,255,255,0.7)',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xs,
  },
  generatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  generatingText: {
    fontSize: FONT_SIZE.small,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: FONT_WEIGHT.medium,
  },

  // Scroll
  scrollContent: {
    flex: 1,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  scrollInner: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },

  // Cards
  card: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },

  // What happened
  storyRow: {
    gap: SPACING.sm,
  },
  topicPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.xs,
  },
  topicPillText: {
    fontSize: 11,
    fontWeight: FONT_WEIGHT.semibold,
  },
  storyText: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
    fontWeight: FONT_WEIGHT.regular,
  },
  sourceCount: {
    fontSize: 11,
    fontWeight: FONT_WEIGHT.medium,
    marginTop: SPACING.sm,
  },

  // MP card
  mpCard: {
    borderLeftWidth: 4,
  },
  mpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  mpPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: SPACING.md,
  },
  mpPhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mpInfo: {
    flex: 1,
  },
  mpName: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  mpRole: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.regular,
    marginTop: 2,
  },
  mpVoteCount: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: SPACING.sm,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  voteTitle: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.medium,
    flex: 1,
  },
  voteBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  voteBadgeText: {
    fontSize: 11,
    fontWeight: FONT_WEIGHT.bold,
  },
  writeLink: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
  },
  writeLinkText: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Bills
  billHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: FONT_WEIGHT.bold,
  },
  billTitle: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
    lineHeight: 21,
  },
  billSummary: {
    fontSize: FONT_SIZE.small,
    lineHeight: 19,
    marginTop: SPACING.xs,
  },

  // Community
  communityInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityText: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: 21,
  },
  communityLink: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: SPACING.xs,
  },

  // One thing to know
  factCard: {
    borderLeftWidth: 4,
  },
  factText: {
    fontSize: FONT_SIZE.body,
    fontStyle: 'italic',
    lineHeight: 22,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    gap: SPACING.lg,
  },
  footerMuted: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.regular,
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    width: '100%',
  },
  shareButtonText: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
