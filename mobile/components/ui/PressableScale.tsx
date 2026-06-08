import React, { useRef } from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  scaleTo?: number;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({
  scaleTo = 0.97,
  haptic = true,
  onPressIn,
  onPressOut,
  style,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style as any]}>
      <Pressable
        hitSlop={8}
        {...rest}
        onPressIn={(e) => {
          Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
          if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
