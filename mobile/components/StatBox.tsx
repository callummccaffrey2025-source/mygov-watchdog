import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  value: string;
  label: string;
}

export function StatBox({ value, label }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1 },
  value: { fontSize: 24, fontWeight: '800', color: '#1a2332' },
  label: { fontSize: 11, color: '#9aabb8', marginTop: 2, textAlign: 'center' },
});
