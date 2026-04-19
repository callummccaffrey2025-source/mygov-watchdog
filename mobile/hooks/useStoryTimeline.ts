import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface TimelineEvent {
  id: string;
  type: 'bill_introduced' | 'bill_status_change' | 'hansard_speech' | 'division_vote' | 'news_coverage' | 'bill_passed' | 'bill_defeated';
  date: string;
  title: string;
  description: string | null;
  metadata: {
    billId?: string;
    memberId?: string;
    memberName?: string;
    voteCast?: string;
    status?: string;
    storyId?: number;
    sourceUrl?: string;
  };
}

export interface StoryTimelineData {
  events: TimelineEvent[];
  relatedBills: Array<{ id: string; title: string; currentStatus: string | null }>;
  loading: boolean;
}

/**
 * Assembles a chronological timeline for a news story by pulling from
 * story_entities (bills), story_primary_sources (Hansard, votes, bills),
 * bill_changes (status history), and related news stories (category match).
 */
export function useStoryTimeline(storyId: number | null): StoryTimelineData {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [relatedBills, setRelatedBills] = useState<Array<{ id: string; title: string; currentStatus: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) {
      setEvents([]);
      setRelatedBills([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Step 1+2: Fetch entities (for bill links) and primary sources in parallel
        const [entitiesRes, sourcesRes] = await Promise.all([
          supabase
            .from('story_entities')
            .select('*')
            .eq('story_id', storyId)
            .not('bill_id', 'is', null),
          supabase
            .from('story_primary_sources')
            .select('*')
            .eq('story_id', storyId)
            .order('relevance', { ascending: false }),
        ]);

        if (cancelled) return;

        const entities = (entitiesRes.data || []) as Array<{
          id: string; bill_id: string | null; entity_value: string; member_id: string | null;
        }>;
        const sources = (sourcesRes.data || []) as Array<{
          id: string; source_type: string; source_id: string; member_id: string | null;
          excerpt: string | null; metadata: Record<string, any>;
        }>;

        // Collect unique bill IDs from entities and bill-type sources
        const billIds = new Set<string>();
        for (const e of entities) {
          if (e.bill_id) billIds.add(e.bill_id);
        }
        for (const s of sources) {
          if (s.source_type === 'bill') billIds.add(s.source_id);
        }

        const hansardSources = sources.filter(s => s.source_type === 'hansard');
        const voteSources = sources.filter(s => s.source_type === 'division_vote');

        // If no bill links and no Hansard/vote sources, return early
        if (billIds.size === 0 && hansardSources.length === 0 && voteSources.length === 0) {
          if (!cancelled) {
            setEvents([]);
            setRelatedBills([]);
            setLoading(false);
          }
          return;
        }

        // Step 3: Fetch bill_changes for linked bills, plus bill details
        const billIdArray = Array.from(billIds);
        const [billChangesRes, billsRes, currentStoryRes] = await Promise.all([
          billIdArray.length > 0
            ? supabase
                .from('bill_changes')
                .select('*')
                .in('bill_id', billIdArray)
                .order('changed_at', { ascending: true })
                .limit(50)
            : Promise.resolve({ data: [] }),
          billIdArray.length > 0
            ? supabase
                .from('bills')
                .select('id, short_title, current_status')
                .in('id', billIdArray)
            : Promise.resolve({ data: [] }),
          // Fetch current story for category-based related lookup
          supabase
            .from('v_civic_news_stories')
            .select('headline, category')
            .eq('id', storyId)
            .single(),
        ]);

        if (cancelled) return;

        const billChanges = (billChangesRes.data || []) as Array<{
          id: string; bill_id: string; previous_status: string | null;
          new_status: string; change_description: string | null; changed_at: string;
        }>;
        const bills = (billsRes.data || []) as Array<{
          id: string; short_title: string; current_status: string | null;
        }>;
        const currentStory = currentStoryRes.data as {
          headline: string; category: string | null;
        } | null;

        // Build bills lookup
        const billMap = new Map<string, { title: string; currentStatus: string | null }>();
        for (const b of bills) {
          billMap.set(b.id, { title: b.short_title, currentStatus: b.current_status });
        }

        const allEvents: TimelineEvent[] = [];
        const seenKeys = new Set<string>();

        // Step 3a: Bill change events
        for (const change of billChanges) {
          const dedupKey = `${change.bill_id}|${change.changed_at?.slice(0, 10)}|${change.new_status}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);

          const billInfo = billMap.get(change.bill_id);
          const billTitle = billInfo?.title || 'Bill';
          const statusLower = change.new_status?.toLowerCase() || '';

          let eventType: TimelineEvent['type'] = 'bill_status_change';
          let title = `${billTitle}: ${change.new_status}`;

          if (statusLower.includes('introduced') || statusLower.includes('first reading')) {
            eventType = 'bill_introduced';
            title = `${billTitle} introduced`;
          } else if (statusLower.includes('passed') || statusLower.includes('royal assent') || statusLower.includes('act')) {
            eventType = 'bill_passed';
            title = `${billTitle} passed`;
          } else if (statusLower.includes('defeated') || statusLower.includes('rejected') || statusLower.includes('negatived')) {
            eventType = 'bill_defeated';
            title = `${billTitle} defeated`;
          }

          allEvents.push({
            id: `bill_change_${change.id}`,
            type: eventType,
            date: change.changed_at,
            title,
            description: change.change_description !== change.new_status ? change.change_description : null,
            metadata: {
              billId: change.bill_id,
              status: change.new_status,
            },
          });
        }

        // Step 4: Hansard speech events
        for (const s of hansardSources) {
          const meta = s.metadata || {};
          allEvents.push({
            id: `hansard_${s.id}`,
            type: 'hansard_speech',
            date: meta.date || meta.spoken_at || new Date().toISOString(),
            title: meta.speaker_name
              ? `${meta.speaker_name} spoke in parliament`
              : 'Speech in parliament',
            description: meta.debate_topic || s.excerpt || null,
            metadata: {
              memberId: s.member_id || undefined,
              memberName: meta.speaker_name || undefined,
              sourceUrl: meta.source_url || meta.url || undefined,
            },
          });
        }

        // Step 5: Division vote events
        for (const s of voteSources) {
          const meta = s.metadata || {};
          allEvents.push({
            id: `vote_${s.id}`,
            type: 'division_vote',
            date: meta.date || meta.voted_at || new Date().toISOString(),
            title: meta.division_name
              ? `Vote: ${meta.division_name}`
              : 'Division vote',
            description: meta.vote_cast
              ? `Result: ${meta.aye_count ?? '?'} ayes, ${meta.no_count ?? '?'} noes`
              : null,
            metadata: {
              memberId: s.member_id || undefined,
              voteCast: meta.vote_cast || undefined,
              sourceUrl: meta.source_url || undefined,
            },
          });
        }

        // Step 6: Related news stories by category + headline keyword overlap
        if (currentStory?.category) {
          // Extract significant keywords from headline (3+ chars, not stopwords)
          const stopwords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
            'has', 'her', 'was', 'one', 'our', 'out', 'his', 'its', 'says',
            'will', 'with', 'from', 'this', 'that', 'they', 'been', 'have',
            'over', 'into', 'after', 'new', 'about', 'would', 'could',
          ]);
          const keywords = (currentStory.headline || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length >= 3 && !stopwords.has(w));

          if (keywords.length >= 2) {
            // Search for stories in same category, ordered by recency
            const { data: relatedStories } = await supabase
              .from('v_civic_news_stories')
              .select('id, headline, first_seen, category')
              .eq('category', currentStory.category)
              .neq('id', storyId)
              .gte('article_count', 2)
              .order('first_seen', { ascending: false })
              .limit(20);

            if (!cancelled && relatedStories) {
              // Filter by keyword overlap >= 2
              const matched = relatedStories
                .filter(rs => {
                  const rsWords = (rs.headline || '')
                    .toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .split(/\s+/);
                  const overlap = keywords.filter(k => rsWords.includes(k)).length;
                  return overlap >= 2;
                })
                .slice(0, 5);

              for (const rs of matched) {
                allEvents.push({
                  id: `news_${rs.id}`,
                  type: 'news_coverage',
                  date: rs.first_seen,
                  title: rs.headline,
                  description: null,
                  metadata: {
                    storyId: rs.id,
                  },
                });
              }
            }
          }
        }

        if (cancelled) return;

        // Sort chronologically (oldest first)
        allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setEvents(allEvents);
        setRelatedBills(
          bills.map(b => ({
            id: b.id,
            title: b.short_title,
            currentStatus: b.current_status,
          }))
        );
        setLoading(false);
      } catch {
        if (!cancelled) {
          setEvents([]);
          setRelatedBills([]);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [storyId]);

  return { events, relatedBills, loading };
}
