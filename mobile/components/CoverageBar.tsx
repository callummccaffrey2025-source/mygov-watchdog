import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  left: number;
  center: number;
  right: number;
  height?: number;
  showLabel?: boolean;
}

export function CoverageBar({ left, center, right, height = 8, showLabel = false }: Props) {
  const total = left + center + right;
  const sourceCount = left + center + right;

  if (total === 0) {
    return (
      <View>
        <View style={[styles.track, { height, backgroundColor: '#E5E7EB' }]} />
        {showLabel && <Text style={styles.label}>No coverage yet</Text>}
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.track, { height }]}>
        {left > 0 && (
          <View style={[styles.segment, { flex: left, backgroundColor: '#4C9BE8' }]} />
        )}
        {center > 0 && (
          <View style={[styles.segment, { flex: center, backgroundColor: '#9aabb8' }]} />
        )}
        {right > 0 && (
          <View style={[styles.segment, { flex: right, backgroundColor: '#DC3545' }]} />
        )}
      </View>
      {showLabel && (
        <Text style={styles.label}>{sourceCount} source{sourceCount !== 1 ? 's' : ''}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  label: {
    fontSize: 11,
    color: '#9aabb8',
    marginTop: 4,
  },
});
