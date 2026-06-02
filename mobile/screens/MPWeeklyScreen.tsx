/**
 * "What did your MP do this week?" — the core retention screen.
 * Enter your postcode once, see every vote your MP cast this week in plain English.
 * Each vote is a shareable Receipt card.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useMPWeekly, WeeklyVote } from '../hooks/useMPWeekly';
import { ReceiptShareCard } from '../components/ShareCards';
import { captureAndShare } from '../utils/shareContent';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { hapticLight } from '../lib/haptics';
import { timeAgo } from '../lib/timeAgo';

const GREEN = '#00843D';

// ── Clean division name for display ─────────────────────────────────────

function cleanName(name: string): string {
  return name
    .replace(/^Bills?\s*[—\-]\s*/i, '')
    .replace(/^Motions?\s*[—\-]\s*/i, '')
    .replace(/^Documents?\s*[—\-]\s*/i, '')
    .replace(/;\s*Limitation of Debate$/i, '')
    .replace(/;\s*Second Reading$/i, '')
    .replace(/;\s*Third Reading$/i, '')
    .replace(/;\s*Consideration in Detail$/i, '')
    .replace(/;\s*Consideration of Senate Message$/i, '')
    .trim();
}

// ── Vote card ───────────────────────────────────────────────────────────

function VoteCard({
  vote,
  mpName,
  mpPhotoUrl,
  partyName,
  partyColour,
  colors,
  onShare,
  onPress,
}: {
  vote: WeeklyVote;
  mpName: string;
  mpPhotoUrl: string | null;
  partyName: string;
  partyColour: string;
  colors: any;
  onShare: () => void;
  onPress: () => void;
}) {
  const isAye = vote.vote_cast === 'aye';
  const voteLabel = isAye ? 'FOR' : 'AGAINST';
  const voteColor = isAye ? GREEN : '#DC3545';
  const voteBg = isAye ? '#E8F5EE' : '#FDECEA';
  const signalLabel = vote.vote_signal === 'support' ? 'Supports' :
    vote.vote_signal === 'oppose' ? 'Opposes' : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        opacity: pressed ? 0.95 : 1,
        ...SHADOWS.sm,
      })}
    >
      {/* Vote direction bar */}
      <View style={{ height: 4, backgroundColor: voteColor }} />

      <View style={{ padding: SPACING.lg }}>
        {/* Issue tag + date row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
          {vote.issue_name && (
            <View style={{
              backgroundColor: '#E8F5EE', borderRadius: BORDER_RADIUS.sm,
              paddingHorizontal: SPACING.sm, paddingVertical: 2, marginRight: SPACING.sm,
            }}>
              <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: GREEN }}>
                {vote.issue_name}
              </Text>
            </View>
          )}
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginLeft: 'auto' }}>
            {timeAgo(vote.date)}
          </Text>
        </View>

        {/* Bill name */}
        <Text style={{
          fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold,
          color: colors.text, lineHeight: 24, marginBottom: SPACING.md,
        }} numberOfLines={3}>
          {cleanName(vote.division_name)}
        </Text>

        {/* Vote badge + signal */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <View style={{
            backgroundColor: voteBg, borderRadius: BORDER_RADIUS.md,
            paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
          }}>
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: voteColor }}>
              Voted {voteLabel}
            </Text>
          </View>

          {signalLabel && vote.issue_name && (
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, flex: 1 }}>
              {signalLabel} {vote.issue_name.toLowerCase()}
            </Text>
          )}
        </View>

        {/* Parliament tally */}
        {(vote.aye_votes + vote.no_votes) > 0 && (
          <View style={{ marginTop: SPACING.md }}>
            <View style={{
              height: 6, borderRadius: 3, overflow: 'hidden',
              flexDirection: 'row', backgroundColor: colors.surface,
            }}>
              <View style={{
                flex: vote.aye_votes, backgroundColor: GREEN, borderRadius: 3,
              }} />
              <View style={{
                flex: vote.no_votes, backgroundColor: '#DC3545', borderRadius: 3,
              }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: FONT_SIZE.caption, color: GREEN, fontWeight: FONT_WEIGHT.semibold }}>
                Aye {vote.aye_votes}
              </Text>
              <Text style={{ fontSize: FONT_SIZE.caption, color: '#DC3545', fontWeight: FONT_WEIGHT.semibold }}>
                No {vote.no_votes}
              </Text>
            </View>
          </View>
        )}

        {/* Share button */}
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); hapticLight(); onShare(); }}
          hitSlop={8}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
            alignSelf: 'flex-end', marginTop: SPACING.md,
            paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm,
          }}
        >
          <Ionicons name="share-outline" size={16} color={GREEN} />
          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>
            Share receipt
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ── Stats bar ───────────────────────────────────────────────────────────

function StatsBar({ totalVotes, sittingDays, colors }: { totalVotes: number; sittingDays: number; colors: any }) {
  return (
    <View style={{
      flexDirection: 'row', backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg, ...SHADOWS.sm, overflow: 'hidden',
    }}>
      <View style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.lg }}>
        <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
          {totalVotes}
        </Text>
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 2 }}>
          votes cast
        </Text>
      </View>
      <View style={{ width: 1, backgroundColor: colors.border }} />
      <View style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.lg }}>
        <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
          {sittingDays}
        </Text>
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 2 }}>
          sitting days
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────

