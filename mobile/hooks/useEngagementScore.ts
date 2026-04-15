import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface EngagementData {
  bills_read: number;
  polls_voted: number;
  reactions_given: number;
  days_active: number;
  top_categories: Record<string, number>;
}

export function computeScore(data: EngagementData): number {
  return (
    data.bills_read * 1 +
    data.polls_voted * 5 +
    data.reactions_given * 1 +
    data.days_active * 2
  );
}

export function getLevelName(score: number): string {
  if (score <= 50) return 'New Citizen';
  if (score <= 150) return 'Informed Voter';
  if (score <= 300) return 'Civic Champion';
  return 'Democracy Defender';
}

export const LEVEL_COLOURS: Record<string, string> = {
  'New Citizen': '#9aabb8',
  'Informed Voter': '#0066CC',
  'Civic Champion': '#00843D',
  'Democracy Defender': '#7C3AED',
};

export function useEngagementScore(userId: string | undefined) {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!userId) { setLoading(false); return; }
    const { data: row } = await supabase
      .from('user_engagement')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setData(
      row
        ? {
            bills_read: row.bills_read ?? 0,
            polls_voted: row.polls_voted ?? 0,
            reactions_given: row.reactions_given ?? 0,
            days_active: row.days_active ?? 0,
            top_categories: row.top_categories ?? {},
          }
        : null,
    );
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [userId]);

  const score = data ? computeScore(data) : 0;
  const level = getLevelName(score);
  const colour = LEVEL_COLOURS[level] ?? '#00843D';

  return { data, score, level, colour, loading, refresh };
}

export async function trackEngagement(
  userId: string,
  action: 'bill_read' | 'poll_voted' | 'reaction_given',
  category?: string,
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('user_engagement')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const cur = existing ?? {
      bills_read: 0, polls_voted: 0, reactions_given: 0,
      days_active: 0, top_categories: {},
    };

    const isNewDay = !existing?.last_active_date || existing.last_active_date !== today;
    const topCats: Record<string, number> = { ...(cur.top_categories || {}) };
    if (category) topCats[category] = (topCats[category] || 0) + 1;

    await supabase.from('user_engagement').upsert(
      {
        user_id: userId,
        bills_read: cur.bills_read + (action === 'bill_read' ? 1 : 0),
        polls_voted: cur.polls_voted + (action === 'poll_voted' ? 1 : 0),
        reactions_given: cur.reactions_given + (action === 'reaction_given' ? 1 : 0),
        days_active: cur.days_active + (isNewDay ? 1 : 0),
        last_active_date: today,
        top_categories: topCats,
      },
      { onConflict: 'user_id' },
    );
  } catch {
    // Silently ignore tracking errors — never disrupt UX
  }
}
