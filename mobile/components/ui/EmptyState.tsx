import React from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { colors, spacing, radius } from '../../theme/tokens';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xxxl,
        gap: spacing.sm,
      }}
    >
      {icon ? <View style={{ marginBottom: spacing.sm }}>{icon}</View> : null}
      <AppText variant="heading" center>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color="textSecondary" center>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          style={{
            marginTop: spacing.md,
            backgroundColor: colors.accent,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
          }}
        >
          <AppText variant="label" color="textInverse">
            {actionLabel}
          </AppText>
        </PressableScale>
      ) : null}
    </View>
  );
}
