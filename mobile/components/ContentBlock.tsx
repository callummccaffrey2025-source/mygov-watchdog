import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';
import { QuizBlock } from './QuizBlock';
import type { ContentBlock as ContentBlockType } from '../hooks/useLesson';

interface ContentBlockProps {
  block: ContentBlockType;
  onQuizAnswer?: (isCorrect: boolean) => void;
  onRealDataPress?: (entity: string, id: string) => void;
}

export function ContentBlock({ block, onQuizAnswer, onRealDataPress }: ContentBlockProps) {
  const { colors } = useTheme();

  switch (block.type) {
    case 'text':
      return (
        <View style={styles.textBlock}>
          {block.title && (
            <Text style={[styles.textTitle, { color: colors.text }]}>{block.title}</Text>
          )}
          <Text style={[styles.textBody, { color: colors.text }]}>{block.body}</Text>
        </View>
      );

    case 'fact':
      return (
        <View style={[styles.factBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.factEmoji}>{block.emoji}</Text>
          <Text style={[styles.factText, { color: colors.text }]}>{block.text}</Text>
        </View>
      );

    case 'quiz':
      return (
        <QuizBlock
          question={block.question}
          options={block.options}
          correct={block.correct}
          explanation={block.explanation}
          onAnswer={onQuizAnswer}
        />
      );

    case 'diagram':
      return (
        <View style={[styles.diagramBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="image-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.diagramCaption, { color: colors.textMuted }]}>{block.caption}</Text>
        </View>
      );

    case 'real_data':
      return (
        <Pressable
          onPress={() => onRealDataPress?.(block.entity, block.id)}
          style={[styles.realDataBlock, { backgroundColor: colors.surface, borderColor: '#00843D' }]}
        >
          <View style={styles.realDataHeader}>
            <Ionicons
              name={block.entity === 'bill' ? 'document-text' : block.entity === 'member' ? 'person' : 'hand-left'}
              size={18}
              color="#00843D"
            />
            <Text style={[styles.realDataLabel, { color: '#00843D' }]}>
              See real {block.entity === 'bill' ? 'bill' : block.entity === 'member' ? 'MP' : 'vote'}
            </Text>
          </View>
          <Text style={[styles.realDataCaption, { color: colors.text }]}>{block.caption}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.realDataChevron} />
        </Pressable>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  textBlock: {
    marginBottom: SPACING.lg,
  },
  textTitle: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: SPACING.sm,
  },
  textBody: {
    fontSize: FONT_SIZE.body,
    lineHeight: 24,
  },
  factBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  factEmoji: {
    fontSize: 24,
  },
  factText: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
    flex: 1,
  },
  diagramBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    minHeight: 120,
  },
  diagramCaption: {
    fontSize: FONT_SIZE.small,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  realDataBlock: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: SPACING.lg,
  },
  realDataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  realDataLabel: {
    fontSize: FONT_SIZE.small,
    fontWeight: FONT_WEIGHT.semibold as any,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  realDataCaption: {
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
  },
  realDataChevron: {
    position: 'absolute',
    right: SPACING.lg,
    top: '50%',
  },
});
