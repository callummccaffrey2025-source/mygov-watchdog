import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DonationVoteLink {
  donor_name: string;
  donor_industry: string;
  total_donated: number;
  related_bill_title: string;
  related_bill_id: string;
  vote_cast: string;
  vote_date: string | null;
}

const INDUSTRY_BILL_KEYWORDS: Record<string, string[]> = {
  mining: ['mining', 'mineral', 'coal', 'gas', 'petroleum', 'resources'],
  energy: ['energy', 'renewable', 'electricity', 'emission', 'carbon', 'climate', 'fuel'],
  property: ['property', 'housing', 'development', 'planning', 'land', 'rent', 'mortgage', 'build'],
  gambling: ['gambling', 'wagering', 'gaming', 'bet', 'casino', 'lottery'],
  pharmacy: ['pharmaceutical', 'health', 'medical', 'drug', 'pharmacy', 'therapeutic', 'pbs'],
  finance: ['banking', 'financial', 'superannuation', 'insurance', 'credit', 'tax', 'treasury'],
  media: ['media', 'broadcast', 'communications', 'abc', 'sbs', 'news'],
  transport: ['transport', 'aviation', 'road', 'rail', 'shipping', 'infrastructure'],
  agriculture: ['agriculture', 'farming', 'food', 'livestock', 'dairy', 'fisheries', 'export control'],
  tech: ['technology', 'digital', 'cyber', 'data', 'online', 'telecommunications', 'privacy'],
  hospitality: ['hospitality', 'tourism', 'restaurant', 'alcohol', 'liquor'],
  unions: ['workplace', 'industrial', 'fair work', 'worker', 'employment', 'union'],
  legal: ['legal', 'justice', 'court', 'attorney', 'crime', 'law enforcement'],
  retail: ['consumer', 'retail', 'trade', 'competition', 'commerce'],
};

const INDUSTRY_LABELS: Record<string, string> = {
  mining: 'Mining', energy: 'Energy', property: 'Property', gambling: 'Gambling',
  pharmacy: 'Pharma', finance: 'Finance', media: 'Media', transport: 'Transport',
  agriculture: 'Agriculture', tech: 'Tech', hospitality: 'Hospitality', unions: 'Unions',
  legal: 'Legal', retail: 'Retail', lobbying: 'Lobbying', government: 'Government',
};

export function useDonationVoteLinks(memberId: string | null) {
  const [links, setLinks] = useState<DonationVoteLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data: donations } = await supabase
          .from('individual_donations')
          .select('donor_name, amount, industry')
          .eq('member_id', memberId)
          .not('industry', 'is', null)
          .not('industry', 'in', '("individual","party_internal")')
          .order('amount', { ascending: false })
          .limit(100);

        if (cancelled || !donations?.length) { setLoading(false); return; }

        // Aggregate: industry -> { total, topDonor }
        const byIndustry = new Map<string, { total: number; topDonor: string; topAmount: number }>();
        for (const d of donations) {
          const amt = Number(d.amount);
          const existing = byIndustry.get(d.industry);
          if (existing) {
            existing.total += amt;
            if (amt > existing.topAmount) {
              existing.topDonor = d.donor_name;
              existing.topAmount = amt;
            }
          } else {
            byIndustry.set(d.industry, { total: amt, topDonor: d.donor_name, topAmount: amt });
          }
        }

        // Get votes with division names
        const { data: votes } = await supabase
          .from('division_votes')
          .select('vote_cast, division:divisions(id, name, date)')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false })
          .limit(300);

        if (cancelled || !votes?.length) { setLoading(false); return; }

        const results: DonationVoteLink[] = [];
        for (const [industry, { total, topDonor }] of byIndustry) {
          const keywords = INDUSTRY_BILL_KEYWORDS[industry];
          if (!keywords) continue;

          for (const v of votes) {
            const div = (v as any).division;
            if (!div?.name) continue;
            const nameLower = div.name.toLowerCase();
            if (keywords.some(kw => nameLower.includes(kw))) {
              results.push({
                donor_name: topDonor,
                donor_industry: INDUSTRY_LABELS[industry] || industry,
                total_donated: total,
                related_bill_title: div.name.replace(/^Bills?\s*[—\-]\s*/i, '').trim(),
                related_bill_id: div.id,
                vote_cast: v.vote_cast,
                vote_date: div.date,
              });
              break;
            }
          }
        }

        results.sort((a, b) => b.total_donated - a.total_donated);
        if (!cancelled) setLinks(results.slice(0, 5));
      } catch {
        // Silent fail
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId]);

  return { links, loading };
}
