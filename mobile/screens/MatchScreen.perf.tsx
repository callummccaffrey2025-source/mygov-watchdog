/**
 * MatchScreen performance spike — StyleSheet.create variant.
 *
 * This file contains ONLY the MatchCard component in two variants:
 *   1. MatchCardInline — current inline styles (baseline)
 *   2. MatchCardStyleSheet — StyleSheet.create equivalent
 *
 * Both are functionally identical. The parent screen can toggle between them
 * to measure render performance on a real device via the React DevTools profiler
 * or a simple InteractionManager timing wrapper.
 *
 * DO NOT MERGE — measurement spike only.
 */
import React, { useCallback, useState, useRef } from 'react';
import {
  View, Text, Pressable, StyleSheet, InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { MatchResult } from '../hooks/useVerityMatch';

// ════════════════════════════════════════════════════════════════════════
// VARIANT A — INLINE STYLES (current codebase pattern)
// ════════════════════════════════════════════════════════════════════════

export function MatchCardInline({
  match, rank, onPress, onShowWorking, colors,
}: {
  match: MatchResult; rank: number; onPress: () => void; onShowWorking: () => void; colors: any;
}) {
  const scoreColor = match.match_score >= 70 ? '#10B981'
    : match.match_score >= 40 ? '#F59E0B' : '#DC3545';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginHorizontal: 20,
        marginBottom: SPACING.md,
        opacity: pressed ? 0.92 : 1,
        ...SHADOWS.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: rank <= 3 ? '#00843D' : colors.surface,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Text style={{
            fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold,
            color: rank <= 3 ? '#fff' : colors.textMuted,
          }}>
            {rank}
          </Text>
        </View>

        {match.photo_url ? (
          <Image
            source={{ uri: match.photo_url }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
            contentFit="cover"
          />
        ) : (
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
          }}>
            <Ionicons name="person" size={20} color={colors.textMuted} />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold, color: colors.text }}>
            {match.first_name} {match.last_name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 }}>
            {match.party_colour && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: match.party_colour }} />
            )}
            <Text style={{ fontSize: FONT_SIZE.small, color: colors.textMuted }}>
              {match.party_name} · {match.electorate_name}
            </Text>
          </View>
        </View>

        {match.insufficient_data ? (
          <View style={{
            paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
            borderRadius: BORDER_RADIUS.sm, backgroundColor: colors.surface,
          }}>
            <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>
              Not enough data
            </Text>
          </View>
        ) : (
          <Pressable onPress={(e) => { e.stopPropagation?.(); onShowWorking(); }} hitSlop={8}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.bold, color: scoreColor }}>
                {match.match_score}%
              </Text>
              <Text style={{ fontSize: 9, color: colors.textMuted, textDecorationLine: 'underline' }}>
                how?
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════════════
// VARIANT B — StyleSheet.create (performance test)
// ════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: 20,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardPressed: {
    opacity: 0.92,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
  },
  photo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  photoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  partyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: FONT_SIZE.small,
  },
  insufficientBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  insufficientText: {
    fontSize: FONT_SIZE.caption,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: FONT_SIZE.heading,
    fontWeight: FONT_WEIGHT.bold,
  },
  howText: {
    fontSize: 9,
    textDecorationLine: 'underline',
  },
});

export function MatchCardStyleSheet({
  match, rank, onPress, onShowWorking, colors,
}: {
  match: MatchResult; rank: number; onPress: () => void; onShowWorking: () => void; colors: any;
}) {
  const scoreColor = match.match_score >= 70 ? '#10B981'
    : match.match_score >= 40 ? '#F59E0B' : '#DC3545';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: colors.card },
        pressed && s.cardPressed,
      ]}
    >
      <View style={s.row}>
        <View style={[
          s.rankCircle,
          { backgroundColor: rank <= 3 ? '#00843D' : colors.surface },
        ]}>
          <Text style={[s.rankText, { color: rank <= 3 ? '#fff' : colors.textMuted }]}>
            {rank}
          </Text>
        </View>

        {match.photo_url ? (
          <Image source={{ uri: match.photo_url }} style={s.photo} contentFit="cover" />
        ) : (
          <View style={[s.photoPlaceholder, { backgroundColor: colors.surface }]}>
            <Ionicons name="person" size={20} color={colors.textMuted} />
          </View>
        )}

        <View style={s.infoContainer}>
          <Text style={[s.nameText, { color: colors.text }]}>
            {match.first_name} {match.last_name}
          </Text>
          <View style={s.metaRow}>
            {match.party_colour && (
              <View style={[s.partyDot, { backgroundColor: match.party_colour }]} />
            )}
            <Text style={[s.metaText, { color: colors.textMuted }]}>
              {match.party_name} · {match.electorate_name}
            </Text>
          </View>
        </View>

        {match.insufficient_data ? (
          <View style={[s.insufficientBadge, { backgroundColor: colors.surface }]}>
            <Text style={[s.insufficientText, { color: colors.textMuted }]}>
              Not enough data
            </Text>
          </View>
        ) : (
          <Pressable onPress={(e) => { e.stopPropagation?.(); onShowWorking(); }} hitSlop={8}>
            <View style={s.scoreContainer}>
              <Text style={[s.scoreText, { color: scoreColor }]}>
                {match.match_score}%
              </Text>
              <Text style={[s.howText, { color: colors.textMuted }]}>
                how?
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MEASUREMENT HARNESS
// ════════════════════════════════════════════════════════════════════════

/**
 * Wraps a FlashList renderItem callback and measures average render time
 * across N items. Logs results to console after the list settles.
 *
 * Usage in MatchScreen:
 *   const renderMatch = usePerfMeasuredRender(({ item, index }) => (
 *     <MatchCardStyleSheet ... />
 *   ), 'StyleSheet');
 */
export function usePerfMeasuredRender<T>(
  renderFn: (info: { item: T; index: number }) => React.ReactElement,
  label: string,
) {
  const timings = useRef<number[]>([]);
  const reported = useRef(false);

  const measured = useCallback((info: { item: T; index: number }) => {
    const start = performance.now();
    const element = renderFn(info);
    const elapsed = performance.now() - start;
    timings.current.push(elapsed);

    // Report after 50 items have rendered (covers initial viewport + scroll)
    if (timings.current.length >= 50 && !reported.current) {
      reported.current = true;
      InteractionManager.runAfterInteractions(() => {
        const sorted = [...timings.current].sort((a, b) => a - b);
        const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        console.log(
          `[PerfSpike] ${label}: ${sorted.length} renders | ` +
          `avg=${avg.toFixed(2)}ms p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms`
        );
      });
    }

    return element;
  }, [renderFn, label]);

  return measured;
}
