import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useHypocrisyIndex, HypocrisyTopic } from '../hooks/useHypocrisyIndex';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';
import { decodeHtml } from '../utils/decodeHtml';

function scoreColor(score: number): string {
  if (score > 66) return '#DC3545';
  if (score > 33) return '#F59E0B';
  return '#00843D';
}

function PositionBar({ stated, voting }: { stated: number; voting: number }) {
  const { colors } = useTheme();
  // Bar from -1 to +1, 0 centered
  const statedPct = ((stated + 1) / 2) * 100;
  const votingPct = ((voting + 1) / 2) * 100;

  return (
    <View style={{ marginVertical: SPACING.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 10, color: colors.textMuted }}>Against</Text>
        <Text style={{ fontSize: 10, color: colors.textMuted }}>For</Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, position: 'relative' }}>
        {/* Center line */}
        <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: colors.borderStrong }} />
        {/* Stated position (blue) */}
        <View style={{
          position: 'absolute', left: `${statedPct}%`, top: -3, width: 14, height: 14,
          borderRadius: 7, backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#fff',
          marginLeft: -7,
        }} />
        {/* Voting position (red) */}
        <View style={{
          position: 'absolute', left: `${votingPct}%`, top: -3, width: 14, height: 14,
          borderRadius: 7, backgroundColor: '#DC3545', borderWidth: 2, borderColor: '#fff',
          marginLeft: -7,
        }} />
      </View>
      <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' }} />
          <Text style={{ fontSize: 10, color: colors.textMuted }}>What they said</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC3545' }} />
          <Text style={{ fontSize: 10, color: colors.textMuted }}>How they voted</Text>
        </View>
      </View>
    </View>
  );
}

function TopicCard({ topic, colors }: { topic: HypocrisyTopic; colors: any }) {
  const { isDark } = useTheme();
  return (
    <View style={{
      backgroundColor: isDark ? colors.cardAlt : '#FFF8E7', borderRadius: BORDER_RADIUS.lg,
      borderWidth: 2, borderColor: '#DC3545', padding: SPACING.lg,
      marginBottom: SPACING.md,
    }}>
      {/* Topic pill */}
      <View style={{ flexDirection: 'row', marginBottom: SPACING.sm }}>
        <View style={{ backgroundColor: '#FCE4EC', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: FONT_WEIGHT.semibold, color: '#C2185B' }}>
            {topic.policy_name}
          </Text>
        </View>
      </View>

      <PositionBar stated={topic.stated_position} voting={topic.voting_position} />

      {/* They said */}
      {topic.speech_excerpt && (
        <View style={{ backgroundColor: '#FFF0D6', borderRadius: 8, padding: 12, marginTop: SPACING.sm }}>
          <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.bold, color: '#92400E', marginBottom: 4 }}>They said:</Text>
          <Text style={{ fontSize: 14, fontStyle: 'italic', color: '#1F2937', lineHeight: 20 }}>
            "{decodeHtml(topic.speech_excerpt)}"
          </Text>
          {topic.speech_date && (
            <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{timeAgo(topic.speech_date)}</Text>
          )}
        </View>
      )}

      {/* They voted */}
      {topic.example_vote && (
        <View style={{ backgroundColor: isDark ? colors.surface : '#F3F4F6', borderRadius: 8, padding: 12, marginTop: SPACING.sm }}>
          <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, marginBottom: 4 }}>They voted:</Text>
          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }} numberOfLines={3}>
            {topic.example_vote.division_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <View style={{
              backgroundColor: topic.example_vote.vote === 'aye' ? colors.greenBg : topic.example_vote.vote === 'no' ? colors.redBg : colors.cardAlt,
              borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3,
            }}>
              <Text style={{
                fontSize: 12, fontWeight: FONT_WEIGHT.bold,
                color: topic.example_vote.vote === 'aye' ? colors.green : topic.example_vote.vote === 'no' ? colors.red : colors.textMuted,
              }}>
                {topic.example_vote.vote === 'aye' ? 'Voted Aye' : topic.example_vote.vote === 'no' ? 'Voted No' : `Voted ${topic.example_vote.vote}`}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>{topic.example_vote.date}</Text>
          </View>
        </View>
      )}

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.sm }}>
        {topic.speech_count != null && (
          <Text style={{ fontSize: 11, color: colors.textMuted }}>{topic.speech_count} speeches</Text>
        )}
        {topic.vote_count != null && (
          <Text style={{ fontSize: 11, color: colors.textMuted }}>{topic.vote_count} votes</Text>
        )}
      </View>
    </View>
  );
}

