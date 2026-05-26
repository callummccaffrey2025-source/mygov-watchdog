import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface DevelopmentApplication {
  id: string;
  council_id: string;
  da_number: string;
  address: string;
  description: string;
  applicant: string | null;
  lodged_date: string;
  status: string;
  determination: string | null;
  latitude: number | null;
  longitude: number | null;
  estimated_cost: number | null;
  storeys: number | null;
  dwellings: number | null;
  da_type: string;
  exhibition_end: string | null;
  documents_url: string | null;
  source_url: string;
  created_at: string;
  distance_m?: number;
  council?: { id: string; name: string } | null;
}

export function useNearbyDAs(lat?: number | null, lng?: number | null, radiusM = 500) {
  const [das, setDAs] = useState<DevelopmentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      // If no location, fetch all recent DAs
      let query = supabase
        .from('development_applications')
        .select('*, council:councils(id, name)')
        .order('lodged_date', { ascending: false })
        .limit(50);

      const { data, error: err } = await query;
      if (err) { setError(err.message); }
      else {
        let results = (data as unknown as DevelopmentApplication[]) || [];
        // Client-side distance filtering if location available
        if (lat && lng) {
          results = results
            .map(da => {
              if (!da.latitude || !da.longitude) return { ...da, distance_m: 999999 };
              const dist = haversine(lat, lng, da.latitude, da.longitude);
              return { ...da, distance_m: Math.round(dist) };
            })
            .filter(da => da.distance_m! <= radiusM)
            .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
        }
        setDAs(results);
        setError(null);
      }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [lat, lng, radiusM]);

  useEffect(() => { fetch(); }, [fetch]);
  return { das, loading, error, refresh: fetch };
}

// Fetch all DAs (no location filter) for browse mode
export function useAllDAs(councilId?: string | null, limit = 30) {
  const [das, setDAs] = useState<DevelopmentApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let query = supabase
        .from('development_applications')
        .select('*, council:councils(id, name)')
        .order('lodged_date', { ascending: false })
        .limit(limit);
      if (councilId) query = query.eq('council_id', councilId);
      const { data } = await query;
      if (!cancelled) {
        setDAs((data as unknown as DevelopmentApplication[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [councilId, limit]);

  return { das, loading };
}

// Fetch single DA
export function useDADetail(daId: string | undefined) {
  const [da, setDA] = useState<DevelopmentApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!daId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('development_applications')
        .select('*, council:councils(id, name)')
        .eq('id', daId)
        .maybeSingle();
      if (!cancelled) {
        setDA(data as unknown as DevelopmentApplication | null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [daId]);

  return { da, loading };
}

// Haversine distance in meters
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
