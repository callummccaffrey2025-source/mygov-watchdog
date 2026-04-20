import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Animated,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useAuthGate } from '../hooks/useAuthGate';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useVerityPolls, VerityPoll, PollOption } from '../hooks/useVerityPolls';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { topicBg, topicAccent } from '../constants/topicColors';
import { hapticLight } from '../lib/haptics';
import { track } from '../lib/analytics';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';

const GREEN = '#00843D';
const GRAY_BAR = '#D1D5DB';

// ─── Animated result bar ─────────────────────────────────────────────────────

function ResultBar({ label, percentage, voteCount, isSelected, isLeading, colors }: {
  label: string; percentage: number; voteCount: number;
  isSelected: boolean; isLeading: boolean; colors: any;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const barColor = isSelected ? GREEN : isLeading ? GREEN : GRAY_BAR;

  return (
    <View style={{ marginBottom: SPACING.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 }}>
          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: isSelected ? FONT_WEIGHT.bold : FONT_WEIGHT.medium, color: isSelected ? GREEN : colors.text }} numberOfLines={1}>
            {label}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={14} color={GREEN} />
          )}
        </View>
        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: isSelected ? GREEN : colors.textBody }}>
          {percentage}%
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
        <Animated.View style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: barColor,
          width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
        }} />
      </View>
      <Text style={{ fontSize: FONT_SIZE.caption - 2, color: colors.textMuted, marginTop: 2 }}>
        {voteCount.toLocaleString()} vote{voteCount !== 1 ? 's' : ''}
      </Text>
    </View>
  );
}

// ─── Countdown helper ────────────────────────────────────────────────────────