export function HypocrisyDetailScreen({ route, navigation }: any) {
  const { memberId, memberName } = route.params as { memberId: string; memberName: string };
  const { data, loading } = useHypocrisyIndex(memberId);
  const { colors } = useTheme();
  const [showMethodology, setShowMethodology] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.md }}>
        <Pressable
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => navigation.goBack()} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
          Consistency Index
        </Text>
        <Pressable onPress={() => setShowMethodology(true)} hitSlop={8} accessibilityRole="button">
          <Ionicons name="information-circle-outline" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}>
        {loading ? (
          <>
            <SkeletonLoader height={120} borderRadius={16} style={{ marginBottom: 16 }} />
            {[1, 2, 3].map(i => <SkeletonLoader key={i} height={200} borderRadius={16} style={{ marginBottom: 12 }} />)}
          </>
        ) : !data || data.status === 'insufficient_data' ? (
          <View style={{ backgroundColor: '#FFF8E7', borderRadius: BORDER_RADIUS.lg, borderWidth: 2, borderColor: '#DC3545', padding: SPACING.xl, alignItems: 'center', gap: SPACING.md }}>
            <Ionicons name="analytics-outline" size={40} color="#DC3545" />
            <Text style={{ fontSize: 16, fontWeight: FONT_WEIGHT.bold, color: colors.text, textAlign: 'center' }}>
              Not enough data to score {memberName}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
              We need at least 3 classified speeches across topics. Currently have {data?.speeches_classified ?? 0} speeches and {data?.votes_linked ?? 0} linked votes.
            </Text>
          </View>
        ) : (
          <>
            {/* Score header */}
            <View style={{ alignItems: 'center', marginBottom: SPACING.xl }}>
              <Text style={{ fontSize: 56, fontWeight: '800', color: scoreColor(data.overall_score ?? 0) }}>
                {data.overall_score}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textBody }}>
                Ranks #{data.rank_among_mps} of {data.total_mps_scored} MPs scored
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 16, paddingHorizontal: SPACING.xl }}>
                Measures speech-vote consistency. Gaps may reflect legitimate position changes, not bad faith. AI-assisted analysis.
              </Text>
            </View>

            {/* All topic cards */}
            <Text style={{ fontSize: 16, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.md }}>
              All scored topics
            </Text>
            {(data.top_topics ?? []).map((topic, i) => (
              <TopicCard key={topic.policy_id ?? i} topic={topic} colors={colors} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Methodology modal */}
      <Modal visible={showMethodology} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.xl, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
              <Text style={{ fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>How is this calculated?</Text>
              <Pressable onPress={() => setShowMethodology(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView>
              <Text style={{ fontSize: 14, color: colors.textBody, lineHeight: 22, marginBottom: SPACING.md }}>
                The Consistency Index measures the gap between what an MP says in parliament and how they actually vote. A higher score means a bigger gap between words and actions.
              </Text>
              <Text style={{ fontSize: 14, color: colors.textBody, lineHeight: 22, marginBottom: SPACING.md }}>
                We analyse Hansard speeches and classify them against policy topics curated by TheyVoteForYou.org.au. Then we compare each MP's stated position in speeches with their voting record on divisions linked to those same policies.
              </Text>
              <Text style={{ fontSize: 14, color: colors.textBody, lineHeight: 22, marginBottom: SPACING.md }}>
                The score is rank-based: 100 means this MP has the biggest rhetoric-vote gap among all scored MPs, while 0 means they're the most consistent. Scores are weighted by the number of speeches and votes available.
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                Sources: OpenAustralia (speeches), TheyVoteForYou (policy classifications and vote records), Parliament of Australia (division data). Speech classification by Claude Haiku AI.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
