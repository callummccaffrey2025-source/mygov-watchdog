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
import { PollTrendChart } from '../components/PollTrendChart';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS, PARTY_COLORS } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';

const GREEN = '#00843D';

type TabMode = 'federal' | 'daily';

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
  const { user } = useUser();
  const [tab, setTab] = useState<TabMode>('federal');
  const [trendMode, setTrendMode] = useState<'tpp' | 'primary'>('primary');
  const [selectedPollster, setSelectedPollster] = useState<string | null>(null);

  const { polls: publishedPolls, loading: publishedLoading } = usePublishedPolls({
    pollster: selectedPollster ?? undefined,
    limit: 20,
  });
  const { aggregate } = usePollAggregate(30);
  const pollsters = usePollsters();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [todayPoll, setTodayPoll] = useState<DailyPoll | null>(null);
  const [yesterdayPoll, setYesterdayPoll] = useState<DailyPoll | null>(null);
  const [todayResults, setTodayResults] = useState<PollResult[]>([]);
  const [yesterdayResults, setYesterdayResults] = useState<PollResult[]>([]);
  const [userVoteToday, setUserVoteToday] = useState<string | null>(null);
  const [userVoteYesterday, setUserVoteYesterday] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);

  // Report modal
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

      const { data: tp } = await supabase
        .from('daily_polls').select('*')
        .eq('publish_date', today).in('status', ['published', 'withdrawn']).maybeSingle();
      setTodayPoll(tp as DailyPoll | null);

      const { data: yp } = await supabase
        .from('daily_polls').select('*')
        .eq('publish_date', yesterday).in('status', ['published', 'withdrawn']).maybeSingle();
      setYesterdayPoll(yp as DailyPoll | null);

      if (yp) {
        const { data: yr } = await supabase.from('daily_poll_results').select('*').eq('poll_id', yp.id);
        setYesterdayResults((yr || []) as PollResult[]);
      }
      if (tp) {
        const { data: tr } = await supabase.from('daily_poll_results').select('*').eq('poll_id', tp.id);
        setTodayResults((tr || []) as PollResult[]);
      }
      if (user) {
        if (tp) {
          const { data: uv } = await supabase.from('daily_poll_responses').select('option_chosen').eq('poll_id', tp.id).eq('user_id', user.id).maybeSingle();
          setUserVoteToday(uv?.option_chosen ?? null);
        }
        if (yp) {
          const { data: uv } = await supabase.from('daily_poll_responses').select('option_chosen').eq('poll_id', yp.id).eq('user_id', user.id).maybeSingle();
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
    setUserVoteToday(option);
    try {
      await supabase.from('daily_poll_responses').insert({
        poll_id: todayPoll.id, user_id: user.id, option_chosen: option,
      });
      track('daily_poll_vote', { poll_id: todayPoll.id, option }, 'Polls');
      const { data: tr } = await supabase.from('daily_poll_results').select('*').eq('poll_id', todayPoll.id);
      setTodayResults((tr || []) as PollResult[]);
    } catch { setUserVoteToday(null); }
    setVoting(false);
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
        {/* Header + Segment Control */}
        <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.md }}>
          <Text style={{ fontSize: 28, fontWeight: FONT_WEIGHT.bold, color: colors.text, letterSpacing: -0.5 }}>
            Polls
          </Text>
        </View>

        {/* Segment Control */}
        <View style={{ flexDirection: 'row', marginHorizontal: SPACING.xl, marginBottom: SPACING.xl, backgroundColor: colors.cardAlt, borderRadius: BORDER_RADIUS.md, padding: 3 }}>
          <Pressable
            onPress={() => setTab('federal')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'federal' }}
            style={{
              flex: 1, paddingVertical: SPACING.sm + 2, borderRadius: BORDER_RADIUS.sm,
              backgroundColor: tab === 'federal' ? colors.card : 'transparent',
              alignItems: 'center',
              ...(tab === 'federal' ? SHADOWS.sm : {}),
            }}
          >
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: tab === 'federal' ? FONT_WEIGHT.bold : FONT_WEIGHT.medium, color: tab === 'federal' ? colors.text : colors.textMuted }}>
              Federal Polls
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('daily')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'daily' }}
            style={{
              flex: 1, paddingVertical: SPACING.sm + 2, borderRadius: BORDER_RADIUS.sm,
              backgroundColor: tab === 'daily' ? colors.card : 'transparent',
              alignItems: 'center',
              ...(tab === 'daily' ? SHADOWS.sm : {}),
            }}
          >
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: tab === 'daily' ? FONT_WEIGHT.bold : FONT_WEIGHT.medium, color: tab === 'daily' ? colors.text : colors.textMuted }}>
              {"Today's Question"}
            </Text>
          </Pressable>
        </View>

        {tab === 'federal' ? renderFederalPolls() : renderDailyPoll()}
      </ScrollView>

      {/* Report modal */}
      {renderReportModal()}
    </SafeAreaView>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ═══ FEDERAL POLLS ═══
  // ═══════════════════════════════════════════════════════════════════════

  function renderFederalPolls() {
    return (
      <View style={{ paddingHorizontal: SPACING.xl }}>

        {/* ── Primary Vote Hero ────────────────────────────────────────── */}
        {aggregate && aggregate.primary_alp && aggregate.primary_lnp ? (
          <View style={{
            backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.md,
          }}>
            <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.lg }}>
              Primary Vote — {aggregate.poll_count} poll{aggregate.poll_count !== 1 ? 's' : ''}, 30-day avg
            </Text>

            {/* Stacked horizontal bar */}
            {(() => {
              const parties = [
                { key: 'ALP', value: aggregate.primary_alp ?? 0, color: PARTY_COLORS.ALP },
                { key: 'ONP', value: aggregate.primary_onp ?? 0, color: PARTY_COLORS.ONP },
                { key: 'L/NP', value: aggregate.primary_lnp ?? 0, color: PARTY_COLORS.LNP },
                { key: 'GRN', value: aggregate.primary_grn ?? 0, color: PARTY_COLORS.GRN },
              ].sort((a, b) => b.value - a.value);

              return (
                <>
                  {/* Stacked bar */}
                  <View style={{ height: 16, borderRadius: 8, overflow: 'hidden', flexDirection: 'row', marginBottom: SPACING.lg }}>
                    {parties.map(p => (
                      <View key={p.key} style={{ flex: p.value, backgroundColor: p.color }} />
                    ))}
                  </View>

                  {/* Party rows */}
                  {parties.map(p => (
                    <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color, marginRight: SPACING.sm }} />
                      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, color: colors.text, flex: 1 }}>
                        {p.key}
                      </Text>
                      <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                        {p.value}%
                      </Text>
                    </View>
                  ))}
                </>
              );
            })()}
          </View>
        ) : null}

        {/* ── TPP Card ─────────────────────────────────────────────────── */}
        {aggregate && aggregate.tpp_alp && aggregate.tpp_lnp ? (
          <View style={{
            backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.sm,
          }}>
            <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
              Two-Party Preferred
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xl, marginBottom: SPACING.md }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: PARTY_COLORS.ALP, marginBottom: 4 }}>ALP</Text>
                <Text style={{ fontSize: 36, fontWeight: '800', color: PARTY_COLORS.ALP }}>{aggregate.tpp_alp}</Text>
              </View>
              <Text style={{ fontSize: 18, color: colors.textMuted, fontWeight: FONT_WEIGHT.medium }}>—</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: PARTY_COLORS.LNP, marginBottom: 4 }}>L/NP</Text>
                <Text style={{ fontSize: 36, fontWeight: '800', color: PARTY_COLORS.LNP }}>{aggregate.tpp_lnp}</Text>
              </View>
            </View>

            <View style={{ height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.cardAlt }}>
              <View style={{ flex: Number(aggregate.tpp_alp), backgroundColor: PARTY_COLORS.ALP }} />
              <View style={{ flex: Number(aggregate.tpp_lnp), backgroundColor: PARTY_COLORS.LNP }} />
            </View>
          </View>
        ) : null}

        {/* ── Trend Chart ──────────────────────────────────────────────── */}
        {publishedPolls.length >= 2 && (
          <View style={{
            backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOWS.sm,
          }}>
            {/* Trend mode toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs, paddingHorizontal: SPACING.xs }}>
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold as any, color: colors.text }}>
                Trend
              </Text>
              <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: BORDER_RADIUS.sm, padding: 2 }}>
                <Pressable
                  onPress={() => setTrendMode('primary')}
                  style={{
                    paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm - 2,
                    backgroundColor: trendMode === 'primary' ? colors.card : 'transparent',
                    ...(trendMode === 'primary' ? SHADOWS.sm : {}),
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: trendMode === 'primary' ? colors.text : colors.textMuted }}>Primary</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTrendMode('tpp')}
                  style={{
                    paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm - 2,
                    backgroundColor: trendMode === 'tpp' ? colors.card : 'transparent',
                    ...(trendMode === 'tpp' ? SHADOWS.sm : {}),
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, color: trendMode === 'tpp' ? colors.text : colors.textMuted }}>TPP</Text>
                </Pressable>
              </View>
            </View>

            <PollTrendChart
              mode={trendMode}
              data={publishedPolls.map(p => ({
                date: p.publish_date,
                tpp_alp: p.tpp_alp,
                tpp_lnp: p.tpp_lnp,
                primary_alp: p.primary_alp,
                primary_lnp: p.primary_lnp,
                primary_grn: p.primary_grn,
                primary_one_nation: p.primary_one_nation,
                pollster: p.pollster,
              }))}
            />
          </View>
        )}

        {/* ── Pollster Filter ──────────────────────────────────────────── */}
        {pollsters.length > 0 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={{ marginBottom: SPACING.lg }}
            contentContainerStyle={{ gap: SPACING.sm }}
          >
            <Pressable
              onPress={() => setSelectedPollster(null)}
              accessibilityRole="button"
              accessibilityState={{ selected: !selectedPollster }}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                backgroundColor: !selectedPollster ? GREEN : colors.cardAlt,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: FONT_WEIGHT.semibold, color: !selectedPollster ? '#fff' : colors.textBody }}>All</Text>
            </Pressable>
            {pollsters.map(p => (
              <Pressable
                key={p}
                onPress={() => setSelectedPollster(selectedPollster === p ? null : p)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPollster === p }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: selectedPollster === p ? GREEN : colors.cardAlt,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: FONT_WEIGHT.semibold, color: selectedPollster === p ? '#fff' : colors.textBody }}>{p}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ── Latest Polls ─────────────────────────────────────────────── */}
        <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 1, color: colors.textMuted, textTransform: 'uppercase', marginBottom: SPACING.md }}>
          Latest Polls
        </Text>

        {publishedLoading ? (
          <>
            <SkeletonLoader height={120} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.sm }} />
            <SkeletonLoader height={120} borderRadius={BORDER_RADIUS.lg} style={{ marginBottom: SPACING.sm }} />
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
              accessibilityRole="button"
              accessibilityLabel={`View ${poll.pollster} poll from ${timeAgo(poll.publish_date)}`}
              style={({ pressed }) => ({
                backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
                padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              {/* Pollster + date */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm }}>
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{poll.pollster}</Text>
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>{timeAgo(poll.publish_date)}</Text>
              </View>

              {/* TPP numbers */}
              {poll.tpp_alp && poll.tpp_lnp && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text style={{ fontSize: 11, color: PARTY_COLORS.ALP, fontWeight: FONT_WEIGHT.semibold }}>ALP</Text>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: PARTY_COLORS.ALP }}>{poll.tpp_alp}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.textMuted }}>—</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text style={{ fontSize: 11, color: PARTY_COLORS.LNP, fontWeight: FONT_WEIGHT.semibold }}>L/NP</Text>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: PARTY_COLORS.LNP }}>{poll.tpp_lnp}</Text>
                  </View>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.cardAlt }}>
                    <View style={{ flex: Number(poll.tpp_alp), backgroundColor: PARTY_COLORS.ALP }} />
                    <View style={{ flex: Number(poll.tpp_lnp), backgroundColor: PARTY_COLORS.LNP }} />
                  </View>
                </View>
              )}

              {/* Primary vote mini-badges */}
              <View style={{ flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm }}>
                {poll.primary_alp != null && <MiniBadge label="ALP" value={poll.primary_alp} color={PARTY_COLORS.ALP} textColor={colors.textMuted} />}
                {poll.primary_one_nation != null && <MiniBadge label="ONP" value={poll.primary_one_nation} color={PARTY_COLORS.ONP} textColor={colors.textMuted} />}
                {poll.primary_lnp != null && <MiniBadge label="L/NP" value={poll.primary_lnp} color={PARTY_COLORS.LNP} textColor={colors.textMuted} />}
                {poll.primary_grn != null && <MiniBadge label="GRN" value={poll.primary_grn} color={PARTY_COLORS.GRN} textColor={colors.textMuted} />}
              </View>

              {/* Meta row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
                {poll.sample_size && (
                  <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>n={poll.sample_size.toLocaleString()}</Text>
                )}
                {poll.methodology && (
                  <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>{poll.methodology}</Text>
                )}
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </View>
            </Pressable>
          ))
        )}

        {/* Updated timestamp */}
        {publishedPolls.length > 0 && (
          <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm }}>
            Latest poll: {timeAgo(publishedPolls[0].publish_date)}
          </Text>
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
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ═══ DAILY POLL ═══
  // ═══════════════════════════════════════════════════════════════════════

  function renderDailyPoll() {
    return (
      <View style={{ paddingHorizontal: SPACING.xl }}>
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginBottom: SPACING.lg }}>
          One question. Every day. Your voice matters.
        </Text>

        {/* Today's poll */}
        {todayPoll ? (
          <View style={{
            backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.xl, marginBottom: SPACING.xl, ...SHADOWS.md,
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.8, marginBottom: SPACING.md }}>
              {"TODAY'S QUESTION"}
            </Text>

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
                <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 26, marginBottom: SPACING.lg }}>
                  {todayPoll.question}
                </Text>

                {!userVoteToday && !voting ? (
                  <View style={{ gap: SPACING.sm }}>
                    <VoteButton label={todayPoll.option_a_text} onPress={() => handleVote('a')} colors={colors} />
                    <VoteButton label={todayPoll.option_b_text} onPress={() => handleVote('b')} colors={colors} />
                    <Pressable onPress={() => handleVote('skip')} style={{ paddingVertical: SPACING.sm, alignItems: 'center' }}>
                      <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>{todayPoll.skip_text || 'Not sure'}</Text>
                    </Pressable>
                  </View>
                ) : voting ? (
                  <ActivityIndicator color={GREEN} style={{ paddingVertical: SPACING.xl }} />
                ) : (
                  <>
                    {renderResultBars(todayResults, todayPoll, userVoteToday)}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md }}>
                      <Ionicons name="checkmark-circle" size={14} color={GREEN} />
                      <Text style={{ fontSize: FONT_SIZE.caption, color: GREEN, fontWeight: FONT_WEIGHT.medium }}>You voted</Text>
                    </View>
                  </>
                )}

                {todayPoll.source_article_title && (
                  <Pressable
                    onPress={() => { if (todayPoll.source_article_url) Linking.openURL(todayPoll.source_article_url); }}
                    accessibilityRole="button"
                    accessibilityLabel={`View source: ${todayPoll.source_article_title}`}
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
          <View style={{ backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, marginBottom: SPACING.xl, alignItems: 'center' }}>
            <Ionicons name="time-outline" size={32} color={colors.textMuted} />
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.md }}>No poll today</Text>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xs }}>
              We'll be back tomorrow at 6am with a new question.
            </Text>
          </View>
        )}

        {/* Yesterday's results */}
        {yesterdayPoll && (
          <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, ...SHADOWS.sm }}>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.8, marginBottom: SPACING.md }}>
              YESTERDAY — {formatDate(yesterdayPoll.publish_date).toUpperCase()}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 24, marginBottom: SPACING.lg }}>
              {yesterdayPoll.question}
            </Text>
            {yesterdayResults.length > 0 ? (
              renderResultBars(yesterdayResults, yesterdayPoll, userVoteYesterday)
            ) : (
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, textAlign: 'center' }}>No responses recorded</Text>
            )}
            {userVoteYesterday && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm }}>
                <Ionicons name="checkmark-circle" size={13} color={colors.textMuted} />
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                  You voted: {userVoteYesterday === 'a' ? yesterdayPoll.option_a_text : userVoteYesterday === 'b' ? yesterdayPoll.option_b_text : yesterdayPoll.skip_text}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Report link */}
        {todayPoll && todayPoll.status === 'published' && user && (
          <Pressable onPress={() => setShowReport(true)} style={{ alignSelf: 'center', marginTop: SPACING.md, paddingVertical: SPACING.xs }}>
            <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted }}>Report this poll</Text>
          </Pressable>
        )}

        {/* Methodology note */}
        <View style={{ marginTop: SPACING.xl, flexDirection: 'row', gap: SPACING.sm, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md }}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
            AI selects topics from verified news. Questions are policy-only — never about groups of people. One vote per person per day.
          </Text>
        </View>
      </View>
    );
  }

  // ── Shared render helpers ──────────────────────────────────────────────

  function renderResultBars(results: PollResult[], poll: DailyPoll, userVote: string | null) {
    const totalResponses = results.reduce((s, r) => s + r.response_count, 0);
    const aResult = results.find(r => r.option_chosen === 'a');
    const bResult = results.find(r => r.option_chosen === 'b');
    const aPct = aResult?.percentage ?? 0;
    const bPct = bResult?.percentage ?? 0;

    return (
      <View style={{ gap: SPACING.md }}>
        <ResultBar label={poll.option_a_text} pct={aPct} isUserVote={userVote === 'a'} colors={colors} />
        <ResultBar label={poll.option_b_text} pct={bPct} isUserVote={userVote === 'b'} colors={colors} />
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, textAlign: 'center' }}>
          {totalResponses.toLocaleString()} response{totalResponses !== 1 ? 's' : ''}
        </Text>
      </View>
    );
  }

  function renderReportModal() {
    return (
      <Modal visible={showReport} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}>
          <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.lg }}>Report this poll</Text>
            {REPORT_REASONS.map(r => (
              <Pressable key={r.id} onPress={() => setReportReason(r.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm }}>
                <Ionicons name={reportReason === r.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={reportReason === r.id ? GREEN : colors.textMuted} />
                <Text style={{ fontSize: FONT_SIZE.body, color: colors.text }}>{r.label}</Text>
              </Pressable>
            ))}
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: FONT_SIZE.body, color: colors.text, minHeight: 60, textAlignVertical: 'top', marginTop: SPACING.md }}
              multiline value={reportText} onChangeText={setReportText}
              placeholder="Additional details (optional)" placeholderTextColor={colors.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Pressable onPress={() => { setShowReport(false); setReportText(''); }} style={{ flex: 1, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', backgroundColor: colors.surface }}>
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSubmitReport} disabled={submittingReport} style={{ flex: 1, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', backgroundColor: '#DC3545', opacity: submittingReport ? 0.5 : 1 }}>
                {submittingReport ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>Submit</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}

// ── Small components ──────────────────────────────────────────────────────

function MiniBadge({ label, value, color, textColor }: { label: string; value: number; color: string; textColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: FONT_SIZE.caption, color: textColor }}>{label}</Text>
      <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color }}>{value}</Text>
    </View>
  );
}

function VoteButton({ label, onPress, colors }: { label: string; onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Vote: ${label}`}
      style={({ pressed }) => ({
        borderWidth: 1.5, borderColor: GREEN, borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
        alignItems: 'center',
        backgroundColor: pressed ? GREEN + '10' : 'transparent',
      })}
    >
      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: GREEN }}>{label}</Text>
    </Pressable>
  );
}

function ResultBar({ label, pct, isUserVote, colors }: { label: string; pct: number; isUserVote: boolean; colors: any }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: isUserVote ? FONT_WEIGHT.bold : FONT_WEIGHT.medium, color: isUserVote ? GREEN : colors.text, flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: isUserVote ? GREEN : colors.textBody }}>
          {pct}%
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: isUserVote ? GREEN : '#9CA3AF' }} />
      </View>
    </View>
  );
}
