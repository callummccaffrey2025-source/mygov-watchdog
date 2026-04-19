import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, SPACE } from '../../theme/tokens';

interface PullquoteProps {
  text: string;
  source: string;
  sourceUrl?: string;
}

export function Pullquote({ text, source, sourceUrl }: PullquoteProps) {
  const c = useEditorialTheme();

  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: c.hairline, paddingLeft: SPACE.md, paddingVertical: SPACE.xs }}>
      <Text style={{ ...TYPE.h3, fontStyle: 'italic', color: c.textPrimary, marginBottom: SPACE.xs }}>
        "{text}"
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
        <Text style={{ ...TYPE.meta, color: c.textTertiary }}>
          {source}
        </Text>
        {sourceUrl ? (
          <Pressable onPress={() => Linking.openURL(sourceUrl)} hitSlop={8}>
            <Text style={{ ...TYPE.meta, color: c.textTertiary, textDecorationLine: 'underline' }}>
              Read in Hansard
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
