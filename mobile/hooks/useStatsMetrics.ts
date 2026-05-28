import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface StatsMetric {
  id: string;
  metric_key: string;
  scope: 'national' | 'state' | 'electorate' | 'mp' | 'party';
  scope_id: string | null;
  value: number | null;
  display_value: string;
  unit: string | null;
  source: 'verity' | 'abs' | 'aec' | 'pbo' | 'treasury';
  source_url: string | null;
  as_of: string;
  period: string | null;
}

interface UseStatsMetricsResult {
  mpStats: StatsMetric[];
  electorateStats: StatsMetric[];
  nationalStats: StatsMetric[];
  loading: boolean;
}

export function useStatsMetrics(
  memberId: string | undefined,
  electorateId: string | undefined,
): UseStatsMetricsResult {
  const [mpStats, setMpStats] = useState<StatsMetric[]>([]);
  const [electorateStats, setElectorateStats] = useState<StatsMetric[]>([]);
  const [nationalStats, setNationalStats] = useState<StatsMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId && !electorateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const queries: PromiseLike<any>[] = [];

        // MP stats
        if (memberId) {
          queries.push(
            supabase
              .from('stats_metrics')
              .select('*')
              .eq('scope', 'mp')
              .eq('scope_id', memberId)
              .order('metric_key')
          ,
          );
        } else {
          queries.push(Promise.resolve({ data: [] }));
        }

        // Electorate stats
        if (electorateId) {
          queries.push(
            supabase
              .from('stats_metrics')
              .select('*')
              .eq('scope', 'electorate')
              .eq('scope_id', electorateId)
              .order('metric_key')
          ,
          );
        } else {
          queries.push(Promise.resolve({ data: [] }));
        }

        // National stats
        queries.push(
          supabase
            .from('stats_metrics')
            .select('*')
            .eq('scope', 'national')
            .order('metric_key')
            .then(r => r),
        );

        const [mpResult, electorateResult, nationalResult] = await Promise.all(queries);

        if (cancelled) return;
        setMpStats((mpResult.data || []) as StatsMetric[]);
        setElectorateStats((electorateResult.data || []) as StatsMetric[]);
        setNationalStats((nationalResult.data || []) as StatsMetric[]);
      } catch {
        // leave empty
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [memberId, electorateId]);

  return { mpStats, electorateStats, nationalStats, loading };
}

/** Look up a specific metric from a stats array */
export function findMetric(stats: StatsMetric[], key: string): StatsMetric | undefined {
  return stats.find(s => s.metric_key === key);
}

/** Pick a compelling "stat of the day" for the given MP */
export function pickStatOfTheDay(
  mpStats: StatsMetric[],
  mpName: string,
): { headline: string; detail: string; metric: StatsMetric } | null {
  const attendance = findMetric(mpStats, 'attendance_rate');
  const loyalty = findMetric(mpStats, 'party_loyalty_rate');
  const crossings = findMetric(mpStats, 'floor_crossings');
  const votesCast = findMetric(mpStats, 'votes_cast');

  // Priority: floor crossings > low attendance > perfect loyalty > high attendance
  if (crossings && Number(crossings.value) > 0) {
    return {
      headline: `${mpName} crossed the floor ${crossings.display_value} time${Number(crossings.value) !== 1 ? 's' : ''} this term`,
      detail: `Out of ${votesCast?.display_value ?? '?'} votes in the 47th Parliament`,
      metric: crossings,
    };
  }
  if (attendance && Number(attendance.value) < 90) {
    return {
      headline: `${mpName} has missed ${Math.round(100 - Number(attendance.value))}% of votes this term`,
      detail: `Attendance: ${attendance.display_value} across ${votesCast?.display_value ?? '?'} divisions`,
      metric: attendance,
    };
  }
  if (loyalty && Number(loyalty.value) === 100) {
    return {
      headline: `${mpName} has never broken ranks`,
      detail: `100% party loyalty across ${votesCast?.display_value ?? '?'} votes`,
      metric: loyalty,
    };
  }
  if (attendance) {
    return {
      headline: `${mpName} attended ${attendance.display_value} of votes this term`,
      detail: `${votesCast?.display_value ?? '?'} divisions in the 47th Parliament`,
      metric: attendance,
    };
  }
  return null;
}
