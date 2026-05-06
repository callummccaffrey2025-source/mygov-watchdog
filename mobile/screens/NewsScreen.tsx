import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNewsStories, NewsStory } from '../hooks/useNewsStories';
import { filterPoliticalStories } from '../hooks/usePersonalisedFeed';
import { useBlindspots, BlindspotCategory } from '../hooks/useBlindspots';
import { NewsCardSkeleton } from '../components/NewsCardSkeleton';
import { EnhancedStoryCard } from '../components/EnhancedStoryCard';
import { useTheme } from '../context/ThemeContext';
import { timeAgo } from '../lib/timeAgo';

const LEANING_FILTERS = ['All', 'Left', 'Centre', 'Right'];
const CATEGORY_FILTERS = ['Economy', 'Health', 'Defence', 'Housing', 'Climate', 'Immigration'];

const CATEGORY_SLUG_MAP: Record<string, string> = {
  Economy: 'economy', Health: 'health', Defence: 'defence',
  Housing: 'housing', Climate: 'climate', Immigration: 'immigration',
};
const LEANING_SLUG_MAP: Record<string, string | undefined> = {
  All: undefined, Left: 'left', Centre: 'center', Right: 'right',
};

type TopTab = 'feed' | 'blindspots';

const BLINDSPOT_TABS: { key: BlindspotCategory; label: string; description: string }[] = [
  { key: 'left',           label: 'Left blindspots',           description: 'Right + centre covered, no left-leaning outlets' },
  { key: 'right',          label: 'Right blindspots',          description: 'Left + centre covered, no right-leaning outlets' },
  { key: 'establishment',  label: 'Establishment blindspots',  description: 'Only independent outlets covered this' },
  { key: 'parliamentary',  label: 'Parliamentary blindspots',  description: 'Significant parliamentary events with zero news coverage' },
  { key: 'mp',             label: 'MP blindspots',             description: 'Highly active MPs with zero media mentions in 30 days' },
];

// ── Main screen ────────────────────────────────────────────────────────────────

