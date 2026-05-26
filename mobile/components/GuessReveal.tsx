/**
 * The Mirror — guess-then-reveal component.
 * Prompt 10: reusable across feed, MP profile, and Daily Brief.
 *
 * States: guess → reveal (with correct/incorrect animation).
 * On surprising miss, shows share prompt.
 */
import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';
import { VotePrediction } from '../hooks/useVotePrediction';

const GREEN = '#00843D';
const RED = '#DC3545';
const GREY = '#6C757D';

type GuessOption = 'aye' | 'no' | 'absent';

interface GuessRevealProps {
  divisionId: string;
  divisionName: string;
  mpName: string;
  /** If user already guessed, pass the existing prediction */
  existingPrediction: VotePrediction | null;
  /** Called when user submits a guess — should call useVotePrediction.guess() */
  onGuess: (divisionId: string, guess: GuessOption) => Promise<{ wasCorrect: boolean; actualVote: string } | null>;
  /** Called when user wants to share a surprising result */
  onShare?: (divisionId: string, mpName: string, guess: string, actual: string) => void;
}

export function GuessReveal({
  divisionId, divisionName, mpName, existingPrediction, onGuess, onShare,
}: GuessRevealProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<GuessOption | null>(null);
  const [result, setResult] = useState<{ wasCorrect: boolean; actualVote: string } | null>(
    existingPrediction?.was_correct !== null && existingPrediction?.was_correct !== undefined
      ? { wasCorrect: existingPrediction.was_correct, actualVote: existingPrediction.actual_vote ?? '' }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const revealAnim = useRef(new Animated.Value(0)).current;

  const alreadyRevealed = existingPrediction?.was_correct !== null && existingPrediction?.was_correct !== undefined;
  const guessValue = existingPrediction?.guess ?? selected;

  const handleSelect = async (option: GuessOption) => {
    if (result || submitting || alreadyRevealed) return;
    setSelected(option);
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const res = await onGuess(divisionId, option);
    if (res) {
      setResult(res);
      Haptics.notificationAsync(
        res.wasCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      );
      Animated.spring(revealAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    }
    setSubmitting(false);
  };

  const isSurprisingMiss = result && !result.wasCorrect && guessValue !== 'absent';

  const voteLabel = (v: string) =>
    v === 'aye' ? 'FOR' : v === 'no' ? 'AGAINST' : 'ABSENT';
  const voteColor = (v: string) =>
    v === 'aye' ? GREEN : v === 'no' ? RED : GREY;

  const revealed = result !== null || alreadyRevealed;

  return (
    <View style={[styles.container, { backgroundColor: colors.card }, SHADOWS.sm]}>
      {/* Question */}
      <Text style={[styles.question, { color: colors.text }]}>
        How do you think {mpName} voted?
      </Text>
      <Text style={[styles.divisionName, { color: colors.textMuted }]} numberOfLines={2}>
        {divisionName}
      </Text>

      {/* Guess buttons */}
      {!revealed ? (
        <View style={styles.buttonRow}>
          {(['aye', 'no', 'absent'] as const).map(option => {
            const isSelected = selected === option;
            const bg = option === 'aye' ? GREEN : option === 'no' ? RED : GREY;
            return (
              <Pressable
                key={option}
                onPress={() => handleSelect(option)}
                disabled={submitting}
                style={[
                  styles.guessButton,
                  { backgroundColor: isSelected ? bg : bg + '15', borderColor: bg },
                  isSelected && { borderWidth: 2 },
                ]}
              >
                <Text style={[styles.guessLabel, { color: isSelected ? '#fff' : bg }]}>
                  {voteLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        /* Reveal result */
        <Animated.View style={[styles.resultBox, { opacity: alreadyRevealed ? 1 : revealAnim }]}>
          <View style={[
            styles.resultBadge,
            { backgroundColor: (result?.wasCorrect ?? existingPrediction?.was_correct) ? GREEN + '15' : RED + '15' },
          ]}>
            <Ionicons
              name={(result?.wasCorrect ?? existingPrediction?.was_correct) ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={(result?.wasCorrect ?? existingPrediction?.was_correct) ? GREEN : RED}
            />
            <Text style={[
              styles.resultText,
              { color: (result?.wasCorrect ?? existingPrediction?.was_correct) ? GREEN : RED },
            ]}>
              {(result?.wasCorrect ?? existingPrediction?.was_correct) ? 'You got it right!' : 'Not quite'}
            </Text>
          </View>

          <View style={styles.comparisonRow}>
            <View style={styles.comparisonCol}>
              <Text style={[styles.comparisonLabel, { color: colors.textMuted }]}>YOUR GUESS</Text>
              <Text style={[styles.comparisonValue, { color: voteColor(guessValue ?? '') }]}>
                {voteLabel(guessValue ?? '')}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
            <View style={styles.comparisonCol}>
              <Text style={[styles.comparisonLabel, { color: colors.textMuted }]}>ACTUAL VOTE</Text>
              <Text style={[styles.comparisonValue, { color: voteColor(result?.actualVote ?? existingPrediction?.actual_vote ?? '') }]}>
                {voteLabel(result?.actualVote ?? existingPrediction?.actual_vote ?? '')}
              </Text>
            </View>
          </View>

          {/* Surprising miss → share prompt */}
          {isSurprisingMiss && onShare && (
            <Pressable
              onPress={() => onShare(divisionId, mpName, guessValue ?? '', result.actualVote)}
              style={({ pressed }) => [styles.shareButton, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={styles.shareText}>Share this surprise</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  question: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold,
    marginBottom: SPACING.xs,
  },
  divisionName: {
    fontSize: FONT_SIZE.small,
    marginBottom: SPACING.lg,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  guessButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  guessLabel: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
  },
  resultBox: {
    gap: SPACING.md,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  resultText: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  comparisonCol: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  comparisonLabel: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.5,
  },
  comparisonValue: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.bold,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: GREEN,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  shareText: {
    color: '#fff',
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
