import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';

interface QuizBlockProps {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  onAnswer?: (isCorrect: boolean) => void;
}

export function QuizBlock({ question, options, correct, explanation, onAnswer }: QuizBlockProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    onAnswer?.(index === correct);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="help-circle" size={20} color="#00843D" />
        <Text style={[styles.label, { color: '#00843D' }]}>Quiz</Text>
      </View>
      <Text style={[styles.question, { color: colors.text }]}>{question}</Text>

      {options.map((option, i) => {
        const isCorrect = i === correct;
        const isSelected = i === selected;
        let bg = colors.background;
        let borderCol = colors.border;

        if (answered) {
          if (isCorrect) { bg = '#e6f4ed'; borderCol = '#00843D'; }
          else if (isSelected && !isCorrect) { bg = '#fdecea'; borderCol = '#DC3545'; }
        }

        return (
          <Pressable
            key={i}
            onPress={() => handleSelect(i)}
            style={[styles.option, { backgroundColor: bg, borderColor: borderCol }]}
          >
            <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
            {answered && isCorrect && (
              <Ionicons name="checkmark-circle" size={20} color="#00843D" />
            )}
            {answered && isSelected && !isCorrect && (
              <Ionicons name="close-circle" size={20} color="#DC3545" />
            )}
          </Pressable>
        );
      })}

      {answered && (
        <View style={[styles.explanation, { backgroundColor: '#f0f7f4' }]}>
          <Text style={[styles.explanationText, { color: colors.text }]}>{explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.semibold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  question: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold as any,
    marginBottom: SPACING.lg,
    lineHeight: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    marginBottom: SPACING.sm,
  },
  optionText: {
    fontSize: FONT_SIZE.body,
    flex: 1,
    marginRight: SPACING.sm,
  },
  explanation: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  explanationText: {
    fontSize: FONT_SIZE.small,
    lineHeight: 20,
  },
});
