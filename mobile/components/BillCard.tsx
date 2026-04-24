import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Bill } from '../hooks/useBills';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SHADOWS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';
import { enrichBill } from '../lib/billEnrichment';
import { decodeHtml } from '../utils/decodeHtml';

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Housing', healthcare: 'Healthcare', economy: 'Economy',
  climate: 'Climate', immigration: 'Immigration', defence: 'Defence',
  education: 'Education', cost_of_living: 'Cost of Living',
  indigenous: 'Indigenous Affairs', technology: 'Technology',
  agriculture: 'Agriculture', infrastructure: 'Infrastructure',
  foreign_policy: 'Foreign Policy', justice: 'Justice',
};

interface Props {
  bill: Bill;
  onPress?: () => void;
  horizontal?: boolean;
  /** Optional personal relevance line e.g. "Affects renters in NSW — that's you" */
  relevanceLine?: string | null;
  /** Show dimmed style for archived bills */
  dimmed?: boolean;
}

export function BillCard({ bill, onPress, horizontal, relevanceLine, dimmed }: Props) {
  const { colors } = useTheme();
  const displayTitle = bill.short_title || bill.title;
  const enrichment = enrichBill(bill);
  const summary = bill.summary_plain;

  const chamberRaw = (bill.chamber_introduced || (bill as any).origin_chamber || '').toLowerCase();
  const chamberLabel = chamberRaw.includes('senate') ? 'Senate'
    : chamberRaw.includes('house') ? 'House' : null;

  const dateStr = bill.date_introduced ? timeAgo(bill.date_introduced) : null;
  const opacity = dimmed ? 0.55 : 1;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: 10,
        ...SHADOWS.sm,
        gap: 10,
        opacity: pressed ? 0.87 : opacity,
        transform: pressed ? [{ scale: 0.99 }] : [],
        ...(horizontal ? { width: 280, marginBottom: 0, marginRight: 12 } : {}),
      })}
    >
      {/* Status row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* Narrative status pill */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: enrichment.statusColor + '14',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 20,
        }}>
          <View style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: enrichment.statusColor,
          }} />
          <Text style={{
            fontSize: 11,
            fontWeight: FONT_WEIGHT.semibold,
            color: enrichment.statusColor,
          }}>
            {enrichment.isLive ? enrichment.stageLabel : enrichment.narrativeStatus === 'became_law' ? 'Passed' : enrichment.narrativeStatus === 'defeated' ? 'Defeated' : 'Archived'}
          </Text>
        </View>

        {chamberLabel && (
          <View style={{ backgroundColor: colors.cardAlt, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>{chamberLabel}</Text>
          </View>
        )}

        {enrichment.isLive && enrichment.narrativeStatus === 'stalled' && (
          <View style={{ backgroundColor: '#FFF7E6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, color: '#B45309', fontWeight: '600' }}>Stalled</Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        style={{
          fontSize: FONT_SIZE.body,
          fontWeight: FONT_WEIGHT.bold,
          color: colors.text,
          lineHeight: 21,
          ...(horizontal ? { fontSize: 15 } : {}),
        }}
        numberOfLines={2}
      >
        {displayTitle}
      </Text>

      {/* One-line summary */}
      {summary && (
        <Text
          style={{ fontSize: 13, color: colors.textBody, lineHeight: 18 }}
          numberOfLines={2}
        >
          {decodeHtml(summary)}
        </Text>
      )}

      {/* Categories */}
      {bill.categories && bill.categories.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {bill.categories.slice(0, horizontal ? 2 : 3).map(cat => (
            <View key={cat} style={{ backgroundColor: colors.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 10, color: '#00843D', fontWeight: '500' }}>{CATEGORY_LABELS[cat] || cat}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Personal relevance line */}
      {relevanceLine && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="person-outline" size={12} color="#00843D" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#00843D', flex: 1 }} numberOfLines={1}>
            {relevanceLine}
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {dateStr && (
            <Text style={{ fontSize: 11, color: colors.textMuted }}>{dateStr}</Text>
          )}
          {bill.sponsor_party && (
            <>
              <Text style={{ fontSize: 11, color: colors.textMuted }}> · </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>{bill.sponsor_party}</Text>
            </>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}
