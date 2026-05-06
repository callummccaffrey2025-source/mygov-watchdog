import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface LearnProgressEntry {
  lesson_id: string;
  completed_at: string;
  score: number | null;
}

export function useLearnProgress() {
  const { user } = useUser();
  const [progress, setProgress] = useState<LearnProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      try {
        if (user) {
          const { data } = await supabase
            .from('learn_progress')
            .select('lesson_id, completed_at, score')
            .eq('user_id', user.id);
          if (!cancelled) setProgress(data || []);
        } else {
          const raw = await AsyncStorage.getItem('learn_progress_ids');
          if (raw) {
            try {
              const ids: string[] = JSON.parse(raw);
              if (!cancelled) setProgress(ids.map(id => ({
                lesson_id: id,
                completed_at: new Date().toISOString(),
                score: null,
              })));
            } catch {}
          }
        }
      } catch {}
      if (!cancelled) setLoading(false);
    };

    fetch();
    return () => { cancelled = true; };
  }, [user?.id]);

  const completedLessonIds = new Set(progress.map(p => p.lesson_id));
  const totalCompleted = progress.length;

  return { progress, completedLessonIds, totalCompleted, loading };
}
