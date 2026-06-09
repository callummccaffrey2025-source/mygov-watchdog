import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, colors as tokenColors } from '../theme/tokens';
import { AppText } from './ui/AppText';
import { Card } from './ui/Card';
import { PressableScale } from './ui/PressableScale';
import { QuizBlock } from './QuizBlock';
import type { ContentBlock as ContentBlockType } from '../hooks/useLesson';
import { decodeHtml } from '../utils/decodeHtml';

interface ContentBlockProps {
  block: ContentBlockType;
  onQuizAnswer?: (isCorrect: boolean) => void;
  onRealDataPress?: (entity: string, id: string) => void;
}

export function ContentBlock({ block, onQuizAnswer, onRealDataPress }: ContentBlockProps) {
  switch (block.type) {
    case 'text':
      return (
        <View style={{ marginBottom: spacing.lg }}>
          {block.title && (
            <AppText variant="title" style={{ marginBottom: spacing.sm }}>
              {block.title}
            </AppText>
          )}
          <AppText variant="body" style={{ lineHeight: 24 }}>
            {decodeHtml(block.body)}
          </AppText>
        </View>
      );

    case 'fact':
      return (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }}>
          <AppText variant="title" style={{ fontSize: 24 }}>{block.emoji}</AppText>
          <AppText variant="body" style={{ lineHeight: 22, flex: 1 }}>
            {decodeHtml(block.text)}
          </AppText>
        </Card>
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
        <Card style={{
          alignItems: 'center', justifyContent: 'center',
          marginBottom: spacing.lg, minHeight: 120,
        }}>
          <Ionicons name="image-outline" size={48} color={tokenColors.textMuted} />
          <AppText variant="caption" color="textMuted" center style={{ marginTop: spacing.sm }}>
            {block.caption}
          </AppText>
        </Card>
      );

    case 'real_data':
      return (
        <PressableScale
          onPress={() => onRealDataPress?.(block.entity, block.id)}
          style={{
            padding: spacing.lg,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderStyle: 'dashed' as any,
            borderColor: tokenColors.accent,
            backgroundColor: tokenColors.surface,
            marginBottom: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
            <Ionicons
              name={block.entity === 'bill' ? 'document-text' : block.entity === 'member' ? 'person' : 'hand-left'}
              size={18}
              color={tokenColors.accent}
            />
            <AppText variant="label" color="accent" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              See real {block.entity === 'bill' ? 'bill' : block.entity === 'member' ? 'MP' : 'vote'}
            </AppText>
          </View>
          <AppText variant="body" style={{ lineHeight: 22 }}>
            {block.caption}
          </AppText>
        </PressableScale>
      );

    default:
      return null;
  }
}
