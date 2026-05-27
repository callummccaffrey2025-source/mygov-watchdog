import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '../lib/storage';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useElectorateByPostcode } from './useElectorateByPostcode';

// ── Types ────────────────────────────────────────────────────────────────────

export type ImpactDirection = 'positive' | 'negative' | 'neutral';
export type ImpactMagnitude = 'high' | 'medium' | 'low';

export interface WalletImpactItem {
  bill_id: string;
  bill_title: string;
  impact_direction: ImpactDirection;
  impact_magnitude: ImpactMagnitude;
  impact_summary: string;
  source: string;
}

export interface UserWalletProfile {
  income_bracket: string | null;   // 'under_50k' | '50k_100k' | '100k_150k' | '150k_plus'
  housing_status: string | null;   // 'renter' | 'owner' | 'mortgage' | 'other'
  has_children: boolean;
  is_student: boolean;
  is_retired: boolean;
  electorate_name: string | null;
}

interface UseWalletImpactReturn {
  items: WalletImpactItem[];
  profile: UserWalletProfile;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ── Cost-of-living topic keywords ────────────────────────────────────────────

const COST_OF_LIVING_KEYWORDS = [
  'tax', 'gst', 'income tax', 'cost of living', 'inflation', 'wage',
  'rent', 'rental', 'mortgage', 'housing', 'stamp duty', 'negative gearing',
  'childcare', 'education', 'hecs', 'school', 'university',
  'pension', 'superannuation', 'retirement', 'aged care',
  'medicare', 'bulk billing', 'health', 'pharmaceutical', 'pbs',
  'energy', 'electricity', 'gas', 'fuel', 'petrol',
  'welfare', 'jobseeker', 'centrelink', 'concession',
  'insurance', 'grocery', 'food', 'transport', 'interest rate',
  'subsidy', 'rebate', 'deduction', 'bracket', 'stage 3',
  'first home', 'property', 'land tax', 'capital gains',
];

function textMatchesCostOfLiving(title: string, summary: string | null): boolean {
  const text = `${title} ${summary || ''}`.toLowerCase();
  return COST_OF_LIVING_KEYWORDS.some(kw => text.includes(kw));
}

// ── Impact estimation rules ──────────────────────────────────────────────────

interface ImpactRule {
  keywords: string[];
  check: (profile: UserWalletProfile) => boolean;
  direction: ImpactDirection;
  magnitude: ImpactMagnitude;
  summary: (billTitle: string) => string;
  source: string;
}

const IMPACT_RULES: ImpactRule[] = [
  // ── Renters ──
  {
    keywords: ['rent', 'rental', 'tenant', 'renter', 'rental crisis'],
    check: (p) => p.housing_status === 'renter',
    direction: 'positive',
    magnitude: 'high',
    summary: () => 'Could affect rental costs or tenant protections in your area.',
    source: 'Bill text + housing status',
  },
  // ── Mortgage holders ──
  {
    keywords: ['mortgage', 'interest rate', 'home loan'],
    check: (p) => p.housing_status === 'mortgage',
    direction: 'negative',
    magnitude: 'high',
    summary: () => 'May change mortgage conditions or interest rate policy affecting your repayments.',
    source: 'Bill text + housing status',
  },
  // ── Homeowners (property tax) ──
  {
    keywords: ['stamp duty', 'land tax', 'property', 'negative gearing', 'capital gains'],
    check: (p) => p.housing_status === 'owner' || p.housing_status === 'mortgage',
    direction: 'negative',
    magnitude: 'medium',
    summary: () => 'Could change property tax rules, deductions, or capital gains treatment.',
    source: 'Bill text + housing status',
  },
  // ── Parents / families ──
  {
    keywords: ['childcare', 'child', 'parental', 'family', 'school', 'children'],
    check: (p) => p.has_children,
    direction: 'positive',
    magnitude: 'high',
    summary: () => 'May change childcare subsidies, family payments, or education costs for your household.',
    source: 'Bill text + family status',
  },
  // ── Students ──
  {
    keywords: ['hecs', 'student', 'university', 'tafe', 'education', 'scholarship'],
    check: (p) => p.is_student,
    direction: 'positive',
    magnitude: 'high',
    summary: () => 'Could affect HECS debt, student support payments, or education costs.',
    source: 'Bill text + student status',
  },
  // ── Retirees ──
  {
    keywords: ['pension', 'superannuation', 'aged care', 'retirement', 'senior'],
    check: (p) => p.is_retired,
    direction: 'positive',
    magnitude: 'high',
    summary: () => 'May change pension rates, superannuation rules, or aged care costs.',
    source: 'Bill text + retirement status',
  },
  // ── Low income ──
  {
    keywords: ['welfare', 'jobseeker', 'centrelink', 'concession', 'cost of living', 'bulk billing'],
    check: (p) => p.income_bracket === 'under_50k',
    direction: 'positive',
    magnitude: 'high',
    summary: () => 'Could increase cost-of-living relief, welfare payments, or concession access.',
    source: 'Bill text + income bracket',
  },
  // ── Middle income tax ──
  {
    keywords: ['tax', 'income tax', 'bracket', 'stage 3', 'deduction'],
    check: (p) => p.income_bracket === '50k_100k' || p.income_bracket === '100k_150k',
    direction: 'neutral',
    magnitude: 'medium',
    summary: () => 'May change your tax bracket, deductions, or take-home pay.',
    source: 'Bill text + income bracket',
  },
  // ── High income tax ──
  {
    keywords: ['tax', 'income tax', 'stage 3', 'capital gains', 'superannuation', 'negative gearing'],
    check: (p) => p.income_bracket === '150k_plus',
    direction: 'negative',
    magnitude: 'medium',
    summary: () => 'Could change high-income tax rates, investment deductions, or super contribution caps.',
    source: 'Bill text + income bracket',
  },
  // ── Energy / everyone ──
  {
    keywords: ['energy', 'electricity', 'gas', 'fuel', 'petrol'],
    check: () => true,
    direction: 'positive',
    magnitude: 'low',
    summary: () => 'May affect household energy costs or fuel prices.',
    source: 'Bill text',
  },
  // ── Medicare / health ──
  {
    keywords: ['medicare', 'health', 'pharmaceutical', 'pbs', 'hospital', 'gp', 'bulk billing'],
    check: () => true,
    direction: 'positive',
    magnitude: 'medium',
    summary: () => 'Could change Medicare rebates, PBS costs, or access to healthcare.',
    source: 'Bill text',
  },
  // ── Transport ──
  {
    keywords: ['transport', 'infrastructure', 'road', 'rail', 'public transport'],
    check: () => true,
    direction: 'positive',
    magnitude: 'low',
    summary: () => 'May affect transport costs or infrastructure in your area.',
    source: 'Bill text',
  },
];

// Magnitude ranking for sorting
const MAGNITUDE_RANK: Record<ImpactMagnitude, number> = { high: 3, medium: 2, low: 1 };

function estimateImpact(
  billTitle: string,
  billSummary: string | null,
  profile: UserWalletProfile,
): { direction: ImpactDirection; magnitude: ImpactMagnitude; summary: string; source: string } | null {
  const text = `${billTitle} ${billSummary || ''}`.toLowerCase();

  let bestMatch: ImpactRule | null = null;
  let bestMagnitude = 0;

  for (const rule of IMPACT_RULES) {
    const keywordHit = rule.keywords.some(kw => text.includes(kw));
    if (!keywordHit) continue;
    if (!rule.check(profile)) continue;

    const mag = MAGNITUDE_RANK[rule.magnitude];
    if (mag > bestMagnitude) {
      bestMagnitude = mag;
      bestMatch = rule;
    }
  }

  if (!bestMatch) return null;

  return {
    direction: bestMatch.direction,
    magnitude: bestMatch.magnitude,
    summary: bestMatch.summary(billTitle),
    source: bestMatch.source,
  };
}

// ── Profile loading from AsyncStorage ────────────────────────────────────────

async function loadWalletProfile(): Promise<Omit<UserWalletProfile, 'electorate_name'>> {
  const [incomeBracket, housingStatus, hasChildren, isStudent, isRetired] = await Promise.all([
    AsyncStorage.getItem('income_bracket'),
    AsyncStorage.getItem('housing_status'),
    AsyncStorage.getItem('has_children'),
    AsyncStorage.getItem('is_student'),
    AsyncStorage.getItem('is_retired'),
  ]);

  return {
    income_bracket: incomeBracket,
    housing_status: housingStatus,
    has_children: hasChildren === 'true',
    is_student: isStudent === 'true',
    is_retired: isRetired === 'true',
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWalletImpact(): UseWalletImpactReturn {
  const { postcode } = useUser();
  const { electorate } = useElectorateByPostcode(postcode);

  const [items, setItems] = useState<WalletImpactItem[]>([]);
  const [profile, setProfile] = useState<UserWalletProfile>({
    income_bracket: null,
    housing_status: null,
    has_children: false,
    is_student: false,
    is_retired: false,
    electorate_name: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load user profile from AsyncStorage
      const storedProfile = await loadWalletProfile();
      const fullProfile: UserWalletProfile = {
        ...storedProfile,
        electorate_name: electorate?.name ?? null,
      };
      setProfile(fullProfile);

      // Fetch recent bills (last 90 days, broader window for wallet relevance)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
      const { data: bills, error: fetchError } = await supabase
        .from('bills')
        .select('id, title, summary, summary_plain, current_status, date_introduced')
        .gte('date_introduced', ninetyDaysAgo)
        .not('aph_id', 'is', null)
        .order('date_introduced', { ascending: false })
        .limit(100);

      if (fetchError) {
        setError('Could not load bills.');
        setLoading(false);
        return;
      }

      if (!bills || bills.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Filter to cost-of-living-related bills and estimate impact
      const results: WalletImpactItem[] = [];

      for (const bill of bills) {
        const summaryText = bill.summary_plain || bill.summary || '';

        if (!textMatchesCostOfLiving(bill.title, summaryText)) continue;

        const impact = estimateImpact(bill.title, summaryText, fullProfile);
        if (!impact) continue;

        results.push({
          bill_id: bill.id,
          bill_title: bill.title,
          impact_direction: impact.direction,
          impact_magnitude: impact.magnitude,
          impact_summary: impact.summary,
          source: impact.source,
        });
      }

      // Sort by magnitude (high first), then by direction (negative before positive for urgency)
      results.sort((a, b) => {
        const magDiff = MAGNITUDE_RANK[b.impact_magnitude] - MAGNITUDE_RANK[a.impact_magnitude];
        if (magDiff !== 0) return magDiff;
        // Negative impacts surface first (more urgent to know about)
        if (a.impact_direction === 'negative' && b.impact_direction !== 'negative') return -1;
        if (b.impact_direction === 'negative' && a.impact_direction !== 'negative') return 1;
        return 0;
      });

      setItems(results.slice(0, 15));
    } catch {
      setError('Something went wrong. Pull down to try again.');
    }

    setLoading(false);
  }, [electorate?.name]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, profile, loading, error, refresh: fetchData };
}
