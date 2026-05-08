import { useState, useEffect, useCallback, useRef } from 'react';
import { withRetry, type RetryOptions } from '../lib/retry';

/**
 * Generic hook for Supabase queries with retry, loading, error, and refresh.
 *
 * Usage:
 *   const { data, loading, error, refresh } = useSupabaseQuery(
 *     () => supabase.from('members').select('*').eq('is_active', true),
 *     [dependency],
 *   );
 */

interface SupabaseResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface UseSupabaseQueryOptions extends RetryOptions {
  enabled?: boolean;
}

export function useSupabaseQuery<T>(
  queryFn: () => Promise<SupabaseResult<T>>,
  deps: unknown[],
  options?: UseSupabaseQueryOptions,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const enabled = options?.enabled ?? true;

  const execute = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await withRetry(async () => {
        const res = await queryFn();
        if (res.error) throw new Error(res.error.message);
        return res.data;
      }, options);
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => { mountedRef.current = false; };
  }, [execute]);

  return { data, loading, error, refresh: execute };
}
