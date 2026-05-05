import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, RefreshControl, TextInput,
  Modal, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const GREEN = '#00843D';
const RED = '#DC3545';
const ADMIN_EMAILS = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? 'callummccaffrey2025@gmail.com').split(',').map((e: string) => e.trim().toLowerCase());

interface DailyPoll {
  id: string;
  publish_date: string;
  question: string;
  option_a_text: string;
  option_b_text: string;
  source_article_url: string;
  source_article_title: string | null;
  source_article_outlet: string | null;
  ai_generation_metadata: any;
  status: string;
  withdrawn_reason: string | null;
  published_at: string | null;
  created_at: string;
}

export function AdminPollsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [polls, setPolls] = useState<DailyPoll[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});

  // Withdraw modal
  const [withdrawTarget, setWithdrawTarget] = useState<DailyPoll | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Generating replacement
  const [generating, setGenerating] = useState(false);

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const fetchData = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('daily_polls')
        .select('*')
        .in('status', ['published', 'withdrawn', 'draft'])
        .order('publish_date', { ascending: false })
        .limit(8);
      setPolls((data || []) as DailyPoll[]);

      // Get response counts per poll
      const counts: Record<string, number> = {};
      const reports: Record<string, number> = {};
      for (const p of (data || [])) {
        const { count } = await supabase
          .from('daily_poll_responses')
          .select('id', { count: 'exact', head: true })
          .eq('poll_id', p.id);
        counts[p.id] = count ?? 0;

        const { count: rc } = await supabase
          .from('poll_reports')
          .select('id', { count: 'exact', head: true })
          .eq('poll_id', p.id);
        reports[p.id] = rc ?? 0;
      }
      setResponseCounts(counts);
      setReportCounts(reports);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const handleWithdraw = async () => {
    if (!withdrawTarget || !withdrawReason.trim() || !user) return;
    setWithdrawing(true);
    try {
      await supabase.from('daily_polls').update({
        status: 'withdrawn',
        withdrawn_reason: withdrawReason.trim(),
        withdrawn_at: new Date().toISOString(),
        withdrawn_by: user.id,
      }).eq('id', withdrawTarget.id);

      await supabase.from('poll_admin_actions').insert({
        poll_id: withdrawTarget.id,
        action_type: 'withdraw',
        reason: withdrawReason.trim(),
        performed_by: user.id,
      });

      setWithdrawTarget(null);
      setWithdrawReason('');
      await fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to withdraw');
    }
    setWithdrawing(false);
  };

  const handleGenerateReplacement = async () => {
    setGenerating(true);
    try {
      // Delete today's poll first so the function can generate a new one
      const today = polls[0]?.publish_date;
      if (today) {
        await supabase.from('daily_polls').delete().eq('publish_date', today);
      }
      const { data, error } = await supabase.functions.invoke('generate-daily-poll', { body: {} });
      if (error || !data?.success) {
        Alert.alert('Generation failed', data?.reason ?? error?.message ?? 'Could not generate replacement');
      } else {
        Alert.alert('Replacement generated', data.question);
        await fetchData();
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to generate');
    }
    setGenerating(false);
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ padding: SPACING.xl }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl }}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textMuted} />
          <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginTop: SPACING.lg }}>
            Not authorised
          </Text>
          <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm }}>
            Admin access is restricted to authorised accounts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ActivityIndicator color={GREEN} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const todayPoll = polls[0];
  const yesterdayPoll = polls[1];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.lg }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ fontSize: 22, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
            Poll Admin
          </Text>
        </View>

        {/* Today's poll */}
        {todayPoll ? (
          <View style={{ marginHorizontal: SPACING.xl, marginBottom: SPACING.xl, backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, ...SHADOWS.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
              <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.8 }}>
                {"TODAY'S POLL"}
              </Text>
              <View style={{
                paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs,
                borderRadius: BORDER_RADIUS.sm,
                backgroundColor: todayPoll.status === 'published' ? GREEN + '15' : RED + '15',
              }}>
                <Text style={{ fontSize: FONT_SIZE.caption - 1, fontWeight: FONT_WEIGHT.bold, color: todayPoll.status === 'published' ? GREEN : RED }}>
                  {todayPoll.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 24, marginBottom: SPACING.sm }}>
              {todayPoll.question}
            </Text>

            <Text style={{ fontSize: FONT_SIZE.small, color: GREEN, marginBottom: 4 }}>A: {todayPoll.option_a_text}</Text>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, marginBottom: SPACING.md }}>B: {todayPoll.option_b_text}</Text>

            {/* Source */}
            <Pressable onPress={() => Linking.openURL(todayPoll.source_article_url)} style={{ marginBottom: SPACING.md }}>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                Source: {todayPoll.source_article_outlet ?? 'Unknown'} — {todayPoll.source_article_title ?? todayPoll.source_article_url}
              </Text>
            </Pressable>

            {/* AI metadata */}
            <View style={{ backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.md }}>
              <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, fontFamily: 'Courier' }}>
                Model: {todayPoll.ai_generation_metadata?.model ?? '?'}{'\n'}
                Tokens: {todayPoll.ai_generation_metadata?.tokens_used ?? '?'}{'\n'}
                Generated: {todayPoll.ai_generation_metadata?.generated_at?.slice(0, 19) ?? '?'}
              </Text>
            </View>

            {/* Stats */}
            <View style={{ flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.lg }}>
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody }}>
                {responseCounts[todayPoll.id] ?? 0} responses
              </Text>
              <Text style={{ fontSize: FONT_SIZE.small, color: (reportCounts[todayPoll.id] ?? 0) > 0 ? RED : colors.textMuted }}>
                {reportCounts[todayPoll.id] ?? 0} reports
              </Text>
            </View>

            {/* Actions */}
            {todayPoll.status === 'published' && (
              <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                <Pressable
                  onPress={() => setWithdrawTarget(todayPoll)}
                  style={{ flex: 1, backgroundColor: RED + '10', borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: RED }}>Withdraw</Text>
                </Pressable>
                <Pressable
                  onPress={handleGenerateReplacement}
                  disabled={generating}
                  style={{ flex: 1, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', opacity: generating ? 0.5 : 1 }}
                >
                  {generating ? (
                    <ActivityIndicator color={GREEN} size="small" />
                  ) : (
                    <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: GREEN }}>Replace</Text>
                  )}
                </Pressable>
              </View>
            )}

            {todayPoll.status === 'withdrawn' && todayPoll.withdrawn_reason && (
              <View style={{ backgroundColor: RED + '08', borderRadius: BORDER_RADIUS.sm, padding: SPACING.sm }}>
                <Text style={{ fontSize: FONT_SIZE.caption, color: RED }}>
                  Withdrawn: {todayPoll.withdrawn_reason}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ marginHorizontal: SPACING.xl, marginBottom: SPACING.xl, backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.textMuted} />
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.sm }}>
              No poll generated today
            </Text>
            <Pressable
              onPress={handleGenerateReplacement}
              disabled={generating}
              style={{ marginTop: SPACING.md, backgroundColor: GREEN, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm }}
            >
              {generating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>Generate now</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Yesterday + history */}
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, letterSpacing: 0.8, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md }}>
          RECENT POLLS
        </Text>
        {polls.slice(1).map(poll => (
          <View key={poll.id} style={{
            marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
            backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
            padding: SPACING.lg, ...SHADOWS.sm,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>{poll.publish_date}</Text>
              <Text style={{ fontSize: FONT_SIZE.caption - 1, fontWeight: FONT_WEIGHT.bold, color: poll.status === 'withdrawn' ? RED : GREEN }}>
                {poll.status.toUpperCase()}
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }} numberOfLines={2}>
              {poll.question}
            </Text>
            <View style={{ flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.xs }}>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                {responseCounts[poll.id] ?? 0} votes
              </Text>
              {poll.status === 'published' && (
                <Pressable onPress={() => setWithdrawTarget(poll)}>
                  <Text style={{ fontSize: FONT_SIZE.caption, color: RED }}>Withdraw</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Withdraw modal */}
      <Modal visible={!!withdrawTarget} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl }}>
          <View style={{ backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, width: '100%', maxWidth: 400 }}>
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.md }}>
              Withdraw this poll?
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, marginBottom: SPACING.md }}>
              "{withdrawTarget?.question}"
            </Text>
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.xs }}>
              Reason (required):
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md,
                padding: SPACING.md, fontSize: FONT_SIZE.body, color: colors.text,
                minHeight: 80, textAlignVertical: 'top',
              }}
              multiline
              value={withdrawReason}
              onChangeText={setWithdrawReason}
              placeholder="Why is this poll being withdrawn?"
              placeholderTextColor={colors.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Pressable
                onPress={() => { setWithdrawTarget(null); setWithdrawReason(''); }}
                style={{ flex: 1, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', backgroundColor: colors.surface }}
              >
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleWithdraw}
                disabled={!withdrawReason.trim() || withdrawing}
                style={{ flex: 1, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center', backgroundColor: RED, opacity: withdrawReason.trim() ? 1 : 0.4 }}
              >
                {withdrawing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>Withdraw</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
