import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscription hook — checks pro status from Supabase.
 *
 * react-native-iap v14+ requires react-native-nitro-modules which is not
 * available in Expo Go. IAP purchasing will be enabled in production builds
 * via a dev client. For now, pro status is managed purely through the DB.
 */
export function useSubscription(userId: string | undefined) {
  const [isPro, setIsPro] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);

  // Check DB for current pro status
  useEffect(() => {
    if (!userId) { setDbLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_preferences')
          .select('is_pro,pro_expires_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (!cancelled) {
          const active =
            !!data?.is_pro &&
            (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
          setIsPro(active);
        }
      } catch {
        // leave isPro as default false
      }
      if (!cancelled) setDbLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const subscribe = useCallback(async () => {
    console.warn('IAP not available in Expo Go — enable in production build');
  }, []);

  const restore = useCallback(async () => {
    if (!userId) return;
    // Re-check DB
    const { data } = await supabase
      .from('user_preferences')
      .select('is_pro,pro_expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    const active =
      !!data?.is_pro &&
      (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
    setIsPro(active);
  }, [userId]);

  return {
    isPro,
    loading: dbLoading,
    subscribe,
    restore,
    product: null,
  };
}
