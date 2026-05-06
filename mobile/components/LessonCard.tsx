import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

interface LessonCardProps {
  title: string;
  icon: string | null;
  color: string | null;
  lessonCount: number;
  completedCount: number;
  onPress: () => void;
}

export function LessonCard({ title, icon, color, lessonCount, completedCount, onPress }: LessonCardProps) {
  const { colors } = useTheme();
  const progress = lessonCount > 0 ? completedCount / lessonCount : 0;
  const cardColor = color || '#00843D';

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, SHADOWS.sm]}
    >
      <View style={[styles.iconContainer, { backgroundColor: cardColor + '15' }]}>
        <Ionicons name={(icon as any) || 'book'} size={28} color={cardColor} />
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: cardColor }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {completedCount}/{lessonCount}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    margin: SPACING.xs,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold as any,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  progressContainer: {
    gap: SPACING.xs,
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.medium as any,
  },
});
