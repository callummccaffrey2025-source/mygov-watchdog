import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
  Keyboard,
  Platform,
  InputAccessoryView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { Skeleton } from '../components/ui/Skeleton';
import { useVotes } from '../hooks/useVotes';
import { timeAgo } from '../lib/timeAgo';
import { spacing, radius, elevation, colors as tokenColors } from '../theme/tokens';
import { PressableScale, AppText, Card } from '../components/ui';
import { hapticLight } from '../lib/haptics';
import { HomeScreenSkeleton } from '../components/HomeScreenSkeleton';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { useSittingCalendar } from '../hooks/useSittingCalendar';
import { useBillSwipe } from '../hooks/useBillSwipe';
import { useDailyBrief } from '../hooks/useDailyBrief';
import * as Haptics from 'expo-haptics';
import { track } from '../lib/analytics';
import { useLearnModules } from '../hooks/useLearnModules';

// ── Helpers ─────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function cleanDivisionName(raw: string): string {
  return raw
    .replace(/^[A-Za-z\s]+\s*[—–]\s*/i, '')
    .replace(/\s*[-;]\s*(first|second|third|fourth|consideration|agree|pass|against|final|bill as passed).*$/i, '')
    .trim();
}

function formatParliamentDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' });
}

function smartTruncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '\u2026';
}

function formatHeaderDate(date: Date): string {
  const dayName = date.toLocaleDateString('en-AU', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('en-AU', { month: 'long' });
  return `${dayName}, ${day} ${month}`;
}

// ── Section Header ──────────────────────────────────────────────────────

function SectionHeader({
  label,
  rightLabel,
  onRightPress,
}: {
  color?: string;
  label: string;
  rightLabel?: string;
  onRightPress?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.sm }}>
      <AppText variant="label" color="textMuted" style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</AppText>
      {rightLabel && onRightPress && (
        <PressableScale onPress={onRightPress} accessibilityRole="button" accessibilityLabel={rightLabel}>
          <AppText variant="label" color="accent">{rightLabel}</AppText>
        </PressableScale>
      )}
    </View>
  );
}

// ── Section Divider ─────────────────────────────────────────────────────

