import React, { useCallback } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWatchlist, WatchlistItem } from '../hooks/useWatchlist';
import { useFollow } from '../hooks/useFollow';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { EmptyState } from '../components/EmptyState';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';
import { hapticLight } from '../lib/haptics';

// ── Watchlist Item Card ─────────────────────────────────────────────────

const WatchlistCard = React.memo(function WatchlistCard({
  item,
  onPress,
  colors,
}: {
  item: WatchlistItem;
  onPress: () => void;
  colors: any;
}) {
  const iconColor = item.entity_type === 'member' ? '#2563EB'
    : item.entity_type === 'bill' ? '#00843D'
    : '#F59E0B';

  const iconBg = iconColor + '1F'; // 12% tint of the type colour — works on both schemes

  const typeLabel = item.entity_type === 'member' ? 'MP'
    : item.entity_type === 'bill' ? 'BILL'
    : 'TOPIC';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.label}`}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginHorizontal: 20,
        marginBottom: SPACING.md,
        opacity: pressed ? 0.92 : 1,
        ...SHADOWS.sm,
      })}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
        {/* Icon */}
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: iconBg,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name={item.icon as any} size={20} color={iconColor} />
        </View>

        {/* Label + subtitle */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
            <Text style={{
              fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold,
              color: colors.text, flex: 1,
            }} numberOfLines={1}>
              {item.label}
            </Text>
            {item.hasNewActivity && (
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: '#DC3545',
              }} />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 }}>
            <View style={{
              backgroundColor: iconBg,
              borderRadius: 4,
              paddingHorizontal: 5, paddingVertical: 1,
            }}>
              <Text style={{
                fontSize: 9, fontWeight: FONT_WEIGHT.bold,
                color: iconColor, letterSpacing: 0.5,
              }}>
                {typeLabel}
              </Text>
            </View>
            <Text style={{
              fontSize: FONT_SIZE.small, color: colors.textMuted,
            }} numberOfLines={1}>
              {item.subtitle}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>

      {/* Activity timeline */}
      {item.activity.length > 0 && (
        <View style={{
          marginTop: SPACING.md,
          paddingTop: SPACING.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
          <Text style={{
            fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold,
            color: colors.textMuted, letterSpacing: 0.5,
            marginBottom: SPACING.sm,
          }}>
            LATEST ACTIVITY
          </Text>
          {item.activity.slice(0, 3).map((act, i) => (
            <View
              key={act.id}
              style={{
                flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
                paddingVertical: SPACING.xs,
              }}
            >
              {/* Timeline dot */}
              <View style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: act.type === 'vote'
                  ? (act.title.includes('Aye') ? '#00843D' : '#DC2626')
                  : '#F59E0B',
                marginTop: 5,
              }} />
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium,
                  color: colors.text,
                }} numberOfLines={1}>
                  {act.title}
                </Text>
                <Text style={{
                  fontSize: FONT_SIZE.caption, color: colors.textMuted,
                  marginTop: 1,
                }} numberOfLines={1}>
                  {act.detail} · {timeAgo(act.date)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
});

// ── Main Screen ─────────────────────────────────────────────────────────

export function WatchlistScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { items, loading, refresh, markSeen } = useWatchlist();

  const handlePress = useCallback((item: WatchlistItem) => {
    hapticLight();
    markSeen(item.entity_type, item.entity_id);

    if (item.entity_type === 'member') {
      navigation.navigate('MemberProfile', { memberId: item.entity_id });
    } else if (item.entity_type === 'bill') {
      navigation.navigate('BillDetail', { billId: item.entity_id });
    } else {
      navigation.navigate('TopicBills', { category: item.entity_id, label: item.label ?? item.entity_id });
    }
  }, [navigation, markSeen]);

  const newCount = items.filter(i => i.hasNewActivity).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: SPACING.lg,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: SPACING.lg }}>
          <Text style={{
            fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.bold,
            color: colors.text,
          }}>
            Watchlist
          </Text>
          {items.length > 0 && (
            <Text style={{
              fontSize: FONT_SIZE.caption, color: colors.textMuted, marginTop: 1,
            }}>
              {items.length} item{items.length !== 1 ? 's' : ''} tracked
              {newCount > 0 ? ` · ${newCount} with new activity` : ''}
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 20, gap: SPACING.md }}>
          <SkeletonLoader height={120} borderRadius={BORDER_RADIUS.lg} />
          <SkeletonLoader height={120} borderRadius={BORDER_RADIUS.lg} />
          <SkeletonLoader height={120} borderRadius={BORDER_RADIUS.lg} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="eye-outline"
          title="Your watchlist is empty"
          subtitle="Follow MPs, bills, or topics to track their activity here — like a portfolio for democracy."
          actionLabel="Find an MP to follow"
          onAction={() => navigation.navigate('Main', { screen: 'Explore' })}
        />
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WatchlistCard item={item} onPress={() => handlePress(item)} colors={colors} />
          )}
          contentContainerStyle={{ paddingTop: SPACING.lg, paddingBottom: SPACING.xxl }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refresh}
              tintColor="#00843D"
              colors={['#00843D']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
