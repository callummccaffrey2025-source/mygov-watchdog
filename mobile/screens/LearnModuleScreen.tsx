import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS } from '../constants/design';

interface LessonItem {
  id: string;
  title: string;
  sort_order: number;
  completed: boolean;
}

export function LearnModuleScreen({ navigation, route }: any) {
  const { moduleId, title } = route.params;
  const { colors } = useTheme();
  const { user } = useUser();
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      const { data: lessonsData } = await supabase
        .from('learn_lessons')
        .select('id, title, sort_order')
        .eq('module_id', moduleId)
        .order('sort_order', { ascending: true });

      if (cancelled || !lessonsData) { setLoading(false); return; }

      // Get completed IDs
      let completedIds = new Set<string>();
      if (user) {
        const { data: progress } = await supabase
          .from('learn_progress')
          .select('lesson_id')
          .eq('user_id', user.id);
        if (progress) completedIds = new Set(progress.map(p => p.lesson_id));
      } else {
        const raw = await AsyncStorage.getItem('learn_progress_ids');
        if (raw) { try { completedIds = new Set(JSON.parse(raw)); } catch {} }
      }

      if (!cancelled) {
        setLessons(lessonsData.map(l => ({
          id: l.id,
          title: l.title,
          sort_order: l.sort_order,
          completed: completedIds.has(l.id),
        })));
        setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [moduleId, user?.id]);

  const renderLesson = ({ item, index }: { item: LessonItem; index: number }) => (
    <Pressable
      onPress={() => navigation.navigate('Lesson', { lessonId: item.id, title: item.title })}
      style={[styles.lessonRow, { borderColor: colors.border }]}
    >
      <View style={[styles.lessonNumber, { backgroundColor: item.completed ? '#00843D' : colors.surface }]}>
        {item.completed ? (
          <Ionicons name="checkmark" size={16} color="#fff" />
        ) : (
          <Text style={[styles.lessonNumberText, { color: colors.textMuted }]}>{index + 1}</Text>
        )}
      </View>
      <Text style={[styles.lessonTitle, { color: colors.text }]}>{item.title}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00843D" />
        </View>
      ) : (
        <FlashList
          data={lessons}
          keyExtractor={item => item.id}
          renderItem={renderLesson}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="book-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Lessons coming soon
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: { width: 40 },
  headerTitle: { fontSize: FONT_SIZE.subtitle, fontWeight: FONT_WEIGHT.semibold as any, flex: 1, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.lg },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  lessonNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberText: { fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold as any },
  lessonTitle: { fontSize: FONT_SIZE.body, flex: 1 },
  emptyContainer: { alignItems: 'center', paddingTop: SPACING.xxxl, gap: SPACING.md },
  emptyText: { fontSize: FONT_SIZE.body },
});