export function NewsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [topTab, setTopTab] = useState<TopTab>('feed');
  const [activeLeaning, setActiveLeaning] = useState('All');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [blindspotCat, setBlindspotCat] = useState<BlindspotCategory>('left');

  const leaningSlug = LEANING_SLUG_MAP[activeLeaning];
  const categorySlug = activeCategory ? CATEGORY_SLUG_MAP[activeCategory] : undefined;

  const { stories: rawStories, loading, refresh } = useNewsStories(leaningSlug, categorySlug);
  const stories = filterPoliticalStories(rawStories);
  const [refreshing, setRefreshing] = useState(false);

  const { stories: blindspotStories, parliamentary, mps, loading: blindspotLoading } = useBlindspots(blindspotCat);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 10 }}>
        {navigation.canGoBack() && (
          <Pressable
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        )}
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>News</Text>
      </View>

      {/* Top tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, marginBottom: 8 }}>
        {[
          { key: 'feed' as TopTab, label: 'Feed', icon: 'newspaper-outline' },
          { key: 'blindspots' as TopTab, label: 'Blindspots', icon: 'eye-off-outline' },
        ].map(tab => {
          const active = topTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={{
                flex: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderBottomWidth: 2,
                borderBottomColor: active ? '#00843D' : 'transparent',
              }}
              onPress={() => setTopTab(tab.key)}
              accessibilityLabel={`${tab.label} tab`}
              accessibilityRole="button"
            >
              <Ionicons name={tab.icon as any} size={16} color={active ? '#00843D' : colors.textMuted} />
              <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? '#00843D' : colors.textBody }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Feed tab content */}
      {topTab === 'feed' && (
        <>
          {/* Filters */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 20 }}
            >
              {LEANING_FILTERS.map(f => {
                const active = activeLeaning === f;
                return (
                  <Pressable
                    key={f}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: active ? '#00843D' : 'transparent',
                      borderWidth: 1, borderColor: active ? '#00843D' : colors.border,
                    }}
                    onPress={() => setActiveLeaning(f)}
                    accessibilityLabel={`Filter by ${f} leaning`}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.textBody }}>{f}</Text>
                  </Pressable>
                );
              })}
              <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 4 }} />
              {CATEGORY_FILTERS.map(f => {
                const active = activeCategory === f;
                return (
                  <Pressable
                    key={f}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                      backgroundColor: active ? '#00843D' : 'transparent',
                      borderWidth: 1, borderColor: active ? '#00843D' : colors.border,
                    }}
                    onPress={() => setActiveCategory(active ? null : f)}
                    accessibilityLabel={`Filter by ${f}`}
                    accessibilityRole="button"
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.textBody }}>{f}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00843D" />}
          >
            {loading ? (
              [1, 2, 3, 4, 5].map(i => <NewsCardSkeleton key={i} />)
            ) : stories.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 12 }}>
                <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
                <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
                  Nothing to show yet
                </Text>
                <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center', lineHeight: 22 }}>
                  News coverage of Australian politics is updated continuously. Check back soon for the latest stories.
                </Text>
                <Pressable
                  style={{ backgroundColor: '#00843D', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 }}
                  onPress={handleRefresh}
                  accessibilityLabel="Refresh news"
                  accessibilityRole="button"
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>Refresh</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {stories.map(story => (
                  <EnhancedStoryCard
                    key={story.id}
                    story={story}
                    onPress={() => navigation.navigate('NewsStoryDetail', { story })}
                  />
                ))}
                {stories.length < 5 && (
                  <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 32, gap: 10, marginTop: 8 }}>
                    <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
                    <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
                      That's all for now
                    </Text>
                    <Text style={{ fontSize: 15, color: colors.textBody, textAlign: 'center', lineHeight: 22 }}>
                      News coverage of Australian politics is updated continuously. Check back soon for the latest stories.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Blindspots tab content */}
      {topTab === 'blindspots' && (
        <>
          {/* Blindspot category pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}
            style={{ maxHeight: 44 }}
          >
            {BLINDSPOT_TABS.map(bt => {
              const active = blindspotCat === bt.key;
              return (
                <Pressable
                  key={bt.key}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: active ? '#D97706' : 'transparent',
                    borderWidth: 1, borderColor: active ? '#D97706' : colors.border,
                  }}
                  onPress={() => setBlindspotCat(bt.key)}
                  accessibilityLabel={`Filter by ${bt.label}`}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.textBody }}>
                    {bt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Description banner */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Ionicons name="eye-off-outline" size={16} color="#D97706" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 }}>
                {BLINDSPOT_TABS.find(b => b.key === blindspotCat)?.description}
              </Text>
            </View>

            {blindspotLoading ? (
              [1, 2, 3].map(i => <NewsCardSkeleton key={i} />)
            ) : blindspotCat === 'parliamentary' ? (
              parliamentary.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: colors.textBody }}>No parliamentary blindspots detected</Text>
                </View>
              ) : (
                parliamentary.map(item => (
                  <View key={item.id} style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <View style={{ backgroundColor: item.type === 'division' ? '#EEF2FF' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: item.type === 'division' ? '#4338CA' : '#92400E' }}>
                          {item.type === 'division' ? 'DIVISION' : 'SPEECH'}
                        </Text>
                      </View>
                      {item.chamber && <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{item.chamber}</Text>}
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto' }}>{timeAgo(item.date)}</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 21 }} numberOfLines={3}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' }}>
                      No news coverage detected
                    </Text>
                  </View>
                ))
              )
            ) : blindspotCat === 'mp' ? (
              mps.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: colors.textBody }}>No MP blindspots detected</Text>
                </View>
              ) : (
                mps.map(mp => (
                  <Pressable
                    key={mp.id}
                    style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    onPress={() => navigation.navigate('MemberProfile', { memberId: mp.id })}
                    accessibilityLabel={`View profile of ${mp.name}`}
                    accessibilityRole="button"
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="person-outline" size={20} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{mp.name}</Text>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>
                        {mp.party ?? 'Independent'} · {mp.activity_count} speech{mp.activity_count !== 1 ? 'es' : ''} in last 30 days
                      </Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' }}>
                        Zero media mentions
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))
              )
            ) : blindspotStories.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 14, color: colors.textBody }}>No blindspots detected in this category</Text>
              </View>
            ) : (
              blindspotStories.map(story => (
                <EnhancedStoryCard
                  key={story.id}
                  story={story}
                  onPress={() => navigation.navigate('NewsStoryDetail', { story })}
                />
              ))
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
