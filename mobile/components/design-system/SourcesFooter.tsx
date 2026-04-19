import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, SPACE } from '../../theme/tokens';

interface SourcesFooterProps {
  sources: string[];
  lastUpdated?: string;
  onReport?: () => void;
}

export function SourcesFooter({ sources, lastUpdated, onReport }: SourcesFooterProps) {
  const c = useEditorialTheme();

  return (
    <View style={{ paddingVertical: SPACE.lg, gap: SPACE.xxs }}>
      <Text style={{ ...TYPE.meta, color: c.textQuiet }}>
        Sources: {sources.join(' · ')}
      </Text>
      {lastUpdated ? (
        <Text style={{ ...TYPE.meta, color: c.textQuiet }}>
          Last updated {lastUpdated}
        </Text>
      ) : null}
      {onReport ? (
        <Pressable onPress={onReport} hitSlop={8}>
          <Text style={{ ...TYPE.meta, color: c.textQuiet, textDecorationLine: 'underline' }}>
            Report something wrong
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
