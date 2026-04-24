import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Maps both short code values and the real verbose DB strings to display config
const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  // Short codes (legacy / scripts)
  'passed': { bg: '#E8F5EE', text: '#00843D', label: 'Passed' },
  'royal_assent': { bg: '#E8F5EE', text: '#00843D', label: 'Passed' },
  'act': { bg: '#E8F5EE', text: '#00843D', label: 'Passed' },
  'defeated': { bg: '#FDECEA', text: '#DC3545', label: 'Defeated' },
  'withdrawn': { bg: '#F3F4F6', text: '#6B7280', label: 'Withdrawn' },
  'lapsed': { bg: '#F3F4F6', text: '#6B7280', label: 'Lapsed' },
  'introduced': { bg: '#E8F0FE', text: '#0066CC', label: 'Active' },
  'before_senate': { bg: '#E8F0FE', text: '#0066CC', label: 'Before Senate' },
  'before_house': { bg: '#E8F0FE', text: '#0066CC', label: 'Before House' },
  'second_reading': { bg: '#E8F0FE', text: '#0066CC', label: 'Active' },

  // Real DB values from current_status column
  'passed both houses': { bg: '#E8F5EE', text: '#00843D', label: 'Passed' },
  'before house of representatives': { bg: '#E8F0FE', text: '#0066CC', label: 'Before House' },
  'before senate': { bg: '#E8F0FE', text: '#0066CC', label: 'Before Senate' },
  'second reading': { bg: '#E8F0FE', text: '#0066CC', label: 'Active' },
  'in search index': { bg: '#F3F4F6', text: '#6B7280', label: 'Archived' },
  'royal assent': { bg: '#E8F5EE', text: '#00843D', label: 'Passed' },
  'awaiting assent': { bg: '#E8F5EE', text: '#00843D', label: 'Awaiting Assent' },
  'committee': { bg: '#FFF7E6', text: '#B45309', label: 'In Committee' },
  'third reading': { bg: '#E8F0FE', text: '#0066CC', label: 'Active' },
  'first reading': { bg: '#E8F0FE', text: '#0066CC', label: 'Active' },

  // Current real DB values
  'historical': { bg: '#F3F4F6', text: '#6B7280', label: 'Historical' },
  'before parliament': { bg: '#E8F0FE', text: '#0066CC', label: 'Before Parliament' },
  'before house': { bg: '#E8F0FE', text: '#0066CC', label: 'Before House' },
  'enacted': { bg: '#E8F5EE', text: '#00843D', label: 'Enacted' },
};

interface Props {
  status: string | null;
}

export function StatusBadge({ status }: Props) {
  const key = (status || '').toLowerCase().trim();
  const config = STATUS_CONFIG[key] ?? { bg: '#F3F4F6', text: '#6B7280', label: toTitleCase(status) };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function toTitleCase(s: string | null): string {
  if (!s) return 'Unknown';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600' },
});
