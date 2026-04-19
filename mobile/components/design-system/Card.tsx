import React from 'react';
import { View } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { LAYOUT } from '../../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function Card({ children, noPadding }: CardProps) {
  const c = useEditorialTheme();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: LAYOUT.cardRadius,
        borderWidth: LAYOUT.hairlineHeight,
        borderColor: c.hairline,
        padding: noPadding ? 0 : LAYOUT.cardPadding,
      }}
    >
      {children}
    </View>
  );
}
