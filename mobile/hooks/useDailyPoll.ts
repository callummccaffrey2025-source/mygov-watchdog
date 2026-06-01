import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

export interface DailyPoll {
  id: string;
  question: string;
  option_a_text: string;
  option_b_text: string;
  skip_text: string;
  source_article_url: string;
  source_article_title: string | null;
  source_article_outlet: string | null;
}

export interface PollVoteCounts {
  option_a: number;
  option_b: number;
  skip: number;
}

export function useDailyPoll() {
  const [poll, setPoll] = useState<DailyPoll | null>(null);
  const [userVote, setUserVote] = useState<string | null>(null);
  const [counts, setCounts] = useState<PollVoteCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: polls } = await supabase
          .from('daily_polls')
          .select('id, question, option_a_text, option_b_text, skip_text, source_article_url, source_article_title, source_article_outlet')
          .eq('status', 'published')
          .lte('publish_date', today)
          .order('publish_date', { ascending: false })
          .limit(1);

        if (cancelled) return;
        const p = polls?.[0] ?? null;
        setPoll(p);

        if (p && user?.id) {
          const { data: response } = await supabase
            .from('daily_poll_responses')
            .select('option_chosen')
            .eq('poll_id', p.id)
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (!cancelled) setUserVote(response?.option_chosen ?? null);
        }

        if (p) {
          const { data: responses } = await supabase
            .from('daily_poll_responses')
            .select('option_chosen')
            .eq('poll_id', p.id);

          if (!cancelled && responses) {
            setCounts({
              option_a: responses.filter((r: any) => r.option_chosen === 'option_a').length,
              option_b: responses.filter((r: any) => r.option_chosen === 'option_b').length,
              skip: responses.filter((r: any) => r.option_chosen === 'skip').length,
            });
          }
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const vote = useCallback(async (option: 'option_a' | 'option_b' | 'skip') => {
    if (!poll || !user?.id || userVote) return;

    setUserVote(option);
    setCounts(prev => prev ? {
      ...prev,
      [option === 'option_a' ? 'option_a' : option === 'option_b' ? 'option_b' : 'skip']:
        (prev[option === 'option_a' ? 'option_a' : option === 'option_b' ? 'option_b' : 'skip'] ?? 0) + 1,
    } : null);

    await supabase.from('daily_poll_responses').insert({
      poll_id: poll.id,
      user_id: user.id,
      option_chosen: option,
    });
  }, [poll, user?.id, userVote]);

  return { poll, userVote, counts, loading, vote };
}
