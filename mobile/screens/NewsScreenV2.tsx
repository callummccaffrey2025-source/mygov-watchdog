import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  RefreshControl,
  ScrollView,
  Modal,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNewsStories, NewsStory } from '../hooks/useNewsStories';
import { filterPoliticalStories } from '../hooks/usePersonalisedFeed';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { EnhancedStoryCard } from '../components/EnhancedStoryCard';
import { NewsCardSkeleton } from '../components/NewsCardSkeleton';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

// ── Types ──────────────────────────────────────────────────────────────────────

type TabKey = 'for_you' | 'electorate' | 'issues' | 'mp' | 'trending';
type LeaningFilter = 'all' | 'left' | 'centre' | 'right';

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { key: 'for_you', label: 'For you', icon: 'sparkles-outline' },
  { key: 'electorate', label: 'Your electorate', icon: 'location-outline' },
  { key: 'issues', label: 'Your issues', icon: 'pricetag-outline' },
  { key: 'mp', label: 'Your MP', icon: 'person-outline' },
  { key: 'trending', label: 'Trending', icon: 'trending-up-outline' },
];

const LEANING_OPTIONS: { key: LeaningFilter; label: string }[] = [
  { key: 'all', label: 'All perspectives' },
  { key: 'left', label: 'Left-leaning' },
  { key: 'centre', label: 'Centre' },
  { key: 'right', label: 'Right-leaning' },
];

// ── Scoring & partitioning ─────────────────────────────────────────────────────

interface ScoredStory {
  story: NewsStory;
  score: number;
  reason: string | null;
}

function scoreAndPartition(
  stories: NewsStory[],
  electorate: string | null,
  mpName: string | null,
  state: string | null,
  followedTopics: string[],
): {
  forYou: NewsStory[];
  electorateStories: NewsStory[];
  issueStories: NewsStory[];
  mpStories: NewsStory[];
  trending: NewsStory[];
  relevanceReasons: Map<number, string>;
} {
  const topicSet = new Set(followedTopics.map(t => t.toLowerCase()));
  const relevanceReasons = new Map<number, string>();

  const electorateStories: NewsStory[] = [];
  const issueStories: NewsStory[] = [];
  const mpStories: NewsStory[] = [];
  const scored: ScoredStory[] = [];

  for (const story of stories) {
    const hl = (story.headline || '').toLowerCase();
    let score = 0;
    let reason: string | null = null;

    // Issue / topic match
    const cat = (story.category || '').toLowerCase();
    if (cat && topicSet.has(cat)) {
      score += 30;
      const displayTopic = cat.replace(/_/g, ' ');
      reason = `Your issue: ${displayTopic}`;
      issueStories.push(story);
    }

    // MP match
    if (mpName && hl.includes(mpName.toLowerCase())) {
      score += 25;
      reason = `Because you follow ${mpName}`;
      mpStories.push(story);
    }

    // Electorate match
    if (electorate && hl.includes(electorate.toLowerCase())) {
      score += 20;
      if (!reason) reason = 'Your electorate';
      electorateStories.push(story);
    }

    // Housing boost (universally relevant)
    if (hl.includes('housing') || hl.includes('rent') || hl.includes('mortgage')) {
      score += 15;
    }

    // State match
    if (state) {
      const stateLower = state.toLowerCase();
      const stateNames: Record<string, string> = {
        nsw: 'new south wales', vic: 'victoria', qld: 'queensland',
        wa: 'western australia', sa: 'south australia', tas: 'tasmania',
        act: 'australian capital territory', nt: 'northern territory',
      };
      if (hl.includes(stateLower) || (stateNames[stateLower] && hl.includes(stateNames[stateLower]))) {
        score += 10;
      }
    }

    // Source count boost
    score += Math.min(Math.floor(story.article_count / 5), 10);

    // Freshness decay: lose 2 points per day old
    const ageMs = Date.now() - new Date(story.first_seen).getTime();
    const ageDays = ageMs / 86_400_000;
    score -= Math.floor(ageDays * 2);

    if (reason) {
      relevanceReasons.set(story.id, reason);
    }

    scored.push({ story, score, reason });
  }

  // For You: sorted by personalised score
  const forYou = scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.story);

  // Trending: sorted purely by article_count descending
  const trending = [...stories].sort((a, b) => b.article_count - a.article_count);

  return { forYou, electorateStories, issueStories, mpStories, trending, relevanceReasons };
}

