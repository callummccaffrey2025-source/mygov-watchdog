import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, Linking,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { hapticLight } from '../lib/haptics';
import { track } from '../lib/analytics';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { usePublishedPolls, usePollAggregate, usePollsters, PublishedPoll } from '../hooks/usePublishedPolls';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';

const GREEN = '#00843D';

interface DailyPoll {
  id: string;
  publish_date: string;
  question: string;
  option_a_text: string;
  option_b_text: string;
  skip_text: string;
  source_article_url: string;
  source_article_title: string | null;
  source_article_outlet: string | null;
  status: string;
  withdrawn_reason: string | null;
}

interface PollResult {
  option_chosen: string;
  response_count: number;
  percentage: number;
}

function getAESTDate(offsetDays = 0): string {
  const now = new Date();
  const aest = new Date(now.getTime() + 10 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return aest.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function PollsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [selectedPollster, setSelectedPollster] = useState<string | null>(null);
  const { polls: publishedPolls, loading: publishedLoading } = usePublishedPolls({
    pollster: selectedPollster ?? undefined,
    limit: 20,
  });
  const { aggregate } = usePollAggregate(30);
  const pollsters = usePollsters();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [todayPoll, setTodayPoll] = useState<DailyPoll | null>(null);
  const [yesterdayPoll, setYesterdayPoll] = useState<DailyPoll | null>(null);
  const [todayResults, setTodayResults] = useState<PollResult[]>([]);
  const [yesterdayResults, setYesterdayResults] = useState<PollResult[]>([]);
  const [userVoteToday, setUserVoteToday] = useState<string | null>(null);
  const [userVoteYesterday, setUserVoteYesterday] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);

  // Report modal state
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<string>('misleading');
  const [reportText, setReportText] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const REPORT_REASONS = [
    { id: 'misleading', label: 'Misleading question' },
    { id: 'offensive', label: 'Offensive content' },
    { id: 'factually_wrong', label: 'Factually wrong' },
    { id: 'other', label: 'Other' },
  ];

  const handleSubmitReport = async () => {
    if (!todayPoll || !user) return;
    setSubmittingReport(true);
    try {
      await supabase.from('poll_reports').insert({
        poll_id: todayPoll.id,
        user_id: user.id,
        reason: reportReason,
        free_text: reportText.trim() || null,
      });
      setShowReport(false);
      setReportText('');
      Alert.alert('Report submitted', 'Thank you. We review every report.');
      track('poll_reported', { poll_id: todayPoll.id, reason: reportReason }, 'Polls');
    } catch {
      Alert.alert('Error', 'Could not submit report. You may have already reported this poll.');
    }
    setSubmittingReport(false);
  };

  const fetchPolls = useCallback(async () => {
    try {
      const today = getAESTDate();
      const yesterday = getAESTDate(-1);

      // Fetch today's poll
      const { data: tp } = await supabase
        .from('daily_polls')
        .select('*')
        .eq('publish_date', today)
        .in('status', ['published', 'withdrawn'])
        .maybeSingle();
      setTodayPoll(tp as DailyPoll | null);

      // Fetch yesterday's poll
      const { data: yp } = await supabase
        .from('daily_polls')
        .select('*')
        .eq('publish_date', yesterday)
        .in('status', ['published', 'withdrawn'])
        .maybeSingle();
      setYesterdayPoll(yp as DailyPoll | null);

      // Fetch results for yesterday
      if (yp) {
        const { data: yr } = await supabase
          .from('daily_poll_results')
          .select('*')
          .eq('poll_id', yp.id);
        setYesterdayResults((yr || []) as PollResult[]);
      }

      // Fetch results for today (shown after user votes)
      if (tp) {
        const { data: tr } = await supabase
          .from('daily_poll_results')
          .select('*')
          .eq('poll_id', tp.id);
        setTodayResults((tr || []) as PollResult[]);
      }

      // Check user's votes
      if (user) {
        if (tp) {
          const { data: uv } = await supabase
            .from('daily_poll_responses')
            .select('option_chosen')
            .eq('poll_id', tp.id)
            .eq('user_id', user.id)
            .maybeSingle();
          setUserVoteToday(uv?.option_chosen ?? null);
        }
        if (yp) {
          const { data: uv } = await supabase
            .from('daily_poll_responses')
            .select('option_chosen')
            .eq('poll_id', yp.id)
            .eq('user_id', user.id)
            .maybeSingle();
          setUserVoteYesterday(uv?.option_chosen ?? null);
        }
      }
    } catch {}
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPolls();
    setRefreshing(false);
  };

  const handleVote = async (option: 'a' | 'b' | 'skip') => {
    if (!todayPoll || !user || userVoteToday || voting) return;
    setVoting(true);
    hapticLight();
    setUserVoteToday(option); // Optimistic

    try {
      await supabase.from('daily_poll_responses').insert({
        poll_id: todayPoll.id,
        user_id: user.id,
        option_chosen: option,
      });
      track('daily_poll_vote', { poll_id: todayPoll.id, option }, 'Polls');
      // Refresh results
      const { data: tr } = await supabase
        .from('daily_poll_results')
        .select('*')
        .eq('poll_id', todayPoll.id);
      setTodayResults((tr || []) as PollResult[]);
    } catch {
      setUserVoteToday(null); // Revert
    }
    setVoting(false);
  };

  // ── Render helpers ──────────────────────────────────────────────────────

  const renderResultBars = (results: PollResult[], poll: DailyPoll, userVote: string | null) => {
    const totalResponses = results.reduce((s, r) => s + r.response_count, 0);
    const aResult = results.find(r => r.option_chosen === 'a');
    const bResult = results.find(r => r.option_chosen === 'b');
    const aPct = aResult?.percentage ?? 0;
    const bPct = bResult?.percentage ?? 0;

    return (
      <View style={{ gap: SPACING.md }}>
        {/* Option A bar */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: userVote === 'a' ? FONT_WEIGHT.bold : FONT_WEIGHT.medium, color: userVote === 'a' ? GREEN : colors.text, flex: 1 }} numberOfLines={1}>
              {poll.option_a_text}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: userVote === 'a' ? GREEN : colors.textBody }}>
              {aPct}%
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
            <View style={{ width: `${aPct}%`, height: 8, borderRadius: 4, backgroundColor: userVote === 'a' ? GREEN : '#9CA3AF' }} />
          </View>
        </View>

        {/* Option B bar */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: userVote === 'b' ? FONT_WEIGHT.bold : FONT_WEIGHT.medium, color: userVote === 'b' ? GREEN : colors.text, flex: 1 }} numberOfLines={1}>
              {poll.option_b_text}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: userVote === 'b' ? GREEN : colors.textBody }}>
              {bPct}%
            </Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
            <View style={{ width: `${bPct}%`, height: 8, borderRadius: 4, backgroundColor: userVote === 'b' ? GREEN : '#9CA3AF' }} />
          </View>
        </View>

        {/* Total */}
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textAlign: 'center' }}>
          {totalResponses.toLocaleString()} response{totalResponses !== 1 ? 's' : ''}
        </Text>
      </View>
    );
  };

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ padding: SPACING.xl }}>
          <SkeletonLoader height={28} width={180} borderRadius={6} style={{ marginBottom: SPACING.lg }} />
          <SkeletonLoader height={300} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.lg }} />
          <SkeletonLoader height={200} borderRadius={BORDER_RADIUS.lg} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg }}>
          <Text style={{ fontSize: 28, fontWeight: FONT_WEIGHT.bold, color: colors.text, letterSpacing: -0.5 }}>
            Daily Poll
          </Text>
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 4 }}>
            One question. Every day. Your voice matters.
          </Text>
        </View>

        {/* ═══ TODAY'S POLL ═══ */}
        {todayPoll ? (
          <View style={{
            marginHorizontal: SPACING.xl - 4,
            backgroundColor: colors.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl,
            marginBottom: SPACING.xl,
            ...SHADOWS.md,
          }}>
            {/* Date label */}
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.8, marginBottom: SPACING.md }}>
              {"TODAY'S QUESTION"}
            </Text>

            {/* Withdrawn state */}
            {todayPoll.status === 'withdrawn' ? (
              <View style={{ alignItems: 'center', paddingVertical: SPACING.xl }}>
                <Ionicons name="alert-circle-outline" size={32} color={colors.textMuted} />
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.md, textAlign: 'center' }}>
                  Today's poll was withdrawn
                </Text>
                {todayPoll.withdrawn_reason && (
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: SPACING.xs, textAlign: 'center' }}>
                    {todayPoll.withdrawn_reason}
                  </Text>
                )}
              </View>
            ) : (
              <>
                {/* Question */}
                <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 26, marginBottom: SPACING.lg }}>
                  {todayPoll.question}
                </Text>

                {/* Vote buttons OR results */}
                {!userVoteToday && !voting ? (
                  <View style={{ gap: SPACING.sm }}>
                    <Pressable
                      onPress={() => handleVote('a')}
                      style={({ pressed }) => ({
                        borderWidth: 1.5, borderColor: GREEN, borderRadius: BORDER_RADIUS.md,
                        paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
                        alignItems: 'center',
                        backgroundColor: pressed ? GREEN + '10' : 'transparent',
                      })}
                    >
                      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>
                        {todayPoll.option_a_text}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleVote('b')}
                      style={({ pressed }) => ({
                        borderWidth: 1.5, borderColor: GREEN, borderRadius: BORDER_RADIUS.md,
                        paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
                        alignItems: 'center',
                        backgroundColor: pressed ? GREEN + '10' : 'transparent',
                      })}
                    >
                      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>
                        {todayPoll.option_b_text}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleVote('skip')}
                      style={{ paddingVertical: SPACING.sm, alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                        {todayPoll.skip_text || 'Not sure'}
                      </Text>
                    </Pressable>
                  </View>
                ) : voting ? (
                  <ActivityIndicator color={GREEN} style={{ paddingVertical: SPACING.xl }} />
                ) : (
                  <>
                    {renderResultBars(todayResults, todayPoll, userVoteToday)}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md }}>
                      <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                      <Text style={{ fontSize: FONT_SIZE.caption, color: GREEN, fontWeight: FONT_WEIGHT.medium }}>
                        You voted
                      </Text>
                    </View>
                  </>
                )}

                {/* Source citation */}
                {todayPoll.source_article_title && (
                  <Pressable
                    onPress={() => { if (todayPoll.source_article_url) Linking.openURL(todayPoll.source_article_url); }}
                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, marginTop: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 0.5, borderTopColor: colors.border }}
                  >
                    <Ionicons name="link-outline" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
                    <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
                      Based on "{todayPoll.source_article_title}" — {todayPoll.source_article_outlet ?? 'Source'}
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : (
          /* No poll today */
          <View style={{
            marginHorizontal: SPACING.xl - 4,
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl,
            marginBottom: SPACING.xl,
            alignItems: 'center',
          }}>
            <Ionicons name="time-outline" size={32} color={colors.textMuted} />
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.md }}>
              No poll today
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xs }}>
              We'll be back tomorrow at 6am with a new question.
            </Text>
          </View>
        )}

        {/* ═══ YESTERDAY'S RESULTS ═══ */}
        {yesterdayPoll && (
          <View style={{
            marginHorizontal: SPACING.xl - 4,
            backgroundColor: colors.card,
            borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl,
            ...SHADOWS.sm,
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.8, marginBottom: SPACING.md }}>
              YESTERDAY — {formatDate(yesterdayPoll.publish_date).toUpperCase()}
            </Text>

            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 24, marginBottom: SPACING.lg }}>
              {yesterdayPoll.question}
            </Text>

            {yesterdayResults.length > 0 ? (
              renderResultBars(yesterdayResults, yesterdayPoll, userVoteYesterday)
            ) : (
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, textAlign: 'center' }}>
                No responses recorded
              </Text>
            )}

            {userVoteYesterday && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm }}>
                <Ionicons name="checkmark-circle" size={13} color={colors.textMuted} />
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                  You voted: {userVoteYesterday === 'a' ? yesterdayPoll.option_a_text : userVoteYesterday === 'b' ? yesterdayPoll.option_b_text : yesterdayPoll.skip_text}
                </Text>
              </View>
            )}

            {yesterdayPoll.source_article_title && (
              <Pressable
                onPress={() => { if (yesterdayPoll.source_article_url) Linking.openURL(yesterdayPoll.source_article_url); }}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 0.5, borderTopColor: colors.border }}
              >
                <Ionicons name="link-outline" size={12} color={colors.textMuted} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 15 }}>
                  {yesterdayPoll.source_article_outlet ?? 'Source'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Report link */}
        {todayPoll && todayPoll.status === 'published' && user && (
          <Pressable
            onPress={() => setShowReport(true)}
            style={{ alignSelf: 'center', marginTop: SPACING.md, paddingVertical: SPACING.xs }}
          >
            <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted }}>
              Report this poll
            </Text>
          </Pressable>
        )}

        {/* Daily Question methodology */}
        <View style={{ marginHorizontal: SPACING.xl, marginTop: SPACING.xl, flexDirection: 'row', gap: SPACING.sm, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md }}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
            AI selects topics from verified news. Questions are policy-only — never about groups of people. One vote per person per day.
          </Text>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ═══ PUBLISHED AUSTRALIAN POLLING ═══ */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <View style={{ marginTop: SPACING.xxxl, paddingHorizontal: SPACING.xl }}>
          {/* Section header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg }}>
            <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: GREEN }} />
            <Text style={{ fontSize: 22, fontWeight: FONT_WEIGHT.bold, color: colors.text, letterSpacing: -0.3 }}>
              Federal Polling
            </Text>
          </View>

          {/* Aggregate headline */}
          {aggregate && aggregate.tpp_alp && aggregate.tpp_lnp ? (
            <View style={{
              backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.md,
            }}>
              <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
                Poll of Polls — {aggregate.poll_count} poll{aggregate.poll_count !== 1 ? 's' : ''}, 30-day average
              </Text>

              {/* TPP big numbers */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xl, marginBottom: SPACING.lg }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: '#DC3545', marginBottom: 4 }}>ALP</Text>
                  <Text style={{ fontSize: 36, fontWeight: '800', color: '#DC3545' }}>{aggregate.tpp_alp}</Text>
                </View>
                <Text style={{ fontSize: 18, color: colors.textMuted, fontWeight: FONT_WEIGHT.medium }}>—</Text>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: '#2563EB', marginBottom: 4 }}>L/NP</Text>
                  <Text style={{ fontSize: 36, fontWeight: '800', color: '#2563EB' }}>{aggregate.tpp_lnp}</Text>
                </View>
              </View>

              {/* TPP bar */}
              <View style={{ height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.cardAlt }}>
                <View style={{ flex: Number(aggregate.tpp_alp), backgroundColor: '#DC3545' }} />
                <View style={{ flex: Number(aggregate.tpp_lnp), backgroundColor: '#2563EB' }} />
              </View>

              <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm }}>
                Two-party preferred
              </Text>

              {/* Primary votes row */}
              {aggregate.primary_alp && aggregate.primary_lnp && aggregate.primary_grn && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>ALP</Text>
                    <Text style={{ fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{aggregate.primary_alp}%</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>L/NP</Text>
                    <Text style={{ fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{aggregate.primary_lnp}%</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>GRN</Text>
                    <Text style={{ fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{aggregate.primary_grn}%</Text>
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {/* Pollster filter chips */}
          {pollsters.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: SPACING.lg }}
              contentContainerStyle={{ gap: SPACING.sm }}
            >
              <Pressable
                onPress={() => setSelectedPollster(null)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: !selectedPollster ? GREEN : colors.cardAlt,
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: FONT_WEIGHT.semibold,
                  color: !selectedPollster ? '#fff' : colors.textBody,
                }}>All</Text>
              </Pressable>
              {pollsters.map(p => (
                <Pressable
                  key={p}
                  onPress={() => setSelectedPollster(selectedPollster === p ? null : p)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    backgroundColor: selectedPollster === p ? GREEN : colors.cardAlt,
                  }}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: FONT_WEIGHT.semibold,
                    color: selectedPollster === p ? '#fff' : colors.textBody,
                  }}>{p}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Individual poll cards */}
          <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
            Latest Polls
          </Text>

          {publishedLoading ? (
            <>
              <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.sm }} />
              <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.sm }} />
              <SkeletonLoader height={100} borderRadius={BORDER_RADIUS.lg} />
            </>
          ) : publishedPolls.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: SPACING.xxxl }}>
              <Ionicons name="bar-chart-outline" size={40} color={colors.textMuted} />
              <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.md }}>
                No polls match this filter
              </Text>
            </View>
          ) : (
            publishedPolls.map((poll: PublishedPoll) => (
              <Pressable
                key={poll.id}
                onPress={() => navigation.navigate('PollDetail', { poll })}
                style={({ pressed }) => ({
                  backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
                  padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                {/* Pollster + date row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                    {poll.pollster}
                  </Text>
                  <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                    {timeAgo(poll.publish_date)}
                  </Text>
                </View>

                {/* TPP numbers */}
                {poll.tpp_alp && poll.tpp_lnp && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ fontSize: 11, color: '#DC3545', fontWeight: FONT_WEIGHT.semibold }}>ALP</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#DC3545' }}>{poll.tpp_alp}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: colors.textMuted }}>—</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: FONT_WEIGHT.semibold }}>L/NP</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#2563EB' }}>{poll.tpp_lnp}</Text>
                    </View>

                    {/* TPP mini bar */}
                    <View style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.cardAlt }}>
                      <View style={{ flex: Number(poll.tpp_alp), backgroundColor: '#DC3545' }} />
                      <View style={{ flex: Number(poll.tpp_lnp), backgroundColor: '#2563EB' }} />
                    </View>
                  </View>
                )}

                {/* Meta row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
                  {poll.sample_size && (
                    <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                      n={poll.sample_size.toLocaleString()}
                    </Text>
                  )}
                  {poll.methodology && (
                    <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                      {poll.methodology}
                    </Text>
                  )}
                  <View style={{ flex: 1 }} />
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </View>
              </Pressable>
            ))
          )}

          {/* Sources & methodology */}
          <View style={{ marginTop: SPACING.lg, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
                Polling data sourced from published polls by major Australian polling firms, aggregated from Wikipedia (CC-BY-SA). Every poll links to the original source. Verity does not conduct its own polls.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Report modal */}
      <Modal visible={showReport} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}>
          <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.lg }}>
              Report this poll
            </Text>

            {REPORT_REASONS.map(r => (
              <Pressable
                key={r.id}
                onPress={() => setReportReason(r.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm }}
              >
                <Ionicons
                  name={reportReason === r.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={reportReason === r.id ? GREEN : colors.textMuted}
                />
                <Text style={{ fontSize: FONT_SIZE.body, color: colors.text }}>{r.label}</Text>
              </Pressable>
            ))}

            <TextInput
              style={{
                backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md,
                padding: SPACING.md, fontSize: FONT_SIZE.body, color: colors.text,
                minHeight: 60, textAlignVertical: 'top', marginTop: SPACING.md,
              }}
              multiline
              value={reportText}
              onChangeText={setReportText}
              placeholder="Additional details (optional)"
              placeholderTextColor={colors.textMuted}
            />

            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Pressable
                onPress={() => { setShowReport(false); setReportText(''); }}
                style={{ flex: 1, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', backgroundColor: colors.surface }}
              >
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmitReport}
                disabled={submittingReport}
                style={{ flex: 1, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', backgroundColor: '#DC3545', opacity: submittingReport ? 0.5 : 1 }}
              >
                {submittingReport ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>Submit</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
