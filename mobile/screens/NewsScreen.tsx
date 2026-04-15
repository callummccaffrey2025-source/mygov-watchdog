import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNewsStories, NewsStory } from '../hooks/useNewsStories';
import { filterPoliticalStories } from '../hooks/usePersonalisedFeed';
import { CoverageBar } from '../components/CoverageBar';
import { NewsCardSkeleton } from '../components/NewsCardSkeleton';
import { useTheme } from '../context/ThemeContext';
import { topicBg, topicText, topicIcon } from '../constants/topicColors';
import { timeAgo } from '../lib/timeAgo';

// ── Filter config ──────────────────────────────────────────────────────────────

const LEANING_FILTERS = ['All', 'Left', 'Centre', 'Right'];
const CATEGORY_FILTERS = ['Economy', 'Health', 'Defence', 'Housing', 'Climate', 'Immigration'];

const CATEGORY_SLUG_MAP: Record<string, string> = {
  Economy: 'economy', Health: 'health', Defence: 'defence',
  Housing: 'housing', Climate: 'climate', Immigration: 'immigration',
};
const LEANING_SLUG_MAP: Record<string, string | undefined> = {
  All: undefined, Left: 'left', Centre: 'center', Right: 'right',
};

// ── Story Card ─────────────────────────────────────────────────────────────────

function StoryCard({ story, onPress }: { story: NewsStory; onPress: () => void }) {
  const { colors } = useTheme();
  const cat = story.category;
  return (
    <Pressable
      style={({ pressed }) => [styles.storyCard, { backgroundColor: colors.card }, pressed && { opacity: 0.87 }]}
      onPress={onPress}
    >
      <View style={styles.storyCardTop}>
        <View style={[styles.catBadge, { backgroundColor: topicBg(cat) }]}>
          <Text style={[styles.catBadgeText, { color: topicText(cat) }]}>
            {(cat ?? 'politics').toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.timeAgo, { color: colors.textMuted }]}>{timeAgo(story.first_seen)}</Text>
      </View>
      <View style={styles.storyBody}>
        <Text style={[styles.storyHeadline, { color: colors.text, flex: story.image_url ? 1 : undefined }]} numberOfLines={3}>{story.headline}</Text>
        {story.image_url ? (
          <Image source={{ uri: story.image_url }} style={styles.storyThumbnail} />
        ) : (
          <View style={[styles.storyThumbnailPlaceholder, { backgroundColor: topicBg(cat) }]}>
            <Text style={[styles.storyThumbnailIcon, { color: topicText(cat) }]}>
              {topicIcon(cat)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.coverageBarWrap}>
        <CoverageBar
          left={story.left_count}
          center={story.center_count}
          right={story.right_count}
          height={8}
        />
      </View>
      <View style={styles.storyCardBottom}>
        <View style={styles.leaningDots}>
          {story.left_count > 0 && <View style={[styles.leaningDot, { backgroundColor: '#4C9BE8' }]} />}
          {story.center_count > 0 && <View style={[styles.leaningDot, { backgroundColor: '#9aabb8' }]} />}
          {story.right_count > 0 && <View style={[styles.leaningDot, { backgroundColor: '#DC3545' }]} />}
        </View>
        <Text style={[styles.sourceCount, { color: colors.textMuted }]}>
          Covered by {story.article_count} source{story.article_count !== 1 ? 's' : ''}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export function NewsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeLeaning, setActiveLeaning] = useState('All');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const leaningSlug = LEANING_SLUG_MAP[activeLeaning];
  const categorySlug = activeCategory ? CATEGORY_SLUG_MAP[activeCategory] : undefined;

  const { stories: rawStories, loading, refresh } = useNewsStories(leaningSlug, categorySlug);
  const stories = filterPoliticalStories(rawStories);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.cardAlt }]} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>News</Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {LEANING_FILTERS.map(f => (
            <Pressable
              key={f}
              style={[styles.pill, activeLeaning === f && styles.pillActive, !( activeLeaning === f) && { borderColor: colors.border }]}
              onPress={() => setActiveLeaning(f)}
            >
              <Text style={[styles.pillText, { color: colors.textBody }, activeLeaning === f && styles.pillTextActive]}>{f}</Text>
            </Pressable>
          ))}
          <View style={[styles.pillDivider, { backgroundColor: colors.border }]} />
          {CATEGORY_FILTERS.map(f => {
            const isActive = activeCategory === f;
            return (
              <Pressable
                key={f}
                style={[styles.pill, isActive && styles.pillActive, !isActive && { borderColor: colors.border }]}
                onPress={() => setActiveCategory(isActive ? null : f)}
              >
                <Text style={[styles.pillText, { color: colors.textBody }, isActive && styles.pillTextActive]}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Story list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00843D" />
        }
      >
        {loading ? (
          [1, 2, 3, 4, 5].map(i => <NewsCardSkeleton key={i} />)
        ) : stories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="newspaper-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textBody }]}>No stories found</Text>
            <Text style={[styles.emptySubText, { color: colors.textMuted }]}>Try a different filter or check back soon</Text>
          </View>
        ) : (
          stories.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              onPress={() => navigation.navigate('NewsStoryDetail', { story })}
            />
          ))
        )}
        {!loading && stories.length > 0 && (
          <Text style={[styles.sourceNote, { color: colors.textMuted }]}>
            Only stories covered by 5+ news sources are shown to ensure balanced perspective.
          </Text>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFBFC' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a2332',
  },

  filtersWrap: { marginBottom: 8 },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
    paddingBottom: 4,
  },
  pill: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  pillActive: { backgroundColor: '#00843D', borderColor: '#00843D' },
  pillText: { fontSize: 13, fontWeight: '600', color: '#5a6a7a' },
  pillTextActive: { color: '#ffffff' },
  pillDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },

  scroll: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 4 },

  storyCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  storyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  catBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeAgo: { fontSize: 11, color: '#9aabb8' },
  storyBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  storyHeadline: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a2332',
    lineHeight: 23,
  },
  storyThumbnail: { width: 72, height: 72, borderRadius: 8, flexShrink: 0, backgroundColor: '#f3f4f6' },
  storyThumbnailPlaceholder: { width: 72, height: 72, borderRadius: 8, flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  storyThumbnailIcon: { fontSize: 28 },
  coverageBarWrap: { marginBottom: 10 },
  storyCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaningDots: { flexDirection: 'row', gap: 4, marginRight: 2 },
  leaningDot: { width: 8, height: 8, borderRadius: 4 },
  sourceCount: { flex: 1, fontSize: 12, color: '#9aabb8' },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#5a6a7a' },
  emptySubText: { fontSize: 13, color: '#9aabb8', textAlign: 'center' },
  sourceNote: {
    fontSize: 11, color: '#9aabb8', textAlign: 'center',
    paddingHorizontal: 20, paddingBottom: 8,
  },
});
