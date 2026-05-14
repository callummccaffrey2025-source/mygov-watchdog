import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSavedItems, SaveContentType, SavedItem } from '../hooks/useSaves';
import { supabase } from '../lib/supabase';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';

type FilterTab = 'all' | 'bill' | 'vote';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bill', label: 'Bills' },
  { key: 'vote', label: 'Votes' },
];

const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  bill:       { label: 'BILL', color: '#16a34a' },
  vote:       { label: 'VOTE', color: '#7c3aed' },
  post:       { label: 'POST', color: '#ea580c' },
};

// ── Title fetching ───────────────────────────────────────────────────────────

async function fetchTitles(items: SavedItem[]): Promise<Record<string, string>> {
  const titles: Record<string, string> = {};
  if (items.length === 0) return titles;

  // Group by content_type
  const groups: Record<string, string[]> = {};
  for (const item of items) {
    if (!groups[item.content_type]) groups[item.content_type] = [];
    groups[item.content_type].push(item.content_id);
  }

  const fetches: Promise<void>[] = [];


  if (groups['bill']?.length) {
    fetches.push(
      Promise.resolve(
        supabase
          .from('bills')
          .select('id, short_title, title')
          .in('id', groups['bill'])
      ).then(({ data }) => {
        data?.forEach((r: any) => { titles[`bill:${r.id}`] = r.short_title || r.title; });
      })
    );
  }

  if (groups['vote']?.length) {
    fetches.push(
      Promise.resolve(
        supabase
          .from('divisions')
          .select('id, name')
          .in('id', groups['vote'])
      ).then(({ data }) => {
        data?.forEach((r: any) => { titles[`vote:${r.id}`] = r.name; });
      })
    );
  }

  if (groups['post']?.length) {
    fetches.push(
      Promise.resolve(
        supabase
          .from('community_posts')
          .select('id, title')
          .in('id', groups['post'])
      ).then(({ data }) => {
        data?.forEach((r: any) => { titles[`post:${r.id}`] = r.title; });
      })
    );
  }

  await Promise.all(fetches);
  return titles;
}

// ── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard({ colors }: { colors: any }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, SHADOWS.sm]}>
      <View style={styles.cardTop}>
        <SkeletonLoader width={48} height={18} borderRadius={BORDER_RADIUS.sm} />
        <SkeletonLoader width={60} height={13} borderRadius={4} />
      </View>
      <SkeletonLoader width="90%" height={16} borderRadius={4} style={{ marginTop: SPACING.sm }} />
      <SkeletonLoader width="60%" height={16} borderRadius={4} style={{ marginTop: SPACING.xs }} />
    </View>
  );
}

// ── Saved item card ──────────────────────────────────────────────────────────

function SavedCard({
  item,
  title,
  colors,
  onPress,
}: {
  item: SavedItem;
  title: string | undefined;
  colors: any;
  onPress: () => void;
}) {
  const badge = BADGE_CONFIG[item.content_type] ?? { label: item.content_type.toUpperCase(), color: '#6b7280' };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card },
        SHADOWS.sm,
        pressed && { opacity: 0.92 },
      ]}
      accessibilityLabel={`Open saved ${badge.label.toLowerCase()}: ${title ?? 'loading'}`}
      accessibilityRole="button"
    >
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: badge.color + '18' }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
        <Text style={[styles.savedTime, { color: colors.textMuted }]}>
          Saved {timeAgo(item.created_at)}
        </Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {title ?? 'Loading...'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export function SavedScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const contentType: SaveContentType | undefined = activeTab === 'all' ? undefined : activeTab;
  const { items, loading, refresh } = useSavedItems(contentType);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [titlesLoading, setTitlesLoading] = useState(false);

  // Batch-fetch titles whenever items change
  useEffect(() => {
    if (items.length === 0) { setTitles({}); return; }
    let cancelled = false;
    setTitlesLoading(true);
    fetchTitles(items).then((result) => {
      if (!cancelled) {
        setTitles(result);
        setTitlesLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [items]);

  const handlePress = (item: SavedItem) => {
    switch (item.content_type) {
      case 'bill':
        navigation.navigate('BillDetail', { billId: item.content_id });
        break;
      case 'vote':
        navigation.navigate('BillDetail', { divisionId: item.content_id });
        break;
      case 'post':
        navigation.navigate('CommunityPostDetail', { postId: item.content_id });
        break;
    }
  };

  const renderItem = ({ item }: { item: SavedItem }) => (
    <SavedCard
      item={item}
      title={titles[`${item.content_type}:${item.content_id}`]}
      colors={colors}
      onPress={() => handlePress(item)}
    />
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <EmptyState
        icon="📌"
        title="Nothing saved yet"
        subtitle="Tap the bookmark icon on any article to save it here"
      />
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter tabs */}
      <View style={styles.tabRow}>
        {FILTER_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? colors.green : colors.cardAlt,
                },
              ]}
              accessibilityLabel={`Filter by ${tab.label}`}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? '#ffffff' : colors.textBody },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} colors={colors} />
          ))}
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.green} />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.bold,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tab: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  tabText: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.semibold,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.5,
  },
  savedTime: {
    fontSize: FONT_SIZE.small,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
});
