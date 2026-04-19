import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE } from '../../theme/tokens';

interface SectionHeadingProps {
  title: string;
  meta?: string;
  onMetaPress?: () => void;
}

export function SectionHeading({ title, meta, onMetaPress }: SectionHeadingProps) {
  const c = useEditorialTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <Text style={{ ...TYPE.h2, color: c.textPrimary }}>
        {title}
      </Text>
      {meta ? (
        onMetaPress ? (
          <Pressable onPress={onMetaPress} hitSlop={8}>
            <Text style={{ ...TYPE.meta, color: c.textTertiary, textDecorationLine: 'underline' }}>
              {meta}
            </Text>
          </Pressable>
        ) : (
          <Text style={{ ...TYPE.meta, color: c.textTertiary }}>
            {meta}
          </Text>
        )
      ) : null}
    </View>
  );
}
