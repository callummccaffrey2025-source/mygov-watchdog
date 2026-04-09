import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { Bill } from '../hooks/useBills';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SHADOWS, SPACING } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Housing',
  healthcare: 'Healthcare',
  economy: 'Economy',
  climate: 'Climate',
  immigration: 'Immigration',
  defence: 'Defence',
  education: 'Education',
  cost_of_living: 'Cost of Living',
};

interface Props {
  bill: Bill;
  onPress?: () => void;
  horizontal?: boolean;
}

export function BillCard({ bill, onPress, horizontal }: Props) {
  const { colors } = useTheme();
  const displayTitle = bill.short_title || bill.title;
  // chamber_introduced or origin_chamber both hold 'house' or 'senate' (lowercase)
  const chamberRaw = (bill.chamber_introduced || (bill as any).origin_chamber || '').toLowerCase();
  const chamberLabel = chamberRaw.includes('senate') ? 'Senate'
    : chamberRaw.includes('house') ? 'House'
    : null;

  const dateStr = bill.date_introduced ? timeAgo(bill.date_introduced) : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        horizontal && styles.horizontalCard,
        { backgroundColor: colors.card },
        pressed && { opacity: 0.87, transform: [{ scale: 0.99 }] },
      ]}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
    >
      <View style={styles.topRow}>
        <StatusBadge status={bill.current_status || bill.status} />
        {chamberLabel && (
          <View style={[styles.chamberBadge, { backgroundColor: colors.cardAlt }]}>
            <Text style={[styles.chamberText, { color: colors.textMuted }]}>{chamberLabel}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.title, horizontal && styles.titleHorizontal, { color: colors.text }]} numberOfLines={2}>
        {displayTitle}
      </Text>

      {bill.categories && bill.categories.length > 0 && (
        <View style={styles.categories}>
          {bill.categories.slice(0, horizontal ? 2 : 3).map(cat => (
            <View key={cat} style={[styles.catChip, { backgroundColor: colors.greenBg }]}>
              <Text style={styles.catText}>{CATEGORY_LABELS[cat] || cat}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        {dateStr ? (
          <Text style={[styles.date, { color: colors.textMuted }]}>{dateStr}</Text>
        ) : (
          <View />
        )}
        <View style={styles.reactions}>
          <Ionicons name="thumbs-up-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.reactionCount, { color: colors.textMuted }]}>—</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: 10,
    ...SHADOWS.sm,
    gap: 10,
  },
  horizontalCard: {
    width: 280,
    marginBottom: 0,
    marginRight: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chamberBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chamberText: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  title: { fontSize: 15, fontWeight: '700', color: '#1a2332', lineHeight: 21 },
  titleHorizontal: { fontSize: 15 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  catChip: {
    backgroundColor: '#F0FFF4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catText: { fontSize: 10, color: '#00843D', fontWeight: '500' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  date: { fontSize: 11, color: '#9aabb8' },
  reactions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reactionCount: { fontSize: 11, color: '#9aabb8' },
});
