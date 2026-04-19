import React from 'react';
import { View } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { LAYOUT } from '../../theme/tokens';

export function Divider() {
  const c = useEditorialTheme();
  return (
    <View style={{ height: LAYOUT.hairlineHeight, backgroundColor: c.hairline }} />
  );
}
