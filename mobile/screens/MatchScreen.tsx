import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, RefreshControl, Modal, ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import { useVerityMatch, MatchResult, IssueMatch } from '../hooks/useVerityMatch';
import { useIssueStances } from '../hooks/useIssueStances';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { hapticLight } from '../lib/haptics';

// ── Stance Quiz (inline) ────────────────────────────────────────────────

const STANCE_LABELS = ['Strongly\nDisagree', 'Disagree', 'Neutral', 'Agree', 'Strongly\nAgree'];
const STANCE_VALUES = [-2, -1, 0, 1, 2];
const STANCE_COLORS = ['#DC3545', '#F97316', '#9CA3AF', '#10B981', '#059669'];

function StanceQuiz({
  onComplete,
  navigation,
}: {
  onComplete: () => void;
  navigation: any;
}) {
  const { colors } = useTheme();
  const { issues, stances, loading, setStance } = useIssueStances();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedStance, setSelectedStance] = useState<number | null>(null);

  if (loading) return <View style={{ gap: 12 }}>
            {[1,2,3,4,5].map(i => <SkeletonLoader key={i} width="100%" height={20} />)}
          </View>;

  const issue = issues[currentIndex];
  if (!issue) return null;

  const progress = (currentIndex + 1) / issues.length;
  const existing = stances.find(s => s.issue_slug === issue.slug);

  const handleNext = async () => {
    if (selectedStance !== null) {
      await setStance(issue.slug, selectedStance);
    }
    if (currentIndex < issues.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedStance(null);
    } else {
      onComplete();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={['#00843D', '#006B31']}
        style={{ paddingHorizontal: 20, paddingTop: SPACING.lg, paddingBottom: SPACING.xl }}
      >
        <Pressable onPress={() => navigation?.goBack?.()} hitSlop={12} style={{ marginBottom: SPACING.md }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
          Verity Match
        </Text>
        <Text style={{ fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.8)', marginTop: SPACING.xs }}>
          Tell us where you stand on {issues.length} key issues
        </Text>

        {/* Progress bar */}
        <View style={{
          height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: 2, marginTop: SPACING.lg, overflow: 'hidden',
        }}>
          <View style={{
            height: 4, backgroundColor: '#fff',
            borderRadius: 2, width: `${progress * 100}%`,
          }} />
        </View>
        <Text style={{ fontSize: FONT_SIZE.caption, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.xs }}>
          {currentIndex + 1} of {issues.length}
        </Text>
      </LinearGradient>

      {/* Issue card */}
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          backgroundColor: colors.card,
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING.xl,
          ...SHADOWS.md,
        }}>
          <Text style={{
            fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold,
            color: '#00843D', textTransform: 'uppercase', letterSpacing: 0.5,
            marginBottom: SPACING.sm,
          }}>
            {issue.topic}
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold,
            color: colors.text, marginBottom: SPACING.md, lineHeight: 28,
          }}>
            {issue.name}
          </Text>
          <Text style={{
            fontSize: FONT_SIZE.body, color: colors.textMuted, lineHeight: 22,
          }}>
            {issue.description}
          </Text>
        </View>

        {/* Stance buttons */}
        <View style={{ marginTop: SPACING.xl }}>
          <Text style={{
            fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold,
            color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
            marginBottom: SPACING.md, textAlign: 'center',
          }}>
            Where do you stand?
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm }}>
            {STANCE_VALUES.map((val, i) => {
              const isSelected = (selectedStance ?? existing?.stance) === val;
              return (
                <Pressable
                  key={val}
                  onPress={() => { hapticLight(); setSelectedStance(val); }}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
                    borderRadius: BORDER_RADIUS.md,
                    backgroundColor: isSelected ? STANCE_COLORS[i] : colors.surface,
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{
                    fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium,
                    color: isSelected ? '#fff' : colors.textMuted,
                    textAlign: 'center', lineHeight: 14,
                  }}>
                    {STANCE_LABELS[i]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Skip / Next */}
        <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl }}>
          <Pressable
            onPress={() => {
              if (currentIndex < issues.length - 1) {
                setCurrentIndex(currentIndex + 1);
                setSelectedStance(null);
              } else {
                onComplete();
              }
            }}
            style={{
              flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
              borderWidth: 1, borderColor: colors.border, alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted }}>Skip</Text>
          </Pressable>

          <Pressable
            onPress={handleNext}
            style={{
              flex: 2, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
              backgroundColor: selectedStance !== null || existing ? '#00843D' : colors.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold,
              color: selectedStance !== null || existing ? '#fff' : colors.textMuted,
            }}>
              {currentIndex < issues.length - 1 ? 'Next' : 'See My Matches'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Issue Breakdown Modal ───────────────────────────────────────────────

function BreakdownModal({
  visible,
  match,
  onClose,
}: {
  visible: boolean;
  match: MatchResult | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!match) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: BORDER_RADIUS.lg,
          borderTopRightRadius: BORDER_RADIUS.lg,
          padding: SPACING.xl, paddingBottom: SPACING.xxxl,
          maxHeight: '80%',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg }}>
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
              Show Your Working
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginBottom: SPACING.sm }}>
            {match.first_name} {match.last_name} — {match.match_score}% match
          </Text>
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginBottom: SPACING.lg }}>
            Based on {match.issues_matched} policy issues from parliamentary voting records
          </Text>

          <ScrollView>
            {match.issue_breakdown.map(issue => (
              <IssueRow key={issue.issue_slug} issue={issue} colors={colors} />
            ))}
          </ScrollView>

          <Text style={{
            fontSize: FONT_SIZE.caption, color: colors.textMuted,
            marginTop: SPACING.lg, fontStyle: 'italic', lineHeight: 16,
          }}>
            Match scores are computed from parliamentary division votes tagged to policy issues.
            Source: TheyVoteForYou API + Verity division tagging.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function IssueRow({ issue, colors }: { issue: IssueMatch; colors: any }) {
  const alignColor = issue.aligned ? '#10B981' : '#DC3545';
  const userLabel = issue.user_stance > 0 ? 'Support' : issue.user_stance < 0 ? 'Oppose' : 'Neutral';
  const mpLabel = issue.mp_lean > 0.2 ? 'Leans aye' : issue.mp_lean < -0.2 ? 'Leans no' : 'Mixed';

  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: SPACING.md, borderBottomWidth: 0.5, borderBottomColor: colors.border,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.medium, color: colors.text }}>
          {issue.issue_name}
        </Text>
        <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2 }}>
          You: {userLabel} · MP: {mpLabel}
        </Text>
      </View>
      <View style={{
        paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm, backgroundColor: alignColor + '15',
      }}>
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: alignColor }}>
          {issue.aligned ? 'Aligned' : 'Differs'}
        </Text>
      </View>
    </View>
  );
}

