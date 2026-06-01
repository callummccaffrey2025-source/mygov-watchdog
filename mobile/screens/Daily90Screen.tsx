import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, Share, Platform, Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { useMorningSignal, MorningSignalStory } from '../hooks/useMorningSignal';
import { useDailyPoll } from '../hooks/useDailyPoll';
import { useDaily90Streak } from '../hooks/useDaily90Streak';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { hapticLight } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { timeAgo } from '../lib/timeAgo';

/* ─────────────────────── Helpers ──────────────────────── */

function formatHeaderDate(): string {
  return new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

/* ─────────────────────── 1. Daily Brief Card ─────────── */

function DailyBriefCard({
  stories,
  colors,
  onStoryPress,
}: {
  stories: MorningSignalStory[];
  colors: any;
  onStoryPress?: (id: string) => void;
}) {
  if (stories.length === 0) return null;

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, ...SHADOWS.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
        <Ionicons name="newspaper-outline" size={16} color="#00843D" />
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#00843D', letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Today's Brief
        </Text>
      </View>
      {stories.slice(0, 3).map((story, i) => (
        <Pressable
          key={story.story_id ?? i}
          onPress={() => story.story_id && onStoryPress?.(String(story.story_id))}
          style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: i < 2 ? SPACING.md : 0 }}
        >
          <View style={{
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#00843D' }}>
              {i + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, lineHeight: 20 }} numberOfLines={2}>
              {story.headline}
            </Text>
            {story.why_it_matters && (
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2, lineHeight: 18 }} numberOfLines={2}>
                {story.why_it_matters}
              </Text>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/* ─────────────────────── 2. Daily Poll Card ──────────── */

function DailyPollCard({
  poll,
  userVote,
  counts,
  onVote,
  requiresAuth,
  colors,
}: {
  poll: { question: string; option_a_text: string; option_b_text: string; skip_text: string; source_article_outlet: string | null };
  userVote: string | null;
  counts: { option_a: number; option_b: number; skip: number } | null;
  onVote: (option: 'option_a' | 'option_b' | 'skip') => void;
  requiresAuth: boolean;
  colors: any;
}) {
  const total = (counts?.option_a ?? 0) + (counts?.option_b ?? 0) + (counts?.skip ?? 0);
  const hasVoted = !!userVote;

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, ...SHADOWS.sm,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
        <Ionicons name="chatbubble-outline" size={16} color="#2563EB" />
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: '#2563EB', letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Today's Poll
        </Text>
        {poll.source_article_outlet && (
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginLeft: 'auto' }}>
            via {poll.source_article_outlet}
          </Text>
        )}
      </View>

      <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text, lineHeight: 24, marginBottom: SPACING.lg }}>
        {poll.question}
      </Text>

      {hasVoted ? (
        // Results view
        <View style={{ gap: SPACING.sm }}>
          {(['option_a', 'option_b'] as const).map(opt => {
            const text = opt === 'option_a' ? poll.option_a_text : poll.option_b_text;
            const count = counts?.[opt] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isUser = userVote === opt;
            return (
              <View key={opt} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: isUser ? FONT_WEIGHT.bold : FONT_WEIGHT.medium, color: colors.text }}>
                    {text} {isUser ? '✓' : ''}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.textMuted }}>{pct}%</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.surface, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 6, width: `${pct}%`, backgroundColor: isUser ? '#00843D' : '#9CA3AF', borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xs }}>
            {total} vote{total !== 1 ? 's' : ''}
          </Text>
        </View>
      ) : (
        // Vote buttons
        <View style={{ gap: SPACING.sm }}>
          {(['option_a', 'option_b'] as const).map(opt => (
            <Pressable
              key={opt}
              onPress={() => { hapticLight(); onVote(opt); }}
              style={({ pressed }) => ({
                paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
                borderRadius: BORDER_RADIUS.md,
                backgroundColor: pressed ? '#E8F5EE' : colors.surface,
                borderWidth: 1, borderColor: colors.border,
                alignItems: 'center',
              })}
            >
              <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                {opt === 'option_a' ? poll.option_a_text : poll.option_b_text}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => { hapticLight(); onVote('skip'); }}>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xs }}>
              {poll.skip_text}
            </Text>
          </Pressable>
          {requiresAuth && (
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic' }}>
              Sign in to vote
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/* ─────────────────────── 3. MP Activity Card ─────────── */

interface MPActivity {
  division_name: string;
  division_date: string;
  vote_cast: string;
  division_id: string;
}

function MPActivityCard({
  member,
  activity,
  colors,
  onPress,
}: {
  member: { first_name: string; last_name: string; photo_url: string | null; party?: { colour?: string } };
  activity: MPActivity | null;
  colors: any;
  onPress?: () => void;
}) {
  const partyColour = member.party?.colour ?? '#6B7280';

  return (
    <Pressable
      onPress={onPress}
      disabled={!activity}
      style={{
        backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg, ...SHADOWS.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}>
        <Ionicons name="person-outline" size={16} color={partyColour} />
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: partyColour, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Your MP
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
        {member.photo_url ? (
          <Image
            source={{ uri: member.photo_url }}
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: partyColour }}
            contentFit="cover"
          />
        ) : (
          <View style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: partyColour + '22', justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: partyColour }}>
              {member.first_name[0]}{member.last_name[0]}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
            {member.first_name} {member.last_name}
          </Text>
          {activity ? (
            <>
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2 }} numberOfLines={2}>
                Voted {activity.vote_cast.toUpperCase()} on: {activity.division_name.replace(/^Bills?\s*[—\-]\s*/i, '').trim()}
              </Text>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 2 }}>
                {timeAgo(activity.division_date)}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2 }}>
              No recent voting activity
            </Text>
          )}
        </View>
        {activity && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
      </View>
    </Pressable>
  );
}

