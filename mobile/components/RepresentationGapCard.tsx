import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { AlignmentRecord } from '../hooks/useRepresentationGap';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

const GREEN = '#00843D';
const NEUTRAL = '#6C757D';

interface Props {
  records: AlignmentRecord[];
  memberFirstName: string;
  electorateName: string;
}

export function RepresentationGapCard({ records, memberFirstName, electorateName }: Props) {
  const { colors } = useTheme();

  // Don't render if no linked polls with sufficient data
  if (records.length === 0) return null;

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, marginBottom: SPACING.lg,
      ...SHADOWS.sm,
    }}>
      {/* Section label */}
      <Text style={{
        fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold,
        letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase',
        marginBottom: SPACING.sm,
      }}>
        Representation
      </Text>

      {/* Title */}
      <Text style={{
        fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.bold,
        color: colors.text, marginBottom: SPACING.lg, lineHeight: 22,
      }}>
        How {memberFirstName} votes vs. Verity voters
        {records[0].data_level === 'electorate' ? ` in ${electorateName}` : ' nationally'}
      </Text>

      {/* Alignment rows */}
      {records.slice(0, 5).map((rec) => (
        <AlignmentRow key={`${rec.poll_id}-${rec.division_id}`} record={rec} memberFirstName={memberFirstName} colors={colors} />
      ))}

      {/* Disclaimer */}
      <View style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs,
        marginTop: SPACING.md, paddingTop: SPACING.md,
        borderTopWidth: 0.5, borderTopColor: colors.border,
      }}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
        <Text style={{
          flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16,
        }}>
          Based on Verity daily poll responses, not a representative sample of the electorate. n = number of Verity voters who responded.
        </Text>
      </View>
    </View>
  );
}

function AlignmentRow({ record, memberFirstName, colors }: { record: AlignmentRecord; memberFirstName: string; colors: any }) {
  const isAligned = record.alignment === 'aligned';
  const isAbsent = record.alignment === 'absent';
  // Neutral gray for both aligned and misaligned -- identical visual weight
  const indicatorColor = isAligned ? GREEN : NEUTRAL;

  const voteLabel = record.vote_cast === 'aye' ? 'AYE' :
                    record.vote_cast === 'no' ? 'NO' :
                    record.vote_cast === 'absent' ? 'ABSENT' : record.vote_cast.toUpperCase();

  const voteColor = record.vote_cast === 'aye' ? GREEN :
                    record.vote_cast === 'no' ? '#DC3545' : NEUTRAL;

  const levelLabel = record.data_level === 'electorate' ? 'Verity voters' : 'Verity voters nationally';

  return (
    <View style={{
      backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md, marginBottom: SPACING.sm,
    }}>
      {/* Division name */}
      <Text style={{
        fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold,
        color: colors.text, marginBottom: SPACING.sm, lineHeight: 18,
      }} numberOfLines={2}>
        {record.division_name || record.question}
      </Text>

      {/* MP's vote */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs }}>
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
          {memberFirstName} voted
        </Text>
        <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: voteColor }}>
          {voteLabel}
        </Text>
      </View>

      {/* Verity voter result */}
      {!isAbsent && record.majority_pct != null && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
            {levelLabel}
          </Text>
          <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
            {record.majority_pct}% {record.majority_direction} (n={record.sample_size})
          </Text>
        </View>
      )}

      {/* Alignment indicator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
        <View style={{
          width: 8, height: 8, borderRadius: 4, backgroundColor: indicatorColor,
        }} />
        <Text style={{
          fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium,
          color: indicatorColor,
          fontStyle: isAbsent ? 'italic' : 'normal',
        }}>
          {isAligned ? 'Aligned' : isAbsent ? 'Absent from this division' : 'Misaligned'}
        </Text>
      </View>
    </View>
  );
}
