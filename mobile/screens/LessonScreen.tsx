import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useLesson } from '../hooks/useLesson';
import { ContentBlock } from '../components/ContentBlock';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';

export function LessonScreen({ navigation, route }: any) {
  const { lessonId, title } = route.params;
  const { colors } = useTheme();
  const { lesson, completed, loading, markComplete } = useLesson(lessonId);
  const [quizResults, setQuizResults] = useState<boolean[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  const totalQuizzes = lesson?.content_blocks.filter(b => b.type === 'quiz').length ?? 0;

  const handleQuizAnswer = useCallback((isCorrect: boolean) => {
    setQuizResults(prev => [...prev, isCorrect]);
  }, []);

  const handleComplete = async () => {
    setIsCompleting(true);
    const score = totalQuizzes > 0
      ? Math.round((quizResults.filter(Boolean).length / totalQuizzes) * 100)
      : 100;
    await markComplete(score);
    setIsCompleting(false);

    // Celebration animation
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCelebration(true);
    Animated.parallel([
      Animated.spring(celebrationScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(celebrationOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 1.5s
    setTimeout(() => {
      Animated.timing(celebrationOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        navigation.goBack();
      });
    }, 1500);
  };

  const handleRealDataPress = (entity: string, id: string) => {
    if (entity === 'bill') navigation.navigate('BillDetail', { billId: id });
    else if (entity === 'member') navigation.navigate('MemberProfile', { memberId: id });
  };

  if (loading || !lesson) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textMuted }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progressPct = totalQuizzes > 0
    ? Math.round((quizResults.length / totalQuizzes) * 100)
    : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.headerBar, { borderColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
        </View>
        {completed && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#00843D" />
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lessonTitle, { color: colors.text }]}>{lesson.title}</Text>

        {lesson.content_blocks.map((block, i) => (
          <ContentBlock
            key={i}
            block={block}
            onQuizAnswer={handleQuizAnswer}
            onRealDataPress={handleRealDataPress}
          />
        ))}

        {/* Complete button */}
        {!completed && (
          <Pressable
            onPress={handleComplete}
            disabled={isCompleting}
            style={[styles.completeBtn, isCompleting && { opacity: 0.6 }]}
          >
            <Text style={styles.completeBtnText}>
              {isCompleting ? 'Saving...' : 'Complete Lesson'}
            </Text>
          </Pressable>
        )}

        {completed && !showCelebration && (
          <View style={styles.completedMessage}>
            <Ionicons name="checkmark-circle" size={24} color="#00843D" />
            <Text style={[styles.completedText, { color: '#00843D' }]}>Lesson completed</Text>
          </View>
        )}
      </ScrollView>

      {/* Celebration overlay */}
      {showCelebration && (
        <Animated.View style={[styles.celebrationOverlay, { opacity: celebrationOpacity }]}>
          <Animated.View style={[styles.celebrationContent, { transform: [{ scale: celebrationScale }] }]}>
            <View style={styles.celebrationCircle}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={styles.celebrationTitle}>Lesson Complete!</Text>
            {totalQuizzes > 0 && (
              <Text style={styles.celebrationScore}>
                {quizResults.filter(Boolean).length}/{totalQuizzes} correct
              </Text>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  closeBtn: { padding: SPACING.xs },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00843D',
    borderRadius: 4,
  },
  completedBadge: { marginLeft: SPACING.xs },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  lessonTitle: {
    fontSize: FONT_SIZE.heading,
    fontWeight: FONT_WEIGHT.bold as any,
    marginBottom: SPACING.xl,
  },
  completeBtn: {
    backgroundColor: '#00843D',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold as any,
  },
  completedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  completedText: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.semibold as any,
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationContent: {
    alignItems: 'center',
  },
  celebrationCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#00843D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  celebrationTitle: {
    fontSize: FONT_SIZE.heading,
    fontWeight: FONT_WEIGHT.bold as any,
    color: '#fff',
    marginBottom: SPACING.xs,
  },
  celebrationScore: {
    fontSize: FONT_SIZE.subtitle,
    color: 'rgba(255,255,255,0.8)',
  },
});
