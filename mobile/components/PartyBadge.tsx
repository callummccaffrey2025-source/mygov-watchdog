import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  name: string;
  colour?: string | null;
  size?: 'sm' | 'md';
}

export function PartyBadge({ name, colour, size = 'md' }: Props) {
  const bg = colour || '#9aabb8';
  const isLight = isColorLight(bg);
  const textColor = isLight ? '#1a2332' : '#ffffff';
  const small = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.small]}>
      <Text style={[styles.text, { color: textColor }, small && styles.smallText]}>{name}</Text>
    </View>
  );
}

function isColorLight(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  small: { paddingHorizontal: 7, paddingVertical: 2 },
  text: { fontSize: 12, fontWeight: '600' },
  smallText: { fontSize: 10 },
});
