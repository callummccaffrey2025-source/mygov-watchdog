import React, { useState, useCallback, useRef } from 'react';
import { View, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLesson } from '../hooks/useLesson';
import { ContentBlock } from '../components/ContentBlock';
import { spacing, radius, colors as tokenColors } from '../theme/tokens';
import { AppText } from '../components/ui/AppText';
import { PressableScale } from '../components/ui/PressableScale';
import { Skeleton } from '../components/ui/Skeleton';

export function LessonScreen({ navigation, route }: any) {
  const { lessonId, title } = route.params;
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
      <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['top']}>
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.xl }}>
          <Skeleton width="60%" height={28} borderRadius={radius.sm} />
          <Skeleton width="100%" height={80} borderRadius={radius.md} />
          <Skeleton width="100%" height={80} borderRadius={radius.md} />
          <Skeleton width="90%" height={20} />
          <Skeleton width="75%" height={20} />
        </View>
      </SafeAreaView>
    );
  }

  const progressPct = totalQuizzes > 0
    ? Math.round((quizResults.length / totalQuizzes) * 100)
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderColor: tokenColors.border,
        gap: spacing.md,
      }}>
        <PressableScale onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="close" size={24} color={tokenColors.textPrimary} />
        </PressableScale>
        <View style={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: tokenColors.border,
        }}>
          <View style={{
            height: '100%',
            backgroundColor: tokenColors.accent,
            borderRadius: 4,
            width: `${progressPct}%`,
          }} />
        </View>
        {completed && (
          <View style={{ marginLeft: spacing.xs }}>
            <Ionicons name="checkmark-circle" size={20} color={tokenColors.success} />
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="title" style={{ marginBottom: spacing.xl }}>
          {lesson.title}
        </AppText>

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
          <PressableScale
            onPress={handleComplete}
            disabled={isCompleting}
            style={{
              backgroundColor: tokenColors.accent,
              borderRadius: radius.lg,
              paddingVertical: spacing.lg,
              alignItems: 'center',
              marginTop: spacing.xl,
              opacity: isCompleting ? 0.6 : 1,
            }}
          >
            <AppText variant="heading" color="onAccent">
              {isCompleting ? 'Saving...' : 'Complete Lesson'}
            </AppText>
          </PressableScale>
        )}

        {completed && !showCelebration && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            marginTop: spacing.xl,
            paddingVertical: spacing.lg,
          }}>
            <Ionicons name="checkmark-circle" size={24} color={tokenColors.success} />
            <AppText variant="heading" color="success">Lesson completed</AppText>
          </View>
        )}
      </ScrollView>

      {/* Celebration overlay */}
      {showCelebration && (
        <Animated.View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: celebrationOpacity,
        }}>
          <Animated.View style={{
            alignItems: 'center',
            transform: [{ scale: celebrationScale }],
          }}>
            <View style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokenColors.accent,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: spacing.lg,
            }}>
              <Ionicons name="checkmark" size={48} color={tokenColors.onAccent} />
            </View>
            <AppText variant="title" color="textInverse" style={{ color: '#FFFFFF', marginBottom: spacing.xs }}>
              Lesson Complete!
            </AppText>
            {totalQuizzes > 0 && (
              <AppText variant="heading" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {quizResults.filter(Boolean).length}/{totalQuizzes} correct
              </AppText>
            )}
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
