import React from 'react';
import { View, Text } from 'react-native';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, PARTY_COLORS } from '../constants/design';
import { useTheme } from '../context/ThemeContext';

interface PollDataPoint {
  date: string;
  tpp_alp: number | null;
  tpp_lnp: number | null;
  primary_alp?: number | null;
  primary_lnp?: number | null;
  primary_grn?: number | null;
  primary_one_nation?: number | null;
  pollster?: string;
}

interface PollTrendChartProps {
  data: PollDataPoint[];
  mode?: 'tpp' | 'primary';
  height?: number;
}

const MIDLINE_COLOR = '#E0E0E0';

/**
 * Two-mode trend chart: TPP (two-party bars) or Primary (four-party grouped bars).
 * Pure React Native — no SVG dependency.
 */
export function PollTrendChart({ data, mode = 'tpp', height = 140 }: PollTrendChartProps) {
  const { colors } = useTheme();

  if (!data || data.length === 0) return null;

  // Take latest 12 points, sorted oldest → newest
  const points = data
    .filter(d => d.tpp_alp != null && d.tpp_lnp != null)
    .slice(-12);

  if (points.length < 2) return null;

  if (mode === 'primary') {
    return <PrimaryChart points={points} height={height} colors={colors} />;
  }

  return <TppChart points={points} height={height} colors={colors} />;
}

function TppChart({ points, height, colors }: { points: PollDataPoint[]; height: number; colors: any }) {
  const MIN_PCT = 40;
  const MAX_PCT = 60;
  const range = MAX_PCT - MIN_PCT;

  return (
    <View style={{ marginVertical: SPACING.sm }}>
      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: SPACING.xs }}>
        <LegendItem color={PARTY_COLORS.ALP} label="ALP" />
        <LegendItem color={PARTY_COLORS.LNP} label="L/NP" />
      </View>

      {/* Chart area */}
      <View style={{
        height, flexDirection: 'row', alignItems: 'flex-end',
        borderRadius: BORDER_RADIUS.md, backgroundColor: colors.surface,
        overflow: 'hidden', position: 'relative',
      }}>
        {/* 50% midline */}
        <View style={{
          position: 'absolute', left: 0, right: 0,
          top: height * ((MAX_PCT - 50) / range), height: 1,
          backgroundColor: MIDLINE_COLOR, zIndex: 1,
        }} />
        <Text style={{
          position: 'absolute', right: 4,
          top: height * ((MAX_PCT - 50) / range) - 12,
          fontSize: 9, color: colors.textMuted, zIndex: 2,
        }}>50%</Text>

        {points.map((point, i) => {
          const alp = point.tpp_alp ?? 50;
          const lnp = point.tpp_lnp ?? 50;
          const alpHeight = Math.max(0, Math.min(1, (alp - MIN_PCT) / range)) * height;
          const lnpHeight = Math.max(0, Math.min(1, (lnp - MIN_PCT) / range)) * height;

          return (
            <View key={i} style={{ flex: 1, height, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1, paddingHorizontal: 1 }}>
              <View style={{ width: '40%', height: alpHeight, backgroundColor: PARTY_COLORS.ALP, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.85 }} />
              <View style={{ width: '40%', height: lnpHeight, backgroundColor: PARTY_COLORS.LNP, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.85 }} />
            </View>
          );
        })}
      </View>

      <DateLabels points={points} colors={colors} />

      {/* Latest values */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: SPACING.xs }}>
        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold as any, color: PARTY_COLORS.ALP }}>
          ALP {points[points.length - 1].tpp_alp?.toFixed(1)}%
        </Text>
        <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold as any, color: PARTY_COLORS.LNP }}>
          L/NP {points[points.length - 1].tpp_lnp?.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

function PrimaryChart({ points, height, colors }: { points: PollDataPoint[]; height: number; colors: any }) {
  // Primary vote range: 0-40% captures the full spread
  const MAX_PCT = 40;

  return (
    <View style={{ marginVertical: SPACING.sm }}>
      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: SPACING.xs, flexWrap: 'wrap' }}>
        <LegendItem color={PARTY_COLORS.ALP} label="ALP" />
        <LegendItem color={PARTY_COLORS.ONP} label="ONP" />
        <LegendItem color={PARTY_COLORS.LNP} label="L/NP" />
        <LegendItem color={PARTY_COLORS.GRN} label="GRN" />
      </View>

      {/* Chart area */}
      <View style={{
        height, flexDirection: 'row', alignItems: 'flex-end',
        borderRadius: BORDER_RADIUS.md, backgroundColor: colors.surface,
        overflow: 'hidden',
      }}>
        {points.map((point, i) => {
          const alp = point.primary_alp ?? 0;
          const onp = point.primary_one_nation ?? 0;
          const lnp = point.primary_lnp ?? 0;
          const grn = point.primary_grn ?? 0;

          const alpH = (alp / MAX_PCT) * height;
          const onpH = (onp / MAX_PCT) * height;
          const lnpH = (lnp / MAX_PCT) * height;
          const grnH = (grn / MAX_PCT) * height;

          return (
            <View key={i} style={{ flex: 1, height, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 0.5, paddingHorizontal: 0.5 }}>
              <View style={{ width: '22%', height: alpH, backgroundColor: PARTY_COLORS.ALP, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5, opacity: 0.85 }} />
              <View style={{ width: '22%', height: onpH, backgroundColor: PARTY_COLORS.ONP, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5, opacity: 0.85 }} />
              <View style={{ width: '22%', height: lnpH, backgroundColor: PARTY_COLORS.LNP, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5, opacity: 0.85 }} />
              <View style={{ width: '22%', height: grnH, backgroundColor: PARTY_COLORS.GRN, borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5, opacity: 0.85 }} />
            </View>
          );
        })}
      </View>

      <DateLabels points={points} colors={colors} />

      {/* Latest values */}
      {points.length > 0 && (() => {
        const latest = points[points.length - 1];
        return (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: SPACING.xs, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold as any, color: PARTY_COLORS.ALP }}>
              ALP {latest.primary_alp}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold as any, color: PARTY_COLORS.ONP }}>
              ONP {latest.primary_one_nation}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold as any, color: PARTY_COLORS.LNP }}>
              L/NP {latest.primary_lnp}
            </Text>
            <Text style={{ fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.bold as any, color: PARTY_COLORS.GRN }}>
              GRN {latest.primary_grn}
            </Text>
          </View>
        );
      })()}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: FONT_SIZE.caption, color: colors.textMuted }}>{label}</Text>
    </View>
  );
}

function DateLabels({ points, colors }: { points: PollDataPoint[]; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
      <Text style={{ fontSize: 9, color: colors.textMuted }}>
        {formatShortDate(points[0].date)}
      </Text>
      <Text style={{ fontSize: 9, color: colors.textMuted }}>
        {formatShortDate(points[points.length - 1].date)}
      </Text>
    </View>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}
