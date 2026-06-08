import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import AsyncStorage from '../lib/storage';
import { spacing, radius, colors as tokenColors } from '../theme/tokens';
import { AppText } from '../components/ui/AppText';
import { PressableScale } from '../components/ui/PressableScale';
import { Skeleton } from '../components/ui/Skeleton';

interface LessonItem {
  id: string;
  title: string;
  sort_order: number;
  completed: boolean;
  locked: boolean;
}

export function LearnModuleScreen({ navigation, route }: any) {
  const { moduleId, title } = route.params;
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
        const mapped = lessonsData.map((l, i) => ({
          id: l.id,
          title: l.title,
          sort_order: l.sort_order,
          completed: completedIds.has(l.id),
          // First lesson always unlocked; others require previous lesson completed
          locked: i > 0 && !completedIds.has(lessonsData[i - 1].id),
        }));
        setLessons(mapped);
        setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [moduleId, user?.id]);

  const renderLesson = ({ item, index }: { item: LessonItem; index: number }) => (
    <PressableScale
      onPress={() => {
        if (!item.locked) {
          navigation.navigate('Lesson', { lessonId: item.id, title: item.title });
        }
      }}
      disabled={item.locked}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderColor: tokenColors.border,
        gap: spacing.md,
        opacity: item.locked ? 0.45 : 1,
      }}
    >
      <View style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: item.completed ? tokenColors.success : item.locked ? tokenColors.border : tokenColors.surface,
      }}>
        {item.completed ? (
          <Ionicons name="checkmark" size={16} color={tokenColors.textInverse} />
        ) : item.locked ? (
          <Ionicons name="lock-closed" size={14} color={tokenColors.textMuted} />
        ) : (
          <AppText variant="label" color="textMuted">{index + 1}</AppText>
        )}
      </View>
      <AppText
        variant="body"
        color={item.locked ? 'textMuted' : 'textPrimary'}
        style={{ flex: 1 }}
      >
        {item.title}
      </AppText>
      {!item.locked && <Ionicons name="chevron-forward" size={18} color={tokenColors.textMuted} />}
    </PressableScale>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokenColors.background }} edges={['top']}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}>
        <PressableScale onPress={() => navigation.goBack()} style={{ width: 40 }}>
          <Ionicons name="arrow-back" size={24} color={tokenColors.textPrimary} />
        </PressableScale>
        <AppText variant="heading" center style={{ flex: 1 }} numberOfLines={1}>
          {title}
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Skeleton width={32} height={32} borderRadius={16} />
              <Skeleton width="70%" height={20} />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          data={lessons}
          keyExtractor={item => item.id}
          renderItem={renderLesson}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.md }}>
              <Ionicons name="book-outline" size={48} color={tokenColors.textMuted} />
              <AppText variant="body" color="textMuted">
                Lessons coming soon
              </AppText>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
