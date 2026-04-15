import React from 'react';
import { View, ViewStyle } from 'react-native';
import { BORDER_RADIUS, SHADOWS, SPACING } from '../constants/design';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export function Card({ children, style, padding = SPACING.lg }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: BORDER_RADIUS.lg,
          padding,
          ...SHADOWS.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
