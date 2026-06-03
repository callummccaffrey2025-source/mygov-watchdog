import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLearnModules, LearnModule } from '../hooks/useLearnModules';
import { LessonCard } from '../components/LessonCard';
import { supabase } from '../lib/supabase';
import { hapticLight } from '../lib/haptics';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

function TodaysQuestion({ colors }: { colors: any }) {
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
      backgroundColor: '#FFF8E7', borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, marginBottom: SPACING.lg,
      borderWidth: 2, borderColor: '#F59E0B',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md }}>
        <Ionicons name="help-circle" size={20} color="#F59E0B" />
        <Text style={{ fontSize: 11, fontWeight: FONT_WEIGHT.bold, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Today's Question
        </Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: FONT_WEIGHT.bold, color: colors.text, lineHeight: 24, marginBottom: SPACING.md }}>
        {poll.question}
      </Text>
      {voted ? (
        <View style={{ backgroundColor: '#E8F5EE', borderRadius: 10, padding: SPACING.md, alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={24} color="#00843D" />
          <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.semibold, color: '#00843D', marginTop: 4 }}>Thanks for voting!</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Results shown when enough people respond</Text>
        </View>
      ) : (
        <View style={{ gap: SPACING.sm }}>
          <Pressable
            onPress={() => handleVote('a')}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#E8F5EE' : colors.card,
              borderRadius: 10, padding: SPACING.md,
              borderWidth: 1, borderColor: colors.border,
            })}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.medium, color: colors.text }}>{poll.option_a_text}</Text>
          </Pressable>
          <Pressable
            onPress={() => handleVote('b')}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#FEF3F2' : colors.card,
              borderRadius: 10, padding: SPACING.md,
              borderWidth: 1, borderColor: colors.border,
            })}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 14, fontWeight: FONT_WEIGHT.medium, color: colors.text }}>{poll.option_b_text}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function LearnScreen({ navigation }: any) {
  const { colors } = useTheme();
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
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <FlashList
        data={coreModules}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.green} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Learn</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Understand how Australia is governed
            </Text>

            {/* Today's Question */}
            <TodaysQuestion colors={colors} />

            {/* Progress summary */}
            {totalLessons > 0 && (
              <View style={[styles.progressCard, { backgroundColor: colors.greenBg, borderColor: colors.border }]}>
                <View style={styles.progressRow}>
                  <Ionicons name="trophy-outline" size={16} color={colors.green} />
                  <Text style={[styles.progressText, { color: colors.text }]}>
                    {completedLessons} of {totalLessons} lessons completed
                  </Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressBarFill, { width: `${(completedLessons / totalLessons) * 100}%`, backgroundColor: colors.green }]} />
                </View>
              </View>
            )}
          </View>
        }
        renderItem={renderModulePair}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: SPACING.xxxl }}>
            <Ionicons name="school-outline" size={48} color={colors.textMuted} />
            <Text style={{ fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold, color: colors.text, marginTop: SPACING.md }}>
              Lessons loading
            </Text>
            <Text style={{ fontSize: FONT_SIZE.body, color: colors.textMuted, marginTop: SPACING.xs, textAlign: 'center' }}>
              Pull to refresh if content doesn't appear.
            </Text>
          </View>
        }
        ListFooterComponent={
          currentEvents.length > 0 ? (
            <View style={styles.currentEventsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>This Week in Parliament</Text>
              {currentEvents.map(m => (
                <CurrentEventCard
                  key={m.id}
                  module={m}
                  colors={colors}
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

function CurrentEventCard({ module, colors, onPress }: { module: LearnModule; colors: any; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.eventCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.eventHeader}>
        <View style={[styles.eventIcon, { backgroundColor: colors.greenBg }]}>
          <Ionicons name="flash" size={14} color={colors.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eventTitle, { color: colors.text }]}>{module.title}</Text>
          {module.description && (
            <Text style={[styles.eventDesc, { color: colors.textMuted }]} numberOfLines={2}>{module.description}</Text>
          )}
        </View>
        <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  header: { marginBottom: SPACING.lg, paddingHorizontal: SPACING.xs },
  title: { fontSize: FONT_SIZE.heading + 4, fontWeight: FONT_WEIGHT.bold, letterSpacing: -0.3 },
  subtitle: { fontSize: FONT_SIZE.body, marginTop: SPACING.xs, lineHeight: 22 },
  progressCard: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  progressText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.medium },
  progressBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  sectionTitle: {
    fontSize: FONT_SIZE.subtitle,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.md,
    marginTop: SPACING.xl,
  },
  currentEventsSection: { paddingHorizontal: SPACING.xs, marginTop: SPACING.md },
  eventCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  eventIcon: {
    width: 32, height: 32, borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  eventTitle: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold },
  eventDesc: { fontSize: FONT_SIZE.small, lineHeight: 18, marginTop: 2 },
});
