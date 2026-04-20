import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  Pressable,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useTheme } from '../context/ThemeContext';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useNewsStories, NewsStory } from '../hooks/useNewsStories';
import { useNewsStoryArticles } from '../hooks/useNewsStoryArticles';
import { NewsShareCard } from '../components/ShareCards';
import { captureAndShare } from '../utils/shareContent';
import { decodeHtml } from '../utils/decodeHtml';
import { useVotes } from '../hooks/useVotes';
import { useDailyBrief } from '../hooks/useDailyBrief';
import { usePersonalisedFeed, filterPoliticalStories } from '../hooks/usePersonalisedFeed';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticLight } from '../lib/haptics';
import { HomeScreenSkeleton } from '../components/HomeScreenSkeleton';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { useWeeklyPoll } from '../hooks/useWeeklyPoll';
import { WeeklyPollCard } from '../components/WeeklyPollCard';
import { useSittingCalendar } from '../hooks/useSittingCalendar';
import { useBillSwipe } from '../hooks/useBillSwipe';
import * as Haptics from 'expo-haptics';
import { track } from '../lib/analytics';
import { trackEvent } from '../lib/engagementTracker';

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
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: color, marginRight: 7 }} />
        <Text style={{ fontSize: 10.5, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1, color: '#6B7280', textTransform: 'uppercase' }}>
          {label}
        </Text>
      </View>
      {rightLabel && onRightPress && (
        <Pressable onPress={onRightPress} hitSlop={8}>
          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: '#00843D' }}>{rightLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Section Divider ─────────────────────────────────────────────────────

function SectionDivider() {
  return (
    <View style={{ height: 1, backgroundColor: 'rgba(26,26,23,0.06)', marginHorizontal: 20, marginTop: SPACING.xl }} />
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────

export function HomeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode, setPostcode, user } = useUser();
  const [postcodeInput, setPostcodeInput] = useState(postcode || '');
  const [refreshing, setRefreshing] = useState(false);
  const { requireAuth, authSheetProps } = useAuthGate();

  // ── Data hooks ──
  const electorateResult = useElectorateByPostcode(postcode);
  const { member: myMP, loading: mpLoading } = electorateResult;
  const electorateName = electorateResult.electorate?.name ?? null;

  const { brief, loading: briefLoading, refresh: refreshBrief } = useDailyBrief(
    electorateName,
    myMP ? `${myMP.first_name} ${myMP.last_name}` : null,
  );

  const { votes: mpVotes } = useVotes(myMP?.id ?? null);
  const { isSittingToday, nextSitting } = useSittingCalendar();

  const { stories: newsStories, loading: newsStoriesLoading, refresh: refreshNews } = useNewsStories(undefined, undefined, undefined, 15);

  const { poll: weeklyPoll, userVote: weeklyVote, results: weeklyResults, vote: weeklyVoteFn } = useWeeklyPoll(
    postcode,
    electorateName,
  );

  const { currentBill, remaining: billsRemaining, submitOpinion } = useBillSwipe();

  // ── Personalised news feed ──
  const filteredStories = filterPoliticalStories(newsStories);
  const personalised = usePersonalisedFeed(filteredStories, {
    electorate: electorateName,
    mpName: myMP ? `${myMP.first_name} ${myMP.last_name}` : null,
    followedTopics: [],
  });

  // Hero story + articles
  const heroStory: NewsStory | null = useMemo(() => personalised[0] ?? null, [personalised]);
  const { articles: heroArticles } = useNewsStoryArticles(heroStory?.id);

  // ── MP recent substantive votes ──
  const mpRecentVotes = useMemo(() => {
    return mpVotes
      .filter(v => v.vote_cast === 'aye' || v.vote_cast === 'no')
      .slice(0, 3);
  }, [mpVotes]);

  // ── News share card ──
  const newsCardRef = useRef<any>(null);
  const [shareNewsStory, setShareNewsStory] = useState<NewsStory | null>(null);
  useEffect(() => {
    if (shareNewsStory) {
      captureAndShare(newsCardRef, 'news_story', String(shareNewsStory.id), user?.id)
        .finally(() => setShareNewsStory(null));
    }
  }, [shareNewsStory]);

  // ── Notification nudge ──
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    AsyncStorage.getItem('notification_prompt_shown').then(val => {
      if (!val) {
        timer = setTimeout(() => setShowNotifPrompt(true), 60000);
      }
    });
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  const dismissNotifPrompt = () => {
    setShowNotifPrompt(false);
    AsyncStorage.setItem('notification_prompt_shown', 'true');
  };

  const enableNotifications = async () => {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.requestPermissionsAsync();
    } catch {}
    dismissNotifPrompt();
  };

  // ── Refresh ──
  const onRefresh = useCallback(async () => {
    hapticLight();
    setRefreshing(true);
    try {
      await Promise.all([refreshNews(), refreshBrief()]);
    } catch {}
    setRefreshing(false);
  }, [refreshNews, refreshBrief]);

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

  // Hero article perspectives
  const heroLeft = heroArticles.find(a => a.source?.leaning === 'left' || a.source?.leaning === 'center-left');
  const heroCenter = heroArticles.find(a => a.source?.leaning === 'center');
  const heroRight = heroArticles.find(a => a.source?.leaning === 'right' || a.source?.leaning === 'center-right');

  // Coverage percentages
  const heroTotal = (heroStory?.left_count ?? 0) + (heroStory?.center_count ?? 0) + (heroStory?.right_count ?? 0);
  const leftPct = heroTotal > 0 ? Math.round(((heroStory?.left_count ?? 0) / heroTotal) * 100) : 0;
  const rightPct = heroTotal > 0 ? Math.round(((heroStory?.right_count ?? 0) / heroTotal) * 100) : 0;
  const centerPct = heroTotal > 0 ? 100 - leftPct - rightPct : 0;

  // Blindspot check
  const isBlindspot = heroStory && heroStory.article_count >= 3 && ((heroStory.left_count ?? 0) === 0 || (heroStory.right_count ?? 0) === 0);
  const blindspotSide = heroStory && (heroStory.left_count ?? 0) === 0 ? 'left' : 'right';

  // Brief bullet count for "X of Y" counter
  const briefBulletCount = brief?.ai_text?.what_happened?.length ?? 0;
  const briefShownCount = Math.min(briefBulletCount, 3);

  // ── Loading state ──
  const initialLoading = briefLoading && newsStoriesLoading;
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
        contentContainerStyle={{ paddingBottom: SPACING.xl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00843D" colors={['#00843D']} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ═══ 1. GREEN HERO ═══ */}
        <LinearGradient
          colors={['#00843D', '#006B31']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 18,
            paddingHorizontal: 22,
            paddingBottom: 28,
            overflow: 'hidden',
          }}
        >
          {/* Decorative circles */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: 80,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', bottom: -30, left: -30,
              width: 120, height: 120, borderRadius: 60,
              backgroundColor: 'rgba(255,255,255,0.04)',
            }}
          />

          {/* Top row: bell + compass — right-aligned */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20, gap: 10 }}>
            <Pressable
              onPress={() => navigation.navigate('Activity')}
              hitSlop={8}
              style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: 'rgba(255,255,255,0.15)',
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Ionicons name="notifications-outline" size={19} color="#ffffff" />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Explore')}
              hitSlop={8}
              style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: 'rgba(255,255,255,0.15)',
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Ionicons name="compass-outline" size={19} color="#ffffff" />
            </Pressable>
          </View>

          {/* Greeting */}
          <Text style={{ fontSize: 30, fontWeight: FONT_WEIGHT.bold, color: '#ffffff', letterSpacing: -0.5 }}>
            {greeting}
          </Text>

          {/* Date */}
          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.xs }}>
            {dateStr}
          </Text>

          {/* Parliament status pills */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 14 }}>
            {/* Pill 1: sitting status */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderRadius: BORDER_RADIUS.md,
              paddingHorizontal: 11, paddingVertical: 8,
            }}>
              <View style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: isSittingToday ? '#4ADE80' : '#FBBF24',
              }} />
              <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.85)' }}>
                {isSittingToday ? 'Parliament is sitting' : 'Parliament in recess'}
              </Text>
            </View>
            {/* Pill 2: resume date */}
            {!isSittingToday && nextSitting && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderRadius: BORDER_RADIUS.md,
                paddingHorizontal: 11, paddingVertical: 8,
              }}>
                <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={{ fontSize: 12, fontWeight: FONT_WEIGHT.semibold, color: 'rgba(255,255,255,0.85)' }}>
                  Resumes {formatParliamentDate(nextSitting)}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* ═══ 2. TODAY'S BRIEF ═══ */}
        {brief?.ai_text?.what_happened && brief.ai_text.what_happened.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
            <View style={{
              backgroundColor: colors.card,
              borderRadius: BORDER_RADIUS.xl,
              padding: 18,
              ...SHADOWS.sm,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: colors.green, marginRight: 7 }} />
                  <Text style={{ fontSize: 10.5, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1, color: '#6B7280', textTransform: 'uppercase' }}>
                    {"TODAY'S BRIEF"}
                  </Text>
                </View>
                {briefBulletCount > 0 && (
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
                    {briefShownCount} of {briefBulletCount}
                  </Text>
                )}
              </View>

              {/* TODO: add bold text parsing for bullet strings (e.g. **bold** → <Text fontWeight=700>) */}
              {brief.ai_text.what_happened.slice(0, 3).map((bullet, i) => (
                <React.Fragment key={i}>
                  <Pressable
                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: SPACING.sm }}
                    onPress={() => { track('daily_brief_read', { bullet: i }, 'Home'); navigation.navigate('DailyBrief'); }}
                  >
                    <View style={{
                      width: 24, height: 24, borderRadius: 12,
                      backgroundColor: i === 0 ? colors.green : '#E5E7EB',
                      justifyContent: 'center', alignItems: 'center',
                      marginTop: 1,
                    }}>
                      <Text style={{
                        fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
                        color: i === 0 ? '#ffffff' : '#6B7280',
                      }}>
                        {i + 1}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 }}>
                      {bullet}
                    </Text>
                  </Pressable>
                  {i < Math.min(brief.ai_text!.what_happened.length, 3) - 1 && (
                    <View style={{ height: 0.5, backgroundColor: 'rgba(26,26,23,0.1)', marginLeft: 34 }} />
                  )}
                </React.Fragment>
              ))}

              {/* Footer */}
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                marginTop: SPACING.lg, paddingTop: 14,
                borderTopWidth: 0.5, borderTopColor: 'rgba(26,26,23,0.1)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>2 min read</Text>
                </View>
                <Pressable onPress={() => { track('daily_brief_read', {}, 'Home'); navigation.navigate('DailyBrief'); }}>
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: colors.green }}>
                    Read full brief {'\u2192'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <SectionDivider />

        {/* ═══ 3. YOUR REPRESENTATIVE ═══ */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
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
              borderRadius: BORDER_RADIUS.lg,
              padding: 18,
              ...SHADOWS.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: 14 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: '#E8F5EE',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name="location-outline" size={22} color={colors.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>Set your electorate</Text>
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2 }}>
                    Enter your postcode to find your MP
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <TextInput
                  style={{
                    flex: 1, height: 44, borderRadius: BORDER_RADIUS.md,
                    backgroundColor: colors.surface,
                    paddingHorizontal: 14,
                    fontSize: FONT_SIZE.body, color: colors.text,
                  }}
                  value={postcodeInput}
                  onChangeText={setPostcodeInput}
                  placeholder="Enter postcode"
                  placeholderTextColor="#9aabb8"
                  keyboardType="number-pad"
                  maxLength={4}
                  returnKeyType="search"
                  onSubmitEditing={handleSetPostcode}
                />
                <Pressable
                  style={{
                    height: 44, paddingHorizontal: 20,
                    backgroundColor: colors.green,
                    borderRadius: BORDER_RADIUS.md,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                  onPress={handleSetPostcode}
                >
                  <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>Find MP</Text>
                </Pressable>
              </View>
            </View>
          ) : mpLoading ? (
            <SkeletonLoader height={130} borderRadius={BORDER_RADIUS.lg} />
          ) : myMP ? (
            /* MP card */
            <View style={{
              backgroundColor: colors.card,
              borderRadius: BORDER_RADIUS.lg,
              padding: SPACING.lg,
              ...SHADOWS.sm,
            }}>
              {/* Avatar + info */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                {/* Initials avatar */}
                <View style={{
                  width: 54, height: 54, borderRadius: 27,
                  backgroundColor: colors.green,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 16, fontWeight: FONT_WEIGHT.semibold, color: '#ffffff' }}>
                    {myMP.first_name[0]}{myMP.last_name[0]}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                      {myMP.first_name} {myMP.last_name}
                    </Text>
                    <Ionicons name="checkmark-circle" size={15} color="#2563EB" />
                  </View>
                  <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: 2 }}>
                    {myMP.party?.short_name || myMP.party?.abbreviation || myMP.party?.name || ''}
                    {' \u00B7 MP for '}
                    {myMP.electorate?.name ?? ''}
                  </Text>
                </View>
              </View>

              {/* Last vote pill */}
              {lastVote && (
                <Pressable
                  onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    marginTop: SPACING.md,
                    backgroundColor: lastVote.cast === 'aye' ? 'rgba(0,132,61,0.08)' : 'rgba(220,38,38,0.08)',
                    borderRadius: BORDER_RADIUS.md,
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
                      fontSize: 12.5, fontWeight: FONT_WEIGHT.semibold,
                      color: lastVote.cast === 'aye' ? '#166534' : '#991B1B',
                    }} numberOfLines={1}>
                      Voted {lastVote.cast === 'aye' ? 'Aye' : 'No'} · {smartTruncate(lastVote.name, 30)}
                    </Text>
                    <Text style={{
                      fontSize: FONT_SIZE.caption, marginTop: 2,
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
                    gap: 6, height: 40, borderRadius: BORDER_RADIUS.full,
                    backgroundColor: colors.green,
                  }}
                  onPress={() => requireAuth('write to your MP', () => navigation.navigate('WriteToMP', { member: myMP }))}
                >
                  <Ionicons name="mail-outline" size={14} color="#ffffff" />
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>Write to MP</Text>
                </Pressable>
                {/* View profile — outlined */}
                <Pressable
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    height: 40, borderRadius: BORDER_RADIUS.full,
                    backgroundColor: colors.card,
                    borderWidth: 1, borderColor: colors.border,
                  }}
                  onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                >
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>
                    View profile {'\u2192'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Fallback: electorate found but no MP */
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: BORDER_RADIUS.lg, padding: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={{ flex: 1, fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 18 }}>
                {electorateResult.electorate
                  ? `${electorateResult.electorate.name} (${electorateResult.electorate.state}) \u2014 MP data loading soon.`
                  : `No electorate found for ${postcode}.`}
              </Text>
            </View>
          )}
        </View>

        <SectionDivider />

        {/* ═══ 4. THIS WEEK'S POLL ═══ */}
        {weeklyPoll && (
          <>
            <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
              <SectionHeader color="#D97706" label="THIS WEEK'S POLL" />
              <WeeklyPollCard
                poll={weeklyPoll}
                userVote={weeklyVote}
                results={weeklyResults}
                electorate={electorateName}
                onVote={(i) => {
                  track('poll_vote', { poll_id: weeklyPoll.id, option: i }, 'Home');
                  trackEvent('poll_voted', { poll_id: weeklyPoll.id });
                  weeklyVoteFn(i);
                }}
                requireAuth={requireAuth}
              />
            </View>
            <SectionDivider />
          </>
        )}

        {/* ═══ 4b. HAVE YOUR SAY — Bill Swipe ═══ */}
        {currentBill && (
          <>
            <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
              <SectionHeader color="#00843D" label="HAVE YOUR SAY" rightLabel={`${billsRemaining} bills`} />
              <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 14 }}>
                Swipe on bills currently before parliament
              </Text>

              {/* Bill card */}
              <View style={{
                backgroundColor: colors.card,
                borderRadius: BORDER_RADIUS.xl,
                padding: 20,
                ...SHADOWS.md,
              }}>
                {/* Status + chamber */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={{ backgroundColor: '#E8F5EE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#00843D', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                <Text style={{ fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: 8, lineHeight: 24 }}>
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
                          <Text style={{ fontWeight: FONT_WEIGHT.semibold, color: '#00843D' }}>For: </Text>
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
                          <Text style={{ fontWeight: FONT_WEIGHT.semibold, color: '#DC2626' }}>Against: </Text>
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

                {/* Agree / Disagree / Skip buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      submitOpinion('disagree');
                      track('bill_opinion', { bill_id: currentBill.id, opinion: 'disagree' }, 'Home');
                    }}
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      backgroundColor: 'rgba(220,38,38,0.08)', borderRadius: BORDER_RADIUS.full,
                      paddingVertical: 12,
                    }}
                  >
                    <Ionicons name="thumbs-down-outline" size={16} color="#DC2626" />
                    <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.semibold, color: '#DC2626' }}>Disagree</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => { submitOpinion('skip'); }}
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
                    style={{
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      backgroundColor: 'rgba(0,132,61,0.08)', borderRadius: BORDER_RADIUS.full,
                      paddingVertical: 12,
                    }}
                  >
                    <Ionicons name="thumbs-up-outline" size={16} color="#00843D" />
                    <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.semibold, color: '#00843D' }}>Agree</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <SectionDivider />
          </>
        )}

        {/* ═══ 5. IN THE NEWS ═══ */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
          <SectionHeader
            color="#1A1A17"
            label="IN THE NEWS"
            rightLabel="All news \u2192"
            onRightPress={() => navigation.navigate('News')}
          />
          <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, marginTop: -SPACING.sm, marginBottom: SPACING.lg }}>
            How outlets are covering what matters
          </Text>

          {newsStoriesLoading ? (
            <SkeletonLoader height={200} borderRadius={BORDER_RADIUS.lg} />
          ) : heroStory ? (
            <Pressable
              style={{
                backgroundColor: colors.card,
                borderRadius: BORDER_RADIUS.lg,
                padding: SPACING.lg,
                ...SHADOWS.sm,
              }}
              onPress={() => navigation.navigate('NewsStoryDetail', { story: heroStory })}
            >
              {/* MOST COVERED badge + meta */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 10 }}>
                <View style={{
                  backgroundColor: '#1A1A17',
                  borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#ffffff', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    MOST COVERED
                  </Text>
                </View>
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                  {heroStory.article_count} outlets · {timeAgo(heroStory.first_seen)}
                </Text>
              </View>

              {/* Headline */}
              <Text style={{ fontSize: 19, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 25, marginBottom: SPACING.sm }} numberOfLines={2}>
                {heroStory.headline}
              </Text>

              {/* AI summary */}
              {heroStory.ai_summary && (
                <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted, lineHeight: 19, marginBottom: SPACING.md }} numberOfLines={2}>
                  {decodeHtml(heroStory.ai_summary.replace(/^#+\s*/, ''))}
                </Text>
              )}

              {/* COVERAGE SPLIT */}
              <Text style={{ fontSize: 9, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.6, color: '#9CA3AF', marginBottom: 6 }}>
                COVERAGE SPLIT
              </Text>
              <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.sm }}>
                <View style={{ flex: heroStory.left_count || 0.01, backgroundColor: '#C2410C' }} />
                <View style={{ flex: heroStory.center_count || 0.01, backgroundColor: '#6B7280' }} />
                <View style={{ flex: heroStory.right_count || 0.01, backgroundColor: '#1D4ED8' }} />
              </View>
              {heroTotal > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md }}>
                  <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: '#C2410C' }}>{leftPct}% Left</Text>
                  <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: '#6B7280' }}>{centerPct}% Centre</Text>
                  <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.semibold, color: '#1D4ED8' }}>{rightPct}% Right</Text>
                </View>
              )}

              {/* Three outlet preview cards */}
              {heroArticles.length > 0 && (heroLeft || heroCenter || heroRight) && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { article: heroLeft, label: 'LEFT', borderColor: '#C2410C' },
                    { article: heroCenter, label: 'CENTRE', borderColor: '#6B7280' },
                    { article: heroRight, label: 'RIGHT', borderColor: '#1D4ED8' },
                  ].map(({ article, label, borderColor }) => (
                    <View key={label} style={{
                      flex: 1, backgroundColor: colors.surface,
                      borderRadius: SPACING.sm, padding: SPACING.sm,
                      borderLeftWidth: 3, borderLeftColor: borderColor,
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: FONT_WEIGHT.bold, color: borderColor, letterSpacing: 0.4, marginBottom: 3 }}>
                        {label}
                      </Text>
                      {article ? (
                        <>
                          <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.text, lineHeight: 14 }} numberOfLines={3}>
                            {article.title}
                          </Text>
                          <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 3 }} numberOfLines={1}>
                            {article.source?.name ?? ''}
                          </Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 10, color: '#9CA3AF', fontStyle: 'italic' }}>Not covered</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          ) : (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: BORDER_RADIUS.lg, padding: 20,
              alignItems: 'center',
            }}>
              <Ionicons name="newspaper-outline" size={32} color="#9CA3AF" />
              <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.sm }}>
                Checking sources
              </Text>
              <Text style={{ fontSize: FONT_SIZE.small, color: '#9CA3AF', textAlign: 'center', marginTop: SPACING.xs }}>
                Stories appear here once multiple outlets have covered them.
              </Text>
            </View>
          )}
        </View>

        {/* ═══ 6. BLINDSPOT CARD ═══ */}
        {isBlindspot && heroStory && (
          <View style={{ paddingHorizontal: 20, marginTop: SPACING.md }}>
            <View style={{
              backgroundColor: '#FEF2F2',
              borderRadius: BORDER_RADIUS.lg,
              padding: 14,
              flexDirection: 'row', alignItems: 'flex-start', gap: 10,
            }}>
              <Ionicons name="eye-off-outline" size={18} color="#991B1B" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5, color: '#991B1B', textTransform: 'uppercase', marginBottom: 4 }}>
                  BLINDSPOT
                </Text>
                <Text style={{ fontSize: FONT_SIZE.small, color: '#991B1B', lineHeight: 18 }}>
                  {blindspotSide === 'left'
                    ? 'No left-leaning outlets have covered this story.'
                    : 'No right-leaning outlets have covered this story.'}
                </Text>
                <Text style={{ fontSize: FONT_SIZE.caption, color: 'rgba(153,27,27,0.6)', marginTop: 4 }}>
                  {heroStory.article_count} source{heroStory.article_count !== 1 ? 's' : ''} total
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* TODO: add local-to-electorate card when electorate_tags column is added to news_stories */}

        <SectionDivider />

        {/* ═══ 8. MP RECENT VOTES ═══ */}
        {myMP && mpRecentVotes.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
            <SectionHeader
              color={colors.green}
              label={`${myMP.first_name.toUpperCase()}'S RECENT VOTES`}
              rightLabel="View all \u2192"
              onRightPress={() => navigation.navigate('MemberProfile', { member: myMP })}
            />

            <Text style={{ fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.md, marginTop: -SPACING.sm }}>
              How your MP decided
            </Text>

            <View style={{
              backgroundColor: '#F5F3EE',
              borderRadius: BORDER_RADIUS.lg,
              padding: 14,
              ...SHADOWS.sm,
            }}>
              {mpRecentVotes.map((vote, i) => {
                const divName = vote.division ? cleanDivisionName(vote.division.name) : 'Unknown';
                const isAye = vote.vote_cast === 'aye';
                return (
                  <View
                    key={vote.id}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: i < mpRecentVotes.length - 1 ? 1 : 0,
                      borderBottomColor: 'rgba(26,26,23,0.08)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.medium, color: '#1A1A17', lineHeight: 18 }} numberOfLines={2}>
                          {divName}
                        </Text>
                        <Text style={{ fontSize: FONT_SIZE.caption, color: '#6B7280', marginTop: 3 }}>
                          {vote.division?.chamber === 'senate' ? 'Senate' : 'House'} · {vote.division?.date ? timeAgo(vote.division.date) : ''}
                        </Text>
                      </View>
                      {/* Aye/No pill */}
                      <View style={{
                        backgroundColor: isAye ? 'rgba(0,132,61,0.1)' : 'rgba(220,38,38,0.1)',
                        borderRadius: BORDER_RADIUS.sm,
                        paddingHorizontal: 10, paddingVertical: 4,
                      }}>
                        <Text style={{
                          fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5,
                          color: isAye ? '#00843D' : '#DC2626',
                        }}>
                          {isAye ? 'AYE' : 'NO'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            <SectionDivider />
          </View>
        )}

        {/* ═══ 9. QUICK ACTIONS ═══ */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {([
              { icon: 'search-outline' as const, label: 'Search', screen: 'Explore' },
              { icon: 'document-text-outline' as const, label: 'Bills', screen: 'BillList' },
              { icon: 'people-outline' as const, label: 'MPs', screen: 'Explore' },
              { icon: 'calendar-outline' as const, label: 'Elections', screen: 'Vote' },
            ] as const).map(item => (
              <Pressable
                key={item.label}
                style={{ alignItems: 'center' }}
                onPress={() => navigation.navigate(item.screen)}
              >
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: colors.surface,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name={item.icon} size={22} color={colors.text} />
                </View>
                <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: SPACING.xs }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <SectionDivider />

        {/* ═══ 10. NOTIFICATION NUDGE ═══ */}
        {showNotifPrompt && (
          <View style={{ paddingHorizontal: 20, marginTop: SPACING.xl }}>
            <LinearGradient
              colors={['#ECFDF5', '#F0FDF4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: BORDER_RADIUS.xl,
                padding: 18,
                flexDirection: 'row', alignItems: 'center', gap: 14,
                borderWidth: 1, borderColor: '#A7F3D0',
              }}
            >
              {/* Green circle with bell */}
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#D1FAE5',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name="notifications-outline" size={22} color={colors.green} />
              </View>

              {/* Text content */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: '#1A1A17', marginBottom: SPACING.xs }}>
                  {myMP
                    ? `Get alerts when ${myMP.first_name} votes`
                    : 'Get alerts on votes'}
                </Text>
                <Text style={{ fontSize: 12, color: '#374151', lineHeight: 17 }}>
                  One push per division. No spam.
                </Text>
                <Pressable
                  style={{
                    backgroundColor: colors.green,
                    borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
                    alignSelf: 'flex-start', marginTop: SPACING.md,
                  }}
                  onPress={enableNotifications}
                >
                  <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold, color: '#ffffff' }}>Enable</Text>
                </Pressable>
              </View>

              {/* X dismiss */}
              <Pressable
                onPress={dismissNotifPrompt}
                hitSlop={10}
                style={{ position: 'absolute', top: 10, right: 10 }}
              >
                <Ionicons name="close" size={18} color="#6B7280" />
              </Pressable>
            </LinearGradient>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Hidden news share card */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={newsCardRef}>
          {shareNewsStory && (
            <NewsShareCard
              headline={shareNewsStory.headline}
              category={shareNewsStory.category}
              articleCount={shareNewsStory.article_count}
              leftCount={shareNewsStory.left_count}
              centerCount={shareNewsStory.center_count}
              rightCount={shareNewsStory.right_count}
            />
          )}
        </View>
      </View>
      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}
