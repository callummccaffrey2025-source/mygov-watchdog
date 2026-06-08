import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, spacing, elevation } from '../../theme/tokens';
import { PressableScale } from './PressableScale';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  onPress,
  padded = true,
  elevated = false,
  style,
}: CardProps) {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: elevated ? 0 : 1,
    borderColor: colors.border,
    padding: padded ? spacing.lg : 0,
    ...(elevated ? elevation.md : {}),
  };

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={[base, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