/* ─────────────────────── Streak badge ────────────────── */

function StreakBadge({ streak, completedToday, colors }: { streak: number; completedToday: boolean; colors: any }) {
  if (streak === 0 && !completedToday) return null;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: completedToday ? '#E8F5EE' : colors.surface,
      borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
      alignSelf: 'flex-start',
    }}>
      <Ionicons name="flame-outline" size={14} color={completedToday ? '#00843D' : colors.textMuted} />
      <Text style={{
        fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold,
        color: completedToday ? '#00843D' : colors.textMuted,
      }}>
        {streak}-day informed streak
      </Text>
      {completedToday && <Ionicons name="checkmark-circle" size={14} color="#00843D" />}
    </View>
  );
}

/* ─────────────────────── Main screen ─────────────────── */

export function Daily90Screen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode, user } = useUser();
  const { signal, loading: signalLoading, refresh: refreshSignal } = useMorningSignal();
  const { poll, userVote, counts, loading: pollLoading, vote: castVote } = useDailyPoll();
  const { streak, completedToday, markComplete } = useDaily90Streak();
  const { member, loading: mpLoading } = useElectorateByPostcode(postcode);
  const [mpActivity, setMpActivity] = useState<MPActivity | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Track which sections have been seen/actioned
  const [seenBrief, setSeenBrief] = useState(false);
  const [seenPoll, setSeenPoll] = useState(false);
  const [seenMP, setSeenMP] = useState(false);

  // Load MP's most recent vote
  useEffect(() => {
    if (!member?.id) return;
    (async () => {
      const { data } = await supabase
        .from('division_votes')
        .select('vote_cast, division:divisions!inner(id, name, date)')
        .eq('member_id', member.id)
        .in('vote_cast', ['aye', 'no'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (data?.[0]) {
        const div = Array.isArray(data[0].division) ? data[0].division[0] : data[0].division;
        setMpActivity({
          division_name: div?.name ?? '',
          division_date: div?.date ?? '',
          vote_cast: data[0].vote_cast,
          division_id: div?.id ?? '',
        });
      }
    })();
  }, [member?.id]);

  // Mark sections seen on scroll (brief is seen immediately, poll on vote, MP on render)
  useEffect(() => { if (signal) setSeenBrief(true); }, [signal]);
  useEffect(() => { if (userVote) setSeenPoll(true); }, [userVote]);
  useEffect(() => { if (member) setSeenMP(true); }, [member]);

  // Check completion — all three seen/actioned
  useEffect(() => {
    if (seenBrief && (seenPoll || !poll) && seenMP && !completedToday) {
      markComplete();
    }
  }, [seenBrief, seenPoll, seenMP, completedToday, poll, markComplete]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshSignal();
    setRefreshing(false);
  }, [refreshSignal]);

  const loading = signalLoading && pollLoading && mpLoading;
  const topStories = signal?.top_stories?.slice(0, 3) ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00843D" />}
      >
        {/* Green gradient header */}
        <LinearGradient
          colors={['#00843D', '#00A34D']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: SPACING.lg, paddingHorizontal: 20, paddingBottom: SPACING.xxl, overflow: 'hidden' }}
        >
          <View pointerEvents="none" style={{
            position: 'absolute', top: -30, right: -30,
            width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)',
          }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg }}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <StreakBadge streak={streak} completedToday={completedToday} colors={colors} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
            <Ionicons name="flash-outline" size={18} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: 'rgba(255,255,255,0.8)', letterSpacing: 1, textTransform: 'uppercase' }}>
              90-SECOND CIVIC RITUAL
            </Text>
          </View>
          <Text style={{ fontSize: FONT_SIZE.heading + 6, fontWeight: FONT_WEIGHT.bold, color: '#fff', letterSpacing: -0.5 }}>
            Your Daily 90
          </Text>
          <Text style={{ fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.sm }}>
            {formatHeaderDate()}
          </Text>
        </LinearGradient>

        {/* Content */}
        <View style={{ paddingHorizontal: 20, gap: SPACING.lg, marginTop: SPACING.xl, paddingBottom: SPACING.xxxl }}>
          {loading ? (
            <View style={{ gap: SPACING.lg }}>
              <SkeletonLoader height={160} borderRadius={BORDER_RADIUS.lg} />
              <SkeletonLoader height={200} borderRadius={BORDER_RADIUS.lg} />
              <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
            </View>
          ) : (
            <>
              {/* 1. Daily Brief */}
              <DailyBriefCard stories={topStories} colors={colors} />

              {/* 2. Daily Poll */}
              {poll && (
                <DailyPollCard
                  poll={poll}
                  userVote={userVote}
                  counts={counts}
                  onVote={castVote}
                  requiresAuth={!user}
                  colors={colors}
                />
              )}

              {/* 3. What your MP did */}
              {member && (
                <MPActivityCard
                  member={member as any}
                  activity={mpActivity}
                  colors={colors}
                  onPress={mpActivity ? () => navigation.navigate('MemberProfile', { memberId: member.id }) : undefined}
                />
              )}

              {/* No MP set */}
              {!member && !mpLoading && (
                <Pressable
                  onPress={() => navigation.navigate('Match')}
                  style={{
                    backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
                    padding: SPACING.lg, alignItems: 'center', ...SHADOWS.sm,
                  }}
                >
                  <Ionicons name="location-outline" size={24} color="#00843D" />
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.sm }}>
                    Set your postcode to see your MP's activity
                  </Text>
                  <Text style={{ fontSize: FONT_SIZE.small, color: '#00843D', marginTop: SPACING.xs }}>
                    Take the Verity Match →
                  </Text>
                </Pressable>
              )}

              {/* Completion state */}
              {completedToday && (
                <View style={{
                  backgroundColor: '#E8F5EE', borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg, alignItems: 'center',
                }}>
                  <Ionicons name="checkmark-circle" size={32} color="#00843D" />
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: '#00843D', marginTop: SPACING.sm }}>
                    You're informed for today
                  </Text>
                  <Text style={{ fontSize: FONT_SIZE.small, color: '#00843D', marginTop: SPACING.xs }}>
                    {streak} day{streak !== 1 ? 's' : ''} and counting
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
