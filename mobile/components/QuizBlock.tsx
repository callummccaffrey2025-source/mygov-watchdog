import React, { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { spacing, radius, colors as tokenColors } from '../theme/tokens';
import { AppText } from './ui/AppText';
import { Card } from './ui/Card';
import { PressableScale } from './ui/PressableScale';

interface QuizBlockProps {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  onAnswer?: (isCorrect: boolean) => void;
}

export function QuizBlock({ question, options, correct, explanation, onAnswer }: QuizBlockProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    const isCorrect = index === correct;
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    onAnswer?.(isCorrect);
  };

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md }}>
        <Ionicons name="help-circle" size={20} color={tokenColors.accent} />
        <AppText variant="label" color="accent" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Quiz
        </AppText>
      </View>

      <AppText variant="heading" style={{ marginBottom: spacing.lg, lineHeight: 24 }}>
        {question}
      </AppText>

      {options.map((option, i) => {
        const isCorrectOption = i === correct;
        const isSelected = i === selected;
        let bg = tokenColors.background;
        let borderCol = tokenColors.border;

        if (answered) {
          if (isCorrectOption) { bg = tokenColors.accentMuted; borderCol = tokenColors.success; }
          else if (isSelected && !isCorrectOption) { bg = '#fdecea'; borderCol = tokenColors.danger; }
        }

        return (
          <PressableScale
            key={i}
            onPress={() => handleSelect(i)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: borderCol,
              backgroundColor: bg,
              marginBottom: spacing.sm,
            }}
          >
            <AppText variant="body" style={{ flex: 1, marginRight: spacing.sm }}>
              {option}
            </AppText>
            {answered && isCorrectOption && (
              <Ionicons name="checkmark-circle" size={20} color={tokenColors.success} />
            )}
            {answered && isSelected && !isCorrectOption && (
              <Ionicons name="close-circle" size={20} color={tokenColors.danger} />
            )}
          </PressableScale>
        );
      })}

      {answered && (
        <View style={{
          marginTop: spacing.md,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: tokenColors.accentMuted,
        }}>
          <AppText variant="callout" style={{ lineHeight: 20 }}>
            {explanation}
          </AppText>
        </View>
      )}
    </Card>
  );
}
