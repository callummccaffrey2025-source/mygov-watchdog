import React from 'react';
import { View, Text } from 'react-native';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';
import { useTheme } from '../context/ThemeContext';

interface PollDataPoint {
  date: string;
  tpp_alp: number | null;
  tpp_lnp: number | null;
  pollster?: string;
}

interface PollTrendChartProps {
  data: PollDataPoint[];
  height?: number;
}

const ALP_COLOR = '#E53935';
const LNP_COLOR = '#1565C0';
const MIDLINE_COLOR = '#E0E0E0';

/**
 * Simple two-party-preferred trend chart using View-based rendering.
 * No react-native-svg dependency — pure React Native.
 *
 * Shows the latest 8 data points as vertical bars with a 50% midline.
 */
export function PollTrendChart({ data, height = 120 }: PollTrendChartProps) {
  const { colors } = useTheme();

  if (!data || data.length === 0) return null;

  // Take latest 8 points, sorted oldest → newest
  const points = data
    .filter(d => d.tpp_alp != null && d.tpp_lnp != null)
    .slice(-8);

  if (points.length < 2) return null;

  // Scale: show 40-60 range to make differences visible
  const MIN_PCT = 40;
  const MAX_PCT = 60;
  const range = MAX_PCT - MIN_PCT;

  const barWidth = 100 / points.length;

  return (
    <View style={{ marginVertical: SPACING.sm }}>
      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: SPACING.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: ALP_COLOR }} />
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>ALP</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: LNP_COLOR }} />
          <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>L/NP</Text>
        </View>
      </View>

      {/* Chart area */}
      <View style={{
        height,
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* 50% midline */}
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: height * ((MAX_PCT - 50) / range),
          height: 1,
          backgroundColor: MIDLINE_COLOR,
          zIndex: 1,
        }} />
        <Text style={{
          position: 'absolute',
          right: 4,
          top: height * ((MAX_PCT - 50) / range) - 12,
          fontSize: 9,
          color: colors.textMuted,
          zIndex: 2,
        }}>50%</Text>

        {points.map((point, i) => {
          const alp = point.tpp_alp ?? 50;
          const lnp = point.tpp_lnp ?? 50;
          const alpHeight = Math.max(0, Math.min(1, (alp - MIN_PCT) / range)) * height;
          const lnpHeight = Math.max(0, Math.min(1, (lnp - MIN_PCT) / range)) * height;

          return (
            <View
              key={i}
              style={{
                flex: 1,
                height,
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 1,
                paddingHorizontal: 1,
              }}
            >
              <View style={{
                width: '40%',
                height: alpHeight,
                backgroundColor: ALP_COLOR,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
                opacity: 0.8,
              }} />
              <View style={{
                width: '40%',
                height: lnpHeight,
                backgroundColor: LNP_COLOR,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
                opacity: 0.8,
              }} />
            </View>
          );
        })}
      </View>

      {/* Date labels — first and last */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 9, color: colors.textMuted }}>
          {formatShortDate(points[0].date)}
        </Text>
        <Text style={{ fontSize: 9, color: colors.textMuted }}>
          {formatShortDate(points[points.length - 1].date)}
        </Text>
      </View>

      {/* Latest values */}
      {points.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: SPACING.xs }}>
          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold as any, color: ALP_COLOR }}>
            ALP {points[points.length - 1].tpp_alp?.toFixed(1)}%
          </Text>
          <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold as any, color: LNP_COLOR }}>
            L/NP {points[points.length - 1].tpp_lnp?.toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
