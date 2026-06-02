import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { BillDelta } from '../hooks/useBillDeltas';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { timeAgo } from '../lib/timeAgo';

const GREEN = '#00843D';

interface Props {
  deltas: BillDelta[];
}

/**
 * BillDeltaCard — shows what changed between bill readings.
 *
 * Strictly factual framing:
 * "This clause was [added/changed/removed] between the [Nth] and [Mth] reading."
 * No editorial language. No accusations of intent.
 * Beneficiary flagged as "may relate to [sector]" — never claims advantage.
 */
export function BillDeltaCard({ deltas }: Props) {
  const { colors } = useTheme();

  if (deltas.length === 0) return null;

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, marginBottom: SPACING.lg,
      ...SHADOWS.sm,
    }}>
      <Text style={{
        fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.semibold,
        letterSpacing: 0.8, color: colors.textMuted, textTransform: 'uppercase',
        marginBottom: SPACING.sm,
      }}>
        What Changed
      </Text>

      {deltas.slice(0, 5).map((delta) => (
        <DeltaRow key={delta.id} delta={delta} colors={colors} />
      ))}

      {/* Source attribution */}
      <View style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs,
        marginTop: SPACING.md, paddingTop: SPACING.md,
        borderTopWidth: 0.5, borderTopColor: colors.border,
      }}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
          Changes detected by comparing bill metadata across parliamentary readings. Source: Australian Parliament House.
        </Text>
      </View>
    </View>
  );
}

function DeltaRow({ delta, colors }: { delta: BillDelta; colors: any }) {
  const fromStage = delta.from_version?.reading_stage || '?';
  const toStage = delta.to_version?.reading_stage || '?';
  const changedSections = delta.changed_sections || [];
  const loopholeFlags = delta.loophole_flags || [];
  const newStages = delta.progress_stages_added || [];

  return (
    <View style={{
      backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md, marginBottom: SPACING.sm,
    }}>
      {/* Version transition */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
        <View style={{ backgroundColor: '#E8F5EE', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: GREEN }}>
            v{delta.from_version?.version_number || '?'}{' \u2192 '}v{delta.to_version?.version_number || '?'}
          </Text>
        </View>
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
          {timeAgo(delta.created_at)}
        </Text>
      </View>

      {/* Change summary */}
      <Text style={{
        fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium,
        color: colors.text, lineHeight: 18, marginBottom: SPACING.xs,
      }}>
        {delta.change_summary}
      </Text>

      {/* Status change */}
      {delta.status_changed && delta.from_version && delta.to_version && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
          <Ionicons name="swap-horizontal" size={14} color={colors.textMuted} />
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textBody }}>
            {delta.from_version.status_snapshot}{' \u2192 '}{delta.to_version.status_snapshot}
          </Text>
        </View>
      )}

      {/* New progress stages */}
      {newStages.map((stage, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
          <Ionicons name="add-circle-outline" size={14} color={GREEN} />
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textBody }}>
            {stage.stage} ({stage.chamber}, {stage.date})
          </Text>
        </View>
      ))}

      {/* Changed sections preview */}
      {changedSections.slice(0, 2).map((cs, i) => (
        <View key={i} style={{
          backgroundColor: cs.type === 'added' ? '#E8F5EE' : cs.type === 'removed' ? '#FDECEA' : '#FFFBEB',
          borderRadius: 6, padding: SPACING.sm, marginTop: SPACING.xs,
        }}>
          <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: colors.textMuted, marginBottom: 2 }}>
            {cs.type === 'added' ? 'Added' : cs.type === 'removed' ? 'Removed' : 'Modified'} ({cs.section})
          </Text>
          <Text style={{ fontSize: FONT_SIZE.caption, color: '#1F2937', lineHeight: 16 }} numberOfLines={3}>
            {cs.after || cs.text || cs.before || ''}
          </Text>
        </View>
      ))}

      {/* Beneficiary flag (neutral framing) */}
      {delta.beneficiary && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
          marginTop: SPACING.sm, paddingTop: SPACING.sm,
          borderTopWidth: 0.5, borderTopColor: colors.border,
        }}>
          <Ionicons name="eye-outline" size={13} color="#6C757D" />
          <Text style={{ fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, fontStyle: 'italic' }}>
            Changes may relate to the {delta.beneficiary} sector
          </Text>
        </View>
      )}
    </View>
  );
}
