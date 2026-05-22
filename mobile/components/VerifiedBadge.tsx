import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export function VerifiedBadge({ size = 14 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Verified Member of Parliament" style={{ marginLeft: 3 }}>
      <Ionicons name="checkmark-circle" size={size} color={colors.green} />
    </View>
  );
}
