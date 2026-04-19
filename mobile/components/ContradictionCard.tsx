/**
 * ContradictionCard — Reusable card for displaying a contradiction in list views
 * (Watchlist tab on member profile, activity feed, etc.).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Contradiction } from '../hooks/useContradictions';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  contradiction: Contradiction;
  onPress: (id: string) => void;
}

export function ContradictionCard({ contradiction, onPress }: Props) {
  const { colors } = useTheme();
  const c = contradiction;
  const member = c.member;

  const memberName = member
    ? `${member.first_name} ${member.last_name}`
    : 'MP';
  const partyName = member?.party?.short_name || member?.party?.name || '';
  const accentColor = c.confidence >= 0.9 ? '#DC3545' : '#F0AD4E';

  return (
    <Pressable
      onPress={() => onPress(c.id)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.cardAlt : colors.card,
        borderRadius: BORDER_RADIUS.lg,
        borderLeftWidth: 4,
        borderLeftColor: accentColor,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        ...SHADOWS.md,
      })}
    >
      {/* MP name + party + confidence */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }}>
          <Ionicons name="alert-circle" size={16} color={accentColor} />
          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }} numberOfLines={1}>
            {memberName}
          </Text>
          {partyName ? (
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              {partyName}
            </Text>
          ) : null}
        </View>

        {/* Confidence badge */}
        <View style={{
          backgroundColor: accentColor + '18',
          borderRadius: BORDER_RADIUS.sm,
          paddingHorizontal: SPACING.sm,
          paddingVertical: 2,
        }}>
          <Text style={{ fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, color: accentColor }}>
            {Math.round(c.confidence * 100)}%
          </Text>
        </View>
      </View>

      {/* Claim text */}
      <Text
        style={{
          fontSize: FONT_SIZE.small,
          color: colors.textBody,
          lineHeight: 19,
          marginBottom: SPACING.xs,
        }}
        numberOfLines={2}
      >
        Claimed: "{decodeHtml(c.claim_text)}"
      </Text>

      {/* Counter-evidence text */}
      <Text
        style={{
          fontSize: FONT_SIZE.small,
          color: colors.textBody,
          lineHeight: 19,
          fontStyle: 'italic',
          marginBottom: SPACING.sm,
        }}
        numberOfLines={2}
      >
        Record: "{decodeHtml(c.contra_text)}"
      </Text>

      {/* Date range */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
        <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
          {c.claim_date ? `Claimed ${timeAgo(c.claim_date)}` : 'Unknown date'}
          {' — '}
          {c.contra_date ? `Record shows ${timeAgo(c.contra_date)}` : 'Record date unknown'}
        </Text>
      </View>
    </Pressable>
  );
}
