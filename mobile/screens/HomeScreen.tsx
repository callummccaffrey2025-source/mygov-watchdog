import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  Pressable,
  Alert,
  Keyboard,
  Platform,
  InputAccessoryView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useTheme } from '../context/ThemeContext';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { decodeHtml } from '../utils/decodeHtml';
import { useVotes } from '../hooks/useVotes';
import { timeAgo } from '../lib/timeAgo';
import { spacing, typography, radius, elevation, colors as tokenColors, motion } from '../theme/tokens';
import { PressableScale, AppText, Card } from '../components/ui';
import AsyncStorage from '../lib/storage';
import { hapticLight } from '../lib/haptics';
import { HomeScreenSkeleton } from '../components/HomeScreenSkeleton';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { useSittingCalendar } from '../hooks/useSittingCalendar';
import { useBillSwipe } from '../hooks/useBillSwipe';
import * as Haptics from 'expo-haptics';
import { track } from '../lib/analytics';
import { trackEvent } from '../lib/engagementTracker';
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
  color,
  label,
  rightLabel,
  onRightPress,
}: {
  color: string;
  label: string;
  rightLabel?: string;
  onRightPress?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
      <AppText variant="label" color="textMuted">{label}</AppText>
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
    <View style={{ height: 1, backgroundColor: tokenColors.border, marginHorizontal: spacing.lg, marginTop: spacing.xl, opacity: 0.5 }} />
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: any) {
  const { colors } = useTheme();
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
    // Allow hooks to re-fire by updating key, then clear spinner after delay
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
        <HomeScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00843D" colors={['#00843D']} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ═══ 1. GREEN HERO ═══ */}
        <View style={{ backgroundColor: tokenColors.background, paddingTop: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
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

          {/* Greeting — display scale for typographic drama */}
          <AppText variant="display">{greeting}</AppText>
          <AppText variant="body" color="textMuted" style={{ marginTop: spacing.xs }}>
            {myMP
              ? `${dateStr} · ${electorateName ?? ''}`
              : dateStr}
          </AppText>

          {/* Parliament status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isSittingToday ? tokenColors.success : tokenColors.warning }} />
            <AppText variant="caption" color="textSecondary">
              {isSittingToday ? 'Parliament is sitting' : `In recess${nextSitting ? ` · resumes ${formatParliamentDate(nextSitting)}` : ''}`}
            </AppText>
          </View>
        </View>

        {/* ═══ 2. YOUR REPRESENTATIVE ═══ */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <SectionHeader
            color={colors.green}
            label="YOUR REPRESENTATIVE"
            rightLabel={postcode ? 'Change' : undefined}
            onRightPress={postcode ? clearPostcode : undefined}
          />

          {!postcode ? (
            /* Empty state: set electorate */
            <View style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              padding: 18,
              ...elevation.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 14 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: '#E8F5EE',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name="location-outline" size={22} color={colors.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Set your electorate</Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                    Enter your postcode to find your MP
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TextInput
                  style={{
                    flex: 1, height: 44, borderRadius: radius.sm,
                    backgroundColor: colors.surface,
                    paddingHorizontal: 14,
                    fontSize: 15, color: colors.text,
                  }}
                  value={postcodeInput}
                  onChangeText={setPostcodeInput}
                  placeholder="Enter postcode"
                  placeholderTextColor="#9aabb8"
                  keyboardType="number-pad"
                  maxLength={4}
                  returnKeyType="done"
                  onSubmitEditing={handleSetPostcode}
                  inputAccessoryViewID="home-postcode-done"
                  accessibilityLabel="Enter your postcode"
                />
                {Platform.OS === 'ios' && (
                  <InputAccessoryView nativeID="home-postcode-done">
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#F1F1F1', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#C8C8C8' }}>
                      <Pressable onPress={() => { Keyboard.dismiss(); handleSetPostcode(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Done entering postcode">
                        <Text style={{ fontSize: 17, fontWeight: '600', color: '#007AFF' }}>Done</Text>
                      </Pressable>
                    </View>
                  </InputAccessoryView>
                )}
                <Pressable
                  style={{
                    height: 44, paddingHorizontal: spacing.lg,
                    backgroundColor: colors.green,
                    borderRadius: radius.sm,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                  onPress={handleSetPostcode}
                  accessibilityRole="button"
                  accessibilityLabel="Find MP"
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>Find MP</Text>
                </Pressable>
              </View>
            </View>
          ) : mpLoading ? (
            <SkeletonLoader height={130} borderRadius={radius.md} />
          ) : myMP ? (
            /* MP card */
            <View style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              padding: spacing.lg,
              ...elevation.sm,
            }}>
              {/* Avatar + info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {/* MP photo or initials fallback */}
                {myMP.photo_url ? (
                  <Image
                    source={{ uri: myMP.photo_url }}
                    style={{
                      width: 54, height: 54, borderRadius: 27,
                      borderWidth: 2, borderColor: myMP.party?.colour || colors.green,
                    }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{
                    width: 54, height: 54, borderRadius: 27,
                    backgroundColor: (myMP.party?.colour || colors.green) + '20',
                    justifyContent: 'center', alignItems: 'center',
                    borderWidth: 2, borderColor: myMP.party?.colour || colors.green,
                  }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: myMP.party?.colour || colors.green }}>
                      {myMP.first_name[0]}{myMP.last_name[0]}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                      {myMP.first_name} {myMP.last_name}
                    </Text>
                    <Ionicons name="checkmark-circle" size={14} color={colors.green} />
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                    {myMP.party?.short_name || myMP.party?.abbreviation || myMP.party?.name || ''}
                    {' \u00B7 MP for '}
                    {myMP.electorate?.name ?? ''}
                  </Text>
                  {myMP.ministerial_role && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <View style={{ backgroundColor: colors.greenBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: colors.green }}>{myMP.ministerial_role}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Last vote pill */}
              {lastVote && (
                <Pressable
                  onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${myMP.first_name} ${myMP.last_name}'s profile`}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    marginTop: spacing.md,
                    backgroundColor: lastVote.cast === 'aye' ? 'rgba(0,132,61,0.08)' : 'rgba(220,38,38,0.08)',
                    borderRadius: radius.sm,
                    paddingHorizontal: 12, paddingVertical: 10,
                  }}
                >
                  <View style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: lastVote.cast === 'aye' ? '#00843D' : '#DC2626',
                    marginRight: 10,
                  }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 12.5, fontWeight: '600',
                      color: lastVote.cast === 'aye' ? '#166534' : '#991B1B',
                    }} numberOfLines={1}>
                      Voted {lastVote.cast === 'aye' ? 'Aye' : 'No'} · {smartTruncate(lastVote.name, 30)}
                    </Text>
                    <Text style={{
                      fontSize: 11, marginTop: 2,
                      color: lastVote.cast === 'aye' ? 'rgba(22,101,52,0.65)' : 'rgba(153,27,27,0.65)',
                    }}>
                      Last session · {timeAgo(lastVote.date)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={lastVote.cast === 'aye' ? '#166534' : '#991B1B'}
                    style={{ marginLeft: 6 }}
                  />
                </Pressable>
              )}

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                {/* Write to MP — green filled */}
                <Pressable
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, height: 40, borderRadius: radius.pill,
                    backgroundColor: colors.green,
                  }}
                  onPress={() => requireAuth('write to your MP', () => navigation.navigate('WriteToMP', { member: myMP }))}
                  accessibilityRole="button"
                  accessibilityLabel="Write to MP"
                >
                  <Ionicons name="mail-outline" size={14} color="#ffffff" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Write to MP</Text>
                </Pressable>
                {/* View profile — outlined */}
                <Pressable
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    height: 40, borderRadius: radius.pill,
                    backgroundColor: colors.card,
                    borderWidth: 1, borderColor: colors.border,
                  }}
                  onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                  accessibilityRole="button"
                  accessibilityLabel="View profile"
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    View profile {'\u2192'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Fallback: electorate found but no MP */
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={{ flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 }}>
                {electorateResult.electorate
                  ? `${electorateResult.electorate.name} (${electorateResult.electorate.state}) \u2014 MP data loading soon.`
                  : `No electorate found for ${postcode}.`}
              </Text>
            </View>
          )}
        </View>

        <SectionDivider />

        {/* ═══ 3. HAVE YOUR SAY — Bill Swipe ═══ */}
        {currentBill && (
          <>
            <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
              <SectionHeader color="#00843D" label="HAVE YOUR SAY" rightLabel={`${billsRemaining} bills`} />
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 14 }}>
                Swipe on bills currently before parliament
              </Text>

              {/* Bill card — tappable to open detail */}
              <Pressable
                onPress={() => navigation.navigate('BillDetail', { billId: currentBill.id })}
                accessibilityRole="button"
                accessibilityLabel={`View bill: ${currentBill.short_title ?? currentBill.title}`}
                style={({ pressed }) => ({
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  padding: 20,
                  ...elevation.md,
                  opacity: pressed ? 0.95 : 1,
                })}
              >
                {/* Status + chamber */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={{ backgroundColor: '#E8F5EE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#00843D', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {currentBill.current_status ?? 'Before Parliament'}
                    </Text>
                  </View>
                  {currentBill.origin_chamber && (
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      {currentBill.origin_chamber === 'house' ? 'House' : 'Senate'}
                    </Text>
                  )}
                </View>

                {/* Title */}
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8, lineHeight: 24 }}>
                  {currentBill.short_title ?? currentBill.title}
                </Text>

                {/* TLDR explainer */}
                {currentBill.tldr && (
                  <Text style={{ fontSize: 14, color: colors.textBody, lineHeight: 20, marginBottom: 16 }}>
                    {currentBill.tldr}
                  </Text>
                )}

                {/* For / Against arguments */}
                {(currentBill.supporters_argument || currentBill.critics_argument) && (
                  <View style={{ marginBottom: 16 }}>
                    {currentBill.supporters_argument && (
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,132,61,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="checkmark" size={12} color="#00843D" />
                        </View>
                        <Text style={{ flex: 1, fontSize: 12.5, color: colors.textBody, lineHeight: 17 }}>
                          <Text style={{ fontWeight: '600', color: '#00843D' }}>For: </Text>
                          {currentBill.supporters_argument}
                        </Text>
                      </View>
                    )}
                    {currentBill.critics_argument && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="close" size={12} color="#DC2626" />
                        </View>
                        <Text style={{ flex: 1, fontSize: 12.5, color: colors.textBody, lineHeight: 17 }}>
                          <Text style={{ fontWeight: '600', color: '#DC2626' }}>Against: </Text>
                          {currentBill.critics_argument}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Vote counts */}
                {(currentBill.agree_count + currentBill.disagree_count) > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      {currentBill.agree_count + currentBill.disagree_count} opinions
                    </Text>
                    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', flexDirection: 'row' }}>
                      <View style={{ flex: currentBill.agree_count || 0.01, backgroundColor: '#00843D', borderRadius: 2 }} />
                      <View style={{ flex: currentBill.disagree_count || 0.01, backgroundColor: '#DC2626', borderRadius: 2 }} />
                    </View>
                  </View>
                )}

                {/* Agree / Disagree / Skip buttons — onStartShouldSetResponder prevents parent Pressable from firing */}
                <View style={{ flexDirection: 'row', gap: 10 }} onStartShouldSetResponder={() => true}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      submitOpinion('disagree');
                      track('bill_opinion', { bill_id: currentBill.id, opinion: 'disagree' }, 'Home');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Disagree with this bill"
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      backgroundColor: 'rgba(220,38,38,0.08)', borderRadius: radius.pill,
                      paddingVertical: 12,
                    }}
                  >
                    <Ionicons name="thumbs-down-outline" size={16} color="#DC2626" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#DC2626' }}>Disagree</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => { submitOpinion('skip'); }}
                    accessibilityRole="button"
                    accessibilityLabel="Skip this bill"
                    style={{
                      paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Skip</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      submitOpinion('agree');
                      track('bill_opinion', { bill_id: currentBill.id, opinion: 'agree' }, 'Home');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Agree with this bill"
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      backgroundColor: 'rgba(0,132,61,0.08)', borderRadius: radius.pill,
                      paddingVertical: 12,
                    }}
                  >
                    <Ionicons name="thumbs-up-outline" size={16} color="#00843D" />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#00843D' }}>Agree</Text>
                  </Pressable>
                </View>

                {/* Read more affordance */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textMuted }}>Read more about this bill</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                </View>
              </Pressable>
            </View>
            <SectionDivider />
          </>
        )}

        {/* ═══ 4. CONTINUE LEARNING ═══ */}
        <ContinueLearningCard navigation={navigation} colors={colors} />

        <SectionDivider />

        {/* ═══ 5. MP RECENT VOTES ═══ */}
        {myMP && mpRecentVotes.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                How {myMP.first_name} voted
              </Text>
              <Pressable onPress={() => navigation.navigate('MemberProfile', { member: myMP })} hitSlop={8} accessibilityRole="button" accessibilityLabel="View all votes">
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.green }}>All votes</Text>
              </Pressable>
            </View>

            <View style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              padding: spacing.lg,
              ...elevation.md,
            }}>
              {mpRecentVotes.map((vote, i) => {
                const divName = vote.division ? cleanDivisionName(vote.division.name) : 'Unknown';
                const isAye = vote.vote_cast === 'aye';
                return (
                  <Pressable
                    key={vote.id}
                    onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                    accessibilityRole="button"
                    accessibilityLabel={`${myMP.first_name} voted ${isAye ? 'aye' : 'no'} on ${divName}`}
                    style={({ pressed }) => ({
                      paddingVertical: 12,
                      borderBottomWidth: i < mpRecentVotes.length - 1 ? 1 : 0,
                      borderBottomColor: 'rgba(26,26,23,0.08)',
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#1A1A17', lineHeight: 18 }} numberOfLines={2}>
                          {divName}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>
                          {vote.division?.chamber === 'senate' ? 'Senate' : 'House'} · {vote.division?.date ? timeAgo(vote.division.date) : ''}
                        </Text>
                      </View>
                      {/* Aye/No pill */}
                      <View style={{
                        backgroundColor: isAye ? 'rgba(0,132,61,0.1)' : 'rgba(220,38,38,0.1)',
                        borderRadius: radius.sm,
                        paddingHorizontal: 10, paddingVertical: 4,
                        marginRight: spacing.sm,
                      }}>
                        <Text style={{
                          fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
                          color: isAye ? '#00843D' : '#DC2626',
                        }}>
                          {isAye ? 'AYE' : 'NO'}
                        </Text>
                      </View>
                      {/* Share button — the viral loop */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          navigation.navigate('MemberProfile', {
                            member: myMP,
                            shareVote: { divisionName: divName, voteCast: vote.vote_cast, date: vote.division?.date },
                          });
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Share ${myMP.first_name}'s vote`}
                        style={{ padding: 4 }}
                        onStartShouldSetResponder={() => true}
                      >
                        <Ionicons name="share-outline" size={16} color="#6B7280" />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <SectionDivider />
          </View>
        )}


        {/* Bottom spacing */}
        <View style={{ height: 20 }} />
      </ScrollView>

      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}

function ContinueLearningCard({ navigation, colors }: { navigation: any; colors: any }) {
  const { modules, loading } = useLearnModules();

  if (loading) return null;

  const totalLessons = modules.reduce((sum, m) => sum + m.lesson_count, 0);
  const completedLessons = modules.reduce((sum, m) => sum + m.completed_count, 0);

  // Find next incomplete module
  const nextModule = modules.find(m => m.completed_count < m.lesson_count && !m.is_current_events);
  if (!nextModule) return null;

  const progress = totalLessons > 0 ? completedLessons / totalLessons : 0;

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
      <Pressable
        onPress={() => navigation.navigate('Learn')}
        style={({ pressed }) => ({
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          ...elevation.sm,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <View style={{
            width: 40, height: 40, borderRadius: radius.sm,
            backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="school" size={20} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.green, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Continue Learning
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 1 }}>
              {nextModule.title}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
        </View>

        {/* Progress bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: colors.green, borderRadius: 2 }} />
          </View>
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>
            {completedLessons}/{totalLessons}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

