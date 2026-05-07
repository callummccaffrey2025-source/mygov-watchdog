import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from '../hooks/useElectorateByPostcode';
import { useCommunityPosts, CommunityPost } from '../hooks/useCommunityPosts';
import { useTheme } from '../context/ThemeContext';
import { EmptyState } from '../components/EmptyState';
import { AuthPromptSheet } from '../components/AuthPromptSheet';
import { useAuthGate } from '../hooks/useAuthGate';
import { track } from '../lib/analytics';
import { trackEvent } from '../lib/engagementTracker';
import { timeAgo } from '../lib/timeAgo';

const POST_TYPE_COLORS: Record<string, string> = {
  discussion: '#0066CC',
  question: '#7C3AED',
  issue: '#DC3545',
  event: '#D97706',
};

export function CommunityScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user, postcode } = useUser();
  const { electorate } = useElectorateByPostcode(postcode);
  const [tab, setTab] = useState<'latest' | 'top' | 'mine'>('latest');
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('device_id').then(id => setDeviceId(id));
  }, []);

  const electorateName = electorate?.name ?? null;
  const { posts, loading, refresh } = useCommunityPosts(electorateName, tab, deviceId, user?.id);
  const { requireAuth, authSheetProps } = useAuthGate();

  const renderPost = ({ item }: { item: CommunityPost }) => {
    const score = item.upvotes - item.downvotes;
    const typeColor = POST_TYPE_COLORS[item.post_type] ?? '#9aabb8';
    return (
      <Pressable
        style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('CommunityPostDetail', { postId: item.id })}
        accessibilityLabel={`Open discussion: ${item.title}`}
        accessibilityRole="button"
      >
        <View style={styles.postCardTop}>
          <View style={[styles.typePill, { backgroundColor: typeColor + '18' }]}>
            <Text style={[styles.typePillText, { color: typeColor }]}>{item.post_type}</Text>
          </View>
          {item.topic && (
            <View style={styles.topicChip}>
              <Text style={styles.topicChipText}>{item.topic}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
        <Text style={[styles.postBody, { color: colors.textBody }]} numberOfLines={2}>{item.body}</Text>
        <View style={styles.postMeta}>
          <Ionicons name="arrow-up" size={14} color={colors.textMuted} />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>{score}</Text>
          <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} style={{ marginLeft: 8 }} />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>{item.comment_count}</Text>
          <Text style={[styles.metaDot, { color: colors.textMuted }]}> · </Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>{timeAgo(item.created_at)}</Text>
        </View>
      </Pressable>
    );
  };

  if (!postcode) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.navBar}>
          {navigation.canGoBack() ? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button">
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          ) : <View style={{ width: 24 }} />}
          <Text style={[styles.navTitle, { color: colors.text }]}>Community</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Set your postcode</Text>
          <Text style={[styles.emptyBody, { color: colors.textBody }]}>
            Go to your Profile and enter your postcode to see discussions in your electorate.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Nav */}
      <View style={[styles.navBar, { borderBottomColor: colors.border }]}>
        {navigation.canGoBack() ? (
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : <View style={{ width: 24 }} />}
        <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
          {electorateName ? `${electorateName} Community` : 'Community'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['latest', 'top', 'mine'] as const).map(t => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            accessibilityLabel={`Show ${t === 'latest' ? 'Latest' : t === 'top' ? 'Top' : 'My Posts'} posts`}
            accessibilityRole="button"
          >
            <Text style={[styles.tabText, { color: tab === t ? '#00843D' : colors.textMuted }]}>
              {t === 'latest' ? 'Latest' : t === 'top' ? 'Top' : 'My Posts'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#00843D" />
      ) : (
        <FlashList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="💬"
              title="No discussions yet"
              subtitle="Be the first to start a conversation in your electorate"
              actionLabel="Start a discussion"
              onAction={() => navigation.navigate('CreateCommunityPost', { electorate: electorateName })}
            />
          }
        />
      )}

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => requireAuth('join the discussion', () => { track('discussion_post_created', { electorate: electorateName }, 'Community'); trackEvent('discussion_posted', { electorate: electorateName }); navigation.navigate('CreateCommunityPost', { electorate: electorateName }); })}
        accessibilityLabel="Create new post"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </Pressable>

      <AuthPromptSheet {...authSheetProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  navTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#00843D' },
  tabText: { fontSize: 14, fontWeight: '600' },
  list: { padding: 12, paddingBottom: 80 },
  postCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  postCardTop: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  typePill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typePillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  topicChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#00843D18' },
  topicChipText: { fontSize: 11, fontWeight: '600', color: '#00843D' },
  postTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  postBody: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  postMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 13, marginLeft: 3 },
  metaDot: { fontSize: 13 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#00843D', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
});
