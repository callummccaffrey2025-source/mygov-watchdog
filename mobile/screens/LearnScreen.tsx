import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLearnModules, LearnModule } from '../hooks/useLearnModules';
import { LessonCard } from '../components/LessonCard';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';

export function LearnScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { modules, loading, refresh } = useLearnModules();

  const coreModules = modules.filter(m => !m.is_current_events);
  const currentEvents = modules.filter(m => m.is_current_events);

  const handleModulePress = (module: LearnModule) => {
    navigation.navigate('LearnModule', { moduleId: module.id, title: module.title });
  };

  const renderModulePair = ({ item, index }: { item: LearnModule; index: number }) => {
    // FlatList with numColumns handles grid layout
    return (
      <LessonCard
        title={item.title}
        icon={item.icon}
        color={item.color}
        lessonCount={item.lesson_count}
        completedCount={item.completed_count}
        onPress={() => handleModulePress(item)}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00843D" />
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
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor="#00843D" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Learn</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Understand how Australia is governed
            </Text>
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
    <View style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.eventHeader}>
        <Ionicons name="newspaper-outline" size={18} color="#00843D" />
        <Text style={[styles.eventTitle, { color: colors.text }]}>{module.title}</Text>
      </View>
      {module.description && (
        <Text style={[styles.eventDesc, { color: colors.textMuted }]}>{module.description}</Text>
      )}
      <Text style={[styles.eventCta, { color: '#00843D' }]} onPress={onPress}>
        Start learning →
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxxl },
  header: { marginBottom: SPACING.xl, paddingHorizontal: SPACING.xs },
  title: { fontSize: FONT_SIZE.hero, fontWeight: FONT_WEIGHT.bold as any },
  subtitle: { fontSize: FONT_SIZE.body, marginTop: SPACING.xs },
  sectionTitle: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.semibold as any,
    marginBottom: SPACING.md,
    marginTop: SPACING.xl,
  },
  currentEventsSection: { paddingHorizontal: SPACING.xs, marginTop: SPACING.lg },
  eventCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  eventTitle: { fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold as any },
  eventDesc: { fontSize: FONT_SIZE.small, lineHeight: 20, marginBottom: SPACING.sm },
  eventCta: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.semibold as any },
});
