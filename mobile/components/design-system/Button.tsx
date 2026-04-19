import React, { useRef } from 'react';
import { Pressable, Text, Animated } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, LAYOUT, SPACE } from '../../theme/tokens';

interface ButtonProps {
  title: string;
  variant?: 'primary' | 'ghost';
  onPress: () => void;
  compact?: boolean;
}

export function Button({ title, variant = 'primary', onPress, compact }: ButtonProps) {
  const c = useEditorialTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.97, duration: 150, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          backgroundColor: isPrimary ? c.textPrimary : 'transparent',
          borderWidth: isPrimary ? 0 : LAYOUT.hairlineHeight,
          borderColor: c.softBorder,
          borderRadius: LAYOUT.buttonRadius,
          paddingVertical: compact ? SPACE.xs : SPACE.sm,
          paddingHorizontal: compact ? SPACE.md : SPACE.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{
          ...TYPE.button,
          color: isPrimary ? c.card : c.textPrimary,
        }}>
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