function SectionDivider() {
  return (
    <View style={{ height: 1, backgroundColor: tokenColors.border, marginHorizontal: spacing.lg, marginTop: spacing.xxl, opacity: 0.5 }} />
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: any) {
  const { postcode, setPostcode, user } = useUser();
  const [postcodeInput, setPostcodeInput] = useState(postcode || '');
  const [refreshing, setRefreshing] = useState(false);

  // Sync postcodeInput when postcode loads from AsyncStorage after mount
  useEffect(() => {
    if (postcode && !postcodeInput) setPostcodeInput(postcode);
  }, [postcode]);
  const { requireAuth, authSheetProps } = useAuthGate();

  // ── Data hooks ──
  const electorateResult = useElectorateByPostcode(postcode);
  const { member: myMP, loading: mpLoading } = electorateResult;
  const electorateName = electorateResult.electorate?.name ?? null;

  const { votes: mpVotes } = useVotes(myMP?.id ?? null);
  const { isSittingToday, nextSitting } = useSittingCalendar();
  const { currentBill, remaining: billsRemaining, submitOpinion } = useBillSwipe();
  const { brief: dailyBrief } = useDailyBrief();

  // ── MP recent substantive votes ──
  const mpRecentVotes = useMemo(() => {
    return mpVotes
      .filter(v => v.vote_cast === 'aye' || v.vote_cast === 'no')
      .slice(0, 3);
  }, [mpVotes]);

  // ── Refresh ──
  const [refreshKey, setRefreshKey] = useState(0);
  const onRefresh = useCallback(async () => {
    hapticLight();
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  // ── Postcode actions ──
  const handleSetPostcode = () => {
    Keyboard.dismiss();
    const trimmed = postcodeInput.trim();
    if (trimmed.length === 4 && /^\d{4}$/.test(trimmed)) {
      setPostcode(trimmed);
    } else {
      Alert.alert('Invalid postcode', 'Please enter a valid 4-digit Australian postcode.');
    }
  };

  const clearPostcode = () => {
    setPostcode(null);
    setPostcodeInput('');
  };

  // ── Derived values ──
  const greeting = getGreeting();
  const now = new Date();
  const dateStr = formatHeaderDate(now);

  // Last vote for MP
  const lastVote = mpVotes.length > 0 && mpVotes[0].division?.name
    ? {
        name: cleanDivisionName(mpVotes[0].division.name),
        cast: mpVotes[0].vote_cast,
        date: mpVotes[0].division?.date ?? mpVotes[0].created_at,
      }
    : null;

  // ── Loading state ──
  const initialLoading = mpLoading && !!postcode;
  if (initialLoading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['bottom']}>
        <HomeScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokenColors.accent} colors={[tokenColors.accent]} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ═══ 1. HERO ═══ */}
        <View style={{ backgroundColor: tokenColors.background, paddingTop: spacing.xxxl, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
          {/* Top bar: Verity wordmark + icons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
            <AppText variant="heading" style={{ letterSpacing: 2, color: tokenColors.accent }}>
              VERITY
            </AppText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <PressableScale onPress={() => navigation.navigate('Watchlist')} accessibilityRole="button" accessibilityLabel="View watchlist">
                <Ionicons name="eye-outline" size={22} color={tokenColors.textPrimary} />
              </PressableScale>
              <PressableScale onPress={() => navigation.navigate('Activity')} accessibilityRole="button" accessibilityLabel="View activity notifications">
                <Ionicons name="notifications-outline" size={22} color={tokenColors.textPrimary} />
              </PressableScale>
            </View>
          </View>

          {/* Greeting */}
          <AppText variant="display" style={{ fontSize: 32 }}>{greeting}</AppText>
          <AppText variant="body" color="textMuted" style={{ marginTop: spacing.xs }}>
            {myMP
              ? `${dateStr} · ${electorateName ?? ''}`
              : dateStr}
          </AppText>

          {/* Parliament status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ width: spacing.sm, height: spacing.sm, borderRadius: spacing.xs, backgroundColor: isSittingToday ? tokenColors.success : tokenColors.warning }} />
            <AppText variant="caption" color="textSecondary">
              {isSittingToday ? 'Parliament is sitting' : `In recess${nextSitting ? ` · resumes ${formatParliamentDate(nextSitting)}` : ''}`}
            </AppText>
          </View>

          {/* Daily Brief hero card */}
          <PressableScale
            onPress={() => navigation.navigate('DailyBrief')}
            accessibilityRole="button"
            accessibilityLabel="Read today's daily brief"
            style={{ marginTop: spacing.xl }}
          >
            <LinearGradient
              colors={['#00843D', '#006B31']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: radius.md,
                padding: 20,
                ...elevation.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <Ionicons name="newspaper-outline" size={16} color="rgba(255,255,255,0.7)" />
                <AppText variant="label" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Daily Brief
                </AppText>
              </View>
              <AppText variant="heading" style={{ color: '#FFFFFF', marginBottom: spacing.sm }}>
                {dailyBrief?.ai_text?.what_happened?.[0]?.headline
                  ?? 'Your morning briefing is ready'}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {dailyBrief?.date ?? dateStr}
                </AppText>
                <AppText variant="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  Read today's brief {'\u2192'}
                </AppText>
              </View>
            </LinearGradient>
          </PressableScale>
        </View>

        {/* ═══ 2. YOUR REPRESENTATIVE ═══ */}
        <View style={{ paddingHorizontal: spacing.xl }}>
          <SectionHeader
            label="YOUR REPRESENTATIVE"
            rightLabel={postcode ? 'Change' : undefined}
            onRightPress={postcode ? clearPostcode : undefined}
          />

          {!postcode ? (
            /* Empty state: set electorate */
            <Card elevated>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                <View style={{
                  width: 44, height: 44, borderRadius: radius.lg,
                  backgroundColor: tokenColors.accentMuted,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name="location-outline" size={22} color={tokenColors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="heading" style={{ fontSize: 15 }}>Set your electorate</AppText>
                  <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                    Enter your postcode to find your MP
                  </AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TextInput
                  style={{
                    flex: 1, height: 44, borderRadius: radius.sm,
                    backgroundColor: tokenColors.surfaceMuted,
                    paddingHorizontal: spacing.md,
                    fontSize: 15, color: tokenColors.textPrimary,
                  }}
                  value={postcodeInput}
                  onChangeText={setPostcodeInput}
                  placeholder="Enter postcode"
                  placeholderTextColor={tokenColors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  returnKeyType="done"
                  onSubmitEditing={handleSetPostcode}
                  inputAccessoryViewID="home-postcode-done"
                  accessibilityLabel="Enter your postcode"
                />
                {Platform.OS === 'ios' && (
                  <InputAccessoryView nativeID="home-postcode-done">
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: tokenColors.surfaceMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: tokenColors.border }}>
                      <PressableScale onPress={() => { Keyboard.dismiss(); handleSetPostcode(); }} accessibilityRole="button" accessibilityLabel="Done entering postcode">
                        <AppText variant="callout" color="accent">Done</AppText>
                      </PressableScale>
                    </View>
                  </InputAccessoryView>
                )}
                <PressableScale
                  style={{
                    height: 44, paddingHorizontal: spacing.lg,
                    backgroundColor: tokenColors.accent,
                    borderRadius: radius.sm,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                  onPress={handleSetPostcode}
                  accessibilityRole="button"
                  accessibilityLabel="Find MP"
                >
                  <AppText variant="label" style={{ color: tokenColors.onAccent }}>Find MP</AppText>
                </PressableScale>
              </View>
            </Card>
          ) : mpLoading ? (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Skeleton width={54} height={54} borderRadius={radius.lg} />
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Skeleton width="65%" height={16} />
                  <Skeleton width="45%" height={12} />
                </View>
              </View>
              <Skeleton width="100%" height={36} borderRadius={radius.sm} style={{ marginTop: spacing.md }} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Skeleton width="48%" height={40} borderRadius={radius.pill} />
                <Skeleton width="48%" height={40} borderRadius={radius.pill} />
              </View>
            </Card>
          ) : myMP ? (
            /* MP card */
            <Card elevated>
              {/* Avatar + info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {/* MP photo or initials fallback */}
                {myMP.photo_url ? (
                  <Image
                    source={{ uri: myMP.photo_url }}
                    style={{
                      width: 54, height: 54, borderRadius: radius.lg,
                      borderWidth: 2, borderColor: myMP.party?.colour || tokenColors.accent,
                    }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{
                    width: 54, height: 54, borderRadius: radius.lg,
                    backgroundColor: (myMP.party?.colour || tokenColors.accent) + '20',
                    justifyContent: 'center', alignItems: 'center',
                    borderWidth: 2, borderColor: myMP.party?.colour || tokenColors.accent,
                  }}>
                    <AppText variant="heading" style={{ color: myMP.party?.colour || tokenColors.accent }}>
                      {myMP.first_name[0]}{myMP.last_name[0]}
                    </AppText>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <AppText variant="callout" style={{ fontWeight: '600' }}>
                      {myMP.first_name} {myMP.last_name}
                    </AppText>
                    <Ionicons name="checkmark-circle" size={14} color={tokenColors.success} />
                  </View>
                  <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                    {myMP.party?.short_name || myMP.party?.abbreviation || myMP.party?.name || ''}
                    {' \u00B7 MP for '}
                    {myMP.electorate?.name ?? ''}
                  </AppText>
                  {myMP.ministerial_role && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                      <View style={{ backgroundColor: tokenColors.accentMuted, borderRadius: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                        <AppText variant="caption" style={{ color: tokenColors.success }}>{myMP.ministerial_role}</AppText>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Last vote pill */}
              {lastVote && (
                <PressableScale
                  onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${myMP.first_name} ${myMP.last_name}'s profile`}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    marginTop: spacing.md,
                    backgroundColor: lastVote.cast === 'aye' ? tokenColors.success + '14' : tokenColors.danger + '14',
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                  }}
                >
                  <View style={{
                    width: spacing.sm, height: spacing.sm, borderRadius: spacing.xs,
                    backgroundColor: lastVote.cast === 'aye' ? tokenColors.success : tokenColors.danger,
                    marginRight: spacing.sm,
                  }} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="caption" style={{
                      fontWeight: '600',
                      color: lastVote.cast === 'aye' ? tokenColors.success : tokenColors.danger,
                    }} numberOfLines={1}>
                      Voted {lastVote.cast === 'aye' ? 'Aye' : 'No'} · {smartTruncate(lastVote.name, 30)}
                    </AppText>
                    <AppText variant="caption" style={{
                      marginTop: spacing.xs,
                      color: lastVote.cast === 'aye' ? tokenColors.success + 'A6' : tokenColors.danger + 'A6',
                    }}>
                      Last session · {timeAgo(lastVote.date)}
                    </AppText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={lastVote.cast === 'aye' ? tokenColors.success : tokenColors.danger}
                    style={{ marginLeft: spacing.sm }}
                  />
                </PressableScale>
              )}

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                {/* Write to MP — accent filled */}
                <PressableScale
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: spacing.sm, height: 40, borderRadius: radius.pill,
                    backgroundColor: tokenColors.accent,
                  }}
                  onPress={() => requireAuth('write to your MP', () => navigation.navigate('WriteToMP', { member: myMP }))}
                  accessibilityRole="button"
                  accessibilityLabel="Write to MP"
                >
                  <Ionicons name="mail-outline" size={14} color={tokenColors.onAccent} />
                  <AppText variant="label" style={{ color: tokenColors.onAccent }}>Write to MP</AppText>
                </PressableScale>
                {/* View profile — outlined */}
                <PressableScale
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    height: 40, borderRadius: radius.pill,
                    backgroundColor: tokenColors.surface,
                    borderWidth: 1, borderColor: tokenColors.border,
                  }}
                  onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                  accessibilityRole="button"
                  accessibilityLabel="View profile"
                >
                  <AppText variant="label">
                    View profile {'\u2192'}
                  </AppText>
                </PressableScale>
              </View>
            </Card>
          ) : (
            /* Fallback: electorate found but no MP */
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="information-circle-outline" size={18} color={tokenColors.textMuted} />
                <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {electorateResult.electorate
                    ? `${electorateResult.electorate.name} (${electorateResult.electorate.state}) \u2014 MP data loading soon.`
                    : `No electorate found for ${postcode}.`}
                </AppText>
              </View>
            </Card>
          )}
        </View>

        <SectionDivider />

        {/* ═══ 3. HAVE YOUR SAY — Bill Swipe ═══ */}
        {currentBill && (
          <>
            <View style={{ paddingHorizontal: spacing.xl }}>
              <SectionHeader label="HAVE YOUR SAY" rightLabel={`${billsRemaining} bills`} />
              <AppText variant="caption" color="textMuted" style={{ marginBottom: spacing.md }}>
                Swipe on bills currently before parliament
              </AppText>

              {/* Bill card — tappable to open detail */}
              <Card elevated onPress={() => navigation.navigate('BillDetail', { billId: currentBill.id })}>
                {/* Status + chamber */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <View style={{ backgroundColor: tokenColors.accentMuted, borderRadius: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
                    <AppText variant="caption" style={{ color: tokenColors.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {currentBill.current_status ?? 'Before Parliament'}
                    </AppText>
                  </View>
                  {currentBill.origin_chamber && (
                    <AppText variant="caption" color="textMuted">
                      {currentBill.origin_chamber === 'house' ? 'House' : 'Senate'}
                    </AppText>
                  )}
                </View>

                {/* Title */}
                <AppText variant="heading" style={{ marginBottom: spacing.sm }}>
                  {currentBill.short_title ?? currentBill.title}
                </AppText>

                {/* TLDR explainer */}
                {currentBill.tldr && (
                  <AppText variant="callout" color="textSecondary" style={{ marginBottom: spacing.lg }}>
                    {currentBill.tldr}
                  </AppText>
                )}

                {/* For / Against arguments */}
                {(currentBill.supporters_argument || currentBill.critics_argument) && (
                  <View style={{ marginBottom: spacing.lg }}>
                    {currentBill.supporters_argument && (
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: tokenColors.success + '1A', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="checkmark" size={12} color={tokenColors.success} />
                        </View>
                        <AppText variant="caption" color="textSecondary" style={{ flex: 1, lineHeight: 17 }}>
                          <AppText variant="caption" style={{ fontWeight: '600', color: tokenColors.success }}>For: </AppText>
                          {currentBill.supporters_argument}
                        </AppText>
                      </View>
                    )}
                    {currentBill.critics_argument && (
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: tokenColors.danger + '1A', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="close" size={12} color={tokenColors.danger} />
                        </View>
                        <AppText variant="caption" color="textSecondary" style={{ flex: 1, lineHeight: 17 }}>
                          <AppText variant="caption" style={{ fontWeight: '600', color: tokenColors.danger }}>Against: </AppText>
                          {currentBill.critics_argument}
                        </AppText>
                      </View>
                    )}
                  </View>
                )}

                {/* Vote counts */}
                {(currentBill.agree_count + currentBill.disagree_count) > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
                    <AppText variant="caption" color="textMuted" tabular>
                      {currentBill.agree_count + currentBill.disagree_count} opinions
                    </AppText>
                    <View style={{ flex: 1, height: spacing.xs, borderRadius: 2, backgroundColor: tokenColors.border, overflow: 'hidden', flexDirection: 'row' }}>
                      <View style={{ flex: currentBill.agree_count || 0.01, backgroundColor: tokenColors.success, borderRadius: 2 }} />
                      <View style={{ flex: currentBill.disagree_count || 0.01, backgroundColor: tokenColors.danger, borderRadius: 2 }} />
                    </View>
                  </View>
                )}

                {/* Agree / Disagree / Skip buttons */}
                <View style={{ flexDirection: 'row', gap: spacing.sm }} onStartShouldSetResponder={() => true}>
                  <PressableScale
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      submitOpinion('disagree');
                      track('bill_opinion', { bill_id: currentBill.id, opinion: 'disagree' }, 'Home');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Disagree with this bill"
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                      backgroundColor: tokenColors.danger + '14', borderRadius: radius.pill,
                      paddingVertical: spacing.md,
                    }}
                  >
                    <Ionicons name="thumbs-down-outline" size={16} color={tokenColors.danger} />
                    <AppText variant="label" style={{ color: tokenColors.danger }}>Disagree</AppText>
                  </PressableScale>

                  <PressableScale
                    onPress={() => { submitOpinion('skip'); }}
                    accessibilityRole="button"
                    accessibilityLabel="Skip this bill"
                    style={{
                      paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <AppText variant="caption" color="textMuted">Skip</AppText>
                  </PressableScale>

                  <PressableScale
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      submitOpinion('agree');
                      track('bill_opinion', { bill_id: currentBill.id, opinion: 'agree' }, 'Home');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Agree with this bill"
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                      backgroundColor: tokenColors.success + '14', borderRadius: radius.pill,
                      paddingVertical: spacing.md,
                    }}
                  >
                    <Ionicons name="thumbs-up-outline" size={16} color={tokenColors.success} />
                    <AppText variant="label" style={{ color: tokenColors.success }}>Agree</AppText>
                  </PressableScale>
                </View>

                {/* Read more affordance */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, gap: spacing.xs }}>
                  <AppText variant="caption" color="textMuted" style={{ fontWeight: '500' }}>Read more about this bill</AppText>
                  <Ionicons name="chevron-forward" size={14} color={tokenColors.textMuted} />
                </View>
              </Card>
            </View>
            <SectionDivider />
          </>
        )}

        {/* ═══ 4. CONTINUE LEARNING ═══ */}
        <ContinueLearningCard navigation={navigation} />

        <SectionDivider />

        {/* ═══ 5. MP RECENT VOTES ═══ */}
        {myMP && mpRecentVotes.length > 0 && (
          <View style={{ paddingHorizontal: spacing.xl }}>
            <SectionHeader
              label={`HOW ${myMP.first_name.toUpperCase()} VOTED`}
              rightLabel="All votes"
              onRightPress={() => navigation.navigate('MemberProfile', { member: myMP })}
            />

            <Card elevated>
              {mpRecentVotes.map((vote, i) => {
                const divName = vote.division ? cleanDivisionName(vote.division.name) : 'Unknown';
                const isAye = vote.vote_cast === 'aye';
                const ayeCount = vote.division?.aye_votes ?? 0;
                const noCount = vote.division?.no_votes ?? 0;
                const totalVotes = ayeCount + noCount;
                return (
                  <PressableScale
                    key={vote.id}
                    onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                    accessibilityRole="button"
                    accessibilityLabel={`${myMP.first_name} voted ${isAye ? 'aye' : 'no'} on ${divName}`}
                    style={{
                      paddingVertical: spacing.md,
                      borderBottomWidth: i < mpRecentVotes.length - 1 ? 0.5 : 0,
                      borderBottomColor: tokenColors.border,
                      marginLeft: spacing.lg,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, marginRight: spacing.sm }}>
                        <AppText variant="body" style={{ fontWeight: '600' }} numberOfLines={2}>
                          {divName}
                        </AppText>
                        <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                          {vote.division?.date ? timeAgo(vote.division.date) : ''}
                        </AppText>
                        {/* Aye/No mini bar */}
                        {totalVotes > 0 && (
                          <View style={{ flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: spacing.sm }}>
                            <View style={{ flex: ayeCount || 0.01, backgroundColor: tokenColors.success, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }} />
                            <View style={{ flex: noCount || 0.01, backgroundColor: tokenColors.danger, borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />
                          </View>
                        )}
                      </View>
                      {/* Aye/No badge */}
                      <View style={{
                        backgroundColor: isAye ? tokenColors.success + '1A' : tokenColors.danger + '1A',
                        borderRadius: 6,
                        paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                      }}>
                        <AppText variant="caption" tabular style={{
                          fontWeight: '700', letterSpacing: 0.5,
                          color: isAye ? tokenColors.success : tokenColors.danger,
                        }}>
                          {isAye ? 'AYE' : 'NO'}
                        </AppText>
                      </View>
                    </View>
                  </PressableScale>
                );
              })}
            </Card>
          </View>
        )}


        {/* Bottom spacing */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}

function ContinueLearningCard({ navigation }: { navigation: any }) {
  const { modules, loading } = useLearnModules();

  if (loading) return null;

  const totalLessons = modules.reduce((sum, m) => sum + m.lesson_count, 0);
  const completedLessons = modules.reduce((sum, m) => sum + m.completed_count, 0);

  // Find next incomplete module
  const nextModule = modules.find(m => m.completed_count < m.lesson_count && !m.is_current_events);
  if (!nextModule) return null;

  const progress = totalLessons > 0 ? completedLessons / totalLessons : 0;

  return (
    <View style={{ paddingHorizontal: spacing.xl }}>
      <SectionHeader label="CONTINUE LEARNING" />
      <Card onPress={() => navigation.navigate('Learn')} elevated>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <View style={{
            width: 40, height: 40, borderRadius: radius.sm,
            backgroundColor: tokenColors.accentMuted, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="school" size={20} color={tokenColors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              {nextModule.title}
            </AppText>
            <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
              {nextModule.lesson_count} lessons
            </AppText>
          </View>
          <Ionicons name="arrow-forward" size={16} color={tokenColors.textMuted} />
        </View>

        {/* Progress bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, height: spacing.xs, borderRadius: 2, backgroundColor: tokenColors.border, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: tokenColors.accent, borderRadius: 2 }} />
          </View>
          <AppText variant="caption" color="textMuted" tabular>
            {completedLessons}/{totalLessons}
          </AppText>
        </View>
      </Card>
    </View>
  );
}
