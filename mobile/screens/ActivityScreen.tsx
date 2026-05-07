import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useNotifications, AppNotification } from '../hooks/useNotifications';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const ICON_MAP: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  mp_vote:         { name: 'checkmark-circle', color: '#00843D' },
  bill_update:     { name: 'document-text',    color: '#2563EB' },
  mp_post:         { name: 'megaphone',        color: '#F97316' },
  topic_news:      { name: 'newspaper',        color: '#7C3AED' },
  daily_brief:     { name: 'sunny',            color: '#00843D' },
  community_reply: { name: 'chatbubble',       color: '#0891b2' },
};

function getIcon(type: string) {
  return ICON_MAP[type] ?? { name: 'notifications' as keyof typeof Ionicons.glyphMap, color: '#9aabb8' };
}

export function ActivityScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    refresh,
  } = useNotifications();

  const handlePress = useCallback(
    async (item: AppNotification) => {
      if (!item.is_read) {
        await markRead(item.id);
      }

      const data = item.data;
      if (!data) return;

      if (data.screen === 'bill' && data.billId) {
        navigation.navigate('BillDetail', { billId: data.billId });
      } else if (data.screen === 'member' && data.memberId) {
        navigation.navigate('MemberProfile', { memberId: data.memberId });
      } else if (data.screen === 'news' && data.storyId) {
        navigation.navigate('NewsStoryDetail', { storyId: data.storyId });
      } else if (data.screen === 'DailyBrief') {
        navigation.navigate('DailyBrief');
      }
    },
    [markRead, navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => {
      const icon = getIcon(item.notification_type);
      const isUnread = !item.is_read;

      return (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => handlePress(item)}
          style={[
            styles.itemContainer,
            {
              backgroundColor: isUnread ? colors.surface : colors.card,
            },
          ]}
          accessibilityLabel={`${isUnread ? 'Unread: ' : ''}${item.title}${item.body ? `, ${item.body}` : ''}`}
          accessibilityRole="button"
        >
          {isUnread && (
            <View
              style={[
                styles.unreadDot,
                { backgroundColor: colors.green },
              ]}
            />
          )}

          <View style={[styles.iconCircle, { backgroundColor: icon.color + '18' }]}>
            <Ionicons name={icon.name} size={20} color={icon.color} />
          </View>

          <View style={styles.itemContent}>
            <Text
              style={[
                styles.itemTitle,
                {
                  color: colors.text,
                  fontWeight: isUnread ? FONT_WEIGHT.bold : FONT_WEIGHT.regular,
                },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {item.body ? (
              <Text
                style={[styles.itemBody, { color: colors.textMuted }]}
                numberOfLines={2}
              >
                {item.body}
              </Text>
            ) : null}
            <Text style={[styles.itemTime, { color: colors.textMuted }]}>
              {timeAgo(item.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, handlePress]
  );

  const renderSeparator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: colors.border }]} />,
    [colors.border]
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <EmptyState
        icon="🔔"
        title="No activity yet"
        subtitle="Notifications about your MP and electorate will appear here"
      />
    );
  }, [loading]);

  const renderSkeleton = () => (
    <View style={{ padding: SPACING.lg }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface }]}>
          <SkeletonLoader width={40} height={40} borderRadius={BORDER_RADIUS.full} />
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <SkeletonLoader width="70%" height={14} borderRadius={4} />
            <SkeletonLoader
              width="90%"
              height={12}
              borderRadius={4}
              style={{ marginTop: SPACING.sm }}
            />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Activity</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} hitSlop={8} accessibilityLabel="Mark all read" accessibilityRole="button">
            <Text style={[styles.markAllText, { color: colors.green }]}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {loading && notifications.length === 0 ? (
        renderSkeleton()
      ) : (
        <FlashList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={notifications.length === 0 ? { flex: 1 } : undefined}
          refreshControl={
            <RefreshControl
              refreshing={loading && notifications.length > 0}
              onRefresh={refresh}
              tintColor={colors.green}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

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
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.bold,
  },
  markAllText: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.semibold,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    left: SPACING.xs,
    top: '50%',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: -4,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FONT_SIZE.body,
  },
  itemBody: {
    fontSize: FONT_SIZE.small,
    marginTop: 2,
    lineHeight: 18,
  },
  itemTime: {
    fontSize: FONT_SIZE.caption,
    marginTop: SPACING.xs,
  },
  separator: {
    height: 0.5,
    marginLeft: SPACING.lg + 40 + SPACING.md, // align with text, past icon
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: SPACING.lg,
  },
  emptyBody: {
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
});
