import React, { useState } from 'react';
import { View, Text, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAllDAs, DevelopmentApplication } from '../hooks/useNearbyDAs';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  lodged:         { bg: '#EFF6FF', text: '#1D4ED8' },
  on_exhibition:  { bg: '#FEF3C7', text: '#92400E' },
  determined:     { bg: '#ECFDF5', text: '#065F46' },
  withdrawn:      { bg: '#FEF2F2', text: '#991B1B' },
};

const TYPE_ICONS: Record<string, string> = {
  development: 'construct',
  rezoning: 'map',
  modification: 'create',
  review: 'refresh',
};

function DACard({ da, colors, onPress }: { da: DevelopmentApplication; colors: any; onPress: () => void }) {
  const statusStyle = STATUS_COLORS[da.status] || STATUS_COLORS.lodged;
  const isRezoning = da.da_type === 'rezoning';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Development application at ${da.address}`}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        opacity: pressed ? 0.92 : 1,
        ...SHADOWS.md,
      })}
    >
      {/* Header: type icon + DA number + status badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <View style={{
            width: 28, height: 28, borderRadius: BORDER_RADIUS.sm,
            backgroundColor: isRezoning ? '#FEF3C7' : '#EFF6FF',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Ionicons name={(TYPE_ICONS[da.da_type] || 'construct') as any} size={14} color={isRezoning ? '#92400E' : '#1D4ED8'} />
          </View>
          <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium, color: colors.textMuted }}>
            {da.da_number}
          </Text>
        </View>
        <View style={{
          backgroundColor: statusStyle.bg,
          borderRadius: BORDER_RADIUS.sm,
          paddingHorizontal: SPACING.sm,
          paddingVertical: 3,
        }}>
          <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: statusStyle.text, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {da.status.replace('_', ' ')}
          </Text>
        </View>
      </View>

      {/* Address */}
      <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold, color: colors.text, marginBottom: SPACING.xs, lineHeight: 20 }} numberOfLines={2}>
        {da.address}
      </Text>

      {/* Description */}
      <Text style={{ fontSize: FONT_SIZE.small, color: colors.textBody, lineHeight: 19, marginBottom: SPACING.md }} numberOfLines={2}>
        {da.description}
      </Text>

      {/* Stats row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.lg }}>
        {da.storeys && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="layers-outline" size={13} color={colors.textMuted} />
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>{da.storeys} storeys</Text>
          </View>
        )}
        {da.dwellings && da.dwellings > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="home-outline" size={13} color={colors.textMuted} />
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>{da.dwellings} dwellings</Text>
          </View>
        )}
        {da.estimated_cost && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="cash-outline" size={13} color={colors.textMuted} />
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              ${(da.estimated_cost / 1000000).toFixed(1)}M
            </Text>
          </View>
        )}
        {da.distance_m != null && da.distance_m < 100000 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location-outline" size={13} color="#DC3545" />
            <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: '#DC3545' }}>
              {da.distance_m}m away
            </Text>
          </View>
        )}
      </View>

      {/* Exhibition deadline warning */}
      {da.exhibition_end && da.status === 'on_exhibition' && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
          marginTop: SPACING.sm, paddingTop: SPACING.sm,
          borderTopWidth: 0.5, borderTopColor: colors.border,
        }}>
          <Ionicons name="time-outline" size={13} color="#92400E" />
          <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: '#92400E' }}>
            Public comment closes {new Date(da.exhibition_end).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function DARadarScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<string | null>(null);
  const { das, loading } = useAllDAs(null, 50);

  const filtered = filter
    ? das.filter(da => da.status === filter)
    : das;

  const filters = [
    { key: null, label: 'All' },
    { key: 'on_exhibition', label: 'Open for Comment' },
    { key: 'lodged', label: 'Newly Lodged' },
    { key: 'determined', label: 'Determined' },
  ];

  const renderDA = ({ item }: { item: DevelopmentApplication }) => (
    <DACard
      da={item}
      colors={colors}
      onPress={() => navigation.navigate('DADetail', { daId: item.id })}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md }}>
        <Text style={{ fontSize: FONT_SIZE.heading + 4, fontWeight: FONT_WEIGHT.bold, color: colors.text, letterSpacing: -0.3 }}>
          DA Radar
        </Text>
        <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.xs }}>
          Development applications near you
        </Text>
      </View>

      {/* Filter pills */}
      <View style={{ flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.md }}>
        {filters.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key ?? 'all'}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => ({
                paddingHorizontal: SPACING.md,
                paddingVertical: SPACING.sm,
                borderRadius: BORDER_RADIUS.full,
                backgroundColor: active ? '#1A1A17' : colors.surface,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{
                fontSize: FONT_SIZE.caption + 1,
                fontWeight: FONT_WEIGHT.semibold,
                color: active ? '#ffffff' : colors.textMuted,
              }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <FlashList
          data={filtered}
          renderItem={renderDA}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: SPACING.lg }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: SPACING.xxxl }}>
              <Ionicons name="construct-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.md }}>
                No development applications
              </Text>
              <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.xs, textAlign: 'center' }}>
                Set your location to get alerts when new DAs are lodged nearby.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
