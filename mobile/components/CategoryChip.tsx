import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function CategoryChip({ label, active, onPress }: Props) {
  return (
    <Pressable
      style={[styles.chip, active && styles.activeChip]}
      onPress={onPress}
    >
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e8ecf0',
    marginRight: 8,
  },
  activeChip: { backgroundColor: '#00843D', borderColor: '#00843D' },
  text: { fontSize: 13, color: '#5a6a7a', fontWeight: '500' },
  activeText: { color: '#ffffff' },
});
