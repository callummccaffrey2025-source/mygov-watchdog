import { useState, useEffect } from 'react';
import { supabase } from './../lib/supabase';
import { NewsStory } from './useNewsStories';

export type BlindspotCategory = 'left' | 'right' | 'establishment' | 'parliamentary' | 'mp';

export interface ParliamentaryBlindspot {
  type: 'division' | 'speech';
  id: string;
  title: string;
  date: string;
  chamber?: string | null;
}

export interface MpBlindspot {
  id: string;
  name: string;
  party: string | null;
  activity_count: number;
}

export function useBlindspots(category: BlindspotCategory) {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [parliamentary, setParliamentary] = useState<ParliamentaryBlindspot[]>([]);
  const [mps, setMps] = useState<MpBlindspot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setStories([]);
      setParliamentary([]);
      setMps([]);

      try {
        if (category === 'left') {
          // Stories covered by right + centre but zero left
          const { data } = await supabase
            .from('v_civic_news_stories')
            .select('*')
            .eq('left_count', 0)
            .gt('right_count', 0)
            .gte('article_count', 3)
            .order('first_seen', { ascending: false })
            .limit(30);
          setStories((data as NewsStory[]) || []);
        } else if (category === 'right') {
          const { data } = await supabase
            .from('v_civic_news_stories')
            .select('*')
            .eq('right_count', 0)
            .gt('left_count', 0)
            .gte('article_count', 3)
            .order('first_seen', { ascending: false })
            .limit(30);
          setStories((data as NewsStory[]) || []);
        } else if (category === 'establishment') {
          // Stories where owner_count is low (only independent outlets)
          // Approximate: stories with few total outlets but gte 3
          const { data } = await supabase
            .from('v_civic_news_stories')
            .select('*')
            .lte('owner_count', 2)
            .gte('article_count', 3)
            .order('first_seen', { ascending: false })
            .limit(30);
          setStories((data as NewsStory[]) || []);
        } else if (category === 'parliamentary') {
          // Recent divisions and speeches that haven't generated news coverage
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

          const [divResult, speechResult] = await Promise.all([
            supabase
              .from('divisions')
              .select('id, name, date, chamber')
              .gte('date', sevenDaysAgo)
              .order('date', { ascending: false })
              .limit(20),
            supabase
              .from('hansard_speeches')
              .select('id, debate_topic, date, chamber')
              .gte('date', sevenDaysAgo)
              .not('debate_topic', 'is', null)
              .order('date', { ascending: false })
              .limit(20),
          ]);

          const divisions: ParliamentaryBlindspot[] = (divResult.data || []).map((d: any) => ({
            type: 'division',
            id: d.id,
            title: d.name,
            date: d.date,
            chamber: d.chamber,
          }));

          const speeches: ParliamentaryBlindspot[] = (speechResult.data || []).map((s: any) => ({
            type: 'speech',
            id: s.id,
            title: s.debate_topic,
            date: s.date,
            chamber: s.chamber,
          }));

          // Check recent headlines — filter out items whose title keywords appear in any recent story
          const { data: recentStories } = await supabase
            .from('v_civic_news_stories')
            .select('headline')
            .gte('first_seen', sevenDaysAgo)
            .limit(200);

          const allHeadlines = ((recentStories || []).map((s: any) => (s.headline || '').toLowerCase())).join(' ');

          const notCovered = [...divisions, ...speeches].filter(item => {
            const titleWords = item.title
              .toLowerCase()
              .replace(/[^a-z\s]/g, ' ')
              .split(/\s+/)
              .filter(w => w.length >= 5);
            if (titleWords.length === 0) return false;
            // If NONE of the meaningful words appear in recent headlines, it's a blindspot
            return !titleWords.some(w => allHeadlines.includes(w));
          });

          setParliamentary(notCovered.slice(0, 15));
        } else if (category === 'mp') {
          // Highly active MPs in last 30 days with zero media mentions
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

          // Get active MPs: count recent speeches per member
          const { data: speeches } = await supabase
            .from('hansard_speeches')
            .select('member_id')
            .gte('date', thirtyDaysAgo);

          const counts = new Map<string, number>();
          for (const s of (speeches || [])) {
            if (s.member_id) counts.set(s.member_id, (counts.get(s.member_id) ?? 0) + 1);
          }

          // Top 30 most active
          const topActive = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30);

          if (topActive.length > 0) {
            const memberIds = topActive.map(([id]) => id);
            const { data: members } = await supabase
              .from('members')
              .select('id, first_name, last_name, party:parties(short_name, name)')
              .in('id', memberIds);

            // Fetch recent story headlines to check mention
            const { data: recentStories } = await supabase
              .from('v_civic_news_stories')
              .select('headline')
              .gte('first_seen', thirtyDaysAgo)
              .limit(500);
            const headlineBlob = ((recentStories || []).map((s: any) => (s.headline || '').toLowerCase())).join(' ');

            const unmentioned: MpBlindspot[] = [];
            for (const m of (members || []) as any[]) {
              const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
              const lastName = m.last_name.toLowerCase();
              if (!headlineBlob.includes(fullName) && !headlineBlob.includes(lastName)) {
                unmentioned.push({
                  id: m.id,
                  name: `${m.first_name} ${m.last_name}`,
                  party: m.party?.short_name ?? m.party?.name ?? null,
                  activity_count: counts.get(m.id) ?? 0,
                });
              }
            }

            unmentioned.sort((a, b) => b.activity_count - a.activity_count);
            setMps(unmentioned.slice(0, 15));
          }
        }
      } catch {}
      setLoading(false);
    };

    fetch();
  }, [category]);

  return { stories, parliamentary, mps, loading };
}
