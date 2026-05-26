import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ConflictFlag } from '../hooks/useConflictRadar';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

/**
 * Conflict Radar Card — shows votes where an MP has a declared financial
 * interest in the outcome. STRICTLY FACTUAL. No editorial language.
 *
 * LEGAL GATE: This component only renders when useConflictRadar.enabled is true.
 * Do NOT enable until a defamation lawyer has signed off.
 */

interface Props {
  flags: ConflictFlag[];
  memberName: string;
  enabled: boolean;
}

export function ConflictRadarCard({ flags, memberName, enabled }: Props) {
  const { colors } = useTheme();

  if (!enabled || flags.length === 0) return null;

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
        Declared Interests & Votes
      </Text>

      <Text style={{
        fontSize: FONT_SIZE.small, color: colors.textBody, marginBottom: SPACING.md, lineHeight: 20,
      }}>
        {memberName} voted on the following divisions where they have declared a financial interest in the relevant area.
      </Text>

      {flags.slice(0, 3).map((flag) => (
        <View key={flag.division_id} style={{
          backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.md,
          padding: SPACING.md, marginBottom: SPACING.sm,
        }}>
          {/* Division */}
          <Text style={{
            fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold,
            color: colors.text, lineHeight: 18, marginBottom: SPACING.xs,
          }} numberOfLines={2}>
            {flag.division_name}
          </Text>

          {/* Vote */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs }}>
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>Voted</Text>
            <View style={{
              backgroundColor: flag.vote_cast === 'aye' ? '#E8F5EE' : '#FDECEA',
              borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
            }}>
              <Text style={{
                fontSize: 10, fontWeight: FONT_WEIGHT.bold,
                color: flag.vote_cast === 'aye' ? '#00843D' : '#DC3545',
              }}>
                {flag.vote_cast === 'aye' ? 'Aye' : 'No'}
              </Text>
            </View>
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              {flag.division_date}
            </Text>
          </View>

          {/* Declared interest */}
          <View style={{ backgroundColor: '#FFFBEB', borderRadius: 6, padding: SPACING.sm, marginTop: SPACING.xs }}>
            <Text style={{ fontSize: 10, fontWeight: FONT_WEIGHT.bold, color: '#92400E', marginBottom: 2 }}>
              Declared interest: {flag.interest_category}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.caption, color: '#1F2937', lineHeight: 16 }} numberOfLines={2}>
              {flag.interest_description}
            </Text>
          </View>

          {/* Source links */}
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm }}>
            {flag.division_source_url && (
              <Pressable onPress={() => Linking.openURL(flag.division_source_url!)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="link-outline" size={11} color={colors.textMuted} />
                <Text style={{ fontSize: 10, color: colors.textMuted }}>Division record</Text>
              </Pressable>
            )}
            {flag.interest_source_url && (
              <Pressable onPress={() => Linking.openURL(flag.interest_source_url!)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="link-outline" size={11} color={colors.textMuted} />
                <Text style={{ fontSize: 10, color: colors.textMuted }}>Register entry</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}

      {/* Disclaimer */}
      <View style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs,
        marginTop: SPACING.md, paddingTop: SPACING.md,
        borderTopWidth: 0.5, borderTopColor: colors.border,
      }}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: FONT_SIZE.caption - 1, color: colors.textMuted, lineHeight: 16 }}>
          Declaring an interest is a transparency requirement, not evidence of wrongdoing. All declarations are from the official Register of Members' Interests.
        </Text>
      </View>
    </View>
  );
}
