import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface AffectsYouItem {
  bill_id: string;
  bill_title: string;
  why_it_matters: string;
  impact_group: string;
  impact_icon: string;
  current_status: string;
  date_introduced: string | null;
  mp_vote: string | null; // how the user's MP voted, if applicable
  mp_name: string | null;
}

const IMPACT_KEYWORDS: Record<string, { label: string; icon: string; keywords: string[] }> = {
  renters:     { label: 'Renters', icon: 'home-outline', keywords: ['rent', 'tenant', 'lease', 'housing', 'build-to-rent', 'rental'] },
  homeowners:  { label: 'Homeowners', icon: 'business-outline', keywords: ['mortgage', 'property', 'stamp duty', 'home owner', 'homeowner', 'negative gearing'] },
  parents:     { label: 'Parents & Families', icon: 'people-outline', keywords: ['child', 'parent', 'family', 'childcare', 'school', 'parental', 'children'] },
  students:    { label: 'Students', icon: 'school-outline', keywords: ['student', 'university', 'tafe', 'education', 'hecs', 'scholarship'] },
  workers:     { label: 'Workers', icon: 'hammer-outline', keywords: ['wage', 'worker', 'employment', 'workplace', 'industrial', 'fair work', 'penalty rate'] },
  retirees:    { label: 'Retirees', icon: 'heart-outline', keywords: ['pension', 'superannuation', 'super', 'retire', 'aged care'] },
  taxpayers:   { label: 'Taxpayers', icon: 'cash-outline', keywords: ['tax', 'gst', 'income tax', 'deduction', 'bracket'] },
  health:      { label: 'Healthcare', icon: 'medkit-outline', keywords: ['health', 'medical', 'hospital', 'medicare', 'pharmaceutical', 'mental health', 'gp'] },
  environment: { label: 'Environment', icon: 'leaf-outline', keywords: ['climate', 'emission', 'environment', 'renewable', 'carbon', 'energy'] },
  digital:     { label: 'Digital Rights', icon: 'phone-portrait-outline', keywords: ['privacy', 'data', 'surveillance', 'social media', 'online', 'digital'] },
};

function matchImpacts(title: string, summary: string | null): { label: string; icon: string; why: string }[] {
  const text = `${title} ${summary || ''}`.toLowerCase();
  const matches: { label: string; icon: string; why: string }[] = [];

  for (const [, group] of Object.entries(IMPACT_KEYWORDS)) {
    const matchedKeyword = group.keywords.find(kw => text.includes(kw));
    if (matchedKeyword) {
      matches.push({
        label: group.label,
        icon: group.icon,
        why: generateWhyStatement(title, group.label, matchedKeyword),
      });
    }
  }
  return matches;
}

function generateWhyStatement(billTitle: string, group: string, keyword: string): string {
  // Generate a plain-English "why this matters to you" based on the impact group
  const templates: Record<string, string> = {
    'Renters': `This bill could affect rental conditions and housing availability in your area.`,
    'Homeowners': `This bill could impact property rules, mortgage conditions, or housing policy.`,
    'Parents & Families': `This bill could change childcare, education, or family support programs.`,
    'Students': `This bill could affect university fees, student support, or education policy.`,
    'Workers': `This bill could change workplace conditions, pay, or employment rights.`,
    'Retirees': `This bill could affect pensions, superannuation, or aged care.`,
    'Taxpayers': `This bill could change how much tax you pay or how tax revenue is used.`,
    'Healthcare': `This bill could affect Medicare, hospital services, or health costs.`,
    'Environment': `This bill could change climate policy, energy costs, or environmental protections.`,
    'Digital Rights': `This bill could affect your online privacy, data rights, or digital services.`,
  };
  return templates[group] || `This bill relates to ${keyword} and may affect you.`;
}

export function useAffectsYou(postcode: string | null, mpId: string | null) {
  const [items, setItems] = useState<AffectsYouItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postcode) { setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Get recent active bills (introduced or passed_house in last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const { data: bills } = await supabase
          .from('bills')
          .select('id,title,summary,summary_plain,current_status,date_introduced,sponsor,portfolio')
          .in('current_status', ['introduced', 'passed_house'])
          .gte('date_introduced', thirtyDaysAgo)
          .not('aph_id', 'is', null)
          .order('date_introduced', { ascending: false })
          .limit(50);

        if (cancelled) return;
        if (!bills) { setLoading(false); return; }

        // Match each bill against impact groups
        const results: AffectsYouItem[] = [];
        for (const bill of bills) {
          const summaryText = bill.summary_plain || bill.summary || '';
          const impacts = matchImpacts(bill.title, summaryText);

          if (impacts.length > 0) {
            // Take the first (strongest) match
            const impact = impacts[0];

            // Check if user's MP has voted on related divisions
            let mpVote: string | null = null;
            let mpName: string | null = null;

            results.push({
              bill_id: bill.id,
              bill_title: bill.title,
              why_it_matters: impact.why,
              impact_group: impact.label,
              impact_icon: impact.icon,
              current_status: bill.current_status,
              date_introduced: bill.date_introduced,
              mp_vote: mpVote,
              mp_name: mpName,
            });
          }
        }

        if (!cancelled) setItems(results.slice(0, 5)); // Top 5 most relevant
      } catch {
        // Silent fail
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [postcode, mpId]);

  return { items, loading };
}
