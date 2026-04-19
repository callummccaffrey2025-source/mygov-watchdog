import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface MpDonationEntry {
  memberId: string;
  memberName: string;
  party: string;
  topDonors: Array<{
    donor_name: string;
    amount: number;
    donor_type: string | null;
    financial_year: string;
  }>;
  totalReceived: number;
}

export interface MediaOwnershipEntry {
  owner: string;
  outlets: string[];
  articleCount: number;
  leanings: string[];
}

export interface FollowTheMoneyData {
  mpDonations: MpDonationEntry[];
  mediaOwnership: MediaOwnershipEntry[];
  loading: boolean;
}

const EMPTY: FollowTheMoneyData = { mpDonations: [], mediaOwnership: [], loading: false };

export function useFollowTheMoney(storyId: number | null): FollowTheMoneyData {
  const [mpDonations, setMpDonations] = useState<MpDonationEntry[]>([]);
  const [mediaOwnership, setMediaOwnership] = useState<MediaOwnershipEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<Record<number, { mpDonations: MpDonationEntry[]; mediaOwnership: MediaOwnershipEntry[] }>>({});

  useEffect(() => {
    if (!storyId) {
      setMpDonations([]);
      setMediaOwnership([]);
      setLoading(false);
      return;
    }

    // Return cached results if available
    if (cacheRef.current[storyId]) {
      const cached = cacheRef.current[storyId];
      setMpDonations(cached.mpDonations);
      setMediaOwnership(cached.mediaOwnership);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Step 1: fetch member entities for this story
        const { data: entityRows } = await supabase
          .from('story_entities')
          .select('entity_value, member_id')
          .eq('story_id', storyId)
          .eq('entity_type', 'member')
          .not('member_id', 'is', null);

        const memberEntities = (entityRows || []) as Array<{ entity_value: string; member_id: string }>;

        // Step 2: fetch donations + media ownership in parallel
        const [donationResults, mediaResult] = await Promise.all([
          // For each member, fetch their top 5 donations
          Promise.all(
            memberEntities.map(async (entity) => {
              const { data: memberData } = await supabase
                .from('members')
                .select('first_name, last_name, party:parties(name, short_name, colour)')
                .eq('id', entity.member_id)
                .maybeSingle();

              const { data: donationData } = await supabase
                .from('individual_donations')
                .select('donor_name, donor_type, amount, financial_year')
                .eq('member_id', entity.member_id)
                .order('amount', { ascending: false })
                .limit(5);

              const donations = (donationData || []) as Array<{
                donor_name: string;
                donor_type: string | null;
                amount: number;
                financial_year: string;
              }>;

              const memberName = memberData
                ? `${memberData.first_name} ${memberData.last_name}`
                : entity.entity_value;
              const partyRaw = memberData?.party as any;
              const partyObj = Array.isArray(partyRaw) ? partyRaw[0] : partyRaw;
              const party = partyObj?.short_name || partyObj?.name || '';

              return {
                memberId: entity.member_id,
                memberName,
                party,
                topDonors: donations,
                totalReceived: donations.reduce((sum, d) => sum + Number(d.amount), 0),
              } as MpDonationEntry;
            })
          ),

          // Media ownership: fetch articles for this story with source info
          (async () => {
            const { data: junctionRows } = await supabase
              .from('news_story_articles')
              .select('article_id')
              .eq('story_id', storyId);

            const articleIds = (junctionRows || []).map((r: any) => r.article_id);
            if (articleIds.length === 0) return [] as MediaOwnershipEntry[];

            const { data: articlesData } = await supabase
              .from('news_articles')
              .select('id, news_sources(name, owner, leaning)')
              .in('id', articleIds);

            // Group by owner
            const ownerMap = new Map<string, { outlets: Set<string>; articleCount: number; leanings: Set<string> }>();

            for (const a of (articlesData || []) as any[]) {
              const source = a.news_sources;
              if (!source || !source.owner) continue;
              const owner = source.owner as string;
              if (!ownerMap.has(owner)) {
                ownerMap.set(owner, { outlets: new Set(), articleCount: 0, leanings: new Set() });
              }
              const entry = ownerMap.get(owner)!;
              entry.outlets.add(source.name);
              entry.articleCount++;
              if (source.leaning) entry.leanings.add(source.leaning);
            }

            const result: MediaOwnershipEntry[] = [];
            for (const [owner, data] of ownerMap) {
              result.push({
                owner,
                outlets: Array.from(data.outlets),
                articleCount: data.articleCount,
                leanings: Array.from(data.leanings),
              });
            }
            // Sort by article count descending
            result.sort((a, b) => b.articleCount - a.articleCount);
            return result;
          })(),
        ]);

        if (cancelled) return;

        // Filter out MPs with no donations
        const filteredDonations = donationResults.filter(d => d.topDonors.length > 0);

        // Cache results
        cacheRef.current[storyId] = {
          mpDonations: filteredDonations,
          mediaOwnership: mediaResult,
        };

        setMpDonations(filteredDonations);
        setMediaOwnership(mediaResult);
      } catch {
        if (!cancelled) {
          setMpDonations([]);
          setMediaOwnership([]);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [storyId]);

  return { mpDonations, mediaOwnership, loading };
}
