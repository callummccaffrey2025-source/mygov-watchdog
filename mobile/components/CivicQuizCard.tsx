import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CivicQuizQuestion, QuizStats } from '../hooks/useCivicQuiz';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../lib/haptics';

interface Props {
  question: CivicQuizQuestion;
  onAnswer: (index: number) => Promise<QuizStats>;
  onDismiss: () => void;
}

export function CivicQuizCard({ question, onAnswer, onDismiss }: Props) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const [stats, setStats] = useState<QuizStats | null>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const correctScale = useRef(new Animated.Value(1)).current;

  const isCorrect = selected !== null && selected === question.correct_answer;
  const isIncorrect = selected !== null && selected !== question.correct_answer;

  const handleSelect = async (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    hapticLight();

    // Fire submit, fetch stats
    const result = await onAnswer(index);
    setStats(result);

    // Flash animation
    const correct = index === question.correct_answer;
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Micro "confetti" bounce if correct
    if (correct) {
      Animated.sequence([
        Animated.spring(correctScale, { toValue: 1.1, useNativeDriver: true, damping: 8, stiffness: 200 }),
        Animated.spring(correctScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 150 }),
      ]).start();
    }
  };

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24, backgroundColor: colors.card, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, overflow: 'hidden' }}>
      {/* Flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: isCorrect ? '#10B981' : isIncorrect ? '#EF4444' : 'transparent',
          opacity: flashOpacity,
        }}
      />

      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="bulb-outline" size={14} color="#D97706" />
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706', letterSpacing: 0.8 }}>DAILY CIVIC QUIZ</Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={12}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Question */}
      <Animated.Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, lineHeight: 22, marginBottom: 12, transform: [{ scale: correctScale }] }}>
        {question.question}
      </Animated.Text>

      {/* Options */}
      <View style={{ gap: 8 }}>
        {question.options.map((option, i) => {
          const thisSelected = selected === i;
          const thisCorrect = selected !== null && i === question.correct_answer;
          const thisWrong = thisSelected && !thisCorrect;

          let bg = colors.background;
          let borderColor = colors.border;
          let textColor = colors.text;
          let icon = null;

          if (selected !== null) {
            if (thisCorrect) {
              bg = '#D1FAE5';
              borderColor = '#10B981';
              textColor = '#065F46';
              icon = <Ionicons name="checkmark-circle" size={18} color="#10B981" />;
            } else if (thisWrong) {
              bg = '#FEE2E2';
              borderColor = '#EF4444';
              textColor = '#991B1B';
              icon = <Ionicons name="close-circle" size={18} color="#EF4444" />;
            } else {
              bg = colors.background;
              textColor = colors.textMuted;
            }
          }

          return (
            <Pressable
              key={i}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: bg, borderWidth: 1.5, borderColor,
                borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
                gap: 10,
              }}
              onPress={() => handleSelect(i)}
              disabled={selected !== null}
            >
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                borderWidth: 1.5, borderColor: borderColor,
                justifyContent: 'center', alignItems: 'center',
                backgroundColor: selected === null ? colors.background : 'transparent',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: textColor }}>
                  {String.fromCharCode(65 + i)}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: textColor, lineHeight: 20 }}>
                {option}
              </Text>
              {icon}
            </Pressable>
          );
        })}
      </View>

      {/* Explanation + stats */}
      {selected !== null && (
        <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: isCorrect ? '#065F46' : '#991B1B', marginBottom: 4 }}>
            {isCorrect ? '✓ Correct!' : '✗ Not quite.'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textBody, lineHeight: 19, marginBottom: 8 }}>
            {question.explanation}
          </Text>
          {stats && stats.total_answers > 0 && (
            <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
              {stats.correct_pct}% of Verity users got this right
            </Text>
          )}
          {question.source_url && (
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
              onPress={() => Linking.openURL(question.source_url!)}
            >
              <Ionicons name="link-outline" size={12} color="#00843D" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#00843D' }}>Source</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
