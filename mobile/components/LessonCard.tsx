import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, colors as tokenColors } from '../theme/tokens';
import { AppText } from './ui/AppText';
import { Card } from './ui/Card';

interface LessonCardProps {
  title: string;
  icon: string | null;
  color: string | null;
  lessonCount: number;
  completedCount: number;
  onPress: () => void;
}

export const LessonCard = React.memo(function LessonCard({ title, icon, color, lessonCount, completedCount, onPress }: LessonCardProps) {
  const progress = lessonCount > 0 ? completedCount / lessonCount : 0;
  const cardColor = color || tokenColors.accent;

  return (
    <Card
      onPress={onPress}
      elevated
      style={{
        flex: 1,
        margin: spacing.xs,
        minHeight: 160,
        justifyContent: 'space-between',
      }}
    >
      <View style={{
        width: 48,
        height: 48,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: cardColor + '15',
        marginBottom: spacing.md,
      }}>
        <Ionicons name={(icon as any) || 'book'} size={28} color={cardColor} />
      </View>

      <AppText
        variant="body"
        style={{ fontWeight: '600', lineHeight: 20, marginBottom: spacing.md }}
        numberOfLines={2}
      >
        {title}
      </AppText>

      {/* Progress bar */}
      <View style={{ gap: spacing.xs }}>
        <View style={{
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          backgroundColor: tokenColors.border,
        }}>
          <View style={{
            height: '100%',
            borderRadius: 3,
            width: `${progress * 100}%`,
            backgroundColor: tokenColors.accent,
          }} />
        </View>
        <AppText variant="caption" color="textMuted">
          {completedCount}/{lessonCount}
        </AppText>
      </View>
    </Card>
  );
});
