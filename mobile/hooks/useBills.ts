import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Bill {
  id: string;
  title: string;
  short_title: string | null;
  current_status: string | null;
  status: string | null;
  summary: string | null;
  summary_plain: string | null;
  summary_full: string | null;
  expanded_summary: string | null;
  categories: string[] | null;
  date_introduced: string | null;
  last_updated: string | null;
  chamber_introduced: string | null;
  origin_chamber: string | null;
  level: string | null;
  aph_url: string | null;
  aph_id: string | null;
  // APH-scraped fields
  sponsor: string | null;
  portfolio: string | null;
  bill_type: string | null;
  parliament_no: number | null;
  intro_house: string | null;
  intro_senate: string | null;
  passed_house: string | null;
  passed_senate: string | null;
  assent_date: string | null;
  // Enrichment fields (populated by cron, nullable until first run)
  sponsor_id: string | null;
  sponsor_party: string | null;
  narrative_status: string | null;
  is_live: boolean | null;
  days_since_movement: number | null;
  politics_cache: any | null;
}

interface Filters {
  status?: string;
  category?: string;
  search?: string;
  limit?: number;
  orderBy?: string;
  /** When true, excludes "In search index" bills and orders by date_introduced DESC */
  activeOnly?: boolean;
}

export function useBills(filters: Filters = {}) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetch = async () => {
      try {
        let query = supabase
          .from('bills')
          // eslint-disable-next-line max-len
          .select('id,title,short_title,current_status,status,summary,summary_plain,summary_full,expanded_summary,categories,date_introduced,last_updated,chamber_introduced,origin_chamber,level,aph_url,aph_id,sponsor,portfolio,bill_type,parliament_no,intro_house,intro_senate,passed_house,passed_senate,assent_date,sponsor_id,sponsor_party,narrative_status,is_live,days_since_movement,politics_cache');

        if (filters.status) {
          query = query.eq('current_status', filters.status);
        } else if (filters.activeOnly) {
          // Exclude the "In search index" catch-all status that covers ~99% of old bills
          query = query.neq('current_status', 'In search index');
        }

        if (filters.category) {
          query = query.contains('categories', [filters.category]);
        }

        if (filters.search) {
          query = query.ilike('title', `%${filters.search}%`);
        }

        // Order: activeOnly prefers date_introduced DESC so newest bills surface first
        const orderCol = filters.orderBy
          ?? (filters.activeOnly ? 'date_introduced' : 'last_updated');
        query = query.order(orderCol, { ascending: false, nullsFirst: false });

        if (filters.limit) {
          query = query.limit(filters.limit);
        }

        const { data, error: err } = await query;
        if (!cancelled) {
          if (err) setError(err.message);
          else setBills(data || []);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) { setError(e.message); setLoading(false); }
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [
    filters.status,
    filters.category,
    filters.search,
    filters.limit,
    filters.orderBy,
    filters.activeOnly,
  ]);

  return { bills, loading, error };
}