// ── Match Card ──────────────────────────────────────────────────────────

function MatchCard({
  match,
  rank,
  onPress,
  onShowWorking,
  colors,
}: {
  match: MatchResult;
  rank: number;
  onPress: () => void;
  onShowWorking: () => void;
  colors: any;
}) {
  const scoreColor = match.match_score >= 70 ? '#10B981'
    : match.match_score >= 40 ? '#F59E0B'
    : '#DC3545';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${match.first_name} ${match.last_name}, ${match.match_score}% match`}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginHorizontal: 20,
        marginBottom: SPACING.md,
        opacity: pressed ? 0.92 : 1,
        ...SHADOWS.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
        {/* Rank */}
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: rank <= 3 ? '#00843D' : colors.surface,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{
            fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
            color: rank <= 3 ? '#fff' : colors.textMuted,
          }}>
            {rank}
          </Text>
        </View>

        {/* Photo */}
        {match.photo_url ? (
          <Image
            source={{ uri: match.photo_url }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
            contentFit="cover"
          />
        ) : (
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
          }}>
            <Ionicons name="person" size={20} color={colors.textMuted} />
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
            {match.first_name} {match.last_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 }}>
            {match.party_colour && (
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: match.party_colour,
              }} />
            )}
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
              {match.party_name} · {match.electorate_name}
            </Text>
          </View>
        </View>

        {/* Score */}
        {match.insufficient_data ? (
          <View style={{
            paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
            borderRadius: BORDER_RADIUS.sm, backgroundColor: colors.surface,
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              Not enough data
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onShowWorking(); }}
            hitSlop={8}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: scoreColor,
              }}>
                {match.match_score}%
              </Text>
              <Text style={{
                fontSize: 9, color: colors.textMuted, textDecorationLine: 'underline',
              }}>
                how?
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────

export function MatchScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { hasCompleted } = useIssueStances();
  const [showQuiz, setShowQuiz] = useState(!hasCompleted);
  const { matches, loading, error, refresh } = useVerityMatch();
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);

  // If user hasn't completed the quiz, show it first
  if (showQuiz && !hasCompleted) {
    return <StanceQuiz onComplete={() => { setShowQuiz(false); refresh(); }} navigation={navigation} />;
  }

  const renderMatch = useCallback(({ item, index }: { item: MatchResult; index: number }) => (
    <MatchCard
      match={item}
      rank={index + 1}
      onPress={() => navigation.navigate('MemberProfile', { memberId: item.member_id })}
      onShowWorking={() => setSelectedMatch(item)}
      colors={colors}
    />
  ), [colors, navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={['#00843D', '#006B31']}
        style={{ paddingHorizontal: 20, paddingTop: SPACING.lg, paddingBottom: SPACING.xl }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
              Verity Match
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, color: 'rgba(255,255,255,0.8)' }}>
              MPs ranked by alignment with your positions
            </Text>
          </View>
          <Pressable onPress={() => setShowQuiz(true)} hitSlop={12}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </Pressable>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ padding: 20, gap: 12 }}>
          {[1,2,3,4,5,6,7,8].map(i => <SkeletonLoader key={i} width="100%" height={20} />)}
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Match Unavailable"
          subtitle={error}
          actionLabel="Take the Quiz"
          onAction={() => setShowQuiz(true)}
        />
      ) : (
        <FlashList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={item => item.member_id}
          contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: SPACING.xxxl }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor="#00843D" />}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 20, marginBottom: SPACING.md }}>
              <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                {matches.filter(m => !m.insufficient_data).length} MPs scored · Tap any score to see the working
              </Text>
            </View>
          }
        />
      )}

      <BreakdownModal
        visible={!!selectedMatch}
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
      />
    </SafeAreaView>
  );
}
