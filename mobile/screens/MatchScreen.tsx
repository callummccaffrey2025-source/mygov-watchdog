import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, RefreshControl, Modal, ScrollView, TextInput, ActivityIndicator,
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
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import postcodeMap from '../assets/postcode_to_electorate.json';

// ── Stance Quiz ────────────────────────────────────────────────────────

const IMPORTANCE_LABELS = ['Low', 'Med', 'High'];
const IMPORTANCE_VALUES = [1, 2, 3] as const;

function StanceQuiz({
  onComplete,
  navigation,
}: {
  onComplete: (memberId: string | null) => void;
  navigation: any;
}) {
  const { colors } = useTheme();
  const { postcode, setPostcode } = useUser();
  const { issues, stances, loading, setStance } = useIssueStances();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedStance, setSelectedStance] = useState<number | null>(null);
  const [selectedImportance, setSelectedImportance] = useState<1 | 2 | 3>(2);
  const [phase, setPhase] = useState<'quiz' | 'postcode'>('quiz');
  const [postcodeInput, setPostcodeInput] = useState(postcode ?? '');
  const [resolving, setResolving] = useState(false);
  const [electorateOptions, setElectorateOptions] = useState<string[]>([]);

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#00843D" />
    </SafeAreaView>
  );

  // ── Postcode phase ──────────────────────────────────────────────────
  if (phase === 'postcode') {
    const resolvePostcode = async () => {
      const pc = postcodeInput.trim();
      if (pc.length !== 4) return;

      setResolving(true);
      setPostcode(pc);

      const electorates = (postcodeMap as Record<string, string[]>)[pc];
      if (!electorates || electorates.length === 0) {
        // Unknown postcode — still complete, just no MP resolution
        onComplete(null);
        return;
      }

      if (electorates.length === 1) {
        // Single electorate — resolve MP directly
        const { data: member } = await supabase
          .from('members')
          .select('id, electorate:electorates!inner(name)')
          .eq('is_active', true)
          .eq('chamber', 'representatives')
          .eq('electorate.name', electorates[0])
          .limit(1)
          .single();
        onComplete(member?.id ?? null);
      } else {
        setElectorateOptions(electorates);
        setResolving(false);
      }
    };

    const selectElectorate = async (name: string) => {
      setResolving(true);
      const { data: member } = await supabase
        .from('members')
        .select('id, electorate:electorates!inner(name)')
        .eq('is_active', true)
        .eq('chamber', 'representatives')
        .eq('electorate.name', name)
        .limit(1)
        .single();
      onComplete(member?.id ?? null);
    };

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient
          colors={['#00843D', '#006B31']}
          style={{ paddingHorizontal: 20, paddingTop: SPACING.lg, paddingBottom: SPACING.xl }}
        >
          <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
            Find your MP
          </Text>
          <Text style={{ fontSize: FONT_SIZE.body, color: 'rgba(255,255,255,0.8)', marginTop: SPACING.xs }}>
            Enter your postcode to see your personal match
          </Text>
        </LinearGradient>

        <View style={{ padding: 20, gap: SPACING.lg }}>
          <TextInput
            value={postcodeInput}
            onChangeText={setPostcodeInput}
            placeholder="e.g. 2113"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            style={{
              fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.bold,
              color: colors.text, textAlign: 'center',
              paddingVertical: SPACING.xl,
              backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
              ...SHADOWS.sm,
            }}
          />

          {electorateOptions.length > 0 && (
            <View style={{ gap: SPACING.sm }}>
              <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, textAlign: 'center' }}>
                Your postcode covers multiple electorates
              </Text>
              {electorateOptions.map(name => (
                <Pressable
                  key={name}
                  onPress={() => selectElectorate(name)}
                  style={{
                    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl,
                    backgroundColor: colors.card, borderRadius: BORDER_RADIUS.md,
                    ...SHADOWS.sm,
                  }}
                >
                  <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {electorateOptions.length === 0 && (
            <Pressable
              onPress={resolvePostcode}
              disabled={postcodeInput.trim().length !== 4 || resolving}
              style={{
                paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md,
                backgroundColor: postcodeInput.trim().length === 4 ? '#00843D' : colors.surface,
                alignItems: 'center',
              }}
            >
              {resolving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{
                  fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold,
                  color: postcodeInput.trim().length === 4 ? '#fff' : colors.textMuted,
                }}>
                  See My Match
                </Text>
              )}
            </Pressable>
          )}

          <Pressable onPress={() => onComplete(null)}>
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm }}>
              Skip — show all MPs
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Quiz phase ──────────────────────────────────────────────────────
  const issue = issues[currentIndex];
  if (!issue) return null;

  const progress = (currentIndex + 1) / issues.length;
  const existing = stances.find(s => s.issue_id === issue.id);

  const handleChoice = async (stance: -1 | 0 | 1) => {
    hapticLight();
    setSelectedStance(stance);
  };

  const handleNext = async () => {
    if (selectedStance !== null && selectedStance !== 0) {
      await setStance(issue.id, issue.slug, selectedStance, selectedImportance);
    }
    if (currentIndex < issues.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedStance(null);
      setSelectedImportance(2);
    } else {
      // Quiz complete — move to postcode if we don't have one
      if (!postcode) {
        setPhase('postcode');
      } else {
        // Already have postcode — resolve MP
        const pc = postcode.trim();
        const electorates = (postcodeMap as Record<string, string[]>)[pc];
        if (electorates?.length === 1) {
          const { data: member } = await supabase
            .from('members')
            .select('id, electorate:electorates!inner(name)')
            .eq('is_active', true)
            .eq('chamber', 'representatives')
            .eq('electorate.name', electorates[0])
            .limit(1)
            .single();
          onComplete(member?.id ?? null);
        } else {
          setPhase('postcode');
        }
      }
    }
  };

  const handleSkip = () => {
    if (currentIndex < issues.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedStance(null);
      setSelectedImportance(2);
    } else {
      if (!postcode) setPhase('postcode');
      else onComplete(null);
    }
  };

  const activeStance = selectedStance ?? existing?.stance ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient
        colors={['#00843D', '#006B31']}
        style={{ paddingHorizontal: 20, paddingTop: SPACING.lg, paddingBottom: SPACING.xl }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
          {currentIndex > 0 ? (
            <Pressable onPress={() => { setCurrentIndex(currentIndex - 1); setSelectedStance(null); }} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
          ) : (
            <Pressable onPress={() => navigation?.goBack?.()} hitSlop={12}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          )}
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={{ fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold, color: '#fff' }}>
              Verity Match
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{
          height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: 2, overflow: 'hidden',
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

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Issue icon + name */}
        <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: SPACING.sm }}>
          {issue.icon ?? '📋'}
        </Text>
        <Text style={{
          fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold,
          color: colors.text, textAlign: 'center', marginBottom: SPACING.lg,
        }}>
          {issue.stance_question}
        </Text>

        {/* Support / Oppose buttons */}
        <View style={{ gap: SPACING.md }}>
          <Pressable
            onPress={() => handleChoice(1)}
            style={{
              paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl,
              borderRadius: BORDER_RADIUS.md,
              backgroundColor: activeStance === 1 ? '#10B981' : colors.card,
              borderWidth: activeStance === 1 ? 0 : 1,
              borderColor: colors.border,
              ...SHADOWS.sm,
            }}
          >
            <Text style={{
              fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold,
              color: activeStance === 1 ? '#fff' : colors.text, textAlign: 'center',
            }}>
              {issue.support_label}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleChoice(-1)}
            style={{
              paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl,
              borderRadius: BORDER_RADIUS.md,
              backgroundColor: activeStance === -1 ? '#DC3545' : colors.card,
              borderWidth: activeStance === -1 ? 0 : 1,
              borderColor: colors.border,
              ...SHADOWS.sm,
            }}
          >
            <Text style={{
              fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold,
              color: activeStance === -1 ? '#fff' : colors.text, textAlign: 'center',
            }}>
              {issue.oppose_label}
            </Text>
          </Pressable>
        </View>

        {/* Importance picker (only visible after choosing a stance) */}
        {activeStance !== null && activeStance !== 0 && (
          <View style={{ marginTop: SPACING.xl }}>
            <Text style={{
              fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium,
              color: colors.textMuted, textAlign: 'center', marginBottom: SPACING.md,
            }}>
              How important is this to you?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: SPACING.md }}>
              {IMPORTANCE_VALUES.map((val, i) => {
                const isActive = selectedImportance === val;
                return (
                  <Pressable
                    key={val}
                    onPress={() => { hapticLight(); setSelectedImportance(val); }}
                    style={{
                      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl,
                      borderRadius: BORDER_RADIUS.full,
                      backgroundColor: isActive ? '#00843D' : colors.surface,
                      borderWidth: isActive ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{
                      fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold,
                      color: isActive ? '#fff' : colors.textMuted,
                    }}>
                      {IMPORTANCE_LABELS[i]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Next / Skip */}
        <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xxl }}>
          <Pressable
            onPress={handleSkip}
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
              backgroundColor: activeStance !== null && activeStance !== 0 ? '#00843D' : colors.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold,
              color: activeStance !== null && activeStance !== 0 ? '#fff' : colors.textMuted,
            }}>
              {currentIndex < issues.length - 1 ? 'Next' : 'See My Match'}
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
  const mpLabel = issue.mp_lean > 0.2 ? 'Leans support' : issue.mp_lean < -0.2 ? 'Leans oppose' : 'Mixed';

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

  const handleQuizComplete = useCallback((memberId: string | null) => {
    setShowQuiz(false);
    refresh();
    if (memberId) {
      navigation.navigate('MatchResult', { memberId });
    }
  }, [refresh, navigation]);

  if (showQuiz && !hasCompleted) {
    return <StanceQuiz onComplete={handleQuizComplete} navigation={navigation} />;
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
