import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface LearnModule {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_current_events: boolean;
  lesson_count: number;
  completed_count: number;
}

export function useLearnModules() {
  const { user } = useUser();
  const [modules, setModules] = useState<LearnModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch modules with lesson counts
      const { data: modulesData, error: modErr } = await supabase
        .from('learn_modules')
        .select('*, learn_lessons(id)')
        .order('sort_order', { ascending: true });

      if (modErr) { setError(modErr.message); setLoading(false); return; }

      // Fetch user progress
      let completedLessonIds: Set<string> = new Set();
      if (user) {
        const { data: progress } = await supabase
          .from('learn_progress')
          .select('lesson_id')
          .eq('user_id', user.id);
        if (progress) {
          completedLessonIds = new Set(progress.map(p => p.lesson_id));
        }
      } else {
        // Anonymous: check AsyncStorage
        const raw = await AsyncStorage.getItem('learn_progress_ids');
        if (raw) {
          try { completedLessonIds = new Set(JSON.parse(raw)); } catch {}
        }
      }

      // Map modules with progress
      const mapped: LearnModule[] = (modulesData || []).map((m: any) => {
        const lessonIds: string[] = (m.learn_lessons || []).map((l: any) => l.id);
        return {
          id: m.id,
          title: m.title,
          description: m.description,
          icon: m.icon,
          color: m.color,
          sort_order: m.sort_order,
          is_current_events: m.is_current_events,
          lesson_count: lessonIds.length,
          completed_count: lessonIds.filter(id => completedLessonIds.has(id)).length,
        };
      });

      setModules(mapped);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { modules, loading, error, refresh: fetch };
}
