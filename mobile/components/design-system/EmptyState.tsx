import React from 'react';
import { View, Text } from 'react-native';
import { useEditorialTheme } from '../../theme/useEditorialTheme';
import { TYPE, SPACE } from '../../theme/tokens';

interface EmptyStateProps {
  title: string;
  explanation: string;
  available?: string;
}

export function EmptyState({ title, explanation, available }: EmptyStateProps) {
  const c = useEditorialTheme();

  return (
    <View style={{ paddingVertical: SPACE.xl }}>
      <Text style={{ ...TYPE.h3, color: c.textPrimary, marginBottom: SPACE.xs }}>
        {title}
      </Text>
      <Text style={{ ...TYPE.body, color: c.textSecondary, marginBottom: available ? SPACE.sm : 0 }}>
        {explanation}
      </Text>
      {available ? (
        <Text style={{ ...TYPE.meta, color: c.textTertiary }}>
          {available}
        </Text>
      ) : null}
    </View>
  );
}
