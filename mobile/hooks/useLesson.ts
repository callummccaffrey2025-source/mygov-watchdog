import { useState, useEffect } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export type ContentBlock =
  | { type: 'text'; title?: string; body: string }
  | { type: 'fact'; emoji: string; text: string }
  | { type: 'quiz'; question: string; options: string[]; correct: number; explanation: string }
  | { type: 'diagram'; image_url?: string; caption: string }
  | { type: 'real_data'; entity: 'bill' | 'vote' | 'member'; id: string; caption: string };

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  sort_order: number;
  content_blocks: ContentBlock[];
  bill_id: string | null;
  division_id: string | null;
}

export function useLesson(lessonId: string | undefined) {
  const { user } = useUser();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lessonId) { setLoading(false); return; }
    let cancelled = false;

    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('learn_lessons')
          .select('*')
          .eq('id', lessonId)
          .maybeSingle();

        if (cancelled) return;
        if (error || !data) { setLoading(false); return; }

        setLesson({
          id: data.id,
          module_id: data.module_id,
          title: data.title,
          sort_order: data.sort_order,
          content_blocks: data.content_blocks as ContentBlock[],
          bill_id: data.bill_id,
          division_id: data.division_id,
        });

        // Check completion
        if (user) {
          const { data: prog } = await supabase
            .from('learn_progress')
            .select('id')
            .eq('user_id', user.id)
            .eq('lesson_id', lessonId)
            .maybeSingle();
          if (!cancelled) setCompleted(!!prog);
        } else {
          const raw = await AsyncStorage.getItem('learn_progress_ids');
          if (raw) {
            try {
              const ids: string[] = JSON.parse(raw);
              if (!cancelled) setCompleted(ids.includes(lessonId));
            } catch {}
          }
        }
      } catch {}
      if (!cancelled) setLoading(false);
    };

    fetch();
    return () => { cancelled = true; };
  }, [lessonId, user?.id]);

  const markComplete = async (score?: number) => {
    if (!lessonId) return;

    if (user) {
      await supabase.from('learn_progress').upsert({
        user_id: user.id,
        lesson_id: lessonId,
        score: score ?? null,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lesson_id' });
    } else {
      // Anonymous: persist to AsyncStorage
      const raw = await AsyncStorage.getItem('learn_progress_ids');
      let ids: string[] = [];
      if (raw) { try { ids = JSON.parse(raw); } catch {} }
      if (!ids.includes(lessonId)) {
        ids.push(lessonId);
        await AsyncStorage.setItem('learn_progress_ids', JSON.stringify(ids));
      }
    }
    setCompleted(true);
  };

  return { lesson, completed, loading, markComplete };
}
