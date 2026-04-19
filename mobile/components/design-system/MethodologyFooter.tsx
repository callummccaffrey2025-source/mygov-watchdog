import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, SPACE } from '../../theme/tokens';

interface MethodologyFooterProps {
  version?: string;
  onPress?: () => void;
}

export function MethodologyFooter({ version = 'v1.0', onPress }: MethodologyFooterProps) {
  const c = useEditorialTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xxs, paddingVertical: SPACE.sm }}>
      <Text style={{ ...TYPE.meta, color: c.textQuiet }}>
        Methodology {version} · Wilson 95% CI
      </Text>
      {onPress ? (
        <>
          <Text style={{ ...TYPE.meta, color: c.textQuiet }}> · </Text>
          <Pressable onPress={onPress} hitSlop={8}>
            <Text style={{ ...TYPE.meta, color: c.textQuiet, textDecorationLine: 'underline' }}>
              How we calculate
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
