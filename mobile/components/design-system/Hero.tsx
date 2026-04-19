import React from 'react';
import { View, Text } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, SPACE } from '../../theme/tokens';

interface HeroProps {
  label: string;
  title: string;
  meta?: string;
  size?: 'hero' | 'h1';
}

export function Hero({ label, title, meta, size = 'hero' }: HeroProps) {
  const c = useEditorialTheme();
  const titleStyle = size === 'hero' ? TYPE.heroHeadline : TYPE.h1;

  return (
    <View style={{ gap: SPACE.xxs }}>
      <Text style={{ ...TYPE.caption, color: c.textTertiary }}>
        {label}
      </Text>
      <Text style={{ ...titleStyle, color: c.textPrimary }}>
        {title}
      </Text>
      {meta ? (
        <Text style={{ ...TYPE.meta, color: c.textTertiary, marginTop: SPACE.xxs }}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}