function getCountdown(closesAt: string | null): string {
  if (!closesAt) return '';
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `Closes in ${hours}h`;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `Closes in ${days} day${days !== 1 ? 's' : ''}`;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function PollsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user, postcode } = useUser();
  const { member: myMP } = useElectorateByPostcode(postcode);
  const { requireAuth, authSheetProps } = useAuthGate();
  const {
    featured, previous, quickPolls, totalVoters,
    loading, refresh, vote, userVotes,
  } = useVerityPolls();

  const electorateName = myMP?.electorate ?? null;

  const handleVote = (pollId: string, optionId: string) => {
    requireAuth('vote on this poll', () => {
      hapticLight();
      vote(pollId, optionId);
      track('poll_vote', { poll_id: pollId, option_id: optionId });
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ padding: SPACING.xl }}>
          <SkeletonLoader height={28} width={180} borderRadius={6} style={{ marginBottom: SPACING.lg }} />
          <SkeletonLoader height={300} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.lg }} />
          <SkeletonLoader height={120} borderRadius={BORDER_RADIUS.lg} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={GREEN} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg }}>
          <Text style={{ fontSize: 28, fontWeight: FONT_WEIGHT.bold, color: colors.text, letterSpacing: -0.5 }}>
            Verity Polls
          </Text>
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 4 }}>
            Verified voices from real electorates
          </Text>

          {/* Voter count badge */}
          {totalVoters > 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              alignSelf: 'flex-start', marginTop: SPACING.md,
              backgroundColor: colors.greenBg, borderRadius: BORDER_RADIUS.sm,
              paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs + 1,
            }}>
              <Ionicons name="shield-checkmark" size={14} color={GREEN} />
              <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>
                {totalVoters.toLocaleString()} verified voters
              </Text>
            </View>
          )}
        </View>

        {/* Featured Poll */}
        {featured && (
          <View style={{
            marginHorizontal: SPACING.xl - 4,
            backgroundColor: colors.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl,
            marginBottom: SPACING.xl,
            ...SHADOWS.md,
          }}>
            {/* Section label */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
              <View style={{ width: 28, height: 28, borderRadius: BORDER_RADIUS.lg, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="bar-chart" size={14} color="#4338CA" />
              </View>
              <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#4338CA', letterSpacing: 0.8 }}>
                FEATURED POLL
              </Text>
              <View style={{ flex: 1 }} />
              {featured.closes_at && (
                <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted }}>
                  {getCountdown(featured.closes_at)}
                </Text>
              )}
            </View>

            {/* Topic badge */}
            {featured.topic && (
              <View style={{
                alignSelf: 'flex-start',
                backgroundColor: topicBg(featured.topic),
                borderRadius: BORDER_RADIUS.sm,
                paddingHorizontal: SPACING.sm + 2,
                paddingVertical: SPACING.xs,
                marginBottom: SPACING.md,
              }}>
                <Text style={{ fontSize: FONT_SIZE.caption - 2, fontWeight: FONT_WEIGHT.semibold, color: topicAccent(featured.topic), textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {featured.topic}
                </Text>
              </View>
            )}

            {/* Question */}
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 26, marginBottom: SPACING.xs }}>
              {featured.question}
            </Text>
            {featured.description && (
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, lineHeight: 20, marginBottom: SPACING.lg }}>
                {featured.description}
              </Text>
            )}

            {/* Vote or Results */}
            {!userVotes.has(featured.id) ? (
              // Voting buttons
              <View style={{ gap: SPACING.sm, marginTop: SPACING.sm }}>
                {featured.options.map(option => (
                  <Pressable
                    key={option.id}
                    style={({ pressed }) => ({
                      borderWidth: 1.5,
                      borderColor: GREEN,
                      borderRadius: BORDER_RADIUS.md,
                      paddingVertical: SPACING.md,
                      paddingHorizontal: SPACING.lg,
                      alignItems: 'center',
                      backgroundColor: pressed ? GREEN + '10' : 'transparent',
                    })}
                    onPress={() => handleVote(featured.id, option.id)}
                  >
                    <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              // Results
              <View style={{ marginTop: SPACING.md }}>
                <Text style={{ fontSize: FONT_SIZE.caption - 1, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.5, marginBottom: SPACING.md }}>
                  NATIONAL
                </Text>
                {featured.options.map(option => {
                  const total = featured.options.reduce((s, o) => s + o.vote_count, 0);
                  const pct = total > 0 ? Math.round((option.vote_count / total) * 100) : 0;
                  const isUserChoice = userVotes.get(featured.id) === option.id;
                  const isLeading = option.vote_count === Math.max(...featured.options.map(o => o.vote_count));
                  return (
                    <ResultBar
                      key={option.id}
                      label={option.label}
                      percentage={pct}
                      voteCount={option.vote_count}
                      isSelected={isUserChoice}
                      isLeading={isLeading}
                      colors={colors}
                    />
                  );
                })}

                {/* Total + share */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs, paddingTop: SPACING.sm, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                  <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                    {featured.total_votes.toLocaleString()} verified vote{featured.total_votes !== 1 ? 's' : ''}
                  </Text>
                  <Pressable
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={() => {
                      const total = featured.options.reduce((s, o) => s + o.vote_count, 0);
                      const leading = featured.options.reduce((a, b) => b.vote_count > a.vote_count ? b : a);
                      const pct = total > 0 ? Math.round((leading.vote_count / total) * 100) : 0;
                      Share.share({ message: `"${featured.question}"\n\n${pct}% said "${leading.label}"\n${total.toLocaleString()} verified votes on Verity\nverity.run` });
                    }}
                  >
                    <Ionicons name="share-outline" size={16} color={GREEN} />
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>Share</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Tap for full breakdown */}
            {userVotes.has(featured.id) && (
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: SPACING.md, paddingVertical: SPACING.sm }}
                onPress={() => navigation.navigate('PollDetail', { pollId: featured.id })}
              >
                <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>
                  See electorate & state breakdown
                </Text>
                <Ionicons name="chevron-forward" size={14} color={GREEN} />
              </Pressable>
            )}
          </View>
        )}

        {/* Previous Polls */}
        {previous.length > 0 && (
          <View style={{ paddingHorizontal: SPACING.xl }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.8, marginBottom: SPACING.md }}>
              PREVIOUS POLLS
            </Text>
            {previous.map(poll => {
              const total = poll.options.reduce((s, o) => s + o.vote_count, 0);
              const leading = poll.options.length > 0
                ? poll.options.reduce((a, b) => b.vote_count > a.vote_count ? b : a)
                : null;
              const leadingPct = total > 0 && leading ? Math.round((leading.vote_count / total) * 100) : 0;

              return (
                <Pressable
                  key={poll.id}
                  style={({ pressed }) => ({
                    backgroundColor: colors.card,
                    borderRadius: BORDER_RADIUS.lg,
                    padding: SPACING.lg,
                    marginBottom: SPACING.sm,
                    opacity: pressed ? 0.92 : 1,
                    ...SHADOWS.sm,
                  })}
                  onPress={() => navigation.navigate('PollDetail', { pollId: poll.id })}
                >
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }} numberOfLines={1}>
                    {poll.question}
                  </Text>
                  {leading && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm }}>
                      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                        <View style={{ width: `${leadingPct}%`, height: 6, borderRadius: 3, backgroundColor: GREEN }} />
                      </View>
                      <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: GREEN }}>
                        {leadingPct}%
                      </Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm }}>
                    <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted }}>
                      {total.toLocaleString()} vote{total !== 1 ? 's' : ''}
                    </Text>
                    {poll.closes_at && (
                      <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted }}>
                        Closed {timeAgo(poll.closes_at)}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Quick Polls */}
        {quickPolls.length > 0 && (
          <View style={{ paddingHorizontal: SPACING.xl, marginTop: SPACING.xl }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.8, marginBottom: SPACING.xs }}>
              QUICK POLLS
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginBottom: SPACING.md }}>
              Have your say on current bills
            </Text>
            {quickPolls.map(poll => (
              <View
                key={poll.id}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg,
                  marginBottom: SPACING.sm,
                  ...SHADOWS.sm,
                }}
              >
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.sm }} numberOfLines={2}>
                  {poll.question}
                </Text>
                {!userVotes.has(poll.id) ? (
                  <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                    {poll.options.slice(0, 3).map(option => (
                      <Pressable
                        key={option.id}
                        style={({ pressed }) => ({
                          flex: 1,
                          borderWidth: 1.5,
                          borderColor: GREEN,
                          borderRadius: BORDER_RADIUS.md,
                          paddingVertical: SPACING.sm,
                          alignItems: 'center',
                          backgroundColor: pressed ? GREEN + '10' : 'transparent',
                        })}
                        onPress={() => handleVote(poll.id, option.id)}
                      >
                        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: GREEN }} numberOfLines={1}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Pressable onPress={() => navigation.navigate('PollDetail', { pollId: poll.id })}>
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>
                      See results
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Methodology note */}
        <View style={{ marginHorizontal: SPACING.xl, marginTop: SPACING.xxl, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, flexDirection: 'row', gap: SPACING.sm }}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
            Based on self-selected Verity users verified via Apple or Google authentication. Each voter is linked to an electorate via postcode. One vote per person per poll. Results are not weighted.
          </Text>
        </View>
      </ScrollView>
      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}
