import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface PipelineStatus {
  pipeline_name: string;
  last_success_at: string | null;
  expected_frequency_hours: number;
  is_stale: boolean;
  error_count: number;
  last_error: string | null;
}

export function usePipelineHealth() {
  const [pipelines, setPipelines] = useState<PipelineStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('pipeline_health_status')
        .select('*');
      if (!cancelled) {
        setPipelines((data as PipelineStatus[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const anyStale = pipelines.some(p => p.is_stale);

  return { pipelines, loading, anyStale };
}