function applyLeaningFilter(stories: NewsStory[], leaning: LeaningFilter): NewsStory[] {
  if (leaning === 'all') return stories;
  return stories.filter(s => {
    if (leaning === 'left') return s.left_count > 0;
    if (leaning === 'centre') return s.center_count > 0;
    if (leaning === 'right') return s.right_count > 0;
    return true;
  });
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function NewsScreenV2({ navigation }: any) {
  const { colors } = useTheme();
  const { postcode } = useUser();
  const { electorate, member } = useElectorateByPostcode(postcode);

  const [activeTab, setActiveTab] = useState<TabKey>('for_you');
  const [leaning, setLeaning] = useState<LeaningFilter>('all');
  const [showLeaningSheet, setShowLeaningSheet] = useState(false);
  const [followedTopics, setFollowedTopics] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { stories: rawStories, loading, refresh } = useNewsStories();
  const politicalStories = useMemo(() => filterPoliticalStories(rawStories), [rawStories]);

  // Load user's followed topics from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('selected_topics').then(raw => {
      if (raw) {
        try { setFollowedTopics(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const mpName = member ? `${(member as any).first_name} ${(member as any).last_name}` : null;
  const electorateName = electorate?.name ?? null;
  const electorateState = electorate?.state ?? null;

  const {
    forYou, electorateStories, issueStories, mpStories, trending, relevanceReasons,
  } = useMemo(
    () => scoreAndPartition(politicalStories, electorateName, mpName, electorateState, followedTopics),
    [politicalStories, electorateName, mpName, electorateState, followedTopics],
  );

  // Get feed for active tab, apply leaning filter
  const currentFeed = useMemo(() => {
    let base: NewsStory[];
    switch (activeTab) {
      case 'for_you': base = forYou; break;
      case 'electorate': base = electorateStories; break;
      case 'issues': base = issueStories; break;
      case 'mp': base = mpStories; break;
      case 'trending': base = trending; break;
      default: base = forYou;
    }
    return applyLeaningFilter(base, leaning);
  }, [activeTab, forYou, electorateStories, issueStories, mpStories, trending, leaning]);

  // Pinned electorate card for "For you" tab
  const pinnedElectorateStory = useMemo(() => {
    if (activeTab !== 'for_you') return null;
    if (electorateStories.length > 0) return electorateStories[0];
    return null;
  }, [activeTab, electorateStories]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const tabScrollRef = useRef<ScrollView>(null);

  // ── Empty state messages ─────────────────────────────────────────────────────

  const emptyState = useMemo(() => {
    switch (activeTab) {
      case 'electorate':
        if (!postcode) return { icon: 'location-outline' as const, title: 'Set your postcode', body: 'Add your postcode in Profile to see stories about your electorate.', action: () => navigation.navigate('Profile') };
        return { icon: 'location-outline' as const, title: 'No electorate stories today', body: 'We haven\'t found stories mentioning your electorate recently. Check back later.', action: null };
      case 'issues':
        return { icon: 'pricetag-outline' as const, title: 'No stories matching your issues', body: 'We haven\'t found stories matching your issues today. Add more issues?', action: () => navigation.navigate('ManageTopics') };
      case 'mp':
        if (!mpName) return { icon: 'person-outline' as const, title: 'Set your postcode', body: 'Add your postcode in Profile so we can find your MP.', action: () => navigation.navigate('Profile') };
        return { icon: 'person-outline' as const, title: `No stories about ${mpName}`, body: `We haven't found recent stories mentioning ${mpName}. Check back later.`, action: null };
      default:
        return { icon: 'newspaper-outline' as const, title: 'Nothing to show yet', body: 'News coverage of Australian politics is updated continuously. Check back soon.', action: null };
    }
  }, [activeTab, postcode, mpName]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderRelevancePrefix = (storyId: number) => {
    const reason = relevanceReasons.get(storyId);
    if (!reason) return null;

    const isBlue = reason.startsWith('Because you follow');
    return (
      <Text style={{
        fontSize: FONT_SIZE.caption,
        fontWeight: FONT_WEIGHT.semibold,
        color: isBlue ? '#2563EB' : colors.green,
        marginBottom: SPACING.xs,
      }}>
        {reason}
      </Text>
    );
  };

  const renderPinnedCard = () => {
    if (!pinnedElectorateStory || !electorateName) return null;
    return (
      <Pressable
        style={{
          backgroundColor: colors.card,
          borderRadius: BORDER_RADIUS.lg,
          borderLeftWidth: 4,
          borderLeftColor: colors.green,
          padding: SPACING.lg,
          marginHorizontal: SPACING.lg,
          marginBottom: SPACING.md,
          ...SHADOWS.md,
        }}
        onPress={() => navigation.navigate('NewsStoryDetail', { story: pinnedElectorateStory })}
        accessibilityRole="button"
        accessibilityLabel={`Electorate story: ${pinnedElectorateStory.headline}`}
      >
        <View style={{
          backgroundColor: colors.greenBg,
          paddingHorizontal: SPACING.sm,
          paddingVertical: SPACING.xs,
          borderRadius: BORDER_RADIUS.sm,
          alignSelf: 'flex-start',
          marginBottom: SPACING.sm,
        }}>
          <Text style={{
            fontSize: FONT_SIZE.caption,
            fontWeight: FONT_WEIGHT.bold,
            color: colors.green,
            letterSpacing: 0.4,
          }}>
            IN {electorateName.toUpperCase()} TODAY
          </Text>
        </View>
        <Text style={{
          fontSize: FONT_SIZE.subtitle,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.text,
          lineHeight: 22,
        }} numberOfLines={3}>
          {pinnedElectorateStory.headline}
        </Text>
        <Text style={{
          fontSize: FONT_SIZE.small,
          color: colors.textMuted,
          marginTop: SPACING.xs,
        }}>
          {timeAgo(pinnedElectorateStory.first_seen)}
        </Text>
      </Pressable>
    );
  };

  const renderStoryItem = useCallback(({ item }: { item: NewsStory }) => {
    return (
      <View style={{ paddingHorizontal: SPACING.lg }}>
        {renderRelevancePrefix(item.id)}
        <EnhancedStoryCard
          story={item}
          onPress={() => navigation.navigate('NewsStoryDetail', { story: item })}
        />
      </View>
    );
  }, [relevanceReasons, navigation, colors]);

  const renderEmpty = () => (
    <View style={{
      alignItems: 'center',
      paddingVertical: SPACING.xxxl + SPACING.lg,
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.md,
    }}>
      <Ionicons name={emptyState.icon as any} size={48} color={colors.textMuted} />
      <Text style={{
        fontSize: FONT_SIZE.subtitle,
        fontWeight: FONT_WEIGHT.semibold,
        color: colors.text,
        textAlign: 'center',
      }}>
        {emptyState.title}
      </Text>
      <Text style={{
        fontSize: FONT_SIZE.body,
        color: colors.textBody,
        textAlign: 'center',
        lineHeight: 22,
      }}>
        {emptyState.body}
      </Text>
      {emptyState.action && (
        <Pressable
          style={{
            backgroundColor: colors.green,
            borderRadius: BORDER_RADIUS.md,
            paddingHorizontal: SPACING.xl,
            paddingVertical: SPACING.md,
            marginTop: SPACING.sm,
          }}
          onPress={emptyState.action}
          accessibilityRole="button"
          accessibilityLabel={activeTab === 'issues' ? 'Manage issues' : 'Go to profile'}
        >
          <Text style={{
            color: '#FFFFFF',
            fontSize: FONT_SIZE.body,
            fontWeight: FONT_WEIGHT.semibold,
          }}>
            {activeTab === 'issues' ? 'Manage issues' : 'Go to profile'}
          </Text>
        </Pressable>
      )}
    </View>
  );

  const renderHeader = () => {
    if (activeTab !== 'for_you') return null;
    return renderPinnedCard();
  };

  // ── Leaning filter sheet (modal) ─────────────────────────────────────────────

  const renderLeaningSheet = () => (
    <Modal
      visible={showLeaningSheet}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLeaningSheet(false)}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
        onPress={() => setShowLeaningSheet(false)}
        accessibilityRole="button"
        accessibilityLabel="Close filter sheet"
      >
        <Pressable
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: BORDER_RADIUS.xl,
            borderTopRightRadius: BORDER_RADIUS.xl,
            paddingTop: SPACING.xl,
            paddingBottom: SPACING.xxxl,
            paddingHorizontal: SPACING.xl,
          }}
          onPress={() => {}}
          accessibilityRole="button"
          accessibilityLabel="Filter options"
        >
          <View style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: SPACING.lg,
          }} />
          <Text style={{
            fontSize: FONT_SIZE.title,
            fontWeight: FONT_WEIGHT.bold,
            color: colors.text,
            marginBottom: SPACING.lg,
          }}>
            Filter by perspective
          </Text>
          {LEANING_OPTIONS.map(opt => {
            const active = leaning === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.md,
                  borderRadius: BORDER_RADIUS.md,
                  backgroundColor: active ? colors.greenBg : 'transparent',
                  marginBottom: SPACING.xs,
                }}
                onPress={() => {
                  setLeaning(opt.key);
                  setShowLeaningSheet(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${opt.label}`}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: active ? colors.green : colors.border,
                  marginRight: SPACING.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  {active && (
                    <View style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors.green,
                    }} />
                  )}
                </View>
                <Text style={{
                  fontSize: FONT_SIZE.body,
                  fontWeight: active ? FONT_WEIGHT.semibold : FONT_WEIGHT.regular,
                  color: active ? colors.green : colors.text,
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl - 4,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.md,
      }}>
        {navigation.canGoBack() && (
          <Pressable
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.cardAlt,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: SPACING.sm,
            }}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        )}
        <Text style={{
          flex: 1,
          fontSize: FONT_SIZE.heading - 2,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.text,
        }}>
          News
        </Text>
        <Pressable
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: leaning !== 'all' ? colors.greenBg : colors.cardAlt,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setShowLeaningSheet(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Filter by perspective"
        >
          <Ionicons
            name="funnel-outline"
            size={18}
            color={leaning !== 'all' ? colors.green : colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Tab pills */}
      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          paddingBottom: SPACING.md,
          gap: SPACING.sm,
        }}
        style={{ flexGrow: 0 }}
      >
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: SPACING.xs + 2,
                paddingHorizontal: SPACING.lg,
                paddingVertical: SPACING.sm,
                borderRadius: BORDER_RADIUS.full,
                backgroundColor: active ? colors.green : 'transparent',
                borderWidth: 1,
                borderColor: active ? colors.green : colors.border,
              }}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={`${tab.label} tab`}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={active ? '#FFFFFF' : colors.textBody}
              />
              <Text style={{
                fontSize: FONT_SIZE.small,
                fontWeight: active ? FONT_WEIGHT.semibold : FONT_WEIGHT.medium,
                color: active ? '#FFFFFF' : colors.textBody,
              }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Active leaning indicator */}
      {leaning !== 'all' && (
        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: SPACING.xs,
            marginHorizontal: SPACING.lg,
            marginBottom: SPACING.sm,
            paddingHorizontal: SPACING.md,
            paddingVertical: SPACING.xs + 2,
            backgroundColor: colors.greenBg,
            borderRadius: BORDER_RADIUS.sm,
            alignSelf: 'flex-start',
          }}
          onPress={() => setShowLeaningSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="Change perspective filter"
        >
          <Ionicons name="funnel" size={12} color={colors.green} />
          <Text style={{
            fontSize: FONT_SIZE.caption,
            fontWeight: FONT_WEIGHT.semibold,
            color: colors.green,
          }}>
            {LEANING_OPTIONS.find(o => o.key === leaning)?.label}
          </Text>
          <Pressable
            onPress={() => setLeaning('all')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear perspective filter"
          >
            <Ionicons name="close-circle" size={14} color={colors.green} />
          </Pressable>
        </Pressable>
      )}

      {/* Story list */}
      {loading ? (
        <View style={{ padding: SPACING.lg }}>
          {[1, 2, 3, 4, 5].map(i => <NewsCardSkeleton key={i} />)}
        </View>
      ) : (
        <FlashList
          data={currentFeed}
          keyExtractor={item => String(item.id)}
          renderItem={renderStoryItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: SPACING.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.green}
            />
          }
        />
      )}

      {renderLeaningSheet()}
    </SafeAreaView>
  );
}
