import React from 'react';
import { View, Text } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, LAYOUT, SPACE } from '../../theme/tokens';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'aye' | 'no' | 'warning';
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const c = useEditorialTheme();

  const bgMap = {
    default: 'transparent',
    aye: c.semanticAye + '18',
    no: c.semanticNo + '18',
    warning: c.semanticWarning + '18',
  };
  const textMap = {
    default: c.textTertiary,
    aye: c.semanticAye,
    no: c.semanticNo,
    warning: c.semanticWarning,
  };

  return (
    <View style={{
      backgroundColor: bgMap[variant],
      borderRadius: LAYOUT.badgeRadius,
      paddingHorizontal: SPACE.xs,
      paddingVertical: 2,
    }}>
      <Text style={{ ...TYPE.caption, color: textMap[variant] }}>
        {label}
      </Text>
    </View>
  );
}
