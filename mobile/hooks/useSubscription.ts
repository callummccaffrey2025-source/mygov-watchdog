import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSubscription(userId: string | undefined) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
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
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const subscribe = async () => {
    if (!userId) return;
    await supabase.from('user_preferences').upsert(
      {
        user_id: userId,
        is_pro: true,
        pro_expires_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    setIsPro(true);
  };

  const restore = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_preferences')
      .select('is_pro,pro_expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    const active =
      !!data?.is_pro &&
      (!data.pro_expires_at || new Date(data.pro_expires_at) > new Date());
    setIsPro(active);
  };

  return { isPro, loading, subscribe, restore };
}
