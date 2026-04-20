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
  Linking,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useBills } from '../hooks/useBills';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useTheme } from '../context/ThemeContext';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { supabase } from '../lib/supabase';
import { useRecentDivisions } from '../hooks/useRecentDivisions';
import { useNewsStories, NewsStory } from '../hooks/useNewsStories';
import { useNewsStoryArticles } from '../hooks/useNewsStoryArticles';
import { TwoRowCoverageBar } from '../components/TwoRowCoverageBar';
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
import { Image } from 'expo-image';
import { topicBg, topicAccent } from '../constants/topicColors';
import { BlindspotBadge } from '../components/BlindspotBadge';
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: color }} />
        <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 1, color: '#6B7280', textTransform: 'uppercase' }}>
          {label}
        </Text>
      </View>
      {rightLabel && onRightPress && (
        <Pressable onPress={onRightPress} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>{rightLabel}</Text>
        </Pressable>
      )}
    </View>
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
  const { divisions: recentDivisions, loading: divisionsLoading, refresh: refreshDivisions } = useRecentDivisions(5);
  const { stories: newsStories, loading: newsStoriesLoading, refresh: refreshNews } = useNewsStories(undefined, undefined, undefined, 15);
  const { bills: trendingBills, loading: billsLoading } = useBills({ limit: 10, activeOnly: true });
  const { isSittingToday, nextSitting } = useSittingCalendar();

  const { poll: weeklyPoll, userVote: weeklyVote, results: weeklyResults, vote: weeklyVoteFn } = useWeeklyPoll(
    postcode,
    electorateName,
  );

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

  // ── MP stats ──
  const mpTotalVotes = mpVotes.length;
  const mpAyeRate = mpTotalVotes > 0
    ? Math.round(mpVotes.filter(v => v.vote_cast === 'aye').length / mpTotalVotes * 100)
    : null;
  const mpRebelCount = mpVotes.filter(v => v.rebelled).length;

  // ── Grouped divisions ──
  type GroupedDiv = { id: string; cleanedName: string; date: string; chamber: string; aye_votes: number; no_votes: number; count: number };
  const groupedDivisions: GroupedDiv[] = useMemo(() => {
    const seen = new Map<string, GroupedDiv>();
    for (const d of recentDivisions) {
      const cleanedName = cleanDivisionName(d.name);
      const key = `${cleanedName}|${d.date.slice(0, 10)}`;
      const existing = seen.get(key);
      if (existing) {
        existing.count++;
        if (d.aye_votes + d.no_votes > existing.aye_votes + existing.no_votes) {
          existing.aye_votes = d.aye_votes;
          existing.no_votes = d.no_votes;
        }
      } else {
        seen.set(key, { ...d, cleanedName, count: 1 });
      }
    }
    return Array.from(seen.values());
  }, [recentDivisions]);

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

  // ── Failed images tracking ──
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // ── Refresh ──
  const onRefresh = useCallback(async () => {
    hapticLight();
    setRefreshing(true);
    try {
      await Promise.all([refreshNews(), refreshDivisions(), refreshBrief()]);
    } catch {}
    setRefreshing(false);
  }, [refreshNews, refreshDivisions, refreshBrief]);

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
  const dateStr = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  const userName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.user_metadata?.name?.split(' ')[0]
    || null;

  const parliamentStatus = isSittingToday
    ? 'Parliament sitting today'
    : nextSitting
    ? `Parliament in recess \u00B7 Resumes ${formatParliamentDate(nextSitting)}`
    : 'Parliament in recess';

  // Last vote for MP
  const lastVote = mpVotes.length > 0 && mpVotes[0].division?.name
    ? { name: cleanDivisionName(mpVotes[0].division.name), cast: mpVotes[0].vote_cast }
    : null;

  // Hero article perspectives
  const heroLeft = heroArticles.find(a => a.source?.leaning === 'left' || a.source?.leaning === 'center-left');
  const heroCenter = heroArticles.find(a => a.source?.leaning === 'center');
  const heroRight = heroArticles.find(a => a.source?.leaning === 'right' || a.source?.leaning === 'center-right');

  // ── Loading state ──
  const initialLoading = briefLoading && newsStoriesLoading && divisionsLoading;
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
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00843D" colors={['#00843D']} />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ═══ 1. GREEN HERO SECTION ═══ */}
        <View style={{
          backgroundColor: '#00843D',
          paddingTop: 18,
          paddingHorizontal: 22,
          paddingBottom: 28,
        }}>
          {/* Top row: logo + icons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            {/* V logo */}
            <View style={{
              width: 26, height: 26, borderRadius: 6,
              backgroundColor: '#ffffff',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#00843D' }}>V</Text>
            </View>

            {/* Right icons */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
                <Ionicons name="search-outline" size={19} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          {/* Dateline */}
          <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, marginBottom: 4 }}>
            {dateStr}
          </Text>

          {/* Greeting */}
          <Text style={{ fontSize: 30, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 }}>
            {greeting}{userName ? `, ${userName}` : ''}
          </Text>

          {/* Parliament status badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(255,255,255,0.12)',
            alignSelf: 'flex-start',
            borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 7,
            marginTop: 14,
          }}>
            <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
            {isSittingToday && (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' }} />
            )}
            <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>
              {parliamentStatus}
            </Text>
          </View>
        </View>

        {/* ═══ 2. TODAY'S BRIEF ═══ */}
        {(briefLoading || brief) && (
          <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
            <SectionHeader color="#00843D" label="TODAY'S BRIEF" />

            <View style={{
              backgroundColor: '#F8F6F1',
              borderRadius: 20,
              padding: 18,
              ...SHADOWS.sm,
            }}>
              {briefLoading ? (
                <View style={{ gap: 10 }}>
                  <SkeletonLoader height={16} borderRadius={4} />
                  <SkeletonLoader height={16} borderRadius={4} />
                  <SkeletonLoader width="70%" height={16} borderRadius={4} />
                </View>
              ) : brief?.ai_text?.what_happened ? (
                <>
                  {brief.ai_text.what_happened.slice(0, 3).map((bullet, i) => (
                    <Pressable
                      key={i}
                      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: i < 2 ? 12 : 0 }}
                      onPress={() => { track('daily_brief_read', { bullet: i }, 'Home'); navigation.navigate('DailyBrief'); }}
                    >
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: i === 0 ? '#00843D' : '#E5E7EB',
                        justifyContent: 'center', alignItems: 'center',
                        marginTop: 1,
                      }}>
                        <Text style={{
                          fontSize: 11, fontWeight: '700',
                          color: i === 0 ? '#ffffff' : '#6B7280',
                        }}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, color: '#1A1A1A', lineHeight: 20 }}>
                        {bullet}
                      </Text>
                    </Pressable>
                  ))}

                  {/* Footer */}
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 16, paddingTop: 14,
                    borderTopWidth: 1, borderTopColor: '#E5E7EB',
                  }}>
                    {brief.ai_text.what_happened.length > 3 && (
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>
                        + {brief.ai_text.what_happened.length - 3} more stories
                      </Text>
                    )}
                    <Pressable onPress={() => { track('daily_brief_read', {}, 'Home'); navigation.navigate('DailyBrief'); }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>
                        Read full brief {'\u2192'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : brief?.stories?.length ? (
                <>
                  {brief.stories.slice(0, 3).map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: i < 2 ? 12 : 0 }}>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: i === 0 ? '#00843D' : '#E5E7EB',
                        justifyContent: 'center', alignItems: 'center',
                        marginTop: 1,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: i === 0 ? '#ffffff' : '#6B7280' }}>
                          {i + 1}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, color: '#1A1A1A', lineHeight: 20 }}>{s.headline}</Text>
                    </View>
                  ))}
                  <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E5E7EB', alignItems: 'flex-end' }}>
                    <Pressable onPress={() => { track('daily_brief_read', {}, 'Home'); navigation.navigate('DailyBrief'); }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#00843D' }}>Read full brief {'\u2192'}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 }}>
                  Today's brief is being prepared. Check back soon.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ═══ 3. YOUR REPRESENTATIVE ═══ */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <SectionHeader
            color="#00843D"
            label="YOUR REPRESENTATIVE"
            rightLabel={postcode ? 'Change' : undefined}
            onRightPress={postcode ? clearPostcode : undefined}
          />

          {!postcode ? (
            /* Empty state: set electorate */
            <View style={{
              backgroundColor: colors.card,
              borderRadius: 14,
              padding: 18,
              ...SHADOWS.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: '#E8F5EE',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name="location-outline" size={22} color="#00843D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Set your electorate</Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                    Enter your postcode to find your MP
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={{
                    flex: 1, height: 44, borderRadius: 10,
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
                  returnKeyType="search"
                  onSubmitEditing={handleSetPostcode}
                />
                <Pressable
                  style={{
                    height: 44, paddingHorizontal: 20,
                    backgroundColor: '#00843D',
                    borderRadius: 10,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                  onPress={handleSetPostcode}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>Find MP</Text>
                </Pressable>
              </View>
            </View>
          ) : mpLoading ? (
            <SkeletonLoader height={130} borderRadius={14} />
          ) : myMP ? (
            /* MP card */
            <View style={{
              backgroundColor: colors.card,
              borderRadius: 14,
              padding: 16,
              ...SHADOWS.sm,
            }}>
              {/* Top: avatar + info */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                {/* Avatar */}
                {myMP.photo_url ? (
                  <Image source={{ uri: myMP.photo_url }} style={{ width: 54, height: 54, borderRadius: 27 }} />
                ) : (
                  <View style={{
                    width: 54, height: 54, borderRadius: 27,
                    backgroundColor: (myMP.party?.colour || '#9aabb8') + '22',
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: myMP.party?.colour || '#9aabb8' }}>
                      {myMP.first_name[0]}{myMP.last_name[0]}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                      {myMP.first_name} {myMP.last_name}
                    </Text>
                    <Ionicons name="checkmark-circle" size={15} color="#00843D" />
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                    {myMP.party?.short_name || myMP.party?.abbreviation || myMP.party?.name || ''}
                    {myMP.electorate ? ` \u00B7 ${myMP.electorate.name}` : ''}
                  </Text>
                  {myMP.ministerial_role && (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' }} numberOfLines={1}>
                      {myMP.ministerial_role}
                    </Text>
                  )}
                </View>
              </View>

              {/* Mini stats */}
              {mpTotalVotes > 0 && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  {[
                    { label: 'Attendance', value: mpAyeRate !== null ? `${mpAyeRate}%` : '--' },
                    { label: 'Votes', value: String(mpTotalVotes) },
                    { label: 'Rebellions', value: String(mpRebelCount) },
                  ].map(stat => (
                    <View key={stat.label} style={{
                      flex: 1,
                      backgroundColor: colors.surface,
                      borderRadius: 8,
                      paddingVertical: 8,
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{stat.value}</Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Last vote pill */}
              {lastVote && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  marginTop: 12,
                  backgroundColor: lastVote.cast === 'no' ? '#FEF2F2' : '#F0FDF4',
                  borderRadius: 8, padding: 8,
                }}>
                  <Text style={{ fontSize: 11, color: '#6B7280' }}>Last vote:</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                    {lastVote.name}
                  </Text>
                  <View style={{
                    backgroundColor: lastVote.cast === 'no' ? '#DC354520' : '#00843D20',
                    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{
                      fontSize: 9, fontWeight: '700', letterSpacing: 0.5,
                      color: lastVote.cast === 'no' ? '#DC3545' : '#00843D',
                    }}>
                      {(lastVote.cast || '').toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, height: 40, borderRadius: 10,
                    borderWidth: 1, borderColor: '#00843D',
                  }}
                  onPress={() => requireAuth('write to your MP', () => navigation.navigate('WriteToMP', { member: myMP }))}
                >
                  <Ionicons name="mail-outline" size={14} color="#00843D" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#00843D' }}>Write</Text>
                </Pressable>
                <Pressable
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, height: 40, borderRadius: 10,
                    backgroundColor: '#00843D',
                  }}
                  onPress={() => navigation.navigate('MemberProfile', { member: myMP })}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Full Profile</Text>
                  <Ionicons name="chevron-forward" size={14} color="#ffffff" />
                </Pressable>
              </View>
            </View>
          ) : (
            /* Fallback: electorate found but no MP */
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14, padding: 14,
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

        {/* ═══ 4. THIS WEEK'S POLL ═══ */}
        {weeklyPoll && (
          <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
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
        )}

        {/* ═══ 5. IN THE NEWS ═══ */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <SectionHeader
            color="#1A1A1A"
            label="IN THE NEWS"
            rightLabel="See all"
            onRightPress={() => navigation.navigate('News')}
          />

          {newsStoriesLoading ? (
            <SkeletonLoader height={200} borderRadius={14} />
          ) : heroStory ? (
            <Pressable
              style={{
                backgroundColor: colors.card,
                borderRadius: 14,
                padding: 16,
                ...SHADOWS.sm,
              }}
              onPress={() => navigation.navigate('NewsStoryDetail', { story: heroStory })}
            >
              {/* TOP STORY pill + meta */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{
                  backgroundColor: '#DC2626',
                  borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 }}>TOP STORY</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>{timeAgo(heroStory.first_seen)}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                  {heroStory.article_count} source{heroStory.article_count !== 1 ? 's' : ''}
                </Text>
              </View>

              {/* Headline */}
              <Text style={{ fontSize: 19, fontWeight: '700', color: colors.text, lineHeight: 25, marginBottom: 8 }} numberOfLines={3}>
                {heroStory.headline}
              </Text>

              {/* AI summary */}
              {heroStory.ai_summary && (
                <Text style={{ fontSize: 13, color: '#4B5563', lineHeight: 19, marginBottom: 12, fontStyle: 'italic' }} numberOfLines={2}>
                  {decodeHtml(heroStory.ai_summary.replace(/^#+\s*/, ''))}
                </Text>
              )}

              {/* Coverage split bar */}
              <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                <View style={{ flex: heroStory.left_count || 0.01, backgroundColor: '#DC2626' }} />
                <View style={{ flex: heroStory.center_count || 0.01, backgroundColor: '#9CA3AF' }} />
                <View style={{ flex: heroStory.right_count || 0.01, backgroundColor: '#2563EB' }} />
              </View>

              {/* Outlet preview cards (L/C/R) */}
              {heroArticles.length > 0 && (heroLeft || heroCenter || heroRight) && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { article: heroLeft, label: 'LEFT', color: '#DC2626' },
                    { article: heroCenter, label: 'CENTRE', color: '#6B7280' },
                    { article: heroRight, label: 'RIGHT', color: '#2563EB' },
                  ].map(({ article, label, color }) => (
                    <View key={label} style={{
                      flex: 1, backgroundColor: colors.surface,
                      borderRadius: 8, padding: 8,
                      borderTopWidth: 2, borderTopColor: color,
                    }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color, letterSpacing: 0.4, marginBottom: 3 }}>
                        {label}
                      </Text>
                      {article ? (
                        <>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text, lineHeight: 14 }} numberOfLines={3}>
                            {article.title}
                          </Text>
                          <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 3 }} numberOfLines={1}>
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

              {/* Blindspot */}
              <View style={{ marginTop: 8 }}>
                <BlindspotBadge
                  leftCount={heroStory.left_count}
                  centerCount={heroStory.center_count}
                  rightCount={heroStory.right_count}
                  articleCount={heroStory.article_count}
                />
              </View>
            </Pressable>
          ) : (
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: 14, padding: 20,
              alignItems: 'center',
            }}>
              <Ionicons name="newspaper-outline" size={32} color="#9CA3AF" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 8 }}>
                Checking sources
              </Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 4 }}>
                Stories appear here once multiple outlets have covered them.
              </Text>
            </View>
          )}
        </View>

        {/* ═══ 6. QUICK ACTIONS (2x2 grid) ═══ */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { icon: 'document-text-outline' as const, label: 'Browse bills', stat: `${trendingBills.length > 0 ? '6,400+' : '--'}`, screen: 'BillList' },
              { icon: 'people-outline' as const, label: 'All MPs', stat: '225', screen: 'Explore' },
            ].map(item => (
              <Pressable
                key={item.label}
                style={{
                  flex: 1, backgroundColor: '#F8F6F1',
                  borderRadius: 14, padding: 16,
                  ...SHADOWS.sm,
                }}
                onPress={() => navigation.navigate(item.screen)}
              >
                <Ionicons name={item.icon} size={22} color="#00843D" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 10 }}>{item.label}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{item.stat}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {[
              { icon: 'git-compare-outline' as const, label: 'Compare MPs', stat: 'Side by side', screen: 'Election' },
              { icon: 'calendar-outline' as const, label: 'Elections', stat: 'Key dates', screen: 'Election' },
            ].map(item => (
              <Pressable
                key={item.label}
                style={{
                  flex: 1, backgroundColor: '#F8F6F1',
                  borderRadius: 14, padding: 16,
                  ...SHADOWS.sm,
                }}
                onPress={() => navigation.navigate(item.screen)}
              >
                <Ionicons name={item.icon} size={22} color="#00843D" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 10 }}>{item.label}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{item.stat}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ═══ 7. NOTIFICATION NUDGE ═══ */}
        {showNotifPrompt && (
          <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
            <View style={{
              backgroundColor: '#00843D',
              borderRadius: 14,
              padding: 18,
              flexDirection: 'row', alignItems: 'center', gap: 14,
            }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.2)',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name="notifications-outline" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 4 }}>
                  Never miss a vote
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 17 }}>
                  {myMP
                    ? `Get notified when ${myMP.first_name} ${myMP.last_name} votes.`
                    : 'Get your daily brief and breaking political news.'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Pressable
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8,
                    }}
                    onPress={enableNotifications}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#00843D' }}>Enable</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
                    }}
                    onPress={dismissNotifPrompt}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>Not now</Text>
                  </Pressable>
                </View>
              </View>
            </View>
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
