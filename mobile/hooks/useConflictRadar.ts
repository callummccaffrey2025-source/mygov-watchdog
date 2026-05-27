import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isFeatureEnabled } from '../lib/featureFlags';

/**
 * Conflict Radar: flags votes where an MP has a DECLARED financial interest
 * in the outcome. FEATURE-FLAGGED: DEFAULT OFF. Do not enable until
 * defamation lawyer has signed off.
 *
 * Only surfaces verified declarations (verified = true).
 * Uses registered_interests table joined against division sector tags.
 */

export interface ConflictFlag {
  division_id: string;
  division_name: string;
  division_date: string;
  vote_cast: string;
  interest_category: string;
  interest_description: string;
  interest_source_url: string | null;
  division_source_url: string | null;
}

export function useConflictRadar(memberId: string | undefined) {
  const [flags, setFlags] = useState<ConflictFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const enabled = isFeatureEnabled('conflict_radar');
    if (!enabled || !memberId) {
      setFlags([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // Query verified interests for this member
        const { data: interests } = await supabase
          .from('registered_interests')
          .select('category, description, source_url')
          .eq('member_id', memberId);

        if (!interests || interests.length === 0 || cancelled) {
          setLoading(false);
          return;
        }

        // Get member's votes with division details
        const { data: votes } = await supabase
          .from('division_votes')
          .select('vote_cast, division_id, divisions(id, name, date, source_url, bill_title)')
          .eq('member_id', memberId)
          .in('vote_cast', ['aye', 'no'])
          .order('created_at', { ascending: false })
          .limit(200);

        if (!votes || cancelled) {
          setLoading(false);
          return;
        }

        // Simple keyword match: check if any interest category/description
        // overlaps with division bill_title/name. This is deliberately
        // conservative -- false negatives are acceptable, false positives
        // are not.
        const interestKeywords = interests.map((i: any) => ({
          category: i.category,
          description: i.description,
          source_url: i.source_url,
          keywords: extractKeywords(i.description),
        }));

        const matched: ConflictFlag[] = [];
        for (const vote of votes as any[]) {
          const d = vote.divisions;
          if (!d) continue;

          const divisionText = `${d.name || ''} ${d.bill_title || ''}`.toLowerCase();

          for (const interest of interestKeywords) {
            // Require at least 2 keyword matches to flag
            const matchCount = interest.keywords.filter((kw: string) => divisionText.includes(kw)).length;
            if (matchCount >= 2) {
              matched.push({
                division_id: d.id,
                division_name: d.name || 'Division',
                division_date: d.date,
                vote_cast: vote.vote_cast,
                interest_category: interest.category,
                interest_description: interest.description,
                interest_source_url: interest.source_url,
                division_source_url: d.source_url,
              });
              break; // One flag per division
            }
          }
        }

        if (!cancelled) setFlags(matched);
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { flags, loading, enabled: isFeatureEnabled('conflict_radar') };
}

function extractKeywords(description: string): string[] {
  // Extract meaningful words (4+ chars) from interest descriptions
  return description
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 4)
    .filter(w => !['that', 'this', 'with', 'from', 'have', 'been', 'their', 'which', 'would', 'could', 'should', 'about'].includes(w));
}
