import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { typography, lightColors, tabularNums } from '../../theme/tokens';

type Variant = keyof typeof typography;
type ColorKey = keyof typeof lightColors;

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: ColorKey;
  tabular?: boolean;
  center?: boolean;
  style?: TextStyle | TextStyle[];
}

export function AppText({
  variant = 'body',
  color = 'textPrimary',
  tabular = false,
  center = false,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        typography[variant] as TextStyle,
        { color: lightColors[color] },
        center ? { textAlign: 'center' } : null,
        tabular ? tabularNums : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