export function MPWeeklyScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { postcode, user } = useUser();
  const { member, loading: mpLoading } = useElectorateByPostcode(postcode);
  const { summary, loading, error } = useMPWeekly(member?.id ?? null);
  const [shareVote, setShareVote] = useState<WeeklyVote | null>(null);
  const shareCardRef = useRef<View>(null);

  // Capture and share when shareVote is set
  useEffect(() => {
    if (shareVote && summary) {
      captureAndShare(shareCardRef, 'receipt', shareVote.division_id, user?.id)
        .finally(() => setShareVote(null));
    }
  }, [shareVote, summary, user?.id]);

  const partyColour = (member as any)?.party?.colour ?? '#6B7280';

  // No postcode set
  if (!postcode && !mpLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header colors={colors} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Ionicons name="location-outline" size={48} color={colors.textMuted} />
          <Text style={{
            fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold,
            color: colors.text, marginTop: SPACING.lg, textAlign: 'center',
          }}>
            Enter your postcode
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.body, color: colors.textMuted,
            textAlign: 'center', marginTop: SPACING.sm, lineHeight: 22,
          }}>
            We'll show you exactly what your MP voted on this week
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Match')}
            style={{
              marginTop: SPACING.xl, backgroundColor: GREEN,
              paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl,
              borderRadius: BORDER_RADIUS.md,
            }}
          >
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
              Set postcode
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Loading
  if (loading || mpLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header colors={colors} onBack={() => navigation.goBack()} />
        <View style={{ padding: 20, gap: SPACING.lg }}>
          <SkeletonLoader height={80} borderRadius={BORDER_RADIUS.lg} />
          <SkeletonLoader height={60} borderRadius={BORDER_RADIUS.lg} />
          <SkeletonLoader height={160} borderRadius={BORDER_RADIUS.lg} />
          <SkeletonLoader height={160} borderRadius={BORDER_RADIUS.lg} />
        </View>
      </SafeAreaView>
    );
  }

  if (!summary || !member) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header colors={colors} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.md, textAlign: 'center' }}>
            {error ?? 'Could not load MP data'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const substantiveVotes = summary.votes.filter(v =>
    !v.division_name.includes('Business — Consideration') &&
    !v.division_name.includes('Adjournment')
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header colors={colors} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* MP card */}
        <View style={{ paddingHorizontal: 20, paddingTop: SPACING.lg }}>
          <Pressable
            onPress={() => navigation.navigate('MemberProfile', { memberId: member.id })}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
              backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg, ...SHADOWS.sm,
            }}
          >
            {member.photo_url ? (
              <Image
                source={{ uri: member.photo_url }}
                style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: partyColour }}
                contentFit="cover"
              />
            ) : (
              <View style={{
                width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: partyColour,
                backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: partyColour }}>
                  {summary.first_name[0]}{summary.last_name[0]}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                {summary.first_name} {summary.last_name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: partyColour }} />
                <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                  {summary.party_name} · {summary.electorate}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Week label */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
          <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: GREEN, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            THIS WEEK IN PARLIAMENT
          </Text>
          <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.xs }}>
            {summary.week_label}
          </Text>
        </View>

        {/* Stats */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.lg }}>
          <StatsBar totalVotes={summary.total_votes} sittingDays={summary.sitting_days} colors={colors} />
        </View>

        {/* Votes */}
        {substantiveVotes.length > 0 ? (
          <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
            <Text style={{
              fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold,
              color: colors.text, marginBottom: SPACING.md,
            }}>
              The receipts
            </Text>
            {substantiveVotes.map(vote => (
              <VoteCard
                key={vote.division_id}
                vote={vote}
                mpName={`${summary.first_name} ${summary.last_name}`}
                mpPhotoUrl={member.photo_url}
                partyName={summary.party_short ?? summary.party_name}
                partyColour={partyColour}
                colors={colors}
                onShare={() => setShareVote(vote)}
                onPress={() => {
                  if (vote.source_url) Linking.openURL(vote.source_url);
                }}
              />
            ))}
          </View>
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="moon-outline" size={40} color={colors.textMuted} />
            <Text style={{
              fontSize: FONT_SIZE.body, color: colors.textMuted,
              textAlign: 'center', marginTop: SPACING.md, lineHeight: 22,
            }}>
              Parliament didn't sit this week, or your MP didn't vote on any substantive bills.
            </Text>
          </View>
        )}

        {/* Source */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl, alignItems: 'center' }}>
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
            Source: TheyVoteForYou API · Updated daily
          </Text>
        </View>
      </ScrollView>

      {/* Offscreen share card */}
      {shareVote && summary && (
        <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
          <View ref={shareCardRef}>
            <ReceiptShareCard
              mpName={`${summary.first_name} ${summary.last_name}`}
              mpPhotoUrl={member.photo_url}
              partyName={summary.party_short ?? summary.party_name}
              partyColour={partyColour}
              billTitle={cleanName(shareVote.division_name)}
              voteCast={shareVote.vote_cast}
              date={shareVote.date}
              issueTag={shareVote.issue_name}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Header ──────────────────────────────────────────────────────────────

function Header({ colors, onBack }: { colors: any; onBack: () => void }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingHorizontal: 20, paddingVertical: SPACING.md,
      borderBottomWidth: 0.5, borderBottomColor: colors.border,
    }}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
          What did your MP do?
        </Text>
      </View>
    </View>
  );
}
