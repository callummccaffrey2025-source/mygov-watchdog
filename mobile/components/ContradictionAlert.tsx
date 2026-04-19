/**
 * ContradictionAlert — Inline alert for NewsStoryDetailScreen when a story
 * has confirmed contradictions between an MP's public statement and their
 * parliamentary record.
 *
 * Returns null if no confirmed contradictions exist for this story.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useContradictions } from '../hooks/useContradictions';
import { useTheme } from '../context/ThemeContext';
import { decodeHtml } from '../utils/decodeHtml';
import { timeAgo } from '../lib/timeAgo';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface Props {
  storyId: number;
  onPress: (contradictionId: string) => void;
}

export function ContradictionAlert({ storyId, onPress }: Props) {
  const { colors } = useTheme();
  const { contradictions, loading } = useContradictions({ storyId });

  if (loading || contradictions.length === 0) return null;

  const c = contradictions[0];
  const member = c.member;
  const memberName = member
    ? `${member.first_name} ${member.last_name}`
    : 'MP';

  return (
    <Pressable
      onPress={() => onPress(c.id)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.cardAlt : colors.card,
        borderRadius: BORDER_RADIUS.lg,
        borderLeftWidth: 4,
        borderLeftColor: '#DC3545',
        padding: SPACING.lg,
        marginBottom: SPACING.lg,
        ...SHADOWS.md,
      })}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm }}>
        <Ionicons name="alert-circle" size={18} color="#DC3545" />
        <Text style={{
          fontSize: FONT_SIZE.small,
          fontWeight: FONT_WEIGHT.bold,
          color: '#DC3545',
          letterSpacing: 0.3,
        }}>
          Record contradicts statement
        </Text>
      </View>

      {/* MP name */}
      <Text style={{
        fontSize: FONT_SIZE.body,
        fontWeight: FONT_WEIGHT.semibold,
        color: colors.text,
        marginBottom: SPACING.xs,
      }}>
        {memberName}
      </Text>

      {/* Claim excerpt */}
      <Text
        style={{
          fontSize: FONT_SIZE.small,
          color: colors.textBody,
          lineHeight: 19,
          marginBottom: SPACING.sm,
        }}
        numberOfLines={2}
      >
        Claimed: "{decodeHtml(c.claim_text)}"
      </Text>

      {/* Counter-evidence excerpt */}
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

      {/* Date comparison */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm }}>
        {c.claim_date ? (
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
            Claimed {timeAgo(c.claim_date)}
          </Text>
        ) : null}
        {c.contra_date ? (
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
            Record {timeAgo(c.contra_date)}
          </Text>
        ) : null}
      </View>

      {/* View full evidence link */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: '#DC3545' }}>
          View full evidence
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#DC3545" />
      </View>
    </Pressable>
  );
}
