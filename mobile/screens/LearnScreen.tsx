import React, { useState, useEffect } from 'react';
import { View, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLearnModules, LearnModule } from '../hooks/useLearnModules';
import { LessonCard } from '../components/LessonCard';
import { supabase } from '../lib/supabase';
import { hapticLight } from '../lib/haptics';
import { spacing, radius, colors as tokenColors } from '../theme/tokens';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { PressableScale } from '../components/ui/PressableScale';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

function TodaysQuestion() {
  const [poll, setPoll] = useState<any>(null);
  const [voted, setVoted] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('daily_polls')
        .select('*')
        .eq('status', 'published')
        .lte('publish_date', today)
        .order('publish_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPoll(data);
    })();
  }, []);

  if (!poll) return null;

  const handleVote = (option: 'a' | 'b') => {
    hapticLight();
    setVoted(option);
    supabase.from('daily_poll_responses').insert({
      poll_id: poll.id,
      response: option,
    }).then(() => {});
  };

  return (
    <View style={{
      backgroundColor: tokenColors.accentMuted,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 2,
      borderColor: tokenColors.warning,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Ionicons name="help-circle" size={20} color={tokenColors.warning} />
        <AppText variant="caption" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: tokenColors.warning }}>
          Today's Question
        </AppText>
      </View>
      <AppText variant="callout" style={{ fontWeight: '700', lineHeight: 24, marginBottom: spacing.md }}>
        {poll.question}
      </AppText>
      {voted ? (
        <View style={{
          backgroundColor: tokenColors.accentMuted,
          borderRadius: radius.sm,
          padding: spacing.md,
          alignItems: 'center',
        }}>
          <Ionicons name="checkmark-circle" size={24} color={tokenColors.success} />
          <AppText variant="callout" color="success" style={{ marginTop: 4 }}>
            Thanks for voting!
          </AppText>
          <AppText variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            Results shown when enough people respond
          </AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <PressableScale
            onPress={() => handleVote('a')}
            style={{
              backgroundColor: tokenColors.surface,
              borderRadius: radius.sm,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: tokenColors.border,
            }}
            accessibilityRole="button"
          >
            <AppText variant="callout">{poll.option_a_text}</AppText>
          </PressableScale>
          <PressableScale
            onPress={() => handleVote('b')}
            style={{
              backgroundColor: tokenColors.surface,
              borderRadius: radius.sm,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: tokenColors.border,
            }}
            accessibilityRole="button"
          >
            <AppText variant="callout">{poll.option_b_text}</AppText>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

export function LearnScreen({ navigation }: any) {
  const { modules, loading, refresh } = useLearnModules();

  const coreModules = modules.filter(m => !m.is_current_events);
  const currentEvents = modules.filter(m => m.is_current_events);

  const totalLessons = modules.reduce((sum, m) => sum + m.lesson_count, 0);
  const completedLessons = modules.reduce((sum, m) => sum + m.completed_count, 0);

  const handleModulePress = (module: LearnModule) => {
    navigation.navigate('LearnModule', { moduleId: module.id, title: module.title });
  };

  const renderModulePair = ({ item }: { item: LearnModule }) => (
    <LessonCard
      title={item.title}
      icon={item.icon}
      color={item.color}
      lessonCount={item.lesson_count}
      completedCount={item.completed_count}
      onPress={() => handleModulePress(item)}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['top']}>
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
          <Skeleton width="50%" height={32} borderRadius={radius.sm} />
          <Skeleton width="80%" height={18} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Skeleton width="48%" height={160} borderRadius={radius.md} />
            <Skeleton width="48%" height={160} borderRadius={radius.md} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Skeleton width="48%" height={160} borderRadius={radius.md} />
            <Skeleton width="48%" height={160} borderRadius={radius.md} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['top']}>
      <FlashList
        data={coreModules}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={tokenColors.accent} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg, paddingHorizontal: spacing.xs }}>
            <AppText variant="title" style={{ letterSpacing: -0.3 }}>Learn</AppText>
            <AppText variant="body" color="textSecondary" style={{ marginTop: spacing.xs, lineHeight: 22 }}>
              Understand how Australia is governed
            </AppText>

            {/* Today's Question */}
            <TodaysQuestion />

            {/* Progress summary */}
            {totalLessons > 0 && (
              <View style={{
                marginTop: spacing.lg,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                backgroundColor: tokenColors.accentMuted,
                borderColor: tokenColors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Ionicons name="trophy-outline" size={16} color={tokenColors.accent} />
                  <AppText variant="callout" color="textSecondary">
                    {completedLessons} of {totalLessons} lessons completed
                  </AppText>
                </View>
                <View style={{ height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: tokenColors.border }}>
                  <View style={{
                    height: '100%',
                    borderRadius: 2,
                    width: `${(completedLessons / totalLessons) * 100}%`,
                    backgroundColor: tokenColors.accent,
                  }} />
                </View>
              </View>
            )}
          </View>
        }
        renderItem={renderModulePair}
        ListEmptyComponent={
          <EmptyState
            icon={<Ionicons name="school-outline" size={48} color={tokenColors.textMuted} />}
            title="No lessons available"
            message="Pull to refresh if content doesn't appear. New modules are added regularly."
            actionLabel="Refresh"
            onAction={refresh}
          />
        }
        ListFooterComponent={
          currentEvents.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.xs, marginTop: spacing.md }}>
              <AppText variant="heading" style={{ marginBottom: spacing.md, marginTop: spacing.xl }}>
                This Week in Parliament
              </AppText>
              {currentEvents.map(m => (
                <CurrentEventCard
                  key={m.id}
                  module={m}
                  onPress={() => handleModulePress(m)}
                />
              ))}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function CurrentEventCard({ module, onPress }: { module: LearnModule; onPress: () => void }) {
  return (
    <Card onPress={onPress} elevated style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokenColors.accentMuted,
        }}>
          <Ionicons name="flash" size={14} color={tokenColors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="body" style={{ fontWeight: '600' }}>{module.title}</AppText>
          {module.description && (
            <AppText variant="caption" color="textMuted" numberOfLines={2} style={{ marginTop: 2 }}>
              {module.description}
            </AppText>
          )}
        </View>
        <Ionicons name="arrow-forward" size={16} color={tokenColors.textMuted} />
      </View>
    </Card>
  );
}
