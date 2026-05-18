import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLearnModules, LearnModule } from '../hooks/useLearnModules';
import { LessonCard } from '../components/LessonCard';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SHADOWS } from '../constants/design';

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
