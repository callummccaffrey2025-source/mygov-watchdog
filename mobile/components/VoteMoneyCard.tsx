import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { VoteMoneySummary } from '../hooks/useVoteMoneyLinks';
import { getIndustryLabel, getIndustryColor } from '../constants/industryColors';
import { INDUSTRY_ICONS } from '../constants/industryColors';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  summary: VoteMoneySummary[];
  loading: boolean;
  memberFirstName: string;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function VoteMoneyCard({ summary, loading, memberFirstName }: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (loading || summary.length === 0) return null;

  const topIndustries = expanded ? summary : summary.slice(0, 3);
  const totalAmount = summary.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalVotes = summary.reduce((s, r) => s + Number(r.related_vote_count), 0);

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.xl,
      borderWidth: 1.5,
      borderColor: '#F59E0B33',
      ...SHADOWS.sm,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="cash-outline" size={15} color="#D97706" />
        </View>
        <Text style={{
          fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold,
          letterSpacing: 0.8, color: '#D97706', textTransform: 'uppercase',
        }}>
          Follow the Money
        </Text>
      </View>

      {/* Summary line */}
      <Text style={{
        fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold,
        color: colors.text, marginBottom: SPACING.md, lineHeight: 22,
      }}>
        {formatAmount(totalAmount)} from {summary.length} industries that had {totalVotes} related votes
      </Text>

      {/* Industry rows */}
      {topIndustries.map((row) => {
        const industryColor = getIndustryColor(row.donation_industry);
        const iconName = (INDUSTRY_ICONS as Record<string, string>)[row.donation_industry] || 'ellipsis-horizontal-outline';

        return (
          <View key={row.donation_industry} style={{
            backgroundColor: colors.surface,
            borderRadius: BORDER_RADIUS.md,
            padding: SPACING.md,
            marginBottom: SPACING.sm,
          }}>
            {/* Industry header row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }}>
                <View style={{
                  width: 26, height: 26, borderRadius: 13,
                  backgroundColor: industryColor + '1A',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Ionicons name={iconName as any} size={13} color={industryColor} />
                </View>
                <Text style={{
                  fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold,
                  color: colors.text,
                }} numberOfLines={1}>
                  {getIndustryLabel(row.donation_industry)}
                </Text>
              </View>
              <Text style={{
                fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold,
                color: industryColor,
              }}>
                {formatAmount(Number(row.total_amount))}
              </Text>
            </View>

            {/* Detail line */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
                {row.donor_count} donor{Number(row.donor_count) !== 1 ? 's' : ''}
                {row.top_donor_name ? ` · Top: ${row.top_donor_name}` : ''}
              </Text>
              <View style={{
                backgroundColor: '#FEF3C7', borderRadius: 4,
                paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Text style={{
                  fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#92400E',
                }}>
                  {row.related_vote_count} vote{Number(row.related_vote_count) !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Sample division */}
            {row.sample_division_name && (
              <Text style={{
                fontSize: FONT_SIZE.caption, color: colors.textMuted,
                marginTop: SPACING.xs, fontStyle: 'italic', lineHeight: 16,
              }} numberOfLines={1}>
                e.g. {row.sample_division_name.replace(/^Bills?\s*[—\-]\s*/i, '')}
              </Text>
            )}
          </View>
        );
      })}

      {/* Expand/collapse */}
      {summary.length > 3 && (
        <Pressable
          onPress={() => setExpanded(!expanded)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show fewer industries' : 'Show all industries'}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: SPACING.sm }}
        >
          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: '#D97706' }}>
            {expanded ? 'Show less' : `Show all ${summary.length} industries`}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#D97706" />
        </Pressable>
      )}

      {/* Disclaimer */}
      <Text style={{
        fontSize: 10, color: colors.textMuted, marginTop: SPACING.md,
        lineHeight: 14, textAlign: 'center',
      }}>
        Correlation, not causation. Donations are to {memberFirstName}'s party unless noted.
        Source: AEC Transparency Register.
      </Text>
    </View>
  );
}
