import React from 'react';
import { View, Text } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, SPACE, LAYOUT } from '../../theme/tokens';

interface StatRowProps {
  value: string;
  label: string;
  percentile: number;
  isHighlight?: boolean;
  caption?: string;
}

export function StatRow({ value, label, percentile, isHighlight, caption }: StatRowProps) {
  const c = useEditorialTheme();
  const barColor = isHighlight ? c.brandGreen : c.textTertiary;
  const clampedPercentile = Math.max(0, Math.min(100, percentile));

  return (
    <View style={{ paddingVertical: SPACE.sm }}>
      {/* Top: stat number + label */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SPACE.xs, marginBottom: SPACE.xs }}>
        <Text style={{ ...TYPE.statNumber, color: isHighlight ? c.brandGreen : c.textPrimary }}>
          {value}
        </Text>
        <Text style={{ ...TYPE.label, color: c.textSecondary }}>
          {label}
        </Text>
      </View>

      {/* Percentile bar */}
      <View style={{ height: 4, backgroundColor: c.hairline, borderRadius: 2, position: 'relative' }}>
        {/* Fill */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${clampedPercentile}%`,
            backgroundColor: barColor,
            borderRadius: 2,
            opacity: 0.7,
          }}
        />
        {/* 50% tick marker */}
        <View
          style={{
            position: 'absolute',
            left: '50%',
            top: -2,
            bottom: -2,
            width: LAYOUT.hairlineHeight,
            backgroundColor: c.softBorder,
          }}
        />
      </View>

      {/* Caption */}
      {caption ? (
        <Text style={{ ...TYPE.meta, color: c.textTertiary, marginTop: SPACE.xxs }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
