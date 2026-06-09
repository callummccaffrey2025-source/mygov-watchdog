import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>{icon}</Text>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 15, fontWeight: '400', color: colors.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 22 }}>
        {subtitle}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          style={{ backgroundColor: '#00843D', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, marginTop: 24 }}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
