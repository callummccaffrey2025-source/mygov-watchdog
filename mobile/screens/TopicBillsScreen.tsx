import React, { useMemo, useCallback } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useBills, Bill } from '../hooks/useBills';
import { BillCard } from '../components/BillCard';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { enrichBill } from '../lib/billEnrichment';
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../constants/design';

const TOPIC_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  housing:        'home-outline',
  healthcare:     'medkit-outline',
  economy:        'trending-up-outline',
  climate:        'leaf-outline',
  immigration:    'airplane-outline',
  defence:        'shield-outline',
  education:      'school-outline',
  cost_of_living: 'cart-outline',
  indigenous:     'earth-outline',
  technology:     'hardware-chip-outline',
  agriculture:    'nutrition-outline',
  infrastructure: 'construct-outline',
  foreign_policy: 'globe-outline',
  justice:        'scale-outline',
};

export function TopicBillsScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { category, label } = route.params as { category: string; label: string };
  const { bills, loading } = useBills({ category, limit: 60 });
  const iconName = TOPIC_ICONS[category] ?? 'document-text-outline';

  // Sort: live bills first, then recent, then archived
  const sortedBills = useMemo(() => {
    const live: Bill[] = [];
    const rest: Bill[] = [];
    bills.forEach(b => {
      const e = enrichBill(b);
      if (e.isLive) live.push(b);
      else rest.push(b);
    });
    return [...live, ...rest];
  }, [bills]);

  const liveCount = useMemo(() => sortedBills.filter(b => enrichBill(b).isLive).length, [sortedBills]);

  const renderItem = useCallback(({ item }: { item: Bill }) => {
    const e = enrichBill(item);
    return (
      <BillCard
        bill={item}
        onPress={() => navigation.navigate('BillDetail', { bill: item })}
        dimmed={!e.isLive}
      />
    );
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.lg,
        gap: SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Ionicons name={iconName as any} size={22} color={colors.text} />
        <Text style={{ fontSize: 20, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>{label}</Text>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: SPACING.xl }}>
          {[1, 2, 3].map(i => (
            <SkeletonLoader key={i} height={130} borderRadius={14} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ) : sortedBills.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: SPACING.md }}>
          <Ionicons name={iconName as any} size={48} color={colors.textMuted} />
          <Text style={{ fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.text }}>No {label} bills</Text>
          <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
            Bills tagged with {label} will appear here as Parliament debates them.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedBills}
          keyExtractor={b => b.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingBottom: 40 }}
          windowSize={5}
          maxToRenderPerBatch={10}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: SPACING.md }}>
              {sortedBills.length} bill{sortedBills.length !== 1 ? 's' : ''}
              {liveCount > 0 ? ` · ${liveCount} live` : ''}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
